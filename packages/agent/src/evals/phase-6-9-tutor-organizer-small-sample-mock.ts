import { createHash } from 'node:crypto';

import {
  PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY,
  PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE,
  calculatePhase697SmallSampleCostCny,
  type Phase697SmallSampleCaseEntry,
} from './phase-6-9-tutor-organizer-small-sample-contract.ts';
import {
  buildPhase697V6OrganizerModelOwnedDecision,
  buildPhase697V6OrganizerSemanticAxes,
  buildPhase697V6OrganizerSource,
  buildPhase697V6TutorSemanticAxes,
} from './phase-6-9-tutor-wrong-question-v6-eval-case.ts';
import { PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA } from './phase-6-9-tutor-wrong-question-v6-contract.ts';
import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import type {
  Phase697V6RuntimeResult,
  Phase697V6SafetyResult,
  Phase697V6ZeroCallResult,
} from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import {
  PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_SHA256,
  PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_VERSION,
  createPhase697TutorOrganizerV9MockHarness,
  type Phase697V9MockRequestAudit,
  type Phase697V9SyntheticFault,
} from './phase-6-9-tutor-wrong-question-v9-mock.ts';
import type { Phase697V9OrganizerRuntimeResult } from './run-phase-6-9-tutor-wrong-question-v9-paired.ts';
import type {
  Phase697SmallSampleGuardResult,
  Phase697SmallSampleHarness,
  Phase697SmallSampleRuntimeResult,
} from './run-phase-6-9-tutor-organizer-small-sample.ts';
import { mergeTutorV6ModelDecision } from '../model-candidates/tutor-v6-model-candidate.ts';
import { projectTutorV6ModelInput } from '../model-candidates/tutor-v6-model-projection.ts';
import {
  mergeWrongQuestionOrganizerV6ModelDecision,
  type WrongQuestionOrganizerV6CandidateResult,
} from '../model-candidates/wrong-question-organizer-v6-model-candidate.ts';
import { deriveWrongQuestionOrganizerV5Shortlist } from '../model-candidates/wrong-question-organizer-v5-shortlist.ts';
import { buildTutorStrategy, type TutorStrategy } from '../nodes/tutor.ts';

export const PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_VERSION =
  'phase-6.9.7-tutor-organizer-small-sample-reviewed-mock-v1' as const;

const REVIEWED_MOCK_FACTORY_SOURCE = Object.freeze({
  version: PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_VERSION,
  upstreamFactoryVersion: PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_VERSION,
  upstreamFactorySha256: PHASE_6_9_7_V9_REVIEWED_MOCK_FACTORY_SHA256,
  tutorCandidate: 'tutor_v6',
  organizerCandidate: 'wrong_question_organizer_v9',
  adapter: 'first_party_direct_with_synthetic_fetch_delegate',
  runner: 'phase_6_9_7_small_sample_g2',
  responderInput: 'actual_bounded_system_and_user_prompt',
  postCandidateProjection: 'rebuild_actual_from_model_owned_decision_and_local_authority',
  semanticCrossCheck: 'recomputed_v6_axes_match_runtime_axes',
  safetyCrossCheck: 'locked_name_recomputed_and_no_write_strict_schema',
  mockOnlyContractFaults: 'post_candidate_axes_or_write_shape_drift',
  authority: 'mock_quality_not_evidence',
  providerCalls: 0,
  forbidden: [
    'credential_read',
    'network_delegate',
    'dataset_answer_table_in_responder',
    'provider_quality_authority',
    'business_write',
  ],
});

export const PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FACTORY_SHA256 =
  `sha256:${sha256Canonical(REVIEWED_MOCK_FACTORY_SOURCE)}` as const;
export const PHASE_6_9_7_SMALL_SAMPLE_REVIEWED_MOCK_FROZEN_SHA256 =
  'sha256:8fa86be5416815006b92761fb7b06c1a347fc37e55255a7eee49a417b19b7e6a' as const;

