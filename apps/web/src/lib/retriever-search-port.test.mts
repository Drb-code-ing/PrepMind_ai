import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

import type { AuthUser } from '@repo/types/api/auth';

register(
  'data:text/javascript,' +
    encodeURIComponent(
      [
        'export async function resolve(specifier, context, nextResolve) {',
        "  if (specifier === 'server-only') return { url: 'data:text/javascript,export default undefined', shortCircuit: true };",
        '  try { return await nextResolve(specifier, context); } catch (error) {',
        "    if (/^\\.\\.?\\//u.test(specifier) && !/\\.[cm]?[jt]sx?$/u.test(specifier)) return nextResolve(specifier + '.ts', context);",
        '    throw error;',
        '  }',
        '}',
      ].join('\n'),
    ),
  import.meta.url,
);

const { resolveCanonicalChatAgentAccess } = await import('./chat-agent-access.ts');
const { createChatKnowledgeRetrieverSearchPortV1 } = await import('./retriever-search-port.ts');
const { RETRIEVER_AGENT_POLICY_V1, runRetrieverAgentNodeV1 } =
  await import('@repo/agent/retriever');
const { invokeRetrieverSearchPortV1 } = await import('../../../../packages/rag/src/retriever.ts');

const NOW = Date.parse('2026-08-04T12:00:00.000Z');
const DEADLINE = '2026-08-04T12:00:10.000Z';
let accessSequence = 0;

