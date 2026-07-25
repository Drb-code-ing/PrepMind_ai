export const TUTOR_BOUNDED_INTENTS = [
  'step_check',
  'explain_solution',
  'concept_bridge',
  'socratic_hint',
  'general_follow_up',
] as const;

export const TUTOR_BOUNDED_EVIDENCE_CODES = [
  'contextual_reference',
  'implicit_hint_request',
  'submitted_step',
  'concept_gap',
  'full_explanation_request',
  'ambiguous_intent',
] as const;

export const TUTOR_BOUNDED_DEPTHS = ['brief', 'standard', 'deep'] as const;

export const TUTOR_BOUNDED_ANSWER_SECTIONS = [
  'known_conditions',
  'concept',
  'reasoning_steps',
  'common_mistake',
  'final_answer',
  'guiding_question',
] as const;

export type TutorBoundedIntent = (typeof TUTOR_BOUNDED_INTENTS)[number];
export type TutorBoundedEvidenceCode = (typeof TUTOR_BOUNDED_EVIDENCE_CODES)[number];
export type TutorBoundedDepth = (typeof TUTOR_BOUNDED_DEPTHS)[number];
export type TutorBoundedAnswerSection = (typeof TUTOR_BOUNDED_ANSWER_SECTIONS)[number];

export type TutorBoundedIntentPolicy = Readonly<{
  intent: TutorBoundedIntent;
  primaryEvidenceCodes: readonly TutorBoundedEvidenceCode[];
  allowedEvidenceCodes: readonly TutorBoundedEvidenceCode[];
  compatibleDepths: readonly TutorBoundedDepth[];
  selectionGuidance: string;
  localStrategy: Readonly<{
    defaultDepth: TutorBoundedDepth;
    activeContextDepth: TutorBoundedDepth;
    shouldAskGuidingQuestion: boolean;
    shouldGiveFinalAnswer: boolean;
    answerStructure: readonly TutorBoundedAnswerSection[];
    activeContextAnswerStructure: readonly TutorBoundedAnswerSection[];
  }>;
}>;

