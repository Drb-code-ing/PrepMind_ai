import {
  createModelAgentBudget,
  createModelAgentRuntime,
  MODEL_AGENT_STRUCTURED_OUTPUT_STAGES,
  type ModelAgentResult,
  type ModelAgentRuntime,
  type ModelAgentStructuredOutputStage,
  type StructuredModelExecutor,
} from '@repo/ai';
import {
  phase695ReportSchema,
  REVIEW_MODEL_CANDIDATE_SCHEMA,
  ReviewPlannerDiagnosticCode,
  runPhase695ReviewPlannerPaired,
  type Phase695Report,
  type Phase695LiveDependencies,
} from '@repo/agent';

import { resolveReviewPlannerLiveExecutorConfig } from './review-planner-model-config';
import {
  createReviewPlannerControlledLiveV4JsonExecutor,
  type ReviewPlannerControlledLiveV4Fetch,
} from './review-planner-controlled-live-eval-v4-json';

const V4_PROFILE_ID = 'phase-6.9.5-review-planner-controlled-live-v4';
const V4_TIMEOUT_MS = 4_500;
const V4_CANARY_INPUT_TOKENS = 96;
const V4_CANARY_OUTPUT_TOKENS = 32;
const V4_SYSTEM_PROMPT =
  'Return exactly one strict JSON object matching REVIEW_MODEL_CANDIDATE_SCHEMA. Its exact value must be {"focusIndexes":[0],"diagnosis":"review_pressure"}. Do not return an acknowledgement, prose, or extra fields.';
const V4_USER_PROMPT =
  'Return exactly {"focusIndexes":[0],"diagnosis":"review_pressure"}.';

type V4ExecutorConfig = Readonly<{
  provider: 'deepseek';
  apiKey: string;
  baseURL: 'https://api.deepseek.com/v1';
  model: 'deepseek-v4-flash';
}>;

type V4FactoryDependencies = Readonly<{
  fetch: ReviewPlannerControlledLiveV4Fetch;
  isPricingKnown(model: string): boolean;
  runPairedEvaluation(input: {
    mode: 'live';
    live: Phase695LiveDependencies;
  }): Promise<Phase695Report>;
}>;

export type ReviewPlannerControlledLiveV4Diagnostic = Readonly<{
  status: 'complete' | 'invalid_attempted';
  canContinue: boolean;
  providerAttemptCount: number;
  usageKnown: boolean;
  diagnosticCode?: ReviewPlannerDiagnosticCode;
  structuredOutputStage?: ModelAgentStructuredOutputStage;
}>;

export type ReviewPlannerControlledLiveV4Evaluator = Readonly<{
  runDiagnostic(): Promise<ReviewPlannerControlledLiveV4Diagnostic>;
  runPairedEvaluation(): Promise<
    | Readonly<{ kind: 'report'; report: Phase695Report }>
    | Readonly<{
        kind: 'failed';
        diagnosticCode:
          | ReviewPlannerDiagnosticCode.Transport
          | ReviewPlannerDiagnosticCode.InvalidResponse;
      }>
  >;
  providerAttemptCount(): number;
}>;

export type ReviewPlannerControlledLiveV4FactoryResult =
  | Readonly<{ ok: true; value: ReviewPlannerControlledLiveV4Evaluator }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }>;

const defaultDependencies: V4FactoryDependencies = {
  fetch: (url, init) => globalThis.fetch(url, init),
  isPricingKnown: (model) => model === 'deepseek-v4-flash',
  runPairedEvaluation: runPhase695ReviewPlannerPaired,
};

/** V4 validates all gates before creating the private direct-fetch executor. */
export function validateReviewPlannerControlledLiveV4Preflight(
  env: Record<string, unknown>,
  overrides: Partial<Pick<V4FactoryDependencies, 'isPricingKnown'>> = {},
):
  | Readonly<{ ok: true; config: V4ExecutorConfig }>
  | Readonly<{ ok: false; diagnosticCode: ReviewPlannerDiagnosticCode }> {
  const config = resolveV4Config(
    env,
    overrides.isPricingKnown ?? defaultDependencies.isPricingKnown,
  );
  return config
    ? { ok: true, config }
    : {
        ok: false,
        diagnosticCode: ReviewPlannerDiagnosticCode.PreflightInvalid,
      };
}

export function createReviewPlannerControlledLiveV4Evaluator(
  env: Record<string, unknown>,
  overrides: Partial<V4FactoryDependencies> = {},
): ReviewPlannerControlledLiveV4FactoryResult {
  const dependencies = { ...defaultDependencies, ...overrides };
  const preflight = validateReviewPlannerControlledLiveV4Preflight(env, {
    isPricingKnown: dependencies.isPricingKnown,
  });
  if (!preflight.ok) return preflight;

  let directFetchExecutor: StructuredModelExecutor;
  try {
    directFetchExecutor = createReviewPlannerControlledLiveV4JsonExecutor(
      preflight.config,
      { fetch: dependencies.fetch },
    );
  } catch {
    return {
      ok: false,
      diagnosticCode: ReviewPlannerDiagnosticCode.ExecutorInit,
    };
  }

  let attempts = 0;
  const firstPartyDirectFetchExecutor: StructuredModelExecutor = async (
    input,
  ) => {
    attempts += 1;
    return directFetchExecutor(input);
  };
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: preflight.config.model,
    liveCallsEnabled: true,
    timeoutMs: V4_TIMEOUT_MS,
    executor: firstPartyDirectFetchExecutor,
  });
  let diagnostic: Promise<ReviewPlannerControlledLiveV4Diagnostic> | null =
    null;
  let paired: ReturnType<
    ReviewPlannerControlledLiveV4Evaluator['runPairedEvaluation']
  > | null = null;

  return {
    ok: true,
    value: Object.freeze({
      runDiagnostic() {
        diagnostic ??= runV4Canary(runtime, () => attempts);
        return diagnostic;
      },
      async runPairedEvaluation() {
        const result = await (diagnostic ??= runV4Canary(
          runtime,
          () => attempts,
        ));
        if (!result.canContinue) {
          return {
            kind: 'failed',
            diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
          } as const;
        }
        paired ??= runPairedSafely(dependencies.runPairedEvaluation, runtime);
        return paired;
      },
      providerAttemptCount: () => boundedAttempts(attempts),
    }),
  };
}

