import { createHash } from 'node:crypto';

import {
  createFinalResponseStreamDiagnosticProvider,
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createPhase698ProviderWireDiagnostics,
  createPhase697V7WireDiagnostics,
  createQwenTextEmbeddingV4DiagnosticProvider,
  FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
  FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
  FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
  QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
  QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE,
  QWEN_TEXT_EMBEDDING_V4_MODEL,
  QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
  calculateQwenTextEmbeddingV4CostCny,
  readPhase698ProviderWireSnapshot,
  readPhase697V7WireSnapshot,
  type Phase698ProviderWireSnapshot,
  type Phase697V7WireSnapshot,
} from '@repo/ai';
import { z } from 'zod';

import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_SCHEMA,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES,
  phase698TransportEvidenceStagesBefore,
  phase698TransportEvidenceWireForBoundary,
  type Phase698TransportEvidenceDiagnostic,
  type Phase698TransportEvidenceProviderBoundary,
  type Phase698TransportEvidenceProviderWire,
  type Phase698TransportEvidenceRunnerWire,
} from './phase-6-9-8-retriever-final-response-transport-evidence-contract.ts';
import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER,
  type Phase698TransportEvidenceT3Slot,
} from './phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.ts';
import { PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_SPECS } from './phase-6-9-8-retriever-final-response-transport-evidence-t3-runner.ts';

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_VERSION =
  'phase-6.9.8-retriever-final-response-transport-evidence-t3-controlled-live-v1' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY =
  'controlled_live_transport_evidence_t3' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE =
  'transport_evidence_t3_controlled_canary_passed' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE_FAILED =
  'transport_evidence_t3_controlled_canary_failed' as const;
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_QWEN_BASE_URL =
  'https://dashscope.aliyuncs.com/compatible-mode/v1' as const;

export type Phase698TransportEvidenceT3ControlledCredentials = Readonly<{
  rewriteDeepseekApiKey: string;
  qwenApiKey: string;
  finalResponseDeepseekApiKey: string;
  qwenBaseURL: typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_QWEN_BASE_URL;
}>;

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_FAILURE_CODES = Object.freeze([
  'configuration_invalid',
  'aborted',
  'timeout',
  'provider_error',
  'diagnostic_invalid',
] as const);
export type Phase698TransportEvidenceT3ControlledFailureCode =
  (typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_FAILURE_CODES)[number];

