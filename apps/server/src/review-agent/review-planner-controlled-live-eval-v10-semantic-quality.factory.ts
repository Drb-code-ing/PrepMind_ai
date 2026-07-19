import {
  createModelAgentBudget,
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  type ModelAgentRequest,
  type ModelAgentRuntime,
  type OpenAICompatibleExecutorConfig,
  type StructuredModelExecutor,
} from '@repo/ai';
import {
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  ReviewPlannerDiagnosticCode,
  runPhase695V10ReviewPlannerPaired,
  type Phase695V10LiveDependencies,
  type Phase695V10Report,
} from '@repo/agent';

import {
  deriveV10SemanticQualityDiagnostic,
  type V10SemanticQualityDiagnostic,
} from './review-planner-controlled-live-eval-v10-semantic-quality.contract';
import { resolveReviewPlannerLiveExecutorConfig } from './review-planner-model-config';

export const REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE_ID =
  'phase-6.9.5-review-planner-v10-semantic-quality' as const;
export const REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V10_SEMANTIC_QUALITY_ENABLED =
  'REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V10_SEMANTIC_QUALITY_ENABLED' as const;

const MAX_PROVIDER_ATTEMPTS = 23;
const MAX_PAIRED_ADMISSIONS = 22;
const TIMEOUT_MS = 4_500;
const RESERVED_INPUT_TOKENS = 42_996;
const CANARY_ESTIMATED_INPUT_TOKENS = 96;
const CANARY_MAX_OUTPUT_TOKENS = 32;
const CANARY_SYSTEM_PROMPT =
  'Return exactly one strict JSON object matching REVIEW_MODEL_CANDIDATE_SCHEMA. Its exact value must be {"focusIndexes":[0]}. Do not use tools. Do not return reasoning, acknowledgement, prose, or extra fields.';
const CANARY_USER_PROMPT = 'Return exactly {"focusIndexes":[0]}.';

type V10ExecutorConfig = Extract<
  OpenAICompatibleExecutorConfig,
  { structuredOutputMode: 'deepseek_v4_pro_nonthinking_json' }
>;
type CanaryResult =
  | Readonly<{
      kind: 'complete';
      providerAttemptCount: 1;
      usageKnown: true;
    }>
  | Readonly<{
      kind: 'failed';
      diagnosticCode: ReviewPlannerDiagnosticCode;
    }>;
type V10Identity = Readonly<{
  provider: 'deepseek';
  model: 'deepseek-v4-pro';
  baseUrlIdentity: 'deepseek-v1';
  structuredOutputMode: 'deepseek_v4_pro_nonthinking_json';
  timeoutMs: 4_500;
  schemaId: 'review-model-candidate-v1';
  priceProfileId: 'deepseek-v4-pro-cny-noncached-2026-07-19-v10-semantic-quality';
}>;

export type ReviewPlannerControlledLiveV10SemanticQualityPairedResult =
  Readonly<{
    result:
      | Readonly<{ kind: 'report'; report: Phase695V10Report }>
      | Readonly<{
          kind: 'failed';
          diagnosticCode: ReviewPlannerDiagnosticCode;
        }>;
    diagnostic: V10SemanticQualityDiagnostic;
  }>;

export type ReviewPlannerControlledLiveV10SemanticQualityEvaluatorPort =
  | Readonly<{
      state: 'ready';
      profileId: typeof REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE_ID;
      identity: V10Identity;
      runCanary(): Promise<CanaryResult>;
      runPaired(): Promise<ReviewPlannerControlledLiveV10SemanticQualityPairedResult>;
      providerAttemptCount(): number;
    }>
  | Readonly<{
      state: 'closed';
      profileId: typeof REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE_ID;
      identity: null;
      diagnosticCode: ReviewPlannerDiagnosticCode;
      providerAttemptCount(): number;
    }>;

type FactoryDependencies = Readonly<{
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
  runPairedEvaluation(input: {
    mode: 'live';
    live: Phase695V10LiveDependencies;
  }): Promise<Phase695V10Report>;
}>;

export type ReviewPlannerControlledLiveV10SemanticQualityFactoryOverrides =
  Partial<FactoryDependencies> &
    Readonly<{
      onDiagnostic?: (value: V10SemanticQualityDiagnostic) => void;
    }>;

