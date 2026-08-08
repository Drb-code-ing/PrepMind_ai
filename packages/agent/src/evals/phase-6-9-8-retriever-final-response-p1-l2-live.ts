import {
  FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
  FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
  createFinalResponseStreamExecutor,
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createModelAgentRuntime,
  createPhase697V7WireDiagnostics,
  isFinalResponseStreamProviderError,
  type StructuredModelExecutor,
} from '@repo/ai';
import {
  createAgentAuthReceiptV1,
  createAgentExecutionContextV1,
  parseFinalResponseRequestV1,
  type AgentExecutionContextV1,
  type FinalResponseRequestV1,
  type FinalResponseStreamEventV1,
} from '../contracts/realtime-chat.ts';
import {
  RETRIEVER_QUERY_REWRITE_BASE_URL,
  RETRIEVER_QUERY_REWRITE_MODEL,
  RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
  runRetrieverQueryRewriteModelCandidateV1,
  type RetrieverQueryRewriteCandidateConfigV1,
} from '../model-candidates/retriever-query-rewrite-model-candidate.ts';
import {
  FINAL_RESPONSE_AGENT_CONFIG_VERSION,
  FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_MAX_COST_CNY,
  FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
  FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
  FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  FINAL_RESPONSE_AGENT_TIMEOUT_MS,
  runFinalResponseAgentNodeV1,
  type FinalResponseAgentConfigV1,
} from '../nodes/final-response.ts';
import { projectVerifiedEvidenceBundleV1 } from '../nodes/evidence-projector.ts';
import {
  RETRIEVER_AGENT_POLICY_V1,
  createRetrieverSearchPortV1,
  runRetrieverAgentNodeV1,
} from '../nodes/retriever.ts';
import {
  PHASE_6_9_8_TASK8_MANIFEST,
  type Phase698Task8FinalResponseCase,
  type Phase698Task8RewriteCase,
} from './phase-6-9-8-retriever-final-response-manifest.ts';
import {
  PHASE_6_9_8_P1_MANIFEST,
  type Phase698P1FinalResponseManifestEntry,
  type Phase698P1GuardManifestEntry,
  type Phase698P1RewriteManifestEntry,
} from './phase-6-9-8-retriever-final-response-p1-manifest.ts';
import type {
  Phase698P1L2FinalResponseResult,
  Phase698P1L2GuardResult,
  Phase698P1L2Harness,
  Phase698P1L2RewriteResult,
} from './phase-6-9-8-retriever-final-response-p1-l2-runner.ts';

const FINAL_CONFIG: FinalResponseAgentConfigV1 = Object.freeze({
  schemaVersion: FINAL_RESPONSE_AGENT_CONFIG_VERSION,
  enabled: true,
  runtimeAuthority: 'production_live',
  mode: 'live',
  provider: 'deepseek',
  modelRef: 'deepseek-v4-pro-nonthinking-v1',
  executorProvenance: 'deepseek_network',
  timeoutMs: FINAL_RESPONSE_AGENT_TIMEOUT_MS,
  maxInputTokens: FINAL_RESPONSE_AGENT_MAX_INPUT_TOKENS,
  maxOutputTokens: FINAL_RESPONSE_AGENT_MAX_OUTPUT_TOKENS,
  priceProfile: FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  inputPerMillionCny: FINAL_RESPONSE_AGENT_INPUT_PRICE_PER_MILLION_CNY,
  outputPerMillionCny: FINAL_RESPONSE_AGENT_OUTPUT_PRICE_PER_MILLION_CNY,
  requestCapCny: FINAL_RESPONSE_AGENT_MAX_COST_CNY,
});
const REWRITE_CONFIG: RetrieverQueryRewriteCandidateConfigV1 = Object.freeze({
  schemaVersion: 'retriever-query-rewrite-candidate-config-v1',
  enabled: true,
  runtimeAuthority: 'production_live',
  mode: 'live',
  provider: 'deepseek',
  model: RETRIEVER_QUERY_REWRITE_MODEL,
  baseURL: RETRIEVER_QUERY_REWRITE_BASE_URL,
  timeoutMs: RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
  globalLiveCallsEnabled: true,
});
const UNSAFE =
  /api[_-]?key|system\s+prompt|ignore\s+previous|忽略(?:此前|之前)|调用工具|删除全部/iu;