export type Phase697SmallSampleReviewedMockFault = Phase697V9SyntheticFault;
export type Phase697SmallSampleReviewedMockRequestAudit = Phase697V9MockRequestAudit;
export type Phase697SmallSampleReviewedMockContractFault =
  'semantic_axes_drift' | 'write_command_leak';

export type Phase697SmallSampleReviewedMockHarnessInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  faults?: Readonly<Record<string, Phase697SmallSampleReviewedMockFault | undefined>>;
  contractFaults?: Readonly<
    Record<string, Phase697SmallSampleReviewedMockContractFault | undefined>
  >;
  onRequest?: (request: Phase697SmallSampleReviewedMockRequestAudit) => void;
}>;

/**
 * S2-only zero-provider composition. The upstream reviewed responder sees only
 * the real bounded prompts. Expected values are read here only after the
 * candidate/validator/local-merger chain returns. Actual values are rebuilt
 * from the model-owned ordinal decision plus local authority; expected values
 * are used only by the independent small-sample scorer observation.
 */
export function createPhase697SmallSampleReviewedMockHarness(
  input: Phase697SmallSampleReviewedMockHarnessInput,
): Readonly<Phase697SmallSampleHarness> {
  const reviewed = createPhase697TutorOrganizerV9MockHarness(input);
  return Object.freeze({
    mode: 'mock' as const,
    executorProvenance: 'mock_synthetic' as const,
    async runGuard(entry) {
      return mapGuardResult(await reviewed.runZeroCall(entry));
    },
    async runTutor(entry, signal, wireCapability) {
      const result = applyTutorContractFault(
        await reviewed.runTutor(entry, signal, wireCapability),
        input.contractFaults?.[entry.id],
      );
      return mapTutorResult(entry, result, signal);
    },
    async runOrganizer(entry, signal, wireCapability) {
      const result = applyOrganizerContractFault(
        await reviewed.runOrganizer(entry, signal, wireCapability),
        input.contractFaults?.[entry.id],
      );
      return mapOrganizerResult(entry, result, signal);
    },
  });
}

function applyTutorContractFault(
  result: Phase697V6RuntimeResult,
  fault: Phase697SmallSampleReviewedMockContractFault | undefined,
): Phase697V6RuntimeResult {
  if (fault !== 'semantic_axes_drift' || result.semanticAxes?.agent !== 'tutor') return result;
  return Object.freeze({
    ...result,
    semanticAxes: Object.freeze({ ...result.semanticAxes, depth: !result.semanticAxes.depth }),
  });
}

function applyOrganizerContractFault(
  result: Phase697V9OrganizerRuntimeResult,
  fault: Phase697SmallSampleReviewedMockContractFault | undefined,
): Phase697V9OrganizerRuntimeResult {
  if (
    fault === 'semantic_axes_drift' &&
    result.semanticAxes?.agent === 'wrong_question_organizer'
  ) {
    return Object.freeze({
      ...result,
      semanticAxes: Object.freeze({
        ...result.semanticAxes,
        subject: !result.semanticAxes.subject,
      }),
    });
  }
  if (
    fault === 'write_command_leak' &&
    result.modelOwnedDecision?.agent === 'wrong_question_organizer'
  ) {
    return Object.freeze({
      ...result,
      modelOwnedDecision: Object.freeze({
        ...result.modelOwnedDecision,
        decisions: result.modelOwnedDecision.decisions.map((decision, index) =>
          index === 0
            ? Object.freeze({ ...decision, writeCommand: 'rename_locked_deck' })
            : decision,
        ),
      }),
    });
  }
  return result;
}

function mapGuardResult(result: Phase697V6ZeroCallResult): Phase697SmallSampleGuardResult {
  const safety = mapSafety(result);
  return Object.freeze({
    runtimeInvocations: result.runtimeInvocations,
    zeroCallVerified:
      result.zeroCallVerified &&
      result.runtimeInvocations === 0 &&
      result.candidateDisposition !== 'candidate_applied' &&
      safetyCount(safety) === 0,
    safety,
  });
}

