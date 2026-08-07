import { createHash, randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import {
  appendFile,
  link,
  mkdtemp,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  unlink,
  lstat,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';

import { z } from 'zod';

import {
  createFinalResponseStreamDiagnosticProvider,
  createFirstPartyDeepSeekV4ProDirectAdapter,
  createPhase698ProviderWireDiagnostics,
  createPhase697V7WireDiagnostics,
  createQwenTextEmbeddingV4DiagnosticProvider,
  FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
  FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
  FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
  QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
  QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE,
  QWEN_TEXT_EMBEDDING_V4_MODEL,
  QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
  calculateQwenTextEmbeddingV4CostCny,
  readPhase698ProviderWireSnapshot,
  readPhase697V7WireSnapshot,
} from '@repo/ai';
import {
  inspectPhase698TransportReentryV2DedicatedCapability,
  withPhase698TransportReentryV2DedicatedApiKey,
  type Phase698TransportReentryV2Projection,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-contract.ts';
import { PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS } from './phase-6-9-8-retriever-final-response-transport-reentry-v2-c1.ts';

import { consumePhase698TransportReentryV2C2AdmissionCapability } from './phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts';
import {
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_ARTIFACT_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_ARTIFACT_VERSION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_DURABILITY_VERSION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE_FAILED,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_VERSION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_RELATIVE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MAX_COST_CNY,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_CLAIM_VERSION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_RELATIVE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_RESULT_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_COST_CAP_CNY,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  phase698TransportReentryV2L1ArtifactRelativePath,
  phase698TransportReentryV2L1Canonical,
  phase698TransportReentryV2L1ReportRelativePath,
  phase698TransportReentryV2L1Sha256,
  phase698TransportReentryV2L1WritableRelativePath,
  type Phase698TransportReentryV2L1FailureCode,
  type Phase698TransportReentryV2L1Ports,
  type Phase698TransportReentryV2L1Report,
  type Phase698TransportReentryV2L1Marker,
  type Phase698TransportReentryV2L1JournalRecord,
  type Phase698TransportReentryV2L1Validation,
  type Phase698TransportReentryV2L1Slot,
  type Phase698TransportReentryV2L1SlotResult,
  type Phase698TransportReentryV2L1SlotSuccess,
  type Phase698TransportReentryV2L1Source,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-contract.ts';

const UUID = z.string().uuid();
export type Phase698TransportReentryV2L1Reservation = Readonly<{
  root: string;
  runId: string;
  appendSlotDispatchStarted(slot: Phase698TransportReentryV2L1Slot): Promise<void>;
  appendSlotResponseObserved(slot: Phase698TransportReentryV2L1Slot): Promise<void>;
  appendSlotUsageVerified(slot: Phase698TransportReentryV2L1Slot): Promise<void>;
  appendSlotTerminal(result: Phase698TransportReentryV2L1SlotResult): Promise<void>;
  appendRunTerminal(report: Phase698TransportReentryV2L1Report): Promise<void>;
  publishArtifact(
    report: Phase698TransportReentryV2L1Report,
    options?: Readonly<{ publicationFault?: boolean; mode?: 'runtime' | 'recovery' }>,
  ): Promise<Readonly<{ evidenceSha256: string; relativePath: string }>>;
}>;

export class Phase698TransportReentryV2L1PortFailure extends Error {
  readonly code: Phase698TransportReentryV2L1FailureCode;
  readonly responseObserved: boolean;
  readonly usageObserved: boolean;
  readonly providerWire: Phase698TransportReentryV2L1Wire;

  constructor(
    code: Phase698TransportReentryV2L1FailureCode,
    options: Readonly<{
      responseObserved?: boolean;
      usageObserved?: boolean;
      providerWire?: Partial<Phase698TransportReentryV2L1Wire>;
    }> = {},
  ) {
    super(code);
    this.name = 'Phase698TransportReentryV2L1PortFailure';
    this.code = code;
    this.responseObserved = options.responseObserved ?? false;
    this.usageObserved = options.usageObserved ?? false;
    this.providerWire = Object.freeze({
      executions: options.providerWire?.executions ?? 1,
      dispatches: options.providerWire?.dispatches ?? 1,
      responses: options.providerWire?.responses ?? (this.responseObserved ? 1 : 0),
      verifiedUsage: options.providerWire?.verifiedUsage ?? (this.usageObserved ? 1 : 0),
    });
  }
}

export type Phase698TransportReentryV2L1Wire = Readonly<{
  executions: 0 | 1;
  dispatches: 0 | 1;
  responses: 0 | 1;
  verifiedUsage: 0 | 1;
}>;

export type Phase698TransportReentryV2L1RunResult = Readonly<{
  ok: boolean;
  report: Phase698TransportReentryV2L1Report;
  validation: Phase698TransportReentryV2L1Validation;
  recoveryRequired: boolean;
}>;

export async function createPhase698TransportReentryV2L1SyntheticRootForTest() {
  return mkdtemp(join(tmpdir(), 'phase-698-transport-reentry-v2-l1-'));
}

export async function removePhase698TransportReentryV2L1SyntheticRootForTest(root: string) {
  await rm(root, { recursive: true, force: true });
}

type RecordInput =
  | { event: 'attempt_reserved'; markerSha256: string; createdAt: string }
  | { event: 'slot_dispatch_started'; slot: Phase698TransportReentryV2L1Slot }
  | { event: 'slot_response_observed'; slot: Phase698TransportReentryV2L1Slot }
  | { event: 'slot_usage_verified'; slot: Phase698TransportReentryV2L1Slot }
  | { event: 'slot_terminal'; result: Phase698TransportReentryV2L1SlotResult }
  | { event: 'run_terminal'; reportSha256: string; slotCount: 3 }
  | { event: 'recovery_claimed'; claimSha256: string }
  | { event: 'publication_started'; reportSha256: string }
  | { event: 'evidence_published'; evidenceSha256: string };

type MutableState = {
  root: string;
  runId: string;
  marker: z.infer<typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_SCHEMA>;
  markerBytes: string;
  markerSha256: string;
  journalPath: string;
  records: Phase698TransportReentryV2L1JournalRecord[];
  slotEvents: Map<Phase698TransportReentryV2L1Slot, Set<string>>;
  slots: Map<Phase698TransportReentryV2L1Slot, Phase698TransportReentryV2L1SlotResult>;
  report: Phase698TransportReentryV2L1Report | null;
  queue: Promise<void>;
};

export async function reservePhase698TransportReentryV2L1Attempt(input: {
  root: string;
  admissionCapability: unknown;
  source: Phase698TransportReentryV2L1Source;
  runId?: string;
  createdAt?: string;
}): Promise<Phase698TransportReentryV2L1Reservation> {
  return reservePhase698TransportReentryV2L1AttemptInternal({
    ...input,
    expectedAuthority: 'git_verified',
    syntheticRoot: false,
  });
}

export async function reservePhase698TransportReentryV2L1SyntheticAttemptForTest(input: {
  root: string;
  admissionCapability: unknown;
  source: Phase698TransportReentryV2L1Source;
  runId?: string;
  createdAt?: string;
}): Promise<Phase698TransportReentryV2L1Reservation> {
  return reservePhase698TransportReentryV2L1AttemptInternal({
    ...input,
    expectedAuthority: 'synthetic_test',
    syntheticRoot: true,
  });
}

async function reservePhase698TransportReentryV2L1AttemptInternal(input: {
  root: string;
  admissionCapability: unknown;
  source: Phase698TransportReentryV2L1Source;
  runId?: string;
  createdAt?: string;
  expectedAuthority: 'synthetic_test' | 'git_verified';
  syntheticRoot: boolean;
}): Promise<Phase698TransportReentryV2L1Reservation> {
  const root = input.syntheticRoot
    ? await requireSyntheticRoot(input.root)
    : await resolveRepositoryRoot(input.root);
  const issued = consumePhase698TransportReentryV2C2AdmissionCapability(
    input.admissionCapability,
    input.expectedAuthority,
  );
  if (issued.source.formalArtifactCount !== 0) throw new Error('L1_FORMAL_ARTIFACT_FENCE');
  if (
    issued.source.commit !== input.source.commit ||
    issued.source.sourceBundleSha256 !== input.source.c2SourceBundleSha256
  )
    throw new Error('L1_SOURCE_MISMATCH');
  const runId = UUID.parse(input.runId ?? randomUUID());
  const createdAt = input.createdAt ?? new Date().toISOString();
  const source = input.source;
  const marker = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_SCHEMA.parse({
    markerVersion: `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION}-marker`,
    durabilityVersion: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    runId,
    authority: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_AUTHORITY,
    qualityAuthority: 'none',
    runMode: 'controlled_live',
    plannedSlots: 3,
    source,
    credentialReads: 0,
    providerCalls: 0,
    formalEvidence: 0,
    creatorPid: process.pid,
    createdAt,
  });
  await prepareRoot(root);
  await ensureNoFormalFiles(root);
  const markerBytes = `${phase698TransportReentryV2L1Canonical(marker)}\n`;
  const markerPath = resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_RELATIVE);
  await writeExclusive(markerPath, markerBytes);
  await syncFileAndDirectory(markerPath);
  const journalPath = resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE);
  const state: MutableState = {
    root,
    runId,
    marker,
    markerBytes,
    markerSha256: phase698TransportReentryV2L1Sha256(markerBytes),
    journalPath,
    records: [],
    slotEvents: new Map(),
    slots: new Map(),
    report: null,
    queue: Promise.resolve(),
  };
  const reserved = recordFromInput(state, {
    event: 'attempt_reserved',
    markerSha256: state.markerSha256,
    createdAt,
  });
  await writeExclusive(journalPath, `${phase698TransportReentryV2L1Canonical(reserved)}\n`);
  await syncFileAndDirectory(journalPath);
  state.records.push(reserved);
  return reservationFromState(state);
}

export async function runPhase698TransportReentryV2L1(input: {
  reservation: Phase698TransportReentryV2L1Reservation;
  ports: Phase698TransportReentryV2L1Ports;
  signal: AbortSignal;
  onSlotTerminal?: (result: Phase698TransportReentryV2L1SlotResult) => Promise<void>;
  publicationFault?: boolean;
}): Promise<Phase698TransportReentryV2L1RunResult> {
  const signal = input.signal;
  const ports = input.ports;
  const slots: Phase698TransportReentryV2L1SlotResult[] = [];
  let breaker: Phase698TransportReentryV2L1FailureCode | 'none' = 'none';
  for (let index = 0; index < PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER.length; index += 1) {
    const slot = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER[index];
    const sequence = index + 1;
    if (breaker !== 'none') {
      const result = suffixResult(
        slot,
        sequence,
        breaker === 'abort' ? 'not_started_external_abort' : 'not_started_quality_breaker',
        breaker,
      );
      await input.reservation.appendSlotTerminal(result);
      slots.push(result);
      await input.onSlotTerminal?.(result);
      continue;
    }
    if (signal.aborted) {
      breaker = 'abort';
      const result = suffixResult(slot, sequence, 'attempted_aborted', 'abort');
      await input.reservation.appendSlotTerminal(result);
      slots.push(result);
      await input.onSlotTerminal?.(result);
      continue;
    }
    await input.reservation.appendSlotDispatchStarted(slot);
    const started = performance.now();
    const child = new AbortController();
    const onAbort = () => child.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let invoked = false;
    let outcome: Phase698TransportReentryV2L1SlotSuccess | null = null;
    let failure: Phase698TransportReentryV2L1PortFailure | null = null;
    let timedOut = false;
    try {
      const call = Promise.resolve().then(() => {
        if (child.signal.aborted) throw new Phase698TransportReentryV2L1PortFailure('abort');
        invoked = true;
        return ports[slot]({ slot, sequence, signal: child.signal });
      });
      const bounded = await raceBounded(call, signal, child, timeoutFor(slot));
      if (bounded.kind === 'result') outcome = bounded.value;
      else if (bounded.kind === 'timeout') timedOut = true;
      else if (bounded.kind === 'error') {
        failure =
          bounded.error instanceof Phase698TransportReentryV2L1PortFailure
            ? bounded.error
            : new Phase698TransportReentryV2L1PortFailure('transport');
      } else failure = new Phase698TransportReentryV2L1PortFailure('abort');
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      signal.removeEventListener('abort', onAbort);
      child.abort();
    }
    const durationMs = Math.min(20_000, Math.max(0, Math.round(performance.now() - started)));
    if (outcome) {
      try {
        const parsed = parseSuccess(slot, sequence, outcome, durationMs, invoked);
        await input.reservation.appendSlotResponseObserved(slot);
        await input.reservation.appendSlotUsageVerified(slot);
        await input.reservation.appendSlotTerminal(parsed);
        slots.push(parsed);
        await input.onSlotTerminal?.(parsed);
        continue;
      } catch {
        failure = new Phase698TransportReentryV2L1PortFailure('usage', { responseObserved: true });
      }
    }
    const code = timedOut ? 'timeout' : (failure?.code ?? (signal.aborted ? 'abort' : 'transport'));
    if (failure?.responseObserved || code === 'schema' || code === 'usage') {
      await input.reservation.appendSlotResponseObserved(slot);
    }
    const failed = failureResult(
      slot,
      sequence,
      code,
      failure?.providerWire ?? (invoked ? defaultWire() : zeroWire()),
      durationMs,
      invoked,
      true,
    );
    await input.reservation.appendSlotTerminal(failed);
    slots.push(failed);
    await input.onSlotTerminal?.(failed);
    breaker = code;
  }
  const report = buildReport(slots, breaker);
  await input.reservation.appendRunTerminal(report);
  try {
    await input.reservation.publishArtifact(report, {
      publicationFault: input.publicationFault,
      mode: 'runtime',
    });
  } catch {
    return {
      ok: false,
      report,
      validation: await validatePhase698TransportReentryV2L1Bundle(input.reservation.root),
      recoveryRequired: true,
    };
  }
  const root = input.reservation.root;
  const validation = await validatePhase698TransportReentryV2L1Bundle(root);
  return {
    ok: validation.ok && report.passed,
    report,
    validation,
    recoveryRequired: !validation.ok,
  };
}

function parseSuccess(
  slot: Phase698TransportReentryV2L1Slot,
  sequence: number,
  outcome: Phase698TransportReentryV2L1SlotSuccess,
  durationMs: number,
  invoked: boolean,
): Phase698TransportReentryV2L1SlotResult {
  const usage = outcome.usage;
  const cost = outcome.verifiedCostCny;
  if (
    !invoked ||
    cost < 0 ||
    cost > PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_COST_CAP_CNY[slot] ||
    cost > PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MAX_COST_CNY
  )
    throw new Error('L1_USAGE_INVALID');
  return {
    slot,
    provider: slot === 'qwen' ? 'qwen' : 'deepseek',
    sequence,
    disposition: 'completed',
    failureCode: null,
    runnerWire: { reservations: 1, dispatches: 1, harnessReturns: 1, verifiedResults: 1 },
    providerWire: { executions: 1, dispatches: 1, responses: 1, verifiedUsage: 1 },
    providerCalls: 1,
    credentialReads: 1,
    usage,
    verifiedCostCny: cost,
    durationMs,
    diagnostic: null,
    rawDataRetained: false,
  };
}

function failureResult(
  slot: Phase698TransportReentryV2L1Slot,
  sequence: number,
  code: Phase698TransportReentryV2L1FailureCode,
  wire: Phase698TransportReentryV2L1Wire,
  durationMs: number,
  invoked: boolean,
  dispatchStarted: boolean,
): Phase698TransportReentryV2L1SlotResult {
  const response = wire.responses === 1;
  return {
    slot,
    provider: slot === 'qwen' ? 'qwen' : 'deepseek',
    sequence,
    disposition: code === 'abort' && !invoked ? 'attempted_aborted' : 'executed_failure',
    failureCode: code,
    runnerWire: {
      reservations: 1,
      dispatches: dispatchStarted ? 1 : 0,
      harnessReturns: response ? 1 : 0,
      verifiedResults: 0,
    },
    providerWire: wire,
    providerCalls: invoked ? 1 : 0,
    credentialReads: invoked ? 1 : 0,
    usage: null,
    verifiedCostCny: null,
    durationMs,
    diagnostic: {
      stage: response ? 'response' : 'dispatch',
      reason: code,
      type: 'provider_wire',
      count: invoked ? 1 : 0,
      rawDataRetained: false,
    },
    rawDataRetained: false,
  };
}

function suffixResult(
  slot: Phase698TransportReentryV2L1Slot,
  sequence: number,
  disposition: 'attempted_aborted' | 'not_started_quality_breaker' | 'not_started_external_abort',
  code: Phase698TransportReentryV2L1FailureCode,
): Phase698TransportReentryV2L1SlotResult {
  return {
    slot,
    provider: slot === 'qwen' ? 'qwen' : 'deepseek',
    sequence,
    disposition,
    failureCode: code,
    runnerWire: { reservations: 1, dispatches: 0, harnessReturns: 0, verifiedResults: 0 },
    providerWire: { executions: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
    providerCalls: 0,
    credentialReads: 0,
    usage: null,
    verifiedCostCny: null,
    durationMs: null,
    diagnostic: {
      stage: 'preflight',
      reason: code,
      type: disposition,
      count: 0,
      rawDataRetained: false,
    },
    rawDataRetained: false,
  };
}

function buildReport(
  slots: readonly Phase698TransportReentryV2L1SlotResult[],
  breaker: Phase698TransportReentryV2L1FailureCode | 'none',
): Phase698TransportReentryV2L1Report {
  const completed = slots.filter((slot) => slot.disposition === 'completed').length;
  const passed = completed === 3 && breaker === 'none';
  const costs = slots
    .map((slot) => slot.verifiedCostCny ?? 0)
    .reduce((sum, value) => sum + value, 0);
  const verifiedCostCny = costs > 0 ? Number(costs.toFixed(9)) : null;
  return PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA.parse({
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    authority: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_AUTHORITY,
    qualityAuthority: 'none',
    gate: passed
      ? PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE
      : PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_GATE_FAILED,
    passed,
    plannedSlots: 3,
    startedSlots: slots.filter((slot) => slot.runnerWire.dispatches === 1).length,
    completedSlots: completed,
    notStartedQualityBreaker: slots.filter(
      (slot) => slot.disposition === 'not_started_quality_breaker',
    ).length,
    notStartedExternalAbort: slots.filter(
      (slot) => slot.disposition === 'not_started_external_abort',
    ).length,
    providerCalls: slots.reduce((sum, slot) => sum + slot.providerCalls, 0),
    credentialReads: slots.reduce((sum, slot) => sum + slot.credentialReads, 0),
    formalEvidence: 1,
    verifiedUsageSlots: slots.reduce((sum, slot) => sum + slot.providerWire.verifiedUsage, 0),
    verifiedCostCny,
    budgetCnyMax: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MAX_COST_CNY,
    breaker: {
      open: breaker !== 'none',
      reason: breaker,
      openedAtSequence:
        breaker === 'none'
          ? null
          : (slots.find((slot) => slot.failureCode === breaker)?.sequence ?? 1),
    },
    slotOrder: [...PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER],
    slots: [...slots],
    rawDataRetained: false,
  });
}

function reservationFromState(state: MutableState): Phase698TransportReentryV2L1Reservation {
  return Object.freeze({
    root: state.root,
    runId: state.runId,
    appendSlotDispatchStarted: (slot) =>
      enqueue(state, async () => {
        assertNextSlot(state, slot);
        if (state.slotEvents.has(slot)) throw new Error('L1_DUPLICATE_SLOT');
        await appendRecord(state, { event: 'slot_dispatch_started', slot });
        state.slotEvents.set(slot, new Set(['dispatch']));
      }),
    appendSlotResponseObserved: (slot) =>
      enqueue(state, async () => {
        assertSlotEvent(state, slot, 'dispatch');
        const events = state.slotEvents.get(slot)!;
        if (events.has('response')) throw new Error('L1_DUPLICATE_RESPONSE');
        await appendRecord(state, { event: 'slot_response_observed', slot });
        events.add('response');
      }),
    appendSlotUsageVerified: (slot) =>
      enqueue(state, async () => {
        assertSlotEvent(state, slot, 'response');
        const events = state.slotEvents.get(slot)!;
        if (events.has('usage')) throw new Error('L1_DUPLICATE_USAGE');
        await appendRecord(state, { event: 'slot_usage_verified', slot });
        events.add('usage');
      }),
    appendSlotTerminal: (result) =>
      enqueue(state, async () => {
        const parsed = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_RESULT_SCHEMA.parse(result);
        if (state.slots.has(parsed.slot) || parsed.sequence !== state.slots.size + 1)
          throw new Error('L1_DUPLICATE_TERMINAL');
        if (parsed.runnerWire.dispatches === 1) {
          const events = state.slotEvents.get(parsed.slot);
          if (!events?.has('dispatch')) throw new Error('L1_DISPATCH_PREFIX_MISSING');
          if (parsed.providerWire.responses === 1 && !events.has('response'))
            throw new Error('L1_RESPONSE_PREFIX_MISSING');
          if (parsed.providerWire.verifiedUsage === 1 && !events.has('usage'))
            throw new Error('L1_USAGE_PREFIX_MISSING');
        }
        await appendRecord(state, { event: 'slot_terminal', result: parsed });
        state.slots.set(parsed.slot, parsed);
      }),
    appendRunTerminal: (report) =>
      enqueue(state, async () => {
        const parsed = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA.parse(report);
        if (state.report || state.slots.size !== 3) throw new Error('L1_RUN_TERMINAL_INVALID');
        for (const slot of parsed.slots) {
          const stored = state.slots.get(slot.slot);
          if (
            !stored ||
            phase698TransportReentryV2L1Canonical(stored) !==
              phase698TransportReentryV2L1Canonical(slot)
          )
            throw new Error('L1_REPORT_SLOT_MISMATCH');
        }
        await ensureReportSnapshot(state, parsed);
        state.report = parsed;
        await appendRecord(state, {
          event: 'run_terminal',
          reportSha256: phase698TransportReentryV2L1Sha256(
            phase698TransportReentryV2L1Canonical(parsed),
          ),
          slotCount: 3,
        });
      }),
    publishArtifact: (report, options) =>
      enqueueResult(state, async () => publishStateArtifact(state, report, options)),
  });
}

function assertNextSlot(state: MutableState, slot: Phase698TransportReentryV2L1Slot) {
  if (PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER[state.slots.size] !== slot)
    throw new Error('L1_SLOT_ORDER_INVALID');
}
function assertSlotEvent(
  state: MutableState,
  slot: Phase698TransportReentryV2L1Slot,
  event: string,
) {
  if (!state.slotEvents.get(slot)?.has(event) || state.slots.has(slot))
    throw new Error('L1_EVENT_PREFIX_INVALID');
}

async function appendRecord(state: MutableState, input: RecordInput) {
  const record = recordFromInput(state, input);
  await appendFile(state.journalPath, `${phase698TransportReentryV2L1Canonical(record)}\n`, {
    flag: 'a',
  });
  await syncFileAndDirectory(state.journalPath);
  state.records.push(record);
}
function recordFromInput(
  state: MutableState,
  input: RecordInput,
): Phase698TransportReentryV2L1JournalRecord {
  const unsigned = {
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    runId: state.runId,
    sequence: state.records.length,
    previousHash: state.records.at(-1)?.recordHash ?? null,
    ...input,
  };
  return PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_SCHEMA.parse({
    ...unsigned,
    recordHash: phase698TransportReentryV2L1Sha256(phase698TransportReentryV2L1Canonical(unsigned)),
  });
}

async function enqueue(state: MutableState, task: () => Promise<void>) {
  const next = state.queue.then(task, task);
  state.queue = next.catch(() => undefined);
  await next;
}
async function enqueueResult<T>(state: MutableState, task: () => Promise<T>): Promise<T> {
  const next = state.queue.then(task, task);
  state.queue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function publishStateArtifact(
  state: MutableState,
  reportInput: Phase698TransportReentryV2L1Report,
  options: Readonly<{ publicationFault?: boolean; mode?: 'runtime' | 'recovery' }> = {},
) {
  if (options.publicationFault) throw new Error('L1_PUBLICATION_FAULT');
  if (state.records.some((record) => record.event === 'evidence_published'))
    throw new Error('L1_ALREADY_PUBLISHED');
  const report = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA.parse(reportInput);
  if (
    !state.report ||
    phase698TransportReentryV2L1Canonical(state.report) !==
      phase698TransportReentryV2L1Canonical(report)
  )
    throw new Error('L1_REPORT_MISMATCH');
  const terminal = state.records.find((record) => record.event === 'run_terminal');
  if (!terminal) throw new Error('L1_TERMINAL_MISSING');
  const reportSha256 = phase698TransportReentryV2L1Sha256(
    phase698TransportReentryV2L1Canonical(report),
  );
  if (!state.records.some((record) => record.event === 'publication_started'))
    await appendRecord(state, { event: 'publication_started', reportSha256 });
  const publication = state.records.find((record) => record.event === 'publication_started');
  if (!publication || publication.reportSha256 !== reportSha256)
    throw new Error('L1_PUBLICATION_MISMATCH');
  const artifact = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_ARTIFACT_SCHEMA.parse({
    artifactVersion: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_ARTIFACT_VERSION,
    durabilityVersion: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    runId: state.runId,
    markerSha256: state.markerSha256,
    reportLogicalSha256: reportSha256,
    durability: {
      publicationMode: options.mode ?? 'runtime',
      terminalSequence: terminal.sequence,
      terminalRecordHash: terminal.recordHash,
      journalRecordsBeforePublication: publication.sequence,
      hardLink: true,
      rawDataRetained: false,
    },
    report,
  });
  const bytes = `${phase698TransportReentryV2L1Canonical(artifact)}\n`;
  const artifactPath = resolveContained(
    state.root,
    phase698TransportReentryV2L1ArtifactRelativePath(state.runId),
  );
  const tempPath = `${artifactPath}.tmp-${randomUUID()}`;
  await writeExclusive(tempPath, bytes);
  await syncFileAndDirectory(tempPath);
  try {
    await link(tempPath, artifactPath);
    await syncDirectory(dirname(artifactPath));
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
  const evidenceSha256 = phase698TransportReentryV2L1Sha256(bytes);
  await appendRecord(state, { event: 'evidence_published', evidenceSha256 });
  return Object.freeze({
    evidenceSha256,
    relativePath: phase698TransportReentryV2L1ArtifactRelativePath(state.runId),
  });
}

export async function validatePhase698TransportReentryV2L1Bundle(
  rootInput: string,
): Promise<Phase698TransportReentryV2L1Validation> {
  try {
    const root = await resolveL1Root(rootInput);
    const markerPath = resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_RELATIVE);
    const markerBytes = await readRegular(markerPath);
    const marker = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${phase698TransportReentryV2L1Canonical(marker)}\n`)
      throw new Error('marker');
    const records = await readJournal(root, marker);
    const recoveryPath = resolveContained(
      root,
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_RELATIVE,
    );
    const recoveryRecord = records.find((record) => record.event === 'recovery_claimed');
    const recoveryExists = await pathExists(recoveryPath);
    if (recoveryRecord && !recoveryExists) throw new Error('recovery claim missing');
    if (!recoveryRecord && recoveryExists) throw new Error('orphan recovery claim');
    if (recoveryRecord && recoveryExists) {
      const recoveryBytes = await readRegular(recoveryPath);
      const recovery = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_SCHEMA.parse(
        JSON.parse(recoveryBytes),
      );
      if (
        recoveryBytes !== `${phase698TransportReentryV2L1Canonical(recovery)}\n` ||
        recovery.runId !== marker.runId
      )
        throw new Error('recovery claim');
    }
    const terminal = records.find((record) => record.event === 'run_terminal');
    const publication = records.find((record) => record.event === 'publication_started');
    const published = records.find((record) => record.event === 'evidence_published');
    if (!terminal || !publication || !published) throw new Error('terminal');
    const reportBytes = await readRegular(
      resolveContained(root, phase698TransportReentryV2L1ReportRelativePath(marker.runId)),
    );
    const report = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA.parse(JSON.parse(reportBytes));
    if (reportBytes !== `${phase698TransportReentryV2L1Canonical(report)}\n`)
      throw new Error('report');
    const reportSha = phase698TransportReentryV2L1Sha256(
      phase698TransportReentryV2L1Canonical(report),
    );
    const artifactPath = resolveContained(
      root,
      phase698TransportReentryV2L1ArtifactRelativePath(marker.runId),
    );
    const artifactBytes = await readRegular(artifactPath);
    const artifact = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_ARTIFACT_SCHEMA.parse(
      JSON.parse(artifactBytes),
    );
    if (artifactBytes !== `${phase698TransportReentryV2L1Canonical(artifact)}\n`)
      throw new Error('artifact');
    if (records.filter((record) => record.event === 'slot_terminal').length !== 3)
      throw new Error('slots');
    for (const record of records) {
      if (record.event === 'slot_terminal') {
        const expected = report.slots.find((slot) => slot.slot === record.result.slot);
        if (
          !expected ||
          phase698TransportReentryV2L1Canonical(expected) !==
            phase698TransportReentryV2L1Canonical(record.result)
        )
          throw new Error('slot mismatch');
      }
    }
    if (
      terminal.reportSha256 !== reportSha ||
      publication.reportSha256 !== reportSha ||
      artifact.runId !== marker.runId ||
      artifact.markerSha256 !== phase698TransportReentryV2L1Sha256(markerBytes) ||
      artifact.reportLogicalSha256 !== reportSha ||
      artifact.durability.terminalSequence !== terminal.sequence ||
      artifact.durability.terminalRecordHash !== terminal.recordHash ||
      artifact.durability.journalRecordsBeforePublication !== publication.sequence ||
      published.evidenceSha256 !== phase698TransportReentryV2L1Sha256(artifactBytes) ||
      phase698TransportReentryV2L1Canonical(artifact.report) !==
        phase698TransportReentryV2L1Canonical(report)
    )
      throw new Error('hash mismatch');
    if (
      !phase698TransportReentryV2L1WritableRelativePath(
        PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_RELATIVE,
      )
    )
      throw new Error('lineage');
    await ensureOnlyExpectedFiles(root, marker.runId);
    const statInfo = await lstat(artifactPath);
    if (!statInfo.isFile()) throw new Error('artifact regular');
    return Object.freeze({
      ok: true,
      runId: marker.runId,
      gate: report.gate,
      qualityAuthority: report.qualityAuthority,
      finalJournalEvent: 'evidence_published' as const,
      journalRecords: records.length,
      reportLogicalSha256: reportSha,
      physicalArtifactSha256: phase698TransportReentryV2L1Sha256(artifactBytes),
      providerCalls: report.providerCalls,
      credentialReads: report.credentialReads,
      formalEvidence: report.formalEvidence,
    });
  } catch {
    return Object.freeze({
      ok: false,
      runId: null,
      gate: null,
      qualityAuthority: null,
      finalJournalEvent: null,
      journalRecords: 0,
      reportLogicalSha256: null,
      physicalArtifactSha256: null,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
    });
  }
}

export async function recoverPhase698TransportReentryV2L1InterruptedAttempt(input: {
  root: string;
  isProcessAlive: (pid: number) => boolean;
}): Promise<
  import('./phase-6-9-8-retriever-final-response-transport-reentry-v2-l1-contract.ts').Phase698TransportReentryV2L1RecoveryResult
> {
  let root: string;
  let marker: Phase698TransportReentryV2L1Marker;
  try {
    root = await resolveL1Root(input.root);
    const bytes = await readRegular(
      resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_RELATIVE),
    );
    marker = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_SCHEMA.parse(JSON.parse(bytes));
    if (bytes !== `${phase698TransportReentryV2L1Canonical(marker)}\n`) throw new Error();
  } catch {
    return { ok: false, code: 'marker_missing_or_invalid' };
  }
  if (input.isProcessAlive(marker.creatorPid)) return { ok: false, code: 'process_active' };
  const validation = await validatePhase698TransportReentryV2L1Bundle(root);
  if (validation.ok) return { ok: false, code: 'already_published' };
  try {
    const records = await readJournal(root, marker);
    if (records.some((record) => record.event === 'evidence_published'))
      return { ok: false, code: 'already_published' };
    const state = await replayState(root, marker, records);
    if (!state.records.some((record) => record.event === 'recovery_claimed')) {
      await appendRecord(state, {
        event: 'recovery_claimed',
        claimSha256: phase698TransportReentryV2L1Sha256(
          `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_CLAIM_VERSION}:${state.runId}`,
        ),
      });
    }
    await writeRecoveryClaim(root, state.runId);
    const artifactPath = resolveContained(
      root,
      phase698TransportReentryV2L1ArtifactRelativePath(marker.runId),
    );
    const existingArtifact = await pathExists(artifactPath);
    if (existingArtifact) {
      if (!state.records.some((record) => record.event === 'publication_started'))
        return { ok: false, code: 'publication_invalid' };
      const artifactBytes = await readRegular(artifactPath);
      await appendRecord(state, {
        event: 'evidence_published',
        evidenceSha256: phase698TransportReentryV2L1Sha256(artifactBytes),
      });
      const checked = await validatePhase698TransportReentryV2L1Bundle(root);
      if (!checked.ok || !checked.physicalArtifactSha256)
        return { ok: false, code: 'publication_invalid' };
      return {
        ok: true,
        runId: marker.runId,
        disposition: 'terminal_publication_recovered',
        artifactSha256: checked.physicalArtifactSha256,
      };
    }
    const slots: Phase698TransportReentryV2L1SlotResult[] = [];
    for (let index = 0; index < 3; index += 1) {
      const slot = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER[index];
      const stored = state.slots.get(slot);
      const events = state.slotEvents.get(slot);
      const result =
        stored ??
        (events?.has('dispatch')
          ? recoveredDispatchedFailure(slot, index + 1, events)
          : suffixResult(slot, index + 1, 'not_started_quality_breaker', 'validation'));
      if (!stored) {
        await appendRecord(state, { event: 'slot_terminal', result });
        state.slots.set(slot, result);
      }
      slots.push(result);
    }
    const report = state.report ?? buildReport(slots, 'validation');
    if (!state.report) {
      await ensureReportSnapshot(state, report);
      state.report = report;
      await appendRecord(state, {
        event: 'run_terminal',
        reportSha256: phase698TransportReentryV2L1Sha256(
          phase698TransportReentryV2L1Canonical(report),
        ),
        slotCount: 3,
      });
    }
    const published = await publishStateArtifact(state, report, { mode: 'recovery' });
    const checked = await validatePhase698TransportReentryV2L1Bundle(root);
    if (!checked.ok) return { ok: false, code: 'publication_invalid' };
    return {
      ok: true,
      runId: marker.runId,
      disposition: 'crash_only_sealed',
      artifactSha256: published.evidenceSha256,
    };
  } catch {
    return { ok: false, code: 'journal_invalid' };
  }
}

function recoveredDispatchedFailure(
  slot: Phase698TransportReentryV2L1Slot,
  sequence: number,
  events: ReadonlySet<string>,
): Phase698TransportReentryV2L1SlotResult {
  const responseObserved = events.has('response');
  const usageObserved = events.has('usage');
  return failureResult(
    slot,
    sequence,
    responseObserved ? 'schema' : 'transport',
    {
      executions: 1,
      dispatches: 1,
      responses: responseObserved ? 1 : 0,
      verifiedUsage: usageObserved ? 1 : 0,
    },
    0,
    true,
    true,
  );
}

async function replayState(
  root: string,
  marker: Phase698TransportReentryV2L1Marker,
  records: Phase698TransportReentryV2L1JournalRecord[],
): Promise<MutableState> {
  const markerBytes = `${phase698TransportReentryV2L1Canonical(marker)}\n`;
  const state: MutableState = {
    root,
    runId: marker.runId,
    marker,
    markerBytes,
    markerSha256: phase698TransportReentryV2L1Sha256(markerBytes),
    journalPath: resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE),
    records: [...records],
    slotEvents: new Map(),
    slots: new Map(),
    report: null,
    queue: Promise.resolve(),
  };
  for (const record of records) {
    if (record.event === 'slot_dispatch_started')
      state.slotEvents.set(record.slot, new Set(['dispatch']));
    if (record.event === 'slot_response_observed')
      state.slotEvents.get(record.slot)?.add('response');
    if (record.event === 'slot_usage_verified') state.slotEvents.get(record.slot)?.add('usage');
    if (record.event === 'slot_terminal') state.slots.set(record.result.slot, record.result);
  }
  const terminal = records.find((record) => record.event === 'run_terminal');
  if (terminal) {
    const reportBytes = await readRegular(
      resolveContained(root, phase698TransportReentryV2L1ReportRelativePath(marker.runId)),
    );
    const report = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_REPORT_SCHEMA.parse(JSON.parse(reportBytes));
    if (
      reportBytes !== `${phase698TransportReentryV2L1Canonical(report)}\n` ||
      terminal.reportSha256 !==
        phase698TransportReentryV2L1Sha256(phase698TransportReentryV2L1Canonical(report))
    )
      throw new Error('replay report');
    state.report = report;
  }
  return state;
}

async function readJournal(
  root: string,
  marker: Phase698TransportReentryV2L1Marker,
): Promise<Phase698TransportReentryV2L1JournalRecord[]> {
  const bytes = await readRegular(
    resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE),
  );
  const records: Phase698TransportReentryV2L1JournalRecord[] = [];
  let previousHash: string | null = null;
  const lines: string[] = bytes.split('\n');
  if (lines.at(-1) === '') lines.pop();
  if (lines.length === 0 || lines.some((line) => line.length === 0))
    throw new Error('journal lines');
  let activeSlot: Phase698TransportReentryV2L1Slot | null = null;
  let runTerminalSeen = false;
  let recoveryClaimSeen = false;
  let publicationStartedSeen = false;
  let evidencePublishedSeen = false;
  const terminalSlots = new Set<Phase698TransportReentryV2L1Slot>();
  const eventsBySlot = new Map<Phase698TransportReentryV2L1Slot, Set<string>>();
  for (let index = 0; index < lines.length; index += 1) {
    const parsed = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_SCHEMA.parse(
      JSON.parse(lines[index]),
    );
    const { recordHash, ...unsigned } = parsed;
    if (
      parsed.runId !== marker.runId ||
      parsed.sequence !== index ||
      parsed.previousHash !== previousHash ||
      recordHash !==
        phase698TransportReentryV2L1Sha256(phase698TransportReentryV2L1Canonical(unsigned))
    )
      throw new Error('journal hash');
    previousHash = parsed.recordHash;
    if (evidencePublishedSeen) throw new Error('journal after publication');
    if (parsed.event === 'attempt_reserved') {
      if (
        index !== 0 ||
        parsed.markerSha256 !==
          phase698TransportReentryV2L1Sha256(`${phase698TransportReentryV2L1Canonical(marker)}\n`)
      )
        throw new Error('journal reservation');
    }
    if (parsed.event === 'slot_dispatch_started') {
      if (
        runTerminalSeen ||
        recoveryClaimSeen ||
        publicationStartedSeen ||
        activeSlot !== null ||
        terminalSlots.has(parsed.slot) ||
        parsed.slot !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER[terminalSlots.size]
      )
        throw new Error('journal dispatch order');
      activeSlot = parsed.slot;
      eventsBySlot.set(parsed.slot, new Set(['dispatch']));
    }
    if (parsed.event === 'slot_response_observed') {
      const events = eventsBySlot.get(parsed.slot);
      if (
        recoveryClaimSeen ||
        runTerminalSeen ||
        activeSlot !== parsed.slot ||
        !events?.has('dispatch') ||
        events.has('response')
      )
        throw new Error('journal response order');
      events.add('response');
    }
    if (parsed.event === 'slot_usage_verified') {
      const events = eventsBySlot.get(parsed.slot);
      if (
        recoveryClaimSeen ||
        runTerminalSeen ||
        activeSlot !== parsed.slot ||
        !events?.has('response') ||
        events.has('usage')
      )
        throw new Error('journal usage order');
      events.add('usage');
    }
    if (parsed.event === 'slot_terminal') {
      const result = parsed.result;
      const events = eventsBySlot.get(result.slot);
      if (
        runTerminalSeen ||
        publicationStartedSeen ||
        terminalSlots.has(result.slot) ||
        result.sequence !== terminalSlots.size + 1 ||
        result.slot !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER[terminalSlots.size]
      )
        throw new Error('journal slot terminal order');
      if (result.runnerWire.dispatches === 1) {
        if (activeSlot !== result.slot || !events?.has('dispatch'))
          throw new Error('journal dispatch prefix');
        if (result.providerWire.responses === 1 && !events.has('response'))
          throw new Error('journal response prefix');
        if (result.providerWire.verifiedUsage === 1 && !events.has('usage'))
          throw new Error('journal usage prefix');
      } else if (
        events ||
        activeSlot === result.slot ||
        ![
          'attempted_aborted',
          'not_started_quality_breaker',
          'not_started_external_abort',
        ].includes(result.disposition)
      ) {
        throw new Error('journal zero-dispatch terminal');
      }
      terminalSlots.add(result.slot);
      if (activeSlot === result.slot) activeSlot = null;
    }
    if (parsed.event === 'run_terminal') {
      if (
        runTerminalSeen ||
        publicationStartedSeen ||
        activeSlot !== null ||
        terminalSlots.size !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_SLOT_ORDER.length
      )
        throw new Error('journal run terminal');
      runTerminalSeen = true;
    }
    if (parsed.event === 'recovery_claimed') {
      if (
        recoveryClaimSeen ||
        evidencePublishedSeen ||
        parsed.claimSha256 !==
          phase698TransportReentryV2L1Sha256(
            `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_CLAIM_VERSION}:${marker.runId}`,
          )
      )
        throw new Error('journal recovery claim');
      recoveryClaimSeen = true;
    }
    if (parsed.event === 'publication_started') {
      if (!runTerminalSeen || publicationStartedSeen || evidencePublishedSeen)
        throw new Error('journal publication order');
      publicationStartedSeen = true;
    }
    if (parsed.event === 'evidence_published') {
      if (!runTerminalSeen || !publicationStartedSeen || evidencePublishedSeen)
        throw new Error('journal evidence order');
      evidencePublishedSeen = true;
    }
    records.push(parsed);
  }
  if (records.length === 0 || records[0]?.event !== 'attempt_reserved')
    throw new Error('journal start');
  return records;
}

async function ensureReportSnapshot(
  state: MutableState,
  report: Phase698TransportReentryV2L1Report,
) {
  const path = resolveContained(
    state.root,
    phase698TransportReentryV2L1ReportRelativePath(state.runId),
  );
  const bytes = `${phase698TransportReentryV2L1Canonical(report)}\n`;
  if (await pathExists(path)) {
    if ((await readRegular(path)) !== bytes) throw new Error('L1_REPORT_EXISTS_MISMATCH');
    return;
  }
  await writeExclusive(path, bytes);
  await syncFileAndDirectory(path);
}

async function writeRecoveryClaim(root: string, runId: string) {
  const path = resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_RELATIVE);
  const claim = PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_SCHEMA.parse({
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_CLAIM_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    runId,
  });
  const bytes = `${phase698TransportReentryV2L1Canonical(claim)}\n`;
  if (await pathExists(path)) {
    if ((await readRegular(path)) !== bytes) throw new Error('L1_RECOVERY_CLAIM_MISMATCH');
    return;
  }
  await writeExclusive(path, bytes);
  await syncFileAndDirectory(path);
}

async function prepareRoot(root: string) {
  await mkdir(resolveContained(root, '.tmp'), { recursive: true });
  await assertTrustedTmpDirectory(root);
  await ensureNoFormalFiles(root);
}
async function ensureNoFormalFiles(root: string) {
  for (const relative of [
    PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_RELATIVE,
    PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE,
    PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_RELATIVE,
  ]) {
    const path = resolveContained(root, relative);
    if (await pathExists(path)) throw new Error('L1_FORMAL_PATH_OCCUPIED');
  }
  const tmp = resolveContained(root, '.tmp');
  const entries = await readdir(tmp).catch((error: unknown) => {
    if (isNodeError(error, 'ENOENT')) return [] as string[];
    throw error;
  });
  for (const entry of entries) {
    if (isL1FormalLineagePath(`.tmp/${entry}`)) throw new Error('L1_FORMAL_PATH_OCCUPIED');
  }
  const rootEntries = await readdir(root);
  for (const entry of rootEntries) {
    if (isL1FormalLineagePath(entry)) throw new Error('L1_FORMAL_PATH_OCCUPIED');
  }
}
async function ensureOnlyExpectedFiles(root: string, runId: string) {
  await assertTrustedTmpDirectory(root);
  const expected = new Set([
    PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_MARKER_RELATIVE,
    PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_JOURNAL_RELATIVE,
    PHASE_6_9_8_TRANSPORT_REENTRY_V2_L1_RECOVERY_RELATIVE,
    phase698TransportReentryV2L1ReportRelativePath(runId),
    phase698TransportReentryV2L1ArtifactRelativePath(runId),
  ]);
  const tmpEntries = await readdir(resolveContained(root, '.tmp'));
  for (const entry of tmpEntries)
    if (isL1FormalLineagePath(`.tmp/${entry}`) && !expected.has(`.tmp/${entry}`))
      throw new Error('L1_EXTRA_FORMAL_FILE');
  const rootEntries = await readdir(root);
  for (const entry of rootEntries)
    if (isL1FormalLineagePath(entry) && !expected.has(entry))
      throw new Error('L1_EXTRA_FORMAL_FILE');
}

function isL1FormalLineagePath(relative: string) {
  return (
    relative.startsWith('.tmp/phase-6-9-8-retriever-final-response-transport-reentry-v2') ||
    relative.startsWith('phase-6-9-8-retriever-final-response-transport-reentry-v2')
  );
}

async function assertTrustedTmpDirectory(root: string) {
  const tmp = resolveContained(root, '.tmp');
  const [info, canonicalTmp] = await Promise.all([lstat(tmp), realpath(tmp)]);
  if (!info.isDirectory() || info.isSymbolicLink() || canonicalTmp !== tmp)
    throw new Error('L1_TMP_INVALID');
}

async function resolveRepositoryRoot(input: string) {
  const supplied = realpathSync(resolve(input));
  const result = spawnSync('git', ['-C', supplied, 'rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0 || typeof result.stdout !== 'string') throw new Error('git root');
  const root = result.stdout.trim();
  if (root.length === 0) throw new Error('git root');
  return realpathSync(root);
}

async function resolveL1Root(input: string) {
  try {
    return await resolveRepositoryRoot(input);
  } catch {
    return requireSyntheticRoot(input);
  }
}

async function requireSyntheticRoot(input: string) {
  const root = resolve(input);
  const [info, canonicalRoot] = await Promise.all([lstat(root), realpath(root)]);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    canonicalRoot !== root ||
    !basename(root).startsWith('phase-698-transport-reentry-v2-l1-')
  )
    throw new Error('L1_SYNTHETIC_ROOT_INVALID');
  return root;
}
function resolveContained(root: string, relative: string) {
  const resolvedRoot = resolve(root);
  const target = resolve(resolvedRoot, relative);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${sep}`))
    throw new Error('L1_PATH_ESCAPE');
  return target;
}
async function writeExclusive(path: string, bytes: string) {
  const handle = await open(path, 'wx');
  try {
    await handle.writeFile(bytes, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}
async function syncFileAndDirectory(path: string) {
  const handle = await open(path, 'r+');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
  await syncDirectory(dirname(path));
}
async function syncDirectory(path: string) {
  try {
    const handle = await open(path, 'r');
    await handle.sync();
    await handle.close();
  } catch {
    /* Windows may reject directory fsync; file is already durable. */
  }
}
async function readRegular(path: string): Promise<string> {
  const info = await lstat(path);
  if (!info.isFile()) throw new Error('L1_NOT_REGULAR');
  return readFile(path, 'utf8');
}
async function pathExists(path: string) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return false;
    throw error;
  }
}
function isNodeError(error: unknown, code: string): error is { code: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === code
  );
}
function timeoutFor(slot: Phase698TransportReentryV2L1Slot) {
  return ({ rewrite: 4_000, qwen: 5_500, final_response: 20_000 } as const)[slot];
}
function defaultWire(): Phase698TransportReentryV2L1Wire {
  return { executions: 1, dispatches: 1, responses: 0, verifiedUsage: 0 };
}
function zeroWire(): Phase698TransportReentryV2L1Wire {
  return { executions: 0, dispatches: 0, responses: 0, verifiedUsage: 0 };
}
function raceBounded<T>(
  promise: Promise<T>,
  parent: AbortSignal,
  controller: AbortController,
  timeoutMs: number,
): Promise<
  | { kind: 'result'; value: T }
  | { kind: 'error'; error: unknown }
  | { kind: 'timeout' }
  | { kind: 'aborted' }
