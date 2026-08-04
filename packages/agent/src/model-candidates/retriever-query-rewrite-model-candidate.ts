import { z } from 'zod';

import {
  createModelAgentBudget,
  reserveModelAgentBudget,
  type ModelAgentRunBudget,
  type ModelAgentRuntime,
  type ModelAgentTrace,
  type ModelAgentUsage,
} from '@repo/ai';

import {
  isAgentExecutionContextV1,
  parseRetrieverRequestV1,
  type AgentExecutionContextV1,
  type RetrieverRequestV1,
  type RetrieverResultV1,
} from '../contracts/realtime-chat.ts';
import { estimateCandidateInputTokens } from './model-candidate-policy.ts';
import { sanitizeModelCandidateRuntimeResult } from './model-candidate-runtime-result.ts';
import {
  clonePlainModelData,
  deepFreezeModelValue,
  scanCompleteModelField,
} from './model-projection-safety.ts';

export const RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION =
  'retriever-query-rewrite-model-candidate-v1' as const;
export const RETRIEVER_QUERY_REWRITE_CONFIG_VERSION =
  'retriever-query-rewrite-candidate-config-v1' as const;
export const RETRIEVER_QUERY_REWRITE_OBSERVATION_VERSION =
  'retriever-query-rewrite-observation-v1' as const;
export const RETRIEVER_QUERY_REWRITE_MODEL = 'deepseek-v4-pro' as const;
export const RETRIEVER_QUERY_REWRITE_BASE_URL = 'https://api.deepseek.com/v1' as const;
export const RETRIEVER_QUERY_REWRITE_TIMEOUT_MS = 4_000 as const;
export const RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS = 1_200 as const;
export const RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS = 160 as const;
export const RETRIEVER_QUERY_REWRITE_MAX_COST_CNY = 0.005 as const;

export const RETRIEVER_QUERY_REWRITE_MODEL_SCHEMA = z
  .object({
    rewrittenQuery: z.string().min(1).max(2_000),
  })
  .strict();

const CONFIG_SCHEMA = z
  .object({
    schemaVersion: z.literal(RETRIEVER_QUERY_REWRITE_CONFIG_VERSION),
    enabled: z.boolean(),
    runtimeAuthority: z.enum(['disabled', 'reviewed_mock', 'production_live']),
    mode: z.enum(['mock', 'live']),
    provider: z.enum(['mock', 'deepseek']),
    model: z.literal(RETRIEVER_QUERY_REWRITE_MODEL),
    baseURL: z.literal(RETRIEVER_QUERY_REWRITE_BASE_URL),
    timeoutMs: z.literal(RETRIEVER_QUERY_REWRITE_TIMEOUT_MS),
    globalLiveCallsEnabled: z.boolean(),
    configured: z.boolean().optional(),
    disabledReason: z
      .enum(['gate_disabled', 'mock_mode', 'global_live_disabled', 'invalid_component_config'])
      .optional(),
  })
  .strict()
  .superRefine((config, context) => {
    const disabled =
      !config.enabled &&
      config.runtimeAuthority === 'disabled' &&
      config.mode === 'mock' &&
      config.provider === 'mock' &&
      !config.globalLiveCallsEnabled;
    const reviewedMock =
      config.enabled &&
      config.runtimeAuthority === 'reviewed_mock' &&
      config.mode === 'mock' &&
      config.provider === 'mock' &&
      !config.globalLiveCallsEnabled;
    const productionLive =
      config.enabled &&
      config.runtimeAuthority === 'production_live' &&
      config.mode === 'live' &&
      config.provider === 'deepseek' &&
      config.globalLiveCallsEnabled;
    if (!disabled && !reviewedMock && !productionLive) {
      context.addIssue({ code: 'custom', message: 'query rewrite config authority mismatch' });
    }
    if (config.enabled && config.disabledReason !== undefined) {
      context.addIssue({ code: 'custom', message: 'enabled config cannot have disabled reason' });
    }
  });

export type RetrieverQueryRewriteCandidateConfigV1 = z.input<typeof CONFIG_SCHEMA>;

