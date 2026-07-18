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
  phase695ReportSchema,
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  runPhase695ReviewPlannerPaired,
  type Phase695LiveDependencies,
  type Phase695Report,
  ReviewPlannerDiagnosticCode,
} from '@repo/agent';

import type {
  ReviewPlannerControlledLiveV8CanaryResult,
  ReviewPlannerControlledLiveV8CnyCost,
  ReviewPlannerControlledLiveV8DiagnosticCode,
  ReviewPlannerControlledLiveV8EvaluatorIdentity,
  ReviewPlannerControlledLiveV8EvaluatorPort,
  ReviewPlannerControlledLiveV8PairedResult,
  ReviewPlannerControlledLiveV8PreflightResult,
} from './review-planner-controlled-live-eval-v8-stage-diagnostics.cli';
import { REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID } from './review-planner-controlled-live-eval-v8-stage-diagnostics.evidence';
import {
  resolveReviewPlannerLiveExecutorConfig,
  resolveReviewPlannerModelConfig,
} from './review-planner-model-config';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE_ID =
  'phase-6.9.5-review-planner-controlled-live-v8-deepseek-v4-pro-stage-diagnostics' as const;

const TIMEOUT_MS = 4_500;
const CANARY_ESTIMATED_INPUT_TOKENS = 96;
const CANARY_MAX_OUTPUT_TOKENS = 32;
const MAX_PAIRED_PROVIDER_ATTEMPTS = 22;
const MAX_PROVIDER_ATTEMPTS = 23;
const RESERVED_INPUT_TOKENS = 42_996;
const RESERVED_OUTPUT_TOKENS = 9_712;
const HARD_CAP_CNY = 1;
const INPUT_CNY_PER_MILLION = 3;
const OUTPUT_CNY_PER_MILLION = 6;
const CANARY_SYSTEM_PROMPT =
  'Return exactly one strict JSON object matching REVIEW_MODEL_CANDIDATE_SCHEMA. Its exact value must be {"focusIndexes":[0],"diagnosis":"review_pressure"}. Do not use tools. Do not return reasoning, acknowledgement, prose, or extra fields.';
const CANARY_USER_PROMPT =
  'Return exactly {"focusIndexes":[0],"diagnosis":"review_pressure"}.';

type V8ExecutorConfig = Extract<
  OpenAICompatibleExecutorConfig,
  { structuredOutputMode: 'deepseek_v4_pro_nonthinking_json' }
>;
type V8NonThinkingAudit = Parameters<
  NonNullable<V8ExecutorConfig['onNonThinkingAudit']>
>[0];
type V8UsageState = V8NonThinkingAudit['usageState'];
type CanaryUsage = Readonly<{ inputTokens: number; outputTokens: number }>;

export type DeepSeekV4ProV8StageDiagnosticsPricing = Readonly<{
  currency: 'CNY';
  nonCachedInputCnyPerMillionTokens: number;
  outputCnyPerMillionTokens: number;
  hardCapCny: number;
}>;

export const DEEPSEEK_V4_PRO_V8_STAGE_DIAGNOSTICS_PRICING: DeepSeekV4ProV8StageDiagnosticsPricing =
  Object.freeze({
    currency: 'CNY',
    nonCachedInputCnyPerMillionTokens: INPUT_CNY_PER_MILLION,
    outputCnyPerMillionTokens: OUTPUT_CNY_PER_MILLION,
    hardCapCny: HARD_CAP_CNY,
  });

export type ReviewPlannerControlledLiveV8StageDiagnosticsPricing =
  DeepSeekV4ProV8StageDiagnosticsPricing &
    Readonly<{
      maxPairedProviderAttempts: 22;
      maxProviderAttempts: 23;
      reservedInputTokens: 42_996;
      reservedOutputTokens: 9_712;
      reservedCostCny: 0.18726;
      priceProfileId: typeof REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID;
    }>;

type FactoryDependencies = Readonly<{
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
  pricing: DeepSeekV4ProV8StageDiagnosticsPricing;
  runPairedEvaluation(input: {
    mode: 'live';
    live: Phase695LiveDependencies;
  }): Promise<Phase695Report>;
}>;

const defaultDependencies: FactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
  pricing: DEEPSEEK_V4_PRO_V8_STAGE_DIAGNOSTICS_PRICING,
  runPairedEvaluation: runPhase695ReviewPlannerPaired,
};