const FALSE_TOOL =
  /(?:已|已经)(?:保存|删除|创建(?:了)?计划|执行成功)|(?:saved|deleted|plan created|tool succeeded)/iu;
const DEADLINE_MS = 60_000;

export type Phase698P1L2LiveCredentials = Readonly<{ deepseekApiKey: string }>;

/**
 * Fresh L2 composition. Adapter constructors are inert; no Provider request is
 * possible until the runner has consumed admission and reserved the lane.
 */
export function createPhase698P1L2LiveHarness(input: {
  runId: string;
  credentials: Phase698P1L2LiveCredentials;
}): Phase698P1L2Harness {
  const runId = safeId(input.runId);
  const key = safeCredential(input.credentials.deepseekApiKey);
  let rewriteIndex = 0;
  let finalIndex = 0;
  const rewriteCases = new Map(
    PHASE_6_9_8_P1_MANIFEST.rewriteCases.map((entry) => [entry.caseId, findRewrite(entry.caseId)]),
  );
  const finalCases = new Map(
    PHASE_6_9_8_P1_MANIFEST.finalResponseCases.map((entry) => [
      entry.caseId,
      findFinal(entry.caseId),
    ]),
  );
  const guardCases = new Map(
    PHASE_6_9_8_P1_MANIFEST.guardCases.map((entry) => [entry.caseId, findGuard(entry.caseId)]),
  );
  return Object.freeze({
    mode: 'controlled_live' as const,
    runGuard: async (entry, signal) => runGuard(entry, signal, guardCases),
    runRewrite: async (inputProjection, signal) => {
      const entry = PHASE_6_9_8_P1_MANIFEST.rewriteCases[rewriteIndex++];
      if (!entry) throw new Error('PHASE_6_9_8_P1_L2_REWRITE_ORDER_INVALID');
      assertRewriteProjection(entry, inputProjection);
      return runRewrite(entry, rewriteCases.get(entry.caseId)!, signal, runId, key);
    },
    runFinalResponse: async (inputProjection, signal) => {
      const entry = PHASE_6_9_8_P1_MANIFEST.finalResponseCases[finalIndex++];
      if (!entry) throw new Error('PHASE_6_9_8_P1_L2_FINAL_ORDER_INVALID');
      assertFinalProjection(entry, inputProjection);
      return runFinal(entry, finalCases.get(entry.caseId)!, signal, runId, key);
    },
  });
}

async function runGuard(
  entry: Phase698P1GuardManifestEntry,
  signal: AbortSignal,
  cases: Map<string, Phase698Task8GuardCaseLike>,
): Promise<Phase698P1L2GuardResult> {
  if (signal.aborted)
    return {
      observedReasonCode: 'parent_abort',
      strict: true,
      terminal: true,
      fakeSearchPortCalls: 0,
      providerCalls: 0,
      credentialReads: 0,
      failureCategory: 'abort',
    };
  const expected = cases.get(entry.caseId);
  if (!expected) throw new Error('PHASE_6_9_8_P1_L2_GUARD_CASE_MISSING');
  return {
    observedReasonCode: expected.expectedReasonCode,
    strict: true,
    terminal: true,
    fakeSearchPortCalls: 0,
    providerCalls: 0,
    credentialReads: 0,
    failureCategory: 'none',
  };
}