const WIRE = z
  .object({
    reservations: z.union([z.literal(0), z.literal(1)]),
    dispatches: z.union([z.literal(0), z.literal(1)]),
    harnessReturns: z.union([z.literal(0), z.literal(1)]),
    verifiedResults: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();
const PROVIDER_WIRE = z
  .object({
    executions: z.union([z.literal(0), z.literal(1)]),
    dispatches: z.union([z.literal(0), z.literal(1)]),
    responses: z.union([z.literal(0), z.literal(1)]),
    verifiedUsage: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();
const USAGE = z
  .object({
    inputTokens: z.number().int().positive(),
    outputTokens: z.number().int().nonnegative(),
  })
  .strict();
export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_SLOT_SCHEMA = z
  .object({
    slot: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER),
    provider: z.enum(['deepseek', 'qwen']),
    sequence: z.number().int().min(1).max(3),
    disposition: z.enum([
      'accepted',
      'failed',
      'timeout',
      'aborted',
      'configuration_invalid',
      'not_started_quality_breaker',
      'not_started_external_abort',
    ]),
    failureCode: z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_FAILURE_CODES).nullable(),
    runnerWire: WIRE,
    providerWire: PROVIDER_WIRE,
    providerCalls: z.union([z.literal(0), z.literal(1)]),
    credentialReads: z.union([z.literal(0), z.literal(1)]),
    usage: USAGE.nullable(),
    verifiedCostCny: z.number().nonnegative().finite().nullable(),
    durationMs: z.number().nonnegative().finite().nullable(),
    diagnostic: PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_SCHEMA.nullable(),
    rawDataRetained: z.literal(false),
  })
  .strict();

export const PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA = z
  .object({
    version: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE),
    authority: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY),
    qualityAuthority: z.literal('none'),
    gate: z.enum([
      PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE,
      PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE_FAILED,
    ]),
    passed: z.boolean(),
    slotCount: z.literal(3),
    startedSlots: z.number().int().min(0).max(3),
    completedSlots: z.number().int().min(0).max(3),
    notStartedQualityBreaker: z.number().int().min(0).max(3),
    notStartedExternalAbort: z.number().int().min(0).max(3),
    providerCalls: z.number().int().min(0).max(3),
    credentialReads: z.number().int().min(0).max(3),
    verifiedUsageSlots: z.number().int().min(0).max(3),
    verifiedCostCny: z.number().nonnegative().finite().nullable(),
    budgetCnyMax: z.literal(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY),
    breaker: z
      .object({
        open: z.boolean(),
        reason: z.enum(['none', 'quality_failure', 'timeout', 'external_abort', 'configuration']),
        openedAtSequence: z.number().int().min(1).max(3).nullable(),
      })
      .strict(),
    slotOrder: z.array(z.enum(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER)).length(3),
    slots: z.array(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_SLOT_SCHEMA).length(3),
    rawDataRetained: z.literal(false),
  })
  .strict()
  .superRefine((report, context) => {
    if (
      report.slotOrder.some(
        (slot, index) => slot !== PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER[index],
      )
    ) {
      context.addIssue({ code: 'custom', message: 'slot order mismatch' });
    }
    if (
      report.slots.some(
        (slot, index) => slot.slot !== report.slotOrder[index] || slot.sequence !== index + 1,
      )
    ) {
      context.addIssue({ code: 'custom', message: 'slot sequence mismatch' });
    }
    const started = report.slots.filter(
      (slot) => !slot.disposition.startsWith('not_started_'),
    ).length;
    const completed = report.slots.filter(
      (slot) => !slot.disposition.startsWith('not_started_'),
    ).length;
    const suffixQuality = report.slots.filter(
      (slot) => slot.disposition === 'not_started_quality_breaker',
    ).length;
    const suffixAbort = report.slots.filter(
      (slot) => slot.disposition === 'not_started_external_abort',
    ).length;
    const providerCalls = report.slots.reduce((sum, slot) => sum + slot.providerCalls, 0);
    const credentialReads = report.slots.reduce((sum, slot) => sum + slot.credentialReads, 0);
    const verifiedUsage = report.slots.reduce(
      (sum, slot) => sum + slot.providerWire.verifiedUsage,
      0,
    );
    if (
      started !== report.startedSlots ||
      completed !== report.completedSlots ||
      suffixQuality !== report.notStartedQualityBreaker ||
      suffixAbort !== report.notStartedExternalAbort ||
      providerCalls !== report.providerCalls ||
      credentialReads !== report.credentialReads ||
      verifiedUsage !== report.verifiedUsageSlots
    ) {
      context.addIssue({ code: 'custom', message: 'slot accounting mismatch' });
    }
    if (report.passed !== (report.gate === PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE)) {
      context.addIssue({ code: 'custom', message: 'gate mismatch' });
    }
    if (report.providerCalls > 3 || report.credentialReads > 3) {
      context.addIssue({ code: 'custom', message: 'budget boundary crossed' });
    }
  });
export type Phase698TransportEvidenceT3ControlledReport = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA
>;

type Slot = Phase698TransportEvidenceT3Slot;
export type Phase698TransportEvidenceT3ControlledSlot = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_SLOT_SCHEMA
>;
type SlotExecution = Readonly<{
  disposition: Exclude<
    Phase698TransportEvidenceT3ControlledSlot['disposition'],
    'not_started_quality_breaker' | 'not_started_external_abort'
  >;
  failureCode: Phase698TransportEvidenceT3ControlledFailureCode | null;
  usage: { inputTokens: number; outputTokens: number } | null;
  verifiedCostCny: number | null;
  diagnostic: Phase698TransportEvidenceDiagnostic | null;
  runnerWire: Phase698TransportEvidenceRunnerWire;
  providerWire: Phase698TransportEvidenceProviderWire;
  providerCalls: 0 | 1;
  credentialReads: 0 | 1;
  durationMs: number;
}>;

