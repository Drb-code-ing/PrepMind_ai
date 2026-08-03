import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentProviderFailureCategory,
  type ModelAgentStructuredOutputStage,
  type ModelAgentTrace,
  type StructuredModelExecutor,
} from '@repo/ai';

import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  buildPhase697V6OrganizerSemanticAxes,
  buildPhase697V6OrganizerModelOwnedDecision,
  buildPhase697V6OrganizerSource,
  buildPhase697V6TutorModelOwnedDecision,
  buildPhase697V6TutorSemanticAxes,
  runPhase697V6ZeroCallCase,
} from './phase-6-9-tutor-wrong-question-v6-eval-case.ts';
import {
  createPhase697V6MonotonicClock,
  derivePhase697V6DurationEvidence,
  readPhase697V6MonotonicMs,
  type Phase697V6DurationStage,
  type Phase697V6MonotonicClock,
} from './phase-6-9-tutor-wrong-question-v6-deadline.ts';
import { PHASE_6_9_7_V6_EVAL_POLICY } from './phase-6-9-tutor-wrong-question-v6-policy.ts';
import type {
  Phase697V6Harness,
  Phase697V6RuntimeResult,
} from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import type { ModelCandidateObservation } from '../model-candidates/model-candidate-policy.ts';
import { runTutorV6ModelCandidate } from '../model-candidates/tutor-v6-model-candidate.ts';
import { runWrongQuestionOrganizerV6ModelCandidate } from '../model-candidates/wrong-question-organizer-v6-model-candidate.ts';
import { buildTutorStrategy } from '../nodes/tutor.ts';

export const PHASE_6_9_7_V6_DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1' as const;
export const PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS = 3_500 as const;
export const PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS = 5_000 as const;

const TUTOR_MAX_INPUT_TOKENS = 1_200 as const;
const TUTOR_MAX_OUTPUT_TOKENS = 300 as const;
const ORGANIZER_MAX_INPUT_TOKENS = 3_500 as const;
const ORGANIZER_MAX_OUTPUT_TOKENS = 800 as const;
const INPUT_PRICE_CNY_PER_MILLION = 3 as const;
const OUTPUT_PRICE_CNY_PER_MILLION = 6 as const;
const OTHER_AGENT_GATES = [
  'ROUTER_MODEL_ENABLED',
  'KNOWLEDGE_VERIFIER_MODEL_ENABLED',
  'REVIEW_AGENT_MODEL_ENABLED',
  'PLANNER_AGENT_MODEL_ENABLED',
  'KNOWLEDGE_DEDUP_AGENT_MODEL_ENABLED',
  'KNOWLEDGE_ORGANIZER_AGENT_MODEL_ENABLED',
] as const;

const SAFE_RESULT = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
});

export type Phase697V6LiveConfiguration = Readonly<{
  tutorApiKey: string;
  organizerApiKey: string;
}>;

export function resolvePhase697V6LiveConfiguration(
  env: Readonly<Record<string, string | undefined>>,
):
  | Readonly<{ ok: true; value: Phase697V6LiveConfiguration }>
  | Readonly<{ ok: false; code: 'live_configuration_invalid' }> {
  try {
    const tutorApiKey = validCredential(safeReadEnv(env, 'TUTOR_AGENT_DEEPSEEK_API_KEY'));
    const organizerApiKey = validCredential(
      safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_DEEPSEEK_API_KEY'),
    );
    const otherGateEnabled = OTHER_AGENT_GATES.some((key) => safeReadEnv(env, key) === 'true');
    if (
      safeReadEnv(env, 'AI_PROVIDER_MODE') !== 'live' ||
      safeReadEnv(env, 'AI_ENABLE_LIVE_CALLS') !== 'true' ||
      safeReadEnv(env, 'TUTOR_AGENT_MODEL_ENABLED') !== 'true' ||
      safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_ENABLED') !== 'true' ||
      safeReadEnv(env, 'AI_BASE_URL') !== PHASE_6_9_7_V6_DEEPSEEK_BASE_URL ||
      !validFixedTimeout(
        safeReadEnv(env, 'TUTOR_AGENT_MODEL_TIMEOUT_MS'),
        PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
      ) ||
      !validFixedTimeout(
        safeReadEnv(env, 'WRONG_QUESTION_ORGANIZER_AGENT_MODEL_TIMEOUT_MS'),
        PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
      ) ||
      tutorApiKey === null ||
      organizerApiKey === null ||
      otherGateEnabled
    ) {
      return { ok: false, code: 'live_configuration_invalid' };
    }
    return {
      ok: true,
      value: Object.freeze({ tutorApiKey, organizerApiKey }),
    };
  } catch {
    return { ok: false, code: 'live_configuration_invalid' };
  }
}

