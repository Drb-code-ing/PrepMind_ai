import { z } from 'zod';

import { estimateCandidateInputTokens } from './model-candidate-policy.ts';
import {
  clonePlainModelData,
  deepFreezeModelValue,
  scanCompleteModelField,
  truncateUnicodeScalars,
  type ModelProjectionSafetyReasonCode,
} from './model-projection-safety.ts';

export const TUTOR_MODEL_PROJECTION_VERSION = 'tutor-model-projection-v1' as const;

export const TUTOR_AMBIGUITY_SIGNAL_CODES = [
  'contextual_reference',
  'implicit_learning_request',
  'submitted_step',
  'concept_gap',
  'conflicting_intent_signals',
  'general_follow_up',
] as const;

const MAX_SOURCE_FIELD_UTF16 = 16_384;
const MAX_COMBINED_SOURCE_UTF16 = 24_576;
const MAX_LATEST_TEXT_SCALARS = 480;
const MAX_CONTEXT_SCALARS = 640;
const MAX_PROJECTED_INPUT_TOKENS = 1_200;

const SAFETY_STATE_SCHEMA = z.enum(['safe_for_model', 'unsafe', 'unknown']);
const TUTOR_MODEL_PROJECTION_SOURCE_SCHEMA = z
  .object({
    latestUserText: z.string(),
    activeStudyContext: z.string().optional(),
    deterministicIntent: z.enum([
      'explain_solution',
      'socratic_hint',
      'step_check',
      'concept_bridge',
      'answer_direct',
      'general_follow_up',
    ]),
    deterministicDepth: z.enum(['brief', 'standard', 'deep']),
    ambiguitySignals: z
      .array(z.enum(TUTOR_AMBIGUITY_SIGNAL_CODES))
      .max(TUTOR_AMBIGUITY_SIGNAL_CODES.length)
      .superRefine((signals, context) => {
        if (new Set(signals).size !== signals.length) {
          context.addIssue({ code: 'custom', message: 'duplicate ambiguity signal' });
        }
      }),
    safety: z
      .object({
        latestUserText: SAFETY_STATE_SCHEMA,
        activeStudyContext: SAFETY_STATE_SCHEMA.optional(),
      })
      .strict(),
  })
  .strict();

type TutorModelProjectionSource = z.infer<typeof TUTOR_MODEL_PROJECTION_SOURCE_SCHEMA>;

export type TutorModelProjection = Readonly<{
  version: typeof TUTOR_MODEL_PROJECTION_VERSION;
  latestText: string;
  activeContext: Readonly<{
    available: boolean;
    excerpt?: string;
  }>;
  deterministic: Readonly<{
    intent: Exclude<TutorModelProjectionSource['deterministicIntent'], 'answer_direct'>;
    depth: TutorModelProjectionSource['deterministicDepth'];
  }>;
  ambiguitySignals: readonly (typeof TUTOR_AMBIGUITY_SIGNAL_CODES)[number][];
}>;

export type TutorModelProjectionReasonCode =
  | ModelProjectionSafetyReasonCode
  | 'unsafe_metadata'
  | 'no_safe_projection'
  | 'answer_direct_not_model_eligible'
  | 'input_budget_exceeded';

export type TutorModelProjectionResult =
  | { ok: true; value: TutorModelProjection }
  | { ok: false; reasonCode: TutorModelProjectionReasonCode };

export function projectTutorModelInput(input: unknown): TutorModelProjectionResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'invalid_input' };

    const parsed = TUTOR_MODEL_PROJECTION_SOURCE_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'invalid_input' };
    const source = parsed.data;

    const hasContext = source.activeStudyContext !== undefined;
    if (hasContext !== (source.safety.activeStudyContext !== undefined)) {
      return { ok: false, reasonCode: 'invalid_input' };
    }

    const latest = scanCompleteModelField(source.latestUserText, {
      maxUtf16CodeUnits: MAX_SOURCE_FIELD_UTF16,
      rejectToolOrWriteInstruction: true,
    });
    const context = hasContext
      ? scanCompleteModelField(source.activeStudyContext ?? '', {
          maxUtf16CodeUnits: MAX_SOURCE_FIELD_UTF16,
          rejectToolOrWriteInstruction: true,
        })
      : undefined;

    if (!latest.ok) return { ok: false, reasonCode: latest.reasonCode };
    if (context !== undefined && !context.ok) {
      return { ok: false, reasonCode: context.reasonCode };
    }
    if (
      source.latestUserText.length + (source.activeStudyContext?.length ?? 0) >
      MAX_COMBINED_SOURCE_UTF16
    ) {
      return { ok: false, reasonCode: 'field_too_large' };
    }
    if (
      source.safety.latestUserText !== 'safe_for_model' ||
      source.safety.activeStudyContext === 'unsafe' ||
      source.safety.activeStudyContext === 'unknown'
    ) {
      return { ok: false, reasonCode: 'unsafe_metadata' };
    }
    if (!latest.value) return { ok: false, reasonCode: 'no_safe_projection' };
    if (source.deterministicIntent === 'answer_direct') {
      return { ok: false, reasonCode: 'answer_direct_not_model_eligible' };
    }

    const projection: TutorModelProjection = {
      version: TUTOR_MODEL_PROJECTION_VERSION,
      latestText: truncateUnicodeScalars(latest.value, MAX_LATEST_TEXT_SCALARS),
      activeContext:
        context?.ok && context.value
          ? {
              available: true,
              excerpt: truncateUnicodeScalars(context.value, MAX_CONTEXT_SCALARS),
            }
          : { available: false },
      deterministic: {
        intent: source.deterministicIntent,
        depth: source.deterministicDepth,
      },
      ambiguitySignals: [...source.ambiguitySignals],
    };

    if (estimateCandidateInputTokens([JSON.stringify(projection)]) > MAX_PROJECTED_INPUT_TOKENS) {
      return { ok: false, reasonCode: 'input_budget_exceeded' };
    }
    return { ok: true, value: deepFreezeModelValue(projection) };
  } catch {
    return { ok: false, reasonCode: 'invalid_input' };
  }
}