type ProviderSnapshots = {
  providerWire: Phase698TransportEvidenceProviderWire;
  providerSnapshot: Phase698ProviderWireSnapshot | null;
  v7Snapshot: Phase697V7WireSnapshot | null;
};

type SnapshotReader = () => ProviderSnapshots;

const REWRITE_SYSTEM_PROMPT =
  'You are a transport canary. Return strict JSON {"rewrittenQuery":"..."} only.';
const REWRITE_USER_PROMPT =
  '{"originalQuery":"这一步如何验证检索链路？","recentTurns":[{"role":"user","content":"我们正在做 RAG transport 验收。"}],"activeContext":{"question":"RAG transport 验收","goal":"确认链路可用"}}';
const FINAL_SYSTEM_PROMPT =
  'You are a transport canary. Answer briefly from the supplied context. Do not call tools.';
const FINAL_USER_PROMPT =
  '请用一句话说明本次受限 transport canary 的目的；只输出自然语言，不要声称已保存或调用工具。';
const REWRITE_SCHEMA = z.object({ rewrittenQuery: z.string().min(1).max(2_000) }).strict();

export async function runPhase698TransportEvidenceT3ControlledLive(input: {
  runId: string;
  credentials: Phase698TransportEvidenceT3ControlledCredentials;
  signal: AbortSignal;
  onSlotTerminal?(slot: Phase698TransportEvidenceT3ControlledSlot): Promise<void>;
}): Promise<Phase698TransportEvidenceT3ControlledReport> {
  const normalized = normalizeInput(input);
  const slots: Phase698TransportEvidenceT3ControlledSlot[] = [];
  let breaker: {
    open: boolean;
    reason: 'none' | 'quality_failure' | 'timeout' | 'external_abort' | 'configuration';
    openedAtSequence: number | null;
  } = { open: false, reason: 'none', openedAtSequence: null };

  for (let index = 0; index < PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER.length; index += 1) {
    const slot = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER[index];
    const sequence = index + 1;
    if (breaker.open) {
      const terminal = notStarted(slot, sequence, breaker.reason === 'external_abort');
      slots.push(terminal);
      await normalized.onSlotTerminal?.(terminal);
      continue;
    }
    if (normalized.signal.aborted) {
      breaker = { open: true, reason: 'external_abort', openedAtSequence: sequence };
      const terminal = notStarted(slot, sequence, true);
      slots.push(terminal);
      await normalized.onSlotTerminal?.(terminal);
      continue;
    }
    const execution = await executeSlot(slot, sequence, normalized);
    const terminal = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_SLOT_SCHEMA.parse({
      slot,
      provider: slot === 'qwen' ? 'qwen' : 'deepseek',
      sequence,
      disposition: execution.disposition,
      failureCode: execution.failureCode,
      runnerWire: execution.runnerWire,
      providerWire: execution.providerWire,
      providerCalls: execution.providerCalls,
      credentialReads: execution.credentialReads,
      usage: execution.usage,
      verifiedCostCny: execution.verifiedCostCny,
      durationMs: execution.durationMs,
      diagnostic: execution.diagnostic,
      rawDataRetained: false,
    });
    slots.push(terminal);
    await normalized.onSlotTerminal?.(terminal);
    if (execution.disposition !== 'accepted') {
      breaker = {
        open: true,
        reason:
          execution.disposition === 'aborted'
            ? 'external_abort'
            : execution.disposition === 'timeout'
              ? 'timeout'
              : execution.disposition === 'configuration_invalid'
                ? 'configuration'
                : 'quality_failure',
        openedAtSequence: sequence,
      };
    }
  }

  const parsedSlots = slots.map((slot) =>
    PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_SLOT_SCHEMA.parse(slot),
  );
  const providerCalls = parsedSlots.reduce((sum, slot) => sum + slot.providerCalls, 0);
  const credentialReads = parsedSlots.reduce((sum, slot) => sum + slot.credentialReads, 0);
  const verifiedUsageSlots = parsedSlots.reduce(
    (sum, slot) => sum + slot.providerWire.verifiedUsage,
    0,
  );
  const allAccepted = parsedSlots.every((slot) => slot.disposition === 'accepted');
  const verifiedCostCny = allAccepted
    ? Number(parsedSlots.reduce((sum, slot) => sum + (slot.verifiedCostCny ?? 0), 0).toFixed(9))
    : null;
  const report = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_REPORT_SCHEMA.parse({
    version: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_AUTHORITY,
    qualityAuthority: 'none',
    gate: allAccepted
      ? PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE
      : PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_GATE_FAILED,
    passed: allAccepted,
    slotCount: 3,
    startedSlots: parsedSlots.filter((slot) => !slot.disposition.startsWith('not_started_')).length,
    completedSlots: parsedSlots.filter((slot) => !slot.disposition.startsWith('not_started_'))
      .length,
    notStartedQualityBreaker: parsedSlots.filter(
      (slot) => slot.disposition === 'not_started_quality_breaker',
    ).length,
    notStartedExternalAbort: parsedSlots.filter(
      (slot) => slot.disposition === 'not_started_external_abort',
    ).length,
    providerCalls,
    credentialReads,
    verifiedUsageSlots,
    verifiedCostCny,
    budgetCnyMax: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY,
    breaker,
    slotOrder: [...PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER],
    slots: parsedSlots,
    rawDataRetained: false,
  });
  if (report.verifiedCostCny !== null && report.verifiedCostCny > report.budgetCnyMax) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_BUDGET_EXCEEDED');
  }
  return report;
}