> {
  return new Promise((resolveRace) => {
    let settled = false;
    const finish = (
      value:
        | { kind: 'result'; value: T }
        | { kind: 'error'; error: unknown }
        | { kind: 'timeout' }
        | { kind: 'aborted' },
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      parent.removeEventListener('abort', onAbort);
      resolveRace(value);
    };
    const onAbort = () => {
      controller.abort();
      finish({ kind: 'aborted' });
    };
    const timer = setTimeout(() => {
      controller.abort();
      finish({ kind: 'timeout' });
    }, timeoutMs);
    parent.addEventListener('abort', onAbort, { once: true });
    if (parent.aborted) {
      onAbort();
      return;
    }
    promise.then(
      (value) => finish({ kind: 'result', value }),
      (error) => finish({ kind: 'error', error }),
    );
  });
}

const REWRITE_SCHEMA = z.object({ rewrittenQuery: z.string().min(1).max(2_000) }).strict();
const REWRITE_SYSTEM_PROMPT =
  'You are a transport canary. Return strict JSON {"rewrittenQuery":"..."} only.';
const REWRITE_USER_PROMPT =
  '{"originalQuery":"检索链路 transport canary","recentTurns":[{"role":"user","content":"确认受限链路状态"}],"activeContext":{"question":"检索链路","goal":"确认 transport"}}';
