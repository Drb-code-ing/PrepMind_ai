import {
  createModelAgentBudget,
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  type ModelAgentErrorCode,
  type ModelAgentProviderFailureCategory,
  type ModelAgentRequest,
  type ModelAgentRuntime,
  type OpenAICompatibleExecutorConfig,
  type StructuredModelExecutor,
} from '@repo/ai';
import {
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  ReviewPlannerDiagnosticCode,
  phase695ReportSchema,
  runPhase695ReviewPlannerPaired,
  type Phase695LiveDependencies,
  type Phase695Report,
} from '@repo/agent';

import { resolveReviewPlannerLiveExecutorConfig } from './review-planner-model-config';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE_ID =
  'phase-6.9.5-review-planner-controlled-live-v5-deepseek-v4-pro';
const V5_CANARY_INPUT_TOKENS = 96;
const V5_CANARY_OUTPUT_TOKENS = 32;
const V5_MAX_PAIRED_PROVIDER_ATTEMPTS = 22;
const V5_MAX_PROVIDER_ATTEMPTS = V5_MAX_PAIRED_PROVIDER_ATTEMPTS + 1;
const V5_RESERVED_INPUT_TOKENS =
  V5_CANARY_INPUT_TOKENS + V5_MAX_PAIRED_PROVIDER_ATTEMPTS * 1_950;
const V5_RESERVED_OUTPUT_TOKENS =
  V5_CANARY_OUTPUT_TOKENS + V5_MAX_PAIRED_PROVIDER_ATTEMPTS * 440;
const V5_SYSTEM_PROMPT =
  'Return exactly one strict JSON object matching REVIEW_MODEL_CANDIDATE_SCHEMA. Its exact value must be {"focusIndexes":[0],"diagnosis":"review_pressure"}. Do not return an acknowledgement, prose, or extra fields.';
const V5_USER_PROMPT =
  'Return exactly {"focusIndexes":[0],"diagnosis":"review_pressure"}.';

type V5ExecutorConfig = Readonly<{
  provider: 'deepseek';
  apiKey: string;
  baseURL: 'https://api.deepseek.com/v1';
  model: 'deepseek-v4-pro';
  structuredOutputMode: 'json_object';
}>;

export type DeepSeekV4ProV5Pricing = Readonly<{
  currency: 'CNY';
  nonCachedInputCnyPerMillionTokens: number;
  outputCnyPerMillionTokens: number;
  hardCapCny: number;
}>;

/**
 * Controlled-Live-only price snapshot from the user-provided DeepSeek V4 Pro
 * pricing. It is intentionally not connected to the USD-only online Trace.
 */
export const DEEPSEEK_V4_PRO_V5_PRICING: DeepSeekV4ProV5Pricing = Object.freeze(
  {
    currency: 'CNY',
    nonCachedInputCnyPerMillionTokens: 3,
    outputCnyPerMillionTokens: 6,
    hardCapCny: 1,
  },
);

export type ReviewPlannerControlledLiveV5DeepSeekPricing = Readonly<{
  currency: 'CNY';
  nonCachedInputCnyPerMillionTokens: number;
  outputCnyPerMillionTokens: number;
  hardCapCny: number;
  maxPairedProviderAttempts: number;
  maxProviderAttempts: number;
  reservedInputTokens: number;
  reservedOutputTokens: number;
  reservedCostCny: number;
}>;

export type ReviewPlannerControlledLiveV5CnyCost =
  ReviewPlannerControlledLiveV5DeepSeekPricing &
    Readonly<{
      observedInputTokens: number;
      observedOutputTokens: number;
      observedCostCny: number;
      withinHardCap: boolean;
    }>;

export type ReviewPlannerControlledLiveV5Diagnostic = Readonly<{
  status: 'complete' | 'invalid_attempted';
  canContinue: boolean;
  providerAttemptCount: number;
  usageKnown: boolean;
  diagnosticCode?: ReviewPlannerDiagnosticCode;
}>;

type V5CanaryOutcome = Readonly<{
  diagnostic: ReviewPlannerControlledLiveV5Diagnostic;
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
}>;

export type ReviewPlannerControlledLiveV5DeepSeekPairedResult =
  | Readonly<{
      kind: 'report';
      report: Phase695Report;
      /** Private evidence-facing CNY aggregate; never copied to USD Trace rows. */
      cost: ReviewPlannerControlledLiveV5CnyCost;
    }>
  | Readonly<{
      kind: 'failed';
      diagnosticCode:
        | ReviewPlannerDiagnosticCode.Transport
        | ReviewPlannerDiagnosticCode.InvalidResponse;
    }>;