const TUTOR_BOUNDED_INTENT_POLICY_SOURCE = [
  {
    intent: 'step_check',
    primaryEvidenceCodes: ['submitted_step'],
    allowedEvidenceCodes: ['submitted_step', 'contextual_reference', 'ambiguous_intent'],
    compatibleDepths: ['brief', 'standard'],
    selectionGuidance: 'check a step the learner already submitted',
    localStrategy: {
      defaultDepth: 'standard',
      activeContextDepth: 'standard',
      shouldAskGuidingQuestion: true,
      shouldGiveFinalAnswer: false,
      answerStructure: [
        'known_conditions',
        'reasoning_steps',
        'common_mistake',
        'guiding_question',
      ],
      activeContextAnswerStructure: [
        'known_conditions',
        'reasoning_steps',
        'common_mistake',
        'guiding_question',
      ],
    },
  },
  {
    intent: 'explain_solution',
    primaryEvidenceCodes: ['full_explanation_request'],
    allowedEvidenceCodes: ['full_explanation_request', 'contextual_reference', 'ambiguous_intent'],
    compatibleDepths: ['standard', 'deep'],
    selectionGuidance: 'complete worked solution or derivation',
    localStrategy: {
      defaultDepth: 'standard',
      activeContextDepth: 'deep',
      shouldAskGuidingQuestion: false,
      shouldGiveFinalAnswer: true,
      answerStructure: ['known_conditions', 'concept', 'reasoning_steps', 'final_answer'],
      activeContextAnswerStructure: [
        'known_conditions',
        'concept',
        'reasoning_steps',
        'final_answer',
      ],
    },
  },
  {
    intent: 'concept_bridge',
    primaryEvidenceCodes: ['concept_gap'],
    allowedEvidenceCodes: ['concept_gap', 'contextual_reference', 'ambiguous_intent'],
    compatibleDepths: ['standard', 'deep'],
    selectionGuidance: 'explain why a concept holds or how concepts connect',
    localStrategy: {
      defaultDepth: 'standard',
      activeContextDepth: 'standard',
      shouldAskGuidingQuestion: false,
      shouldGiveFinalAnswer: false,
      answerStructure: ['known_conditions', 'concept', 'reasoning_steps', 'guiding_question'],
      activeContextAnswerStructure: [
        'known_conditions',
        'concept',
        'reasoning_steps',
        'guiding_question',
      ],
    },
  },
  {
    intent: 'socratic_hint',
    primaryEvidenceCodes: ['implicit_hint_request'],
    allowedEvidenceCodes: ['implicit_hint_request', 'contextual_reference', 'ambiguous_intent'],
    compatibleDepths: ['brief', 'standard'],
    selectionGuidance: 'hint or next step before a full solution',
    localStrategy: {
      defaultDepth: 'standard',
      activeContextDepth: 'standard',
      shouldAskGuidingQuestion: true,
      shouldGiveFinalAnswer: false,
      answerStructure: ['known_conditions', 'concept', 'reasoning_steps', 'guiding_question'],
      activeContextAnswerStructure: [
        'known_conditions',
        'concept',
        'reasoning_steps',
        'guiding_question',
      ],
    },
  },
  {
    intent: 'general_follow_up',
    primaryEvidenceCodes: ['contextual_reference', 'ambiguous_intent'],
    allowedEvidenceCodes: ['contextual_reference', 'ambiguous_intent'],
    compatibleDepths: ['brief', 'standard'],
    selectionGuidance: 'contextual follow-up with no more specific teaching signal',
    localStrategy: {
      defaultDepth: 'standard',
      activeContextDepth: 'standard',
      shouldAskGuidingQuestion: false,
      shouldGiveFinalAnswer: false,
      answerStructure: ['concept', 'reasoning_steps'],
      activeContextAnswerStructure: ['known_conditions', 'reasoning_steps', 'guiding_question'],
    },
  },
] as const satisfies readonly TutorBoundedIntentPolicy[];

export const TUTOR_BOUNDED_INTENT_POLICY: readonly TutorBoundedIntentPolicy[] = Object.freeze(
  TUTOR_BOUNDED_INTENT_POLICY_SOURCE.map((policy) =>
    Object.freeze({
      intent: policy.intent,
      primaryEvidenceCodes: Object.freeze([...policy.primaryEvidenceCodes]),
      allowedEvidenceCodes: Object.freeze([...policy.allowedEvidenceCodes]),
      compatibleDepths: Object.freeze([...policy.compatibleDepths]),
      selectionGuidance: policy.selectionGuidance,
      localStrategy: Object.freeze({
        defaultDepth: policy.localStrategy.defaultDepth,
        activeContextDepth: policy.localStrategy.activeContextDepth,
        shouldAskGuidingQuestion: policy.localStrategy.shouldAskGuidingQuestion,
        shouldGiveFinalAnswer: policy.localStrategy.shouldGiveFinalAnswer,
        answerStructure: Object.freeze([...policy.localStrategy.answerStructure]),
        activeContextAnswerStructure: Object.freeze([
          ...policy.localStrategy.activeContextAnswerStructure,
        ]),
      }),
    }),
  ),
);

export function tutorBoundedIntentPolicy(
  intent: TutorBoundedIntent,
): TutorBoundedIntentPolicy | undefined {
  return TUTOR_BOUNDED_INTENT_POLICY.find((policy) => policy.intent === intent);
}

export function tutorBoundedIntentPrecedence(intent: TutorBoundedIntent): number {
  return TUTOR_BOUNDED_INTENTS.indexOf(intent);
}

export function isTutorBoundedIntentAtLeastAsSpecific(
  candidate: TutorBoundedIntent,
  localAuthority: TutorBoundedIntent,
): boolean {
  return tutorBoundedIntentPrecedence(candidate) <= tutorBoundedIntentPrecedence(localAuthority);
}
