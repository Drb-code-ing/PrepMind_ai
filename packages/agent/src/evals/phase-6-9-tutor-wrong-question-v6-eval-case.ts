import { createHash } from 'node:crypto';

import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import type {
  Phase697V6Harness,
  Phase697V6RuntimeResult,
  Phase697V6ZeroCallResult,
} from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import type { ModelCandidateDisposition } from '../model-candidates/model-candidate-policy.ts';
import { deriveTutorV5LocalSignalAuthority } from '../model-candidates/tutor-v5-local-signal-authority.ts';
import type { WrongQuestionOrganizerV6CandidateResult } from '../model-candidates/wrong-question-organizer-v6-model-candidate.ts';
import {
  deriveWrongQuestionOrganizerV5Shortlist,
  type WrongQuestionOrganizerV5ShortlistSource,
} from '../model-candidates/wrong-question-organizer-v5-shortlist.ts';
import type { TutorStrategy } from '../nodes/tutor.ts';
import { TUTOR_BOUNDED_INTENTS } from '../policies/tutor-strategy-policy.ts';

const SAFE_RESULT = Object.freeze({
  criticalFailure: false,
  permissionFailure: false,
  mutationFailure: false,
  broaderThanDeterministicFallback: false,
});

export function buildPhase697V6TutorSemanticAxes(
  entry: Phase697V2TutorRuntimeCase,
  actual: TutorStrategy,
): Extract<NonNullable<Phase697V6RuntimeResult['semanticAxes']>, { agent: 'tutor' }> {
  const expected = entry.expected;
  return Object.freeze({
    agent: 'tutor',
    intent: actual.intent === expected.intent,
    depth: actual.depth === expected.depth,
    contextUse: actual.shouldUseActiveStudyContext === expected.contextUse,
    guidingPolicy: actual.shouldAskGuidingQuestion === expected.guidingQuestion,
    finalAnswerBoundary: actual.shouldGiveFinalAnswer === expected.finalAnswer,
    answerStructure: sameValues(actual.answerStructure, expected.answerStructure),
  });
}

export function buildPhase697V6OrganizerSource(
  entry: Phase697V2OrganizerRuntimeCase,
): WrongQuestionOrganizerV5ShortlistSource {
  const ownerSnapshotFingerprint = createHash('sha256')
    .update(
      JSON.stringify({
        questions: entry.input.questions,
        existingDecks: entry.input.existingDecks,
      }),
    )
    .digest('hex');
  return Object.freeze({
    ownerDomain: `hmac-sha256:${'f'.repeat(64)}`,
    ownerSnapshotVersion: 'wrong-question-organizer-owner-snapshot-v1',
    ownerSnapshotFingerprint: `sha256:${ownerSnapshotFingerprint}`,
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

export function buildPhase697V6TutorModelOwnedDecision(
  actual: TutorStrategy,
): NonNullable<Phase697V6RuntimeResult['modelOwnedDecision']> | null {
  if (!TUTOR_BOUNDED_INTENTS.includes(actual.intent as (typeof TUTOR_BOUNDED_INTENTS)[number])) {
    return null;
  }
  return Object.freeze({
    agent: 'tutor',
    intent: actual.intent as (typeof TUTOR_BOUNDED_INTENTS)[number],
  });
}

export function buildPhase697V6OrganizerModelOwnedDecision(
  entry: Phase697V2OrganizerRuntimeCase,
  actual: WrongQuestionOrganizerV6CandidateResult,
  source: WrongQuestionOrganizerV5ShortlistSource,
): NonNullable<Phase697V6RuntimeResult['modelOwnedDecision']> | null {
  const authority = deriveWrongQuestionOrganizerV5Shortlist(source);
  if (
    !authority.ok ||
    actual.binding?.shortlistFingerprint !== authority.value.shortlistFingerprint
  ) {
    return null;
  }
  const suggestions = new Map(
    actual.suggestions.map((suggestion) => [suggestion.questionId, suggestion]),
  );
  const decisions: Extract<
    NonNullable<Phase697V6RuntimeResult['modelOwnedDecision']>,
    { agent: 'wrong_question_organizer' }
  >['decisions'][number][] = [];
  for (const question of authority.value.questions) {
    const suggestion = suggestions.get(question.questionId);
    if (!suggestion || suggestion.selection.source !== 'model_ordinal') return null;
    const subjectDecision =
      question.structuredSubject !== null
        ? ({ action: 'keep_local' } as const)
        : (() => {
            const subjectIndex = question.subjectCandidates.indexOf(
              suggestion.selection.resolvedSubject,
            );
            return subjectIndex < 0 ? null : ({ action: 'select_subject', subjectIndex } as const);
          })();
    if (subjectDecision === null) return null;
    const targetOrdinal =
      suggestion.selection.deckDecision.action === 'reuse_existing'
        ? suggestion.selection.deckDecision.deckIndex
        : suggestion.selection.deckDecision.topicIndex;
    decisions.push({
      decisionId: `${entry.id}:q${question.questionIndex}`,
      subjectDecision,
      deckAction: suggestion.selection.deckDecision.action,
      targetOrdinal,
    });
  }
  return {
    agent: 'wrong_question_organizer',
    decisions,
  };
}

export function buildPhase697V6OrganizerSemanticAxes(
  entry: Phase697V2OrganizerRuntimeCase,
  actual: WrongQuestionOrganizerV6CandidateResult,
): Omit<
  Extract<
    NonNullable<Phase697V6RuntimeResult['semanticAxes']>,
    { agent: 'wrong_question_organizer' }
  >,
  'agent' | 'decisionUnits'
> {
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

export function runPhase697V6ZeroCallCase(
  entry: Parameters<Phase697V6Harness['runZeroCall']>[0],
): Phase697V6ZeroCallResult {
  const verified = verifyZeroCallGuard(entry);
  return Object.freeze({
    ...SAFE_RESULT,
    runtimeInvocations: 0,
    candidateDisposition: zeroCallDisposition(entry),
    zeroCallVerified: verified,
    failureCategory: 'local_guard',
  });
}

function verifyZeroCallGuard(entry: Parameters<Phase697V6Harness['runZeroCall']>[0]) {
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
  entry: Extract<Parameters<Phase697V6Harness['runZeroCall']>[0], { agent: 'tutor' }>,
) {
  const authority = deriveTutorV5LocalSignalAuthority({
    latestUserText: entry.input.latestUserText,
    activeStudyContext: entry.input.activeStudyContext,
    safety: { latestUserText: 'safe_for_model', activeStudyContext: 'safe_for_model' },
  });
  return authority.ok ? authority.value : null;
}

function zeroCallDisposition(
  entry: Parameters<Phase697V6Harness['runZeroCall']>[0],
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

function sameValues(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
