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

import { resolveReviewPlannerLiveExecutorConfig } from './review-planner-model-config';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE_ID =
  'phase-6.9.5-review-planner-controlled-live-v7-deepseek-v4-pro-usage-parity' as const;

const V7_TIMEOUT_MS = 4_500;
const V7_CANARY_ESTIMATED_INPUT_TOKENS = 96;
const V7_CANARY_MAX_OUTPUT_TOKENS = 32;
const V7_MAX_PAIRED_PROVIDER_ATTEMPTS = 22;
const V7_MAX_PROVIDER_ATTEMPTS = 23;
const V7_RESERVED_INPUT_TOKENS = 42_996;
const V7_RESERVED_OUTPUT_TOKENS = 9_712;
const V7_HARD_CAP_CNY = 1;
const V7_INPUT_CNY_PER_MILLION = 3;
const V7_OUTPUT_CNY_PER_MILLION = 6;
const V7_SYSTEM_PROMPT =
  'Return exactly one strict JSON object matching REVIEW_MODEL_CANDIDATE_SCHEMA. Its exact value must be {"focusIndexes":[0],"diagnosis":"review_pressure"}. Do not return an acknowledgement, prose, or extra fields.';
const V7_USER_PROMPT =
  'Return exactly {"focusIndexes":[0],"diagnosis":"review_pressure"}.';

type V7ExecutorConfig = Extract<
  OpenAICompatibleExecutorConfig,
  { structuredOutputMode: 'deepseek_v4_pro_nonthinking_json' }
>;
type V7NonThinkingAudit = Parameters<
  NonNullable<V7ExecutorConfig['onNonThinkingAudit']>
>[0];
type V7UsageState = V7NonThinkingAudit['usageState'];

export type ReviewPlannerControlledLiveV7DiagnosticCode =
  | ReviewPlannerDiagnosticCode
  | 'thinking_not_disabled'
  | 'provider_usage_missing'
  | 'provider_usage_invalid'
  | 'sdk_usage_lost'
  | 'output_limit_exceeded'
  | 'usage_reservation_exceeded';

export type DeepSeekV4ProV7Pricing = Readonly<{
  currency: 'CNY';
  nonCachedInputCnyPerMillionTokens: number;
  outputCnyPerMillionTokens: number;
  hardCapCny: number;
}>;

export const DEEPSEEK_V4_PRO_V7_PRICING: DeepSeekV4ProV7Pricing = Object.freeze(
  {
    currency: 'CNY',
    nonCachedInputCnyPerMillionTokens: V7_INPUT_CNY_PER_MILLION,
    outputCnyPerMillionTokens: V7_OUTPUT_CNY_PER_MILLION,
    hardCapCny: V7_HARD_CAP_CNY,
  },
);

export type ReviewPlannerControlledLiveV7Pricing = DeepSeekV4ProV7Pricing &
  Readonly<{
    maxPairedProviderAttempts: number;
    maxProviderAttempts: number;
    reservedInputTokens: number;
    reservedOutputTokens: number;
    reservedCostCny: number;
  }>;

export type ReviewPlannerControlledLiveV7Diagnostic = Readonly<{
  status: 'complete' | 'invalid_attempted';
  canContinue: boolean;
  providerAttemptCount: number;
  usageKnown: boolean;
  diagnosticCode?: ReviewPlannerControlledLiveV7DiagnosticCode;
}>;

export type ReviewPlannerControlledLiveV7CnyCost =
  ReviewPlannerControlledLiveV7Pricing &
    Readonly<{
      observedInputTokens: number;
      observedOutputTokens: number;
      observedCostCny: number;
      withinHardCap: boolean;
    }>;

export type ReviewPlannerControlledLiveV7PairedResult =
  | Readonly<{
      kind: 'report';
      report: Phase695Report;
      cost: ReviewPlannerControlledLiveV7CnyCost;
    }>
  | Readonly<{
      kind: 'failed';
      diagnosticCode: ReviewPlannerControlledLiveV7DiagnosticCode;
    }>;

type V7CanaryUsage = Readonly<{ inputTokens: number; outputTokens: number }>;
type V7CanaryOutcome = Readonly<{
  diagnostic: ReviewPlannerControlledLiveV7Diagnostic;
  usage: V7CanaryUsage | null;
}>;

export type ReviewPlannerControlledLiveV7Evaluator = Readonly<{
  runDiagnostic(): Promise<ReviewPlannerControlledLiveV7Diagnostic>;
  runPairedEvaluation(): Promise<ReviewPlannerControlledLiveV7PairedResult>;
  readCanaryUsage(): V7CanaryUsage | null;
  providerAttemptCount(): number;
}>;