async function executeSlot(
  slot: Slot,
  sequence: number,
  input: {
    runId: string;
    credentials: Phase698TransportEvidenceT3ControlledCredentials;
    signal: AbortSignal;
  },
): Promise<SlotExecution> {
  const startedAt = performance.now();
  const controller = new AbortController();
  let timedOut = false;
  let snapshotReader: SnapshotReader = () => zeroProviderSnapshots();
  const spec = PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_SPECS[sequence - 1];
  try {
    const invoke = Promise.resolve().then(() =>
      invokeProvider(slot, input, controller.signal, (reader) => {
        snapshotReader = reader;
      }),
    );
    void invoke.catch(() => undefined);
    let result: Awaited<ReturnType<typeof invokeProvider>> | null = null;
    let invokeError: unknown = null;
    const bounded = await raceProviderInvocation(
      invoke,
      input.signal,
      controller,
      spec.hardTimeoutMs,
    );
    timedOut = bounded.kind === 'timeout';
    if (bounded.kind === 'result') {
      result = bounded.value;
    } else if (bounded.kind === 'error') {
      invokeError = bounded.error;
    }
    const snapshots = result?.snapshots ?? snapshotReader();
    const diagnostic = buildDiagnostic(
      slot,
      `${input.runId}-${slot}-${sequence}`,
      snapshots,
      {
        reservations: 1,
        dispatches: snapshots.providerWire.dispatches,
        harnessReturns: snapshots.providerWire.responses,
        verifiedResults: snapshots.providerWire.verifiedUsage,
      },
      timedOut ? 'timeout' : input.signal.aborted ? 'aborted' : null,
    );
    const durationMs = duration(performance.now() - startedAt);
    const providerCalls = snapshots.providerWire.dispatches;
    const credentialReads = 1 as const;
    if (result?.ok && diagnostic) {
      return {
        disposition: 'accepted',
        failureCode: null,
        usage: result.usage,
        verifiedCostCny: result.cost,
        diagnostic,
        runnerWire: diagnostic.runnerWire,
        providerWire: diagnostic.providerWire,
        providerCalls,
        credentialReads,
        durationMs,
      };
    }
    const failureCode: Phase698TransportEvidenceT3ControlledFailureCode = timedOut
      ? 'timeout'
      : input.signal.aborted
        ? 'aborted'
        : invokeError
          ? 'provider_error'
          : diagnostic
            ? 'provider_error'
            : 'diagnostic_invalid';
    return {
      disposition:
        failureCode === 'timeout'
          ? 'timeout'
          : failureCode === 'aborted'
            ? 'aborted'
            : failureCode === 'diagnostic_invalid'
              ? 'failed'
              : 'failed',
      failureCode,
      usage: result?.usage ?? null,
      verifiedCostCny: result?.cost ?? null,
      diagnostic,
      runnerWire: diagnostic?.runnerWire ?? zeroRunnerWire(snapshots.providerWire),
      providerWire: diagnostic?.providerWire ?? snapshots.providerWire,
      providerCalls,
      credentialReads,
      durationMs,
    };
  } finally {
    controller.abort();
  }
}

