import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireCapability as Phase697V8WireCapability,
} from '@repo/ai';
import { z } from 'zod';

import type { Phase697V8Harness } from '../../src/evals/run-phase-6-9-tutor-wrong-question-v8-paired.ts';
import {
  createPhase697V6SyntheticHarness,
  failedRuntimeResult,
  successfulOrganizerResult,
  successfulTutorResult,
  unknownUsageRuntimeResult,
} from './phase-6-9-tutor-organizer-v6-runner.ts';
import { diagnoseWrongQuestionOrganizerV8Schema } from '../../src/model-candidates/wrong-question-organizer-v8-schema-diagnostic.ts';

export function createPhase697V8SyntheticHarness(input?: {
  runId?: string;
  runScope?: 'branch' | 'main';
  mode?: 'mock' | 'live';
  onDelegate?: () => void;
  returnFailureAfterWireError?: boolean;
}): Phase697V8Harness {
  const runId = input?.runId ?? '00000000-0000-4000-8000-000000000701';
  const mode = input?.mode ?? 'mock';
  const base = createPhase697V6SyntheticHarness({ runId, mode });
  return Object.freeze({
    runId,
    runScope: input?.runScope ?? 'branch',
    mode,
    provider: mode === 'mock' ? 'mock' : 'deepseek',
    model: mode === 'mock' ? 'mock' : 'deepseek-v4-pro',
    structuredOutputMode: mode === 'mock' ? 'mock_json_v8' : 'deepseek_v4_pro_direct_json',
    executorProvenance: mode === 'mock' ? 'mock_synthetic' : 'synthetic_test',
    runZeroCall: base.runZeroCall,
    async runTutor(entry, signal, capability) {
      try {
        await completePhase697V8SyntheticWire(capability, signal, input?.onDelegate);
      } catch (error) {
        if (!input?.returnFailureAfterWireError) throw error;
        return unknownUsageRuntimeResult();
      }
      return successfulTutorResult(entry);
    },
    async runOrganizer(entry, signal, capability) {
      try {
        await completePhase697V8SyntheticWire(capability, signal, input?.onDelegate);
      } catch (error) {
        if (!input?.returnFailureAfterWireError) throw error;
        return Object.freeze({
          ...unknownUsageRuntimeResult(),
          boundedSchemaDiagnostic: null,
        });
      }
      return Object.freeze({
        ...successfulOrganizerResult(entry),
        boundedSchemaDiagnostic: null,
      });
    },
  });
}

export function createPhase697V8SchemaFailureHarness(input?: {
  runId?: string;
  runScope?: 'branch' | 'main';
  mode?: 'mock' | 'live';
  pairedRunIndex?: number;
}): Phase697V8Harness {
  const base = createPhase697V8SyntheticHarness(input);
  const malformedDecision = Object.freeze({ unexpected: true });
  const diagnostic = diagnoseWrongQuestionOrganizerV8Schema(malformedDecision);
  if (diagnostic === null) throw new Error('V8 synthetic schema diagnostic unavailable');
  const pairedRunIndex = input?.pairedRunIndex ?? 0;
  return Object.freeze({
    ...base,
    async runOrganizer(entry, signal, capability) {
      if (entry.pairedRunIndex !== pairedRunIndex) {
        return base.runOrganizer(entry, signal, capability);
      }
      await failPhase697V8SyntheticWireAtSchema(capability, signal, malformedDecision);
      return Object.freeze({
        ...failedRuntimeResult('structured_output'),
        providerFailureCategory: 'structured_output' as const,
        structuredOutputStage: 'provider_type_validation' as const,
        usage: null,
        usageDisposition: 'unknown_after_attempt' as const,
        boundedSchemaDiagnostic: diagnostic,
      });
    },
  });
}

export async function completePhase697V8SyntheticWire(
  capability: Phase697V8WireCapability,
  signal: AbortSignal,
  onDelegate?: () => void,
) {
  await executePhase697V8SyntheticWire({
    capability,
    signal,
    content: '{"ok":true}',
    onDelegate,
  });
}

async function failPhase697V8SyntheticWireAtSchema(
  capability: Phase697V8WireCapability,
  signal: AbortSignal,
  malformedDecision: unknown,
): Promise<void> {
  try {
    await executePhase697V8SyntheticWire({
      capability,
      signal,
      content: JSON.stringify(malformedDecision),
    });
  } catch {
    return;
  }
  throw new Error('V8 synthetic schema failure was not observed');
}

async function executePhase697V8SyntheticWire(input: {
  capability: Phase697V8WireCapability;
  signal: AbortSignal;
  content: string;
  onDelegate?: () => void;
}) {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: 'v8-r3-synthetic-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
    },
    input.capability,
    {
      fetch: async () => {
        input.onDelegate?.();
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: input.content } }],
            usage: {
              prompt_tokens: 8,
              completion_tokens: 2,
              completion_tokens_details: { reasoning_tokens: 0 },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    },
  );
  await adapter.executor({
    schema: z.object({ ok: z.literal(true) }).strict(),
    systemPrompt: 'V8 R3 synthetic wire contract',
    userPrompt: '{}',
    maxOutputTokens: 8,
    signal: input.signal,
  });
}