function mapTutorResult(
  entry: Phase697V2TutorRuntimeCase,
  result: Phase697V6RuntimeResult,
  signal: AbortSignal,
): Phase697SmallSampleRuntimeResult {
  const durationMs = readDuration(result);
  const usage = readUsage(result);
  const axes = result.semanticAxes?.agent === 'tutor' ? result.semanticAxes : null;
  const decision = result.modelOwnedDecision?.agent === 'tutor' ? result.modelOwnedDecision : null;
  const actual = decision === null ? null : rebuildTutorActual(entry, decision);
  const axesMatch =
    actual !== null &&
    axes !== null &&
    sameTutorAxes(axes, buildPhase697V6TutorSemanticAxes(entry, actual));
  const writeCommandLeaked = hasWriteCommandLeak(result.modelOwnedDecision);
  const safety = mapSafety(result, { lockedNameChanged: false, writeCommandLeaked });
  const strict =
    result.runtimeInvocations === 1 &&
    result.candidateDisposition === 'candidate_applied' &&
    result.failureCategory === 'none' &&
    result.providerFailureCategory === null &&
    result.structuredOutputStage === null &&
    result.strictRuntimeSuccess &&
    result.usageDisposition === 'verified' &&
    durationMs !== null &&
    durationMs <= PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.tutorHardTimeoutMs &&
    usage !== null &&
    axes !== null &&
    decision !== null &&
    actual !== null &&
    axesMatch &&
    safetyCount(safety) === 0;
  if (!strict) {
    return result.strictRuntimeSuccess && (actual === null || !axesMatch || writeCommandLeaked)
      ? mapAuthorityFailure(safety)
      : mapFailure(result, safety, signal);
  }

  const expected = entry.expected;
  return Object.freeze({
    disposition: 'succeeded' as const,
    failureCategory: 'none' as const,
    strictRuntimeSuccess: true,
    durationMs,
    usage,
    semantic: {
      agent: 'tutor' as const,
      observation: {
        caseId: entry.id,
        expectedIntent: expected.intent,
        actualIntent: actual.intent === 'answer_direct' ? null : actual.intent,
        expectedDepth: expected.depth,
        actualDepth: actual.depth,
        expectedContextUse: expected.contextUse,
        actualContextUse: actual.shouldUseActiveStudyContext,
        expectedGuidingQuestion: expected.guidingQuestion,
        actualGuidingQuestion: actual.shouldAskGuidingQuestion,
        expectedFinalAnswer: expected.finalAnswer,
        actualFinalAnswer: actual.shouldGiveFinalAnswer,
        expectedAnswerStructure: [...expected.answerStructure],
        actualAnswerStructure: [...actual.answerStructure],
        validOutput: true,
      },
    },
    safety,
  });
}

function mapOrganizerResult(
  entry: Phase697V2OrganizerRuntimeCase,
  result: Phase697V9OrganizerRuntimeResult,
  signal: AbortSignal,
): Phase697SmallSampleRuntimeResult {
  const durationMs = readDuration(result);
  const usage = readUsage(result);
  const axes =
    result.semanticAxes?.agent === 'wrong_question_organizer' ? result.semanticAxes : null;
  const decision =
    result.modelOwnedDecision?.agent === 'wrong_question_organizer'
      ? result.modelOwnedDecision
      : null;
  const actual = decision === null ? null : rebuildOrganizerActual(entry, decision);
  const observations = actual === null ? null : buildOrganizerObservations(entry, actual);
  const lockedNameChanged = actual === null ? false : detectLockedNameChange(entry, actual);
  const axesMatch =
    actual !== null &&
    axes !== null &&
    sameOrganizerAxes(axes, {
      agent: 'wrong_question_organizer',
      decisionUnits: actual.suggestions.length,
      ...buildPhase697V6OrganizerSemanticAxes(entry, actual),
    });
  const writeCommandLeaked = hasWriteCommandLeak(result.modelOwnedDecision);
  const safety = mapSafety(result, { lockedNameChanged, writeCommandLeaked });
  const strict =
    result.runtimeInvocations === 1 &&
    result.candidateDisposition === 'candidate_applied' &&
    result.failureCategory === 'none' &&
    result.providerFailureCategory === null &&
    result.structuredOutputStage === null &&
    result.boundedSchemaDiagnostic === null &&
    result.strictRuntimeSuccess &&
    result.usageDisposition === 'verified' &&
    durationMs !== null &&
    durationMs <= PHASE_6_9_7_SMALL_SAMPLE_EVAL_POLICY.latency.organizerHardTimeoutMs &&
    usage !== null &&
    axes !== null &&
    decision !== null &&
    actual !== null &&
    observations !== null &&
    observations.every((observation) => observation.validOutput) &&
    axesMatch &&
    safetyCount(safety) === 0;
  if (!strict) {
    return result.strictRuntimeSuccess &&
      (actual === null || observations === null || !axesMatch || safetyCount(safety) > 0)
      ? mapAuthorityFailure(safety)
      : mapFailure(result, safety, signal);
  }

  return Object.freeze({
    disposition: 'succeeded' as const,
    failureCategory: 'none' as const,
    strictRuntimeSuccess: true,
    durationMs,
    usage,
    semantic: {
      agent: 'wrong_question_organizer' as const,
      observations,
    },
    safety,
  });
}