export function createPhase697TutorOrganizerV6LiveHarness(input: {
  tutorExecutor: StructuredModelExecutor;
  organizerExecutor: StructuredModelExecutor;
  runId: string;
  runScope: 'branch' | 'main';
  tutorTimeoutMs: typeof PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS;
  organizerTimeoutMs: typeof PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS;
  executorProvenance: 'deepseek_network' | 'synthetic_test';
}): Readonly<Phase697V6Harness> {
  if (
    typeof input.tutorExecutor !== 'function' ||
    typeof input.organizerExecutor !== 'function' ||
    input.tutorTimeoutMs !== PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS ||
    input.organizerTimeoutMs !== PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS ||
    (input.executorProvenance !== 'deepseek_network' &&
      input.executorProvenance !== 'synthetic_test')
  ) {
    throw new Error('PHASE_6_9_7_V6_LIVE_HARNESS_CONFIG_INVALID');
  }
  return Object.freeze({
    runId: input.runId,
    runScope: input.runScope,
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
    executorProvenance: input.executorProvenance,
    runZeroCall: async (entry) => runPhase697V6ZeroCallCase(entry),
    runTutor: (entry, signal) =>
      runPhase697V6TutorRuntimeCase(
        entry,
        signal,
        input.runId,
        input.tutorExecutor,
        input.tutorTimeoutMs,
      ),
    runOrganizer: (entry, signal) =>
      runPhase697V6OrganizerRuntimeCase(
        entry,
        signal,
        input.runId,
        input.organizerExecutor,
        input.organizerTimeoutMs,
      ),
  });
}

export async function runPhase697V6TutorRuntimeCase(
  entry: Phase697V2TutorRuntimeCase,
  signal: AbortSignal,
  runId: string,
  executor: StructuredModelExecutor,
  timeoutMs: number,
): Promise<Phase697V6RuntimeResult> {
  const clock = createPhase697V6MonotonicClock();
  const startedAt = readPhase697V6MonotonicMs(clock);
  const tracked = createTrackedLiveRuntime({ executor, timeoutMs, clock });
  const candidate = await runTutorV6ModelCandidate({
    runId: `${runId}:tutor:${entry.pairedRunIndex}`,
    finalRoute: 'tutor',
    latestUserText: entry.input.latestUserText,
    ...(entry.input.activeStudyContext === undefined
      ? {}
      : { activeStudyContext: entry.input.activeStudyContext }),
    deterministic: buildTutorStrategy({
      latestUserText: entry.input.latestUserText,
      activeStudyContext: entry.input.activeStudyContext,
    }),
    safety: {
      latestUserText: 'safe_for_model',
      ...(entry.input.activeStudyContext === undefined
        ? {}
        : { activeStudyContext: 'safe_for_model' as const }),
    },
    runtime: tracked.runtime,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: TUTOR_MAX_INPUT_TOKENS,
      maxOutputTokens: TUTOR_MAX_OUTPUT_TOKENS,
    }),
    signal,
  });
  return buildLiveRuntimeResult({
    observation: candidate.observation,
    invocations: tracked.invocations(),
    executorDurationEvidence: tracked.executorDurationEvidence(),
    candidateOrchestrationEvidence: finishDurationEvidence({
      stage: 'candidate_orchestration',
      startedAt,
      finishedAt: readPhase697V6MonotonicMs(clock),
      deadlineMs: PHASE_6_9_7_V6_EVAL_POLICY.latency.tutorOrchestrationP95Max,
    }),
    hardDeadlineMs: PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
    maxInputTokens: TUTOR_MAX_INPUT_TOKENS,
    maxOutputTokens: TUTOR_MAX_OUTPUT_TOKENS,
    semanticAxes: buildPhase697V6TutorSemanticAxes(entry, candidate.result),
    modelOwnedDecision: buildPhase697V6TutorModelOwnedDecision(candidate.result),
  });
}

