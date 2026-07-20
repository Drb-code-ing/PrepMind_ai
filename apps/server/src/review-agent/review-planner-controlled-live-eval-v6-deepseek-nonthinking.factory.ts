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
  ReviewPlannerDiagnosticCode,
  runPhase695ReviewPlannerPaired,
  type Phase695LiveDependencies,
  type Phase695Report,
} from '@repo/agent';

import { resolveReviewPlannerLiveExecutorConfig } from './review-planner-model-config';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE_ID =
  'phase-6.9.5-review-planner-controlled-live-v6-deepseek-v4-pro-nonthinking';

const V6_TIMEOUT_MS = 4_500;
const V6_CANARY_INPUT_TOKENS = 96;
const V6_CANARY_OUTPUT_TOKENS = 32;
const V6_MAX_PAIRED_PROVIDER_ATTEMPTS = 22;
const V6_MAX_PROVIDER_ATTEMPTS = 23;
const V6_RESERVED_INPUT_TOKENS = 42_996;
const V6_RESERVED_OUTPUT_TOKENS = 9_712;
const V6_HARD_CAP_CNY = 1;
const V6_INPUT_CNY_PER_MILLION = 3;
const V6_OUTPUT_CNY_PER_MILLION = 6;
const V6_SYSTEM_PROMPT =
  'Return exactly one strict JSON object matching REVIEW_MODEL_CANDIDATE_SCHEMA. Its exact value must be {"focusIndexes":[0],"diagnosis":"review_pressure"}. Do not return an acknowledgement, prose, or extra fields.';
const V6_USER_PROMPT =
  'Return exactly {"focusIndexes":[0],"diagnosis":"review_pressure"}.';

type V6ExecutorConfig = Extract<
  OpenAICompatibleExecutorConfig,
  { structuredOutputMode: 'deepseek_v4_pro_nonthinking_json' }
>;
type V6NonThinkingAudit = Parameters<
  NonNullable<V6ExecutorConfig['onNonThinkingAudit']>
>[0];
type V6SafeNonThinkingAudit =
  | Readonly<{
      reasoning: 'not_reported';
      reasoningContentPresent: boolean;
    }>
  | Readonly<{
      reasoning: 'reported_zero';
      reasoningContentPresent: boolean;
      reportedReasoningTokens: 0;
    }>
  | Readonly<{
      reasoning: 'reported_positive';
      reasoningContentPresent: boolean;
      reportedReasoningTokens: number;
    }>
  | Readonly<{
      reasoning: 'invalid_detail';
      reasoningContentPresent: boolean;
    }>;

type V6DiagnosticCode = ReviewPlannerDiagnosticCode | 'thinking_not_disabled';

/**
 * The sole non-thinking audit projection permitted to leave the evaluator for
 * evidence. It deliberately excludes raw provider response, content and all
 * non-compliant detail.
 */
export type ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceAudit =
  | Readonly<{
      reasoning: 'not_reported';
      reasoningContentPresent: false;
    }>
  | Readonly<{
      reasoning: 'reported_zero';
      reasoningContentPresent: false;
      reportedReasoningTokens: 0;
    }>;

export type DeepSeekV4ProV6Pricing = Readonly<{
  currency: 'CNY';
  nonCachedInputCnyPerMillionTokens: number;
  outputCnyPerMillionTokens: number;
  hardCapCny: number;
}>;

export const DEEPSEEK_V4_PRO_V6_PRICING: DeepSeekV4ProV6Pricing = Object.freeze(
  {
    currency: 'CNY',
    nonCachedInputCnyPerMillionTokens: V6_INPUT_CNY_PER_MILLION,
    outputCnyPerMillionTokens: V6_OUTPUT_CNY_PER_MILLION,
    hardCapCny: V6_HARD_CAP_CNY,
  },
);