test('authenticated Chat port forwards only query policy with the bound bearer', async () => {
  const request = new Request('http://localhost/api/chat');
  const token = 'bound_retriever_token';
  const resolved = await access({ request, token, ownerId: 'owner_server' });
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  let fetchCalls = 0;
  const created = createChatKnowledgeRetrieverSearchPortV1({
    access: resolved.access,
    request,
    executionContext: resolved.access.executionContext,
    fetchImpl: async (url, init) => {
      fetchCalls += 1;
      assert.equal(url, 'http://localhost:3001/knowledge/search');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer ' + token);
      assert.deepEqual(JSON.parse(String(init?.body)), {
        query: '解释牛顿第二定律',
        topK: 8,
        minScore: 0.72,
      });
      assert.doesNotMatch(String(init?.body), /owner_server|token|userId/u);
      return Response.json({
        success: true,
        data: {
          hits: [safeHit('doc_server', 'chunk_server')],
        },
        requestId: resolved.access.executionContext.requestId,
      });
    },
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const outcome = await runRetrieverAgentNodeV1({
    request: retrieverRequest(resolved.access.executionContext),
    context: resolved.access.executionContext,
    port: created.port,
    now: () => NOW,
  });
  assert.equal(outcome.ok, true);
  assert.equal(fetchCalls, 1);
  if (!outcome.ok) return;
  assert.deepEqual(
    outcome.result.evidenceCandidates.map((candidate) => candidate.chunkId),
    ['chunk_server'],
  );
  const serialized = JSON.stringify({ port: created.port, trace: outcome.traceSummary });
  assert.doesNotMatch(serialized, /bound_retriever_token|owner_server|牛顿第二定律/u);
});

test('anonymous and crossed canonical bindings fail before fetch', async () => {
  let fetchCalls = 0;
  const anonymousRequest = new Request('http://localhost/api/chat?anonymous');
  const anonymous = await resolveCanonicalChatAgentAccess(
    {
      mode: 'mock',
      accessToken: null,
      request: anonymousRequest,
      runId: 'run_anon',
      requestId: 'request_anon',
      deadlineAt: DEADLINE,
      signal: new AbortController().signal,
    },
    { authenticate: async () => authUser('unexpected') },
  );
  assert.equal(anonymous.ok, true);
  if (!anonymous.ok) return;
  assert.deepEqual(
    createChatKnowledgeRetrieverSearchPortV1({
      access: anonymous.access,
      request: anonymousRequest,
      executionContext: anonymous.access.executionContext,
      fetchImpl: async () => {
        fetchCalls += 1;
        return Response.json({});
      },
    }),
    { ok: false, reasonCode: 'principal_binding_invalid' },
  );

  const requestA = new Request('http://localhost/api/chat?a');
  const requestB = new Request('http://localhost/api/chat?b');
  const ownerA = await access({ request: requestA, token: 'token_a', ownerId: 'owner_a' });
  const ownerB = await access({ request: requestB, token: 'token_b', ownerId: 'owner_b' });
  assert.equal(ownerA.ok, true);
  assert.equal(ownerB.ok, true);
  if (!ownerA.ok || !ownerB.ok) return;

  for (const crossed of [
    {
      access: ownerA.access,
      request: requestB,
      executionContext: ownerA.access.executionContext,
    },
    {
      access: ownerA.access,
      request: requestA,
      executionContext: ownerB.access.executionContext,
    },
  ]) {
    assert.deepEqual(
      createChatKnowledgeRetrieverSearchPortV1({
        ...crossed,
        fetchImpl: async () => {
          fetchCalls += 1;
          return Response.json({});
        },
      }),
      { ok: false, reasonCode: 'principal_binding_invalid' },
    );
  }
  assert.equal(fetchCalls, 0);
});

test('concurrent owners retain isolated bearer capabilities and results', async () => {
  const requestA = new Request('http://localhost/api/chat?concurrent=a');
  const requestB = new Request('http://localhost/api/chat?concurrent=b');
  const [ownerA, ownerB] = await Promise.all([
    access({ request: requestA, token: 'isolated_a', ownerId: 'owner_a' }),
    access({ request: requestB, token: 'isolated_b', ownerId: 'owner_b' }),
  ]);
  assert.equal(ownerA.ok, true);
  assert.equal(ownerB.ok, true);
  if (!ownerA.ok || !ownerB.ok) return;

  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    const authorization = new Headers(init?.headers).get('authorization');
    if (authorization === 'Bearer isolated_a') {
      await Promise.resolve();
      return Response.json({
        success: true,
        data: { hits: [safeHit('doc_a', 'chunk_a')] },
      });
    }
    if (authorization === 'Bearer isolated_b') {
      return Response.json({
        success: true,
        data: { hits: [safeHit('doc_b', 'chunk_b')] },
      });
    }
    return Response.json({}, { status: 401 });
  };
  const portA = createChatKnowledgeRetrieverSearchPortV1({
    access: ownerA.access,
    request: requestA,
    executionContext: ownerA.access.executionContext,
    fetchImpl,
  });
  const portB = createChatKnowledgeRetrieverSearchPortV1({
    access: ownerB.access,
    request: requestB,
    executionContext: ownerB.access.executionContext,
    fetchImpl,
  });
  assert.equal(portA.ok, true);
  assert.equal(portB.ok, true);
  if (!portA.ok || !portB.ok) return;

  const [resultB, resultA] = await Promise.all([
    runRetrieverAgentNodeV1({
      request: retrieverRequest(ownerB.access.executionContext),
      context: ownerB.access.executionContext,
      port: portB.port,
      now: () => NOW,
    }),
    runRetrieverAgentNodeV1({
      request: retrieverRequest(ownerA.access.executionContext),
      context: ownerA.access.executionContext,
      port: portA.port,
      now: () => NOW,
    }),
  ]);
  assert.equal(resultA.ok, true);
  assert.equal(resultB.ok, true);
  if (!resultA.ok || !resultB.ok) return;
  assert.equal(resultA.result.evidenceCandidates[0]?.chunkId, 'chunk_a');
  assert.equal(resultB.result.evidenceCandidates[0]?.chunkId, 'chunk_b');
});

test('adapter rejects forged search policy before reading or forwarding the request', async () => {
  const request = new Request('http://localhost/api/chat?policy-drift');
  const resolved = await access({
    request,
    token: 'policy_token',
    ownerId: 'policy_owner',
  });
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  let fetchCalls = 0;
  const created = createChatKnowledgeRetrieverSearchPortV1({
    access: resolved.access,
    request,
    executionContext: resolved.access.executionContext,
    fetchImpl: async () => {
      fetchCalls += 1;
      return Response.json({});
    },
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const portRequest = {
    schemaVersion: 'retriever-search-port-request-v1',
    runId: resolved.access.executionContext.runId,
    requestId: resolved.access.executionContext.requestId,
    deadlineAt: resolved.access.executionContext.deadlineAt,
    query: 'fixed policy only',
    topK: 7,
    minScore: RETRIEVER_AGENT_POLICY_V1.minScore,
    sourceTypes: ['knowledge_document'],
    documentStatuses: ['DONE'],
  };
  Object.defineProperty(portRequest, 'signal', {
    value: resolved.access.executionContext.signal,
    enumerable: false,
  });
  const outcome = await invokeRetrieverSearchPortV1({
    port: created.port,
    scope: resolved.access.executionContext,
    request: portRequest,
  });
  assert.deepEqual(outcome, {
    ok: true,
    outcome: { ok: false, reasonCode: 'schema_invalid' },
  });
  assert.equal(fetchCalls, 0);
});

test('HTTP, malformed envelope, malformed data, and abort become fixed safe failures', async () => {
  const variants = [
    {
      fetchImpl: async () => Response.json({}, { status: 503 }),
      expected: ['retrieval_failed', 'rewrite_gate_off'],
    },
    {
      fetchImpl: async () => Response.json({ success: true, data: { hits: [] }, extra: 'x' }),
      expected: ['schema_invalid', 'rewrite_gate_off'],
    },
    {
      fetchImpl: async () =>
        Response.json({ success: true, data: { hits: [{ malformed: true }] } }),
      expected: ['schema_invalid', 'rewrite_gate_off'],
    },
    {
      fetchImpl: async () =>
        Response.json({ success: true, data: { hits: [] }, requestId: 'request_from_other_run' }),
      expected: ['schema_invalid', 'rewrite_gate_off'],
    },
  ];
  for (const [index, variant] of variants.entries()) {
    const request = new Request('http://localhost/api/chat?failure=' + index);
    const resolved = await access({
      request,
      token: 'failure_token_' + index,
      ownerId: 'failure_owner_' + index,
    });
    assert.equal(resolved.ok, true);
    if (!resolved.ok) continue;
    let fetchCalls = 0;
    const created = createChatKnowledgeRetrieverSearchPortV1({
      access: resolved.access,
      request,
      executionContext: resolved.access.executionContext,
      fetchImpl: async (...args) => {
        fetchCalls += 1;
        return await variant.fetchImpl(...args);
      },
    });
    assert.equal(created.ok, true);
    if (!created.ok) continue;
    const outcome = await runRetrieverAgentNodeV1({
      request: retrieverRequest(resolved.access.executionContext),
      context: resolved.access.executionContext,
      port: created.port,
      now: () => NOW,
    });
    assert.equal(outcome.ok, true);
    if (outcome.ok) assert.deepEqual(outcome.result.reasonCodes, variant.expected);
    assert.equal(fetchCalls, 1);
  }

  const controller = new AbortController();
  const request = new Request('http://localhost/api/chat?abort');
  const resolved = await access({
    request,
    token: 'abort_token',
    ownerId: 'abort_owner',
    signal: controller.signal,
  });
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  const created = createChatKnowledgeRetrieverSearchPortV1({
    access: resolved.access,
    request,
    executionContext: resolved.access.executionContext,
    fetchImpl: async (_url, init) =>
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('raw abort')), {
          once: true,
        });
      }),
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const pending = runRetrieverAgentNodeV1({
    request: retrieverRequest(resolved.access.executionContext),
    context: resolved.access.executionContext,
    port: created.port,
    now: () => NOW,
  });
  queueMicrotask(() => controller.abort());
  const outcome = await pending;
  assert.equal(outcome.ok, true);
  if (outcome.ok) {
    assert.deepEqual(outcome.result.reasonCodes, ['aborted', 'rewrite_gate_off']);
    assert.doesNotMatch(JSON.stringify(outcome.traceSummary), /abort_token|raw abort/u);
  }
});

async function access(input: {
  request: Request;
  token: string;
  ownerId: string;
  signal?: AbortSignal;
}) {
  accessSequence += 1;
  const correlationId = String(accessSequence).padStart(4, '0');
  return await resolveCanonicalChatAgentAccess(
    {
      mode: 'mock',
      accessToken: input.token,
      request: input.request,
      runId: 'run_retriever_' + correlationId,
      requestId: 'request_retriever_' + correlationId,
      deadlineAt: DEADLINE,
      signal: input.signal ?? new AbortController().signal,
    },
    { authenticate: async () => authUser(input.ownerId) },
  );
}

function retrieverRequest(context: { runId: string; requestId: string; deadlineAt: string }) {
  return {
    schemaVersion: 'retriever-request-v1',
    runId: context.runId,
    requestId: context.requestId,
    deadlineAt: context.deadlineAt,
    originalQuery: '解释牛顿第二定律',
    recentTurns: [],
    requiresRag: true,
    policy: {
      topK: RETRIEVER_AGENT_POLICY_V1.topK,
      minScore: RETRIEVER_AGENT_POLICY_V1.minScore,
      sourceTypes: [...RETRIEVER_AGENT_POLICY_V1.sourceTypes],
      documentStatuses: [...RETRIEVER_AGENT_POLICY_V1.documentStatuses],
    },
  };
}

function safeHit(documentId: string, chunkId: string) {
  return {
    documentId,
    chunkId,
    documentName: 'Synthetic document',
    content: '牛顿第二定律说明合外力等于质量与加速度的乘积。',
    score: 0.91,
    metadata: {
      safety: {
        riskLevel: 'low',
        categories: [],
        matchedPatterns: [],
        safeForPrompt: true,
      },
      retrieval: {
        mode: 'hybrid',
        vectorScore: 0.9,
        keywordScore: 0.2,
      },
    },
  };
}

function authUser(id: string): AuthUser {
  return {
    id,
    email: id + '@example.com',
    phone: null,
    name: id,
    avatarUrl: null,
    role: 'STUDENT',
    createdAt: '2026-08-04T00:00:00.000Z',
    updatedAt: '2026-08-04T00:00:00.000Z',
  };
}