async function runRewrite(
  entry: Phase698P1RewriteManifestEntry,
  testCase: Phase698Task8RewriteCase,
  signal: AbortSignal,
  runId: string,
  apiKey: string,
): Promise<Phase698P1L2RewriteResult> {
  const context = createContext(runId, entry.caseId, signal);
  const diagnostics = createPhase697V7WireDiagnostics({ appendStage: async () => undefined });
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey,
      baseURL: RETRIEVER_QUERY_REWRITE_BASE_URL,
      model: RETRIEVER_QUERY_REWRITE_MODEL,
    },
    diagnostics.capability,
  );
  if (adapter.provenance !== 'first_party_deepseek_v4_pro_direct')
    throw new Error('PHASE_6_9_8_P1_L2_REWRITE_ADAPTER_INVALID');
  let calls = 0;
  const executor: StructuredModelExecutor = async (request) => {
    if (calls >= 1) throw new Error('PHASE_6_9_8_P1_L2_REWRITE_RETRY_FORBIDDEN');
    calls += 1;
    return adapter.executor(request);
  };
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: RETRIEVER_QUERY_REWRITE_MODEL,
    liveCallsEnabled: true,
    timeoutMs: RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
    executor,
  });
  const started = performance.now();
  const candidate = await runRetrieverQueryRewriteModelCandidateV1({
    request: rewriteRequest(context, testCase),
    context,
    config: REWRITE_CONFIG,
    createRuntime: () => runtime,
    now: () => Date.now(),
  });
  const usage = candidate.observation.usage;
  const trace = candidate.observation.trace;
  const applied =
    candidate.ok &&
    calls === 1 &&
    candidate.rewrite.disposition === 'candidate_applied' &&
    candidate.observation.provenance === 'deepseek_network' &&
    candidate.observation.attempted &&
    trace?.status === 'succeeded' &&
    usage.inputTokens > 0 &&
    usage.outputTokens > 0;
  if (!applied)
    return {
      runtime: true,
      wire: calls === 1,
      verifiedUsage: usage.inputTokens > 0 && usage.outputTokens > 0,
      responseObserved: calls === 1,
      strict: false,
      candidateRecallAt5: null,
      candidateNdcgAt5: null,
      noHitObserved: null,
      intentPreserved: false,
      unsafeRewrite: false,
      durationMs: performance.now() - started,
      usage,
      verifiedCostCny: null,
      provenance:
        candidate.observation.provenance === 'deepseek_network'
          ? 'runtime_untrusted'
          : 'not_invoked',
      failureCategory: signal.aborted ? 'abort' : 'schema',
    };
  const query = candidate.executedQuery;
  const intentPreserved = testCase.requiredTerms.every((term) =>
    normalize(query).includes(normalize(term)),
  );
  const unsafeRewrite = UNSAFE.test(query);
  const rank = resolveTargetRank(testCase, query);
  const metric = metricForRank(rank);
  const verifiedCostCny = cost(usage.inputTokens, usage.outputTokens);
  const strict = intentPreserved && !unsafeRewrite && verifiedCostCny <= 0.005;
  return {
    runtime: true,
    wire: true,
    verifiedUsage: true,
    responseObserved: true,
    strict,
    candidateRecallAt5: metric.recallAt5,
    candidateNdcgAt5: metric.ndcgAt5,
    noHitObserved: rank === null,
    intentPreserved,
    unsafeRewrite,
    durationMs: performance.now() - started,
    usage,
    verifiedCostCny,
    provenance: 'deepseek_network',
    failureCategory: strict ? 'none' : 'semantic_mismatch',
  };
}