export async function runPhase697V6OrganizerRuntimeCase(
  entry: Phase697V2OrganizerRuntimeCase,
  signal: AbortSignal,
  runId: string,
  executor: StructuredModelExecutor,
  timeoutMs: number,
): Promise<Phase697V6RuntimeResult> {
  const clock = createPhase697V6MonotonicClock();
  const startedAt = readPhase697V6MonotonicMs(clock);
  const source = buildPhase697V6OrganizerSource(entry);
  const tracked = createTrackedLiveRuntime({ executor, timeoutMs, clock });
  const candidate = await runWrongQuestionOrganizerV6ModelCandidate({
    runId: `${runId}:organizer:${entry.pairedRunIndex}`,
    shortlistSource: source,
    runtime: tracked.runtime,
    budget: createModelAgentBudget({
      maxCalls: 1,
      maxInputTokens: ORGANIZER_MAX_INPUT_TOKENS,
      maxOutputTokens: ORGANIZER_MAX_OUTPUT_TOKENS,
    }),
    revalidateSource: () => source,
    signal,
  });
  return buildLiveRuntimeResult({
    observation: candidate.observation,
    invocations: tracked.invocations(),
    executorDurationEvidence: tracked.executorDurationEvidence(),
    candidateOrchestrationEvidence: finishDurationEvidence({
      stage: 'candidate_orchestration',
      startedAt,
      finishedAt: readPhase697V6MonotonicMs(clock),
      deadlineMs: PHASE_6_9_7_V6_EVAL_POLICY.latency.organizerCandidateP95Max,
    }),
    hardDeadlineMs: PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
    maxInputTokens: ORGANIZER_MAX_INPUT_TOKENS,
    maxOutputTokens: ORGANIZER_MAX_OUTPUT_TOKENS,
    semanticAxes: {
      agent: 'wrong_question_organizer',
      decisionUnits: entry.expected.decisions.length,
      ...buildPhase697V6OrganizerSemanticAxes(entry, candidate.result),
    },
    modelOwnedDecision: buildPhase697V6OrganizerModelOwnedDecision(entry, candidate.result, source),
  });
}

function createTrackedLiveRuntime(input: {
  executor: StructuredModelExecutor;
  timeoutMs: number;
  clock: Phase697V6MonotonicClock;
}) {
  let invocations = 0;
  let executorDurationEvidence: Phase697V6RuntimeResult['durationEvidence']['executor'] = null;
  const runtime = createModelAgentRuntime({
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    liveCallsEnabled: true,
    timeoutMs: input.timeoutMs,
    now: () => Math.floor(input.clock()),
    executor: async (request) => {
      invocations += 1;
      const startedAt = readPhase697V6MonotonicMs(input.clock);
      try {
        return await input.executor(request);
      } finally {
        executorDurationEvidence = finishDurationEvidence({
          stage: 'executor',
          startedAt,
          finishedAt: readPhase697V6MonotonicMs(input.clock),
          deadlineMs: input.timeoutMs,
        });
      }
    },
  });
  return Object.freeze({
    runtime,
    invocations: () => invocations,
    executorDurationEvidence: () => executorDurationEvidence,
  });
}

