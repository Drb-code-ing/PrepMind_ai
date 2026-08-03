import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type FirstPartyDeepSeekV4ProDirectAdapter,
  type FirstPartyDeepSeekV4ProDirectConfig,
  type Phase697V7WireCapability,
} from '@repo/ai';

import { runPhase697V6ZeroCallCase } from './phase-6-9-tutor-wrong-question-v6-eval-case.ts';
import {
  PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
  PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
  PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
  resolvePhase697V6LiveConfiguration,
  runPhase697V6OrganizerRuntimeCase,
  runPhase697V6TutorRuntimeCase,
  type Phase697V6LiveConfiguration,
} from './phase-6-9-tutor-wrong-question-v6-live.ts';
import type { Phase697V7Harness } from './run-phase-6-9-tutor-wrong-question-v7-paired.ts';

export type Phase697V7LiveConfiguration = Phase697V6LiveConfiguration;

type AdapterFactory = (
  config: FirstPartyDeepSeekV4ProDirectConfig,
  capability: Phase697V7WireCapability,
) => FirstPartyDeepSeekV4ProDirectAdapter;

export function resolvePhase697V7LiveConfiguration(
  env: Readonly<Record<string, string | undefined>>,
): ReturnType<typeof resolvePhase697V6LiveConfiguration> {
  return resolvePhase697V6LiveConfiguration(env);
}

export function createPhase697TutorOrganizerV7LiveHarness(input: {
  configuration: Readonly<Phase697V7LiveConfiguration>;
  runId: string;
  runScope: 'branch' | 'main';
  adapterFactory?: AdapterFactory;
}): Readonly<Phase697V7Harness> {
  const adapterFactory = input.adapterFactory ?? createFirstPartyDeepSeekV4ProDirectAdapter;
  const executorProvenance = input.adapterFactory
    ? ('synthetic_test' as const)
    : ('first_party_deepseek_v4_pro_direct' as const);
  const createExecutor = (apiKey: string, capability: Phase697V7WireCapability) => {
    const adapter = adapterFactory(
      {
        provider: 'deepseek',
        apiKey,
        baseURL: PHASE_6_9_7_V6_DEEPSEEK_BASE_URL,
        model: 'deepseek-v4-pro',
      },
      capability,
    );
    if (adapter.provenance !== executorProvenance) {
      throw new Error('PHASE_6_9_7_V7_ADAPTER_PROVENANCE_INVALID');
    }
    return adapter.executor;
  };

  return Object.freeze({
    runId: input.runId,
    runScope: input.runScope,
    mode: 'live',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    structuredOutputMode: 'deepseek_v4_pro_direct_json',
    executorProvenance,
    runZeroCall: async (entry) => runPhase697V6ZeroCallCase(entry),
    runTutor: (entry, signal, capability) =>
      runPhase697V6TutorRuntimeCase(
        entry,
        signal,
        input.runId,
        createExecutor(input.configuration.tutorApiKey, capability),
        PHASE_6_9_7_V6_TUTOR_TIMEOUT_MS,
      ),
    runOrganizer: (entry, signal, capability) =>
      runPhase697V6OrganizerRuntimeCase(
        entry,
        signal,
        input.runId,
        createExecutor(input.configuration.organizerApiKey, capability),
        PHASE_6_9_7_V6_ORGANIZER_TIMEOUT_MS,
      ),
  });
}