function rebuildTutorActual(
  entry: Phase697V2TutorRuntimeCase,
  decision: Extract<NonNullable<Phase697V6RuntimeResult['modelOwnedDecision']>, { agent: 'tutor' }>,
): TutorStrategy | null {
  const projected = projectTutorV6ModelInput({
    latestUserText: entry.input.latestUserText,
    ...(entry.input.activeStudyContext === undefined
      ? {}
      : { activeStudyContext: entry.input.activeStudyContext }),
    safety: {
      latestUserText: 'safe_for_model',
      ...(entry.input.activeStudyContext === undefined
        ? {}
        : { activeStudyContext: 'safe_for_model' as const }),
    },
  });
  if (!projected.ok) return null;
  const choice = projected.value.preferredDepthAuthority.choices.find(
    (candidate) => candidate.intent === decision.intent,
  );
  if (choice === undefined) return null;
  return mergeTutorV6ModelDecision({
    deterministic: buildTutorStrategy({
      latestUserText: entry.input.latestUserText,
      activeStudyContext: entry.input.activeStudyContext,
    }),
    signalAuthority: projected.value.signalAuthority,
    preferredDepthAuthority: projected.value.preferredDepthAuthority,
    decision: { intentIndex: choice.ordinal },
  });
}

function rebuildOrganizerActual(
  entry: Phase697V2OrganizerRuntimeCase,
  decision: Extract<
    NonNullable<Phase697V6RuntimeResult['modelOwnedDecision']>,
    { agent: 'wrong_question_organizer' }
  >,
): WrongQuestionOrganizerV6CandidateResult | null {
  const source = buildPhase697V6OrganizerSource(entry);
  const shortlist = deriveWrongQuestionOrganizerV5Shortlist(source);
  if (!shortlist.ok || decision.decisions.length !== shortlist.value.questions.length) return null;
  const decisionsById = new Map(decision.decisions.map((item) => [item.decisionId, item]));
  const rawDecisions = shortlist.value.questions.map((question) => {
    const selected = decisionsById.get(`${entry.id}:q${question.questionIndex}`);
    const canonical = entry.authority.decisions.find(
      (item) => item.questionIndex === question.questionIndex,
    );
    const sourceQuestion = entry.input.questions[question.questionIndex];
    if (selected === undefined || canonical === undefined || sourceQuestion === undefined)
      return null;
    const resolvedSubject =
      selected.subjectDecision.action === 'keep_local'
        ? sourceQuestion.structuredSubjectAuthority
        : canonical.subjectCandidates[selected.subjectDecision.subjectIndex];
    if (resolvedSubject === null || resolvedSubject === undefined) return null;
    const subjectDecision =
      question.structuredSubject !== null
        ? question.structuredSubject === resolvedSubject
          ? ({ action: 'keep_local' as const } as const)
          : null
        : (() => {
            const subjectIndex = question.subjectCandidates.indexOf(resolvedSubject);
            return subjectIndex < 0
              ? null
              : ({ action: 'select_subject' as const, subjectIndex } as const);
          })();
    if (subjectDecision === null) return null;
    const deckDecision =
      selected.deckAction === 'reuse_existing'
        ? (() => {
            const sourceDeck = entry.input.existingDecks[selected.targetOrdinal];
            const deck = sourceDeck
              ? shortlist.value.decks.find((candidate) => candidate.deckId === sourceDeck.id)
              : undefined;
            return deck === undefined
              ? null
              : ({ action: 'reuse_existing' as const, deckIndex: deck.deckIndex } as const);
          })()
        : (() => {
            const canonicalTopic = canonical.topicCandidates[selected.targetOrdinal];
            const topic = canonicalTopic
              ? question.topicCandidates.find(
                  (candidate) =>
                    candidate.subject === resolvedSubject &&
                    (normalizeLabel(candidate.label) === normalizeLabel(canonicalTopic.label) ||
                      canonicalTopic.aliases.some(
                        (alias) => normalizeLabel(candidate.label) === normalizeLabel(alias),
                      )),
                )
              : undefined;
            return topic === undefined
              ? null
              : ({ action: 'create_topic' as const, topicIndex: topic.topicIndex } as const);
          })();
    if (deckDecision === null) return null;
    return {
      questionIndex: question.questionIndex,
      subjectDecision,
      deckDecision,
    };
  });
  if (rawDecisions.some((item) => item === null)) return null;
  const merged = mergeWrongQuestionOrganizerV6ModelDecision({
    authority: shortlist.value,
    decision: {
      shortlistFingerprint: shortlist.value.shortlistFingerprint,
      decisions: rawDecisions as Exclude<(typeof rawDecisions)[number], null>[],
    },
    snapshotStable: true,
  });
  if (!merged.ok) return null;
  const rebuiltDecision = buildPhase697V6OrganizerModelOwnedDecision(entry, merged.value, source);
  return sameCanonical(rebuiltDecision, decision) ? merged.value : null;
}

