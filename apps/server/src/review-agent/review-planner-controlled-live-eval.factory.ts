import {
  createModelAgentBudget,
  createModelAgentRuntime,
  createOpenAICompatibleStructuredExecutor,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
  type ModelAgentErrorCode,
  type ModelAgentProviderFailureCategory,
  type ModelAgentResult,
  type ModelAgentRuntime,
  type ModelAgentStructuredOutputStage,
  type OpenAICompatibleExecutorConfig,
  type StructuredModelExecutor,
} from '@repo/ai';
import {
  ReviewPlannerDiagnosticCode,
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  phase695ReportSchema,
  runPhase695ReviewPlannerPaired,
  type Phase695Report,
  type Phase695LiveDependencies,
} from '@repo/agent';

import { resolveReviewPlannerLiveExecutorConfig } from './review-planner-model-config';

const CONTROLLED_LIVE_TIMEOUT_MS = 4_500;
const CONTROLLED_LIVE_CANARY_MAX_INPUT_TOKENS = 96;
const CONTROLLED_LIVE_CANARY_MAX_OUTPUT_TOKENS = 32;
const CONTROLLED_LIVE_V2_PROFILE =
  'phase-6.9.5-review-planner-controlled-live-v2';
const CONTROLLED_LIVE_V3_PROFILE =
  'phase-6.9.5-review-planner-controlled-live-v3';
const CONTROLLED_LIVE_REVIEW_SCHEMA_SYSTEM_PROMPT =
  'Return exactly one strict JSON object matching REVIEW_MODEL_CANDIDATE_SCHEMA. Its exact value must be {"focusIndexes":[0],"diagnosis":"review_pressure"}. Do not return an acknowledgement, prose, or extra fields.';
const CONTROLLED_LIVE_REVIEW_SCHEMA_USER_PROMPT =
  'Return exactly {"focusIndexes":[0],"diagnosis":"review_pressure"}.';

export type ControlledLiveDiagnosticResult = Readonly<{
  status: 'complete' | 'invalid_attempted';
  canContinue: boolean;
  providerAttemptCount: number;
  usageKnown: boolean;
  diagnosticCode?: ReviewPlannerDiagnosticCode;
  /** Only a v3 controlled diagnostic may populate this static subcategory. */
  structuredOutputStage?: ModelAgentStructuredOutputStage;
}>;

export type ReviewPlannerControlledLiveEvaluator = Readonly<{
  runDiagnostic(): Promise<ControlledLiveDiagnosticResult>;
  runPairedEvaluation(): Promise<ControlledLivePairedEvaluationResult>;
  providerAttemptCount(): number;
}>;

export type ControlledLivePairedEvaluationResult =
  | Readonly<{
      kind: 'report';
      report: Phase695Report;
    }>
  | Readonly<{
      kind: 'failed';
      diagnosticCode:
        | ReviewPlannerDiagnosticCode.Transport
        | ReviewPlannerDiagnosticCode.InvalidResponse;
    }>;

export type ReviewPlannerControlledLiveFactoryResult =
  | Readonly<{
      ok: true;
      value: ReviewPlannerControlledLiveEvaluator;
    }>
  | Readonly<{
      ok: false;
      diagnosticCode: ReviewPlannerDiagnosticCode;
    }>;

type FactoryDependencies = Readonly<{
  createExecutor(
    config: OpenAICompatibleExecutorConfig,
  ): StructuredModelExecutor;
  isPricingKnown(model: string): boolean;
  runPairedEvaluation(input: {
    mode: 'live';
    live: Phase695LiveDependencies;
  }): Promise<Phase695Report>;
}>;

const defaultDependencies: FactoryDependencies = {
  createExecutor: createOpenAICompatibleStructuredExecutor,
  isPricingKnown: (model) => model === 'deepseek-v4-flash',
  runPairedEvaluation: runPhase695ReviewPlannerPaired,
};

export function createReviewPlannerControlledLiveEvaluator(
  env: Record<string, unknown>,
  overrides: Partial<FactoryDependencies> = {},
): ReviewPlannerControlledLiveFactoryResult {
  return createControlledLiveEvaluator(env, overrides, {
    id: CONTROLLED_LIVE_V2_PROFILE,
    exposeStructuredOutputStage: false,
  });
}