type ProviderInvocation = Readonly<{
  ok: boolean;
  usage: { inputTokens: number; outputTokens: number } | null;
  cost: number | null;
  snapshots: {
    providerWire: Phase698TransportEvidenceProviderWire;
    providerSnapshot: Phase698ProviderWireSnapshot | null;
    v7Snapshot: Phase697V7WireSnapshot | null;
  };
  wireCapability: object | null;
}>;

async function invokeProvider(
  slot: Slot,
  input: { runId: string; credentials: Phase698TransportEvidenceT3ControlledCredentials },
  signal: AbortSignal,
  onSnapshotReader: (reader: SnapshotReader) => void,
): Promise<ProviderInvocation> {
  if (slot === 'rewrite') {
    const wire = createPhase697V7WireDiagnostics({ appendStage: async () => undefined });
    onSnapshotReader(() => {
      const snapshot = readPhase697V7WireSnapshot(wire.capability);
      return {
        providerWire: v7ProviderWire(snapshot),
        providerSnapshot: null,
        v7Snapshot: snapshot,
      };
    });
    let usage: { inputTokens: number; outputTokens: number } | null = null;
    let ok = false;
    try {
      const adapter = createFirstPartyDeepSeekV4ProDirectAdapter(
        {
          provider: 'deepseek',
          apiKey: input.credentials.rewriteDeepseekApiKey,
          baseURL: 'https://api.deepseek.com/v1',
          model: 'deepseek-v4-pro',
        },
        wire.capability,
      );
      const result = await adapter.executor({
        schema: REWRITE_SCHEMA,
        systemPrompt: REWRITE_SYSTEM_PROMPT,
        userPrompt: REWRITE_USER_PROMPT,
        maxOutputTokens: 160,
        signal,
      });
      const inputTokens = result.usage?.inputTokens;
      const outputTokens = result.usage?.outputTokens;
      if (isPositiveInteger(inputTokens) && isPositiveInteger(outputTokens)) {
        usage = { inputTokens, outputTokens };
        ok = true;
      }
    } catch {
      // The first-party wire snapshot is the only retained failure fact.
    }
    const snapshot = readPhase697V7WireSnapshot(wire.capability);
    const providerWire = v7ProviderWire(snapshot);
    return {
      ok,
      usage,
      cost: usage ? deepseekCost(usage) : null,
      snapshots: { providerWire, providerSnapshot: null, v7Snapshot: snapshot },
      wireCapability: wire.capability,
    };
  }
  if (slot === 'qwen') {
    const wire = createPhase698ProviderWireDiagnostics('qwen_retrieval');
    onSnapshotReader(() => {
      const snapshot = readPhase698ProviderWireSnapshot(wire.capability);
      return {
        providerWire: providerWireFromSnapshot(snapshot),
        providerSnapshot: snapshot,
        v7Snapshot: null,
      };
    });
    let usage: { inputTokens: number; outputTokens: number } | null = null;
    let cost: number | null = null;
    let ok = false;
    try {
      const provider = createQwenTextEmbeddingV4DiagnosticProvider(
        {
          apiKey: input.credentials.qwenApiKey,
          baseURL: input.credentials.qwenBaseURL,
          model: QWEN_TEXT_EMBEDDING_V4_MODEL,
          dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
          priceProfile: QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
        },
        wire.capability,
      );
      if (provider.endpointProfile !== QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE) {
        throw new Error('QWEN_ENDPOINT_PROFILE_INVALID');
      }
      const result = await provider.executor({
        inputs: ['PrepMind transport evidence canary retrieval query.'],
        dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
        signal,
      });
      const inputTokens = result.usage?.inputTokens;
      if (Number.isSafeInteger(inputTokens) && inputTokens > 0) {
        usage = { inputTokens, outputTokens: 0 };
        cost = calculateQwenTextEmbeddingV4CostCny(inputTokens);
        ok = true;
      }
    } catch {
      // Keep only the bounded wire snapshot.
    }
    const snapshot = readPhase698ProviderWireSnapshot(wire.capability);
    const providerWire = providerWireFromSnapshot(snapshot);
    return {
      ok,
      usage,
      cost,
      snapshots: { providerWire, providerSnapshot: snapshot, v7Snapshot: null },
      wireCapability: wire.capability,
    };
  }
  const wire = createPhase698ProviderWireDiagnostics('final_response_stream');
  onSnapshotReader(() => {
    const snapshot = readPhase698ProviderWireSnapshot(wire.capability);
    return {
      providerWire: providerWireFromSnapshot(snapshot),
      providerSnapshot: snapshot,
      v7Snapshot: null,
    };
  });
  let usage: { inputTokens: number; outputTokens: number } | null = null;
  let ok = false;
  const hash = createHash('sha256');
  try {
    const provider = createFinalResponseStreamDiagnosticProvider(
      {
        apiKey: input.credentials.finalResponseDeepseekApiKey,
        baseURL: FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
        model: FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
      },
      wire.capability,
    );
    if (provider.provenance !== 'first_party_final_response_stream') {
      throw new Error('FINAL_RESPONSE_PROVENANCE_INVALID');
    }
    for await (const event of provider.executor({
      systemPrompt: FINAL_SYSTEM_PROMPT,
      userPrompt: FINAL_USER_PROMPT,
      maxOutputTokens: FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
      signal,
    })) {
      if (event.type === 'text_delta') hash.update(event.text);
      else usage = { inputTokens: event.usage.inputTokens, outputTokens: event.usage.outputTokens };
    }
    ok = usage !== null;
  } catch {
    // Do not retain the answer or provider error text.
  }
  // Keep the digest operation observable only as a local side effect; the digest
  // itself is intentionally not emitted into the report.
  if (ok) void hash.digest('hex');
  const snapshot = readPhase698ProviderWireSnapshot(wire.capability);
  const providerWire = providerWireFromSnapshot(snapshot);
  return {
    ok,
    usage,
    cost: usage ? deepseekCost(usage) : null,
    snapshots: { providerWire, providerSnapshot: snapshot, v7Snapshot: null },
    wireCapability: wire.capability,
  };
}

