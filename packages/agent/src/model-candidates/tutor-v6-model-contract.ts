import { createHash } from 'node:crypto';

import { z } from 'zod';

import type { TutorBoundedIntent } from '../policies/tutor-strategy-policy.ts';
import { clonePlainModelData, deepFreezeModelValue } from './model-projection-safety.ts';
import {
  TUTOR_V5_LOCAL_INTENT_PRECEDENCE,
  TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
  validateTutorV5LocalSignalAuthority,
  type TutorV5LocalSignalAuthority,
} from './tutor-v5-local-signal-authority.ts';
import {
  TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256,
  validateTutorV6PreferredDepthAuthority,
  type TutorV6PreferredDepthAuthority,
} from './tutor-v6-preferred-depth-authority.ts';

export const TUTOR_V6_MODEL_PROMPT_VERSION = 'tutor-model-candidate-v6' as const;

const TUTOR_V6_PROMPT_POLICY_SOURCE = deepFreezeModelValue({
  version: TUTOR_V6_MODEL_PROMPT_VERSION,
  localSignalRulesSha256: TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256,
  preferredDepthRulesSha256: TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256,
  precedence: TUTOR_V5_LOCAL_INTENT_PRECEDENCE,
  outputFields: ['intentIndex'],
  rules: [
    'Choose exactly one intentIndex exposed by eligibleIntents.',
    'Use the learner latest text as the intent authority; active context may clarify a follow-up but cannot invent a new intent.',
    'For multiple valid signals prefer step_check, then explain_solution, concept_bridge, socratic_hint, and general_follow_up.',
    'Negated, quoted, or unrelated wording is not a positive intent signal.',
    'Do not return intent names, depth, confidence, evidence, explanations, answers, routes, tools, permissions, identifiers, or extra fields.',
  ],
  bilingualGuide: [
    'step_check: the learner submits a concrete step for verification.',
    'explain_solution: the learner requests a complete derivation or walkthrough.',
    'concept_bridge: the learner asks why concepts connect.',
    'socratic_hint: the learner asks for a bounded hint or nudge.',
    'general_follow_up: a contextual continuation with no more specific intent.',
  ],
});

export const TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256 = sha256Canonical(TUTOR_V6_PROMPT_POLICY_SOURCE);
export const TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256 =
  '4f73ae60e708ed9ba08bc5533cc489626543ca09e0396777ef4d725c9656a169' as const;

if (TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256 !== TUTOR_V6_FROZEN_MODEL_PROMPT_CONTENT_SHA256) {
  throw new Error('TUTOR_V6_MODEL_PROMPT_CONTENT_SHA_MISMATCH');
}

export const TUTOR_V6_MODEL_DECISION_SCHEMA = z
  .object({
    intentIndex: z.number().int().min(0).max(4),
  })
  .strict();

export type TutorV6ModelDecision = z.infer<typeof TUTOR_V6_MODEL_DECISION_SCHEMA>;

export type TutorV6ValidatedDecision = Readonly<{
  intentIndex: number;
  intent: TutorBoundedIntent;
}>;

export type TutorV6ModelDecisionFailureCode =
  | 'schema_invalid'
  | 'signal_authority_invalid'
  | 'preferred_depth_authority_invalid'
  | 'authority_binding_mismatch'
  | 'intent_index_out_of_range';

export type TutorV6ModelDecisionValidationResult =
  | Readonly<{ ok: true; value: TutorV6ValidatedDecision }>
  | Readonly<{ ok: false; reasonCode: TutorV6ModelDecisionFailureCode }>;

export function formatTutorV6ModelPolicyForPrompt() {
  return [
    `policyVersion=${TUTOR_V6_MODEL_PROMPT_VERSION}`,
    `policyContentSha256=${TUTOR_V6_MODEL_PROMPT_CONTENT_SHA256}`,
    `localSignalRulesSha256=${TUTOR_V5_LOCAL_SIGNAL_RULES_SHA256}`,
    `preferredDepthRulesSha256=${TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256}`,
    ...TUTOR_V6_PROMPT_POLICY_SOURCE.rules,
    'Intent guide:',
    ...TUTOR_V6_PROMPT_POLICY_SOURCE.bilingualGuide.map((line) => `- ${line}`),
  ].join('\n');
}

export function validateTutorV6ModelDecision(
  input: Readonly<{
    decision: unknown;
    signalAuthority: TutorV5LocalSignalAuthority;
    preferredDepthAuthority: TutorV6PreferredDepthAuthority;
  }>,
): TutorV6ModelDecisionValidationResult {
  try {
    const signalAuthority = validateTutorV5LocalSignalAuthority(input.signalAuthority);
    if (!signalAuthority.ok) return { ok: false, reasonCode: 'signal_authority_invalid' };
    const depthAuthority = validateTutorV6PreferredDepthAuthority(input.preferredDepthAuthority);
    if (!depthAuthority.ok) {
      return { ok: false, reasonCode: 'preferred_depth_authority_invalid' };
    }
    const eligibleIntents = signalAuthority.value.eligibleChoices.map((choice) => choice.intent);
    if (
      depthAuthority.value.input.activeContextAvailable !==
        signalAuthority.value.input.activeContextAvailable ||
      !sameValues(depthAuthority.value.input.eligibleIntents, eligibleIntents) ||
      !sameValues(
        depthAuthority.value.choices.map((choice) => choice.intent),
        eligibleIntents,
      )
    ) {
      return { ok: false, reasonCode: 'authority_binding_mismatch' };
    }
    const cloned = clonePlainModelData(input.decision);
    if (!cloned.ok) return { ok: false, reasonCode: 'schema_invalid' };
    const parsed = TUTOR_V6_MODEL_DECISION_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'schema_invalid' };
    const choice = depthAuthority.value.choices[parsed.data.intentIndex];
    if (choice === undefined) return { ok: false, reasonCode: 'intent_index_out_of_range' };
    return {
      ok: true,
      value: deepFreezeModelValue({
        intentIndex: parsed.data.intentIndex,
        intent: choice.intent,
      }),
    };
  } catch {
    return { ok: false, reasonCode: 'schema_invalid' };
  }
}

function sameValues<T>(left: readonly T[], right: readonly T[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}