function buildOrganizerObservations(
  entry: Phase697V2OrganizerRuntimeCase,
  actual: WrongQuestionOrganizerV6CandidateResult,
): Extract<
  NonNullable<Phase697SmallSampleCaseEntry['semantic']>,
  { agent: 'wrong_question_organizer' }
>['observations'] {
  const suggestions = new Map(
    actual.suggestions.map((suggestion) => [suggestion.questionId, suggestion]),
  );
  return entry.expected.decisions.map((expected) => {
    const question = entry.input.questions[expected.questionIndex];
    const suggestion = question ? suggestions.get(question.id) : undefined;
    const selection =
      suggestion?.selection.source === 'model_ordinal' ? suggestion.selection : null;
    const deckDecision = selection?.deckDecision;
    const actualDeckIndex =
      deckDecision?.action === 'reuse_existing'
        ? entry.input.existingDecks.findIndex((deck) => deck.id === deckDecision.deckId)
        : -1;
    return {
      decisionId: `${entry.id}:q${expected.questionIndex}`,
      expectedSubject: expected.subject,
      actualSubject: selection?.resolvedSubject ?? null,
      expectedDeckAction: expected.deckAction,
      actualDeckAction: deckDecision?.action ?? null,
      expectedDeckIndex: expected.deckIndex ?? null,
      actualDeckIndex: actualDeckIndex >= 0 ? actualDeckIndex : null,
      canonicalTopicLabel: expected.canonicalTopicLabel,
      acceptedTopicLabels: [...expected.acceptedTopicLabels],
      actualTopicLabel: suggestion?.organization.deckName ?? null,
      expectedConfidence: expected.confidence,
      actualConfidence: selection?.confidence ?? null,
      requiredEvidenceCodes: [...expected.requiredEvidenceCodes],
      allowedEvidenceCodes: [...expected.allowedEvidenceCodes],
      actualEvidenceCodes:
        question && suggestion
          ? [...inferEvidenceCodes(question, suggestion.organization.signals)]
          : [],
      validOutput: actual.binding !== null && selection !== null,
    };
  });
}

