import { createHash } from 'node:crypto';

import {
  createModelAgentBudget,
  createModelAgentRuntime,
  type ModelAgentRequest,
  type ModelAgentRuntime,
} from '@repo/ai';

import {
  type Phase697V2OrganizerRuntimeCase,
  type Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  type Phase697V5Harness,
  type Phase697V5RuntimeResult,
  type Phase697V5ZeroCallResult,
} from './run-phase-6-9-tutor-wrong-question-v5-paired.ts';
import { type ModelCandidateDisposition } from '../model-candidates/model-candidate-policy.ts';
import {
  deriveTutorV5LocalSignalAuthority,
  type TutorV5LocalSignalAuthority,
} from '../model-candidates/tutor-v5-local-signal-authority.ts';
import { runTutorV5ModelCandidate } from '../model-candidates/tutor-v5-model-candidate.ts';
import { type TutorV5ModelDecision } from '../model-candidates/tutor-v5-model-contract.ts';
import {
  runWrongQuestionOrganizerV5ModelCandidate,
  type WrongQuestionOrganizerV5CandidateResult,
} from '../model-candidates/wrong-question-organizer-v5-model-candidate.ts';
import {
  deriveWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistAuthority,
  type WrongQuestionOrganizerV5ShortlistSource,
} from '../model-candidates/wrong-question-organizer-v5-shortlist.ts';
import { buildTutorStrategy } from '../nodes/tutor.ts';

const SAFE_RESULT = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
});

export type Phase697V5MockRequestAudit = Readonly<{
  agent: 'tutor' | 'wrong_question_organizer';
  caseId: string;
  task: ModelAgentRequest<unknown>['task'];
  systemPrompt: string;
  userPrompt: string;
  estimatedInputTokens: number;
  maxOutputTokens: number;
}>;

export type Phase697TutorOrganizerV5MockHarnessInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  onRequest?: (request: Phase697V5MockRequestAudit) => void;
}>;

/**
 * Reviewed, zero-network V5 Mock factory.
 *
 * Runtime cases exercise the real V5 projection, candidate, strict validator,
 * and local merger. Frozen expected values are used only after request shaping:
 * Tutor derives its choice from local signal authority, while Organizer uses the
 * expected decision solely inside the eval-only responder to select already
 * projected local ordinals. No expected object or case identifier enters a
 * candidate request.
 */
export function createPhase697TutorOrganizerV5MockHarness(
  input: Phase697TutorOrganizerV5MockHarnessInput,
): Readonly<Phase697V5Harness> {
  return Object.freeze({
    runId: input.runId,
    runScope: input.runScope,
    mode: 'mock',
    provider: 'mock',
    model: 'mock',
    structuredOutputMode: 'mock_json_v5',
    executorProvenance: 'mock_synthetic',
    runZeroCall: async (entry) => runZeroCall(entry),
    runTutor: (entry, signal) => runTutorMock(entry, signal, input.onRequest),
    runOrganizer: (entry, signal) => runOrganizerMock(entry, signal, input.onRequest),
  });
}

async function runTutorMock(
  entry: Phase697V2TutorRuntimeCase,
  signal: AbortSignal,
  onRequest: Phase697TutorOrganizerV5MockHarnessInput['onRequest'],
): Promise<Phase697V5RuntimeResult> {
  const authority = tutorAuthority(entry);
  const decision = tutorDecision(authority);
  const tracked = createTrackedMockRuntime({
    agent: 'tutor',
    caseId: entry.id,
    output: decision,
    onRequest,
  });
  const candidate = await runTutorV5ModelCandidate({
    runId: `phase-6-9-7-v5-mock-tutor-${entry.pairedRunIndex}`,
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
    budget: createModelAgentBudget({ maxCalls: 1, maxInputTokens: 1_200, maxOutputTokens: 300 }),
    signal,
  });
  const success =
    tracked.invocations() === 1 &&
    candidate.observation.disposition === 'candidate_applied' &&
    candidate.observation.attempted &&
    'trace' in candidate.observation;
  const expected = entry.expected;
  const actual = candidate.result;
  return runtimeResult({
    candidateDisposition: candidate.observation.disposition,
    success,
    invocations: tracked.invocations(),
    latencyMs: 180 + entry.pairedRunIndex * 3,
    orchestrationLatencyMs: 210 + entry.pairedRunIndex * 3,
    usage: success ? candidate.observation.usage : null,
    semanticAxes: {
      agent: 'tutor',
      intent: actual.intent === expected.intent,
      depth: actual.depth === expected.depth,
      contextUse: actual.shouldUseActiveStudyContext === expected.contextUse,
      guidingPolicy: actual.shouldAskGuidingQuestion === expected.guidingQuestion,
      finalAnswerBoundary: actual.shouldGiveFinalAnswer === expected.finalAnswer,
      answerStructure: sameValues(actual.answerStructure, expected.answerStructure),
    },
  });
}