/**
 * V3 is a separately named diagnostic profile. It shares only the bounded
 * executor construction; its stage projection stays within this factory.
 */
export function createReviewPlannerControlledLiveV3Evaluator(
  env: Record<string, unknown>,
  overrides: Partial<FactoryDependencies> = {},
): ReviewPlannerControlledLiveFactoryResult {
  return createControlledLiveEvaluator(env, overrides, {
    id: CONTROLLED_LIVE_V3_PROFILE,
    exposeStructuredOutputStage: true,
  });
}

/** Checks v3-only configuration without constructing an executor or network lane. */
export function validateReviewPlannerControlledLiveV3Preflight(
  env: Record<string, unknown>,
  overrides: Partial<Pick<FactoryDependencies, 'isPricingKnown'>> = {},
):
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }> {
  const isPricingKnown =
    overrides.isPricingKnown ?? defaultDependencies.isPricingKnown;
  return resolveControlledLiveConfig(env, isPricingKnown)
    ? { ok: true }
    : {
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      };
}

function createControlledLiveEvaluator(
  env: Record<string, unknown>,
  overrides: Partial<FactoryDependencies>,
  profile: Readonly<{
    id: typeof CONTROLLED_LIVE_V2_PROFILE | typeof CONTROLLED_LIVE_V3_PROFILE;
    exposeStructuredOutputStage: boolean;
  }>,
): ReviewPlannerControlledLiveFactoryResult {
  const dependencies = { ...defaultDependencies, ...overrides };
  const config = resolveControlledLiveConfig(env, dependencies.isPricingKnown);
  if (!config) {
    return {
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
    };
  }

  let executor: StructuredModelExecutor;
  try {
    executor = dependencies.createExecutor(config);
  } catch {
    return {
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.ExecutorInit,
    };
  }

  let attempts = 0;
  const countedExecutor: StructuredModelExecutor = async (input) => {
    attempts += 1;
    return executor(input);
  };
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: config.provider,
    model: config.model,
    liveCallsEnabled: true,
    timeoutMs: CONTROLLED_LIVE_TIMEOUT_MS,
    executor: countedExecutor,
  });
  let diagnostic: Promise<ControlledLiveDiagnosticResult> | null = null;
  let paired: Promise<ControlledLivePairedEvaluationResult> | null = null;

  return {
    ok: true,
    value: Object.freeze({
      runDiagnostic() {
        diagnostic ??= runSchemaCanary(runtime, () => attempts, profile);
        return diagnostic;
      },
      async runPairedEvaluation() {
        const canary = await (diagnostic ??= runSchemaCanary(
          runtime,
          () => attempts,
          profile,
        ));
        if (!canary.canContinue) {
          return {
            kind: 'failed',
            diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
          };
        }
        paired ??= runPairedEvaluationSafely(
          dependencies.runPairedEvaluation,
          runtime,
        );
        return paired;
      },
      providerAttemptCount: () => attempts,
    }),
  };
}

export function mapControlledLiveDiagnosticCode(
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
        return ReviewPlannerDiagnosticCode.InvalidResponse;
      default:
        return ReviewPlannerDiagnosticCode.Transport;
    }
  }
  return input.errorCode === 'TIMEOUT' || input.errorCode === 'ABORTED'
    ? ReviewPlannerDiagnosticCode.Transport
    : ReviewPlannerDiagnosticCode.InvalidResponse;
}