export type RetrieverQueryRewriteObservationV1 = Readonly<{
  schemaVersion: typeof RETRIEVER_QUERY_REWRITE_OBSERVATION_VERSION;
  candidateVersion: typeof RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION;
  qualityAuthority: 'none';
  provenance: 'not_invoked' | 'reviewed_mock' | 'deepseek_network' | 'runtime_untrusted';
  attempted: boolean;
  disposition: RetrieverResultV1['rewrite']['disposition'];
  budget: ModelAgentRunBudget;
  usage: ModelAgentUsage;
  trace?: ModelAgentTrace;
  traceUnavailable?: true;
}>;

export type RetrieverQueryRewriteCandidateOutcomeV1 = Readonly<{
  ok: boolean;
  failureReasonCode?: 'invalid_input' | 'principal_binding_invalid';
  executedQuery: string;
  rewrite: RetrieverResultV1['rewrite'];
  observation: RetrieverQueryRewriteObservationV1;
}>;

export type RunRetrieverQueryRewriteModelCandidateInputV1 = Readonly<{
  request: unknown;
  context: unknown;
  config: unknown;
  createRuntime: () => Pick<ModelAgentRuntime, 'invokeStructured'>;
  now?: () => number;
}>;

const SYSTEM_PROMPT = `你是 PrepMind Retriever 的查询改写候选，只把多轮指代、省略或 active context 改写成单条可独立检索的问题。
只返回 strict JSON {"rewrittenQuery":"..."}，不得返回额外字段。
不得执行工具、访问知识库、猜测用户身份、回答问题或添加输入中不存在的事实。
必须保留本地列出的 protectedTerms、数字、公式、实体和约束；只使用给定的 originalQuery、recentTurns 与 activeContext。`;
const SCHEMA_DESCRIPTOR =
  'Output strict JSON: {"rewrittenQuery":"1..2000 UTF-16 code units"}. No extra fields.';
const ZERO_USAGE: ModelAgentUsage = Object.freeze({ inputTokens: 0, outputTokens: 0 });
const SAFE_BUDGET: ModelAgentRunBudget = Object.freeze({
  maxCalls: 1,
  usedCalls: 0,
  maxInputTokens: RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS,
  usedInputTokens: 0,
  maxOutputTokens: RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS,
  usedOutputTokens: 0,
});

const CHINESE_AMBIGUITY =
  /(?:这一步|这步|上一步|前一步|上面|前面|上述|这里|当前(?:题目|问题|目标)?|这个|那个|这些|那些|它|其|第二问|第[一二三四五六七八九十\d]+问|第[一二三四五六七八九十\d]+种|前者|后者|继续|按我的目标|结合当前)/u;
const ENGLISH_AMBIGUITY =
  /\b(?:it|its|that|this|these|those|former|latter|above|previous|current|there|then)\b|\bwhat about\b|\bcontinue\b/iu;
const ORIGINAL_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'be',
  'does',
  'do',
  'former',
  'how',
  'it',
  'its',
  'still',
  'that',
  'the',
  'these',
  'this',
  'those',
  'to',
  'what',
  'when',
  'why',
  'with',
]);
const CONTEXT_STOP_WORDS = new Set([...ORIGINAL_STOP_WORDS, 'from', 'has', 'is', 'of', 'uses']);

