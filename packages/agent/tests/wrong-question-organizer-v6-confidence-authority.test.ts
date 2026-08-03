import { describe, expect, test } from 'bun:test';

import {
  phase697V2OrganizerCases,
  type Phase697V2OrganizerRuntimeCase,
} from '../src/evals/phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA256,
  WRONG_QUESTION_ORGANIZER_V6_FROZEN_CONFIDENCE_RULES_SHA256,
  deriveWrongQuestionOrganizerV6ConfidenceAuthority,
  validateWrongQuestionOrganizerV6ConfidenceAuthority,
} from '../src/model-candidates/wrong-question-organizer-v6-confidence-authority.ts';

const FINGERPRINT = `sha256:${'a'.repeat(64)}`;

describe('WrongQuestionOrganizer V6 confidence local authority', () => {
  test('keeps structured subject alone medium and promotes bounded strong evidence', () => {
    const structuredOnly = deriveWrongQuestionOrganizerV6ConfidenceAuthority(
      input({ structuredSubject: 'math' }),
    );
    expect(structuredOnly.ok).toBe(true);
    if (!structuredOnly.ok) throw new Error('ORGANIZER_V6_STRUCTURED_AUTHORITY_MISSING');
    expect(structuredOnly.value.confidence).toBe('medium');
    expect(structuredOnly.value.evidenceCodes).toEqual([
      'structured_subject',
      'bounded_topic_provenance',
    ]);

    for (const signal of [
      { knowledgePointCount: 1 },
      { categoryPresent: true },
      { errorTypePresent: true },
    ]) {
      const result = deriveWrongQuestionOrganizerV6ConfidenceAuthority(input(signal));
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('ORGANIZER_V6_STRONG_AUTHORITY_MISSING');
      expect(result.value.confidence).toBe('high');
    }
    expect(WRONG_QUESTION_ORGANIZER_V6_CONFIDENCE_RULES_SHA256).toBe(
      WRONG_QUESTION_ORGANIZER_V6_FROZEN_CONFIDENCE_RULES_SHA256,
    );
  });

  test('uses verified same-subject direct deck overlap without exposing model confidence', () => {
    const direct = deriveWrongQuestionOrganizerV6ConfidenceAuthority(
      input({
        deckDecision: {
          action: 'reuse_existing',
          deckIndex: 2,
          targetSubject: 'math',
          directTopicOverlap: true,
        },
      }),
    );
    expect(direct.ok).toBe(true);
    if (!direct.ok) throw new Error('ORGANIZER_V6_DIRECT_AUTHORITY_MISSING');
    expect(direct.value.confidence).toBe('high');
    expect(direct.value.evidenceCodes).toEqual(['same_subject_deck_overlap']);
    expect(isDeepFrozen(direct.value)).toBe(true);
    expect(validateWrongQuestionOrganizerV6ConfidenceAuthority(direct.value)).toEqual(direct);

    const weak = deriveWrongQuestionOrganizerV6ConfidenceAuthority(
      input({
        deckDecision: {
          action: 'reuse_existing',
          deckIndex: 2,
          targetSubject: 'math',
          directTopicOverlap: false,
        },
      }),
    );
    expect(weak.ok).toBe(true);
    if (!weak.ok) throw new Error('ORGANIZER_V6_WEAK_AUTHORITY_MISSING');
    expect(weak.value.confidence).toBe('medium');
  });

  test('matches all 32 frozen V2 confidence expectations without reading expected in the authority', () => {
    const runtimeCases = phase697V2OrganizerCases.filter(
      (testCase): testCase is Phase697V2OrganizerRuntimeCase =>
        testCase.expectedRuntimeInvocations === 1,
    );
    let decisions = 0;
    for (const testCase of runtimeCases) {
      for (const expected of testCase.expected.decisions) {
        const question = testCase.input.questions[expected.questionIndex];
        const authority = testCase.authority.decisions.find(
          (entry) => entry.questionIndex === expected.questionIndex,
        );
        if (!question || !authority) throw new Error('ORGANIZER_V6_V2_FIXTURE_INVALID');
        const topic = authority.topicCandidates[expected.topicCandidateIndex];
        if (!topic) throw new Error('ORGANIZER_V6_V2_TOPIC_MISSING');
        const result = deriveWrongQuestionOrganizerV6ConfidenceAuthority({
          shortlistFingerprint: FINGERPRINT,
          snapshotStable: true,
          questionIndex: expected.questionIndex,
          resolvedSubject: expected.subject,
          structuredSubject: question.structuredSubjectAuthority,
          knowledgePointCount: question.knowledgePoints?.length ?? 0,
          categoryPresent: Boolean(question.category?.trim()),
          errorTypePresent: Boolean(question.errorType?.trim()),
          deckDecision:
            expected.deckAction === 'reuse_existing'
              ? {
                  action: 'reuse_existing',
                  deckIndex: expected.deckIndex,
                  targetSubject: expected.subject,
                  directTopicOverlap: true,
                }
              : {
                  action: 'create_topic',
                  topicIndex: expected.topicCandidateIndex,
                  targetSubject: expected.subject,
                  topicSource: topic.source,
                },
        });
        expect(result.ok).toBe(true);
        if (!result.ok) throw new Error('ORGANIZER_V6_V2_AUTHORITY_FAILED');
        expect(result.value.confidence).toBe(expected.confidence);
        decisions += 1;
      }
    }
    expect(runtimeCases).toHaveLength(24);
    expect(decisions).toBe(32);
  });

  test('fails closed on stale, cross-subject, unsafe shape, and authority tampering', () => {
    expect(
      deriveWrongQuestionOrganizerV6ConfidenceAuthority(input({ snapshotStable: false })),
    ).toEqual({ ok: false, reasonCode: 'stale_snapshot' });
    expect(
      deriveWrongQuestionOrganizerV6ConfidenceAuthority(input({ structuredSubject: 'english' })),
    ).toEqual({ ok: false, reasonCode: 'subject_authority_violation' });
    expect(
      deriveWrongQuestionOrganizerV6ConfidenceAuthority(
        input({
          deckDecision: {
            action: 'create_topic',
            topicIndex: 0,
            targetSubject: 'english',
            topicSource: 'question_semantic',
          },
        }),
      ),
    ).toEqual({ ok: false, reasonCode: 'target_authority_violation' });
    expect(
      deriveWrongQuestionOrganizerV6ConfidenceAuthority({
        ...input(),
        confidence: 'high',
      }),
    ).toEqual({ ok: false, reasonCode: 'invalid_input' });

    const valid = deriveWrongQuestionOrganizerV6ConfidenceAuthority(input());
    if (!valid.ok) throw new Error('ORGANIZER_V6_TAMPER_FIXTURE_MISSING');
    const tampered = structuredClone(valid.value);
    tampered.confidence = 'high';
    expect(validateWrongQuestionOrganizerV6ConfidenceAuthority(tampered)).toEqual({
      ok: false,
      reasonCode: 'authority_contract_invalid',
    });
  });
});

function input(overrides: Record<string, unknown> = {}) {
  return {
    shortlistFingerprint: FINGERPRINT,
    snapshotStable: true,
    questionIndex: 0,
    resolvedSubject: 'math',
    structuredSubject: null,
    knowledgePointCount: 0,
    categoryPresent: false,
    errorTypePresent: false,
    deckDecision: {
      action: 'create_topic',
      topicIndex: 0,
      targetSubject: 'math',
      topicSource: 'question_semantic',
    },
    ...overrides,
  };
}

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}