export type ReviewPlannerControlledLiveV5DeepSeekEvaluator = Readonly<{
  runDiagnostic(): Promise<ReviewPlannerControlledLiveV5Diagnostic>;
  runPairedEvaluation(): Promise<ReviewPlannerControlledLiveV5DeepSeekPairedResult>;
  providerAttemptCount(): number;
}>;

export type ReviewPlannerControlledLiveV5DeepSeekFactoryResult =
  | Readonly<{
      ok: true;
      value: ReviewPlannerControlledLiveV5DeepSeekEvaluator;
    }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }>;

type V5FactoryDependencies = Readonly<{
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
  pricing: DeepSeekV4ProV5Pricing;
  runPairedEvaluation(input: {
    mode: 'live';
    live: Phase695LiveDependencies;
  }): Promise<Phase695Report>;
}>;

const defaultDependencies: V5FactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
  pricing: DEEPSEEK_V4_PRO_V5_PRICING,
  runPairedEvaluation: runPhase695ReviewPlannerPaired,
};

/**
 * Resolves only the fixed V5 cost ceiling for controlled evidence. CNY never
 * enters the existing USD cost estimator or persisted Agent Trace contract.
 */
export function resolveReviewPlannerControlledLiveV5DeepSeekPricing(
  pricing: unknown = DEEPSEEK_V4_PRO_V5_PRICING,
): ReviewPlannerControlledLiveV5DeepSeekPricing | null {
  if (!isExactV5Pricing(pricing)) return null;
  const reservedCostCny = calculateCnyCost(
    V5_RESERVED_INPUT_TOKENS,
    V5_RESERVED_OUTPUT_TOKENS,
  );
  if (reservedCostCny > DEEPSEEK_V4_PRO_V5_PRICING.hardCapCny) return null;
  return Object.freeze({
    currency: 'CNY',
    nonCachedInputCnyPerMillionTokens: 3,
    outputCnyPerMillionTokens: 6,
    hardCapCny: 1,
    maxPairedProviderAttempts: V5_MAX_PAIRED_PROVIDER_ATTEMPTS,
    maxProviderAttempts: V5_MAX_PROVIDER_ATTEMPTS,
    reservedInputTokens: V5_RESERVED_INPUT_TOKENS,
    reservedOutputTokens: V5_RESERVED_OUTPUT_TOKENS,
    reservedCostCny,
  });
}

/** Does not return executor configuration or provider credentials. */
export function validateReviewPlannerControlledLiveV5DeepSeekPreflight(
  env: Record<string, unknown>,
  overrides: Partial<Pick<V5FactoryDependencies, 'pricing'>> = {},
):
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }> {
  return resolveV5Preflight(
    env,
    overrides.pricing ?? defaultDependencies.pricing,
  )
    ? { ok: true }
    : {
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      };
}

export function createReviewPlannerControlledLiveV5DeepSeekEvaluator(
  env: Record<string, unknown>,
  overrides: Partial<V5FactoryDependencies> = {},
): ReviewPlannerControlledLiveV5DeepSeekFactoryResult {
  const dependencies = { ...defaultDependencies, ...overrides };
  const preflight = resolveV5Preflight(env, dependencies.pricing);
  if (!preflight) {
    return {
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    };
  }

  let executor: StructuredModelExecutor;
  try {
    executor = dependencies.createExecutor(preflight.config);
  } catch {
    return {
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.ExecutorInit,
    };
  }

  let providerAttempts = 0;
  const countedExecutor: StructuredModelExecutor = async (input) => {
    if (providerAttempts >= V5_MAX_PROVIDER_ATTEMPTS) {
      throw new Error('CONTROLLED_LIVE_PROVIDER_ATTEMPT_LIMIT');
    }
    providerAttempts += 1;
    return executor(input);
  };
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: 4_500,
    executor: countedExecutor,
  });
  let diagnostic: Promise<V5CanaryOutcome> | null = null;
  let paired: Promise<ReviewPlannerControlledLiveV5DeepSeekPairedResult> | null =
    null;
  let pairedProviderAttemptLimitExceeded = false;
  const pairedRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    invokeStructured<T>(request: ModelAgentRequest<T>) {
      if (providerAttempts < V5_MAX_PROVIDER_ATTEMPTS) {
        return runtime.invokeStructured(request);
      }
      pairedProviderAttemptLimitExceeded = true;
      return runtime.invokeStructured({
        ...request,
        budget: { ...request.budget, usedCalls: request.budget.maxCalls },
      });
    },
  };

  return {
    ok: true,
    value: Object.freeze({
      runDiagnostic() {
        diagnostic ??= runV5Canary(runtime, () => providerAttempts);
        return diagnostic.then((outcome) => outcome.diagnostic);
      },
      async runPairedEvaluation() {
        const canary = await (diagnostic ??= runV5Canary(
          runtime,
          () => providerAttempts,
        ));
        if (!canary.diagnostic.canContinue || canary.usage === null) {
          return {
            kind: 'failed',
            diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
          };
        }
        paired ??= runV5PairedSafely(
          dependencies.runPairedEvaluation,
          pairedRuntime,
          preflight.pricing,
          canary.usage,
          () => providerAttempts,
          () => pairedProviderAttemptLimitExceeded,
        );
        return paired;
      },
      providerAttemptCount: () => boundedAttempts(providerAttempts),
    }),
  };
}

