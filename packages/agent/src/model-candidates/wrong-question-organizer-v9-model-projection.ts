import { createHash } from 'node:crypto';

import { z } from 'zod';

import { WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS } from '../policies/wrong-question-organizer-policy.ts';
import { estimateCandidateInputTokens } from './model-candidate-policy.ts';
import { clonePlainModelData, deepFreezeModelValue } from './model-projection-safety.ts';

export const WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION =
  'wrong-question-organizer-model-candidate-v9' as const;
export const WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION =
  'wrong-question-organizer-model-projection-v9' as const;
export const WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_VERSION =
  'phase-6.9.7-v9-candidate-input-estimator-v1' as const;
export const WRONG_QUESTION_ORGANIZER_V9_MAX_INPUT_TOKENS = 3_500;

export const WRONG_QUESTION_ORGANIZER_V9_ACTION_LABELS = [
  'reuse_existing',
  'create_topic',
] as const;
export const WRONG_QUESTION_ORGANIZER_V9_SOURCE_LABELS = [
  'existing_deck',
  'knowledge_point',
  'category',
  'error_type',
  'question_semantic',
] as const;

const BOUNDED_LABEL_SCHEMA = z
  .string()
  .min(1)
  .refine((value) => Array.from(value).length <= 80);

const PROJECTED_FIELDS_SCHEMA = z
  .object({
    category: z.string().optional(),
    knowledgePoints: z.array(z.string()).max(12).optional(),
    errorType: z.string().optional(),
    questionExcerpt: z.string().optional(),
    analysisExcerpt: z.string().optional(),
  })
  .strict();

const PROJECTED_OPTION_SCHEMA = z
  .object({
    optionIndex: z.number().int().safe().min(0).max(23),
    subjectLabel: z.enum(WRONG_QUESTION_ORGANIZER_BOUNDED_SUBJECTS),
    actionLabel: z.enum(WRONG_QUESTION_ORGANIZER_V9_ACTION_LABELS),
    sourceLabel: z.enum(WRONG_QUESTION_ORGANIZER_V9_SOURCE_LABELS),
    targetLabel: BOUNDED_LABEL_SCHEMA.optional(),
  })
  .strict();

export const WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_SCHEMA = z
  .object({
    version: z.literal(WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION),
    questions: z
      .array(
        z
          .object({
            questionIndex: z.number().int().safe().min(0).max(11),
            fields: PROJECTED_FIELDS_SCHEMA,
            options: z.array(PROJECTED_OPTION_SCHEMA).min(1).max(24),
          })
          .strict(),
      )
      .min(1)
      .max(12),
  })
  .strict();

export type WrongQuestionOrganizerV9ModelProjection = z.infer<
  typeof WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_SCHEMA
>;

const PROMPT_POLICY_SOURCE = deepFreezeModelValue({
  version: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION,
  projectionVersion: WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_VERSION,
  exactOutput: '{decisions:[{questionIndex,optionIndex}]}',
  rules: {
    complete: 'return exactly one decision for every projected questionIndex',
    authority: 'select only an optionIndex exposed for the same questionIndex',
    noEcho: 'do not echo shortlist or option-set fingerprints',
    exactKeys: 'no wrapper, snake_case, markdown, prose, or extra fields',
    numeric: 'questionIndex and optionIndex are JSON safe integers, never strings',
  },
  localAuthority:
    'subject, action, target, identifiers, confidence, owner snapshot, stale fences, trace admission, and writes are resolved locally from the selected option',
  forbidden:
    'fingerprint, subject, action, target, label, identifier, confidence, evidence, answer, route, tool, permission, write command',
});

export const WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256 =
  sha256Canonical(PROMPT_POLICY_SOURCE);
export const WRONG_QUESTION_ORGANIZER_V9_FROZEN_MODEL_PROMPT_SHA256 =
  'ef2ff007cb55aedf5710c86a9a70e68368e24cc06afd8a09af84024f12e5586c' as const;

