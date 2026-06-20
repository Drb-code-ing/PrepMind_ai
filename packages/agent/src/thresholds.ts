export type ReviewAgentSignals = {
  newWrongQuestionCount?: number;
  sameKnowledgePointWrongCount?: number;
  sameTopicRecentFailureCount?: number;
  consecutiveActiveDays?: number;
  manualRequested?: boolean;
};

export function shouldRunReviewAgent(signals: ReviewAgentSignals): boolean {
  return (
    signals.manualRequested === true ||
    (signals.newWrongQuestionCount ?? 0) >= 5 ||
    (signals.sameKnowledgePointWrongCount ?? 0) >= 3 ||
    (signals.sameTopicRecentFailureCount ?? 0) >= 3 ||
    (signals.consecutiveActiveDays ?? 0) >= 7
  );
}

export type MemoryAgentSignals = {
  explicitPreference?: boolean;
  repeatedWeakPoint?: boolean;
  consecutiveActiveDays?: number;
  effectiveStudyMessageCount?: number;
  userConfirmedLongTermValue?: boolean;
};

export function shouldRunMemoryAgent(signals: MemoryAgentSignals): boolean {
  return (
    signals.explicitPreference === true ||
    signals.repeatedWeakPoint === true ||
    signals.userConfirmedLongTermValue === true ||
    (signals.consecutiveActiveDays ?? 0) >= 7 ||
    (signals.effectiveStudyMessageCount ?? 0) >= 20
  );
}

export type WrongQuestionOrganizerSignals = {
  savedWrongQuestion?: boolean;
  unorganizedWrongQuestionCount?: number;
  sameSubjectNewWrongQuestionCount?: number;
  manualRequested?: boolean;
  userReorganizedDeck?: boolean;
};

export function shouldRunWrongQuestionOrganizerAgent(
  signals: WrongQuestionOrganizerSignals,
): boolean {
  return (
    signals.savedWrongQuestion === true ||
    signals.manualRequested === true ||
    signals.userReorganizedDeck === true ||
    (signals.unorganizedWrongQuestionCount ?? 0) >= 3 ||
    (signals.sameSubjectNewWrongQuestionCount ?? 0) >= 5
  );
}

export type PlannerAgentSignals = {
  openedPlanSurface?: boolean;
  firstLoginToday?: boolean;
  reviewPreferenceChanged?: boolean;
  overdueCardIncrease?: number;
  manualRequested?: boolean;
};

export function shouldRunPlannerAgent(signals: PlannerAgentSignals): boolean {
  return (
    signals.openedPlanSurface === true ||
    signals.firstLoginToday === true ||
    signals.reviewPreferenceChanged === true ||
    signals.manualRequested === true ||
    (signals.overdueCardIncrease ?? 0) >= 5
  );
}