async function runV5Canary(
  runtime: ModelAgentRuntime,
  readAttempts: () => number,
): Promise<V5CanaryOutcome> {
  try {
    const result = await runtime.invokeStructured({
      runId: `${REVIEW_PLANNER_CONTROLLED_LIVE_V5_DEEPSEEK_PROFILE_ID}:review-schema-canary`,
      task: 'review_suggestion',
      schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
      systemPrompt: V5_SYSTEM_PROMPT,
      userPrompt: V5_USER_PROMPT,
      estimatedInputTokens: V5_CANARY_INPUT_TOKENS,
      maxOutputTokens: V5_CANARY_OUTPUT_TOKENS,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: V5_CANARY_INPUT_TOKENS,
        maxOutputTokens: V5_CANARY_OUTPUT_TOKENS,
      }),
    });
    const providerAttemptCount = boundedAttempts(readAttempts());
    if (!result.ok) {
      return closedCanary(
        providerAttemptCount,
        mapV5DiagnosticCode({
          errorCode: result.error.code,
          providerFailureCategory: result.error.providerFailureCategory,
        }),
      );
    }
    if (
      !hasPositiveSafeUsage(
        result.usage,
        V5_CANARY_INPUT_TOKENS,
        V5_CANARY_OUTPUT_TOKENS,
      )
    ) {
      return closedCanary(
        providerAttemptCount,
        ReviewPlannerDiagnosticCode.UsageUnverifiable,
      );
    }
    return {
      diagnostic: {
        status: 'complete',
        canContinue: true,
        providerAttemptCount,
        usageKnown: true,
      },
      usage: result.usage,
    };
  } catch {
    return closedCanary(
      boundedAttempts(readAttempts()),
      ReviewPlannerDiagnosticCode.Transport,
    );
  }
}

function closedCanary(
  providerAttemptCount: number,
  diagnosticCode: ReviewPlannerDiagnosticCode,
): V5CanaryOutcome {
  return {
    diagnostic: {
      status: 'invalid_attempted',
      canContinue: false,
      providerAttemptCount,
      usageKnown: false,
      diagnosticCode,
    },
    usage: null,
  };
}

async function runV5PairedSafely(
  runPairedEvaluation: V5FactoryDependencies['runPairedEvaluation'],
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>,
  pricing: ReviewPlannerControlledLiveV5DeepSeekPricing,
  canaryUsage: Readonly<{ inputTokens: number; outputTokens: number }>,
  readAttempts: () => number,
  didExceedProviderAttemptLimit: () => boolean,
): Promise<ReviewPlannerControlledLiveV5DeepSeekPairedResult> {
  try {
    const report = await runPairedEvaluation({
      mode: 'live',
      live: { runtime },
    });
    if (!phase695ReportSchema.safeParse(report).success) {
      return {
        kind: 'failed',
        diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
      };
    }
    const cost = aggregateV5CnyCost(report, pricing, canaryUsage);
    if (
      report.counters.runtimeInvocations > pricing.maxPairedProviderAttempts ||
      report.counters.inputTokens >
        pricing.reservedInputTokens - canaryUsage.inputTokens ||
      report.counters.outputTokens >
        pricing.reservedOutputTokens - canaryUsage.outputTokens ||
      !isAtMostProviderAttempts(readAttempts()) ||
      didExceedProviderAttemptLimit() ||
      !cost.withinHardCap
    ) {
      return {
        kind: 'failed',
        diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
      };
    }
    return { kind: 'report', report, cost };
  } catch {
    return {
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    };
  }
}