function buildLiveRuntimeResult<ReasonCode extends string>(input: {
  observation: ModelCandidateObservation<ReasonCode>;
  invocations: number;
  executorDurationEvidence: Phase697V6RuntimeResult['durationEvidence']['executor'];
  candidateOrchestrationEvidence: Phase697V6RuntimeResult['durationEvidence']['candidateOrchestration'];
  hardDeadlineMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  semanticAxes: NonNullable<Phase697V6RuntimeResult['semanticAxes']>;
  modelOwnedDecision: NonNullable<Phase697V6RuntimeResult['modelOwnedDecision']> | null;
}): Phase697V6RuntimeResult {
  const trace =
    input.observation.attempted && 'trace' in input.observation
      ? input.observation.trace
      : undefined;
  const usage = input.observation.usage;
  const verifiedUsage =
    Number.isSafeInteger(usage.inputTokens) &&
    usage.inputTokens > 0 &&
    usage.inputTokens <= input.maxInputTokens &&
    Number.isSafeInteger(usage.outputTokens) &&
    usage.outputTokens > 0 &&
    usage.outputTokens <= input.maxOutputTokens;
  const traceIdentityValid =
    trace !== undefined &&
    trace.mode === 'live' &&
    trace.provider === 'deepseek' &&
    trace.model === 'deepseek-v4-pro';
  const runtimeTraceEvidence =
    trace === undefined
      ? null
      : durationEvidenceFromDuration({
          stage: 'runtime_trace',
          durationMs: trace.durationMs,
          deadlineMs: input.hardDeadlineMs,
        });
  const durationEvidence = Object.freeze({
    executor: input.executorDurationEvidence,
    runtimeTrace: runtimeTraceEvidence,
    candidateOrchestration: input.candidateOrchestrationEvidence,
  });
  const durationContractValid =
    input.executorDurationEvidence !== null &&
    input.executorDurationEvidence.deadlineMs === input.hardDeadlineMs &&
    input.executorDurationEvidence.deadlineExceeded === false &&
    runtimeTraceEvidence !== null &&
    runtimeTraceEvidence.deadlineMs === input.hardDeadlineMs &&
    runtimeTraceEvidence.deadlineExceeded === false &&
    input.candidateOrchestrationEvidence !== null;
  const success =
    input.invocations === 1 &&
    input.observation.disposition === 'candidate_applied' &&
    input.observation.attempted &&
    traceIdentityValid &&
    trace.status === 'succeeded' &&
    verifiedUsage &&
    durationContractValid &&
    input.modelOwnedDecision !== null;
  const failure = classifyFailure(input.observation, trace, input.invocations, verifiedUsage);
  const attemptedAbort =
    input.observation.disposition === 'fallback_aborted' && input.observation.attempted;
  return Object.freeze({
    ...SAFE_RESULT,
    runtimeInvocations: input.invocations,
    candidateDisposition: input.observation.disposition,
    failureCategory: success ? 'none' : failure.category,
    providerFailureCategory: success ? null : failure.providerFailureCategory,
    structuredOutputStage: success ? null : failure.structuredOutputStage,
    strictRuntimeSuccess: success,
    semanticAxes: success ? input.semanticAxes : null,
    modelOwnedDecision: success ? input.modelOwnedDecision : null,
    durationEvidence,
    usage: success
      ? Object.freeze({
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          estimatedCostCny:
            (usage.inputTokens * INPUT_PRICE_CNY_PER_MILLION +
              usage.outputTokens * OUTPUT_PRICE_CNY_PER_MILLION) /
            1_000_000,
        })
      : null,
    usageDisposition: success ? 'verified' : 'unknown_after_attempt',
    ...(attemptedAbort ? { terminalHint: 'attempted_aborted' as const } : {}),
  });
}

