export const WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS = [
  'math',
  'english',
  'politics',
  'computer',
  'major',
  'other',
] as const;

export const WRONG_QUESTION_ORGANIZER_BOUNDED_MODEL_SUBJECTS = [
  'keep_local',
  ...WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS,
] as const;

export const WRONG_QUESTION_ORGANIZER_BOUNDED_EVIDENCE_CODES = [
  'structured_subject',
  'semantic_topic',
  'existing_deck_overlap',
  'error_pattern',
  'insufficient_signal',
] as const;

export type WrongQuestionOrganizerBoundedSubject =
  (typeof WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS)[number];
export type WrongQuestionOrganizerBoundedModelSubject =
  (typeof WRONG_QUESTION_ORGANIZER_BOUNDED_MODEL_SUBJECTS)[number];
export type WrongQuestionOrganizerBoundedEvidenceCode =
  (typeof WRONG_QUESTION_ORGANIZER_BOUNDED_EVIDENCE_CODES)[number];
export type WrongQuestionOrganizerBoundedDeckAction = 'reuse_existing' | 'create_topic';

export type WrongQuestionOrganizerEvidenceRequirement = Readonly<{
  mode: 'all' | 'any';
  codes: readonly WrongQuestionOrganizerBoundedEvidenceCode[];
}>;

export type WrongQuestionOrganizerDecisionPolicy = Readonly<{
  knownSubject: Readonly<{
    requiredSubject: 'keep_local';
    evidence: WrongQuestionOrganizerEvidenceRequirement;
  }>;
  unknownSubject: Readonly<{
    allowedSubjects: readonly WrongQuestionOrganizerBoundedSubject[];
    keepLocalForbidden: true;
  }>;
  deckActions: readonly Readonly<{
    action: WrongQuestionOrganizerBoundedDeckAction;
    sameResolvedSubject: boolean;
    evidence: WrongQuestionOrganizerEvidenceRequirement;
    forbiddenEvidenceCodes: readonly WrongQuestionOrganizerBoundedEvidenceCode[];
    selectionGuidance: string;
  }>[];
  evidenceTaxonomy: readonly Readonly<{
    code: WrongQuestionOrganizerBoundedEvidenceCode;
    guidance: string;
  }>[];
  insufficientSignal: Readonly<{
    allowedConfidence: 'medium';
    forbiddenWith: readonly WrongQuestionOrganizerBoundedEvidenceCode[];
    guidance: string;
  }>;
  highConfidence: Readonly<{
    supportingEvidenceAnyOf: readonly WrongQuestionOrganizerBoundedEvidenceCode[];
    forbiddenEvidenceCodes: readonly WrongQuestionOrganizerBoundedEvidenceCode[];
    guidance: string;
  }>;
  mediumConfidence: Readonly<{
    guidance: string;
  }>;
  subjectTaxonomy: readonly Readonly<{
    subject: WrongQuestionOrganizerBoundedSubject;
    guidance: string;
  }>[];
  topicLabel: Readonly<{
    minUnicodeScalars: 2;
    maxUnicodeScalars: 24;
    forbiddenGenericLabels: readonly string[];
    guidance: readonly string[];
  }>;
}>;

const POLICY_SOURCE = {
  knownSubject: {
    requiredSubject: 'keep_local',
    evidence: { mode: 'all', codes: ['structured_subject'] },
  },
  unknownSubject: {
    allowedSubjects: WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS,
    keepLocalForbidden: true,
  },
  deckActions: [
    {
      action: 'reuse_existing',
      sameResolvedSubject: true,
      evidence: { mode: 'all', codes: ['existing_deck_overlap'] },
      forbiddenEvidenceCodes: ['insufficient_signal'],
      selectionGuidance:
        'select only a projected same-subject deck whose name or keywords directly overlap the question topic',
    },
    {
      action: 'create_topic',
      sameResolvedSubject: false,
      evidence: {
        mode: 'any',
        codes: ['semantic_topic', 'error_pattern', 'insufficient_signal'],
      },
      forbiddenEvidenceCodes: ['existing_deck_overlap'],
      selectionGuidance:
        'select only when no projected same-subject deck directly matches; propose one bounded topic',
    },
  ],
  evidenceTaxonomy: [
    {
      code: 'structured_subject',
      guidance:
        'the projected known subject authority or a projected structured category or knowledge point supports the decision',
    },
    {
      code: 'semantic_topic',
      guidance: 'the projected question or analysis meaning supports the selected topic',
    },
    {
      code: 'existing_deck_overlap',
      guidance: 'the selected projected same-subject deck name or keyword directly overlaps',
    },
    {
      code: 'error_pattern',
      guidance: 'the projected errorType or analysis exposes a specific error pattern',
    },
    {
      code: 'insufficient_signal',
      guidance: 'the projected content cannot ground a more precise topic',
    },
  ],
  insufficientSignal: {
    allowedConfidence: 'medium',
    forbiddenWith: ['semantic_topic', 'existing_deck_overlap', 'error_pattern'],
    guidance:
      'use only when no semantic topic, existing-deck overlap, or explicit error pattern can ground the decision',
  },
  highConfidence: {
    supportingEvidenceAnyOf: ['structured_subject', 'existing_deck_overlap', 'error_pattern'],
    forbiddenEvidenceCodes: ['insufficient_signal'],
    guidance:
      'requires projected structured category or knowledge-point support, explicit error-pattern support, or direct same-subject deck overlap; a known subject alone is insufficient',
  },
  mediumConfidence: {
    guidance:
      'default for semantic inference from projected question text; use insufficient_signal only when no precise topic is grounded',
  },
  subjectTaxonomy: [
    { subject: 'math', guidance: 'explicit mathematics signal' },
    { subject: 'english', guidance: 'explicit English-language subject signal' },
    { subject: 'politics', guidance: 'explicit politics subject signal' },
    {
      subject: 'computer',
      guidance:
        'general computer foundations, software, algorithms, networks, databases, or operating systems',
    },
    {
      subject: 'major',
      guidance:
        'explicit non-general-computer major course, professional course, or professional exam domain',
    },
    {
      subject: 'other',
      guidance:
        'insufficient exam-subject signal or a domain outside math, English, politics, computer, and major-course boundaries',
    },
  ],
  topicLabel: {
    minUnicodeScalars: 2,
    maxUnicodeScalars: 24,
    forbiddenGenericLabels: [
      '未分类',
      '未分类错题',
      '其他',
      'other',
      'default',
      'uncategorized',
      '知识点',
      '综合题',
      '学习资料',
      '错题整理',
    ],
    guidance: [
      'Return one short, precise, source-grounded concept or error pattern from the projected question',
      'Do not combine unrelated concepts into one label',
    ],
  },
} as const satisfies WrongQuestionOrganizerDecisionPolicy;