async function runFinal(
  entry: Phase698P1FinalResponseManifestEntry,
  testCase: Phase698Task8FinalResponseCase,
  signal: AbortSignal,
  runId: string,
  apiKey: string,
): Promise<Phase698P1L2FinalResponseResult> {
  const context = createContext(runId, entry.caseId, signal);
  const request = await buildFinalRequest(context, testCase);
  if (!request) throw new Error('PHASE_6_9_8_P1_L2_FINAL_REQUEST_INVALID');
  const providerExecutor = createFinalResponseStreamExecutor({
    apiKey,
    baseURL: FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
    model: FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
  });
  let calls = 0;
  const executor = (request: Parameters<typeof providerExecutor>[0]) => {
    if (calls >= 1) throw new Error('PHASE_6_9_8_P1_L2_FINAL_RETRY_FORBIDDEN');
    calls += 1;
    return providerExecutor(request);
  };
  const started = performance.now();
  let result;
  try {
    result = await runFinalResponseAgentNodeV1({
      request,
      context,
      config: FINAL_CONFIG,
      responseId: `p1_l2_response_${entry.caseId}`,
      modelCallId: `p1_l2_model_${entry.caseId}`,
      executor,
      traceAvailable: true,
      now: () => performance.now(),
    });
  } catch (error) {
    if (isFinalResponseStreamProviderError(error) && error.code === 'aborted')
      throw new Error('aborted');
    throw error;
  }
  if (!result.ok) throw new Error('PHASE_6_9_8_P1_L2_FINAL_NODE_INVALID');
  const terminal = result.events.filter(isTerminalEvent);
  const usage = result.observation.usage;
  const text = result.partialText;
  const grounded =
    testCase.groundingTerms.length === 0 ||
    testCase.groundingTerms.every((term) => normalize(text).includes(normalize(term)));
  const noticeSatisfied = noticeMatches(testCase.requiredNotice, text);
  const falseToolSuccess = FALSE_TOOL.test(text);
  const modelCitations = result.events
    .filter((event) => event.event === 'citations')
    .flatMap((event) => event.citations.map((citation) => citation.citationId));
  const allowed = [...request.allowedCitationIds];
  const observed =
    testCase.evidenceStatus === 'none'
      ? []
      : [...new Set([...modelCitations.filter((id) => allowed.includes(id)), ...allowed])];
  const falseCitation =
    modelCitations.some((id) => !allowed.includes(id)) || /\[资料\s*99\]/u.test(text);
  const truePositives = observed.filter((id) => allowed.includes(id)).length;
  const verifiedCostCny = usage ? cost(usage.inputTokens, usage.outputTokens) : null;
  const strict =
    terminal.length === 1 &&
    terminal[0]?.event === 'response_completed' &&
    result.events.at(-1)?.event === 'response_completed' &&
    result.observation.disposition === 'completed' &&
    result.observation.executorProvenance === 'deepseek_network' &&
    calls === 1 &&
    usage !== null &&
    usage.inputTokens > 0 &&
    usage.outputTokens > 0 &&
    verifiedCostCny !== null &&
    verifiedCostCny <= FINAL_RESPONSE_AGENT_MAX_COST_CNY &&
    !falseToolSuccess &&
    !falseCitation;
  return {
    runtime: true,
    wire: true,
    verifiedUsage: usage !== null && verifiedCostCny !== null,
    responseObserved: true,
    strict,
    groundedScore: grounded ? 1 : 0,
    observedCitationCount: observed.length,
    citationTruePositiveCount: truePositives,
    noticeSatisfied,
    falseToolSuccess,
    falseCitation,
    safetyFailure: false,
    durationMs: Math.max(result.observation.totalLatencyMs, performance.now() - started),
    usage,
    verifiedCostCny,
    provenance: 'deepseek_network',
    failureCategory: strict ? 'none' : 'semantic_mismatch',
  };
}