async function runOrganizerMock(
  entry: Phase697V2OrganizerRuntimeCase,
  signal: AbortSignal,
  onRequest: Phase697TutorOrganizerV5MockHarnessInput['onRequest'],
): Promise<Phase697V5RuntimeResult> {
  const source = organizerSource(entry);
  const derived = deriveWrongQuestionOrganizerV5Shortlist(source);
  if (!derived.ok) throw new Error(`V5_MOCK_SHORTLIST_${derived.reasonCode}`);
  const decision = organizerDecision(entry, derived.value);
  const tracked = createTrackedMockRuntime({
    agent: 'wrong_question_organizer',
    caseId: entry.id,
    output: decision,
    onRequest,
  });
  const candidate = await runWrongQuestionOrganizerV5ModelCandidate({
    runId: `phase-6-9-7-v5-mock-organizer-${entry.pairedRunIndex}`,
    shortlistSource: source,
    runtime: tracked.runtime,
    budget: createModelAgentBudget({ maxCalls: 1, maxInputTokens: 3_500, maxOutputTokens: 800 }),
    revalidateSource: () => source,
    signal,
  });
  const success =
    tracked.invocations() === 1 &&
    candidate.observation.disposition === 'candidate_applied' &&
    candidate.observation.attempted &&
    'trace' in candidate.observation;
  const axes = organizerAxes(entry, candidate.result);
  return runtimeResult({
    candidateDisposition: candidate.observation.disposition,
    success,
    invocations: tracked.invocations(),
    latencyMs: 240 + entry.pairedRunIndex * 4,
    orchestrationLatencyMs: 260 + entry.pairedRunIndex * 4,
    usage: success ? candidate.observation.usage : null,
    semanticAxes: {
      agent: 'wrong_question_organizer',
      decisionUnits: entry.expected.decisions.length,
      ...axes,
    },
  });
}

function createTrackedMockRuntime(
  input: Readonly<{
    agent: Phase697V5MockRequestAudit['agent'];
    caseId: string;
    output: unknown;
    onRequest: Phase697TutorOrganizerV5MockHarnessInput['onRequest'];
  }>,
) {
  let invocations = 0;
  let clock = 1_000;
  const inner = createModelAgentRuntime({
    mode: 'mock',
    provider: 'mock',
    model: `phase-6-9-7-v5-r5-${input.agent === 'tutor' ? 'tutor' : 'organizer'}-mock`,
    liveCallsEnabled: false,
    timeoutMs: 500,
    mockResponder: () => input.output,
    now: () => ++clock,
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
      return inner.invokeStructured(request);
    },
  });
  return Object.freeze({ runtime, invocations: () => invocations });
}

function tutorAuthority(entry: Phase697V2TutorRuntimeCase): TutorV5LocalSignalAuthority {
  const authority = deriveTutorV5LocalSignalAuthority({
    latestUserText: entry.input.latestUserText,
    activeStudyContext: entry.input.activeStudyContext,
    safety: { latestUserText: 'safe_for_model', activeStudyContext: 'safe_for_model' },
  });
  if (!authority.ok || authority.value.eligibleChoices.length === 0) {
    throw new Error('V5_MOCK_TUTOR_AUTHORITY_UNAVAILABLE');
  }
  return authority.value;
}

function tutorDecision(authority: TutorV5LocalSignalAuthority): TutorV5ModelDecision {
  const choice = authority.eligibleChoices[0];
  if (!choice) throw new Error('V5_MOCK_TUTOR_CHOICE_UNAVAILABLE');
  const depth =
    choice.intent === 'explain_solution' && choice.depths.includes('deep')
      ? 'deep'
      : choice.depths.includes('standard')
        ? 'standard'
        : choice.depths[0];
  if (!depth) throw new Error('V5_MOCK_TUTOR_DEPTH_UNAVAILABLE');
  return Object.freeze({
    intent: choice.intent,
    depth,
    confidence: authority.confidence,
  });
}

