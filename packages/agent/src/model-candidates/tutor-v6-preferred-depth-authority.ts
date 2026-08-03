import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  TUTOR_BOUNDED_INTENTS,
  TUTOR_BOUNDED_INTENT_POLICY,
  type TutorBoundedAnswerSection,
  type TutorBoundedDepth,
  type TutorBoundedIntent,
} from '../policies/tutor-strategy-policy.ts';
import {
  clonePlainModelData,
  deepFreezeModelValue,
  type ModelProjectionSafetyReasonCode,
} from './model-projection-safety.ts';

export const TUTOR_V6_PREFERRED_DEPTH_AUTHORITY_VERSION =
  'tutor-preferred-depth-authority-v1' as const;
export const TUTOR_V6_PREFERRED_DEPTH_RULES_VERSION = 'tutor-preferred-depth-rules-v1' as const;

const TUTOR_V6_PREFERRED_DEPTH_RULE_SOURCE = deepFreezeModelValue({
  version: TUTOR_V6_PREFERRED_DEPTH_RULES_VERSION,
  strategySource: 'tutor-bounded-intent-policy-v1',
  modelAuthority: 'eligible_intent_ordinal_only',
  localAuthority: [
    'preferred_depth',
    'guiding_policy',
    'final_answer_boundary',
    'active_context_use',
    'answer_structure',
  ],
  rules: TUTOR_BOUNDED_INTENT_POLICY.map((policy) => ({
    intent: policy.intent,
    defaultDepth: policy.localStrategy.defaultDepth,
    activeContextDepth: policy.localStrategy.activeContextDepth,
    shouldAskGuidingQuestion: policy.localStrategy.shouldAskGuidingQuestion,
    shouldGiveFinalAnswer: policy.localStrategy.shouldGiveFinalAnswer,
    answerStructure: policy.localStrategy.answerStructure,
    activeContextAnswerStructure: policy.localStrategy.activeContextAnswerStructure,
  })),
});

export const TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256 = sha256Canonical(
  TUTOR_V6_PREFERRED_DEPTH_RULE_SOURCE,
);
export const TUTOR_V6_FROZEN_PREFERRED_DEPTH_RULES_SHA256 =
  'b57a828e14294f712a6547be2ac168b1d58b79cdc5b9aecbb071304f4e5ae7af' as const;

if (TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256 !== TUTOR_V6_FROZEN_PREFERRED_DEPTH_RULES_SHA256) {
  throw new Error('TUTOR_V6_PREFERRED_DEPTH_RULES_SHA_MISMATCH');
}

export type TutorV6PreferredDepthChoice = Readonly<{
  ordinal: number;
  intent: TutorBoundedIntent;
  preferredDepth: TutorBoundedDepth;
  shouldAskGuidingQuestion: boolean;
  shouldGiveFinalAnswer: boolean;
  shouldUseActiveStudyContext: boolean;
  answerStructure: readonly TutorBoundedAnswerSection[];
}>;

export type TutorV6PreferredDepthAuthority = Readonly<{
  version: typeof TUTOR_V6_PREFERRED_DEPTH_AUTHORITY_VERSION;
  rulesVersion: typeof TUTOR_V6_PREFERRED_DEPTH_RULES_VERSION;
  rulesSha256: string;
  input: Readonly<{
    activeContextAvailable: boolean;
    eligibleIntents: readonly TutorBoundedIntent[];
  }>;
  choices: readonly TutorV6PreferredDepthChoice[];
  authoritySha256: string;
}>;

export type TutorV6PreferredDepthFailureCode =
  | ModelProjectionSafetyReasonCode
  | 'duplicate_intent'
  | 'authority_contract_invalid';

export type TutorV6PreferredDepthResult =
  | Readonly<{ ok: true; value: TutorV6PreferredDepthAuthority }>
  | Readonly<{ ok: false; reasonCode: TutorV6PreferredDepthFailureCode }>;

