import { isModelAgentRunBudget, type ModelAgentTrace } from '@repo/ai';
import {
  PHASE_6_9_7_SR6_PRODUCT_REPLAY_MODEL,
  isPhase697Sr6ProductReplayTrace,
} from '@repo/agent/model-candidates';
import type { WrongQuestionOrganizerV9ModelCandidateEnvelope } from '@repo/agent/wrong-question-organizer-v9';
import type { AgentTraceCreateRequest } from '@repo/types/api/agent-trace';

import {
  WRONG_QUESTION_ORGANIZER_MODEL,
  WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION,
  WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET,
  estimateWrongQuestionOrganizerRequestCostCny,
  type WrongQuestionOrganizerModelConfig,
} from './wrong-question-organizer-model-config';

type CandidateObservation =
  WrongQuestionOrganizerV9ModelCandidateEnvelope['observation'];
type CandidateRuntimeAuthority = Exclude<
  WrongQuestionOrganizerModelConfig['runtimeAuthority'],
  'disabled'
>;

export type WrongQuestionOrganizerCandidateAdmission = Readonly<{
  usage: Readonly<{ inputTokens: number; outputTokens: number }>;
  estimatedCostCny: number;
  trace: ModelAgentTrace;
  runtimeAuthority: CandidateRuntimeAuthority;
}>;

export type WrongQuestionOrganizerCommandTraceOutcome =
  'applied' | 'authority' | 'stale' | 'aborted' | 'failed';

export function validateWrongQuestionOrganizerCandidateAdmission(
  observation: CandidateObservation,
  runtimeAuthority: WrongQuestionOrganizerModelConfig['runtimeAuthority'] = 'production_live',
): WrongQuestionOrganizerCandidateAdmission | null {
  try {
    if (
      !observation.attempted ||
      observation.disposition !== 'candidate_applied' ||
      !('trace' in observation)
    ) {
      return null;
    }
    const trace = observation.trace;
    const budget = observation.budget;
    const usage = observation.usage;
    if (
      !trace ||
      trace.task !== 'wrong_question_organization' ||
      trace.status !== 'succeeded' ||
      trace.degraded ||
      trace.maxOutputTokens !==
        WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET.maxOutputTokens ||
      !Number.isSafeInteger(trace.durationMs) ||
      trace.durationMs < 0 ||
      !isModelAgentRunBudget(budget) ||
      budget.maxCalls !== WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET.maxCalls ||
      budget.maxInputTokens !==
        WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET.maxInputTokens ||
      budget.maxOutputTokens !==
        WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET.maxOutputTokens ||
      budget.usedCalls !== 1 ||
      budget.usedInputTokens <= 0 ||
      budget.usedInputTokens > budget.maxInputTokens ||
      budget.usedOutputTokens !== budget.maxOutputTokens ||
      !positiveSafeInteger(usage.inputTokens) ||
      !positiveSafeInteger(usage.outputTokens) ||
      trace.inputTokens !== usage.inputTokens ||
      trace.outputTokens !== usage.outputTokens
    ) {
      return null;
    }
    const productionLive =
      runtimeAuthority === 'production_live' &&
      trace.mode === 'live' &&
      trace.provider === 'deepseek' &&
      trace.model === WRONG_QUESTION_ORGANIZER_MODEL;
    const sealedReplay =
      runtimeAuthority === 'sr5_sealed_replay' &&
      isPhase697Sr6ProductReplayTrace(trace, 'wrong_question_organization');
    if (!productionLive && !sealedReplay) return null;
    const estimatedCostCny = productionLive
      ? estimateWrongQuestionOrganizerRequestCostCny(usage)
      : 0;
    if (estimatedCostCny === null) return null;
    return Object.freeze({
      usage: Object.freeze({ ...usage }),
      estimatedCostCny,
      trace: Object.freeze({ ...trace }),
      runtimeAuthority,
    });
  } catch {
    return null;
  }
}

export function buildWrongQuestionOrganizerAdmissionTrace(input: {
  runId: string;
  snapshotFingerprint: string;
  targetCount: number;
  startedAt: Date;
  candidateFinishedAt: Date;
  admission: WrongQuestionOrganizerCandidateAdmission;
}): AgentTraceCreateRequest {
  const base = traceBase(input);
  return {
    ...base.run,
    finishedAt: input.candidateFinishedAt.toISOString(),
    totalDurationMs: elapsed(input.startedAt, input.candidateFinishedAt),
    steps: [
      ...base.steps,
      {
        node: 'wrong_question_organizer_command_pending',
        status: 'completed',
        startedAt: input.candidateFinishedAt.toISOString(),
        finishedAt: input.candidateFinishedAt.toISOString(),
        durationMs: 0,
        inputSummary: 'scope=model_free_command;permission=local_only',
        outputSummary: 'state=pending;admission=trace_persisted',
        errorMessage: null,
      },
    ],
  };
}

export function buildWrongQuestionOrganizerFinalTrace(input: {
  runId: string;
  snapshotFingerprint: string;
  targetCount: number;
  startedAt: Date;
  candidateFinishedAt: Date;
  finishedAt: Date;
  admission: WrongQuestionOrganizerCandidateAdmission;
  outcome: WrongQuestionOrganizerCommandTraceOutcome;
}): AgentTraceCreateRequest {
  const base = traceBase(input);
  const command = commandOutcome(input.outcome);
  return {
    ...base.run,
    status: command.status,
    degraded: command.status !== 'completed',
    finishedAt: input.finishedAt.toISOString(),
    totalDurationMs: elapsed(input.startedAt, input.finishedAt),
    steps: [
      ...base.steps,
      {
        node: 'wrong_question_organizer_command',
        status: command.status,
        startedAt: input.candidateFinishedAt.toISOString(),
        finishedAt: input.finishedAt.toISOString(),
        durationMs: elapsed(input.candidateFinishedAt, input.finishedAt),
        inputSummary: 'scope=model_free_command;permission=local_only',
        outputSummary: `state=${input.outcome};authority=local_command`,
        errorMessage: command.errorCode,
      },
    ],
  };
}