export function resolveReviewPlannerControlledLiveV8StageDiagnosticsPricing(
  pricing: unknown = DEEPSEEK_V4_PRO_V8_STAGE_DIAGNOSTICS_PRICING,
): ReviewPlannerControlledLiveV8StageDiagnosticsPricing | null {
  if (!isExactPricing(pricing)) return null;
  const reservedCostCny = calculateCnyCost(
    RESERVED_INPUT_TOKENS,
    RESERVED_OUTPUT_TOKENS,
  );
  if (reservedCostCny > HARD_CAP_CNY) return null;
  return Object.freeze({
    ...DEEPSEEK_V4_PRO_V8_STAGE_DIAGNOSTICS_PRICING,
    maxPairedProviderAttempts: MAX_PAIRED_PROVIDER_ATTEMPTS,
    maxProviderAttempts: MAX_PROVIDER_ATTEMPTS,
    reservedInputTokens: RESERVED_INPUT_TOKENS,
    reservedOutputTokens: RESERVED_OUTPUT_TOKENS,
    reservedCostCny,
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  }) as ReviewPlannerControlledLiveV8StageDiagnosticsPricing;
}

/** Safe identity projection: no URL, key, executor or prompt is exposed. */
export function resolveReviewPlannerControlledLiveV8StageDiagnosticsCompositionIdentity(
  env: Record<string, unknown>,
  overrides: Readonly<{
    pricing?: DeepSeekV4ProV8StageDiagnosticsPricing;
  }> = {},
): ReviewPlannerControlledLiveV8EvaluatorIdentity | null {
  if (
    !resolvePreflight(env, overrides.pricing ?? defaultDependencies.pricing)
  ) {
    return null;
  }
  return identity();
}

export function validateReviewPlannerControlledLiveV8StageDiagnosticsPreflight(
  env: Record<string, unknown>,
  overrides: Partial<Pick<FactoryDependencies, 'pricing'>> = {},
): ReviewPlannerControlledLiveV8PreflightResult {
  return resolvePreflight(env, overrides.pricing ?? defaultDependencies.pricing)
    ? { ok: true }
    : {
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      };
}

/** Implements the CLI evaluator port and owns the only V8 provider composition. */
export function createReviewPlannerControlledLiveV8StageDiagnosticsEvaluator(
  env: Record<string, unknown>,
  overrides: Partial<FactoryDependencies> = {},
): ReviewPlannerControlledLiveV8EvaluatorPort {
  const dependencies = { ...defaultDependencies, ...overrides };
  const preflight = resolvePreflight(env, dependencies.pricing);
  if (!preflight) return closed(ReviewPlannerDiagnosticCode.PreflightInvalid);

  const audit = createAuditAggregate();
  let executor: StructuredModelExecutor;
  try {
    executor = dependencies.createExecutor({
      ...preflight.config,
      onNonThinkingAudit: audit.record,
    });
  } catch {
    return closed(ReviewPlannerDiagnosticCode.ExecutorInit);
  }

  let providerAttempts = 0;
  const countedExecutor: StructuredModelExecutor = (input) => {
    if (providerAttempts >= MAX_PROVIDER_ATTEMPTS) {
      return Promise.reject(
        new Error('CONTROLLED_LIVE_V8_PROVIDER_ATTEMPT_LIMIT'),
      );
    }
    providerAttempts += 1;
    return executor(input);
  };
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: TIMEOUT_MS,
    executor: countedExecutor,
  });
  let canaryPromise: Promise<CanaryOutcome> | null = null;
  let pairedPromise: Promise<ReviewPlannerControlledLiveV8PairedResult> | null =
    null;
  let pairedAttemptLimitExceeded = false;
  const pairedRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    invokeStructured<T>(request: ModelAgentRequest<T>) {
      if (audit.readDiagnosticCode() !== null) {
        return exhaustedRuntimeRequest(runtime, request);
      }
      if (providerAttempts < MAX_PROVIDER_ATTEMPTS) {
        return runtime.invokeStructured(request);
      }
      pairedAttemptLimitExceeded = true;
      return exhaustedRuntimeRequest(runtime, request);
    },
  };

  const runCanaryOnce = () =>
    (canaryPromise ??= runCanary(runtime, audit, () => providerAttempts));

  return Object.freeze({
    state: 'ready' as const,
    identity: identity(),
    async runCanary(): Promise<ReviewPlannerControlledLiveV8CanaryResult> {
      return (await runCanaryOnce()).result;
    },
    async runPaired(): Promise<ReviewPlannerControlledLiveV8PairedResult> {
      const canary = await runCanaryOnce();
      if (canary.result.kind !== 'complete' || canary.usage === null) {
        return canary.result.kind === 'failed'
          ? canary.result
          : {
              kind: 'failed',
              diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
            };
      }
      pairedPromise ??= runPairedSafely({
        runPairedEvaluation: dependencies.runPairedEvaluation,
        runtime: pairedRuntime,
        pricing: preflight.pricing,
        canaryUsage: canary.usage,
        readAttempts: () => providerAttempts,
        didExceedProviderAttemptLimit: () => pairedAttemptLimitExceeded,
        audit,
      });
      return pairedPromise;
    },
    providerAttemptCount: () => boundedAttempts(providerAttempts),
  });
}