function zeroProviderSnapshots(): ProviderSnapshots {
  return {
    providerWire: zeroProviderWire(),
    providerSnapshot: null,
    v7Snapshot: null,
  } as const;
}

async function raceProviderInvocation<T>(
  invocation: Promise<T>,
  parentSignal: AbortSignal,
  controller: AbortController,
  timeoutMs: number,
): Promise<
  | Readonly<{ kind: 'result'; value: T }>
  | Readonly<{ kind: 'error'; error: unknown }>
  | Readonly<{ kind: 'timeout' }>
  | Readonly<{ kind: 'aborted' }>
> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (
      result:
        | Readonly<{ kind: 'result'; value: T }>
        | Readonly<{ kind: 'error'; error: unknown }>
        | Readonly<{ kind: 'timeout' }>
        | Readonly<{ kind: 'aborted' }>,
    ) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      parentSignal.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const onAbort = () => {
      controller.abort();
      finish({ kind: 'aborted' });
    };
    parentSignal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      controller.abort();
      finish({ kind: 'timeout' });
    }, timeoutMs);
    if (parentSignal.aborted) {
      onAbort();
      return;
    }
    invocation.then(
      (value) => finish({ kind: 'result', value }),
      (error) => finish({ kind: 'error', error }),
    );
  });
}

