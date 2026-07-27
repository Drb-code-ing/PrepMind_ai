import { z } from 'zod';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  buildPhase697V6OrganizerModelOwnedDecision,
  buildPhase697V6OrganizerSemanticAxes,
  buildPhase697V6OrganizerSource,
  buildPhase697V6TutorModelOwnedDecision,
  buildPhase697V6TutorSemanticAxes,
  runPhase697V6ZeroCallCase,
} from './phase-6-9-tutor-wrong-question-v6-eval-case.ts';
import {
  createPhase697V6MonotonicClock,
  derivePhase697V6DurationEvidence,
  readPhase697V6MonotonicMs,
  type Phase697V6DurationEvidence,
  type Phase697V6MonotonicClock,
} from './phase-6-9-tutor-wrong-question-v6-deadline.ts';
import { PHASE_6_9_7_V6_EVAL_POLICY } from './phase-6-9-tutor-wrong-question-v6-policy.ts';
import type {
  Phase697V6Harness,
  Phase697V6RuntimeResult,
} from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import type { ModelCandidateObservation } from '../model-candidates/model-candidate-policy.ts';
import { runTutorV6ModelCandidate } from '../model-candidates/tutor-v6-model-candidate.ts';
import type { TutorV6ModelDecision } from '../model-candidates/tutor-v6-model-contract.ts';
import { TUTOR_V6_MODEL_PROJECTION_VERSION } from '../model-candidates/tutor-v6-model-projection.ts';
import { runWrongQuestionOrganizerV6ModelCandidate } from '../model-candidates/wrong-question-organizer-v6-model-candidate.ts';
import type { WrongQuestionOrganizerV6ModelDecision } from '../model-candidates/wrong-question-organizer-v6-model-contract.ts';
import { WRONG_QUESTION_ORGANIZER_V6_MODEL_PROJECTION_VERSION } from '../model-candidates/wrong-question-organizer-v6-model-projection.ts';
import {
  deriveWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
} from '../model-candidates/wrong-question-organizer-v5-shortlist.ts';
import { buildTutorStrategy } from '../nodes/tutor.ts';
import { TUTOR_BOUNDED_INTENTS } from '../policies/tutor-strategy-policy.ts';

const TUTOR_MAX_INPUT_TOKENS = 1_200 as const;
const TUTOR_MAX_OUTPUT_TOKENS = 300 as const;
const ORGANIZER_MAX_INPUT_TOKENS = 3_500 as const;
const ORGANIZER_MAX_OUTPUT_TOKENS = 800 as const;

const SAFE_RESULT = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
});