type CanaryOutcome = Readonly<{
  result: ReviewPlannerControlledLiveV8CanaryResult;
  usage: CanaryUsage | null;
}>;

async function runCanary(
  runtime: ModelAgentRuntime,
  audit: AuditAggregate,
  readAttempts: () => number,
): Promise<CanaryOutcome> {
  try {
    const result = await runtime.invokeStructured({
      runId: `${REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PROFILE_ID}:review-schema-canary`,
      task: 'review_suggestion',
      schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
      systemPrompt: CANARY_SYSTEM_PROMPT,
      userPrompt: CANARY_USER_PROMPT,
      estimatedInputTokens: CANARY_ESTIMATED_INPUT_TOKENS,
      maxOutputTokens: CANARY_MAX_OUTPUT_TOKENS,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: CANARY_ESTIMATED_INPUT_TOKENS,
        maxOutputTokens: CANARY_MAX_OUTPUT_TOKENS,
      }),
    });
    const attempts = boundedAttempts(readAttempts());
    const auditCode = audit.readDiagnosticCode();
    if (auditCode) return failedCanary(auditCode);
    if (!result.ok) {
      return failedCanary(
        mapResultDiagnostic(
          result.error.code,
          result.error.providerFailureCategory,
        ),
      );
    }
    if (attempts !== 1 || audit.readCount() !== attempts) {
      return failedCanary('sdk_usage_lost');
    }
    if (!hasPositiveSafeCanaryUsage(result.usage)) {
      return failedCanary(
        result.usage.outputTokens > CANARY_MAX_OUTPUT_TOKENS
          ? 'output_limit_exceeded'
          : 'usage_reservation_exceeded',
      );
    }
    return {
      result: {
        kind: 'complete',
        providerAttemptCount: 1,
        usageKnown: true,
      },
      usage: Object.freeze({ ...result.usage }),
    };
  } catch {
    return failedCanary(ReviewPlannerDiagnosticCode.Transport);
  }
}

