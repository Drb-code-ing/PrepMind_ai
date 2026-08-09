import { Buffer } from 'node:buffer';

import {
  createSafeModelAgentError,
  hashModelAgentRunId,
  reserveModelAgentBudget,
  type ModelAgentRequest,
  type ModelAgentResult,
  type ModelAgentErrorCode,
  type ModelAgentProviderFailureCategory,
  type ModelAgentStructuredOutputStage,
} from '@repo/ai';
import { parseModelAgentJsonContentWithPolicy } from '../../ai/src/model-agent-structured-output-policy.ts';

import {
  createAgentAuthReceiptV1,
  createAgentExecutionContextV1,
  type AgentExecutionContextV1,
} from '../src/contracts/realtime-chat.ts';
import {
  RETRIEVER_QUERY_REWRITE_BASE_URL,
  RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS,
  RETRIEVER_QUERY_REWRITE_MODEL,
  RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
  type RetrieverQueryRewriteCandidateConfigV1,
} from '../src/model-candidates/retriever-query-rewrite-model-candidate.ts';

export const RETRIEVER_SCHEMA_RECOVERY_SR2_MOCK_CONFIG: RetrieverQueryRewriteCandidateConfigV1 =
  Object.freeze({
    schemaVersion: 'retriever-query-rewrite-candidate-config-v1',
    enabled: true,
    runtimeAuthority: 'reviewed_mock',
    mode: 'mock',
    provider: 'mock',
    model: RETRIEVER_QUERY_REWRITE_MODEL,
    baseURL: RETRIEVER_QUERY_REWRITE_BASE_URL,
    timeoutMs: RETRIEVER_QUERY_REWRITE_TIMEOUT_MS,
    globalLiveCallsEnabled: false,
  });

export type RetrieverSr2RuntimeFault =
  | 'provider_failure'
  | 'usage_mismatch'
  | 'trace_mismatch'
  | 'timeout'
  | 'in_flight_abort';

export type RetrieverSr2TrackedRuntimeOptions = Readonly<{
  content?: string;
  fault?: RetrieverSr2RuntimeFault;
  providerFailureCategory?: 'transport' | 'http_rate_limit' | 'invalid_response';
  timeoutMs?: number;
  onInvoke?: (signal: AbortSignal) => void;
}>;

export function createRetrieverSr2TrackedRuntime(options: RetrieverSr2TrackedRuntimeOptions = {}) {
  let invokes = 0;
  const requests: Array<
    Pick<ModelAgentRequest<unknown>, 'schema' | 'userPrompt' | 'systemPrompt'>
  > = [];
  const schemas: object[] = [];

  const runtime = Object.freeze({
    async invokeStructured<T>(request: ModelAgentRequest<T>): Promise<ModelAgentResult<T>> {
      invokes += 1;
      const signal = request.signal ?? new AbortController().signal;
      options.onInvoke?.(signal);
      const runtimeRequest = {
        schema: request.schema,
        userPrompt: request.userPrompt,
        systemPrompt: request.systemPrompt,
      };
      requests.push(runtimeRequest);
      schemas.push(request.schema);

      const reservation = reserveModelAgentBudget(request.budget, {
        inputTokens: request.estimatedInputTokens,
        outputTokens: request.maxOutputTokens,
      });
      if (!reservation.ok) {
        return createSyntheticFailure(request, request.budget, 'CALL_BUDGET_EXCEEDED');
      }

      if (options.fault === 'timeout' || options.fault === 'in_flight_abort') {
        const terminal = await waitForSyntheticTerminal(signal, options.timeoutMs ?? 500);
        return createSyntheticFailure(
          request,
          terminal === 'aborted' ? request.budget : reservation.budget,
          terminal === 'aborted' ? 'ABORTED' : 'TIMEOUT',
        );
      }
      if (signal.aborted) return createSyntheticFailure(request, request.budget, 'ABORTED');

      if (options.fault === 'provider_failure') {
        const category = options.providerFailureCategory ?? 'transport';
        return createSyntheticFailure(request, reservation.budget, 'PROVIDER_ERROR', category);
      }

      const content = options.content ?? deriveRetrieverSr2PromptContent(request.userPrompt);
      const policy = parseModelAgentJsonContentWithPolicy(request.schema, content);
      if (!policy.handled || !policy.result.ok) {
        return createSyntheticFailure(
          request,
          reservation.budget,
          'PROVIDER_ERROR',
          'structured_output',
          policy.handled ? policy.result.stage : 'provider_type_validation',
        );
      }

      const usage = {
        inputTokens: 101,
        outputTokens:
          options.fault === 'usage_mismatch' ? RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS + 1 : 12,
      };
      const result: ModelAgentResult<T> = {
        ok: true,
        data: policy.result.value as T,
        budget: reservation.budget,
        usage,
        trace: createSyntheticTrace(request, usage, 'succeeded'),
      };
      if (options.fault !== 'trace_mismatch') return result;
      return { ...result, trace: { ...result.trace, model: 'sr2-untrusted-model' } };
    },
  });

  return Object.freeze({
    runtime,
    requests,
    schemas,
    invokes: () => invokes,
  });
}

