import { z } from 'zod';

import { clonePlainModelData } from './model-projection-safety.ts';
import {
  TUTOR_BOUNDED_DEPTHS,
  TUTOR_BOUNDED_EVIDENCE_CODES,
  TUTOR_BOUNDED_INTENTS,
  TUTOR_BOUNDED_INTENT_POLICY,
  isTutorBoundedIntentAtLeastAsSpecific,
  tutorBoundedIntentPolicy,
  type TutorBoundedDepth,
  type TutorBoundedEvidenceCode,
  type TutorBoundedIntent,
  type TutorBoundedIntentPolicy,
} from '../policies/tutor-strategy-policy.ts';

export const TUTOR_MODEL_INTENTS = TUTOR_BOUNDED_INTENTS;
export const TUTOR_MODEL_EVIDENCE_CODES = TUTOR_BOUNDED_EVIDENCE_CODES;
export const TUTOR_MODEL_DEPTHS = TUTOR_BOUNDED_DEPTHS;
export const TUTOR_MODEL_PROMPT_VERSION = 'tutor-model-candidate-v4' as const;
export const TUTOR_MODEL_PROMPT_VERSION_V2 = 'tutor-model-candidate-v2' as const;

export type TutorModelIntent = TutorBoundedIntent;
export type TutorModelEvidenceCode = TutorBoundedEvidenceCode;
export type TutorModelDepth = TutorBoundedDepth;
export type TutorModelIntentPolicy = TutorBoundedIntentPolicy;

export const TUTOR_MODEL_INTENT_POLICY = TUTOR_BOUNDED_INTENT_POLICY;

const TUTOR_MODEL_INTENT_POLICY_V2 = [
  {
    intent: 'explain_solution',
    primaryEvidenceCodes: ['full_explanation_request'],
    allowedEvidenceCodes: ['full_explanation_request', 'contextual_reference', 'ambiguous_intent'],
    compatibleDepths: ['standard', 'deep'],
    selectionGuidance: 'complete worked solution or derivation',
  },
  {
    intent: 'socratic_hint',
    primaryEvidenceCodes: ['implicit_hint_request', 'contextual_reference'],
    allowedEvidenceCodes: ['implicit_hint_request', 'contextual_reference', 'ambiguous_intent'],
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
] as const satisfies readonly Pick<
  TutorModelIntentPolicy,
  | 'intent'
  | 'primaryEvidenceCodes'
  | 'allowedEvidenceCodes'
  | 'compatibleDepths'
  | 'selectionGuidance'
>[];

export function formatTutorModelIntentPolicyForPrompt(): string {
  const lines = TUTOR_MODEL_INTENT_POLICY.map((policy) => {
    return [
      `- ${policy.intent}: primaryAnyOf=[${policy.primaryEvidenceCodes.join(',')}]`,
      `allowed=[${policy.allowedEvidenceCodes.join(',')}]`,
      `compatibleDepths=[${policy.compatibleDepths.join(',')}]`,
      `use=${policy.selectionGuidance}.`,
    ].join('; ');
  });
  return [
    `policyVersion=${TUTOR_MODEL_PROMPT_VERSION}`,
    `precedence=${TUTOR_MODEL_INTENTS.join(' > ')}`,
    'chooseEarliestPrimaryByPrecedence=true',
    'generalFollowUpRequiresNoSpecificPrimary=true',
    'activeContextCanOverridePrimary=false',
    'intentRules:',
    ...lines,
  ].join('\n');
}

export function formatTutorModelIntentPolicyForPromptV2(): string {
  const lines = TUTOR_MODEL_INTENT_POLICY_V2.map((policy) =>
    [
      `- ${policy.intent}: primaryAnyOf=[${policy.primaryEvidenceCodes.join(',')}]`,
      `allowed=[${policy.allowedEvidenceCodes.join(',')}]`,
      `compatibleDepths=[${policy.compatibleDepths.join(',')}]`,
      `use=${policy.selectionGuidance}.`,
    ].join('; '),
  );
  return [`policyVersion=${TUTOR_MODEL_PROMPT_VERSION_V2}`, 'intentRules:', ...lines].join('\n');
}

export function isTutorModelDepthCompatible(
  intent: TutorModelIntent,
  depth: TutorModelDepth,
): boolean {
  return tutorModelIntentPolicy(intent)?.compatibleDepths.includes(depth) ?? false;
}

export function isTutorModelDepthCompatibleV2(
  intent: TutorModelIntent,
  depth: TutorModelDepth,
): boolean {
  return tutorModelIntentPolicyV2(intent)?.compatibleDepths.includes(depth) ?? false;
}

export function isTutorModelIntentAtLeastAsSpecific(
  candidate: TutorModelIntent,
  localAuthority: TutorModelIntent,
): boolean {
  return isTutorBoundedIntentAtLeastAsSpecific(candidate, localAuthority);
}

export function selectTutorModelIntentFromEvidence(
  evidenceCodes: readonly TutorModelEvidenceCode[],
): TutorModelIntent | null {
  for (const policy of TUTOR_MODEL_INTENT_POLICY) {
    if (policy.primaryEvidenceCodes.some((code) => evidenceCodes.includes(code))) {
      return policy.intent;
    }
  }
  return null;
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
  return validateTutorModelDecisionAgainstPolicy(input, TUTOR_MODEL_INTENT_POLICY);
}

export function validateTutorModelDecisionV2(input: unknown): TutorModelDecisionValidationResult {
  return validateTutorModelDecisionAgainstPolicy(input, TUTOR_MODEL_INTENT_POLICY_V2);
}

function validateTutorModelDecisionAgainstPolicy(
  input: unknown,
  policies: readonly Pick<
    TutorModelIntentPolicy,
    'intent' | 'primaryEvidenceCodes' | 'allowedEvidenceCodes'
  >[],
): TutorModelDecisionValidationResult {
  const cloned = clonePlainModelData(input);
  if (!cloned.ok) return { ok: false, reasonCode: 'schema_invalid' };
  const parsed = TUTOR_MODEL_DECISION_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };

  const policy = policies.find((entry) => entry.intent === parsed.data.intent);
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
  return tutorBoundedIntentPolicy(intent);
}

function tutorModelIntentPolicyV2(
  intent: TutorModelIntent,
):
  | Pick<
      TutorModelIntentPolicy,
      'intent' | 'primaryEvidenceCodes' | 'allowedEvidenceCodes' | 'compatibleDepths'
    >
  | undefined {
  return TUTOR_MODEL_INTENT_POLICY_V2.find((policy) => policy.intent === intent);
}
