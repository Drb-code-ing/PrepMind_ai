import {
  createFirstPartyDeepSeekV4ProDirectAdapter,
  type Phase697V7WireCapability as Phase697V9WireCapability,
} from '@repo/ai';
import { z } from 'zod';

import type { Phase697V9Harness } from '../../src/evals/run-phase-6-9-tutor-wrong-question-v9-paired.ts';
import {
  createPhase697V6SyntheticHarness,
  failedRuntimeResult,
  successfulOrganizerResult,
  successfulTutorResult,
  unknownUsageRuntimeResult,
} from './phase-6-9-tutor-organizer-v6-runner.ts';
import { diagnoseWrongQuestionOrganizerV9Schema } from '../../src/model-candidates/wrong-question-organizer-v9-schema-diagnostic.ts';

export function createPhase697V9SyntheticHarness(input?: {
  runId?: string;
  runScope?: 'branch' | 'main';
  mode?: 'mock' | 'live';
  onDelegate?: (caseId: string) => void;
  returnFailureAfterWireError?: boolean;
}): Phase697V9Harness {
  const runId = input?.runId ?? '00000000-0000-4000-8000-000000000701';
  const mode = input?.mode ?? 'mock';
  const base = createPhase697V6SyntheticHarness({ runId, mode });
  return Object.freeze({
    runId,
    runScope: input?.runScope ?? 'branch',
    mode,
    provider: mode === 'mock' ? 'mock' : 'deepseek',
    model: mode === 'mock' ? 'mock' : 'deepseek-v4-pro',
    structuredOutputMode: mode === 'mock' ? 'mock_json_v9' : 'deepseek_v4_pro_direct_json',
    executorProvenance: mode === 'mock' ? 'mock_synthetic' : 'synthetic_test',
    runZeroCall: base.runZeroCall,
    async runTutor(entry, signal, capability) {
      try {
        await completePhase697V9SyntheticWire(capability, signal, () =>
          input?.onDelegate?.(entry.id),
        );
      } catch (error) {
        if (!input?.returnFailureAfterWireError) throw error;
        return unknownUsageRuntimeResult();
      }
      return successfulTutorResult(entry);
    },
    async runOrganizer(entry, signal, capability) {
      try {
        await completePhase697V9SyntheticWire(capability, signal, () =>
          input?.onDelegate?.(entry.id),
        );
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

export function createPhase697V9SchemaFailureHarness(input?: {
  runId?: string;
  runScope?: 'branch' | 'main';
  mode?: 'mock' | 'live';
  pairedRunIndex?: number;
}): Phase697V9Harness {
  const base = createPhase697V9SyntheticHarness(input);
  const malformedDecision = Object.freeze({ unexpected: true });
  const diagnostic = diagnoseWrongQuestionOrganizerV9Schema(malformedDecision);
  if (diagnostic === null) throw new Error('V9 synthetic schema diagnostic unavailable');
  const pairedRunIndex = input?.pairedRunIndex ?? 0;
  return Object.freeze({
    ...base,
    async runOrganizer(entry, signal, capability) {
      if (entry.pairedRunIndex !== pairedRunIndex) {
        return base.runOrganizer(entry, signal, capability);
      }
      await failPhase697V9SyntheticWireAtSchema(capability, signal, malformedDecision);
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

export const PHASE_6_9_7_V9_SYNTHETIC_FAULTS = [
  'transport',
  'http_server',
  'schema',
  'usage',
  'wait_for_abort',
  'selection_coverage',
  'selection_authority',
  'option_authority',
] as const;

export type Phase697V9SyntheticFault = (typeof PHASE_6_9_7_V9_SYNTHETIC_FAULTS)[number];

export function createPhase697V9FaultHarness(input: {
  runId: string;
  faults: Readonly<Record<string, Phase697V9SyntheticFault | undefined>>;
  onDelegate?: (caseId: string) => void;
}): Phase697V9Harness {
  const base = createPhase697V9SyntheticHarness({
    runId: input.runId,
    onDelegate: input.onDelegate,
  });
  return Object.freeze({
    ...base,
    async runTutor(entry, signal, capability) {
      const fault = input.faults[entry.id];
      if (isSelectionFault(fault)) throw new Error('V9 synthetic Tutor selection fault invalid');
      if (fault === undefined) return base.runTutor(entry, signal, capability);
      try {
        await executePhase697V9SyntheticWire({
          capability,
          signal,
          content: '{"ok":true}',
          fault,
          onDelegate: () => input.onDelegate?.(entry.id),
        });
      } catch {
        return failedPhase697V9WireResult(fault, signal);
      }
      throw new Error('V9 synthetic Tutor fault was not observed');
    },
    async runOrganizer(entry, signal, capability) {
      const fault = input.faults[entry.id];
      if (fault === undefined) return base.runOrganizer(entry, signal, capability);
      if (isSelectionFault(fault)) {
        await completePhase697V9SyntheticWire(capability, signal, () =>
          input.onDelegate?.(entry.id),
        );
        const diagnostic = diagnoseWrongQuestionOrganizerV9Schema(
          { decisions: [{ questionIndex: 0, optionIndex: 0 }] },
          fault,
        );
        if (diagnostic === null) throw new Error('V9 synthetic selection diagnostic unavailable');
        return Object.freeze({
          ...failedRuntimeResult(
            fault === 'option_authority' ? 'local_merger' : 'dynamic_contract',
          ),
          boundedSchemaDiagnostic: diagnostic,
        });
      }
      try {
        await executePhase697V9SyntheticWire({
          capability,
          signal,
          content: '{"ok":true}',
          fault,
          onDelegate: () => input.onDelegate?.(entry.id),
        });
      } catch {
        return Object.freeze({
          ...failedPhase697V9WireResult(fault, signal),
          boundedSchemaDiagnostic:
            fault === 'schema'
              ? diagnoseWrongQuestionOrganizerV9Schema({ unexpected: true })
              : null,
        });
      }
      throw new Error('V9 synthetic Organizer fault was not observed');
    },
  });
}

export async function completePhase697V9SyntheticWire(
  capability: Phase697V9WireCapability,
  signal: AbortSignal,
  onDelegate?: () => void,
) {
  await executePhase697V9SyntheticWire({
    capability,
    signal,
    content: '{"ok":true}',
    onDelegate,
  });
}

async function failPhase697V9SyntheticWireAtSchema(
  capability: Phase697V9WireCapability,
  signal: AbortSignal,
  malformedDecision: unknown,
): Promise<void> {
  try {
    await executePhase697V9SyntheticWire({
      capability,
      signal,
      content: JSON.stringify(malformedDecision),
    });
  } catch {
    return;
  }
  throw new Error('V9 synthetic schema failure was not observed');
}

async function executePhase697V9SyntheticWire(input: {
  capability: Phase697V9WireCapability;
  signal: AbortSignal;
  content: string;
  fault?: Exclude<
    Phase697V9SyntheticFault,
    'selection_coverage' | 'selection_authority' | 'option_authority'
  >;
  onDelegate?: () => void;
}) {
  const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
    {
      provider: 'deepseek',
      apiKey: 'v9-r3-synthetic-key',
      baseURL: 'https://api.deepseek.com/v1',
      model: 'deepseek-v4-pro',
    },
    input.capability,
    {
      fetch: async (_url, init) => {
        input.onDelegate?.();
        if (input.fault === 'transport') {
          throw new Error('V9_R3_SYNTHETIC_TRANSPORT');
        }
        if (input.fault === 'http_server') {
          return new Response('V9_R3_SYNTHETIC_HTTP_SERVER', { status: 503 });
        }
        if (input.fault === 'wait_for_abort') {
          return rejectPhase697V9WhenAborted(init?.signal);
        }
        const content = input.fault === 'schema' ? '{"unexpected":true}' : input.content;
        const usage =
          input.fault === 'usage'
            ? {
                prompt_tokens: 0,
                completion_tokens: 2,
                completion_tokens_details: { reasoning_tokens: 0 },
              }
            : {
                prompt_tokens: 8,
                completion_tokens: 2,
                completion_tokens_details: { reasoning_tokens: 0 },
              };
        return new Response(
          JSON.stringify({
            choices: [{ message: { content } }],
            usage,
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      },
    },
  );
  await adapter.executor({
    schema: z.object({ ok: z.literal(true) }).strict(),
    systemPrompt: 'V9 R3 synthetic wire contract',
    userPrompt: '{}',
    maxOutputTokens: 8,
    signal: input.signal,
  });
}

function isSelectionFault(
  fault: Phase697V9SyntheticFault | undefined,
): fault is 'selection_coverage' | 'selection_authority' | 'option_authority' {
  return (
    fault === 'selection_coverage' ||
    fault === 'selection_authority' ||
    fault === 'option_authority'
  );
}

function failedPhase697V9WireResult(
  fault: Exclude<
    Phase697V9SyntheticFault,
    'selection_coverage' | 'selection_authority' | 'option_authority'
  >,
  signal: AbortSignal,
) {
  if (fault === 'schema') {
    return Object.freeze({
      ...failedRuntimeResult('structured_output'),
      providerFailureCategory: 'structured_output' as const,
      structuredOutputStage: 'provider_type_validation' as const,
      usage: null,
      usageDisposition: 'unknown_after_attempt' as const,
    });
  }
  if (fault === 'transport' || fault === 'http_server') {
    return Object.freeze({
      ...unknownUsageRuntimeResult(),
      failureCategory: 'provider_runtime' as const,
      providerFailureCategory: fault,
    });
  }
  if (fault === 'usage') {
    return Object.freeze({
      ...unknownUsageRuntimeResult(),
      failureCategory: 'usage_unknown' as const,
      providerFailureCategory: 'unknown' as const,
    });
  }
  return Object.freeze({
    ...unknownUsageRuntimeResult(),
    failureCategory: signal.aborted
      ? ('post_dispatch_abort' as const)
      : ('provider_runtime' as const),
    providerFailureCategory: null,
    terminalHint: 'attempted_aborted' as const,
  });
}

function rejectPhase697V9WhenAborted(signal: AbortSignal | null | undefined): Promise<Response> {
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error('V9_R3_SYNTHETIC_ABORT_SIGNAL_MISSING'));
      return;
    }
    const rejectAborted = () => reject(new Error('V9_R3_SYNTHETIC_ABORTED'));
    if (signal.aborted) {
      rejectAborted();
      return;
    }
    signal.addEventListener('abort', rejectAborted, { once: true });
  });
}