const defaultDependencies: FactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
  runPairedEvaluation: runPhase695V10ReviewPlannerPaired,
};

export function validateReviewPlannerControlledLiveV10SemanticQualityPreflight(
  env: Record<string, unknown>,
):
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid;
    }> {
  return resolvePreflight(env)
    ? { ok: true }
    : {
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      };
}

export function createReviewPlannerControlledLiveV10SemanticQualityEvaluator(
  env: Record<string, unknown>,
  overrides: ReviewPlannerControlledLiveV10SemanticQualityFactoryOverrides = {},
): ReviewPlannerControlledLiveV10SemanticQualityEvaluatorPort {
  const preflight = resolvePreflight(env);
  if (!preflight) return closed(ReviewPlannerDiagnosticCode.PreflightInvalid);
  const dependencies = { ...defaultDependencies, ...overrides };
  const audit = createAuditAggregate();
  let executor: StructuredModelExecutor;
  try {
    executor = dependencies.createExecutor({
      ...(preflight.config as V10ExecutorConfig),
      onNonThinkingAudit: audit.record,
    });
  } catch {
    return closed(ReviewPlannerDiagnosticCode.ExecutorInit);
  }

  let providerAttempts = 0;
  const countedExecutor: StructuredModelExecutor = (input) => {
    if (providerAttempts >= MAX_PROVIDER_ATTEMPTS) {
      return Promise.reject(
        new Error('CONTROLLED_LIVE_V10_PROVIDER_ATTEMPT_LIMIT'),
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
  let pairedAdmissions = 0;
  let overflow = false;
  const pairedRuntime: Pick<ModelAgentRuntime, 'invokeStructured'> = {
    invokeStructured<T>(request: ModelAgentRequest<T>) {
      if (pairedAdmissions >= MAX_PAIRED_ADMISSIONS) {
        overflow = true;
        return exhaustedRuntimeRequest(runtime, request);
      }
      pairedAdmissions += 1;
      if (providerAttempts >= MAX_PROVIDER_ATTEMPTS || !audit.valid()) {
        overflow = providerAttempts >= MAX_PROVIDER_ATTEMPTS;
        return exhaustedRuntimeRequest(runtime, request);
      }
      return runtime.invokeStructured(request);
    },
  };

  let canaryPromise: Promise<
    Readonly<{ result: CanaryResult; usage: Usage | null }>
  > | null = null;
  let pairedPromise: Promise<ReviewPlannerControlledLiveV10SemanticQualityPairedResult> | null =
    null;
  const runCanaryOnce = () =>
    (canaryPromise ??= runCanary(runtime, audit, () => providerAttempts));

  return Object.freeze({
    state: 'ready' as const,
    profileId: REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE_ID,
    identity: identity(),
    async runCanary() {
      return (await runCanaryOnce()).result;
    },
    async runPaired() {
      const canary = await runCanaryOnce();
      if (canary.result.kind !== 'complete' || canary.usage === null) {
        return Object.freeze({
          result:
            canary.result.kind === 'failed'
              ? canary.result
              : {
                  kind: 'failed' as const,
                  diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
                },
          diagnostic: failedDiagnostic({
            providerAttempts,
            pairedAdmissions,
            overflow,
            auditCount: audit.count(),
          }),
        });
      }
      pairedPromise ??= runPairedSafely({
        runPairedEvaluation: dependencies.runPairedEvaluation,
        runtime: pairedRuntime,
        canaryUsage: canary.usage,
        readAttempts: () => providerAttempts,
        readAdmissions: () => pairedAdmissions,
        readOverflow: () => overflow,
        audit,
        onDiagnostic: overrides.onDiagnostic,
      });
      return pairedPromise;
    },
    providerAttemptCount: () =>
      bounded(providerAttempts, MAX_PROVIDER_ATTEMPTS),
  });
}

type Usage = Readonly<{ inputTokens: number; outputTokens: number }>;

async function runCanary(
  runtime: ModelAgentRuntime,
  audit: AuditAggregate,
  readAttempts: () => number,
): Promise<Readonly<{ result: CanaryResult; usage: Usage | null }>> {
  try {
    const result = await runtime.invokeStructured({
      runId: `${REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE_ID}:review-schema-canary`,
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
    const usage = result.ok ? positiveUsage(result.usage) : null;
    if (
      !result.ok ||
      !usage ||
      readAttempts() !== 1 ||
      audit.count() !== 1 ||
      !audit.valid()
    ) {
      return { result: failedCanary(), usage: null };
    }
    return {
      result: { kind: 'complete', providerAttemptCount: 1, usageKnown: true },
      usage,
    };
  } catch {
    return { result: failedCanary(), usage: null };
  }
}

function failedCanary(): CanaryResult {
  return {
    kind: 'failed',
    diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
  };
}

async function runPairedSafely(
  input: Readonly<{
    runPairedEvaluation: FactoryDependencies['runPairedEvaluation'];
    runtime: Pick<ModelAgentRuntime, 'invokeStructured'>;
    canaryUsage: Usage;
    readAttempts: () => number;
    readAdmissions: () => number;
    readOverflow: () => boolean;
    audit: AuditAggregate;
    onDiagnostic?: (value: V10SemanticQualityDiagnostic) => void;
  }>,
): Promise<ReviewPlannerControlledLiveV10SemanticQualityPairedResult> {
  let report: Phase695V10Report | null = null;
  try {
    report = await input.runPairedEvaluation({
      mode: 'live',
      live: { runtime: input.runtime },
    });
  } catch {
    return finishPaired(input, null);
  }
  return finishPaired(input, report);
}

function finishPaired(
  input: Readonly<{
    canaryUsage: Usage;
    readAttempts: () => number;
    readAdmissions: () => number;
    readOverflow: () => boolean;
    audit: AuditAggregate;
    onDiagnostic?: (value: V10SemanticQualityDiagnostic) => void;
  }>,
  report: Phase695V10Report | null,
): ReviewPlannerControlledLiveV10SemanticQualityPairedResult {
  const diagnostic = projectDiagnostic({
    report,
    canaryUsage: input.canaryUsage,
    providerAttempts: input.readAttempts(),
    pairedAdmissions: input.readAdmissions(),
    overflow: input.readOverflow(),
    auditCount: input.audit.count(),
    auditValid: input.audit.valid(),
  });
  try {
    input.onDiagnostic?.(deepFreeze(structuredClone(diagnostic)));
  } catch {
    // Observer failure cannot alter the terminal evaluator result.
  }
  return Object.freeze({
    result:
      report !== null && diagnostic.terminalReason === 'passed'
        ? Object.freeze({ kind: 'report' as const, report })
        : Object.freeze({
            kind: 'failed' as const,
            diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
          }),
    diagnostic: deepFreeze(structuredClone(diagnostic)),
  });
}

function projectDiagnostic(
  input: Readonly<{
    report: unknown;
    canaryUsage: Usage;
    providerAttempts: number;
    pairedAdmissions: number;
    overflow: boolean;
    auditCount: number;
    auditValid: boolean;
  }>,
): V10SemanticQualityDiagnostic {
  const attempts = {
    providerCount: bounded(input.providerAttempts, MAX_PROVIDER_ATTEMPTS),
    expectedProviderCount: 23 as const,
    pairedAdmissionCount: bounded(
      input.pairedAdmissions,
      MAX_PAIRED_ADMISSIONS,
    ),
    expectedPairedAdmissionCount: 22 as const,
    overflow: input.overflow === true,
    auditRecordCount: bounded(input.auditCount, MAX_PROVIDER_ATTEMPTS),
  };
  try {
    const report = asRecord(input.report);
    const counters = asRecord(report.counters);
    const metrics = asRecord(report.metrics);
    const aggregate = asRecord(report.aggregate);
    const caseEntries = asArray(report.caseEntries);
    if (
      report.schemaVersion !== 'phase-6.9-review-planner-v10-report-v1' ||
      report.datasetVersion !== 'phase-6.9-review-planner-v3' ||
      report.mode !== 'live' ||
      caseEntries.length !== 48
    ) {
      throw new Error('invalid_report');
    }
    const runtimeEntries = caseEntries.filter(
      (entry) => asRecord(entry).executionKind === 'runtime',
    );
    const zeroCallVerified = caseEntries.filter((entry) => {
      const record = asRecord(entry);
      return (
        record.executionKind === 'zero_call' && record.zeroCallVerified === true
      );
    }).length;
    const usageKnown =
      input.auditValid &&
      input.auditCount === input.providerAttempts &&
      runtimeEntries.length === 22 &&
      runtimeEntries.every((entry) => {
        const record = asRecord(entry);
        const usage = asRecord(record.usage);
        return (
          record.runtimeInvocations === 1 &&
          record.strictSuccess === true &&
          positiveInteger(usage.inputTokens) &&
          positiveInteger(usage.outputTokens)
        );
      });
    const inputTokens = safeInteger(counters.inputTokens);
    const outputTokens = safeInteger(counters.outputTokens);
    const usage =
      usageKnown && inputTokens !== null && outputTokens !== null
        ? {
            known: true as const,
            inputTokens: input.canaryUsage.inputTokens + inputTokens,
            outputTokens: input.canaryUsage.outputTokens + outputTokens,
          }
        : { known: false as const, reason: 'usage_unverifiable' as const };
    const cost = usage.known
      ? (() => {
          const amountCny = Number(
            (
              (usage.inputTokens * 3 + usage.outputTokens * 6) /
              1_000_000
            ).toFixed(8),
          );
          return {
            evaluated: true as const,
            amountCny,
            hardCapCny: 1 as const,
            withinCap: amountCny <= 1,
          };
        })()
      : { evaluated: false as const, reason: 'usage_unverifiable' as const };
    return deriveV10SemanticQualityDiagnostic({
      attempts,
      report: {
        schemaValid: true,
        caseEntries: requiredInteger(counters.caseEntries),
        zeroCallCases: requiredInteger(counters.zeroCallCases),
        zeroCallVerified,
        runtimeInvocations: requiredInteger(counters.runtimeInvocations),
        budgetExceededCases: runtimeEntries.filter((entry) =>
          exceededBudget(entry),
        ).length,
        strictSuccesses: requiredInteger(counters.strictSuccesses),
        qualityPasses: requiredInteger(counters.qualityPasses),
        criticalFailures: requiredInteger(counters.criticalFailures),
        p95DurationMs: requiredInteger(metrics.p95DurationMs),
        productionDecision: report.productionDecision,
        lanes: {
          review: projectLane(asRecord(aggregate.review)),
          planner: projectLane(asRecord(aggregate.planner)),
        },
      },
      usage,
      cost,
    });
  } catch {
    return failedDiagnostic({
      providerAttempts: input.providerAttempts,
      pairedAdmissions: input.pairedAdmissions,
      overflow: input.overflow,
      auditCount: input.auditCount,
    });
  }
}

function projectLane(value: Record<string, unknown>) {
  return {
    caseEntries: requiredInteger(value.caseEntries),
    runtimeCases: requiredInteger(value.runtimeCases),
    zeroCallCases: requiredInteger(value.zeroCallCases),
    strictSuccesses: requiredInteger(value.strictSuccesses),
    qualityPasses: requiredInteger(value.qualityPasses),
    criticalFailures: requiredInteger(value.criticalFailures),
  };
}

function failedDiagnostic(
  input: Readonly<{
    providerAttempts: number;
    pairedAdmissions: number;
    overflow: boolean;
    auditCount: number;
  }>,
): V10SemanticQualityDiagnostic {
  return deriveV10SemanticQualityDiagnostic({
    attempts: {
      providerCount: bounded(input.providerAttempts, MAX_PROVIDER_ATTEMPTS),
      expectedProviderCount: 23,
      pairedAdmissionCount: bounded(
        input.pairedAdmissions,
        MAX_PAIRED_ADMISSIONS,
      ),
      expectedPairedAdmissionCount: 22,
      overflow: input.overflow === true,
      auditRecordCount: bounded(input.auditCount, MAX_PROVIDER_ATTEMPTS),
    },
    report: { schemaValid: false },
    usage: { known: false, reason: 'usage_unverifiable' },
    cost: { evaluated: false, reason: 'usage_unverifiable' },
  });
}

function resolvePreflight(
  env: Record<string, unknown>,
): Readonly<{ config: OpenAICompatibleExecutorConfig }> | null {
  try {
    if (
      strictBoolean(
        env[REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V10_SEMANTIC_QUALITY_ENABLED],
      ) !== true ||
      strictBoolean(env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V8_ENABLED) !==
        false ||
      strictBoolean(
        env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_V9_GATE_DIAGNOSTICS_ENABLED,
      ) !== false ||
      strictBoolean(env.REVIEW_AGENT_MODEL_ENABLED) !== false ||
      strictBoolean(env.PLANNER_AGENT_MODEL_ENABLED) !== false ||
      exactTimeout(env.REVIEW_AGENT_MODEL_TIMEOUT_MS) !== TIMEOUT_MS ||
      exactTimeout(env.PLANNER_AGENT_MODEL_TIMEOUT_MS) !== TIMEOUT_MS
    ) {
      return null;
    }
    const config = resolveReviewPlannerLiveExecutorConfig(env);
    if (
      !config ||
      config.provider !== 'deepseek' ||
      config.model !== 'deepseek-v4-pro' ||
      config.baseURL !== 'https://api.deepseek.com/v1' ||
      config.structuredOutputMode !== 'deepseek_v4_pro_nonthinking_json'
    ) {
      return null;
    }
    return { config };
  } catch {
    return null;
  }
}

type AuditAggregate = Readonly<{
  record(value: unknown): void;
  count(): number;
  valid(): boolean;
}>;

function createAuditAggregate(): AuditAggregate {
  let count = 0;
  let valid = true;
  return Object.freeze({
    record(value) {
      count += 1;
      const audit = asRecordOrNull(value);
      valid =
        valid &&
        audit !== null &&
        audit.reasoningContentPresent === false &&
        (audit.reasoning === 'not_reported' ||
          (audit.reasoning === 'reported_zero' &&
            audit.reportedReasoningTokens === 0)) &&
        audit.usageState === 'positive';
    },
    count: () => count,
    valid: () => valid,
  });
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

function exceededBudget(value: unknown) {
  try {
    const record = asRecord(value);
    const budget = asRecord(record.budget);
    const usage = asRecord(record.usage);
    return (
      requiredInteger(record.runtimeInvocations) >
        requiredInteger(budget.maxCalls) ||
      requiredInteger(usage.inputTokens) >
        requiredInteger(budget.maxInputTokens) ||
      requiredInteger(usage.outputTokens) >
        requiredInteger(budget.maxOutputTokens)
    );
  } catch {
    return true;
  }
}

function identity(): V10Identity {
  return Object.freeze({
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    baseUrlIdentity: 'deepseek-v1',
    structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    timeoutMs: 4_500,
    schemaId: 'review-model-candidate-v1',
    priceProfileId:
      'deepseek-v4-pro-cny-noncached-2026-07-19-v10-semantic-quality',
  });
}

function closed(
  diagnosticCode: ReviewPlannerDiagnosticCode,
): ReviewPlannerControlledLiveV10SemanticQualityEvaluatorPort {
  return Object.freeze({
    state: 'closed',
    profileId: REVIEW_PLANNER_CONTROLLED_LIVE_V10_SEMANTIC_QUALITY_PROFILE_ID,
    identity: null,
    diagnosticCode,
    providerAttemptCount: () => 0,
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid_record');
  return value as Record<string, unknown>;
}

function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  try {
    return asRecord(value);
  } catch {
    return null;
  }
}

function asArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('invalid_array');
  return value;
}

function safeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function positiveInteger(value: unknown): boolean {
  const numeric = safeInteger(value);
  return numeric !== null && numeric > 0;
}

function requiredInteger(value: unknown): number {
  const numeric = safeInteger(value);
  if (numeric === null) throw new Error('invalid_integer');
  return numeric;
}

function bounded(value: number, max: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= max ? value : 0;
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
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;
  return Number.isSafeInteger(numeric) ? numeric : null;
}

function positiveUsage(value: unknown): Usage | null {
  const usage = asRecordOrNull(value);
  if (
    !usage ||
    !positiveInteger(usage.inputTokens) ||
    !positiveInteger(usage.outputTokens)
  )
    return null;
  const inputTokens = requiredInteger(usage.inputTokens);
  const outputTokens = requiredInteger(usage.outputTokens);
  return inputTokens <= RESERVED_INPUT_TOKENS &&
    outputTokens <= CANARY_MAX_OUTPUT_TOKENS
    ? { inputTokens, outputTokens }
    : null;
}

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return value;
  for (const child of Object.values(value as Record<string, unknown>))
    deepFreeze(child);
  return Object.freeze(value);
}
