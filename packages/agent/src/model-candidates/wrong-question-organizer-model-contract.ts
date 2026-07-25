import { z } from 'zod';

import { clonePlainModelData, scanCompleteModelField } from './model-projection-safety.ts';

export const WRONG_QUESTION_ORGANIZER_SUBJECTS = [
  'math',
  'english',
  'politics',
  'computer',
  'major',
  'other',
] as const;

export const WRONG_QUESTION_ORGANIZER_MODEL_SUBJECTS = [
  'keep_local',
  ...WRONG_QUESTION_ORGANIZER_SUBJECTS,
] as const;

export const WRONG_QUESTION_ORGANIZER_EVIDENCE_CODES = [
  'structured_subject',
  'semantic_topic',
  'existing_deck_overlap',
  'error_pattern',
  'insufficient_signal',
] as const;

export const WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION =
  'wrong-question-organizer-model-candidate-v2' as const;

export type WrongQuestionOrganizerSubject = (typeof WRONG_QUESTION_ORGANIZER_SUBJECTS)[number];
export type WrongQuestionOrganizerModelSubject =
  (typeof WRONG_QUESTION_ORGANIZER_MODEL_SUBJECTS)[number];
export type WrongQuestionOrganizerEvidenceCode =
  (typeof WRONG_QUESTION_ORGANIZER_EVIDENCE_CODES)[number];
export type WrongQuestionOrganizerDeckAction = 'reuse_existing' | 'create_topic';

export type WrongQuestionOrganizerEvidenceRequirement = Readonly<{
  mode: 'all' | 'any';
  codes: readonly WrongQuestionOrganizerEvidenceCode[];
}>;

export type WrongQuestionOrganizerAssociationPolicy = Readonly<{
  knownSubject: Readonly<{
    requiredSubject: 'keep_local';
    evidence: WrongQuestionOrganizerEvidenceRequirement;
  }>;
  unknownSubject: Readonly<{
    allowedSubjects: readonly WrongQuestionOrganizerSubject[];
  }>;
  deckActions: readonly Readonly<{
    action: WrongQuestionOrganizerDeckAction;
    sameResolvedSubject: boolean;
    evidence: WrongQuestionOrganizerEvidenceRequirement;
    selectionGuidance: string;
  }>[];
  evidenceTaxonomy: readonly Readonly<{
    code: WrongQuestionOrganizerEvidenceCode;
    guidance: string;
  }>[];
  highConfidence: Readonly<{
    forbiddenEvidenceCodes: readonly WrongQuestionOrganizerEvidenceCode[];
    guidance: string;
  }>;
  mediumConfidence: Readonly<{
    guidance: string;
  }>;
  subjectTaxonomy: readonly Readonly<{
    subject: WrongQuestionOrganizerSubject;
    guidance: string;
  }>[];
  topicLabel: Readonly<{
    forbiddenGenericLabels: readonly string[];
    guidance: readonly string[];
  }>;
}>;

const WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE = {
  knownSubject: {
    requiredSubject: 'keep_local',
    evidence: { mode: 'all', codes: ['structured_subject'] },
  },
  unknownSubject: {
    allowedSubjects: WRONG_QUESTION_ORGANIZER_SUBJECTS,
  },
  deckActions: [
    {
      action: 'reuse_existing',
      sameResolvedSubject: true,
      evidence: { mode: 'all', codes: ['existing_deck_overlap'] },
      selectionGuidance:
        'select only when projected deck name or keywords directly overlap the question topic',
    },
    {
      action: 'create_topic',
      sameResolvedSubject: false,
      evidence: {
        mode: 'any',
        codes: ['semantic_topic', 'error_pattern', 'insufficient_signal'],
      },
      selectionGuidance:
        'select when no same-subject projected deck directly matches; propose one bounded topic',
    },
  ],
  evidenceTaxonomy: [
    {
      code: 'structured_subject',
      guidance:
        'known subjectHint or another projected structured subject or topic field supports the decision',
    },
    {
      code: 'semantic_topic',
      guidance: 'projected question meaning supports the selected topic or deck',
    },
    {
      code: 'existing_deck_overlap',
      guidance: 'selected same-subject deck name or keywords directly overlap',
    },
    {
      code: 'error_pattern',
      guidance: 'projected errorType or analysis exposes a specific error pattern',
    },
    {
      code: 'insufficient_signal',
      guidance: 'projected content cannot ground a more precise topic',
    },
  ],
  highConfidence: {
    forbiddenEvidenceCodes: ['insufficient_signal'],
    guidance:
      'only for explicit same-subject deck overlap or a structured category, knowledge point, or error pattern that directly pins the decision',
  },
  mediumConfidence: {
    guidance:
      'default for semantic inference from question text; use insufficient_signal when no precise topic is grounded',
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
      guidance: 'explicit non-general-computer major course or professional exam domain',
    },
    {
      subject: 'other',
      guidance: 'insufficient exam-subject signal or outside the preceding subjects',
    },
  ],
  topicLabel: {
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
} as const satisfies WrongQuestionOrganizerAssociationPolicy;

export const WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY: WrongQuestionOrganizerAssociationPolicy =
  Object.freeze({
    knownSubject: Object.freeze({
      requiredSubject:
        WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.knownSubject.requiredSubject,
      evidence: freezeEvidenceRequirement(
        WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.knownSubject.evidence,
      ),
    }),
    unknownSubject: Object.freeze({
      allowedSubjects: Object.freeze([
        ...WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.unknownSubject.allowedSubjects,
      ]),
    }),
    deckActions: Object.freeze(
      WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.deckActions.map((policy) =>
        Object.freeze({
          action: policy.action,
          sameResolvedSubject: policy.sameResolvedSubject,
          evidence: freezeEvidenceRequirement(policy.evidence),
          selectionGuidance: policy.selectionGuidance,
        }),
      ),
    ),
    evidenceTaxonomy: Object.freeze(
      WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.evidenceTaxonomy.map((entry) =>
        Object.freeze({ ...entry }),
      ),
    ),
    highConfidence: Object.freeze({
      forbiddenEvidenceCodes: Object.freeze([
        ...WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.highConfidence.forbiddenEvidenceCodes,
      ]),
      guidance: WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.highConfidence.guidance,
    }),
    mediumConfidence: Object.freeze({
      guidance: WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.mediumConfidence.guidance,
    }),
    subjectTaxonomy: Object.freeze(
      WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.subjectTaxonomy.map((taxonomy) =>
        Object.freeze({ ...taxonomy }),
      ),
    ),
    topicLabel: Object.freeze({
      forbiddenGenericLabels: Object.freeze([
        ...WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.topicLabel.forbiddenGenericLabels,
      ]),
      guidance: Object.freeze([
        ...WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY_SOURCE.topicLabel.guidance,
      ]),
    }),
  });