async function runSchemaCanary(
  runtime: ModelAgentRuntime,
  readAttempts: () => number,
  profile: Readonly<{
    id: typeof CONTROLLED_LIVE_V2_PROFILE | typeof CONTROLLED_LIVE_V3_PROFILE;
    exposeStructuredOutputStage: boolean;
  }>,
): Promise<ControlledLiveDiagnosticResult> {
  try {
    const result = await runtime.invokeStructured({
      runId: `${profile.id}:review-schema-canary`,
      task: 'review_suggestion',
      schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
      systemPrompt: CONTROLLED_LIVE_REVIEW_SCHEMA_SYSTEM_PROMPT,
      userPrompt: CONTROLLED_LIVE_REVIEW_SCHEMA_USER_PROMPT,
      estimatedInputTokens: CONTROLLED_LIVE_CANARY_MAX_INPUT_TOKENS,
      maxOutputTokens: CONTROLLED_LIVE_CANARY_MAX_OUTPUT_TOKENS,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: CONTROLLED_LIVE_CANARY_MAX_INPUT_TOKENS,
        maxOutputTokens: CONTROLLED_LIVE_CANARY_MAX_OUTPUT_TOKENS,
      }),
    });
    const attemptCount = boundedAttempts(readAttempts());
    if (!result.ok) {
      const structuredOutputStage = profile.exposeStructuredOutputStage
        ? mapV3ControlledLiveStructuredOutputStage(result)
        : undefined;
      return {
        status: 'invalid_attempted',
        canContinue: false,
        providerAttemptCount: attemptCount,
        usageKnown: false,
        diagnosticCode: mapControlledLiveDiagnosticCode({
          errorCode: result.error.code,
          providerFailureCategory: result.error.providerFailureCategory,
        }),
        ...(structuredOutputStage ? { structuredOutputStage } : {}),
      };
    }
    const usageKnown = isPositiveUsage(result.usage);
    return usageKnown
      ? {
          status: 'complete',
          canContinue: true,
          providerAttemptCount: attemptCount,
          usageKnown: true,
        }
      : {
          status: 'invalid_attempted',
          canContinue: false,
          providerAttemptCount: attemptCount,
          usageKnown: false,
          diagnosticCode: ReviewPlannerDiagnosticCode.UsageUnverifiable,
        };
  } catch {
    return {
      status: 'invalid_attempted',
      canContinue: false,
      providerAttemptCount: boundedAttempts(readAttempts()),
      usageKnown: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    };
  }
}

/**
 * The only permitted v3 expansion: a fixed private trace stage becomes safe
 * diagnostic evidence when, and only when, both runtime failure lanes agree.
 * Production candidate sanitizers, observations, DTOs and traces do not call
 * this mapper.
 */
export function mapV3ControlledLiveStructuredOutputStage(
  result: ModelAgentResult<unknown>,
): ModelAgentStructuredOutputStage | undefined {
  try {
    if (
      result.ok ||
      result.error.code !== 'PROVIDER_ERROR' ||
      result.error.providerFailureCategory !== 'structured_output' ||
      result.trace.providerFailureCategory !== 'structured_output'
    ) {
      return undefined;
    }
    const stage = result.trace.structuredOutputStage;
    return MODEL_AGENT_STRUCTURED_OUTPUT_STAGES.includes(
      stage as ModelAgentStructuredOutputStage,
    )
      ? stage
      : undefined;
  } catch {
    return undefined;
  }
}

async function runPairedEvaluationSafely(
  runPairedEvaluation: FactoryDependencies['runPairedEvaluation'],
  runtime: ModelAgentRuntime,
): Promise<ControlledLivePairedEvaluationResult> {
  try {
    const report = await runPairedEvaluation({
      mode: 'live',
      live: { runtime },
    });
    return !phase695ReportSchema.safeParse(report).success
      ? {
          kind: 'failed',
          diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
        }
      : { kind: 'report', report };
  } catch {
    return {
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    };
  }
}

function resolveControlledLiveConfig(
  env: Record<string, unknown>,
  isPricingKnown: (model: string) => boolean,
): OpenAICompatibleExecutorConfig | null {
  if (
    asStrictBoolean(env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED) !== true ||
    asStrictBoolean(env.REVIEW_AGENT_MODEL_ENABLED) !== false ||
    asStrictBoolean(env.PLANNER_AGENT_MODEL_ENABLED) !== false
  ) {
    return null;
  }
  const config = resolveReviewPlannerLiveExecutorConfig(env);
  if (
    !config ||
    config.provider !== 'deepseek' ||
    !isPricingKnown(config.model)
  ) {
    return null;
  }
  return config;
}

function asStrictBoolean(value: unknown): boolean | null {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function isPositiveUsage(value: { inputTokens: number; outputTokens: number }) {
  return (
    Number.isSafeInteger(value.inputTokens) &&
    value.inputTokens > 0 &&
    Number.isSafeInteger(value.outputTokens) &&
    value.outputTokens > 0
  );
}

function boundedAttempts(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 48 ? value : 0;
}