const INPUT_ESTIMATOR_SOURCE = deepFreezeModelValue({
  version: WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_VERSION,
  algorithm: '64 + ceil(utf8Bytes(parts.join(LF)) / 3)',
  utf8Bytes: 'ascii=1,u+0080..u+07ff=2,valid-surrogate-pair=4,other-code-unit=3',
  parts: ['system_prompt', 'canonical_json_projection', 'schema_descriptor'],
  joiner: 'single_lf',
});

export const WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256 =
  sha256Canonical(INPUT_ESTIMATOR_SOURCE);
export const WRONG_QUESTION_ORGANIZER_V9_FROZEN_INPUT_ESTIMATOR_SHA256 =
  '06caeb2d5b957ce122ea11db417b65c90e852e029f1fb1e2484dbffa6fbdbada' as const;

if (
  WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256 !==
    WRONG_QUESTION_ORGANIZER_V9_FROZEN_MODEL_PROMPT_SHA256 ||
  WRONG_QUESTION_ORGANIZER_V9_INPUT_ESTIMATOR_SHA256 !==
    WRONG_QUESTION_ORGANIZER_V9_FROZEN_INPUT_ESTIMATOR_SHA256
) {
  throw new Error('WRONG_QUESTION_ORGANIZER_V9_PROMPT_OR_ESTIMATOR_SHA_MISMATCH');
}

export function formatWrongQuestionOrganizerV9ModelPolicyForPrompt() {
  return [
    `policyVersion=${WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_VERSION}`,
    `policySha256=${WRONG_QUESTION_ORGANIZER_V9_MODEL_PROMPT_SHA256}`,
    'Return only exact JSON {"decisions":[{"questionIndex":0,"optionIndex":1}]}.',
    'Return exactly one decision for every projected questionIndex and select only an optionIndex exposed for that same question.',
    'questionIndex and optionIndex must be JSON integers, never strings, fractions, null, defaults, or coerced values.',
    'Do not echo a shortlist fingerprint or option-set fingerprint.',
    'Do not output a subject, action, target, label, identifier, confidence, evidence, answer, route, tool, permission, write command, prose, markdown, wrapper, snake_case, or extra field.',
  ].join('\n');
}

export const WRONG_QUESTION_ORGANIZER_V9_SYSTEM_PROMPT = [
  'Select one complete locally authorized WrongQuestionOrganizer option per question.',
  formatWrongQuestionOrganizerV9ModelPolicyForPrompt(),
].join('\n');

export const WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DESCRIPTOR =
  'Output strict JSON: {decisions:[{questionIndex,optionIndex}]}. Both fields are JSON safe integers. One decision per projected question. No fingerprint, wrapper, prose, markdown, or extra fields.';

export type WrongQuestionOrganizerV9PromptParts = Readonly<{
  projection: WrongQuestionOrganizerV9ModelProjection;
  userPrompt: string;
  parts: readonly [string, string, string];
  estimatedInputTokens: number;
}>;

export type WrongQuestionOrganizerV9PromptPartsResult =
  | Readonly<{ ok: true; value: WrongQuestionOrganizerV9PromptParts }>
  | Readonly<{ ok: false; reasonCode: 'candidate_option_authority_invalid' }>;

export function buildWrongQuestionOrganizerV9PromptParts(
  input: unknown,
): WrongQuestionOrganizerV9PromptPartsResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
    const parsed = WRONG_QUESTION_ORGANIZER_V9_MODEL_PROJECTION_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) {
      return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
    }
    const projection = deepFreezeModelValue(parsed.data);
    const userPrompt = JSON.stringify(projection);
    const parts = deepFreezeModelValue([
      WRONG_QUESTION_ORGANIZER_V9_SYSTEM_PROMPT,
      userPrompt,
      WRONG_QUESTION_ORGANIZER_V9_SCHEMA_DESCRIPTOR,
    ] as const);
    return {
      ok: true,
      value: deepFreezeModelValue({
        projection,
        userPrompt,
        parts,
        estimatedInputTokens: estimateCandidateInputTokens(parts),
      }),
    };
  } catch {
    return { ok: false, reasonCode: 'candidate_option_authority_invalid' };
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