export async function runRetrieverQueryRewriteModelCandidateV1(
  rawInput: RunRetrieverQueryRewriteModelCandidateInputV1,
): Promise<RetrieverQueryRewriteCandidateOutcomeV1> {
  const input = readInput(rawInput);
  if (!input) return invalidOutcome('', 'invalid_input');
  if (!isAgentExecutionContextV1(input.context)) {
    return invalidOutcome('', 'principal_binding_invalid');
  }
  const context = input.context;
  const parsedRequest = parseRetrieverRequestV1(input.request);
  if (!parsedRequest.ok) return invalidOutcome('', 'invalid_input');
  const request = parsedRequest.value;
  if (!isRequestBoundToContext(request, context)) {
    return invalidOutcome(request.originalQuery, 'principal_binding_invalid');
  }

  if (
    !request.requiresRag ||
    context.principal.kind !== 'authenticated' ||
    !isRequestSafeForRewrite(request) ||
    !isRewriteEligible(request) ||
    !isRuntimeWindowOpen(context, input.now)
  ) {
    return localOutcome(request.originalQuery, rewriteNotEligible(), SAFE_BUDGET);
  }

  const config = parseConfig(input.config);
  if (config === null || !config.enabled) {
    return localOutcome(request.originalQuery, rewriteGateOff(), SAFE_BUDGET);
  }

  const promptProjection = buildPromptProjection(request);
  if (promptProjection === null) {
    return localOutcome(request.originalQuery, rewriteNotEligible(), SAFE_BUDGET);
  }
  const userPrompt = JSON.stringify(promptProjection.prompt);
  const estimatedInputTokens = estimateCandidateInputTokens([
    SYSTEM_PROMPT,
    userPrompt,
    SCHEMA_DESCRIPTOR,
  ]);
  if (
    estimatedInputTokens <= 0 ||
    estimatedInputTokens > RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS
  ) {
    return localOutcome(request.originalQuery, rewriteGateOff(), SAFE_BUDGET);
  }

  const budget = createModelAgentBudget({
    maxCalls: 1,
    maxInputTokens: RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS,
    maxOutputTokens: RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS,
  });
  const preview = reserveModelAgentBudget(budget, {
    inputTokens: estimatedInputTokens,
    outputTokens: RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS,
  });
  if (!preview.ok) return localOutcome(request.originalQuery, rewriteGateOff(), budget);

  const provenance =
    config.runtimeAuthority === 'reviewed_mock' ? 'reviewed_mock' : 'deepseek_network';
  let runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  try {
    runtime = input.createRuntime();
    if (!runtime || typeof runtime.invokeStructured !== 'function') throw new Error();
  } catch {
    return localOutcome(request.originalQuery, rewriteGateOff(), budget);
  }

  let rawRuntimeResult: unknown;
  try {
    rawRuntimeResult = await runtime.invokeStructured({
      runId: request.runId,
      task: 'retriever_query_rewrite',
      schema: RETRIEVER_QUERY_REWRITE_MODEL_SCHEMA,
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      estimatedInputTokens,
      maxOutputTokens: RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS,
      budget,
      signal: context.signal,
    });
  } catch {
    return attemptedFallback(request.originalQuery, preview.budget, provenance, true);
  }

  const runtimeResult = sanitizeModelCandidateRuntimeResult({
    value: rawRuntimeResult,
    dataSchema: RETRIEVER_QUERY_REWRITE_MODEL_SCHEMA,
    task: 'retriever_query_rewrite',
    maxOutputTokens: RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS,
    callerBudget: budget,
    previewBudget: preview.budget,
  });
  if (runtimeResult === null) {
    return attemptedFallback(request.originalQuery, preview.budget, 'runtime_untrusted', true);
  }
  if (!traceMatchesConfig(runtimeResult.trace, config)) {
    return attemptedFallback(
      request.originalQuery,
      runtimeResult.budget,
      'runtime_untrusted',
      true,
    );
  }
  if (!runtimeResult.ok) {
    return attemptedFallback(
      request.originalQuery,
      runtimeResult.budget,
      provenance,
      false,
      runtimeResult.usage,
      runtimeResult.trace,
    );
  }

  const candidate = runtimeResult.data.rewrittenQuery.trim();
  const scan = scanCompleteModelField(candidate, {
    maxUtf16CodeUnits: 2_000,
    rejectToolOrWriteInstruction: true,
  });
  if (
    !scan.ok ||
    !candidate ||
    normalizeForComparison(candidate) === normalizeForComparison(request.originalQuery) ||
    !preservesLocalAuthority(candidate, promptProjection)
  ) {
    return attemptedRejected(
      request.originalQuery,
      runtimeResult.budget,
      provenance,
      runtimeResult.usage,
      runtimeResult.trace,
    );
  }

  return deepFreezeModelValue({
    ok: true,
    executedQuery: candidate,
    rewrite: {
      attempted: true,
      disposition: 'candidate_applied',
      reasonCode: 'rewrite_applied',
    },
    observation: {
      schemaVersion: RETRIEVER_QUERY_REWRITE_OBSERVATION_VERSION,
      candidateVersion: RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION,
      qualityAuthority: 'none',
      provenance,
      attempted: true,
      disposition: 'candidate_applied',
      budget: runtimeResult.budget,
      usage: runtimeResult.usage,
      trace: runtimeResult.trace,
    },
  });
}

