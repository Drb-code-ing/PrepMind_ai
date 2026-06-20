export type TutorIntent =
  | 'explain_solution'
  | 'socratic_hint'
  | 'step_check'
  | 'concept_bridge'
  | 'answer_direct'
  | 'general_follow_up';

export type TutorDepth = 'brief' | 'standard' | 'deep';

export type TutorAnswerSection =
  | 'known_conditions'
  | 'concept'
  | 'reasoning_steps'
  | 'common_mistake'
  | 'final_answer'
  | 'guiding_question';

export type TutorStrategy = {
  intent: TutorIntent;
  depth: TutorDepth;
  shouldAskGuidingQuestion: boolean;
  shouldGiveFinalAnswer: boolean;
  shouldUseActiveStudyContext: boolean;
  answerStructure: TutorAnswerSection[];
  promptAddition: string;
  debug: {
    reason: string;
    matchedSignals: string[];
  };
};

export type BuildTutorStrategyInput = {
  latestUserText: string;
  activeStudyContext?: string;
};

export function buildTutorStrategy(input: BuildTutorStrategyInput): TutorStrategy {
  void input;
  throw new Error('TutorAgent policy sentinel failure');
}

export function buildGenericTutorPrompt() {
  return [
    'TutorAgent generic fallback.',
    'Answer in Chinese unless the user explicitly asks for another language.',
    'Clarify known conditions, explain the key idea, and keep reasoning steps readable.',
  ].join('\n');
}