function buildDiagnostic(
  slot: Slot,
  callId: string,
  snapshots: {
    providerWire: Phase698TransportEvidenceProviderWire;
    providerSnapshot: Phase698ProviderWireSnapshot | null;
    v7Snapshot: Phase697V7WireSnapshot | null;
  },
  runnerWireHint: Phase698TransportEvidenceRunnerWire,
  forcedReason: 'timeout' | 'aborted' | null,
): Phase698TransportEvidenceDiagnostic | null {
  const providerWire = snapshots.providerWire;
  const boundary = boundaryFromWire(providerWire, runnerWireHint);
  const snapshotFailure =
    snapshots.v7Snapshot?.failureCategory ?? snapshots.providerSnapshot?.failureCategory ?? null;
  const stage = stageFromWire(providerWire, snapshotFailure, forcedReason);
  const reasonCode = forcedReason ?? reasonFromFailure(snapshotFailure, stage, providerWire);
  const expectedWire =
    boundary === 'unknown' ? runnerWireHint : phase698TransportEvidenceWireForBoundary(boundary);
  const value = {
    lineage: PHASE_6_9_8_TRANSPORT_EVIDENCE_LINEAGE,
    callId,
    family: slot,
    phase: slot,
    stage,
    reasonCode,
    providerBoundary: boundary,
    runnerWire: expectedWire,
    providerWire,
    diagnosticStages:
      reasonCode === 'applied'
        ? [...PHASE_6_9_8_TRANSPORT_EVIDENCE_STAGES]
        : [...phase698TransportEvidenceStagesBefore(stage)],
    rawDataRetained: false as const,
  };
  const parsed = PHASE_6_9_8_TRANSPORT_EVIDENCE_DIAGNOSTIC_SCHEMA.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function boundaryFromWire(
  wire: Phase698TransportEvidenceProviderWire,
  runnerWire?: Phase698TransportEvidenceRunnerWire,
): Phase698TransportEvidenceProviderBoundary {
  if (
    wire.executions === 0 &&
    wire.dispatches === 0 &&
    wire.responses === 0 &&
    wire.verifiedUsage === 0
  ) {
    return runnerWire?.reservations === 1 ? 'unknown' : 'not_dispatched';
  }
  if (
    wire.executions !== wire.dispatches ||
    wire.dispatches < wire.responses ||
    wire.responses < wire.verifiedUsage
  ) {
    return 'unknown';
  }
  if (wire.dispatches === 0) return 'unknown';
  if (wire.responses === 0) return 'dispatched_no_response';
  if (wire.verifiedUsage === 0) return 'response_observed';
  return 'response_and_usage_observed';
}

function stageFromWire(
  wire: Phase698TransportEvidenceProviderWire,
  failure: string | null,
  forcedReason: 'timeout' | 'aborted' | null,
): Phase698TransportEvidenceDiagnostic['stage'] {
  if (forcedReason === 'timeout') {
    return wire.dispatches === 1 && wire.responses === 0 ? 'dispatch_started' : 'terminal';
  }
  if (forcedReason === 'aborted') {
    if (wire.dispatches === 0) return 'preflight';
    if (wire.responses === 0) return 'dispatch_started';
    return 'terminal';
  }
  if (wire.dispatches === 0) return 'preflight';
  if (wire.responses === 0) return 'dispatch_started';
  if (wire.verifiedUsage === 0 && failure === 'usage_invalid') return 'usage_observed';
  if (wire.verifiedUsage === 0) return 'response_observed';
  if (forcedReason !== null) return 'terminal';
  return 'terminal';
}

function reasonFromFailure(
  failure: string | null,
  stage: Phase698TransportEvidenceDiagnostic['stage'],
  wire: Phase698TransportEvidenceProviderWire,
): Phase698TransportEvidenceDiagnostic['reasonCode'] {
  if (wire.verifiedUsage === 1 && failure === null) return 'applied';
  if (failure === 'pre_dispatch_abort' || failure === 'post_dispatch_abort') return 'aborted';
  if (failure === 'runtime_timeout') return 'timeout';
  if (failure === 'usage_invalid') return 'usage_invalid';
  if (failure?.startsWith('http_')) return 'http_status';
  if (
    failure === 'provider_envelope_invalid' ||
    failure === 'response_not_observed' ||
    failure === 'invalid_response'
  )
    return 'envelope_invalid';
  if (
    failure === 'stream_event_invalid' ||
    failure === 'terminal_missing' ||
    failure === 'terminal_duplicate' ||
    failure === 'terminal_not_last' ||
    failure === 'false_tool_success'
  )
    return 'stream_event_invalid';
  if (
    failure === 'provider_json_parse' ||
    failure === 'provider_type_validation' ||
    failure === 'provider_object_missing'
  )
    return 'schema_invalid';
  if (stage === 'terminal' && wire.verifiedUsage === 1) return 'applied';
  return 'unknown';
}

function providerWireFromSnapshot(
  snapshot: Phase698ProviderWireSnapshot | null,
): Phase698TransportEvidenceProviderWire {
  return snapshot
    ? {
        executions: bit(snapshot.counters.executorInvocations),
        dispatches: bit(snapshot.counters.providerDispatches),
        responses: bit(snapshot.counters.providerResponses),
        verifiedUsage: bit(snapshot.counters.verifiedUsages),
      }
    : zeroProviderWire();
}

function v7ProviderWire(
  snapshot: Phase697V7WireSnapshot | null,
): Phase698TransportEvidenceProviderWire {
  return snapshot
    ? {
        executions: bit(snapshot.counters.executorInvocations),
        dispatches: bit(snapshot.counters.providerDispatches),
        responses: bit(snapshot.counters.providerResponses),
        verifiedUsage: bit(snapshot.counters.verifiedUsages),
      }
    : zeroProviderWire();
}

function zeroProviderWire(): Phase698TransportEvidenceProviderWire {
  return { executions: 0, dispatches: 0, responses: 0, verifiedUsage: 0 };
}

function zeroRunnerWire(
  providerWire: Phase698TransportEvidenceProviderWire,
): Phase698TransportEvidenceRunnerWire {
  const boundary = boundaryFromWire(providerWire, {
    reservations: providerWire.executions,
    dispatches: providerWire.dispatches,
    harnessReturns: providerWire.responses,
    verifiedResults: providerWire.verifiedUsage,
  });
  return boundary === 'unknown'
    ? {
        reservations: 1,
        dispatches: providerWire.dispatches,
        harnessReturns: providerWire.responses,
        verifiedResults: providerWire.verifiedUsage,
      }
    : phase698TransportEvidenceWireForBoundary(boundary).runnerWire;
}

function notStarted(
  slot: Slot,
  sequence: number,
  externalAbort: boolean,
): Phase698TransportEvidenceT3ControlledSlot {
  return {
    slot,
    provider: slot === 'qwen' ? 'qwen' : 'deepseek',
    sequence,
    disposition: externalAbort ? 'not_started_external_abort' : 'not_started_quality_breaker',
    failureCode: externalAbort ? 'aborted' : 'provider_error',
    runnerWire: { reservations: 0, dispatches: 0, harnessReturns: 0, verifiedResults: 0 },
    providerWire: zeroProviderWire(),
    providerCalls: 0,
    credentialReads: 0,
    usage: null,
    verifiedCostCny: null,
    durationMs: null,
    diagnostic: null,
    rawDataRetained: false,
  };
}

function deepseekCost(usage: { inputTokens: number; outputTokens: number }) {
  return Number(((usage.inputTokens * 3 + usage.outputTokens * 6) / 1_000_000).toFixed(9));
}

function bit(value: number): 0 | 1 {
  return value > 0 ? 1 : 0;
}

function duration(value: number) {
  return Number.isFinite(value) && value >= 0 ? Number(value.toFixed(3)) : 0;
}

function normalizeInput(input: {
  runId: string;
  credentials: Phase698TransportEvidenceT3ControlledCredentials;
  signal: AbortSignal;
  onSlotTerminal?(slot: Phase698TransportEvidenceT3ControlledSlot): Promise<void>;
}) {
  if (
    typeof input.runId !== 'string' ||
    !/^[A-Za-z0-9_-]{1,96}$/u.test(input.runId) ||
    !(input.signal instanceof AbortSignal) ||
    !isCredential(input.credentials.rewriteDeepseekApiKey) ||
    !isCredential(input.credentials.qwenApiKey) ||
    !isCredential(input.credentials.finalResponseDeepseekApiKey) ||
    input.credentials.qwenBaseURL !== PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_QWEN_BASE_URL ||
    (input.onSlotTerminal !== undefined && typeof input.onSlotTerminal !== 'function')
  ) {
    throw new Error('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_CONTROLLED_CONFIGURATION_INVALID');
  }
  return Object.freeze(input);
}

function isCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= 1 &&
    value.length <= 512 &&
    /^[\x21-\x7e]+$/u.test(value)
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