export type ReviewPlannerControlledLiveV7FactoryResult =
  | Readonly<{ ok: true; value: ReviewPlannerControlledLiveV7Evaluator }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }>;

type V7FactoryDependencies = Readonly<{
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
  pricing: DeepSeekV4ProV7Pricing;
  runPairedEvaluation(input: {
    mode: 'live';
    live: Phase695LiveDependencies;
  }): Promise<Phase695Report>;
}>;

const defaultDependencies: V7FactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
  pricing: DEEPSEEK_V4_PRO_V7_PRICING,
  runPairedEvaluation: runPhase695ReviewPlannerPaired,
};

export function resolveReviewPlannerControlledLiveV7DeepSeekUsageParityPricing(
  pricing: unknown = DEEPSEEK_V4_PRO_V7_PRICING,
): ReviewPlannerControlledLiveV7Pricing | null {
  if (!isExactV7Pricing(pricing)) return null;
  const reservedCostCny = calculateCnyCost(
    V7_RESERVED_INPUT_TOKENS,
    V7_RESERVED_OUTPUT_TOKENS,
  );
  if (reservedCostCny > V7_HARD_CAP_CNY) return null;
  return Object.freeze({
    ...DEEPSEEK_V4_PRO_V7_PRICING,
    maxPairedProviderAttempts: V7_MAX_PAIRED_PROVIDER_ATTEMPTS,
    maxProviderAttempts: V7_MAX_PROVIDER_ATTEMPTS,
    reservedInputTokens: V7_RESERVED_INPUT_TOKENS,
    reservedOutputTokens: V7_RESERVED_OUTPUT_TOKENS,
    reservedCostCny,
  });
}

export function createReviewPlannerControlledLiveV7DeepSeekUsageParityEvaluator(
  env: Record<string, unknown>,
  overrides: Partial<V7FactoryDependencies> = {},
): ReviewPlannerControlledLiveV7FactoryResult {
  const dependencies = { ...defaultDependencies, ...overrides };
  const preflight = resolveV7Preflight(env, dependencies.pricing);
  if (!preflight) {
    return {
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    };
  }

  const audit = createV7AuditAggregate();
  let executor: StructuredModelExecutor;
  try {
    executor = dependencies.createExecutor({
      ...preflight.config,
      onNonThinkingAudit: audit.record,
    });
  } catch {
    return {
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.ExecutorInit,
    };
  }

  let providerAttempts = 0;
  const countedExecutor: StructuredModelExecutor = async (input) => {
    if (providerAttempts >= V7_MAX_PROVIDER_ATTEMPTS) {
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
    timeoutMs: V7_TIMEOUT_MS,
    executor: countedExecutor,
  });
  let canary: Promise<V7CanaryOutcome> | null = null;
  let canaryUsage: V7CanaryUsage | null = null;
  let paired: Promise<ReviewPlannerControlledLiveV7PairedResult> | null = null;
  let pairedProviderAttemptLimitExceeded = false;
  const pairedRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    invokeStructured<T>(request: ModelAgentRequest<T>) {
      if (audit.readDiagnosticCode() !== null) {
        return exhaustedRuntimeRequest(runtime, request);
      }
      if (providerAttempts < V7_MAX_PROVIDER_ATTEMPTS) {
        return runtime.invokeStructured(request);
      }
      pairedProviderAttemptLimitExceeded = true;
      return exhaustedRuntimeRequest(runtime, request);
    },
  };

  return {
    ok: true,
    value: Object.freeze({
      runDiagnostic() {
        canary ??= runV7Canary(runtime, audit, () => providerAttempts).then(
          (outcome) => {
            canaryUsage = outcome.usage;
            return outcome;
          },
        );
        return canary.then((outcome) => outcome.diagnostic);
      },
      async runPairedEvaluation() {
        const outcome = await (canary ??= runV7Canary(
          runtime,
          audit,
          () => providerAttempts,
        ).then((value) => {
          canaryUsage = value.usage;
          return value;
        }));
        if (!outcome.diagnostic.canContinue || outcome.usage === null) {
          return {
            kind: 'failed',
            diagnosticCode:
              outcome.diagnostic.diagnosticCode ??
              ReviewPlannerDiagnosticCode.Transport,
          };
        }
        paired ??= runV7PairedSafely({
          runPairedEvaluation: dependencies.runPairedEvaluation,
          runtime: pairedRuntime,
          pricing: preflight.pricing,
          canaryUsage: outcome.usage,
          readAttempts: () => providerAttempts,
          didExceedProviderAttemptLimit: () =>
            pairedProviderAttemptLimitExceeded,
          audit,
        });
        return paired;
      },
      readCanaryUsage: () =>
        canaryUsage === null ? null : Object.freeze({ ...canaryUsage }),
      providerAttemptCount: () => boundedAttempts(providerAttempts),
    }),
  };
}

