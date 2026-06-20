import { describe, expect, it } from 'bun:test';

import {
  shouldRunMemoryAgent,
  shouldRunPlannerAgent,
  shouldRunReviewAgent,
  shouldRunWrongQuestionOrganizerAgent,
} from '../src/thresholds';

describe('agent threshold guards', () => {
  it('runs ReviewAgent only when review signals reach useful thresholds', () => {
    expect(shouldRunReviewAgent({ newWrongQuestionCount: 4 })).toBe(false);
    expect(shouldRunReviewAgent({ newWrongQuestionCount: 5 })).toBe(true);
    expect(shouldRunReviewAgent({ sameKnowledgePointWrongCount: 3 })).toBe(true);
    expect(shouldRunReviewAgent({ sameTopicRecentFailureCount: 3 })).toBe(true);
    expect(shouldRunReviewAgent({ consecutiveActiveDays: 7 })).toBe(true);
    expect(shouldRunReviewAgent({ manualRequested: true })).toBe(true);
  });

  it('runs MemoryAgent only for explicit or repeated long-term signals', () => {
    expect(shouldRunMemoryAgent({ effectiveStudyMessageCount: 19 })).toBe(false);
    expect(shouldRunMemoryAgent({ explicitPreference: true })).toBe(true);
    expect(shouldRunMemoryAgent({ repeatedWeakPoint: true })).toBe(true);
    expect(shouldRunMemoryAgent({ consecutiveActiveDays: 7 })).toBe(true);
    expect(shouldRunMemoryAgent({ effectiveStudyMessageCount: 20 })).toBe(true);
    expect(shouldRunMemoryAgent({ userConfirmedLongTermValue: true })).toBe(true);
  });

  it('runs WrongQuestionOrganizerAgent for queued or user-requested organization', () => {
    expect(shouldRunWrongQuestionOrganizerAgent({ unorganizedWrongQuestionCount: 2 })).toBe(
      false,
    );
    expect(shouldRunWrongQuestionOrganizerAgent({ savedWrongQuestion: true })).toBe(true);
    expect(shouldRunWrongQuestionOrganizerAgent({ unorganizedWrongQuestionCount: 3 })).toBe(
      true,
    );
    expect(shouldRunWrongQuestionOrganizerAgent({ sameSubjectNewWrongQuestionCount: 5 })).toBe(
      true,
    );
    expect(shouldRunWrongQuestionOrganizerAgent({ manualRequested: true })).toBe(true);
    expect(shouldRunWrongQuestionOrganizerAgent({ userReorganizedDeck: true })).toBe(true);
  });

  it('runs PlannerAgent only for plan surfaces or material pressure changes', () => {
    expect(shouldRunPlannerAgent({ overdueCardIncrease: 4 })).toBe(false);
    expect(shouldRunPlannerAgent({ openedPlanSurface: true })).toBe(true);
    expect(shouldRunPlannerAgent({ firstLoginToday: true })).toBe(true);
    expect(shouldRunPlannerAgent({ reviewPreferenceChanged: true })).toBe(true);
    expect(shouldRunPlannerAgent({ overdueCardIncrease: 5 })).toBe(true);
    expect(shouldRunPlannerAgent({ manualRequested: true })).toBe(true);
  });
});