function resolveV5Preflight(
  env: Record<string, unknown>,
  pricingInput: unknown,
): Readonly<{
  config: V5ExecutorConfig;
  pricing: ReviewPlannerControlledLiveV5DeepSeekPricing;
}> | null {
  if (
    trim(env.AI_PROVIDER_MODE) !== 'live' ||
    strictBoolean(env.AI_ENABLE_LIVE_CALLS) !== true ||
    strictBoolean(env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V5_ENABLED) !==
      true ||
    strictBoolean(env.REVIEW_AGENT_MODEL_ENABLED) !== false ||
    strictBoolean(env.PLANNER_AGENT_MODEL_ENABLED) !== false
  ) {
    return null;
  }
  const pricing =
    resolveReviewPlannerControlledLiveV5DeepSeekPricing(pricingInput);
  if (!pricing) return null;
  const config = resolveReviewPlannerLiveExecutorConfig(env);
  if (
    !config ||
    config.provider !== 'deepseek' ||
    config.baseURL !== 'https://api.deepseek.com/v1' ||
    config.model !== 'deepseek-v4-pro' ||
    config.structuredOutputMode !== 'json_object' ||
    'schemaProfiles' in config
  ) {
    return null;
  }
  return {
    config: {
      provider: 'deepseek',
      apiKey: config.apiKey,
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'json_object',
    },
    pricing,
  };
}

function aggregateV5CnyCost(
  report: Phase695Report,
  pricing: ReviewPlannerControlledLiveV5DeepSeekPricing,
  canaryUsage: Readonly<{ inputTokens: number; outputTokens: number }>,
): ReviewPlannerControlledLiveV5CnyCost {
  const observedInputTokens =
    canaryUsage.inputTokens + report.counters.inputTokens;
  const observedOutputTokens =
    canaryUsage.outputTokens + report.counters.outputTokens;
  const observedCostCny = calculateCnyCost(
    observedInputTokens,
    observedOutputTokens,
  );
  return {
    ...pricing,
    observedInputTokens,
    observedOutputTokens,
    observedCostCny,
    withinHardCap: observedCostCny <= pricing.hardCapCny,
  };
}

function mapV5DiagnosticCode(
  input: Readonly<{
    errorCode: ModelAgentErrorCode;
    providerFailureCategory?: ModelAgentProviderFailureCategory;
  }>,
): ReviewPlannerDiagnosticCode {
  if (input.errorCode === 'SCHEMA_INVALID') {
    return ReviewPlannerDiagnosticCode.StructuredOutput;
  }
  if (
    input.errorCode === 'INVALID_REQUEST' ||
    input.errorCode === 'INVALID_RUNTIME_CONFIG'
  ) {
    return ReviewPlannerDiagnosticCode.PreflightInvalid;
  }
  if (input.errorCode === 'PROVIDER_ERROR') {
    switch (input.providerFailureCategory) {
      case 'http_auth':
        return ReviewPlannerDiagnosticCode.HttpAuth;
      case 'http_rate_limit':
        return ReviewPlannerDiagnosticCode.HttpRateLimit;
      case 'http_client':
        return ReviewPlannerDiagnosticCode.HttpClient;
      case 'http_server':
        return ReviewPlannerDiagnosticCode.HttpServer;
      case 'structured_output':
        return ReviewPlannerDiagnosticCode.StructuredOutput;
      case 'invalid_response':
        return ReviewPlannerDiagnosticCode.UsageUnverifiable;
      default:
        return ReviewPlannerDiagnosticCode.Transport;
    }
  }
  return input.errorCode === 'TIMEOUT' || input.errorCode === 'ABORTED'
    ? ReviewPlannerDiagnosticCode.Transport
    : ReviewPlannerDiagnosticCode.InvalidResponse;
}

function isExactV5Pricing(value: unknown): value is DeepSeekV4ProV5Pricing {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.currency === 'CNY' &&
    candidate.nonCachedInputCnyPerMillionTokens === 3 &&
    candidate.outputCnyPerMillionTokens === 6 &&
    candidate.hardCapCny === 1
  );
}

function calculateCnyCost(inputTokens: number, outputTokens: number): number {
  return (
    Math.round(
      ((inputTokens * 3 + outputTokens * 6) / 1_000_000) * 100_000_000,
    ) / 100_000_000
  );
}

function hasPositiveSafeUsage(
  value: { inputTokens: number; outputTokens: number },
  maxInputTokens: number,
  maxOutputTokens: number,
) {
  return (
    Number.isSafeInteger(value.inputTokens) &&
    value.inputTokens > 0 &&
    value.inputTokens <= maxInputTokens &&
    Number.isSafeInteger(value.outputTokens) &&
    value.outputTokens > 0 &&
    value.outputTokens <= maxOutputTokens
  );
}

function strictBoolean(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function trim(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function boundedAttempts(value: number) {
  return Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= V5_MAX_PROVIDER_ATTEMPTS
    ? value
    : 0;
}

function isAtMostProviderAttempts(value: number) {
  return (
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= V5_MAX_PROVIDER_ATTEMPTS
  );
}