export type ReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing = Readonly<{
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

export type ReviewPlannerControlledLiveV6CnyCost =
  ReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing &
    Readonly<{
      observedInputTokens: number;
      observedOutputTokens: number;
      observedCostCny: number;
      withinHardCap: boolean;
    }>;

export type ReviewPlannerControlledLiveV6Diagnostic = Readonly<{
  status: 'complete' | 'invalid_attempted';
  canContinue: boolean;
  providerAttemptCount: number;
  usageKnown: boolean;
  diagnosticCode?: V6DiagnosticCode;
}>;

type V6CanaryOutcome = Readonly<{
  diagnostic: ReviewPlannerControlledLiveV6Diagnostic;
  usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
}>;

export type ReviewPlannerControlledLiveV6DeepSeekNonThinkingPairedResult =
  | Readonly<{
      kind: 'report';
      report: Phase695Report;
      /** Private evidence-facing CNY aggregate. Never becomes Trace pricing. */
      cost: ReviewPlannerControlledLiveV6CnyCost;
    }>
  | Readonly<{
      kind: 'failed';
      diagnosticCode:
        | ReviewPlannerDiagnosticCode.Transport
        | ReviewPlannerDiagnosticCode.InvalidResponse
        | 'thinking_not_disabled';
    }>;

export type ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator =
  Readonly<{
    runDiagnostic(): Promise<ReviewPlannerControlledLiveV6Diagnostic>;
    runPairedEvaluation(): Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingPairedResult>;
    providerAttemptCount(): number;
    readEvidenceNonThinkingAudit(): ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceAudit;
  }>;

export type ReviewPlannerControlledLiveV6DeepSeekNonThinkingFactoryResult =
  | Readonly<{
      ok: true;
      value: ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator;
    }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }>;

type V6FactoryDependencies = Readonly<{
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
  pricing: DeepSeekV4ProV6Pricing;
  runPairedEvaluation(input: {
    mode: 'live';
    live: Phase695LiveDependencies;
  }): Promise<Phase695Report>;
}>;

const defaultDependencies: V6FactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
  pricing: DEEPSEEK_V4_PRO_V6_PRICING,
  runPairedEvaluation: runPhase695ReviewPlannerPaired,
};

/**
 * Controlled-Live-only V6 price snapshot. CNY is intentionally not added to
 * online Agent Trace pricing, and no provider data is read here.
 */
export function resolveReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing(
  pricing: unknown = DEEPSEEK_V4_PRO_V6_PRICING,
): ReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing | null {
  if (!isExactV6Pricing(pricing)) return null;
  const reservedCostCny = calculateCnyCost(
    V6_RESERVED_INPUT_TOKENS,
    V6_RESERVED_OUTPUT_TOKENS,
  );
  if (reservedCostCny > V6_HARD_CAP_CNY) return null;
  return Object.freeze({
    currency: 'CNY',
    nonCachedInputCnyPerMillionTokens: V6_INPUT_CNY_PER_MILLION,
    outputCnyPerMillionTokens: V6_OUTPUT_CNY_PER_MILLION,
    hardCapCny: V6_HARD_CAP_CNY,
    maxPairedProviderAttempts: V6_MAX_PAIRED_PROVIDER_ATTEMPTS,
    maxProviderAttempts: V6_MAX_PROVIDER_ATTEMPTS,
    reservedInputTokens: V6_RESERVED_INPUT_TOKENS,
    reservedOutputTokens: V6_RESERVED_OUTPUT_TOKENS,
    reservedCostCny,
  });
}

/** Does not expose the executor configuration or provider credential. */
export function validateReviewPlannerControlledLiveV6DeepSeekNonThinkingPreflight(
  env: Record<string, unknown>,
  overrides: Partial<Pick<V6FactoryDependencies, 'pricing'>> = {},
):
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }> {
  return resolveV6Preflight(
    env,
    overrides.pricing ?? defaultDependencies.pricing,
  )
    ? { ok: true }
    : {
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      };
}