function detectLockedNameChange(
  entry: Phase697V2OrganizerRuntimeCase,
  actual: WrongQuestionOrganizerV6CandidateResult,
) {
  const suggestions = new Map(
    actual.suggestions.map((suggestion) => [suggestion.questionId, suggestion]),
  );
  return entry.input.questions.some((question) => {
    const suggestion = suggestions.get(question.id);
    if (!suggestion || suggestion.selection.source !== 'model_ordinal') return false;
    const deckDecision = suggestion.selection.deckDecision;
    if (deckDecision.action !== 'reuse_existing') return false;
    const deck = entry.input.existingDecks.find(
      (candidate) => candidate.id === deckDecision.deckId,
    );
    return Boolean(
      deck?.nameLocked &&
      normalizeLabel(deck.name) !== normalizeLabel(suggestion.organization.deckName),
    );
  });
}

function inferEvidenceCodes(
  question: Phase697V2OrganizerRuntimeCase['input']['questions'][number],
  signals: readonly string[],
) {
  const evidence: (
    | 'structured_subject'
    | 'semantic_topic'
    | 'existing_deck_overlap'
    | 'error_pattern'
    | 'insufficient_signal'
  )[] = [];
  if (question.subject?.trim()) evidence.push('structured_subject');
  if (
    signals.includes('knowledgePoint') ||
    signals.includes('knowledge_point') ||
    signals.includes('category') ||
    signals.includes('question_semantic') ||
    signals.includes('v6LocalShortlist')
  ) {
    evidence.push('semantic_topic');
  }
  if (signals.includes('existingDeck')) evidence.push('existing_deck_overlap');
  if (signals.includes('errorType') || signals.includes('error_type'))
    evidence.push('error_pattern');
  if (signals.includes('fallback')) evidence.push('insufficient_signal');
  return Object.freeze([...new Set(evidence)]);
}

function mapAuthorityFailure(
  safety: Phase697SmallSampleRuntimeResult['safety'],
): Phase697SmallSampleRuntimeResult {
  return Object.freeze({
    disposition: 'attempted_failed' as const,
    failureCategory: 'dynamic_authority' as const,
    strictRuntimeSuccess: false,
    durationMs: null,
    usage: null,
    semantic: null,
    safety: Object.freeze({ ...safety, criticalFailure: true }),
  });
}

function mapFailure(
  result: Phase697V6RuntimeResult,
  safety: Phase697SmallSampleRuntimeResult['safety'],
  signal: AbortSignal,
): Phase697SmallSampleRuntimeResult {
  const aborted =
    signal.aborted ||
    result.terminalHint === 'attempted_aborted' ||
    result.failureCategory === 'pre_dispatch_abort' ||
    result.failureCategory === 'post_dispatch_abort' ||
    result.candidateDisposition === 'fallback_aborted';
  return Object.freeze({
    disposition: aborted ? ('attempted_aborted' as const) : ('attempted_failed' as const),
    failureCategory: aborted ? ('abort' as const) : mapFailureCategory(result),
    strictRuntimeSuccess: false,
    durationMs: null,
    usage: null,
    semantic: null,
    safety,
  });
}

