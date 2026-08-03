import { describe, expect, it } from 'bun:test';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION,
  computeTutorWrongQuestionDatasetSha256,
  phase69TutorCases,
  phase69WrongQuestionOrganizerCases,
} from '../src/evals/phase-6-9-tutor-wrong-question-cases.ts';

describe('Phase 6.9.7 Tutor / WrongQuestionOrganizer eval cases', () => {
  it('freezes the 72-case dataset and exact lane quotas', () => {
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_VERSION).toBe(
      'phase-6.9-tutor-wrong-question-v1',
    );
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_CASES).toHaveLength(72);
    expect(phase69TutorCases).toHaveLength(36);
    expect(phase69WrongQuestionOrganizerCases).toHaveLength(36);

    for (const cases of [phase69TutorCases, phase69WrongQuestionOrganizerCases]) {
      expect(cases.filter((testCase) => testCase.expectedRuntimeInvocations === 0)).toHaveLength(
        12,
      );
      expect(cases.filter((testCase) => testCase.expectedRuntimeInvocations === 1)).toHaveLength(
        24,
      );
    }
    expect(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256).toBe(
      '7ac2f4b5411831308d46a9df939907444285081897848aeb250944e43382207e',
    );
  });

  it('pairs 48 runtime cases across 24 indexes and freezes 32 organizer decisions', () => {
    const runtimeCases = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.filter(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    expect(runtimeCases).toHaveLength(48);

    for (let pairedRunIndex = 0; pairedRunIndex < 24; pairedRunIndex += 1) {
      const pair = runtimeCases.filter((testCase) => testCase.pairedRunIndex === pairedRunIndex);
      expect(pair.map((testCase) => testCase.agent).sort()).toEqual([
        'tutor',
        'wrong_question_organizer',
      ]);
    }

    const organizerRuntime = phase69WrongQuestionOrganizerCases.filter(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    expect(
      organizerRuntime.reduce((total, testCase) => total + testCase.expected.decisions.length, 0),
    ).toBe(32);
    expect(
      organizerRuntime.slice(0, 20).every((testCase) => testCase.input.questions.length === 1),
    ).toBe(true);
    expect(
      organizerRuntime.slice(20).every((testCase) => testCase.input.questions.length === 3),
    ).toBe(true);
  });

  it('canonicalizes object keys with locale-independent code-point ordering', () => {
    const left = {
      z: 1,
      nested: { beta: 2, Alpha: 1 },
      array: [{ y: true, x: false }],
    };
    const right = {
      array: [{ x: false, y: true }],
      nested: { Alpha: 1, beta: 2 },
      z: 1,
    };

    expect(computeTutorWrongQuestionDatasetSha256(left)).toBe(
      computeTutorWrongQuestionDatasetSha256(right),
    );
  });

  it('uses unique synthetic ids and covers every frozen critical contract', () => {
    const ids = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.map((testCase) => testCase.id);
    expect(new Set(ids).size).toBe(72);
    expect(ids.every((id) => /^(tutor|organizer)-[a-z0-9-]{3,80}$/.test(id))).toBe(true);

    const tags = new Set(PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.flatMap((item) => item.tags));
    for (const criticalTag of [
      'critical_hint_no_final',
      'critical_prompt_injection',
      'critical_credential',
      'critical_cross_owner',
      'critical_locked_name',
      'critical_no_write_command',
    ]) {
      expect(tags.has(criticalTag)).toBe(true);
    }
  });

  it('freezes complete metric annotations and includes expected reuse predictions', () => {
    const tutorRuntime = phase69TutorCases.filter(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    for (const testCase of tutorRuntime) {
      expect(testCase.expected.answerStructure.length).toBeGreaterThan(0);
      expect(typeof testCase.expected.contextUse).toBe('boolean');
      expect(typeof testCase.expected.guidingQuestion).toBe('boolean');
      expect(typeof testCase.expected.finalAnswer).toBe('boolean');
    }

    const organizerRuntime = phase69WrongQuestionOrganizerCases.filter(
      (testCase) => testCase.expectedRuntimeInvocations === 1,
    );
    const decisions = organizerRuntime.flatMap((testCase) => testCase.expected.decisions);
    expect(decisions.some((decision) => decision.deckAction === 'reuse_existing')).toBe(true);
    for (const decision of decisions) {
      expect(decision.acceptedTopicLabels.length).toBeGreaterThan(0);
      expect(decision.acceptedTopicLabels).toContain(decision.canonicalTopicLabel);
      expect(
        decision.requiredEvidenceCodes.every((code) =>
          decision.allowedEvidenceCodes.includes(code),
        ),
      ).toBe(true);
      if (decision.deckAction === 'reuse_existing') {
        expect(decision.deckIndex).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('deep-freezes cases without real-user or credential material', () => {
    expect(Object.isFrozen(PHASE_6_9_TUTOR_WRONG_QUESTION_CASES)).toBe(true);
    for (const testCase of PHASE_6_9_TUTOR_WRONG_QUESTION_CASES) {
      expect(Object.isFrozen(testCase)).toBe(true);
      expect(Object.isFrozen(testCase.tags)).toBe(true);
      expect(Object.isFrozen(testCase.input)).toBe(true);
    }

    const serialized = JSON.stringify(PHASE_6_9_TUTOR_WRONG_QUESTION_CASES);
    for (const forbidden of [
      /authorization\s*:\s*bearer/i,
      /cookie\s*:/i,
      /(?:sk|ds|AIza)[-_A-Za-z0-9]{16,}/,
      /(?:api[_-]?key|client[_-]?secret|password)\s*[:=]/i,
      /-----BEGIN [A-Z ]+PRIVATE KEY-----/,
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    ]) {
      expect(serialized).not.toMatch(forbidden);
    }
  });
});