export function createReviewPlannerControlledLiveV6DeepSeekNonThinkingEvaluator(
  env: Record<string, unknown>,
  overrides: Partial<V6FactoryDependencies> = {},
): ReviewPlannerControlledLiveV6DeepSeekNonThinkingFactoryResult {
  const dependencies = { ...defaultDependencies, ...overrides };
  const preflight = resolveV6Preflight(env, dependencies.pricing);
  if (!preflight) {
    return {
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    };
  }

  const audit = createV6AuditAggregate();
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
    if (providerAttempts >= V6_MAX_PROVIDER_ATTEMPTS) {
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
    timeoutMs: V6_TIMEOUT_MS,
    executor: countedExecutor,
  });
  let diagnostic: Promise<V6CanaryOutcome> | null = null;
  let paired: Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingPairedResult> | null =
    null;
  let pairedProviderAttemptLimitExceeded = false;
  const pairedRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    invokeStructured<T>(request: ModelAgentRequest<T>) {
      if (audit.hasViolation()) {
        return exhaustedRuntimeRequest(runtime, request);
      }
      if (providerAttempts < V6_MAX_PROVIDER_ATTEMPTS) {
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
        diagnostic ??= runV6Canary(runtime, audit, () => providerAttempts);
        return diagnostic.then((outcome) => outcome.diagnostic);
      },
      async runPairedEvaluation() {
        const canary = await (diagnostic ??= runV6Canary(
          runtime,
          audit,
          () => providerAttempts,
        ));
        if (!canary.diagnostic.canContinue || canary.usage === null) {
          return {
            kind: 'failed',
            diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
          };
        }
        paired ??= runV6PairedSafely({
          runPairedEvaluation: dependencies.runPairedEvaluation,
          runtime: pairedRuntime,
          pricing: preflight.pricing,
          canaryUsage: canary.usage,
          readAttempts: () => providerAttempts,
          didExceedProviderAttemptLimit: () =>
            pairedProviderAttemptLimitExceeded,
          audit,
        });
        return paired;
      },
      providerAttemptCount: () => boundedAttempts(providerAttempts),
      readEvidenceNonThinkingAudit: () => audit.readEvidenceAggregate(),
    }),
  };
}