function readInput(input: unknown): RunRetrieverQueryRewriteModelCandidateInputV1 | null {
  try {
    if (!isPlainRecord(input)) return null;
    const keys = Reflect.ownKeys(input);
    const allowed = new Set(['request', 'context', 'config', 'createRuntime', 'now']);
    if (keys.some((key) => typeof key !== 'string' || !allowed.has(key))) return null;
    for (const key of ['request', 'context', 'config', 'createRuntime']) {
      if (!keys.includes(key)) return null;
    }
    const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    for (const key of keys) {
      if (typeof key !== 'string') return null;
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (!descriptor || !('value' in descriptor)) return null;
      values[key] = descriptor.value;
    }
    if (
      typeof values.createRuntime !== 'function' ||
      (values.now !== undefined && typeof values.now !== 'function')
    ) {
      return null;
    }
    return {
      request: values.request,
      context: values.context,
      config: values.config,
      createRuntime: values.createRuntime as () => Pick<ModelAgentRuntime, 'invokeStructured'>,
      ...(typeof values.now === 'function' ? { now: values.now as () => number } : {}),
    };
  } catch {
    return null;
  }
}

function parseConfig(input: unknown): z.output<typeof CONFIG_SCHEMA> | null {
  const cloned = clonePlainModelData(input);
  if (!cloned.ok) return null;
  const parsed = CONFIG_SCHEMA.safeParse(cloned.value);
  return parsed.success ? parsed.data : null;
}

function isRequestBoundToContext(
  request: RetrieverRequestV1,
  context: AgentExecutionContextV1,
): boolean {
  return (
    request.runId === context.runId &&
    request.requestId === context.requestId &&
    request.deadlineAt === context.deadlineAt
  );
}

function isRequestSafeForRewrite(request: RetrieverRequestV1): boolean {
  const fields = [
    { value: request.originalQuery, max: 2_000 },
    ...request.recentTurns.map((turn) => ({ value: turn.content, max: 500 })),
    ...(request.activeContext?.question === undefined
      ? []
      : [{ value: request.activeContext.question, max: 300 }]),
    ...(request.activeContext?.goal === undefined
      ? []
      : [{ value: request.activeContext.goal, max: 300 }]),
  ];
  return fields.every(
    ({ value, max }) =>
      scanCompleteModelField(value, {
        maxUtf16CodeUnits: max,
        rejectToolOrWriteInstruction: true,
      }).ok,
  );
}

function isRewriteEligible(request: RetrieverRequestV1): boolean {
  const hasContext = request.recentTurns.length > 0 || request.activeContext !== undefined;
  if (!hasContext) return false;
  return (
    CHINESE_AMBIGUITY.test(request.originalQuery) || ENGLISH_AMBIGUITY.test(request.originalQuery)
  );
}

function isRuntimeWindowOpen(
  context: AgentExecutionContextV1,
  now: (() => number) | undefined,
): boolean {
  try {
    if (context.signal.aborted) return false;
    const current = (now ?? Date.now)();
    const deadline = Date.parse(context.deadlineAt);
    return (
      Number.isFinite(current) && current >= 0 && Number.isFinite(deadline) && deadline > current
    );
  } catch {
    return false;
  }
}

type PromptProjection = Readonly<{
  prompt: Readonly<{
    originalQuery: string;
    recentTurns: RetrieverRequestV1['recentTurns'];
    activeContext?: RetrieverRequestV1['activeContext'];
    protectedTerms: readonly string[];
  }>;
  protectedTerms: readonly string[];
  contextAnchors: readonly string[];
}>;

