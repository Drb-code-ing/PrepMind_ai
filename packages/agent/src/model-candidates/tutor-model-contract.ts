import { z } from 'zod';

import { clonePlainModelData } from './model-projection-safety.ts';

export const TUTOR_MODEL_INTENTS = [
  'explain_solution',
  'socratic_hint',
  'step_check',
  'concept_bridge',
  'general_follow_up',
] as const;

export const TUTOR_MODEL_EVIDENCE_CODES = [
  'contextual_reference',
  'implicit_hint_request',
  'submitted_step',
  'concept_gap',
  'full_explanation_request',
  'ambiguous_intent',
] as const;

export const TUTOR_MODEL_DEPTHS = ['brief', 'standard', 'deep'] as const;
export const TUTOR_MODEL_PROMPT_VERSION = 'tutor-model-candidate-v2' as const;

export type TutorModelIntent = (typeof TUTOR_MODEL_INTENTS)[number];
export type TutorModelEvidenceCode = (typeof TUTOR_MODEL_EVIDENCE_CODES)[number];
export type TutorModelDepth = (typeof TUTOR_MODEL_DEPTHS)[number];

export type TutorModelIntentPolicy = Readonly<{
  intent: TutorModelIntent;
  primaryEvidenceCodes: readonly TutorModelEvidenceCode[];
  allowedEvidenceCodes: readonly TutorModelEvidenceCode[];
  compatibleDepths: readonly TutorModelDepth[];
  selectionGuidance: string;
}>;

const TUTOR_MODEL_INTENT_POLICY_SOURCE = [
  {
    intent: 'explain_solution',
    primaryEvidenceCodes: ['full_explanation_request'],
    allowedEvidenceCodes: [
      'full_explanation_request',
      'contextual_reference',
      'ambiguous_intent',
    ],
    compatibleDepths: ['standard', 'deep'],
    selectionGuidance: 'complete worked solution or derivation',
  },
  {
    intent: 'socratic_hint',
    primaryEvidenceCodes: ['implicit_hint_request', 'contextual_reference'],
    allowedEvidenceCodes: [
      'implicit_hint_request',
      'contextual_reference',
      'ambiguous_intent',
    ],
    compatibleDepths: ['brief', 'standard'],
    selectionGuidance: 'hint or next step before a full solution',
  },
  {
    intent: 'step_check',
    primaryEvidenceCodes: ['submitted_step'],
    allowedEvidenceCodes: ['submitted_step', 'contextual_reference', 'ambiguous_intent'],
    compatibleDepths: ['brief', 'standard'],
    selectionGuidance: 'check a step the learner already submitted',
  },
  {
    intent: 'concept_bridge',
    primaryEvidenceCodes: ['concept_gap'],
    allowedEvidenceCodes: ['concept_gap', 'contextual_reference', 'ambiguous_intent'],
    compatibleDepths: ['standard', 'deep'],
    selectionGuidance: 'explain why a concept holds or how concepts connect',
  },
  {
    intent: 'general_follow_up',
    primaryEvidenceCodes: ['contextual_reference', 'ambiguous_intent'],
    allowedEvidenceCodes: ['contextual_reference', 'ambiguous_intent'],
    compatibleDepths: ['brief', 'standard'],
    selectionGuidance: 'contextual follow-up with no more specific teaching signal',
  },
] as const satisfies readonly TutorModelIntentPolicy[];

export const TUTOR_MODEL_INTENT_POLICY: readonly TutorModelIntentPolicy[] = Object.freeze(
  TUTOR_MODEL_INTENT_POLICY_SOURCE.map((policy) =>
    Object.freeze({
      intent: policy.intent,
      primaryEvidenceCodes: Object.freeze([...policy.primaryEvidenceCodes]),
      allowedEvidenceCodes: Object.freeze([...policy.allowedEvidenceCodes]),
      compatibleDepths: Object.freeze([...policy.compatibleDepths]),
      selectionGuidance: policy.selectionGuidance,
    }),
  ),
);

export function formatTutorModelIntentPolicyForPrompt(): string {
  const lines = TUTOR_MODEL_INTENTS.map((intent) => {
    const policy = tutorModelIntentPolicy(intent);
    if (policy === undefined) throw new Error('TUTOR_MODEL_INTENT_POLICY_INCOMPLETE');
    return [
      `- ${policy.intent}: primaryAnyOf=[${policy.primaryEvidenceCodes.join(',')}]`,
      `allowed=[${policy.allowedEvidenceCodes.join(',')}]`,
      `compatibleDepths=[${policy.compatibleDepths.join(',')}]`,
      `use=${policy.selectionGuidance}.`,
    ].join('; ');
  });
  return [`policyVersion=${TUTOR_MODEL_PROMPT_VERSION}`, 'intentRules:', ...lines].join('\n');
}

export function isTutorModelDepthCompatible(
  intent: TutorModelIntent,
  depth: TutorModelDepth,
): boolean {
  return tutorModelIntentPolicy(intent)?.compatibleDepths.includes(depth) ?? false;
}

export const TUTOR_MODEL_DECISION_SCHEMA = z
  .object({
    intent: z.enum(TUTOR_MODEL_INTENTS),
    depth: z.enum(TUTOR_MODEL_DEPTHS),
    confidence: z.enum(['medium', 'high']),
    evidenceCodes: z
      .array(z.enum(TUTOR_MODEL_EVIDENCE_CODES))
      .min(1)
      .max(4)
      .superRefine((codes, context) => {
        if (new Set(codes).size !== codes.length) {
          context.addIssue({ code: 'custom', message: 'duplicate evidence code' });
        }
      }),
  })
  .strict();

export type TutorModelDecision = z.infer<typeof TUTOR_MODEL_DECISION_SCHEMA>;

export type TutorModelDecisionValidationResult =
  | { ok: true; value: TutorModelDecision }
  | { ok: false; reasonCode: 'schema_invalid' | 'invalid_evidence_association' };

export function validateTutorModelDecision(input: unknown): TutorModelDecisionValidationResult {
  const cloned = clonePlainModelData(input);
  if (!cloned.ok) return { ok: false, reasonCode: 'schema_invalid' };
  const parsed = TUTOR_MODEL_DECISION_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };

  const policy = tutorModelIntentPolicy(parsed.data.intent);
  if (
    policy === undefined ||
    parsed.data.evidenceCodes.some((code) => !policy.allowedEvidenceCodes.includes(code))
  ) {
    return { ok: false, reasonCode: 'invalid_evidence_association' };
  }

  const hasPrimaryEvidence = policy.primaryEvidenceCodes.some((code) =>
    parsed.data.evidenceCodes.includes(code),
  );

  return hasPrimaryEvidence
    ? { ok: true, value: parsed.data }
    : { ok: false, reasonCode: 'invalid_evidence_association' };
}

function tutorModelIntentPolicy(intent: TutorModelIntent): TutorModelIntentPolicy | undefined {
  return TUTOR_MODEL_INTENT_POLICY.find((policy) => policy.intent === intent);
}
