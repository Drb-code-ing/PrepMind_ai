import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentProviderFailureCategory,
  type ModelAgentStructuredOutputStage,
  type ModelAgentTrace,
  type StructuredModelExecutor,
} from '@repo/ai';

import type { Phase697V2OrganizerRuntimeCase } from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  buildPhase697V6OrganizerModelOwnedDecision,
  buildPhase697V6OrganizerSemanticAxes,
  buildPhase697V6OrganizerSource,
} from './phase-6-9-tutor-wrong-question-v6-eval-case.ts';
import {
  createPhase697V6MonotonicClock,
  derivePhase697V6DurationEvidence,
  readPhase697V6MonotonicMs,
  type Phase697V6DurationStage,
  type Phase697V6MonotonicClock,
} from './phase-6-9-tutor-wrong-question-v6-deadline.ts';
import { PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS } from './phase-6-9-tutor-wrong-question-v6-live.ts';
import { PHASE_6_9_7_V6_EVAL_POLICY } from './phase-6-9-tutor-wrong-question-v6-policy.ts';
import type { Phase697V6RuntimeResult } from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import type { Phase697V9OrganizerRuntimeResult } from './run-phase-6-9-tutor-wrong-question-v9-paired.ts';
import type { ModelCandidateObservation } from '../model-candidates/model-candidate-policy.ts';
import type { WrongQuestionOrganizerV6CandidateResult } from '../model-candidates/wrong-question-organizer-v6-model-candidate.ts';
import { runWrongQuestionOrganizerV9ModelCandidate } from '../model-candidates/wrong-question-organizer-v9-model-candidate.ts';

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

/**
 * Shared V9 evaluation composition. It executes the production V9 Organizer
 * candidate and its V6 authority merger against an injected structured executor.
 * R4 supplies only a synthetic first-party-adapter fetch; R5 may later supply the
 * separately authorized provider executor without changing semantic scoring.
 */
export async function runPhase697V9OrganizerRuntimeCase(
  entry: Phase697V2OrganizerRuntimeCase,
  signal: AbortSignal,
  runId: string,
  executor: StructuredModelExecutor,
  timeoutMs = PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
): Promise<Phase697V9OrganizerRuntimeResult> {
  const clock = createPhase697V6MonotonicClock();
  const startedAt = readPhase697V6MonotonicMs(clock);
  const source = buildPhase697V6OrganizerSource(entry);
  const tracked = createTrackedV9Runtime({ executor, timeoutMs, clock });
  const candidate = await runWrongQuestionOrganizerV9ModelCandidate({
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
  const runtimeResult = buildV9RuntimeResult({
    observation: candidate.observation,
    invocations: tracked.invocations(),
    executorDurationEvidence: tracked.executorDurationEvidence(),
    candidateOrchestrationEvidence: finishV9DurationEvidence({
      stage: 'candidate_orchestration',
      startedAt,
      finishedAt: readPhase697V6MonotonicMs(clock),
      deadlineMs: PHASE_6_9_7_V6_EVAL_POLICY.latency.organizerCandidateP95Max,
    }),
    hardDeadlineMs: timeoutMs,
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

function createTrackedV9Runtime(input: {
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
        executorDurationEvidence = finishV9DurationEvidence({
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

function buildV9RuntimeResult<ReasonCode extends string>(input: {
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
      : durationEvidenceFromV9Duration({
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
  const failure = classifyV9Failure(input.observation, trace, input.invocations, verifiedUsage);
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

function finishV9DurationEvidence(input: {
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

function durationEvidenceFromV9Duration(input: {
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

function classifyV9Failure<ReasonCode extends string>(
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