export function formatWrongQuestionOrganizerAssociationPolicyForPrompt(): string {
  const deckRules = WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.deckActions.map(
    (policy) =>
      `- ${policy.action}: sameResolvedSubject=${String(policy.sameResolvedSubject)}; ${formatEvidenceRequirement(policy.evidence)}; use=${policy.selectionGuidance}.`,
  );
  const evidenceTaxonomy = WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.evidenceTaxonomy.map(
    (entry) => `- ${entry.code}: ${entry.guidance}.`,
  );
  const taxonomy = WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.subjectTaxonomy.map(
    (entry) => `- ${entry.subject}: ${entry.guidance}.`,
  );
  const topicRules = [
    ...WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.topicLabel.guidance.map(
      (guidance) => `- ${guidance}.`,
    ),
    `- forbiddenGenericLabels=[${WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.topicLabel.forbiddenGenericLabels.join(',')}].`,
  ];

  return [
    `policyVersion=${WRONG_QUESTION_ORGANIZER_MODEL_PROMPT_VERSION}`,
    'subjectAuthority:',
    `- subjectHint!=unknown: subject=${WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.knownSubject.requiredSubject}; ${formatEvidenceRequirement(WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.knownSubject.evidence)}.`,
    `- subjectHint=unknown: subjectAnyOf=[${WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.unknownSubject.allowedSubjects.join(',')}]; keep_local=forbidden.`,
    'deckRules:',
    ...deckRules,
    'evidenceTaxonomy:',
    ...evidenceTaxonomy,
    'confidenceRules:',
    `- high: forbiddenEvidence=[${WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.highConfidence.forbiddenEvidenceCodes.join(',')}]; use=${WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.highConfidence.guidance}.`,
    `- medium: use=${WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.mediumConfidence.guidance}.`,
    'subjectTaxonomy:',
    ...taxonomy,
    'topicRules:',
    ...topicRules,
  ].join('\n');
}

const SAFE_TOPIC_LABEL_PATTERN = /^[\p{L}\p{N} ·()（）_-]+$/u;
const TOPIC_LABEL_SCHEMA = z
  .string()
  .regex(SAFE_TOPIC_LABEL_PATTERN)
  .superRefine((value, context) => {
    const scalarLength = Array.from(value).length;
    if (scalarLength < 2 || scalarLength > 24) {
      context.addIssue({ code: 'custom', message: 'topic label scalar length out of range' });
    }
  });
const EVIDENCE_CODES_SCHEMA = z
  .array(z.enum(WRONG_QUESTION_ORGANIZER_EVIDENCE_CODES))
  .min(1)
  .max(5)
  .superRefine((codes, context) => {
    if (new Set(codes).size !== codes.length) {
      context.addIssue({ code: 'custom', message: 'duplicate evidence code' });
    }
  });

const REUSE_EXISTING_DECK_SCHEMA = z
  .object({
    action: z.literal('reuse_existing'),
    deckIndex: z.number().int().min(0).max(19),
  })
  .strict();
const CREATE_TOPIC_DECK_SCHEMA = z
  .object({
    action: z.literal('create_topic'),
    topicLabel: TOPIC_LABEL_SCHEMA,
  })
  .strict();

const WRONG_QUESTION_ORGANIZER_DECISION_SCHEMA = z
  .object({
    questionIndex: z.number().int().min(0).max(11),
    subject: z.enum(WRONG_QUESTION_ORGANIZER_MODEL_SUBJECTS),
    deck: z.discriminatedUnion('action', [REUSE_EXISTING_DECK_SCHEMA, CREATE_TOPIC_DECK_SCHEMA]),
    confidence: z.enum(['medium', 'high']),
    evidenceCodes: EVIDENCE_CODES_SCHEMA,
  })
  .strict();

export const WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA = z
  .object({
    decisions: z.array(WRONG_QUESTION_ORGANIZER_DECISION_SCHEMA).min(1).max(12),
  })
  .strict();