async function runV4Canary(
  runtime: ModelAgentRuntime,
  readAttempts: () => number,
): Promise<ReviewPlannerControlledLiveV4Diagnostic> {
  try {
    const result = await runtime.invokeStructured({
      runId: `${V4_PROFILE_ID}:review-schema-canary`,
      task: 'review_suggestion',
      schema: REVIEW_MODEL_CANDIDATE_SCHEMA,
      systemPrompt: V4_SYSTEM_PROMPT,
      userPrompt: V4_USER_PROMPT,
      estimatedInputTokens: V4_CANARY_INPUT_TOKENS,
      maxOutputTokens: V4_CANARY_OUTPUT_TOKENS,
      budget: createModelAgentBudget({
        maxCalls: 1,
        maxInputTokens: V4_CANARY_INPUT_TOKENS,
        maxOutputTokens: V4_CANARY_OUTPUT_TOKENS,
      }),
    });
    const providerAttemptCount = boundedAttempts(readAttempts());
    if (!result.ok) {
      const structuredOutputStage =
        mapV4ControlledLiveStructuredOutputStage(result);
      return {
        status: 'invalid_attempted',
        canContinue: false,
        providerAttemptCount,
        usageKnown: false,
        diagnosticCode: mapDiagnosticCode(result),
        ...(structuredOutputStage ? { structuredOutputStage } : {}),
      };
    }
    const usageKnown = positiveUsage(result.usage);
    return usageKnown
      ? {
          status: 'complete',
          canContinue: true,
          providerAttemptCount,
          usageKnown: true,
        }
      : {
          status: 'invalid_attempted',
          canContinue: false,
          providerAttemptCount,
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

export function mapV4ControlledLiveStructuredOutputStage(
  result: ModelAgentResult<unknown>,
): ModelAgentStructuredOutputStage | undefined {
  try {
    if (
      result.ok ||
      result.error.code !== 'PROVIDER_ERROR' ||
      result.error.providerFailureCategory !== 'structured_output' ||
      result.trace.providerFailureCategory !== 'structured_output'
    )
      return undefined;
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

function mapDiagnosticCode(
  result: Extract<ModelAgentResult<unknown>, { ok: false }>,
) {
  if (result.error.code === 'SCHEMA_INVALID')
    return ReviewPlannerDiagnosticCode.StructuredOutput;
  if (result.error.code !== 'PROVIDER_ERROR') {
    return result.error.code === 'TIMEOUT' || result.error.code === 'ABORTED'
      ? ReviewPlannerDiagnosticCode.Transport
      : ReviewPlannerDiagnosticCode.InvalidResponse;
  }
  switch (result.error.providerFailureCategory) {
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

async function runPairedSafely(
  runPairedEvaluation: V4FactoryDependencies['runPairedEvaluation'],
  runtime: ModelAgentRuntime,
) {
  try {
    const report = await runPairedEvaluation({
      mode: 'live',
      live: { runtime },
    });
    return phase695ReportSchema.safeParse(report).success
      ? ({ kind: 'report', report } as const)
      : ({
          kind: 'failed',
          diagnosticCode: ReviewPlannerDiagnosticCode.InvalidResponse,
        } as const);
  } catch {
    return {
      kind: 'failed',
      diagnosticCode: ReviewPlannerDiagnosticCode.Transport,
    } as const;
  }
}

function resolveV4Config(
  env: Record<string, unknown>,
  isPricingKnown: (model: string) => boolean,
): V4ExecutorConfig | null {
  if (
    strictBoolean(env.REVIEW_PLANNER_CONTROLLED_LIVE_EVAL_ENABLED) !== true ||
    strictBoolean(env.REVIEW_AGENT_MODEL_ENABLED) !== false ||
    strictBoolean(env.PLANNER_AGENT_MODEL_ENABLED) !== false
  )
    return null;
  const config = resolveReviewPlannerLiveExecutorConfig(env);
  if (
    !config ||
    config.provider !== 'deepseek' ||
    config.baseURL !== 'https://api.deepseek.com/v1' ||
    config.model !== 'deepseek-v4-flash' ||
    !isPricingKnown(config.model)
  )
    return null;
  return {
    provider: 'deepseek',
    apiKey: config.apiKey,
    baseURL: 'https://api.deepseek.com/v1',
    model: 'deepseek-v4-flash',
  };
}

function strictBoolean(value: unknown) {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return null;
}

function positiveUsage(value: { inputTokens: number; outputTokens: number }) {
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
