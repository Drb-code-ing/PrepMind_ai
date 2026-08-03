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
import {
  deriveTutorV6PreferredDepthAuthority,
  type TutorV6PreferredDepthAuthority,
  type TutorV6PreferredDepthFailureCode,
} from './tutor-v6-preferred-depth-authority.ts';

export const TUTOR_V6_MODEL_PROJECTION_VERSION = 'tutor-model-projection-v6' as const;

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
    safety: z
      .object({
        latestUserText: SAFETY_STATE_SCHEMA,
        activeStudyContext: SAFETY_STATE_SCHEMA.optional(),
      })
      .strict(),
  })
  .strict();

export type TutorV6ModelPromptProjection = Readonly<{
  version: typeof TUTOR_V6_MODEL_PROJECTION_VERSION;
  latestText: string;
  activeContext: Readonly<{ available: boolean; excerpt?: string }>;
  authorityBinding: Readonly<{
    localSignalAuthoritySha256: string;
    localStrategyAuthoritySha256: string;
  }>;
  eligibleIntents: readonly Readonly<{
    intentIndex: number;
    intent: TutorV6PreferredDepthAuthority['choices'][number]['intent'];
  }>[];
}>;

export type TutorV6ModelProjection = Readonly<{
  prompt: TutorV6ModelPromptProjection;
  signalAuthority: TutorV5LocalSignalAuthority;
  preferredDepthAuthority: TutorV6PreferredDepthAuthority;
}>;

export type TutorV6ModelProjectionReasonCode =
  | ModelProjectionSafetyReasonCode
  | TutorV5LocalSignalAuthorityFailureCode
  | TutorV6PreferredDepthFailureCode
  | 'unsafe_metadata'
  | 'answer_direct_local_only'
  | 'explicit_instruction_local_only'
  | 'no_model_signal'
  | 'input_budget_exceeded';

export type TutorV6ModelProjectionResult =
  | Readonly<{ ok: true; value: TutorV6ModelProjection }>
  | Readonly<{ ok: false; reasonCode: TutorV6ModelProjectionReasonCode }>;

export function projectTutorV6ModelInput(input: unknown): TutorV6ModelProjectionResult {
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

    const signalAuthority = deriveTutorV5LocalSignalAuthority({
      latestUserText: source.latestUserText,
      ...(source.activeStudyContext !== undefined
        ? { activeStudyContext: source.activeStudyContext }
        : {}),
      safety: source.safety,
    });
    if (!signalAuthority.ok) return signalAuthority;
    if (signalAuthority.value.eligibleChoices.length === 0) {
      if (signalAuthority.value.reasonCode === 'explicit_instruction_local_only') {
        return { ok: false, reasonCode: 'explicit_instruction_local_only' };
      }
      if (signalAuthority.value.reasonCode === 'answer_direct_local_only') {
        return { ok: false, reasonCode: 'answer_direct_local_only' };
      }
      return { ok: false, reasonCode: 'no_model_signal' };
    }
    const preferredDepthAuthority = deriveTutorV6PreferredDepthAuthority({
      activeContextAvailable: signalAuthority.value.input.activeContextAvailable,
      eligibleIntents: signalAuthority.value.eligibleChoices.map((choice) => choice.intent),
    });
    if (!preferredDepthAuthority.ok) return preferredDepthAuthority;

    const prompt = deepFreezeModelValue({
      version: TUTOR_V6_MODEL_PROJECTION_VERSION,
      latestText: truncateUnicodeScalars(latest.value, MAX_LATEST_TEXT_SCALARS),
      activeContext:
        context?.ok && context.value
          ? {
              available: true,
              excerpt: truncateUnicodeScalars(context.value, MAX_CONTEXT_SCALARS),
            }
          : { available: false },
      authorityBinding: {
        localSignalAuthoritySha256: signalAuthority.value.authoritySha256,
        localStrategyAuthoritySha256: preferredDepthAuthority.value.authoritySha256,
      },
      eligibleIntents: preferredDepthAuthority.value.choices.map((choice) => ({
        intentIndex: choice.ordinal,
        intent: choice.intent,
      })),
    });
    if (estimateCandidateInputTokens([JSON.stringify(prompt)]) > MAX_PROJECTED_INPUT_TOKENS) {
      return { ok: false, reasonCode: 'input_budget_exceeded' };
    }
    return {
      ok: true,
      value: deepFreezeModelValue({
        prompt,
        signalAuthority: signalAuthority.value,
        preferredDepthAuthority: preferredDepthAuthority.value,
      }),
    };
  } catch {
    return { ok: false, reasonCode: 'invalid_input' };
  }
}
