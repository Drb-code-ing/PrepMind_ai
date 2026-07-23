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

export const TUTOR_MODEL_DECISION_SCHEMA = z
  .object({
    intent: z.enum(TUTOR_MODEL_INTENTS),
    depth: z.enum(['brief', 'standard', 'deep']),
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

const ALLOWED_EVIDENCE_BY_INTENT = {
  explain_solution: new Set([
    'full_explanation_request',
    'contextual_reference',
    'ambiguous_intent',
  ]),
  socratic_hint: new Set([
    'implicit_hint_request',
    'contextual_reference',
    'ambiguous_intent',
  ]),
  step_check: new Set(['submitted_step', 'contextual_reference', 'ambiguous_intent']),
  concept_bridge: new Set(['concept_gap', 'contextual_reference', 'ambiguous_intent']),
  general_follow_up: new Set(['contextual_reference', 'ambiguous_intent']),
} satisfies Record<TutorModelDecision['intent'], ReadonlySet<string>>;

export function validateTutorModelDecision(input: unknown): TutorModelDecisionValidationResult {
  const cloned = clonePlainModelData(input);
  if (!cloned.ok) return { ok: false, reasonCode: 'schema_invalid' };
  const parsed = TUTOR_MODEL_DECISION_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };

  const evidence = new Set(parsed.data.evidenceCodes);
  const allowed = ALLOWED_EVIDENCE_BY_INTENT[parsed.data.intent];
  if (parsed.data.evidenceCodes.some((code) => !allowed.has(code))) {
    return { ok: false, reasonCode: 'invalid_evidence_association' };
  }

  const hasPrimaryEvidence = (() => {
    switch (parsed.data.intent) {
      case 'explain_solution':
        return evidence.has('full_explanation_request');
      case 'socratic_hint':
        return evidence.has('implicit_hint_request') || evidence.has('contextual_reference');
      case 'step_check':
        return evidence.has('submitted_step');
      case 'concept_bridge':
        return evidence.has('concept_gap');
      case 'general_follow_up':
        return evidence.has('contextual_reference') || evidence.has('ambiguous_intent');
    }
  })();

  return hasPrimaryEvidence
    ? { ok: true, value: parsed.data }
    : { ok: false, reasonCode: 'invalid_evidence_association' };
}