const WRONG_QUESTION_ORGANIZER_DECISION_CONTEXT_SCHEMA = z
  .object({
    questions: z
      .array(
        z
          .object({
            subjectHint: z.enum([...WRONG_QUESTION_ORGANIZER_SUBJECTS, 'unknown']),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    decks: z
      .array(
        z
          .object({
            subject: z.enum(WRONG_QUESTION_ORGANIZER_SUBJECTS),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();

export type WrongQuestionOrganizerModelDecision = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA
>;

export type WrongQuestionOrganizerDecisionContext = Readonly<{
  questions: readonly Readonly<{
    subjectHint: WrongQuestionOrganizerSubject | 'unknown';
  }>[];
  decks: readonly Readonly<{
    subject: WrongQuestionOrganizerSubject;
  }>[];
}>;

export type WrongQuestionOrganizerDecisionReasonCode =
  | 'schema_invalid'
  | 'context_invalid'
  | 'question_count_mismatch'
  | 'duplicate_question_index'
  | 'question_index_out_of_range'
  | 'subject_authority_violation'
  | 'deck_index_out_of_range'
  | 'cross_subject_deck'
  | 'unsafe_topic_label'
  | 'invalid_evidence_association';

export const WRONG_QUESTION_ORGANIZER_V4_VALIDATION_STAGES = [
  'raw_schema',
  'dynamic_contract',
] as const;

export const WRONG_QUESTION_ORGANIZER_V4_VALIDATION_AXES = [
  'schema',
  'context',
  'question_index',
  'subject',
  'deck',
  'topic',
  'evidence',
  'confidence',
] as const;

export const WRONG_QUESTION_ORGANIZER_V4_FAILURE_REASONS = [
  'schema_invalid',
  'context_invalid',
  'question_count_mismatch',
  'duplicate_question_index',
  'question_index_out_of_range',
  'known_subject_requires_keep_local',
  'unknown_subject_requires_bounded_subject',
  'subject_unresolved',
  'deck_index_out_of_range',
  'cross_subject_deck',
  'topic_label_invalid',
  'known_subject_evidence_missing',
  'deck_action_evidence_missing',
  'confidence_evidence_conflict',
] as const;

export type WrongQuestionOrganizerV4ValidationStage =
  (typeof WRONG_QUESTION_ORGANIZER_V4_VALIDATION_STAGES)[number];
export type WrongQuestionOrganizerV4ValidationAxis =
  (typeof WRONG_QUESTION_ORGANIZER_V4_VALIDATION_AXES)[number];
export type WrongQuestionOrganizerV4FailureReason =
  (typeof WRONG_QUESTION_ORGANIZER_V4_FAILURE_REASONS)[number];

export const WRONG_QUESTION_ORGANIZER_V4_FAILURE_DIAGNOSTIC_SCHEMA = z
  .object({
    stage: z.enum(WRONG_QUESTION_ORGANIZER_V4_VALIDATION_STAGES),
    axis: z.enum(WRONG_QUESTION_ORGANIZER_V4_VALIDATION_AXES),
    reasonCode: z.enum(WRONG_QUESTION_ORGANIZER_V4_FAILURE_REASONS),
  })
  .strict()
  .superRefine((diagnostic, context) => {
    const expected = v4StageAndAxisForReason(diagnostic.reasonCode);
    if (diagnostic.stage !== expected.stage || diagnostic.axis !== expected.axis) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'V4 organizer failure diagnostic mismatch',
      });
    }
  });

export type WrongQuestionOrganizerV4FailureDiagnostic = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_V4_FAILURE_DIAGNOSTIC_SCHEMA
>;

export type WrongQuestionOrganizerV4DecisionValidationResult =
  | { ok: true; value: WrongQuestionOrganizerModelDecision }
  | { ok: false; diagnostic: WrongQuestionOrganizerV4FailureDiagnostic };

export type WrongQuestionOrganizerDecisionValidationResult =
  | { ok: true; value: WrongQuestionOrganizerModelDecision }
  | { ok: false; reasonCode: WrongQuestionOrganizerDecisionReasonCode };

export function validateWrongQuestionOrganizerModelDecision(
  input: unknown,
  context: WrongQuestionOrganizerDecisionContext,
): WrongQuestionOrganizerDecisionValidationResult {
  const result = validateWrongQuestionOrganizerModelDecisionV4(input, context);
  return result.ok
    ? result
    : {
        ok: false,
        reasonCode: mapV4FailureToLegacyReason(result.diagnostic.reasonCode),
      };
}

export function validateWrongQuestionOrganizerModelDecisionV4(
  input: unknown,
  context: WrongQuestionOrganizerDecisionContext,
): WrongQuestionOrganizerV4DecisionValidationResult {
  const cloned = clonePlainModelData(input);
  if (!cloned.ok) return v4Failure('raw_schema', 'schema', 'schema_invalid');
  const parsed = WRONG_QUESTION_ORGANIZER_MODEL_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) return v4Failure('raw_schema', 'schema', 'schema_invalid');

  const clonedContext = clonePlainModelData(context);
  if (!clonedContext.ok) {
    return v4Failure('dynamic_contract', 'context', 'context_invalid');
  }
  const parsedContext = WRONG_QUESTION_ORGANIZER_DECISION_CONTEXT_SCHEMA.safeParse(
    clonedContext.value,
  );
  if (!parsedContext.success) {
    return v4Failure('dynamic_contract', 'context', 'context_invalid');
  }
  const safeContext = parsedContext.data;

  const seen = new Set<number>();
  for (const decision of parsed.data.decisions) {
    if (decision.questionIndex >= safeContext.questions.length) {
      return v4Failure('dynamic_contract', 'question_index', 'question_index_out_of_range');
    }
    if (seen.has(decision.questionIndex)) {
      return v4Failure('dynamic_contract', 'question_index', 'duplicate_question_index');
    }
    seen.add(decision.questionIndex);
  }
  if (parsed.data.decisions.length !== safeContext.questions.length) {
    return v4Failure('dynamic_contract', 'question_index', 'question_count_mismatch');
  }

  for (const decision of parsed.data.decisions) {
    const question = safeContext.questions[decision.questionIndex];
    if (question === undefined) {
      return v4Failure('dynamic_contract', 'question_index', 'question_index_out_of_range');
    }
    if (question.subjectHint !== 'unknown' && decision.subject !== 'keep_local') {
      return v4Failure('dynamic_contract', 'subject', 'known_subject_requires_keep_local');
    }
    if (question.subjectHint === 'unknown' && decision.subject === 'keep_local') {
      return v4Failure('dynamic_contract', 'subject', 'unknown_subject_requires_bounded_subject');
    }

    const resolvedSubject =
      decision.subject === 'keep_local' ? question.subjectHint : decision.subject;
    if (resolvedSubject === 'unknown') {
      return v4Failure('dynamic_contract', 'subject', 'subject_unresolved');
    }

    if (decision.deck.action === 'reuse_existing') {
      const deckPolicy = deckAssociationPolicy(decision.deck.action);
      if (deckPolicy === undefined) {
        return v4Failure('dynamic_contract', 'evidence', 'deck_action_evidence_missing');
      }
      const deck = safeContext.decks[decision.deck.deckIndex];
      if (deck === undefined) {
        return v4Failure('dynamic_contract', 'deck', 'deck_index_out_of_range');
      }
      if (deckPolicy.sameResolvedSubject && deck.subject !== resolvedSubject) {
        return v4Failure('dynamic_contract', 'deck', 'cross_subject_deck');
      }
    } else if (!topicLabelIsSafe(decision.deck.topicLabel)) {
      return v4Failure('dynamic_contract', 'topic', 'topic_label_invalid');
    }

    if (
      decision.subject ===
        WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.knownSubject.requiredSubject &&
      !evidenceRequirementIsSatisfied(
        decision.evidenceCodes,
        WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.knownSubject.evidence,
      )
    ) {
      return v4Failure('dynamic_contract', 'evidence', 'known_subject_evidence_missing');
    }
    const deckPolicy = deckAssociationPolicy(decision.deck.action);
    if (
      deckPolicy === undefined ||
      !evidenceRequirementIsSatisfied(decision.evidenceCodes, deckPolicy.evidence)
    ) {
      return v4Failure('dynamic_contract', 'evidence', 'deck_action_evidence_missing');
    }
    if (
      decision.confidence === 'high' &&
      WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.highConfidence.forbiddenEvidenceCodes.some(
        (code) => decision.evidenceCodes.includes(code),
      )
    ) {
      return v4Failure('dynamic_contract', 'confidence', 'confidence_evidence_conflict');
    }
  }

  return { ok: true, value: parsed.data };
}

function v4Failure(
  stage: WrongQuestionOrganizerV4ValidationStage,
  axis: WrongQuestionOrganizerV4ValidationAxis,
  reasonCode: WrongQuestionOrganizerV4FailureReason,
): WrongQuestionOrganizerV4DecisionValidationResult {
  return { ok: false, diagnostic: { stage, axis, reasonCode } };
}

function v4StageAndAxisForReason(reasonCode: WrongQuestionOrganizerV4FailureReason): Readonly<{
  stage: WrongQuestionOrganizerV4ValidationStage;
  axis: WrongQuestionOrganizerV4ValidationAxis;
}> {
  switch (reasonCode) {
    case 'schema_invalid':
      return { stage: 'raw_schema', axis: 'schema' };
    case 'context_invalid':
      return { stage: 'dynamic_contract', axis: 'context' };
    case 'question_count_mismatch':
    case 'duplicate_question_index':
    case 'question_index_out_of_range':
      return { stage: 'dynamic_contract', axis: 'question_index' };
    case 'known_subject_requires_keep_local':
    case 'unknown_subject_requires_bounded_subject':
    case 'subject_unresolved':
      return { stage: 'dynamic_contract', axis: 'subject' };
    case 'deck_index_out_of_range':
    case 'cross_subject_deck':
      return { stage: 'dynamic_contract', axis: 'deck' };
    case 'topic_label_invalid':
      return { stage: 'dynamic_contract', axis: 'topic' };
    case 'known_subject_evidence_missing':
    case 'deck_action_evidence_missing':
      return { stage: 'dynamic_contract', axis: 'evidence' };
    case 'confidence_evidence_conflict':
      return { stage: 'dynamic_contract', axis: 'confidence' };
  }
}

function mapV4FailureToLegacyReason(
  reasonCode: WrongQuestionOrganizerV4FailureReason,
): WrongQuestionOrganizerDecisionReasonCode {
  switch (reasonCode) {
    case 'known_subject_requires_keep_local':
    case 'unknown_subject_requires_bounded_subject':
    case 'subject_unresolved':
      return 'subject_authority_violation';
    case 'topic_label_invalid':
      return 'unsafe_topic_label';
    case 'known_subject_evidence_missing':
    case 'deck_action_evidence_missing':
    case 'confidence_evidence_conflict':
      return 'invalid_evidence_association';
    default:
      return reasonCode;
  }
}

function topicLabelIsSafe(value: string): boolean {
  const canonical = value.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (canonical !== value) return false;
  if (
    /https?:\/\/|www\.|<[^>]+>|[*`#\[\]{}]|api\s*key|access\s*token|password|密钥|密码/iu.test(
      value,
    )
  ) {
    return false;
  }
  if (
    WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.topicLabel.forbiddenGenericLabels.some(
      (label) => label.toLowerCase() === value.toLowerCase(),
    )
  ) {
    return false;
  }
  return scanCompleteModelField(value, {
    maxUtf16CodeUnits: 24,
    rejectToolOrWriteInstruction: true,
  }).ok;
}

function deckAssociationPolicy(action: WrongQuestionOrganizerDeckAction) {
  return WRONG_QUESTION_ORGANIZER_ASSOCIATION_POLICY.deckActions.find(
    (policy) => policy.action === action,
  );
}

function evidenceRequirementIsSatisfied(
  evidenceCodes: readonly WrongQuestionOrganizerEvidenceCode[],
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

function formatEvidenceRequirement(requirement: WrongQuestionOrganizerEvidenceRequirement): string {
  const label = requirement.mode === 'all' ? 'requiredEvidenceAll' : 'requiredEvidenceAnyOf';
  return `${label}=[${requirement.codes.join(',')}]`;
}