function organizerSource(
  entry: Phase697V2OrganizerRuntimeCase,
): WrongQuestionOrganizerV5ShortlistSource {
  return Object.freeze({
    ownerDomain: `hmac-sha256:${'f'.repeat(64)}`,
    ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
    ownerSnapshotFingerprint: `sha256:${createHash('sha256').update(entry.id).digest('hex')}`,
    safety: 'safe_for_model',
    questions: entry.input.questions.map((question) => ({
      id: question.id,
      subject: question.subject,
      category: question.category,
      knowledgePoints: question.knowledgePoints,
      errorType: question.errorType,
      questionText: question.questionText,
      analysis: question.analysis,
      status: 'UNRESOLVED',
      updatedAt: '2026-07-26T08:00:00.000Z',
    })),
    decks: entry.input.existingDecks.map((deck) => ({
      id: deck.id,
      subject: deck.subjectKey,
      name: deck.name,
      nameLocked: deck.nameLocked,
      keywords: deck.keywords,
      updatedAt: '2026-07-26T08:00:00.000Z',
    })),
  });
}

function organizerDecision(
  entry: Phase697V2OrganizerRuntimeCase,
  authority: WrongQuestionOrganizerV5ShortlistAuthority,
) {
  const expectedByQuestionId = new Map(
    entry.expected.decisions.map((expected) => {
      const question = entry.input.questions[expected.questionIndex];
      if (!question) throw new Error('V5_MOCK_EXPECTED_QUESTION_UNAVAILABLE');
      return [question.id, expected] as const;
    }),
  );
  return Object.freeze({
    shortlistFingerprint: authority.shortlistFingerprint,
    decisions: authority.questions.map((question) => {
      const expected = expectedByQuestionId.get(question.questionId);
      if (!expected) throw new Error('V5_MOCK_EXPECTED_DECISION_UNAVAILABLE');
      const subject = expected.subject;
      const subjectIndex = question.subjectCandidates.indexOf(subject);
      const expectedDeck =
        expected.deckIndex === undefined
          ? undefined
          : entry.input.existingDecks[expected.deckIndex];
      const deck =
        expected.deckAction === 'reuse_existing' && expectedDeck
          ? authority.decks.find(
              (candidate) =>
                candidate.deckId === expectedDeck.id ||
                candidate.foldedDeckIds.includes(expectedDeck.id),
            )
          : undefined;
      const topic = question.topicCandidates.find(
        (candidate) =>
          candidate.subject === subject && expected.acceptedTopicLabels.includes(candidate.label),
      );
      if (question.structuredSubject === null && subjectIndex < 0) {
        throw new Error('V5_MOCK_SUBJECT_ORDINAL_UNAVAILABLE');
      }
      if (expected.deckAction === 'reuse_existing' ? !deck : !topic) {
        throw new Error('V5_MOCK_DECK_ORDINAL_UNAVAILABLE');
      }
      return Object.freeze({
        questionIndex: question.questionIndex,
        subjectDecision:
          question.structuredSubject === null
            ? ({ action: 'select_subject', subjectIndex } as const)
            : ({ action: 'keep_local' } as const),
        deckDecision:
          expected.deckAction === 'reuse_existing'
            ? ({ action: 'reuse_existing', deckIndex: deck!.deckIndex } as const)
            : ({ action: 'create_topic', topicIndex: topic!.topicIndex } as const),
        confidence: expected.confidence,
      });
    }),
  });
}

function organizerAxes(
  entry: Phase697V2OrganizerRuntimeCase,
  actual: WrongQuestionOrganizerV5CandidateResult,
) {
  const suggestions = new Map(
    actual.suggestions.map((suggestion) => [suggestion.questionId, suggestion]),
  );
  let subject = true;
  let deck = true;
  let topic = true;
  let confidence = true;
  for (const expected of entry.expected.decisions) {
    const question = entry.input.questions[expected.questionIndex];
    const suggestion = question ? suggestions.get(question.id) : undefined;
    if (!suggestion || suggestion.selection.source !== 'model_ordinal') {
      subject = deck = topic = confidence = false;
      continue;
    }
    subject &&= suggestion.selection.resolvedSubject === expected.subject;
    deck &&= suggestion.selection.deckDecision.action === expected.deckAction;
    confidence &&= suggestion.selection.confidence === expected.confidence;
    if (expected.deckAction === 'reuse_existing') {
      const expectedDeck =
        expected.deckIndex === undefined
          ? undefined
          : entry.input.existingDecks[expected.deckIndex];
      topic &&=
        suggestion.selection.deckDecision.action === 'reuse_existing' &&
        expectedDeck !== undefined &&
        suggestion.selection.deckDecision.deckId === expectedDeck.id;
    } else {
      topic &&=
        suggestion.selection.deckDecision.action === 'create_topic' &&
        expected.acceptedTopicLabels.includes(suggestion.selection.deckDecision.topicLabel);
    }
  }
  return Object.freeze({ subject, deck, topic, confidence });
}

function runZeroCall(
  entry: Parameters<Phase697V5Harness['runZeroCall']>[0],
): Phase697V5ZeroCallResult {
  const verified = verifyZeroCallGuard(entry);
  return Object.freeze({
    ...SAFE_RESULT,
    runtimeInvocations: 0,
    candidateDisposition: zeroCallDisposition(entry),
    zeroCallVerified: verified,
    failureCategory: 'local_guard',
  });
}

