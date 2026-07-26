import { z } from 'zod';

import { estimateCandidateInputTokens } from './model-candidate-policy.ts';
import {
  clonePlainModelData,
  deepFreezeModelValue,
  scanCompleteModelField,
  truncateUnicodeScalars,
  type ModelProjectionSafetyReasonCode,
} from './model-projection-safety.ts';
import {
  deriveTutorV5LocalSignalAuthority,
  type TutorV5LocalSignalAuthority,
  type TutorV5LocalSignalAuthorityFailureCode,
} from './tutor-v5-local-signal-authority.ts';

export const TUTOR_V5_MODEL_PROJECTION_VERSION = 'tutor-model-projection-v5' as const;

const MAX_SOURCE_FIELD_UTF16 = 16_384;
const MAX_COMBINED_SOURCE_UTF16 = 24_576;
const MAX_LATEST_TEXT_SCALARS = 480;
const MAX_CONTEXT_SCALARS = 640;
const MAX_PROJECTED_INPUT_TOKENS = 1_200;

const SAFETY_STATE_SCHEMA = z.enum(['safe_for_model', 'unsafe', 'unknown']);
const SOURCE_SCHEMA = z
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
    safety: z
      .object({
        latestUserText: SAFETY_STATE_SCHEMA,
        activeStudyContext: SAFETY_STATE_SCHEMA.optional(),
      })
      .strict(),
  })
  .strict();

export type TutorV5ModelProjection = Readonly<{
  version: typeof TUTOR_V5_MODEL_PROJECTION_VERSION;
  latestText: string;
  activeContext: Readonly<{ available: boolean; excerpt?: string }>;
  localAuthority: TutorV5LocalSignalAuthority;
}>;

export type TutorV5ModelProjectionReasonCode =
  | ModelProjectionSafetyReasonCode
  | TutorV5LocalSignalAuthorityFailureCode
  | 'unsafe_metadata'
  | 'answer_direct_local_only'
  | 'explicit_instruction_local_only'
  | 'no_model_signal'
  | 'input_budget_exceeded';

export type TutorV5ModelProjectionResult =
  | Readonly<{ ok: true; value: TutorV5ModelProjection }>
  | Readonly<{ ok: false; reasonCode: TutorV5ModelProjectionReasonCode }>;

export function projectTutorV5ModelInput(input: unknown): TutorV5ModelProjectionResult {
  try {
    const cloned = clonePlainModelData(input);
    if (!cloned.ok) return { ok: false, reasonCode: 'invalid_input' };
    const parsed = SOURCE_SCHEMA.safeParse(cloned.value);
    if (!parsed.success) return { ok: false, reasonCode: 'invalid_input' };
    const source = parsed.data;
    const hasContext = source.activeStudyContext !== undefined;
    if (hasContext !== (source.safety.activeStudyContext !== undefined)) {
      return { ok: false, reasonCode: 'invalid_input' };
    }
    if (
      source.safety.latestUserText !== 'safe_for_model' ||
      source.safety.activeStudyContext === 'unsafe' ||
      source.safety.activeStudyContext === 'unknown'
    ) {
      return { ok: false, reasonCode: 'unsafe_metadata' };
    }

    const latest = scanCompleteModelField(source.latestUserText, {
      maxUtf16CodeUnits: MAX_SOURCE_FIELD_UTF16,
      rejectToolOrWriteInstruction: true,
    });
    if (!latest.ok) return latest;
    const context = hasContext
      ? scanCompleteModelField(source.activeStudyContext ?? '', {
          maxUtf16CodeUnits: MAX_SOURCE_FIELD_UTF16,
          rejectToolOrWriteInstruction: true,
        })
      : undefined;
    if (context !== undefined && !context.ok) return context;
    if (
      source.latestUserText.length + (source.activeStudyContext?.length ?? 0) >
      MAX_COMBINED_SOURCE_UTF16
    ) {
      return { ok: false, reasonCode: 'field_too_large' };
    }

    const authority = deriveTutorV5LocalSignalAuthority({
      latestUserText: source.latestUserText,
      ...(source.activeStudyContext !== undefined
        ? { activeStudyContext: source.activeStudyContext }
        : {}),
      safety: source.safety,
    });
    if (!authority.ok) return authority;
    if (authority.value.eligibleChoices.length === 0) {
      if (authority.value.reasonCode === 'explicit_instruction_local_only') {
        return { ok: false, reasonCode: 'explicit_instruction_local_only' };
      }
      if (authority.value.reasonCode === 'answer_direct_local_only') {
        return { ok: false, reasonCode: 'answer_direct_local_only' };
      }
      return { ok: false, reasonCode: 'no_model_signal' };
    }

    const projection: TutorV5ModelProjection = {
      version: TUTOR_V5_MODEL_PROJECTION_VERSION,
      latestText: truncateUnicodeScalars(latest.value, MAX_LATEST_TEXT_SCALARS),
      activeContext:
        context?.ok && context.value
          ? {
              available: true,
              excerpt: truncateUnicodeScalars(context.value, MAX_CONTEXT_SCALARS),
            }
          : { available: false },
      localAuthority: authority.value,
    };
    if (estimateCandidateInputTokens([JSON.stringify(projection)]) > MAX_PROJECTED_INPUT_TOKENS) {
      return { ok: false, reasonCode: 'input_budget_exceeded' };
    }
    return { ok: true, value: deepFreezeModelValue(projection) };
  } catch {
    return { ok: false, reasonCode: 'invalid_input' };
  }
}