function traceBase(input: {
  runId: string;
  snapshotFingerprint: string;
  targetCount: number;
  startedAt: Date;
  candidateFinishedAt: Date;
  admission: WrongQuestionOrganizerCandidateAdmission;
}) {
  assertSafeTraceInput(input);
  const candidateDuration = normalizeDuration(input.admission.trace.durationMs);
  const candidateStartedAt = new Date(
    Math.max(
      input.startedAt.getTime(),
      input.candidateFinishedAt.getTime() - candidateDuration,
    ),
  );
  const usage = input.admission.usage;
  const run: Omit<AgentTraceCreateRequest, 'steps'> = {
    runId: input.runId,
    conversationId: null,
    route: 'wrong_question_organize',
    confidence: 1,
    status: 'completed',
    mode: input.admission.trace.mode,
    modelProvider: input.admission.trace.provider,
    modelName:
      input.admission.runtimeAuthority === 'sr5_sealed_replay'
        ? PHASE_6_9_7_SR6_PRODUCT_REPLAY_MODEL
        : WRONG_QUESTION_ORGANIZER_MODEL,
    inputTokenEstimate: usage.inputTokens,
    outputTokenEstimate: usage.outputTokens,
    maxOutputTokens: WRONG_QUESTION_ORGANIZER_REQUEST_BUDGET.maxOutputTokens,
    // AgentTrace.costEstimate is USD-denominated. This runtime has only an
    // independently verified CNY price, which remains in the bounded step.
    pricingKnown: false,
    costEstimate: 0,
    ragHitCount: 0,
    verifierStatus: 'skipped',
    verifierChunkCount: 0,
    degraded: false,
    inputHash: input.snapshotFingerprint,
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.candidateFinishedAt.toISOString(),
    totalDurationMs: elapsed(input.startedAt, input.candidateFinishedAt),
  };
  const steps: AgentTraceCreateRequest['steps'] = [
    {
      node: 'wrong_question_organizer_parent',
      status: 'completed',
      startedAt: input.startedAt.toISOString(),
      finishedAt: input.candidateFinishedAt.toISOString(),
      durationMs: elapsed(input.startedAt, input.candidateFinishedAt),
      inputSummary: `scope=owner_snapshot;items=${input.targetCount};budget=1_call_3500_800`,
      outputSummary: 'candidate=candidate_applied;command=local_authority',
      errorMessage: null,
    },
    {
      node: 'wrong_question_organizer_deterministic',
      status: 'completed',
      startedAt: input.startedAt.toISOString(),
      finishedAt: input.startedAt.toISOString(),
      durationMs: 0,
      inputSummary: 'scope=owner_snapshot;policy=deterministic',
      outputSummary: `items=${input.targetCount};fallback=ready`,
      errorMessage: null,
    },
    {
      node: 'wrong_question_organizer_candidate',
      status: 'completed',
      startedAt: candidateStartedAt.toISOString(),
      finishedAt: input.candidateFinishedAt.toISOString(),
      durationMs: candidateDuration,
      inputSummary: `scope=ordinal_projection;version=${WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION}`,
      outputSummary:
        input.admission.runtimeAuthority === 'sr5_sealed_replay'
          ? [
              'disposition=candidate_applied',
              `usage=${usage.inputTokens}/${usage.outputTokens}`,
              'pricing=not_applicable',
              'cost_cny=0.000000',
              'authority=sr5_sealed_replay',
            ].join(';')
          : [
              'disposition=candidate_applied',
              `usage=${usage.inputTokens}/${usage.outputTokens}`,
              'pricing=cny_known',
              `cost_cny=${input.admission.estimatedCostCny.toFixed(6)}`,
            ].join(';'),
      errorMessage: null,
    },
  ];
  return { run, steps };
}

function commandOutcome(outcome: WrongQuestionOrganizerCommandTraceOutcome): {
  status: 'completed' | 'degraded' | 'failed';
  errorCode: string | null;
} {
  if (outcome === 'applied' || outcome === 'authority') {
    return { status: 'completed', errorCode: null };
  }
  if (outcome === 'failed') {
    return { status: 'failed', errorCode: 'error_code=command_failed' };
  }
  return {
    status: 'degraded',
    errorCode: `error_code=command_${outcome}`,
  };
}

function assertSafeTraceInput(input: {
  runId: string;
  snapshotFingerprint: string;
  targetCount: number;
  startedAt: Date;
  candidateFinishedAt: Date;
}) {
  if (
    typeof input.runId !== 'string' ||
    !/^[a-z0-9_-]{1,96}$/i.test(input.runId) ||
    !/^sha256:[a-f0-9]{64}$/.test(input.snapshotFingerprint) ||
    !Number.isSafeInteger(input.targetCount) ||
    input.targetCount < 1 ||
    input.targetCount > 12 ||
    !validDate(input.startedAt) ||
    !validDate(input.candidateFinishedAt) ||
    input.candidateFinishedAt.getTime() < input.startedAt.getTime()
  ) {
    throw new Error('WRONG_QUESTION_ORGANIZER_TRACE_INPUT_INVALID');
  }
}

function elapsed(startedAt: Date, finishedAt: Date): number {
  return normalizeDuration(finishedAt.getTime() - startedAt.getTime());
}

function normalizeDuration(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function positiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}