function createSyntheticFailure<T>(
  request: ModelAgentRequest<T>,
  budget: ModelAgentRequest<T>['budget'],
  code: ModelAgentErrorCode,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
  structuredOutputStage?: ModelAgentStructuredOutputStage,
): ModelAgentResult<T> {
  const usage = { inputTokens: 0, outputTokens: 0 };
  const error = createSafeModelAgentError(code, providerFailureCategory);
  return {
    ok: false,
    error,
    budget: { ...budget },
    usage,
    trace: createSyntheticTrace(
      request,
      usage,
      'failed',
      code,
      providerFailureCategory,
      structuredOutputStage,
    ),
  };
}

function createSyntheticTrace(
  request: ModelAgentRequest<unknown>,
  usage: { inputTokens: number; outputTokens: number },
  status: 'succeeded' | 'failed',
  errorCode?: ModelAgentErrorCode,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
  structuredOutputStage?: ModelAgentStructuredOutputStage,
) {
  return {
    runIdHash: hashModelAgentRunId(request.runId),
    task: request.task,
    mode: 'mock' as const,
    provider: 'mock' as const,
    model: RETRIEVER_QUERY_REWRITE_MODEL,
    status,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    maxOutputTokens: request.maxOutputTokens,
    durationMs: 0,
    degraded: status === 'failed',
    ...(errorCode === undefined ? {} : { errorCode }),
    ...(providerFailureCategory === undefined ? {} : { providerFailureCategory }),
    ...(structuredOutputStage === undefined ? {} : { structuredOutputStage }),
  };
}

async function waitForSyntheticTerminal(
  signal: AbortSignal,
  timeoutMs: number,
): Promise<'aborted' | 'timeout'> {
  if (signal.aborted) return 'aborted';
  return new Promise((resolve) => {
    let settled = false;
    const settle = (value: 'aborted' | 'timeout') => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => settle('aborted');
    const timer = setTimeout(() => settle('timeout'), timeoutMs);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) settle('aborted');
  });
}

export function createRetrieverSr2AuthenticatedContext(
  ownerId: string,
  signal = new AbortController().signal,
  deadlineAt = '2026-08-09T12:00:10.000Z',
): AgentExecutionContextV1 {
  const authResponse = {};
  const request = {};
  const bearerToken = {};
  const receipt = createAgentAuthReceiptV1(
    { ownerId, authority: 'server_jwt' },
    { authResponse, request, bearerToken },
  );
  if (!receipt.ok) throw new Error('SR2_AUTH_RECEIPT_INVALID');
  const context = createAgentExecutionContextV1(
    {
      runId: `run_retriever_sr2_${ownerId}`,
      requestId: `request_retriever_sr2_${ownerId}`,
      principal: { kind: 'authenticated', ownerId, authority: 'server_jwt' },
      deadlineAt,
    },
    { signal, authReceipt: receipt.value, authResponse, request, bearerToken },
  );
  if (!context.ok) throw new Error('SR2_EXECUTION_CONTEXT_INVALID');
  return context.value;
}