async function runPairedSafely(input: {
  runPairedEvaluation: FactoryDependencies['runPairedEvaluation'];
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  pricing: ReviewPlannerControlledLiveV8StageDiagnosticsPricing;
  canaryUsage: CanaryUsage;
  readAttempts: () => number;
  didExceedProviderAttemptLimit: () => boolean;
  audit: AuditAggregate;
}): Promise<ReviewPlannerControlledLiveV8PairedResult> {
  try {
    const report = await input.runPairedEvaluation({
      mode: 'live',
      live: { runtime: input.runtime },
    });
    const auditCode = input.audit.readDiagnosticCode();
    if (auditCode) return { kind: 'failed', diagnosticCode: auditCode };
    if (input.audit.readCount() !== boundedAttempts(input.readAttempts())) {
      return { kind: 'failed', diagnosticCode: 'sdk_usage_lost' };
    }
    if (
      !phase695ReportSchema.safeParse(report).success ||
      !isPassingReport(report)
    ) {
      return {
        kind: 'failed',
        diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
      };
    }
    if (
      report.counters.inputTokens >
        input.pricing.reservedInputTokens - input.canaryUsage.inputTokens ||
      report.counters.outputTokens >
        input.pricing.reservedOutputTokens - input.canaryUsage.outputTokens
    ) {
      return { kind: 'failed', diagnosticCode: 'usage_reservation_exceeded' };
    }
    const cost = aggregateCost(report, input.pricing, input.canaryUsage);
    if (!cost) {
      return {
        kind: 'failed',
        diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
      };
    }
    if (
      input.readAttempts() !== MAX_PROVIDER_ATTEMPTS ||
      input.didExceedProviderAttemptLimit()
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

function resolvePreflight(
  env: Record<string, unknown>,
  pricingInput: unknown,
): Readonly<{
  config: Omit<V8ExecutorConfig, 'onNonThinkingAudit'>;
  pricing: ReviewPlannerControlledLiveV8StageDiagnosticsPricing;
}> | null {
  if (
    trim(env.AI_PROVIDER_MODE) !== 'live' ||
    strictBoolean(env.AI_ENABLE_LIVE_CALLS) !== true ||
    strictBoolean(env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED) !==
      true ||
    strictBoolean(env.REVIEW_AGENT_MODEL_ENABLED) !== false ||
    strictBoolean(env.PLANNER_AGENT_MODEL_ENABLED) !== false ||
    trim(env.AI_MODEL) !== 'deepseek-v4-pro' ||
    trim(env.AI_BASE_URL) !== 'https://api.deepseek.com/v1' ||
    trim(env.DEEPSEEK_API_KEY) === undefined ||
    exactTimeout(env.REVIEW_AGENT_MODEL_TIMEOUT_MS) !== TIMEOUT_MS ||
    exactTimeout(env.PLANNER_AGENT_MODEL_TIMEOUT_MS) !== TIMEOUT_MS
  ) {
    return null;
  }
  const pricing =
    resolveReviewPlannerControlledLiveV8StageDiagnosticsPricing(pricingInput);
  if (!pricing) return null;
  const config = resolveReviewPlannerLiveExecutorConfig(env);
  const modelConfig = resolveReviewPlannerModelConfig(env);
  if (
    !config ||
    config.provider !== 'deepseek' ||
    config.baseURL !== 'https://api.deepseek.com/v1' ||
    config.model !== 'deepseek-v4-pro' ||
    config.structuredOutputMode !== 'deepseek_v4_pro_nonthinking_json' ||
    modelConfig.reviewTimeoutMs !== TIMEOUT_MS ||
    modelConfig.plannerTimeoutMs !== TIMEOUT_MS ||
    'schemaProfiles' in config ||
    'onNonThinkingAudit' in config
  ) {
    return null;
  }
  return {
    config: {
      provider: 'deepseek',
      apiKey: config.apiKey,
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    },
    pricing,
  };
}

type AuditAggregate = Readonly<{
  record(value: V8NonThinkingAudit): void;
  readCount(): number;
  readDiagnosticCode(): ReviewPlannerControlledLiveV8DiagnosticCode | null;
}>;

function createAuditAggregate(): AuditAggregate {
  let count = 0;
  let diagnosticCode: ReviewPlannerControlledLiveV8DiagnosticCode | null = null;
  return Object.freeze({
    record(value: V8NonThinkingAudit) {
      count += 1;
      const audit = reduceAudit(value);
      if (!audit.reasoningCompliant) {
        diagnosticCode = 'thinking_not_disabled';
      } else if (audit.usageState === 'missing') {
        diagnosticCode = 'provider_usage_missing';
      } else if (audit.usageState === 'invalid') {
        diagnosticCode = 'provider_usage_invalid';
      }
    },
    readCount: () => count,
    readDiagnosticCode: () => diagnosticCode,
  });
}

function reduceAudit(value: unknown): Readonly<{
  reasoningCompliant: boolean;
  usageState: V8UsageState;
}> {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { reasoningCompliant: false, usageState: 'invalid' };
    }
    const candidate = value as Record<string, unknown>;
    const usageState: V8UsageState =
      candidate.usageState === 'missing' ||
      candidate.usageState === 'invalid' ||
      candidate.usageState === 'positive'
        ? candidate.usageState
        : 'invalid';
    return {
      reasoningCompliant:
        candidate.reasoningContentPresent === false &&
        (candidate.reasoning === 'not_reported' ||
          (candidate.reasoning === 'reported_zero' &&
            candidate.reportedReasoningTokens === 0)),
      usageState,
    };
  } catch {
    return { reasoningCompliant: false, usageState: 'invalid' };
  }
}

function failedCanary(
  diagnosticCode: ReviewPlannerControlledLiveV8DiagnosticCode,
): CanaryOutcome {
  return {
    result: { kind: 'failed', diagnosticCode },
    usage: null,
  };
}

function closed(
  diagnosticCode: ReviewPlannerControlledLiveV8DiagnosticCode,
): ReviewPlannerControlledLiveV8EvaluatorPort {
  return Object.freeze({
    state: 'closed' as const,
    identity: null,
    diagnosticCode,
    providerAttemptCount: () => 0,
  });
}

function identity(): ReviewPlannerControlledLiveV8EvaluatorIdentity {
  return Object.freeze({
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    baseUrlIdentity: 'deepseek-v1',
    structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    timeoutMs: TIMEOUT_MS,
    schemaId: 'review-model-candidate-v1',
    priceProfileId:
      REVIEW_PLANNER_CONTROLLED_LIVE_V8_STAGE_DIAGNOSTICS_PRICE_PROFILE_ID,
  });
}

function mapResultDiagnostic(
  errorCode: ModelAgentErrorCode,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
): ReviewPlannerControlledLiveV8DiagnosticCode {
  if (errorCode === 'SCHEMA_INVALID') {
    return ReviewPlannerDiagnosticCode.StructuredOutput;
  }
  if (
    errorCode === 'INVALID_REQUEST' ||
    errorCode === 'INVALID_RUNTIME_CONFIG'
  ) {
    return ReviewPlannerDiagnosticCode.PreflightInvalid;
  }
  if (errorCode === 'PROVIDER_ERROR') {
    switch (providerFailureCategory) {
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
        return 'sdk_usage_lost';
      default:
        return ReviewPlannerDiagnosticCode.Transport;
    }
  }
  return errorCode === 'TIMEOUT' || errorCode === 'ABORTED'
    ? ReviewPlannerDiagnosticCode.Transport
    : ReviewPlannerDiagnosticCode.InvalidResponse;
}

function exhaustedRuntimeRequest<T>(
  runtime: ModelAgentRuntime,
  request: ModelAgentRequest<T>,
) {
  return runtime.invokeStructured({
    ...request,
    budget: { ...request.budget, usedCalls: request.budget.maxCalls },
  });
}

function aggregateCost(
  report: Phase695Report,
  pricing: ReviewPlannerControlledLiveV8StageDiagnosticsPricing,
  canaryUsage: CanaryUsage,
): ReviewPlannerControlledLiveV8CnyCost | null {
  const observedInputTokens =
    canaryUsage.inputTokens + report.counters.inputTokens;
  const observedOutputTokens =
    canaryUsage.outputTokens + report.counters.outputTokens;
  const observedCostCny = calculateCnyCost(
    observedInputTokens,
    observedOutputTokens,
  );
  if (observedCostCny > pricing.hardCapCny) return null;
  return {
    currency: 'CNY',
    nonCachedInputCnyPerMillionTokens: INPUT_CNY_PER_MILLION,
    outputCnyPerMillionTokens: OUTPUT_CNY_PER_MILLION,
    hardCapCny: HARD_CAP_CNY,
    maxPairedProviderAttempts: pricing.maxPairedProviderAttempts,
    maxProviderAttempts: pricing.maxProviderAttempts,
    reservedInputTokens: pricing.reservedInputTokens,
    reservedOutputTokens: pricing.reservedOutputTokens,
    reservedCostCny: pricing.reservedCostCny,
    priceProfileId: pricing.priceProfileId,
    observedInputTokens,
    observedOutputTokens,
    observedCostCny,
    withinHardCap: true,
  };
}

function isPassingReport(report: Phase695Report): boolean {
  return (
    report.mode === 'live' &&
    report.counters.caseEntries === 48 &&
    report.counters.zeroCallCases === 26 &&
    report.counters.runtimeInvocations === MAX_PAIRED_PROVIDER_ATTEMPTS &&
    report.counters.strictSuccesses === 48 &&
    report.counters.qualityPasses === 48 &&
    report.counters.criticalFailures === 0 &&
    report.counters.inputTokens + report.counters.outputTokens > 0 &&
    report.metrics.strictSchemaSuccessRate === 1 &&
    report.metrics.semanticQualityRate >= 0.9 &&
    report.metrics.p95DurationMs <= TIMEOUT_MS &&
    report.productionDecision === 'quality_gate_passed'
  );
}

function hasPositiveSafeCanaryUsage(value: {
  inputTokens: number;
  outputTokens: number;
}) {
  return (
    Number.isSafeInteger(value.inputTokens) &&
    value.inputTokens > 0 &&
    value.inputTokens <= RESERVED_INPUT_TOKENS &&
    Number.isSafeInteger(value.outputTokens) &&
    value.outputTokens > 0 &&
    value.outputTokens <= CANARY_MAX_OUTPUT_TOKENS
  );
}

function isExactPricing(
  value: unknown,
): value is DeepSeekV4ProV8StageDiagnosticsPricing {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.currency === 'CNY' &&
    candidate.nonCachedInputCnyPerMillionTokens === INPUT_CNY_PER_MILLION &&
    candidate.outputCnyPerMillionTokens === OUTPUT_CNY_PER_MILLION &&
    candidate.hardCapCny === HARD_CAP_CNY
  );
}

function calculateCnyCost(inputTokens: number, outputTokens: number): number {
  return Number(
    (
      (inputTokens * INPUT_CNY_PER_MILLION +
        outputTokens * OUTPUT_CNY_PER_MILLION) /
      1_000_000
    ).toFixed(8),
  );
}

function strictBoolean(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function exactTimeout(value: unknown): number | null {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(numeric) ? numeric : null;
}

function trim(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function boundedAttempts(value: number) {
  return Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_PROVIDER_ATTEMPTS
    ? value
    : 0;
}
