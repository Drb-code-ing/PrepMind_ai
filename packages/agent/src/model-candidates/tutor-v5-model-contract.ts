import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  TUTOR_BOUNDED_DEPTHS,
  TUTOR_BOUNDED_INTENTS,
  type TutorBoundedDepth,
  type TutorBoundedIntent,
} from '../policies/tutor-strategy-policy.ts';
import { clonePlainModelData, deepFreezeModelValue } from './model-projection-safety.ts';
import {
  TUTOR_V5_LOCAL_INTENT_PRECEDENCE,
  TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
  validateTutorV5LocalSignalAuthority,
  type TutorV5LocalSignalAuthority,
} from './tutor-v5-local-signal-authority.ts';

export const TUTOR_V5_MODEL_PROMPT_VERSION = 'tutor-model-candidate-v5' as const;

const TUTOR_V5_PROMPT_POLICY_SOURCE = deepFreezeModelValue({
  version: TUTOR_V5_MODEL_PROMPT_VERSION,
  localAuthorityVersion: 'tutor-local-signal-authority-v1',
  localRulesSha256: TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
  precedence: TUTOR_V5_LOCAL_INTENT_PRECEDENCE,
  outputFields: ['intent', 'depth', 'confidence'],
  rules: [
    'Choose only an intent and depth listed by localAuthority.eligibleChoices.',
    'When localAuthority.primaryIntent is present, choose that exact intent; never downgrade it to general_follow_up.',
    'activeContext may affect depth but cannot create or replace an intent signal.',
    'confidence=high requires a single local primary signal; otherwise use medium.',
    'Do not return evidence codes, explanations, answers, routes, tool calls, permissions, identifiers, or extra fields.',
  ],
  bilingualGuide: [
    'step_check: learner submitted a step, e.g. 这一步算偏了吗 / verify this move.',
    'explain_solution: learner requests a complete derivation, e.g. 完整捋一遍 / walk through the whole solution.',
    'concept_bridge: learner asks why ideas connect, e.g. 背后联系 / underlying principle.',
    'socratic_hint: learner is stuck and asks for a nudge, e.g. 先提示 / give one nudge.',
    'general_follow_up: contextual continuation only when no specific primary signal exists.',
  ],
  counterexamples: [
    '不要直接给答案 is not answer authority and never grants answer_direct.',
    'A topic word inside activeContext does not create an intent.',
    'A negated signal must not be treated as positive evidence.',
  ],
});

export const TUTOR_V5_MODEL_PROMPT_CONTENT_SHA256 = sha256Canonical(TUTOR_V5_PROMPT_POLICY_SOURCE);

export const TUTOR_V5_FROZEN_MODEL_PROMPT_CONTENT_SHA256 =
  '7c7442ffa96f78f23e75a34f8526e65c48f9dce5efe2b344d58cd68d5b6c5f87' as const;

if (TUTOR_V5_MODEL_PROMPT_CONTENT_SHA256 !== TUTOR_V5_FROZEN_MODEL_PROMPT_CONTENT_SHA256) {
  throw new Error('TUTOR_V5_MODEL_PROMPT_CONTENT_SHA_MISMATCH');
}

export const TUTOR_V5_MODEL_DECISION_SCHEMA = z
  .object({
    intent: z.enum(TUTOR_BOUNDED_INTENTS),
    depth: z.enum(TUTOR_BOUNDED_DEPTHS),
    confidence: z.enum(['medium', 'high']),
  })
  .strict();

export type TutorV5ModelDecision = z.infer<typeof TUTOR_V5_MODEL_DECISION_SCHEMA>;

export type TutorV5ModelDecisionFailureCode =
  | 'schema_invalid'
  | 'authority_invalid'
  | 'intent_not_eligible'
  | 'primary_intent_downgrade'
  | 'depth_not_eligible'
  | 'confidence_not_supported';

export type TutorV5ModelDecisionValidationResult =
  | Readonly<{ ok: true; value: TutorV5ModelDecision }>
  | Readonly<{ ok: false; reasonCode: TutorV5ModelDecisionFailureCode }>;

export function formatTutorV5ModelPolicyForPrompt() {
  return [
    `policyVersion=${TUTOR_V5_MODEL_PROMPT_VERSION}`,
    `policyContentSha256=${TUTOR_V5_MODEL_PROMPT_CONTENT_SHA256}`,
    `localRulesSha256=${TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256}`,
    `precedence=${TUTOR_V5_LOCAL_INTENT_PRECEDENCE.join(' > ')}`,
    ...TUTOR_V5_PROMPT_POLICY_SOURCE.rules,
    'bilingualGuide:',
    ...TUTOR_V5_PROMPT_POLICY_SOURCE.bilingualGuide.map((line) => `- ${line}`),
    'counterexamples:',
    ...TUTOR_V5_PROMPT_POLICY_SOURCE.counterexamples.map((line) => `- ${line}`),
  ].join('\n');
}

export function validateTutorV5ModelDecision(
  input: Readonly<{
    decision: unknown;
    authority: unknown;
  }>,
): TutorV5ModelDecisionValidationResult {
  try {
    const authorityResult = validateTutorV5LocalSignalAuthority(input.authority);
    if (!authorityResult.ok) return { ok: false, reasonCode: 'authority_invalid' };
    const cloned = clonePlainModelData(input.decision);
    if (!cloned.ok) return { ok: false, reasonCode: 'schema_invalid' };
    const parsed = TUTOR_V5_MODEL_DECISION_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };
    const decision = parsed.data;
    const choice = authorityResult.value.eligibleChoices.find(
      (candidate) => candidate.intent === decision.intent,
    );
    if (choice === undefined) return { ok: false, reasonCode: 'intent_not_eligible' };
    if (
      authorityResult.value.primaryIntent !== null &&
      decision.intent !== authorityResult.value.primaryIntent
    ) {
      return { ok: false, reasonCode: 'primary_intent_downgrade' };
    }
    if (!choice.depths.includes(decision.depth)) {
      return { ok: false, reasonCode: 'depth_not_eligible' };
    }
    if (decision.confidence === 'high' && authorityResult.value.confidence !== 'high') {
      return { ok: false, reasonCode: 'confidence_not_supported' };
    }
    return { ok: true, value: deepFreezeModelValue(decision) };
  } catch {
    return { ok: false, reasonCode: 'schema_invalid' };
  }
}

export function tutorV5EligibleDepths(
  authority: TutorV5LocalSignalAuthority,
  intent: TutorBoundedIntent,
): readonly TutorBoundedDepth[] {
  const validated = validateTutorV5LocalSignalAuthority(authority);
  if (!validated.ok) return [];
  return validated.value.eligibleChoices.find((choice) => choice.intent === intent)?.depths ?? [];
}

function sha256Canonical(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

function compareCodePoints(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