const TUTOR_PROMPT_SCHEMA = z
  .object({
    version: z.literal(TUTOR_V6_MODEL_PROJECTION_VERSION),
    latestText: z.string(),
    activeContext: z
      .object({
        available: z.boolean(),
        excerpt: z.string().optional(),
      })
      .strict(),
    authorityBinding: z
      .object({
        localSignalAuthoritySha256: z.string().regex(/^[a-f0-9]{64}$/),
        localStrategyAuthoritySha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    eligibleIntents: z
      .array(
        z
          .object({
            intentIndex: z.number().int().min(0).max(4),
            intent: z.enum(TUTOR_BOUNDED_INTENTS),
          })
          .strict(),
      )
      .min(1)
      .max(5),
  })
  .strict();

const ORGANIZER_PROMPT_SCHEMA = z
  .object({
    version: z.literal(WRONG_QUESTION_ORGANIZER_V6_MODEL_PROJECTION_VERSION),
    shortlistFingerprint: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    questions: z
      .array(
        z
          .object({
            questionIndex: z.number().int().min(0).max(11),
            subjectAuthority: z.discriminatedUnion('mode', [
              z.object({ mode: z.literal('keep_local'), subject: z.string() }).strict(),
              z
                .object({
                  mode: z.literal('select_subject'),
                  candidates: z
                    .array(
                      z
                        .object({
                          subjectIndex: z.number().int().min(0).max(5),
                          subject: z.string(),
                        })
                        .strict(),
                    )
                    .min(1)
                    .max(6),
                })
                .strict(),
            ]),
            eligibleDeckActions: z
              .array(z.enum(['reuse_existing', 'create_topic']))
              .min(1)
              .max(2),
            topicCandidates: z
              .array(
                z
                  .object({
                    topicIndex: z.number().int().min(0).max(7),
                    label: z.string(),
                    subject: z.string(),
                    source: z.string(),
                  })
                  .strict(),
              )
              .max(8),
            fields: z.record(z.unknown()),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    decks: z
      .array(
        z
          .object({
            deckIndex: z.number().int().min(0).max(19),
            subject: z.string(),
            name: z.string(),
            nameLocked: z.boolean(),
            keywords: z.array(z.string()),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export type Phase697V6MockRequestAudit = Readonly<{
  agent: 'tutor' | 'wrong_question_organizer';
  caseId: string;
  task: ModelAgentRequest<unknown>['task'];
  systemPrompt: string;
  userPrompt: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
}>;

export type Phase697TutorOrganizerV6MockHarnessInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  onRequest?: (request: Phase697V6MockRequestAudit) => void;
}>;

/**
 * Reviewed, zero-network V6 Mock factory.
 *
 * Every runtime case crosses the real V6 projection, candidate, strict dynamic
 * validator, and local authority merger. Frozen expectations are consulted only
 * by the eval-only responder after the actual request exists, and only to choose
 * an ordinal already exposed by that request. Case ids and oracle fields never
 * enter either candidate prompt.
 */
export function createPhase697TutorOrganizerV6MockHarness(
  input: Phase697TutorOrganizerV6MockHarnessInput,
): Readonly<Phase697V6Harness> {
  return Object.freeze({
    runId: input.runId,
    runScope: input.runScope,
    mode: 'mock',
    provider: 'mock',
    model: 'mock',
    structuredOutputMode: 'mock_json_v6',
    executorProvenance: 'mock_synthetic',
    runZeroCall: async (entry) => runPhase697V6ZeroCallCase(entry),
    runTutor: (entry, signal) => runTutorMock(entry, signal, input.runId, input.onRequest),
    runOrganizer: (entry, signal) => runOrganizerMock(entry, signal, input.runId, input.onRequest),
  });
}

async function runTutorMock(
  entry: Phase697V2TutorRuntimeCase,
  signal: AbortSignal,
  runId: string,
  onRequest: Phase697TutorOrganizerV6MockHarnessInput['onRequest'],
): Promise<Phase697V6RuntimeResult> {
  const clock = createPhase697V6MonotonicClock();
  const startedAt = readPhase697V6MonotonicMs(clock);
  const tracked = createTrackedMockRuntime({
    agent: 'tutor',
    caseId: entry.id,
    timeoutMs: PHASE_6_9_7_V6_EVAL_POLICY.deadlineMs.tutorExecutorHardTimeout,
    maxOutputTokens: TUTOR_MAX_OUTPUT_TOKENS,
    clock,
    buildOutput: (request) => tutorDecisionFromRequest(entry, request),
    onRequest,
  });
  const candidate = await runTutorV6ModelCandidate({
    runId: runId + ':mock:tutor:' + entry.pairedRunIndex,
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
  return buildMockRuntimeResult({
    observation: candidate.observation,
    invocations: tracked.invocations(),
    executorDurationEvidence: tracked.executorDurationEvidence(),
    candidateOrchestrationEvidence: finishDurationEvidence({
      stage: 'candidate_orchestration',
      startedAt,
      finishedAt: readPhase697V6MonotonicMs(clock),
      deadlineMs: PHASE_6_9_7_V6_EVAL_POLICY.latency.tutorOrchestrationP95Max,
    }),
    hardDeadlineMs: PHASE_6_9_7_V6_EVAL_POLICY.deadlineMs.tutorExecutorHardTimeout,
    maxInputTokens: TUTOR_MAX_INPUT_TOKENS,
    maxOutputTokens: TUTOR_MAX_OUTPUT_TOKENS,
    syntheticOutputTokens: tracked.syntheticOutputTokens(),
    semanticAxes: buildPhase697V6TutorSemanticAxes(entry, candidate.result),
    modelOwnedDecision: buildPhase697V6TutorModelOwnedDecision(candidate.result),
  });
}

async function runOrganizerMock(
  entry: Phase697V2OrganizerRuntimeCase,
  signal: AbortSignal,
  runId: string,
  onRequest: Phase697TutorOrganizerV6MockHarnessInput['onRequest'],
): Promise<Phase697V6RuntimeResult> {
  const clock = createPhase697V6MonotonicClock();
  const startedAt = readPhase697V6MonotonicMs(clock);
  const source = buildPhase697V6OrganizerSource(entry);
  const derived = deriveWrongQuestionOrganizerV5Shortlist(source);
  if (!derived.ok) throw new Error('V6_MOCK_SHORTLIST_' + derived.reasonCode);
  const tracked = createTrackedMockRuntime({
    agent: 'wrong_question_organizer',
    caseId: entry.id,
    timeoutMs: PHASE_6_9_7_V6_EVAL_POLICY.deadlineMs.organizerExecutorHardTimeout,
    maxOutputTokens: ORGANIZER_MAX_OUTPUT_TOKENS,
    clock,
    buildOutput: (request) => organizerDecisionFromRequest(entry, derived.value, request),
    onRequest,
  });
  const candidate = await runWrongQuestionOrganizerV6ModelCandidate({
    runId: runId + ':mock:organizer:' + entry.pairedRunIndex,
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
  return buildMockRuntimeResult({
    observation: candidate.observation,
    invocations: tracked.invocations(),
    executorDurationEvidence: tracked.executorDurationEvidence(),
    candidateOrchestrationEvidence: finishDurationEvidence({
      stage: 'candidate_orchestration',
      startedAt,
      finishedAt: readPhase697V6MonotonicMs(clock),
      deadlineMs: PHASE_6_9_7_V6_EVAL_POLICY.latency.organizerCandidateP95Max,
    }),
    hardDeadlineMs: PHASE_6_9_7_V6_EVAL_POLICY.deadlineMs.organizerExecutorHardTimeout,
    maxInputTokens: ORGANIZER_MAX_INPUT_TOKENS,
    maxOutputTokens: ORGANIZER_MAX_OUTPUT_TOKENS,
    syntheticOutputTokens: tracked.syntheticOutputTokens(),
    semanticAxes: {
      agent: 'wrong_question_organizer',
      decisionUnits: entry.expected.decisions.length,
      ...buildPhase697V6OrganizerSemanticAxes(entry, candidate.result),
    },
    modelOwnedDecision: buildPhase697V6OrganizerModelOwnedDecision(entry, candidate.result, source),
  });
}

function createTrackedMockRuntime(
  input: Readonly<{
    agent: Phase697V6MockRequestAudit['agent'];
    caseId: string;
    timeoutMs: number;
    maxOutputTokens: number;
    clock: Phase697V6MonotonicClock;
    buildOutput: (request: ModelAgentRequest<unknown>) => unknown;
    onRequest: Phase697TutorOrganizerV6MockHarnessInput['onRequest'];
  }>,
) {
  let invocations = 0;
  let currentOutput: unknown = null;
  let syntheticOutputTokens = 0;
  let executorDurationEvidence: Phase697V6DurationEvidence | null = null;
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: 'mock',
    liveCallsEnabled: false,
    timeoutMs: input.timeoutMs,
    mockResponder: () => currentOutput,
    now: () => Math.floor(input.clock()),
  });
  const runtime: Pick<ModelAgentRuntime, 'invokeStructured'> = Object.freeze({
    async invokeStructured<T>(request: ModelAgentRequest<T>) {
      invocations += 1;
      input.onRequest?.(
        Object.freeze({
          agent: input.agent,
          caseId: input.caseId,
          task: request.task,
          systemPrompt: request.systemPrompt,
          userPrompt: request.userPrompt,
          estimatedInputTokens: request.estimatedInputTokens,
          maxOutputTokens: request.maxOutputTokens,
        }),
      );
      const startedAt = readPhase697V6MonotonicMs(input.clock);
      try {
        currentOutput = input.buildOutput(request);
        syntheticOutputTokens = estimateSyntheticOutputTokens(currentOutput, input.maxOutputTokens);
        return await inner.invokeStructured(request);
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
    syntheticOutputTokens: () => syntheticOutputTokens,
    executorDurationEvidence: () => executorDurationEvidence,
  });
}

function tutorDecisionFromRequest(
  entry: Phase697V2TutorRuntimeCase,
  request: ModelAgentRequest<unknown>,
): TutorV6ModelDecision {
  if (request.task !== 'tutor_strategy') throw new Error('V6_MOCK_TUTOR_TASK_INVALID');
  const projection = TUTOR_PROMPT_SCHEMA.parse(JSON.parse(request.userPrompt));
  const selected = projection.eligibleIntents.find(
    (candidate) => candidate.intent === entry.expected.intent,
  );
  if (!selected) throw new Error('V6_MOCK_TUTOR_INTENT_ORDINAL_UNAVAILABLE');
  return Object.freeze({ intentIndex: selected.intentIndex });
}

function organizerDecisionFromRequest(
  entry: Phase697V2OrganizerRuntimeCase,
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
  request: ModelAgentRequest<unknown>,
): WrongQuestionOrganizerV6ModelDecision {
  if (request.task !== 'wrong_question_organization') {
    throw new Error('V6_MOCK_ORGANIZER_TASK_INVALID');
  }
  const projection = ORGANIZER_PROMPT_SCHEMA.parse(JSON.parse(request.userPrompt));
  if (
    projection.shortlistFingerprint !== authority.shortlistFingerprint ||
    projection.questions.length !== authority.questions.length
  ) {
    throw new Error('V6_MOCK_ORGANIZER_AUTHORITY_MISMATCH');
  }
  const expectedByQuestionIndex = new Map(
    entry.expected.decisions.map((expected) => [expected.questionIndex, expected] as const),
  );
  const decisions = projection.questions.map((question) => {
    const expected = expectedByQuestionIndex.get(question.questionIndex);
    const authorityQuestion = authority.questions[question.questionIndex];
    if (!expected || !authorityQuestion) {
      throw new Error('V6_MOCK_EXPECTED_DECISION_UNAVAILABLE');
    }
    const subjectDecision = (() => {
      if (question.subjectAuthority.mode === 'keep_local') {
        if (question.subjectAuthority.subject !== expected.subject) {
          throw new Error('V6_MOCK_LOCAL_SUBJECT_MISMATCH');
        }
        return { action: 'keep_local' as const };
      }
      const selected = question.subjectAuthority.candidates.find(
        (candidate) => candidate.subject === expected.subject,
      );
      if (!selected) throw new Error('V6_MOCK_SUBJECT_ORDINAL_UNAVAILABLE');
      return { action: 'select_subject' as const, subjectIndex: selected.subjectIndex };
    })();
    const deckDecision = (() => {
      if (expected.deckAction === 'reuse_existing') {
        const expectedDeck =
          expected.deckIndex === undefined
            ? undefined
            : entry.input.existingDecks[expected.deckIndex];
        const selected = expectedDeck
          ? authority.decks.find(
              (deck) =>
                deck.deckId === expectedDeck.id || deck.foldedDeckIds.includes(expectedDeck.id),
            )
          : undefined;
        if (
          !selected ||
          !projection.decks.some(
            (deck) => deck.deckIndex === selected.deckIndex && deck.subject === expected.subject,
          )
        ) {
          throw new Error('V6_MOCK_DECK_ORDINAL_UNAVAILABLE');
        }
        return { action: 'reuse_existing' as const, deckIndex: selected.deckIndex };
      }
      const selected = question.topicCandidates.find(
        (topic) =>
          topic.subject === expected.subject && expected.acceptedTopicLabels.includes(topic.label),
      );
      if (!selected) throw new Error('V6_MOCK_TOPIC_ORDINAL_UNAVAILABLE');
      return { action: 'create_topic' as const, topicIndex: selected.topicIndex };
    })();
    return Object.freeze({
      questionIndex: question.questionIndex,
      subjectDecision,
      deckDecision,
    });
  });
  return Object.freeze({
    shortlistFingerprint: projection.shortlistFingerprint,
    decisions,
  });
}

function buildMockRuntimeResult<ReasonCode extends string>(
  input: Readonly<{
    observation: ModelCandidateObservation<ReasonCode>;
    invocations: number;
    executorDurationEvidence: Phase697V6DurationEvidence | null;
    candidateOrchestrationEvidence: Phase697V6DurationEvidence | null;
    hardDeadlineMs: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    syntheticOutputTokens: number;
    semanticAxes: NonNullable<Phase697V6RuntimeResult['semanticAxes']>;
    modelOwnedDecision: NonNullable<Phase697V6RuntimeResult['modelOwnedDecision']> | null;
  }>,
): Phase697V6RuntimeResult {
  const trace =
    input.observation.attempted && 'trace' in input.observation
      ? input.observation.trace
      : undefined;
  const usage = input.observation.usage;
  const verifiedUsage =
    Number.isSafeInteger(usage.inputTokens) &&
    usage.inputTokens > 0 &&
    usage.inputTokens <= input.maxInputTokens &&
    Number.isSafeInteger(input.syntheticOutputTokens) &&
    input.syntheticOutputTokens > 0 &&
    input.syntheticOutputTokens <= input.maxOutputTokens;
  const traceIdentityValid =
    trace !== undefined &&
    trace.mode === 'mock' &&
    trace.provider === 'mock' &&
    trace.model === 'mock' &&
    trace.status === 'succeeded';
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
    verifiedUsage &&
    durationContractValid &&
    input.modelOwnedDecision !== null;
  return Object.freeze({
    ...SAFE_RESULT,
    runtimeInvocations: input.invocations,
    candidateDisposition: input.observation.disposition,
    failureCategory: success ? 'none' : 'dynamic_contract',
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: success,
    semanticAxes: success ? input.semanticAxes : null,
    modelOwnedDecision: success ? input.modelOwnedDecision : null,
    durationEvidence,
    usage: success
      ? Object.freeze({
          inputTokens: usage.inputTokens,
          outputTokens: input.syntheticOutputTokens,
          estimatedCostCny: 0,
        })
      : null,
    usageDisposition: success ? 'verified' : 'unknown_after_attempt',
  });
}

function finishDurationEvidence(
  input: Readonly<{
    stage: Phase697V6DurationEvidence['stage'];
    startedAt: ReturnType<typeof readPhase697V6MonotonicMs>;
    finishedAt: ReturnType<typeof readPhase697V6MonotonicMs>;
    deadlineMs: number;
  }>,
): Phase697V6DurationEvidence | null {
  if (!input.startedAt.ok || !input.finishedAt.ok) return null;
  const evidence = derivePhase697V6DurationEvidence({
    stage: input.stage,
    startedMs: input.startedAt.value,
    finishedMs: input.finishedAt.value,
    deadlineMs: input.deadlineMs,
  });
  return evidence.ok ? evidence.value : null;
}

function durationEvidenceFromDuration(
  input: Readonly<{
    stage: Phase697V6DurationEvidence['stage'];
    durationMs: number;
    deadlineMs: number;
  }>,
): Phase697V6DurationEvidence | null {
  const evidence = derivePhase697V6DurationEvidence({
    stage: input.stage,
    startedMs: 0,
    finishedMs: input.durationMs,
    deadlineMs: input.deadlineMs,
  });
  return evidence.ok ? evidence.value : null;
}

function estimateSyntheticOutputTokens(output: unknown, maxOutputTokens: number) {
  const serialized = JSON.stringify(output);
  const estimated = Math.max(1, Math.ceil(serialized.length / 4));
  if (estimated > maxOutputTokens) throw new Error('V6_MOCK_OUTPUT_BUDGET_EXCEEDED');
  return estimated;
}
