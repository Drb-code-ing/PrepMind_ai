import {
  createModelAgentBudget,
  createModelAgentRuntime,
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type ModelAgentProviderFailureCategory,
  type ModelAgentStructuredOutputStage,
  type ModelAgentTrace,
  type StructuredModelExecutor,
  type FirstPartyDeepSeekV4ProDirectAdapter,
  type FirstPartyDeepSeekV4ProDirectConfig,
  type Phase697V7WireCapability as Phase697V8WireCapability,
} from '@repo/ai';

import type { Phase697V2OrganizerRuntimeCase } from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  buildPhase697V6OrganizerModelOwnedDecision,
  buildPhase697V6OrganizerSemanticAxes,
  buildPhase697V6OrganizerSource,
  runPhase697V6ZeroCallCase,
} from './phase-6-9-tutor-wrong-question-v6-eval-case.ts';
import {
  createPhase697V6MonotonicClock,
  derivePhase697V6DurationEvidence,
  readPhase697V6MonotonicMs,
  type Phase697V6DurationStage,
  type Phase697V6MonotonicClock,
} from './phase-6-9-tutor-wrong-question-v6-deadline.ts';
import {
  PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
  PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
  PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
  resolvePhase697V6LiveConfiguration,
  runPhase697V6TutorRuntimeCase,
  type Phase697V6LiveConfiguration,
} from './phase-6-9-tutor-wrong-question-v6-live.ts';
import { PHASE_6_9_7_V6_EVAL_POLICY } from './phase-6-9-tutor-wrong-question-v6-policy.ts';
import type { Phase697V6RuntimeResult } from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import type {
  Phase697V8Harness,
  Phase697V8OrganizerRuntimeResult,
} from './run-phase-6-9-tutor-wrong-question-v8-paired.ts';
import type { ModelCandidateObservation } from '../model-candidates/model-candidate-policy.ts';
import { runWrongQuestionOrganizerV8ModelCandidate } from '../model-candidates/wrong-question-organizer-v8-model-candidate.ts';
import type { WrongQuestionOrganizerV6CandidateResult } from '../model-candidates/wrong-question-organizer-v6-model-candidate.ts';

export type Phase697V8LiveConfiguration = Phase697V6LiveConfiguration;

const ORGANIZER_MAX_INPUT_TOKENS = 3_500 as const;
const ORGANIZER_MAX_OUTPUT_TOKENS = 800 as const;
const INPUT_PRICE_CNY_PER_MILLION = 3 as const;
const OUTPUT_PRICE_CNY_PER_MILLION = 6 as const;
const SAFE_RESULT = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
});

type AdapterFactory = (
  config: FirstPartyDeepSeekV4ProDirectConfig,
  capability: Phase697V8WireCapability,
) => FirstPartyDeepSeekV4ProDirectAdapter;

export function resolvePhase697V8LiveConfiguration(
  env: Readonly<Record<string, string | undefined>>,
): ReturnType<typeof resolvePhase697V6LiveConfiguration> {
  return resolvePhase697V6LiveConfiguration(env);
}

export function createPhase697TutorOrganizerV8LiveHarness(input: {
  configuration: Readonly<Phase697V8LiveConfiguration>;
  runId: string;
  runScope: 'branch' | 'main';
  adapterFactory?: AdapterFactory;
}): Readonly<Phase697V8Harness> {
  const adapterFactory = input.adapterFactory ?? createFirstPartyDeepSeekV4ProDirectAdapter;
  const executorProvenance = input.adapterFactory
    ? ('synthetic_test' as const)
    : ('first_party_deepseek_v4_pro_direct' as const);
  const createExecutor = (apiKey: string, capability: Phase697V8WireCapability) => {
    const adapter = adapterFactory(
      {
        provider: 'deepseek',
        apiKey,
        baseURL: PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
        model: 'deepseek-v4-pro',
      },
      capability,
    );
    if (adapter.provenance !== executorProvenance) {
      throw new Error('PHASE_6_9_7_V8_ADAPTER_PROVENANCE_INVALID');
    }
    return adapter.executor;
  };

  return Object.freeze({
    runId: input.runId,
    runScope: input.runScope,
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    structuredOutputMode: 'deepseek_v4_pro_direct_json',
    executorProvenance,
    runZeroCall: async (entry) => runPhase697V6ZeroCallCase(entry),
    runTutor: (entry, signal, capability) =>
      runPhase697V6TutorRuntimeCase(
        entry,
        signal,
        input.runId,
        createExecutor(input.configuration.tutorApiKey, capability),
        PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
      ),
    runOrganizer: (entry, signal, capability) =>
      runPhase697V8OrganizerRuntimeCase(
        entry,
        signal,
        input.runId,
        createExecutor(input.configuration.organizerApiKey, capability),
        PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
      ),
  });
}

export async function runPhase697V8OrganizerRuntimeCase(
  entry: Phase697V2OrganizerRuntimeCase,
  signal: AbortSignal,
  runId: string,
  executor: StructuredModelExecutor,
  timeoutMs: number,
): Promise<Phase697V8OrganizerRuntimeResult> {
  const clock = createPhase697V6MonotonicClock();
  const startedAt = readPhase697V6MonotonicMs(clock);
  const source = buildPhase697V6OrganizerSource(entry);
  const tracked = createTrackedV8LiveRuntime({ executor, timeoutMs, clock });
  const candidate = await runWrongQuestionOrganizerV8ModelCandidate({
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
  const v6CompatibleResult = candidate.result as unknown as WrongQuestionOrganizerV6CandidateResult;
  const runtimeResult = buildV8LiveRuntimeResult({
    observation: candidate.observation,
    invocations: tracked.invocations(),
    executorDurationEvidence: tracked.executorDurationEvidence(),
    candidateOrchestrationEvidence: finishV8DurationEvidence({
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
      ...buildPhase697V6OrganizerSemanticAxes(entry, v6CompatibleResult),
    },
    modelOwnedDecision: buildPhase697V6OrganizerModelOwnedDecision(
      entry,
      v6CompatibleResult,
      source,
    ),
  });
  return Object.freeze({
    ...runtimeResult,
    boundedSchemaDiagnostic: candidate.boundedSchemaDiagnostic,
  });
}

function createTrackedV8LiveRuntime(input: {
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
        executorDurationEvidence = finishV8DurationEvidence({
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

function buildV8LiveRuntimeResult<ReasonCode extends string>(input: {
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
      : durationEvidenceFromV8Duration({
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
  const failure = classifyV8Failure(input.observation, trace, input.invocations, verifiedUsage);
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

function finishV8DurationEvidence(input: {
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

function durationEvidenceFromV8Duration(input: {
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

function classifyV8Failure<ReasonCode extends string>(
  observation: ModelCandidateObservation<ReasonCode>,
  trace: ModelAgentTrace | undefined,
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