export const WRONG_QUESTION_ORGANIZER_DECISION_POLICY: WrongQuestionOrganizerDecisionPolicy =
  Object.freeze({
    knownSubject: Object.freeze({
      requiredSubject: POLICY_SOURCE.knownSubject.requiredSubject,
      evidence: freezeEvidenceRequirement(POLICY_SOURCE.knownSubject.evidence),
    }),
    unknownSubject: Object.freeze({
      allowedSubjects: Object.freeze([...POLICY_SOURCE.unknownSubject.allowedSubjects]),
      keepLocalForbidden: true,
    }),
    deckActions: Object.freeze(
      POLICY_SOURCE.deckActions.map((policy) =>
        Object.freeze({
          action: policy.action,
          sameResolvedSubject: policy.sameResolvedSubject,
          evidence: freezeEvidenceRequirement(policy.evidence),
          forbiddenEvidenceCodes: Object.freeze([...policy.forbiddenEvidenceCodes]),
          selectionGuidance: policy.selectionGuidance,
        }),
      ),
    ),
    evidenceTaxonomy: Object.freeze(
      POLICY_SOURCE.evidenceTaxonomy.map((entry) => Object.freeze({ ...entry })),
    ),
    insufficientSignal: Object.freeze({
      allowedConfidence: POLICY_SOURCE.insufficientSignal.allowedConfidence,
      forbiddenWith: Object.freeze([...POLICY_SOURCE.insufficientSignal.forbiddenWith]),
      guidance: POLICY_SOURCE.insufficientSignal.guidance,
    }),
    highConfidence: Object.freeze({
      supportingEvidenceAnyOf: Object.freeze([
        ...POLICY_SOURCE.highConfidence.supportingEvidenceAnyOf,
      ]),
      forbiddenEvidenceCodes: Object.freeze([
        ...POLICY_SOURCE.highConfidence.forbiddenEvidenceCodes,
      ]),
      guidance: POLICY_SOURCE.highConfidence.guidance,
    }),
    mediumConfidence: Object.freeze({ guidance: POLICY_SOURCE.mediumConfidence.guidance }),
    subjectTaxonomy: Object.freeze(
      POLICY_SOURCE.subjectTaxonomy.map((entry) => Object.freeze({ ...entry })),
    ),
    topicLabel: Object.freeze({
      minUnicodeScalars: POLICY_SOURCE.topicLabel.minUnicodeScalars,
      maxUnicodeScalars: POLICY_SOURCE.topicLabel.maxUnicodeScalars,
      forbiddenGenericLabels: Object.freeze([...POLICY_SOURCE.topicLabel.forbiddenGenericLabels]),
      guidance: Object.freeze([...POLICY_SOURCE.topicLabel.guidance]),
    }),
  });

export function wrongQuestionOrganizerDeckPolicy(action: WrongQuestionOrganizerBoundedDeckAction) {
  return WRONG_QUESTION_ORGANIZER_DECISION_POLICY.deckActions.find(
    (policy) => policy.action === action,
  );
}

export function wrongQuestionOrganizerEvidenceRequirementIsSatisfied(
  evidenceCodes: readonly WrongQuestionOrganizerBoundedEvidenceCode[],
  requirement: WrongQuestionOrganizerEvidenceRequirement,
): boolean {
  return requirement.mode === 'all'
    ? requirement.codes.every((code) => evidenceCodes.includes(code))
    : requirement.codes.some((code) => evidenceCodes.includes(code));
}

function freezeEvidenceRequirement(
  requirement: WrongQuestionOrganizerEvidenceRequirement,
): WrongQuestionOrganizerEvidenceRequirement {
  return Object.freeze({
    mode: requirement.mode,
    codes: Object.freeze([...requirement.codes]),
  });
}