async function runV6Canary(
  runtime: ModelAgentRuntime,
  audit: V6AuditAggregate,
  readAttempts: () => number,
): Promise<V6CanaryOutcome> {
  try {
    const result = await runtime.invokeStructured({
      runId: `${REVIEW_PLANNER_CONTROLLED_LIVE_V6_DEEPSEEK_NONTHINKING_PROFILE_ID}:review-schema-canary`,
      task: 'review_suggestion',
      schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
      systemPrompt: V6_SYSTEM_PROMPT,
      userPrompt: V6_USER_PROMPT,
      estimatedInputTokens: V6_CANARY_INPUT_TOKENS,
      maxOutputTokens: V6_CANARY_OUTPUT_TOKENS,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: V6_CANARY_INPUT_TOKENS,
        maxOutputTokens: V6_CANARY_OUTPUT_TOKENS,
      }),
    });
    const providerAttemptCount = boundedAttempts(readAttempts());
    if (audit.hasViolation()) {
      return closedCanary(providerAttemptCount, 'thinking_not_disabled');
    }
    if (!result.ok) {
      return closedCanary(
        providerAttemptCount,
        mapV6DiagnosticCode({
          errorCode: result.error.code,
          providerFailureCategory: result.error.providerFailureCategory,
        }),
      );
    }
    if (
      !hasPositiveSafeUsage(
        result.usage,
        V6_CANARY_INPUT_TOKENS,
        V6_CANARY_OUTPUT_TOKENS,
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
  diagnosticCode: V6DiagnosticCode,
): V6CanaryOutcome {
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

async function runV6PairedSafely(input: {
  runPairedEvaluation: V6FactoryDependencies['runPairedEvaluation'];
  runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
  pricing: ReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing;
  canaryUsage: Readonly<{ inputTokens: number; outputTokens: number }>;
  readAttempts: () => number;
  didExceedProviderAttemptLimit: () => boolean;
  audit: V6AuditAggregate;
}): Promise<ReviewPlannerControlledLiveV6DeepSeekNonThinkingPairedResult> {
  try {
    const report = await input.runPairedEvaluation({
      mode: 'live',
      live: { runtime: input.runtime },
    });
    if (input.audit.hasViolation()) {
      return { kind: 'failed', diagnosticCode: 'thinking_not_disabled' };
    }
    if (!phase695ReportSchema.safeParse(report).success) {
      return {
        kind: 'failed',
        diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
      };
    }
    const cost = aggregateV6CnyCost(report, input.pricing, input.canaryUsage);
    if (
      !isPassingV6Report(report) ||
      report.counters.inputTokens >
        input.pricing.reservedInputTokens - input.canaryUsage.inputTokens ||
      report.counters.outputTokens >
        input.pricing.reservedOutputTokens - input.canaryUsage.outputTokens ||
      !hasExactProviderAttempts(input.readAttempts()) ||
      input.didExceedProviderAttemptLimit() ||
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

function resolveV6Preflight(
  env: Record<string, unknown>,
  pricingInput: unknown,
): Readonly<{
  config: Omit<V6ExecutorConfig, 'onNonThinkingAudit'>;
  pricing: ReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing;
}> | null {
  if (
    trim(env.AI_PROVIDER_MODE) !== 'live' ||
    strictBoolean(env.AI_ENABLE_LIVE_CALLS) !== true ||
    strictBoolean(env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V6_ENABLED) !==
      true ||
    strictBoolean(env.REVIEW_AGENT_MODEL_ENABLED) !== false ||
    strictBoolean(env.PLANNER_AGENT_MODEL_ENABLED) !== false
  ) {
    return null;
  }
  const pricing =
    resolveReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing(
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

function createV6AuditAggregate(): V6AuditAggregate {
  let violation = false;
  let reportedZero = false;
  return Object.freeze({
    record(value: V6NonThinkingAudit) {
      const safe = reduceNonThinkingAudit(value);
      if (!isCompliantNonThinkingAudit(safe)) {
        violation = true;
        return;
      }
      if (safe.reasoning === 'reported_zero') reportedZero = true;
    },
    hasViolation: () => violation,
    readEvidenceAggregate: () => toEvidenceAuditAggregate(reportedZero),
  });
}

function toEvidenceAuditAggregate(
  reportedZero: boolean,
): ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceAudit {
  if (reportedZero) {
    return Object.freeze({
      reasoning: 'reported_zero' as const,
      reasoningContentPresent: false,
      reportedReasoningTokens: 0,
    });
  }
  return Object.freeze({
    reasoning: 'not_reported' as const,
    reasoningContentPresent: false,
  });
}

type V6AuditAggregate = Readonly<{
  record: (audit: V6NonThinkingAudit) => void;
  hasViolation: () => boolean;
  /** The only evaluator-to-evidence audit projection. */
  readEvidenceAggregate: () => ReviewPlannerControlledLiveV6DeepSeekNonThinkingEvidenceAudit;
}>;

function reduceNonThinkingAudit(value: unknown): V6SafeNonThinkingAudit {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { reasoning: 'invalid_detail', reasoningContentPresent: false };
    }
    const candidate = value as Record<string, unknown>;
    const reasoning = candidate.reasoning;
    const reasoningContentPresent = candidate.reasoningContentPresent;
    if (reasoning === 'not_reported') {
      return {
        reasoning,
        reasoningContentPresent: reasoningContentPresent === true,
      };
    }
    if (reasoning === 'reported_zero') {
      const reportedReasoningTokens = candidate.reportedReasoningTokens;
      if (reportedReasoningTokens !== 0) {
        return {
          reasoning: 'invalid_detail',
          reasoningContentPresent: reasoningContentPresent === true,
        };
      }
      return {
        reasoning,
        reasoningContentPresent: reasoningContentPresent === true,
        reportedReasoningTokens: 0,
      };
    }
    if (reasoning === 'reported_positive') {
      const reportedReasoningTokens = candidate.reportedReasoningTokens;
      if (
        typeof reportedReasoningTokens !== 'number' ||
        !Number.isSafeInteger(reportedReasoningTokens) ||
        reportedReasoningTokens <= 0
      ) {
        return {
          reasoning: 'invalid_detail',
          reasoningContentPresent: reasoningContentPresent === true,
        };
      }
      return {
        reasoning,
        reasoningContentPresent: reasoningContentPresent === true,
        reportedReasoningTokens,
      };
    }
    return {
      reasoning: 'invalid_detail',
      reasoningContentPresent: reasoningContentPresent === true,
    };
  } catch {
    return { reasoning: 'invalid_detail', reasoningContentPresent: false };
  }
}

function isCompliantNonThinkingAudit(value: V6SafeNonThinkingAudit): boolean {
  return (
    (value.reasoning === 'not_reported' &&
      value.reasoningContentPresent === false) ||
    (value.reasoning === 'reported_zero' &&
      value.reasoningContentPresent === false &&
      value.reportedReasoningTokens === 0)
  );
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

function aggregateV6CnyCost(
  report: Phase695Report,
  pricing: ReviewPlannerControlledLiveV6DeepSeekNonThinkingPricing,
  canaryUsage: Readonly<{ inputTokens: number; outputTokens: number }>,
): ReviewPlannerControlledLiveV6CnyCost {
  const observedInputTokens =
    canaryUsage.inputTokens + report.counters.inputTokens;
  // Reasoning detail never reduces completion-token accounting.
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

function isPassingV6Report(report: Phase695Report): boolean {
  return (
    report.mode === 'live' &&
    report.counters.caseEntries === 48 &&
    report.counters.zeroCallCases === 26 &&
    report.counters.runtimeInvocations === V6_MAX_PAIRED_PROVIDER_ATTEMPTS &&
    // The shared contract includes all 26 verified zero-call entries in this
    // counter. The V6 Live requirement is 22 strict runtime successes.
    report.counters.strictSuccesses - report.counters.zeroCallCases ===
      V6_MAX_PAIRED_PROVIDER_ATTEMPTS &&
    report.counters.criticalFailures === 0 &&
    report.counters.inputTokens + report.counters.outputTokens > 0 &&
    report.metrics.p95DurationMs <= V6_TIMEOUT_MS &&
    report.metrics.semanticQualityRate >= 0.9 &&
    report.productionDecision === 'quality_gate_passed'
  );
}

function mapV6DiagnosticCode(input: {
  errorCode: ModelAgentErrorCode;
  providerFailureCategory?: ModelAgentProviderFailureCategory;
}): ReviewPlannerDiagnosticCode {
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

function isExactV6Pricing(value: unknown): value is DeepSeekV4ProV6Pricing {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.currency === 'CNY' &&
    candidate.nonCachedInputCnyPerMillionTokens === V6_INPUT_CNY_PER_MILLION &&
    candidate.outputCnyPerMillionTokens === V6_OUTPUT_CNY_PER_MILLION &&
    candidate.hardCapCny === V6_HARD_CAP_CNY
  );
}

function calculateCnyCost(inputTokens: number, outputTokens: number): number {
  return (
    Math.round(
      ((inputTokens * V6_INPUT_CNY_PER_MILLION +
        outputTokens * V6_OUTPUT_CNY_PER_MILLION) /
        1_000_000) *
        100_000_000,
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
    value <= V6_MAX_PROVIDER_ATTEMPTS
    ? value
    : 0;
}

function hasExactProviderAttempts(value: number) {
  return Number.isSafeInteger(value) && value === V6_MAX_PROVIDER_ATTEMPTS;
}