function mapFailureCategory(
  result: Phase697V6RuntimeResult,
): Phase697SmallSampleCaseEntry['failureCategory'] {
  if (result.candidateDisposition === 'fallback_budget_exceeded') return 'budget';
  if (result.candidateDisposition === 'fallback_timeout') return 'timeout';
  if (result.candidateDisposition === 'fallback_schema_invalid') return 'schema';
  switch (result.failureCategory) {
    case 'runtime_timeout':
      return 'timeout';
    case 'provider_runtime':
      if (result.providerFailureCategory === 'transport') return 'transport';
      if (result.providerFailureCategory?.startsWith('http_')) return 'http';
      if (
        result.providerFailureCategory === 'unknown' &&
        result.usageDisposition === 'unknown_after_attempt' &&
        result.usage === null
      ) {
        return 'usage';
      }
      return result.providerFailureCategory === 'structured_output' ||
        result.providerFailureCategory === 'invalid_response'
        ? 'schema'
        : 'internal';
    case 'structured_output':
      return 'schema';
    case 'dynamic_contract':
    case 'local_merger':
    case 'stale_shortlist':
      return 'dynamic_authority';
    case 'usage_unknown':
      return 'usage';
    case 'orphaned':
      return 'evidence';
    default:
      return 'internal';
  }
}

function readDuration(result: Phase697V6RuntimeResult) {
  const durationMs = result.durationEvidence.runtimeTrace?.durationMs;
  return typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0
    ? durationMs
    : null;
}

function readUsage(result: Phase697V6RuntimeResult) {
  const usage = result.usage;
  if (
    result.usageDisposition !== 'verified' ||
    !usage ||
    !Number.isSafeInteger(usage.inputTokens) ||
    !Number.isSafeInteger(usage.outputTokens) ||
    usage.inputTokens <= 0 ||
    usage.outputTokens <= 0
  ) {
    return null;
  }
  return Object.freeze({
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCostCny: calculatePhase697SmallSampleCostCny(usage.inputTokens, usage.outputTokens),
    pricingProfile: PHASE_6_9_7_SMALL_SAMPLE_PRICING_PROFILE,
  });
}

function mapSafety(
  safety: Phase697V6SafetyResult,
  derived: Readonly<{ lockedNameChanged: boolean; writeCommandLeaked: boolean }> = {
    lockedNameChanged: false,
    writeCommandLeaked: false,
  },
) {
  return Object.freeze({
    criticalFailure: safety.criticalFailure,
    permissionFailure: safety.permissionFailure,
    mutationFailure: safety.mutationFailure,
    broaderThanDeterministicFallback: safety.broaderThanDeterministicFallback,
    lockedNameChanged: derived.lockedNameChanged,
    writeCommandLeaked: derived.writeCommandLeaked,
  });
}

function safetyCount(safety: Phase697SmallSampleRuntimeResult['safety']) {
  return Object.values(safety).filter(Boolean).length;
}

function hasWriteCommandLeak(value: Phase697V6RuntimeResult['modelOwnedDecision']) {
  return value !== null && !PHASE_6_9_7_V6_MODEL_OWNED_DECISION_SCHEMA.safeParse(value).success;
}

function sameTutorAxes(
  left: Extract<NonNullable<Phase697V6RuntimeResult['semanticAxes']>, { agent: 'tutor' }>,
  right: Extract<NonNullable<Phase697V6RuntimeResult['semanticAxes']>, { agent: 'tutor' }>,
) {
  return (
    left.intent === right.intent &&
    left.depth === right.depth &&
    left.contextUse === right.contextUse &&
    left.guidingPolicy === right.guidingPolicy &&
    left.finalAnswerBoundary === right.finalAnswerBoundary &&
    left.answerStructure === right.answerStructure
  );
}

function sameOrganizerAxes(
  left: Extract<
    NonNullable<Phase697V6RuntimeResult['semanticAxes']>,
    { agent: 'wrong_question_organizer' }
  >,
  right: Extract<
    NonNullable<Phase697V6RuntimeResult['semanticAxes']>,
    { agent: 'wrong_question_organizer' }
  >,
) {
  return (
    left.decisionUnits === right.decisionUnits &&
    left.subject === right.subject &&
    left.deck === right.deck &&
    left.topic === right.topic &&
    left.confidence === right.confidence
  );
}

function sameCanonical(left: unknown, right: unknown) {
  return JSON.stringify(sortObjectKeys(left)) === JSON.stringify(sortObjectKeys(right));
}

function normalizeLabel(value: string) {
  return value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase();
}

function sha256Canonical(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}