async function runV7Canary(
  runtime: ModelAgentRuntime,
  audit: V7AuditAggregate,
  readAttempts: () => number,
): Promise<V7CanaryOutcome> {
  try {
    const result = await runtime.invokeStructured({
      runId: `${REVIEW_PLANNER_CONTROLLED_LIVE_V7_DEEPSEEK_USAGE_PARITY_PROFILE_ID}:review-schema-canary`,
      task: 'review_suggestion',
      schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
      systemPrompt: V7_SYSTEM_PROMPT,
      userPrompt: V7_USER_PROMPT,
      estimatedInputTokens: V7_CANARY_ESTIMATED_INPUT_TOKENS,
      maxOutputTokens: V7_CANARY_MAX_OUTPUT_TOKENS,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: V7_CANARY_ESTIMATED_INPUT_TOKENS,
        maxOutputTokens: V7_CANARY_MAX_OUTPUT_TOKENS,
      }),
    });
    const providerAttemptCount = boundedAttempts(readAttempts());
    const auditCode = audit.readDiagnosticCode();
    if (auditCode) return closedCanary(providerAttemptCount, auditCode);
    if (!result.ok) {
      return closedCanary(
        providerAttemptCount,
        mapV7ResultDiagnostic(
          result.error.code,
          result.error.providerFailureCategory,
        ),
      );
    }
    if (audit.readCount() !== providerAttemptCount) {
      return closedCanary(providerAttemptCount, 'sdk_usage_lost');
    }
    if (!hasPositiveSafeCanaryUsage(result.usage)) {
      return closedCanary(
        providerAttemptCount,
        result.usage.outputTokens > V7_CANARY_MAX_OUTPUT_TOKENS
          ? 'output_limit_exceeded'
          : 'usage_reservation_exceeded',
      );
    }
    return {
      diagnostic: {
        status: 'complete',
        canContinue: true,
        providerAttemptCount,
        usageKnown: true,
      },
      usage: Object.freeze({ ...result.usage }),
    };
  } catch {
    return closedCanary(
      boundedAttempts(readAttempts()),
      ReviewPlannerDiagnosticCode.Transport,
    );
  }
}