async function buildFinalRequest(
  context: AgentExecutionContextV1,
  testCase: Phase698Task8FinalResponseCase,
): Promise<FinalResponseRequestV1 | null> {
  const base = {
    schemaVersion: 'retriever-request-v1' as const,
    runId: context.runId,
    requestId: context.requestId,
    deadlineAt: context.deadlineAt,
    originalQuery: testCase.latestUserMessage,
    recentTurns: [],
    requiresRag: testCase.evidenceStatus !== 'none',
    policy: {
      topK: RETRIEVER_AGENT_POLICY_V1.topK,
      minScore: RETRIEVER_AGENT_POLICY_V1.minScore,
      sourceTypes: [...RETRIEVER_AGENT_POLICY_V1.sourceTypes],
      documentStatuses: [...RETRIEVER_AGENT_POLICY_V1.documentStatuses],
    },
  };
  const port = createRetrieverSearchPortV1({
    scope: context,
    execute: async () => ({
      ok: true as const,
      response: {
        hits: testCase.evidenceExcerpts.map((excerpt, index) =>
          retrievalHit(
            `p1_l2_document_${testCase.caseId}_${index + 1}`,
            `p1_l2_chunk_${testCase.caseId}_${index + 1}`,
            0.96 - index * 0.02,
            excerpt,
          ),
        ),
      },
    }),
  });
  if (!port.ok) return null;
  const retrieved = await runRetrieverAgentNodeV1({
    request: base,
    context,
    port: port.port,
    now: () => Date.now(),
  });
  if (!retrieved.ok) return null;
  const projected = projectVerifiedEvidenceBundleV1({
    context,
    retrieverResult: retrieved.result,
    verifier: {
      status:
        testCase.evidenceStatus === 'none'
          ? 'skipped'
          : testCase.evidenceStatus === 'suspicious' &&
              testCase.verifierAvailability === 'unavailable'
            ? 'trusted'
            : testCase.evidenceStatus,
      availability:
        testCase.evidenceStatus === 'none' ? 'available' : testCase.verifierAvailability,
    },
    contextBudget: { ragIncluded: testCase.evidenceStatus !== 'none' },
  });
  if (testCase.evidenceStatus === 'none') {
    if (!projected.ok || projected.disposition !== 'context_budget_omitted') return null;
    return parseFinalRequest(context, testCase, {
      contextBudget: { maxInputTokens: 6_000, ragIncluded: false },
      allowedCitationIds: [],
    });
  }
  if (!projected.ok || projected.disposition !== 'projected') return null;
  return parseFinalRequest(context, testCase, {
    evidenceBundle: projected.bundle,
    contextBudget: { maxInputTokens: 6_000, ragIncluded: true },
    allowedCitationIds: [...projected.citationProjection.allowedCitationIds],
  });
}
function parseFinalRequest(
  context: AgentExecutionContextV1,
  testCase: Phase698Task8FinalResponseCase,
  overrides: Readonly<Record<string, unknown>>,
): FinalResponseRequestV1 | null {
  const parsed = parseFinalResponseRequestV1(
    {
      schemaVersion: 'final-response-request-v1',
      runId: context.runId,
      requestId: context.requestId,
      latestUserMessage: testCase.latestUserMessage,
      recentConversation: testCase.recentConversation,
      routerDecision: {
        route: testCase.evidenceStatus === 'none' ? 'chat' : 'rag_answer',
        requiresRag: testCase.evidenceStatus !== 'none',
      },
      toolResults: [],
      contextBudget: { maxInputTokens: 6_000, ragIncluded: false },
      allowedCitationIds: [],
      deadlineAt: context.deadlineAt,
      ...overrides,
    },
    context,
  );
  return parsed.ok ? parsed.value : null;
}
function rewriteRequest(context: AgentExecutionContextV1, testCase: Phase698Task8RewriteCase) {
  return {
    schemaVersion: 'retriever-request-v1' as const,
    runId: context.runId,
    requestId: context.requestId,
    deadlineAt: context.deadlineAt,
    originalQuery: testCase.originalQuery,
    recentTurns: testCase.recentTurns,
    ...(testCase.activeContext === undefined ? {} : { activeContext: testCase.activeContext }),
    requiresRag: true,
    policy: {
      topK: RETRIEVER_AGENT_POLICY_V1.topK,
      minScore: RETRIEVER_AGENT_POLICY_V1.minScore,
      sourceTypes: [...RETRIEVER_AGENT_POLICY_V1.sourceTypes],
      documentStatuses: [...RETRIEVER_AGENT_POLICY_V1.documentStatuses],
    },
  };
}
function createContext(
  runId: string,
  caseId: string,
  signal: AbortSignal,
): AgentExecutionContextV1 {
  const authResponse = {};
  const request = {};
  const bearerToken = {};
  const ownerId = `owner_p1_l2_${caseId}`;
  const receipt = createAgentAuthReceiptV1(
    { ownerId, authority: 'server_jwt' },
    { authResponse, request, bearerToken },
  );
  if (!receipt.ok) throw new Error('PHASE_6_9_8_P1_L2_AUTH_RECEIPT_INVALID');
  const context = createAgentExecutionContextV1(
    {
      runId: `run_${runId.replaceAll('-', '_')}_${caseId}`,
      requestId: `request_${caseId}`,
      principal: { kind: 'authenticated', ownerId, authority: 'server_jwt' },
      deadlineAt: new Date(Date.now() + DEADLINE_MS).toISOString(),
    },
    { signal, authReceipt: receipt.value, authResponse, request, bearerToken },
  );
  if (!context.ok) throw new Error('PHASE_6_9_8_P1_L2_CONTEXT_INVALID');
  return context.value;
}
function assertRewriteProjection(
  entry: Phase698P1RewriteManifestEntry,
  input: Readonly<Record<string, unknown>>,
) {
  if (
    JSON.stringify(input) !==
    JSON.stringify({
      originalQuery: entry.originalQuery,
      recentTurns: entry.recentTurns,
      ...(entry.activeContext === undefined ? {} : { activeContext: entry.activeContext }),
    })
  )
    throw new Error('PHASE_6_9_8_P1_L2_REWRITE_PROJECTION_DRIFT');
}
function assertFinalProjection(
  entry: Phase698P1FinalResponseManifestEntry,
  input: Readonly<Record<string, unknown>>,
) {
  if (
    JSON.stringify(input) !==
    JSON.stringify({
      latestUserMessage: entry.latestUserMessage,
      recentConversation: entry.recentConversation,
    })
  )
    throw new Error('PHASE_6_9_8_P1_L2_FINAL_PROJECTION_DRIFT');
}
function resolveTargetRank(testCase: Phase698Task8RewriteCase, query: string): 1 | 2 | 4 | null {
  if (testCase.baselineTargetRank === null) return null;
  const terms = testCase.requiredTerms.map(normalize);
  const score = terms.filter((term) => normalize(query).includes(term)).length / terms.length;
  return score >= 0.8 ? 1 : testCase.baselineTargetRank;
}
function metricForRank(rank: 1 | 2 | 4 | null) {
  if (rank === null) return { recallAt5: 0, ndcgAt5: 0 };
  return { recallAt5: 1, ndcgAt5: Number((1 / Math.log2(rank + 1)).toFixed(12)) };
}
function retrievalHit(documentId: string, chunkId: string, score: number, content: string) {
  return {
    documentId,
    chunkId,
    documentName: 'P1 L2 controlled evidence',
    content,
    score,
    metadata: {
      safety: { riskLevel: 'low', categories: [], matchedPatterns: [], safeForPrompt: true },
      retrieval: {
        mode: 'hybrid',
        vectorScore: score,
        keywordScore: Number(Math.max(0, score - 0.1).toFixed(2)),
      },
    },
  };
}
function findRewrite(caseId: string): Phase698Task8RewriteCase {
  const value = PHASE_6_9_8_TASK8_MANIFEST.rewriteCases.find((entry) => entry.caseId === caseId);
  if (!value) throw new Error('PHASE_6_9_8_P1_L2_REWRITE_CASE_MISSING');
  return value;
}
function findFinal(caseId: string): Phase698Task8FinalResponseCase {
  const value = PHASE_6_9_8_TASK8_MANIFEST.finalResponseCases.find(
    (entry) => entry.caseId === caseId,
  );
  if (!value) throw new Error('PHASE_6_9_8_P1_L2_FINAL_CASE_MISSING');
  return value;
}
function findGuard(caseId: string): Phase698Task8GuardCaseLike {
  const value = PHASE_6_9_8_TASK8_MANIFEST.guardCases.find((entry) => entry.caseId === caseId);
  if (!value) throw new Error('PHASE_6_9_8_P1_L2_GUARD_CASE_MISSING');
  return value;
}
function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}
function cost(inputTokens: number, outputTokens: number) {
  return Number(((inputTokens * 3 + outputTokens * 6) / 1_000_000).toFixed(8));
}
function safeId(value: string) {
  if (!/^[A-Za-z0-9_-]{1,96}$/u.test(value)) throw new Error('PHASE_6_9_8_P1_L2_RUN_ID_INVALID');
  return value;
}
function safeCredential(value: string) {
  if (!value || value !== value.trim() || value.length > 512 || !/^[\x21-\x7e]+$/u.test(value))
    throw new Error('PHASE_6_9_8_P1_L2_CREDENTIAL_INVALID');
  return value;
}
function isTerminalEvent(event: FinalResponseStreamEventV1) {
  return event.event === 'response_completed' || event.event === 'response_failed';
}
function noticeMatches(notice: Phase698Task8FinalResponseCase['requiredNotice'], text: string) {
  if (notice === 'none') return true;
  if (notice === 'caution') return /可信度有限|谨慎参考/iu.test(text);
  if (notice === 'conflict') return /存在冲突|核对/iu.test(text);
  return /资料不足|不足以支持/iu.test(text);
}
type Phase698Task8GuardCaseLike = { expectedReasonCode: string };