export function createRetrieverSr2Request(
  context: AgentExecutionContextV1,
  input: Readonly<{
    originalQuery: string;
    recentTurns: readonly Readonly<{ role: 'user' | 'assistant'; content: string }>[];
    activeContext?: Readonly<{ trust: 'trusted' | 'untrusted'; question?: string; goal?: string }>;
  }>,
) {
  return {
    schemaVersion: 'retriever-request-v1',
    runId: context.runId,
    requestId: context.requestId,
    deadlineAt: context.deadlineAt,
    originalQuery: input.originalQuery,
    recentTurns: input.recentTurns,
    ...(input.activeContext === undefined ? {} : { activeContext: input.activeContext }),
    requiresRag: true,
    policy: {
      topK: 8,
      minScore: 0.72,
      sourceTypes: ['knowledge_document'],
      documentStatuses: ['DONE'],
    },
  };
}

export function deriveRetrieverSr2PromptContent(userPrompt: string): string {
  if (Buffer.byteLength(userPrompt, 'utf8') > 32_768) throw new Error('SR2_PROMPT_LIMIT');
  const parsed = JSON.parse(userPrompt) as unknown;
  if (!isPlainRecord(parsed)) throw new Error('SR2_PROMPT_SHAPE');
  const allowedKeys = new Set(['originalQuery', 'recentTurns', 'activeContext', 'protectedTerms']);
  const ownKeys = Reflect.ownKeys(parsed);
  if (
    ownKeys.some((key) => typeof key !== 'string' || !allowedKeys.has(key)) ||
    !ownKeys.includes('originalQuery') ||
    !ownKeys.includes('recentTurns') ||
    !ownKeys.includes('protectedTerms')
  ) {
    throw new Error('SR2_PROMPT_KEYS');
  }
  const originalQuery = readString(parsed.originalQuery);
  const recentTurns = readRecentTurns(parsed.recentTurns);
  const activeContext = readActiveContext(parsed.activeContext);
  const protectedTerms = readStringArray(parsed.protectedTerms);
  const contextParts = [
    ...recentTurns.map((turn) => turn.content),
    ...(activeContext?.question === undefined ? [] : [activeContext.question]),
    ...(activeContext?.goal === undefined ? [] : [activeContext.goal]),
  ];
  const terms = [...new Set([...contextParts, ...protectedTerms])].sort();
  const rewrittenQuery = `${terms.join(' ')} ${originalQuery}`.trim();
  return JSON.stringify({ rewrittenQuery });
}

function readRecentTurns(value: unknown): Array<{ role: 'user' | 'assistant'; content: string }> {
  if (!Array.isArray(value) || value.length > 8) throw new Error('SR2_PROMPT_TURNS');
  return value.map((turn) => {
    if (!isPlainRecord(turn) || (turn.role !== 'user' && turn.role !== 'assistant')) {
      throw new Error('SR2_PROMPT_TURN');
    }
    return { role: turn.role, content: readString(turn.content) };
  });
}

function readActiveContext(
  value: unknown,
): { trust: 'trusted' | 'untrusted'; question?: string; goal?: string } | undefined {
  if (value === undefined) return undefined;
  if (!isPlainRecord(value) || (value.trust !== 'trusted' && value.trust !== 'untrusted')) {
    throw new Error('SR2_PROMPT_CONTEXT');
  }
  const context: { trust: 'trusted' | 'untrusted'; question?: string; goal?: string } = {
    trust: value.trust,
  };
  if (value.question !== undefined) context.question = readString(value.question);
  if (value.goal !== undefined) context.goal = readString(value.goal);
  return context;
}

function readString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2_000) {
    throw new Error('SR2_PROMPT_STRING');
  }
  return value;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 64) throw new Error('SR2_PROMPT_TERMS');
  return value.map(readString);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