async function runV7PairedSafely(input: {
  runPairedEvaluation: V7FactoryDependencies['runPairedEvaluation'];
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  pricing: ReviewPlannerControlledLiveV7Pricing;
  canaryUsage: V7CanaryUsage;
  readAttempts: () => number;
  didExceedProviderAttemptLimit: () => boolean;
  audit: V7AuditAggregate;
}): Promise<ReviewPlannerControlledLiveV7PairedResult> {
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
      !isPassingV7Report(report)
    ) {
      return {
        kind: 'failed',
        diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
      };
    }
    const cost = aggregateV7CnyCost(report, input.pricing, input.canaryUsage);
    if (
      report.counters.inputTokens >
        input.pricing.reservedInputTokens - input.canaryUsage.inputTokens ||
      report.counters.outputTokens >
        input.pricing.reservedOutputTokens - input.canaryUsage.outputTokens
    ) {
      return { kind: 'failed', diagnosticCode: 'usage_reservation_exceeded' };
    }
    if (!cost.withinHardCap) {
      return {
        kind: 'failed',
        diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
      };
    }
    if (
      !hasExactProviderAttempts(input.readAttempts()) ||
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

function closedCanary(
  providerAttemptCount: number,
  diagnosticCode: ReviewPlannerControlledLiveV7DiagnosticCode,
): V7CanaryOutcome {
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

function resolveV7Preflight(
  env: Record<string, unknown>,
  pricingInput: unknown,
): Readonly<{
  config: Omit<V7ExecutorConfig, 'onNonThinkingAudit'>;
  pricing: ReviewPlannerControlledLiveV7Pricing;
}> | null {
  if (
    trim(env.AI_PROVIDER_MODE) !== 'live' ||
    strictBoolean(env.AI_ENABLE_LIVE_CALLS) !== true ||
    strictBoolean(env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V7_ENABLED) !==
      true ||
    strictBoolean(env.REVIEW_AGENT_MODEL_ENABLED) !== false ||
    strictBoolean(env.PLANNER_AGENT_MODEL_ENABLED) !== false
  ) {
    return null;
  }
  const pricing =
    resolveReviewPlannerControlledLiveV7DeepSeekUsageParityPricing(
      pricingInput,
    );
  if (!pricing) return null;
  const config = resolveReviewPlannerLiveExecutorConfig(env);
  if (
    !config ||
    config.provider !== 'deepseek' ||
    config.baseURL !== 'https://api.deepseek.com/v1' ||
    config.model !== 'deepseek-v4-pro' ||
    config.structuredOutputMode !== 'deepseek_v4_pro_nonthinking_json' ||
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

type V7AuditAggregate = Readonly<{
  record(value: V7NonThinkingAudit): void;
  readCount(): number;
  readUsageState(): V7UsageState | null;
  readDiagnosticCode(): ReviewPlannerControlledLiveV7DiagnosticCode | null;
}>;

function createV7AuditAggregate(): V7AuditAggregate {
  let count = 0;
  let usageState: V7UsageState | null = null;
  let diagnosticCode: ReviewPlannerControlledLiveV7DiagnosticCode | null = null;
  return Object.freeze({
    record(value: V7NonThinkingAudit) {
      count += 1;
      const reduced = reduceAudit(value);
      usageState = reduced.usageState;
      if (!reduced.reasoningCompliant) {
        diagnosticCode = 'thinking_not_disabled';
      } else if (reduced.usageState === 'missing') {
        diagnosticCode = 'provider_usage_missing';
      } else if (reduced.usageState === 'invalid') {
        diagnosticCode = 'provider_usage_invalid';
      }
    },
    readCount: () => count,
    readUsageState: () => usageState,
    readDiagnosticCode: () => diagnosticCode,
  });
}

function mapV7ResultDiagnostic(
  errorCode: ModelAgentErrorCode,
  providerFailureCategory?: ModelAgentProviderFailureCategory,
): ReviewPlannerControlledLiveV7DiagnosticCode {
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

function aggregateV7CnyCost(
  report: Phase695Report,
  pricing: ReviewPlannerControlledLiveV7Pricing,
  canaryUsage: V7CanaryUsage,
): ReviewPlannerControlledLiveV7CnyCost {
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

function isPassingV7Report(report: Phase695Report): boolean {
  return (
    report.mode === 'live' &&
    report.counters.caseEntries === 48 &&
    report.counters.zeroCallCases === 26 &&
    report.counters.runtimeInvocations === V7_MAX_PAIRED_PROVIDER_ATTEMPTS &&
    report.counters.strictSuccesses === 48 &&
    report.counters.qualityPasses === 48 &&
    report.counters.criticalFailures === 0 &&
    report.counters.inputTokens + report.counters.outputTokens > 0 &&
    report.metrics.p95DurationMs <= V7_TIMEOUT_MS &&
    report.metrics.semanticQualityRate >= 0.9 &&
    report.productionDecision === 'quality_gate_passed'
  );
}

function reduceAudit(value: unknown): Readonly<{
  reasoningCompliant: boolean;
  usageState: V7UsageState;
}> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { reasoningCompliant: false, usageState: 'invalid' };
    }
    const candidate = value as Record<string, unknown>;
    const usageState = candidate.usageState;
    const safeUsageState: V7UsageState =
      usageState === 'missing' ||
      usageState === 'invalid' ||
      usageState === 'positive'
        ? usageState
        : 'invalid';
    const reasoningCompliant =
      candidate.reasoningContentPresent === false &&
      (candidate.reasoning === 'not_reported' ||
        (candidate.reasoning === 'reported_zero' &&
          candidate.reportedReasoningTokens === 0));
    return { reasoningCompliant, usageState: safeUsageState };
  } catch {
    return { reasoningCompliant: false, usageState: 'invalid' };
  }
}

function hasPositiveSafeCanaryUsage(value: {
  inputTokens: number;
  outputTokens: number;
}) {
  return (
    Number.isSafeInteger(value.inputTokens) &&
    value.inputTokens > 0 &&
    value.inputTokens <= V7_RESERVED_INPUT_TOKENS &&
    Number.isSafeInteger(value.outputTokens) &&
    value.outputTokens > 0 &&
    value.outputTokens <= V7_CANARY_MAX_OUTPUT_TOKENS
  );
}

function isExactV7Pricing(value: unknown): value is DeepSeekV4ProV7Pricing {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.currency === 'CNY' &&
    candidate.nonCachedInputCnyPerMillionTokens === V7_INPUT_CNY_PER_MILLION &&
    candidate.outputCnyPerMillionTokens === V7_OUTPUT_CNY_PER_MILLION &&
    candidate.hardCapCny === V7_HARD_CAP_CNY
  );
}

function calculateCnyCost(inputTokens: number, outputTokens: number): number {
  return (
    Math.round(
      ((inputTokens * V7_INPUT_CNY_PER_MILLION +
        outputTokens * V7_OUTPUT_CNY_PER_MILLION) /
        1_000_000) *
        100_000_000,
    ) / 100_000_000
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
    value <= V7_MAX_PROVIDER_ATTEMPTS
    ? value
    : 0;
}

function hasExactProviderAttempts(value: number) {
  return Number.isSafeInteger(value) && value === V7_MAX_PROVIDER_ATTEMPTS;
}