function buildPromptProjection(request: RetrieverRequestV1): PromptProjection | null {
  try {
    const originalTerms = extractAnchorTerms(request.originalQuery, ORIGINAL_STOP_WORDS);
    const contextValues = [
      ...request.recentTurns.map((turn) => turn.content),
      ...(request.activeContext?.question ? [request.activeContext.question] : []),
      ...(request.activeContext?.goal ? [request.activeContext.goal] : []),
    ];
    const contextAnchors = uniqueSorted(
      contextValues
        .flatMap((value) => extractAnchorTerms(value, CONTEXT_STOP_WORDS))
        .flatMap(expandContextAnchor),
    );
    const hardTerms = uniqueSorted(
      [request.originalQuery, ...contextValues].flatMap(extractHardTerms),
    );
    const protectedTerms = uniqueSorted([...originalTerms, ...hardTerms]);
    return deepFreezeModelValue({
      prompt: {
        originalQuery: request.originalQuery,
        recentTurns: request.recentTurns.map((turn) => ({ ...turn })),
        ...(request.activeContext ? { activeContext: { ...request.activeContext } } : {}),
        protectedTerms,
      },
      protectedTerms,
      contextAnchors,
    });
  } catch {
    return null;
  }
}

function extractAnchorTerms(value: string, stopWords: ReadonlySet<string>): string[] {
  const normalized = value.normalize('NFKC');
  const ascii = normalized.match(/[A-Za-z][A-Za-z0-9_-]{1,31}/gu) ?? [];
  const asciiTerms = ascii
    .map((term) => term.toLowerCase())
    .filter((term) => !stopWords.has(term) && !/^\d+$/u.test(term));

  const cleanedHan = normalized
    .replace(
      /(?:这一步|这步|上一步|前一步|上面|前面|上述|这里|当前题目|当前问题|当前目标|这个|那个|这些|那些|它|其|第二问|前者|后者|继续|为什么|怎么|如何|什么|是否|能否|请|解释|证明|回顾|有什么区别|按我的目标|结合当前题目|给个例子|给一个例子|掌握|根据|开始|应该|怎样|可得到|得到|可以|用前面定义)/gu,
      ' ',
    )
    .replace(/(?:和|与|的|了|是|把|被|从|到|为|要|会|还|直接|指|哪些)/gu, ' ');
  const hanTerms = (cleanedHan.match(/\p{Script=Han}{2,16}/gu) ?? []).flatMap((term) => {
    if (term.length <= 8) return [term];
    return [term.slice(0, 8), term.slice(-8)];
  });
  return uniqueSorted([...asciiTerms, ...hanTerms]);
}

function expandContextAnchor(term: string): string[] {
  if (!/^\p{Script=Han}+$/u.test(term) || term.length < 4) return [term];
  const windows: string[] = [term];
  for (let index = 0; index <= term.length - 2; index += 1) {
    windows.push(term.slice(index, index + 2));
  }
  return windows;
}

function extractHardTerms(value: string): string[] {
  const normalized = value.normalize('NFKC');
  const formulas =
    normalized.match(
      /[A-Za-z][A-Za-z0-9_()]*\s*(?:=|<=|>=|<|>|\+|-|\*|\/|\^)\s*[A-Za-z0-9_()+\-*/^.]+/gu,
    ) ?? [];
  const numbers = normalized.match(/(?<![A-Za-z0-9_])\d+(?:\.\d+)?(?![A-Za-z0-9_])/gu) ?? [];
  const quoted = [...normalized.matchAll(/[“"']([^”"']{1,40})[”"']/gu)].map(
    (match) => match[1] ?? '',
  );
  return uniqueSorted([...formulas, ...numbers, ...quoted].map(compactTerm).filter(Boolean));
}

function preservesLocalAuthority(candidate: string, projection: PromptProjection): boolean {
  const normalizedCandidate = normalizeForComparison(candidate);
  if (
    projection.protectedTerms.some(
      (term) => !normalizedCandidate.includes(normalizeForComparison(term)),
    )
  ) {
    return false;
  }
  if (projection.contextAnchors.length === 0) return false;
  return projection.contextAnchors.some((term) =>
    normalizedCandidate.includes(normalizeForComparison(term)),
  );
}

