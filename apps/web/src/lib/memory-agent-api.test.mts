import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

import { createApiClient } from './api-client.ts';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ERR_MODULE_NOT_FOUND' &&
        specifier.startsWith('.')
      ) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { createMemoryAgentApi } = await import('./memory-agent-api.ts');

const requests: CapturedRequest[] = [];
const memoryAgentApi = createMemoryAgentApi(createTestClient(requests));

const candidateList = await memoryAgentApi.listCandidates('token_1', {
  status: 'PENDING',
  limit: 20,
});
const generated = await memoryAgentApi.generateCandidates('token_1', {
  source: 'profile',
  force: false,
});
const accepted = await memoryAgentApi.acceptCandidate('token_1', 'candidate_1');
const rejected = await memoryAgentApi.rejectCandidate('token_1', 'candidate_1');
const memories = await memoryAgentApi.listMemories('token_1', {
  status: 'ACTIVE',
});
const updated = await memoryAgentApi.updateMemory('token_1', 'memory_1', {
  status: 'ARCHIVED',
});
const deleted = await memoryAgentApi.deleteMemory('token_1', 'memory_1');

assert.equal(
  requests[0].input,
  'http://localhost:3001/memory-agent/candidates?status=PENDING&limit=20',
);
assert.equal(requests[0].method, 'GET');
assert.equal(requests[0].authorization, 'Bearer token_1');
assert.equal(requests[1].input, 'http://localhost:3001/memory-agent/candidates/generate');
assert.equal(requests[1].method, 'POST');
assert.deepEqual(requests[1].body, { source: 'profile', force: false });
assert.equal(
  requests[2].input,
  'http://localhost:3001/memory-agent/candidates/candidate_1/accept',
);
assert.equal(requests[2].method, 'POST');
assert.deepEqual(requests[2].body, {});
assert.equal(
  requests[3].input,
  'http://localhost:3001/memory-agent/candidates/candidate_1/reject',
);
assert.equal(requests[3].method, 'POST');
assert.deepEqual(requests[3].body, {});
assert.equal(requests[4].input, 'http://localhost:3001/user-memories?status=ACTIVE');
assert.equal(requests[4].method, 'GET');
assert.equal(requests[5].input, 'http://localhost:3001/user-memories/memory_1');
assert.equal(requests[5].method, 'PATCH');
assert.deepEqual(requests[5].body, { status: 'ARCHIVED' });
assert.equal(requests[6].input, 'http://localhost:3001/user-memories/memory_1');
assert.equal(requests[6].method, 'DELETE');

assert.equal(candidateList.items[0]?.id, 'candidate_1');
assert.equal(generated.createdCount, 1);
assert.equal(accepted.memory.id, 'memory_1');
assert.equal(rejected.candidate.status, 'REJECTED');
assert.equal(memories.items[0]?.status, 'ACTIVE');
assert.equal(updated.status, 'ARCHIVED');
assert.deepEqual(deleted, { ok: true });

function createTestClient(requests: CapturedRequest[]) {
  return createApiClient({
    baseUrl: 'http://localhost:3001',
    fetchImpl: async (input, init) => {
      requests.push({
        input: String(input),
        method: init?.method ?? 'GET',
        authorization: new Headers(init?.headers).get('authorization'),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
      });

      return new Response(
        JSON.stringify({
          success: true,
          data: createResponseData(String(input), init?.method ?? 'GET'),
          requestId: 'req_1',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    },
  });
}

function createResponseData(input: string, method: string) {
  if (input.includes('/memory-agent/candidates/generate')) {
    return {
      generatedAt: '2026-06-28T00:00:00.000Z',
      createdCount: 1,
      candidates: [createCandidate()],
      summary: '已生成 1 条候选记忆',
    };
  }

  if (input.includes('/memory-agent/candidates/candidate_1/accept')) {
    return {
      candidate: { ...createCandidate(), status: 'ACCEPTED', decidedAt: '2026-06-28T00:00:00.000Z' },
      memory: createMemory(),
    };
  }

  if (input.includes('/memory-agent/candidates/candidate_1/reject')) {
    return {
      candidate: { ...createCandidate(), status: 'REJECTED', decidedAt: '2026-06-28T00:00:00.000Z' },
    };
  }

  if (input.includes('/memory-agent/candidates')) {
    return { items: [createCandidate()] };
  }

  if (input.includes('/user-memories/memory_1') && method === 'PATCH') {
    return { ...createMemory(), status: 'ARCHIVED', archivedAt: '2026-06-28T00:00:00.000Z' };
  }

  if (input.includes('/user-memories/memory_1') && method === 'DELETE') {
    return { ok: true };
  }

  return { items: [createMemory()] };
}

function createCandidate() {
  return {
    id: 'candidate_1',
    userId: 'user_1',
    type: 'EXPLANATION_PREFERENCE',
    title: '讲解偏好',
    content: '用户更偏好先给提示或思路，再给完整答案。',
    reason: '用户在聊天中明确表达了讲解方式偏好。',
    evidence: [{ sourceType: 'chat', sourceId: 'msg_1', summary: '以后先给提示' }],
    confidence: 0.86,
    status: 'PENDING',
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
    decidedAt: null,
  };
}

function createMemory() {
  return {
    id: 'memory_1',
    userId: 'user_1',
    type: 'EXPLANATION_PREFERENCE',
    title: '讲解偏好',
    content: '用户更偏好先给提示或思路，再给完整答案。',
    status: 'ACTIVE',
    confidence: 0.86,
    lastUsedAt: null,
    archivedAt: null,
    createdAt: '2026-06-28T00:00:00.000Z',
    updatedAt: '2026-06-28T00:00:00.000Z',
  };
}

type CapturedRequest = {
  input: string;
  method: string;
  authorization: string | null;
  body?: unknown;
};