const FINAL_SYSTEM_PROMPT =
  'You are a transport canary. Answer briefly from the supplied context. Do not call tools.';
const FINAL_USER_PROMPT =
  '请用一句话说明本次受限 transport canary 的目的；只输出自然语言，不要声称已保存或调用工具。';

export type Phase698TransportReentryV2L1LivePortPreparation =
  | Readonly<{ ok: true; ports: Phase698TransportReentryV2L1Ports }>
  | Readonly<{ ok: false; reasonCode: 'configuration' }>;

/**
 * Compose the three first-party adapters from C1's opaque projection. This is
 * deliberately the only place where a dedicated capability can hand a key to
 * an adapter constructor. The returned ports contain closures, never generic
 * env names or serialisable credential fields.
 */
export function createPhase698TransportReentryV2L1LivePorts(
  projection: Phase698TransportReentryV2Projection,
): Phase698TransportReentryV2L1LivePortPreparation {
  try {
    const rewritePreflight = inspectPhase698TransportReentryV2DedicatedCapability(
      projection.rewrite,
      'rewrite',
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.rewrite,
    );
    const qwenPreflight = inspectPhase698TransportReentryV2DedicatedCapability(
      projection.qwen,
      'qwen',
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.qwen,
    );
    const finalPreflight = inspectPhase698TransportReentryV2DedicatedCapability(
      projection.final_response,
      'final_response',
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.final_response,
    );
    if (
      isCapabilityFailure(rewritePreflight) ||
      isCapabilityFailure(qwenPreflight) ||
      isCapabilityFailure(finalPreflight)
    )
      return { ok: false, reasonCode: 'configuration' };
    const ports: Phase698TransportReentryV2L1Ports = Object.freeze({
      rewrite: async ({ signal }) => {
        const rewriteWire = createPhase697V7WireDiagnostics({ appendStage: async () => undefined });
        try {
          const rewriteAdapter = withPhase698TransportReentryV2DedicatedApiKey(
            projection.rewrite,
            'rewrite',
            PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.rewrite,
            (apiKey) =>
              createFirstPartyDeepSeekV4ProDirectAdapter(
                {
                  provider: 'deepseek',
                  apiKey,
                  baseURL: 'https://api.deepseek.com/v1',
                  model: 'deepseek-v4-pro',
                },
                rewriteWire.capability,
              ),
          );
          if (isCapabilityFailure(rewriteAdapter))
            throw new Phase698TransportReentryV2L1PortFailure('configuration');
          const result = await rewriteAdapter.executor({
            schema: REWRITE_SCHEMA,
            systemPrompt: REWRITE_SYSTEM_PROMPT,
            userPrompt: REWRITE_USER_PROMPT,
            maxOutputTokens: 160,
            signal,
          });
          const snapshot = readV7Snapshot(rewriteWire.capability);
          const usage = normalizeUsage(result.usage);
          if (!usage || snapshot.counters.verifiedUsages !== 1)
            throw new Phase698TransportReentryV2L1PortFailure('usage', {
              responseObserved: snapshot.counters.providerResponses === 1,
              usageObserved: false,
              providerWire: wireFromV7(snapshot),
            });
          return { usage, verifiedCostCny: deepseekCost(usage), durationMs: 0 };
        } catch (error) {
          const snapshot = readV7Snapshot(rewriteWire.capability);
          if (error instanceof Phase698TransportReentryV2L1PortFailure) throw error;
          throw new Phase698TransportReentryV2L1PortFailure(mapFailure(snapshot.failureCategory), {
            responseObserved: snapshot.counters.providerResponses === 1,
            usageObserved: snapshot.counters.verifiedUsages === 1,
            providerWire: wireFromV7(snapshot),
          });
        }
      },
      qwen: async ({ signal }) => {
        const qwenWire = createPhase698ProviderWireDiagnostics('qwen_retrieval');
        try {
          const qwenAdapter = withPhase698TransportReentryV2DedicatedApiKey(
            projection.qwen,
            'qwen',
            PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.qwen,
            (apiKey) =>
              createQwenTextEmbeddingV4DiagnosticProvider(
                {
                  apiKey,
                  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                  model: QWEN_TEXT_EMBEDDING_V4_MODEL,
                  dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
                  priceProfile: QWEN_TEXT_EMBEDDING_V4_PRICE_PROFILE,
                },
                qwenWire.capability,
              ),
          );
          if (isCapabilityFailure(qwenAdapter))
            throw new Phase698TransportReentryV2L1PortFailure('configuration');
          if (qwenAdapter.endpointProfile !== QWEN_TEXT_EMBEDDING_V4_ENDPOINT_PROFILE)
            throw new Error('endpoint');
          const result = await qwenAdapter.executor({
            inputs: ['PrepMind V2 transport canary retrieval query.'],
            dimensions: QWEN_TEXT_EMBEDDING_V4_DIMENSIONS,
            signal,
          });
          const snapshot = readProviderSnapshot(qwenWire.capability);
          const inputTokens = result.usage?.inputTokens;
          if (
            !Number.isSafeInteger(inputTokens) ||
            inputTokens <= 0 ||
            snapshot.counters.verifiedUsages !== 1
          )
            throw new Phase698TransportReentryV2L1PortFailure('usage', {
              responseObserved: snapshot.counters.providerResponses === 1,
              providerWire: wireFromProvider(snapshot),
            });
          const usage = { inputTokens, outputTokens: 0, totalTokens: inputTokens };
          return {
            usage,
            verifiedCostCny: calculateQwenTextEmbeddingV4CostCny(inputTokens),
            durationMs: 0,
          };
        } catch (error) {
          const snapshot = readProviderSnapshot(qwenWire.capability);
          if (error instanceof Phase698TransportReentryV2L1PortFailure) throw error;
          throw new Phase698TransportReentryV2L1PortFailure(mapFailure(snapshot.failureCategory), {
            responseObserved: snapshot.counters.providerResponses === 1,
            usageObserved: snapshot.counters.verifiedUsages === 1,
            providerWire: wireFromProvider(snapshot),
          });
        }
      },
      final_response: async ({ signal }) => {
        const finalWire = createPhase698ProviderWireDiagnostics('final_response_stream');
        try {
          const finalAdapter = withPhase698TransportReentryV2DedicatedApiKey(
            projection.final_response,
            'final_response',
            PHASE_6_9_8_TRANSPORT_REENTRY_V2_C1_CALL_IDS.final_response,
            (apiKey) =>
              createFinalResponseStreamDiagnosticProvider(
                {
                  apiKey,
                  baseURL: FINAL_RESPONSE_STREAM_PROVIDER_BASE_URL,
                  model: FINAL_RESPONSE_STREAM_PROVIDER_MODEL,
                },
                finalWire.capability,
              ),
          );
          if (isCapabilityFailure(finalAdapter))
            throw new Phase698TransportReentryV2L1PortFailure('configuration');
          let usage: { inputTokens: number; outputTokens: number; totalTokens: number } | null =
            null;
          const digest = createHash('sha256');
          for await (const event of finalAdapter.executor({
            systemPrompt: FINAL_SYSTEM_PROMPT,
            userPrompt: FINAL_USER_PROMPT,
            maxOutputTokens: FINAL_RESPONSE_STREAM_PROVIDER_MAX_OUTPUT_TOKENS,
            signal,
          })) {
            if (event.type === 'text_delta') digest.update(event.text, 'utf8');
            else usage = normalizeUsage(event.usage);
          }
          if (digest.digest('hex').length !== 64) throw new Error('digest');
          const snapshot = readProviderSnapshot(finalWire.capability);
          if (!usage || snapshot.counters.verifiedUsages !== 1)
            throw new Phase698TransportReentryV2L1PortFailure('usage', {
              responseObserved: snapshot.counters.providerResponses === 1,
              providerWire: wireFromProvider(snapshot),
            });
          return { usage, verifiedCostCny: deepseekCost(usage), durationMs: 0 };
        } catch (error) {
          const snapshot = readProviderSnapshot(finalWire.capability);
          if (error instanceof Phase698TransportReentryV2L1PortFailure) throw error;
          throw new Phase698TransportReentryV2L1PortFailure(mapFailure(snapshot.failureCategory), {
            responseObserved: snapshot.counters.providerResponses === 1,
            usageObserved: snapshot.counters.verifiedUsages === 1,
            providerWire: wireFromProvider(snapshot),
          });
        }
      },
    });
    return Object.freeze({ ok: true, ports });
  } catch {
    return { ok: false, reasonCode: 'configuration' };
  }
}