function finishDurationEvidence(input: {
  stage: Phase697V6DurationStage;
  startedAt: ReturnType<typeof readPhase697V6MonotonicMs>;
  finishedAt: ReturnType<typeof readPhase697V6MonotonicMs>;
  deadlineMs: number;
}): Phase697V6RuntimeResult['durationEvidence']['executor'] {
  if (!input.startedAt.ok || !input.finishedAt.ok) return null;
  const evidence = derivePhase697V6DurationEvidence({
    stage: input.stage,
    startedMs: input.startedAt.value,
    finishedMs: input.finishedAt.value,
    deadlineMs: input.deadlineMs,
  });
  return evidence.ok ? evidence.value : null;
}

function durationEvidenceFromDuration(input: {
  stage: Phase697V6DurationStage;
  durationMs: number;
  deadlineMs: number;
}): Phase697V6RuntimeResult['durationEvidence']['runtimeTrace'] {
  const evidence = derivePhase697V6DurationEvidence({
    stage: input.stage,
    startedMs: 0,
    finishedMs: input.durationMs,
    deadlineMs: input.deadlineMs,
  });
  return evidence.ok ? evidence.value : null;
}

function classifyFailure<ReasonCode extends string>(
  observation: ModelCandidateObservation<ReasonCode>,
  trace: ModelCandidateTrace | undefined,
  invocations: number,
  verifiedUsage: boolean,
): Readonly<{
  category: Phase697V6RuntimeResult['failureCategory'];
  providerFailureCategory: ModelAgentProviderFailureCategory | null;
  structuredOutputStage: ModelAgentStructuredOutputStage | null;
}> {
  const reasons = new Set<string>(observation.reasonCodes);
  const providerFailureCategory = trace?.providerFailureCategory ?? null;
  const structuredOutputStage = trace?.structuredOutputStage ?? null;
  if (invocations > 1) {
    return { category: 'harness_internal', providerFailureCategory, structuredOutputStage };
  }
  if (observation.disposition === 'fallback_aborted') {
    return {
      category: observation.attempted ? 'post_dispatch_abort' : 'pre_dispatch_abort',
      providerFailureCategory,
      structuredOutputStage,
    };
  }
  if (reasons.has('stale_shortlist')) {
    return { category: 'stale_shortlist', providerFailureCategory, structuredOutputStage };
  }
  if (reasons.has('authority_invalid')) {
    return { category: 'local_merger', providerFailureCategory, structuredOutputStage };
  }
  if (trace?.errorCode === 'TIMEOUT') {
    return { category: 'runtime_timeout', providerFailureCategory, structuredOutputStage };
  }
  if (
    trace?.errorCode === 'SCHEMA_INVALID' ||
    providerFailureCategory === 'structured_output' ||
    structuredOutputStage !== null
  ) {
    return { category: 'structured_output', providerFailureCategory, structuredOutputStage };
  }
  if (trace?.errorCode === 'PROVIDER_ERROR') {
    return { category: 'provider_runtime', providerFailureCategory, structuredOutputStage };
  }
  if (observation.attempted && (!('trace' in observation) || !verifiedUsage)) {
    return { category: 'usage_unknown', providerFailureCategory, structuredOutputStage };
  }
  if (invocations === 0 || !observation.attempted) {
    return { category: 'dynamic_contract', providerFailureCategory, structuredOutputStage };
  }
  return { category: 'dynamic_contract', providerFailureCategory, structuredOutputStage };
}

type ModelCandidateTrace = ModelAgentTrace;

function safeReadEnv(
  env: Readonly<Record<string, string | undefined>>,
  key: string,
): string | undefined {
  if (typeof env !== 'object' || env === null) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(env, key);
  if (!descriptor) return undefined;
  if (!('value' in descriptor) || typeof descriptor.value !== 'string') {
    throw new Error('PHASE_6_9_7_V6_ENVIRONMENT_INVALID');
  }
  return descriptor.value;
}

function validCredential(value: string | undefined): string | null {
  if (value === undefined || value.length < 1 || value.length > 512) return null;
  if (value !== value.trim() || /[\r\n]/.test(value)) return null;
  return value;
}

function validFixedTimeout(value: string | undefined, expected: number): boolean {
  return value === undefined || value === '' || value === String(expected);
}
