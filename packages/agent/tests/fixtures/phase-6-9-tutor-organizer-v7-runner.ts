import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireCapability,
} from '@repo/ai';
import { z } from 'zod';

import type { Phase697V7Harness } from '../../src/evals/run-phase-6-9-tutor-wrong-question-v7-paired.ts';
import {
  createPhase697V6SyntheticHarness,
  successfulOrganizerResult,
  successfulTutorResult,
  unknownUsageRuntimeResult,
} from './phase-6-9-tutor-organizer-v6-runner.ts';

export function createPhase697V7SyntheticHarness(input?: {
  runId?: string;
  runScope?: 'branch' | 'main';
  mode?: 'mock' | 'live';
  onDelegate?: () => void;
  returnFailureAfterWireError?: boolean;
}): Phase697V7Harness {
  const runId = input?.runId ?? '00000000-0000-4000-8000-000000000701';
  const mode = input?.mode ?? 'mock';
  const base = createPhase697V6SyntheticHarness({ runId, mode });
  return Object.freeze({
    runId,
    runScope: input?.runScope ?? 'branch',
    mode,
    provider: mode === 'mock' ? 'mock' : 'deepseek',
    model: mode === 'mock' ? 'mock' : 'deepseek-v4-pro',
    structuredOutputMode: mode === 'mock' ? 'mock_json_v7' : 'deepseek_v4_pro_direct_json',
    executorProvenance: mode === 'mock' ? 'mock_synthetic' : 'synthetic_test',
    runZeroCall: base.runZeroCall,
    async runTutor(entry, signal, capability) {
      try {
        await completePhase697V7SyntheticWire(capability, signal, input?.onDelegate);
      } catch (error) {
        if (!input?.returnFailureAfterWireError) throw error;
        return unknownUsageRuntimeResult();
      }
      return successfulTutorResult(entry);
    },
    async runOrganizer(entry, signal, capability) {
      try {
        await completePhase697V7SyntheticWire(capability, signal, input?.onDelegate);
      } catch (error) {
        if (!input?.returnFailureAfterWireError) throw error;
        return unknownUsageRuntimeResult();
      }
      return successfulOrganizerResult(entry);
    },
  });
}

export async function completePhase697V7SyntheticWire(
  capability: Phase697V7WireCapability,
  signal: AbortSignal,
  onDelegate?: () => void,
) {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: 'v7-r2-synthetic-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
    },
    capability,
    {
      fetch: async () => {
        onDelegate?.();
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"ok":true}' } }],
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
    systemPrompt: 'V7 R2 synthetic wire contract',
    userPrompt: '{}',
    maxOutputTokens: 8,
    signal,
  });
}