function verifyZeroCallGuard(entry: Parameters<Phase697V5Harness['runZeroCall']>[0]) {
  if (entry.agent === 'tutor') {
    const reason = entry.expected.zeroCallReason;
    switch (reason) {
      case 'route_not_tutor':
        return entry.input.finalRoute !== 'tutor';
      case 'explicit_answer_direct': {
        const authority = deriveTutorZeroCallAuthority(entry);
        return authority?.reasonCode === 'answer_direct_local_only';
      }
      case 'explicit_socratic_hint':
      case 'explicit_step_check':
      case 'explicit_concept_bridge':
      case 'explicit_explain_solution': {
        const authority = deriveTutorZeroCallAuthority(entry);
        return authority?.reasonCode === 'explicit_instruction_local_only';
      }
      case 'empty_input':
        return entry.input.latestUserText.trim().length === 0;
      case 'request_aborted':
        return entry.input.requestAborted;
      case 'budget_exhausted':
        return !entry.input.budgetAvailable;
      case 'credential_material':
      case 'instruction_override':
      case 'hostile_accessor':
        return entry.input.safetyScenario === reason;
    }
  }
  const reason = entry.expected.zeroCallReason;
  switch (reason) {
    case 'existing_item':
      return entry.input.questions.some((question) => question.hasExistingItem);
    case 'exact_deck_match':
      return entry.input.existingDecks.length > 0;
    case 'high_confidence_knowledge_point':
      return entry.input.questions.some((question) => (question.knowledgePoints?.length ?? 0) > 0);
    case 'high_confidence_category_error':
      return entry.input.questions.some((question) =>
        Boolean(question.category && question.errorType),
      );
    case 'agent_gate_disabled':
      return !entry.input.agentGateEnabled;
    case 'live_calls_disabled':
      return !entry.input.liveCallsEnabled;
    case 'request_aborted':
      return entry.input.requestAborted;
    case 'budget_exhausted':
      return !entry.input.budgetAvailable;
    case 'owner_mismatch':
      return entry.input.questions.some(
        (question) => question.ownerRef !== entry.input.requestOwnerRef,
      );
    case 'credential_material':
    case 'instruction_override':
    case 'hostile_accessor':
      return entry.input.safetyScenario === reason;
  }
}

function deriveTutorZeroCallAuthority(
  entry: Extract<Parameters<Phase697V5Harness['runZeroCall']>[0], { agent: 'tutor' }>,
) {
  const authority = deriveTutorV5LocalSignalAuthority({
    latestUserText: entry.input.latestUserText,
    activeStudyContext: entry.input.activeStudyContext,
    safety: { latestUserText: 'safe_for_model', activeStudyContext: 'safe_for_model' },
  });
  return authority.ok ? authority.value : null;
}

function zeroCallDisposition(
  entry: Parameters<Phase697V5Harness['runZeroCall']>[0],
): ModelCandidateDisposition {
  const reason = entry.expected.zeroCallReason;
  if (reason === 'request_aborted') return 'fallback_aborted';
  if (reason === 'budget_exhausted') return 'fallback_budget_exceeded';
  if (
    reason === 'credential_material' ||
    reason === 'instruction_override' ||
    reason === 'owner_mismatch'
  ) {
    return 'safety_blocked';
  }
  if (reason === 'hostile_accessor') return 'fallback_invalid_input';
  return 'not_eligible';
}

function runtimeResult(
  input: Readonly<{
    candidateDisposition: ModelCandidateDisposition;
    success: boolean;
    invocations: number;
    latencyMs: number;
    orchestrationLatencyMs: number;
    usage: Readonly<{ inputTokens: number; outputTokens: number }> | null;
    semanticAxes: NonNullable<Phase697V5RuntimeResult['semanticAxes']>;
  }>,
): Phase697V5RuntimeResult {
  return Object.freeze({
    ...SAFE_RESULT,
    runtimeInvocations: input.invocations,
    candidateDisposition: input.candidateDisposition,
    failureCategory: input.success ? 'none' : 'dynamic_contract',
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: input.success,
    semanticAxes: input.success ? input.semanticAxes : null,
    latencyMs: input.latencyMs,
    orchestrationLatencyMs: input.orchestrationLatencyMs,
    usage:
      input.success && input.usage ? Object.freeze({ ...input.usage, estimatedCostCny: 0 }) : null,
    usageDisposition: input.success && input.usage ? 'verified' : 'unknown_after_attempt',
  });
}

function sameValues(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