function traceMatchesConfig(
  trace: ModelAgentTrace,
  config: z.output<typeof CONFIG_SCHEMA>,
): boolean {
  return (
    trace.model === RETRIEVER_QUERY_REWRITE_MODEL &&
    ((config.runtimeAuthority === 'reviewed_mock' &&
      trace.mode === 'mock' &&
      trace.provider === 'mock') ||
      (config.runtimeAuthority === 'production_live' &&
        trace.mode === 'live' &&
        trace.provider === 'deepseek'))
  );
}

function invalidOutcome(
  originalQuery: string,
  failureReasonCode: 'invalid_input' | 'principal_binding_invalid',
): RetrieverQueryRewriteCandidateOutcomeV1 {
  return deepFreezeModelValue({
    ...localOutcome(originalQuery, rewriteNotEligible(), SAFE_BUDGET),
    ok: false,
    failureReasonCode,
  });
}

function localOutcome(
  originalQuery: string,
  rewrite: RetrieverResultV1['rewrite'],
  budget: ModelAgentRunBudget,
): RetrieverQueryRewriteCandidateOutcomeV1 {
  return deepFreezeModelValue({
    ok: true,
    executedQuery: originalQuery,
    rewrite,
    observation: {
      schemaVersion: RETRIEVER_QUERY_REWRITE_OBSERVATION_VERSION,
      candidateVersion: RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION,
      qualityAuthority: 'none',
      provenance: 'not_invoked',
      attempted: false,
      disposition: rewrite.disposition,
      budget: { ...budget },
      usage: ZERO_USAGE,
    },
  });
}

function attemptedFallback(
  originalQuery: string,
  budget: ModelAgentRunBudget,
  provenance: RetrieverQueryRewriteObservationV1['provenance'],
  traceUnavailable: boolean,
  usage: ModelAgentUsage = ZERO_USAGE,
  trace?: ModelAgentTrace,
): RetrieverQueryRewriteCandidateOutcomeV1 {
  return deepFreezeModelValue({
    ok: true,
    executedQuery: originalQuery,
    rewrite: {
      attempted: true,
      disposition: 'failed_fallback_original',
      reasonCode: 'rewrite_failed_fallback_original',
    },
    observation: {
      schemaVersion: RETRIEVER_QUERY_REWRITE_OBSERVATION_VERSION,
      candidateVersion: RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION,
      qualityAuthority: 'none',
      provenance,
      attempted: true,
      disposition: 'failed_fallback_original',
      budget: { ...budget },
      usage: { ...usage },
      ...(trace ? { trace } : {}),
      ...(traceUnavailable ? { traceUnavailable: true as const } : {}),
    },
  });
}

function attemptedRejected(
  originalQuery: string,
  budget: ModelAgentRunBudget,
  provenance: RetrieverQueryRewriteObservationV1['provenance'],
  usage: ModelAgentUsage,
  trace: ModelAgentTrace,
): RetrieverQueryRewriteCandidateOutcomeV1 {
  return deepFreezeModelValue({
    ok: true,
    executedQuery: originalQuery,
    rewrite: {
      attempted: true,
      disposition: 'candidate_rejected',
      reasonCode: 'rewrite_rejected',
    },
    observation: {
      schemaVersion: RETRIEVER_QUERY_REWRITE_OBSERVATION_VERSION,
      candidateVersion: RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION,
      qualityAuthority: 'none',
      provenance,
      attempted: true,
      disposition: 'candidate_rejected',
      budget: { ...budget },
      usage: { ...usage },
      trace,
    },
  });
}

function rewriteNotEligible(): RetrieverResultV1['rewrite'] {
  return Object.freeze({
    attempted: false,
    disposition: 'not_eligible',
    reasonCode: 'rewrite_not_eligible',
  });
}

function rewriteGateOff(): RetrieverResultV1['rewrite'] {
  return Object.freeze({
    attempted: false,
    disposition: 'gate_off',
    reasonCode: 'rewrite_gate_off',
  });
}

function normalizeForComparison(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}

function compactTerm(value: string): string {
  return value.normalize('NFKC').replace(/\s+/gu, ' ').trim();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map(compactTerm).filter(Boolean))].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  try {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
    );
  } catch {
    return false;
  }
}