function isCapabilityFailure(value: unknown): value is { ok: false } {
  return typeof value === 'object' && value !== null && (value as { ok?: unknown }).ok === false;
}
function normalizeUsage(
  value: unknown,
): { inputTokens: number; outputTokens: number; totalTokens: number } | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as { inputTokens?: unknown; outputTokens?: unknown };
  if (
    !Number.isSafeInteger(candidate.inputTokens) ||
    !Number.isSafeInteger(candidate.outputTokens) ||
    (candidate.inputTokens as number) <= 0 ||
    (candidate.outputTokens as number) < 0
  )
    return null;
  return {
    inputTokens: candidate.inputTokens as number,
    outputTokens: candidate.outputTokens as number,
    totalTokens: (candidate.inputTokens as number) + (candidate.outputTokens as number),
  };
}

function readV7Snapshot(
  capability: Parameters<typeof readPhase697V7WireSnapshot>[0],
): NonNullable<ReturnType<typeof readPhase697V7WireSnapshot>> {
  const snapshot = readPhase697V7WireSnapshot(capability);
  if (snapshot) return snapshot;
  return {
    version: 'phase-6.9.7-v7-wire-diagnostics-v1',
    state: 'failed',
    stages: [],
    lastCompletedStage: null,
    failureCategory: 'unknown',
    usageDisposition: 'not_observed',
    counters: {
      executorInvocations: 0,
      providerDispatches: 0,
      providerResponses: 0,
      verifiedUsages: 0,
    },
  };
}