const AUTHORITY_INPUT_SCHEMA = z
  .object({
    activeContextAvailable: z.boolean(),
    eligibleIntents: z
      .array(z.enum(TUTOR_BOUNDED_INTENTS))
      .min(1)
      .max(TUTOR_BOUNDED_INTENTS.length),
  })
  .strict();

export function deriveTutorV6PreferredDepthAuthority(input: unknown): TutorV6PreferredDepthResult {
  const derived = deriveWithoutValidation(input);
  if (!derived.ok) return derived;
  const validated = validateTutorV6PreferredDepthAuthority(derived.value);
  return validated.ok ? derived : { ok: false, reasonCode: 'authority_contract_invalid' };
}

export function validateTutorV6PreferredDepthAuthority(
  input: unknown,
): TutorV6PreferredDepthResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok || typeof cloned.value !== 'object' || cloned.value === null) {
      return { ok: false, reasonCode: 'authority_contract_invalid' };
    }
    const candidate = cloned.value as Record<string, unknown>;
    if (
      candidate.version !== TUTOR_V6_PREFERRED_DEPTH_AUTHORITY_VERSION ||
      candidate.rulesVersion !== TUTOR_V6_PREFERRED_DEPTH_RULES_VERSION ||
      candidate.rulesSha256 !== TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256
    ) {
      return { ok: false, reasonCode: 'authority_contract_invalid' };
    }
    const rebuilt = deriveWithoutValidation(candidate.input);
    if (!rebuilt.ok || JSON.stringify(rebuilt.value) !== JSON.stringify(candidate)) {
      return { ok: false, reasonCode: 'authority_contract_invalid' };
    }
    return { ok: true, value: deepFreezeModelValue(rebuilt.value) };
  } catch {
    return { ok: false, reasonCode: 'authority_contract_invalid' };
  }
}

function deriveWithoutValidation(input: unknown): TutorV6PreferredDepthResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'invalid_input' };
    const parsed = AUTHORITY_INPUT_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'invalid_input' };
    if (new Set(parsed.data.eligibleIntents).size !== parsed.data.eligibleIntents.length) {
      return { ok: false, reasonCode: 'duplicate_intent' };
    }
    const choices = parsed.data.eligibleIntents.map((intent, ordinal) => {
      const rule = TUTOR_V6_PREFERRED_DEPTH_RULE_SOURCE.rules.find(
        (candidate) => candidate.intent === intent,
      );
      if (!rule) throw new Error('TUTOR_V6_PREFERRED_DEPTH_RULE_MISSING');
      const answerStructure = parsed.data.activeContextAvailable
        ? rule.activeContextAnswerStructure
        : rule.answerStructure;
      return {
        ordinal,
        intent,
        preferredDepth: parsed.data.activeContextAvailable
          ? rule.activeContextDepth
          : rule.defaultDepth,
        shouldAskGuidingQuestion: rule.shouldAskGuidingQuestion,
        shouldGiveFinalAnswer: rule.shouldGiveFinalAnswer,
        shouldUseActiveStudyContext: parsed.data.activeContextAvailable,
        answerStructure,
      };
    });
    const withoutHash = {
      version: TUTOR_V6_PREFERRED_DEPTH_AUTHORITY_VERSION,
      rulesVersion: TUTOR_V6_PREFERRED_DEPTH_RULES_VERSION,
      rulesSha256: TUTOR_V6_PREFERRED_DEPTH_RULES_SHA256,
      input: {
        activeContextAvailable: parsed.data.activeContextAvailable,
        eligibleIntents: parsed.data.eligibleIntents,
      },
      choices,
    };
    return {
      ok: true,
      value: deepFreezeModelValue({
        ...withoutHash,
        authoritySha256: sha256Canonical(withoutHash),
      }),
    };
  } catch {
    return { ok: false, reasonCode: 'authority_contract_invalid' };
  }
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