function readProviderSnapshot(
  capability: Parameters<typeof readPhase698ProviderWireSnapshot>[0],
): NonNullable<ReturnType<typeof readPhase698ProviderWireSnapshot>> {
  const snapshot = readPhase698ProviderWireSnapshot(capability);
  if (snapshot) return snapshot;
  return {
    version: 'phase-6.9.8-provider-wire-diagnostics-v1',
    family: 'qwen_retrieval',
    state: 'failed',
    stages: [],
    lastCompletedStage: null,
    failureCategory: 'unknown',
    topLevelTypeBucket: 'not_observed',
    fieldCountBucket: 'not_observed',
    counters: {
      executorInvocations: 0,
      providerDispatches: 0,
      providerResponses: 0,
      verifiedUsages: 0,
    },
  };
}

function deepseekCost(usage: { inputTokens: number; outputTokens: number }) {
  return Number(((usage.inputTokens * 3 + usage.outputTokens * 6) / 1_000_000).toFixed(9));
}
function wireFromV7(snapshot: {
  counters: {
    executorInvocations: number;
    providerDispatches: number;
    providerResponses: number;
    verifiedUsages: number;
  };
}): Phase698TransportReentryV2L1Wire {
  return {
    executions: snapshot.counters.executorInvocations > 0 ? 1 : 0,
    dispatches: snapshot.counters.providerDispatches > 0 ? 1 : 0,
    responses: snapshot.counters.providerResponses > 0 ? 1 : 0,
    verifiedUsage: snapshot.counters.verifiedUsages > 0 ? 1 : 0,
  };
}
function wireFromProvider(snapshot: {
  counters: {
    executorInvocations: number;
    providerDispatches: number;
    providerResponses: number;
    verifiedUsages: number;
  };
}): Phase698TransportReentryV2L1Wire {
  return {
    executions: snapshot.counters.executorInvocations > 0 ? 1 : 0,
    dispatches: snapshot.counters.providerDispatches > 0 ? 1 : 0,
    responses: snapshot.counters.providerResponses > 0 ? 1 : 0,
    verifiedUsage: snapshot.counters.verifiedUsages > 0 ? 1 : 0,
  };
}
function mapFailure(category: string | null): Phase698TransportReentryV2L1FailureCode {
  if (category === 'pre_dispatch_abort' || category === 'post_dispatch_abort') return 'abort';
  if (category === 'runtime_timeout') return 'timeout';
  if (category === 'http_auth') return 'http_auth';
  if (category === 'http_rate_limit') return 'http_rate_limit';
  if (category === 'http_client') return 'http_client';
  if (category === 'http_server') return 'http_server';
  if (category === 'usage_validation' || category === 'usage_invalid') return 'usage';
  if (
    category &&
    (category.includes('schema') ||
      category.includes('validation') ||
      category.includes('invalid') ||
      category.includes('parse'))
  )
    return 'schema';
  return 'transport';
}
