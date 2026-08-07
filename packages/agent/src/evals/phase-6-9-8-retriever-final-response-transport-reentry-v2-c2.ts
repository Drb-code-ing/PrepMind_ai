import { randomUUID } from 'node:crypto';
import {
  appendFile,
  lstat,
  link,
  mkdtemp,
  mkdir,
  open,
  readFile,
  readdir,
  realpath,
  rm,
  stat,
  unlink,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';

import { z } from 'zod';

import {
  consumePhase698TransportReentryV2C2AdmissionCapability,
  consumePhase698TransportReentryV2C2ConfigurationCapability,
  consumePhase698TransportReentryV2C2ReservationCapability,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_FAILURE_CODES,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE_FAILED,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_RELATIVE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_RELATIVE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MAX_COST_CNY,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RECOVERY_RELATIVE,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RUN_ID_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_REPORT_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_RESULT_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_SCHEMA,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
  phase698TransportReentryV2C2ArtifactRelativePath,
  phase698TransportReentryV2C2Canonical,
  phase698TransportReentryV2C2ReportRelativePath,
  phase698TransportReentryV2C2Sha256,
  phase698TransportReentryV2C2SyntheticRootPrefix,
  type Phase698TransportReentryV2C2FailureCode,
  type Phase698TransportReentryV2C2Report,
  type Phase698TransportReentryV2C2Slot,
  type Phase698TransportReentryV2C2SlotResult,
} from './phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts';

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_DURABILITY_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION}-durability` as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION}-marker` as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION}-journal` as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_ARTIFACT_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION}-artifact` as const;
export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RECOVERY_CLAIM_VERSION =
  `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION}-recovery-claim` as const;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_FAULTS = Object.freeze([
  'success',
  ...PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_FAILURE_CODES,
] as const);
export type Phase698TransportReentryV2C2Fault =
  (typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_FAULTS)[number];

const UUID = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RUN_ID_SCHEMA;
const HEX = z.string().regex(/^[0-9a-f]{64}$/u);
const SLOT = z.enum(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER);

const JOURNAL_COMMON = {
  version: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_VERSION),
  lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
  runId: UUID,
  sequence: z.number().int().nonnegative(),
  previousHash: HEX.nullable(),
  recordHash: HEX,
};

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_SCHEMA = z.discriminatedUnion('event', [
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('attempt_reserved'),
      markerSha256: HEX,
      createdAt: z.string().datetime({ offset: true }),
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('slot_dispatch_started'),
      slot: SLOT,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('slot_response_observed'),
      slot: SLOT,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('slot_usage_verified'),
      slot: SLOT,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('slot_terminal'),
      result: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_RESULT_SCHEMA,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('run_terminal'),
      reportSha256: HEX,
      slotCount: z.literal(3),
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('recovery_claimed'),
      claimSha256: HEX,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('publication_started'),
      reportSha256: HEX,
    })
    .strict(),
  z
    .object({
      ...JOURNAL_COMMON,
      event: z.literal('evidence_published'),
      evidenceSha256: HEX,
    })
    .strict(),
]);

export type Phase698TransportReentryV2C2JournalRecord = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_SCHEMA
>;

export const PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_ARTIFACT_SCHEMA = z
  .object({
    artifactVersion: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_ARTIFACT_VERSION),
    durabilityVersion: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_DURABILITY_VERSION),
    lineage: z.literal(PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE),
    runId: UUID,
    markerSha256: HEX,
    reportLogicalSha256: HEX,
    durability: z
      .object({
        publicationMode: z.enum(['runtime', 'recovery']),
        terminalSequence: z.number().int().nonnegative(),
        terminalRecordHash: HEX,
        journalRecordsBeforePublication: z.number().int().positive(),
        hardLink: z.literal(true),
        rawDataRetained: z.literal(false),
      })
      .strict(),
    report: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_REPORT_SCHEMA,
  })
  .strict();

export type Phase698TransportReentryV2C2Artifact = z.infer<
  typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_ARTIFACT_SCHEMA
> & { report: Phase698TransportReentryV2C2Report };

export type Phase698TransportReentryV2C2Reservation = Readonly<{
  runId: string;
  appendSlotDispatchStarted(slot: Phase698TransportReentryV2C2Slot): Promise<void>;
  appendSlotResponseObserved(slot: Phase698TransportReentryV2C2Slot): Promise<void>;
  appendSlotUsageVerified(slot: Phase698TransportReentryV2C2Slot): Promise<void>;
  appendSlotTerminal(result: Phase698TransportReentryV2C2SlotResult): Promise<void>;
  appendRunTerminal(report: Phase698TransportReentryV2C2Report): Promise<void>;
  publishArtifact(
    report: Phase698TransportReentryV2C2Report,
    options?: Readonly<{ publicationFault?: boolean; mode?: 'runtime' | 'recovery' }>,
  ): Promise<Readonly<{ evidenceSha256: string; relativePath: string }>>;
}>;

export type Phase698TransportReentryV2C2Validation = Readonly<{
  ok: boolean;
  runId: string | null;
  gate:
    | typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE
    | typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE_FAILED
    | null;
  qualityAuthority: 'none' | null;
  finalJournalEvent: 'evidence_published' | null;
  journalRecords: number;
  reportLogicalSha256: string | null;
  physicalArtifactSha256: string | null;
  providerCalls: 0;
  credentialReads: 0;
  formalEvidence: 0;
}>;

export type Phase698TransportReentryV2C2RecoveryResult =
  | Readonly<{
      ok: true;
      runId: string;
      disposition: 'crash_only_sealed' | 'terminal_publication_recovered';
      artifactSha256: string;
    }>
  | Readonly<{
      ok: false;
      code:
        | 'marker_missing_or_invalid'
        | 'process_active'
        | 'journal_invalid'
        | 'publication_invalid'
        | 'already_published';
    }>;

type MutableState = {
  root: string;
  runId: string;
  marker: z.infer<typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA>;
  markerBytes: string;
  markerSha256: string;
  journalPath: string;
  records: Phase698TransportReentryV2C2JournalRecord[];
  slotEvents: Map<Phase698TransportReentryV2C2Slot, Set<string>>;
  slots: Map<Phase698TransportReentryV2C2Slot, Phase698TransportReentryV2C2SlotResult>;
  report: Phase698TransportReentryV2C2Report | null;
  queue: Promise<void>;
};

export async function createPhase698TransportReentryV2C2SyntheticRootForTest() {
  return mkdtemp(join(tmpdir(), phase698TransportReentryV2C2SyntheticRootPrefix()));
}

export async function removePhase698TransportReentryV2C2SyntheticRootForTest(root: string) {
  await rm(root, { recursive: true, force: true });
}

export async function reservePhase698TransportReentryV2C2Attempt(input: {
  root: string;
  configurationCapability: unknown;
  reservationCapability: unknown;
  expectedAuthority?: 'synthetic_test' | 'git_verified';
  runId?: string;
  createdAt?: string;
}): Promise<Phase698TransportReentryV2C2Reservation> {
  const root = await requireSyntheticRoot(input.root);
  if (!consumePhase698TransportReentryV2C2ConfigurationCapability(input.configurationCapability))
    throw new Error('C2_CONFIGURATION_CAPABILITY_INVALID');
  const expectedAuthority = input.expectedAuthority ?? 'synthetic_test';
  const issued = consumePhase698TransportReentryV2C2ReservationCapability(
    input.reservationCapability,
    expectedAuthority,
  );
  if (issued.authority !== 'synthetic_test') throw new Error('C2_LIVE_DISABLED');
  const runId = UUID.parse(input.runId ?? randomUUID());
  const createdAt = input.createdAt ?? new Date().toISOString();
  const source = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SOURCE_SCHEMA.parse(issued.source);
  const marker = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_VERSION,
    durabilityVersion: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_DURABILITY_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    runId,
    authority: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_AUTHORITY,
    qualityAuthority: 'none',
    runMode: 'synthetic_static',
    plannedSlots: 3,
    source,
    credentialReads: 0,
    providerCalls: 0,
    formalEvidence: 0,
    creatorPid: process.pid,
    createdAt,
  });
  await prepareSyntheticTmpDirectory(root);
  await ensureNoFormalFiles(root);
  const markerBytes = `${phase698TransportReentryV2C2Canonical(marker)}\n`;
  const markerPath = resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_RELATIVE);
  await writeExclusive(markerPath, markerBytes);
  await syncFileAndDirectory(markerPath);
  const journalPath = resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_RELATIVE);
  const state: MutableState = {
    root,
    runId,
    marker,
    markerBytes,
    markerSha256: phase698TransportReentryV2C2Sha256(markerBytes),
    journalPath,
    records: [],
    slotEvents: new Map(),
    slots: new Map(),
    report: null,
    queue: Promise.resolve(),
  };
  const reserved = nextRecord(state, {
    event: 'attempt_reserved',
    markerSha256: state.markerSha256,
    createdAt,
  });
  await writeExclusive(journalPath, `${phase698TransportReentryV2C2Canonical(reserved)}\n`);
  await syncFileAndDirectory(journalPath);
  state.records.push(reserved);
  return reservationFromState(state);
}

export type Phase698TransportReentryV2C2SyntheticRunInput = Readonly<{
  root: string;
  admissionCapability: unknown;
  configurationCapability: unknown;
  reservationCapability: unknown;
  faults?: Partial<Record<Phase698TransportReentryV2C2Slot, Phase698TransportReentryV2C2Fault>>;
  abortBeforeSlot?: Phase698TransportReentryV2C2Slot;
  publicationFault?: boolean;
  runId?: string;
}>;

export type Phase698TransportReentryV2C2SyntheticRunResult = Readonly<{
  ok: boolean;
  report: Phase698TransportReentryV2C2Report;
  validation: Phase698TransportReentryV2C2Validation;
  recoveryRequired: boolean;
}>;

export async function runPhase698TransportReentryV2C2Synthetic(
  input: Phase698TransportReentryV2C2SyntheticRunInput,
): Promise<Phase698TransportReentryV2C2SyntheticRunResult> {
  const admission = consumePhase698TransportReentryV2C2AdmissionCapability(
    input.admissionCapability,
    'synthetic_test',
  );
  if (admission.source.formalArtifactCount !== 0) throw new Error('C2_FORMAL_ARTIFACT_FENCE');
  const reservation = await reservePhase698TransportReentryV2C2Attempt({
    root: input.root,
    configurationCapability: input.configurationCapability,
    reservationCapability: input.reservationCapability,
    expectedAuthority: 'synthetic_test',
    runId: input.runId,
  });
  const faults = input.faults ?? {};
  const slotResults: Phase698TransportReentryV2C2SlotResult[] = [];
  let breaker: Phase698TransportReentryV2C2FailureCode | 'none' = 'none';
  let syntheticPortCalls = 0;
  for (let index = 0; index < PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER.length; index += 1) {
    const slot = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER[index];
    const sequence = index + 1;
    if (breaker !== 'none') {
      const disposition =
        breaker === 'abort' ? 'not_started_external_abort' : 'not_started_quality_breaker';
      const result = suffixResult(slot, sequence, disposition, breaker);
      await reservation.appendSlotTerminal(result);
      slotResults.push(result);
      continue;
    }
    if (input.abortBeforeSlot === slot) {
      breaker = 'abort';
      const result = suffixResult(slot, sequence, 'attempted_aborted', 'abort');
      await reservation.appendSlotTerminal(result);
      slotResults.push(result);
      continue;
    }
    const fault = faults[slot] ?? 'success';
    if (fault === 'abort') {
      breaker = 'abort';
      const result = suffixResult(slot, sequence, 'attempted_aborted', 'abort');
      await reservation.appendSlotTerminal(result);
      slotResults.push(result);
      continue;
    }
    await reservation.appendSlotDispatchStarted(slot);
    const base = baseWire();
    try {
      syntheticPortCalls += 1;
      if (fault === 'timeout' || fault === 'transport') throw new SyntheticPortFailure(fault);
      await reservation.appendSlotResponseObserved(slot);
      if (
        fault === 'missing' ||
        fault === 'invalid' ||
        fault === 'conflict' ||
        fault === 'schema'
      ) {
        throw new SyntheticPortFailure(fault);
      }
      if (fault === 'usage') throw new SyntheticPortFailure('usage');
      await reservation.appendSlotUsageVerified(slot);
      const result = successResult(slot, sequence);
      await reservation.appendSlotTerminal(result);
      slotResults.push(result);
    } catch (error) {
      const code = error instanceof SyntheticPortFailure ? error.code : 'validation';
      breaker = code;
      const result = failureResult(
        slot,
        sequence,
        code,
        base,
        fault === 'timeout' || fault === 'transport',
      );
      await reservation.appendSlotTerminal(result);
      slotResults.push(result);
    }
  }
  const report = buildReport(slotResults, syntheticPortCalls, breaker);
  await reservation.appendRunTerminal(report);
  try {
    await reservation.publishArtifact(report, {
      publicationFault: input.publicationFault,
      mode: 'runtime',
    });
  } catch {
    return {
      ok: false,
      report,
      validation: await validatePhase698TransportReentryV2C2Bundle({ root: input.root }),
      recoveryRequired: true,
    };
  }
  const validation = await validatePhase698TransportReentryV2C2Bundle({ root: input.root });
  return { ok: validation.ok, report, validation, recoveryRequired: !validation.ok };
}

class SyntheticPortFailure extends Error {
  readonly code: Phase698TransportReentryV2C2FailureCode;
  constructor(code: Phase698TransportReentryV2C2FailureCode) {
    super(code);
    this.code = code;
  }
}

function baseWire() {
  return Object.freeze({ dispatched: true as const });
}

function providerFor(slot: Phase698TransportReentryV2C2Slot) {
  return slot === 'qwen' ? ('qwen' as const) : ('deepseek' as const);
}

function successResult(
  slot: Phase698TransportReentryV2C2Slot,
  sequence: number,
): Phase698TransportReentryV2C2SlotResult {
  const usage =
    slot === 'qwen'
      ? { inputTokens: 32, outputTokens: 0, totalTokens: 32 }
      : { inputTokens: 48, outputTokens: 8, totalTokens: 56 };
  return PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_RESULT_SCHEMA.parse({
    slot,
    provider: providerFor(slot),
    sequence,
    disposition: 'completed',
    failureCode: null,
    runnerWire: { reservations: 1, dispatches: 1, harnessReturns: 1, verifiedResults: 1 },
    providerWire: { executions: 1, dispatches: 1, responses: 1, verifiedUsage: 1 },
    syntheticPortCalls: 1,
    providerCalls: 0,
    credentialReads: 0,
    usage,
    verifiedCostCny: null,
    durationMs: slot === 'final_response' ? 3 : 1,
    diagnostic: null,
    rawDataRetained: false,
  });
}

function failureResult(
  slot: Phase698TransportReentryV2C2Slot,
  sequence: number,
  code: Phase698TransportReentryV2C2FailureCode,
  _wire: ReturnType<typeof baseWire>,
  beforeResponse: boolean,
  syntheticCallObserved = true,
): Phase698TransportReentryV2C2SlotResult {
  const stage = beforeResponse ? 'dispatch' : code === 'usage' ? 'usage' : 'response';
  return PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_RESULT_SCHEMA.parse({
    slot,
    provider: providerFor(slot),
    sequence,
    disposition: 'executed_failure',
    failureCode: code,
    runnerWire: {
      reservations: 1,
      dispatches: 1,
      harnessReturns: beforeResponse ? 0 : 1,
      verifiedResults: 0,
    },
    providerWire: {
      executions: 1,
      dispatches: 1,
      responses: beforeResponse ? 0 : 1,
      verifiedUsage: 0,
    },
    syntheticPortCalls: syntheticCallObserved ? 1 : 0,
    providerCalls: 0,
    credentialReads: 0,
    usage: null,
    verifiedCostCny: null,
    durationMs: 1,
    diagnostic: {
      stage,
      reason: code,
      type: 'synthetic_fault',
      count: 1,
      rawDataRetained: false,
    },
    rawDataRetained: false,
  });
}

function suffixResult(
  slot: Phase698TransportReentryV2C2Slot,
  sequence: number,
  disposition: 'attempted_aborted' | 'not_started_quality_breaker' | 'not_started_external_abort',
  code: Phase698TransportReentryV2C2FailureCode,
): Phase698TransportReentryV2C2SlotResult {
  return PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_RESULT_SCHEMA.parse({
    slot,
    provider: providerFor(slot),
    sequence,
    disposition,
    failureCode: code,
    runnerWire: { reservations: 1, dispatches: 0, harnessReturns: 0, verifiedResults: 0 },
    providerWire: { executions: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
    syntheticPortCalls: 0,
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
  });
}

function buildReport(
  slots: readonly Phase698TransportReentryV2C2SlotResult[],
  syntheticPortCalls: number,
  breakerReason: Phase698TransportReentryV2C2FailureCode | 'none',
): Phase698TransportReentryV2C2Report {
  const completed = slots.filter((slot) => slot.disposition === 'completed').length;
  const passed = completed === 3 && breakerReason === 'none';
  return PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_REPORT_SCHEMA.parse({
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    authority: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_AUTHORITY,
    qualityAuthority: 'none',
    gate: passed
      ? PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE
      : PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_GATE_FAILED,
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
    syntheticPortCalls,
    providerCalls: 0,
    credentialReads: 0,
    formalEvidence: 0,
    verifiedUsageSlots: slots.filter((slot) => slot.providerWire.verifiedUsage === 1).length,
    verifiedCostCny: null,
    budgetCnyMax: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MAX_COST_CNY,
    breaker: {
      open: breakerReason !== 'none',
      reason: breakerReason,
      openedAtSequence:
        breakerReason === 'none'
          ? null
          : (slots.find((slot) => slot.failureCode === breakerReason)?.sequence ?? 0),
    },
    slotOrder: [...PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER],
    slots: [...slots],
    rawDataRetained: false,
  });
}

function reservationFromState(state: MutableState): Phase698TransportReentryV2C2Reservation {
  return Object.freeze({
    runId: state.runId,
    appendSlotDispatchStarted: (slot) =>
      enqueue(state, async () => {
        assertNextSlot(state, slot);
        if (state.slotEvents.has(slot)) throw new Error('C2_DUPLICATE_SLOT');
        await appendStateRecord(state, { event: 'slot_dispatch_started', slot });
        state.slotEvents.set(slot, new Set(['dispatch']));
      }),
    appendSlotResponseObserved: (slot) =>
      enqueue(state, async () => {
        assertSlotEvent(state, slot, 'dispatch');
        const events = state.slotEvents.get(slot)!;
        if (events.has('response')) throw new Error('C2_DUPLICATE_RESPONSE');
        await appendStateRecord(state, { event: 'slot_response_observed', slot });
        events.add('response');
      }),
    appendSlotUsageVerified: (slot) =>
      enqueue(state, async () => {
        assertSlotEvent(state, slot, 'response');
        const events = state.slotEvents.get(slot)!;
        if (events.has('usage')) throw new Error('C2_DUPLICATE_USAGE');
        await appendStateRecord(state, { event: 'slot_usage_verified', slot });
        events.add('usage');
      }),
    appendSlotTerminal: (result) =>
      enqueue(state, async () => {
        const parsed = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_RESULT_SCHEMA.parse(result);
        if (state.slots.has(parsed.slot)) throw new Error('C2_DUPLICATE_TERMINAL');
        if (parsed.sequence !== state.slots.size + 1) throw new Error('C2_SLOT_ORDER_INVALID');
        if (parsed.runnerWire.dispatches === 1) {
          const events = state.slotEvents.get(parsed.slot);
          if (!events?.has('dispatch')) throw new Error('C2_DISPATCH_PREFIX_MISSING');
          if (parsed.providerWire.responses === 1 && !events.has('response'))
            throw new Error('C2_RESPONSE_PREFIX_MISSING');
          if (parsed.providerWire.verifiedUsage === 1 && !events.has('usage'))
            throw new Error('C2_USAGE_PREFIX_MISSING');
        }
        await appendStateRecord(state, { event: 'slot_terminal', result: parsed });
        state.slots.set(parsed.slot, parsed);
      }),
    appendRunTerminal: (report) =>
      enqueue(state, async () => {
        const parsed = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_REPORT_SCHEMA.parse(report);
        if (
          state.report !== null ||
          state.records.some((record) => record.event === 'run_terminal')
        )
          throw new Error('C2_DUPLICATE_RUN_TERMINAL');
        if (state.slots.size !== 3) throw new Error('C2_INCOMPLETE_SLOTS');
        for (const slot of parsed.slots) {
          const stored = state.slots.get(slot.slot);
          if (
            !stored ||
            phase698TransportReentryV2C2Canonical(stored) !==
              phase698TransportReentryV2C2Canonical(slot)
          )
            throw new Error('C2_SLOT_REPORT_MISMATCH');
        }
        await ensureReportSnapshot(state, parsed);
        state.report = parsed;
        await appendStateRecord(state, {
          event: 'run_terminal',
          reportSha256: phase698TransportReentryV2C2Sha256(
            phase698TransportReentryV2C2Canonical(parsed),
          ),
          slotCount: 3,
        });
      }),
    publishArtifact: (report, options) =>
      enqueueResult(state, async () => publishStateArtifact(state, report, options)),
  });
}

function assertNextSlot(state: MutableState, slot: Phase698TransportReentryV2C2Slot) {
  const expected = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER[state.slots.size];
  if (expected !== slot) throw new Error('C2_SLOT_ORDER_INVALID');
}

function assertSlotEvent(
  state: MutableState,
  slot: Phase698TransportReentryV2C2Slot,
  required: string,
) {
  if (!state.slotEvents.get(slot)?.has(required)) throw new Error('C2_EVENT_PREFIX_INVALID');
  if (state.slots.has(slot)) throw new Error('C2_SLOT_ALREADY_TERMINAL');
}

async function appendStateRecord(
  state: MutableState,
  input:
    | { event: 'attempt_reserved'; markerSha256: string; createdAt: string }
    | { event: 'slot_dispatch_started'; slot: Phase698TransportReentryV2C2Slot }
    | { event: 'slot_response_observed'; slot: Phase698TransportReentryV2C2Slot }
    | { event: 'slot_usage_verified'; slot: Phase698TransportReentryV2C2Slot }
    | { event: 'slot_terminal'; result: Phase698TransportReentryV2C2SlotResult }
    | { event: 'run_terminal'; reportSha256: string; slotCount: 3 }
    | { event: 'recovery_claimed'; claimSha256: string }
    | { event: 'publication_started'; reportSha256: string }
    | { event: 'evidence_published'; evidenceSha256: string },
) {
  const record = nextRecord(state, input);
  await appendFile(state.journalPath, `${phase698TransportReentryV2C2Canonical(record)}\n`, {
    flag: 'a',
  });
  await syncFileAndDirectory(state.journalPath);
  state.records.push(record);
}

function nextRecord(
  state: MutableState,
  input: Parameters<typeof appendStateRecord>[1],
): Phase698TransportReentryV2C2JournalRecord {
  const unsigned = {
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    runId: state.runId,
    sequence: state.records.length,
    previousHash: state.records.at(-1)?.recordHash ?? null,
    ...input,
  };
  return PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_SCHEMA.parse({
    ...unsigned,
    recordHash: phase698TransportReentryV2C2Sha256(phase698TransportReentryV2C2Canonical(unsigned)),
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
  reportInput: Phase698TransportReentryV2C2Report,
  options: Readonly<{ publicationFault?: boolean; mode?: 'runtime' | 'recovery' }> = {},
) {
  if (options.publicationFault) throw new Error('C2_PUBLICATION_FAULT');
  if (state.records.some((record) => record.event === 'evidence_published'))
    throw new Error('C2_ALREADY_PUBLISHED');
  const report = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_REPORT_SCHEMA.parse(reportInput);
  if (
    !state.report ||
    phase698TransportReentryV2C2Canonical(state.report) !==
      phase698TransportReentryV2C2Canonical(report)
  )
    throw new Error('C2_REPORT_MISMATCH');
  const terminal = state.records.find((record) => record.event === 'run_terminal');
  if (!terminal) throw new Error('C2_TERMINAL_MISSING');
  const reportSha256 = phase698TransportReentryV2C2Sha256(
    phase698TransportReentryV2C2Canonical(report),
  );
  if (!state.records.some((record) => record.event === 'publication_started')) {
    await appendStateRecord(state, { event: 'publication_started', reportSha256 });
  }
  const publication = state.records.find((record) => record.event === 'publication_started');
  if (!publication || publication.reportSha256 !== reportSha256)
    throw new Error('C2_PUBLICATION_MISMATCH');
  const artifact = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_ARTIFACT_SCHEMA.parse({
    artifactVersion: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_ARTIFACT_VERSION,
    durabilityVersion: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_DURABILITY_VERSION,
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
  const artifactBytes = `${phase698TransportReentryV2C2Canonical(artifact)}\n`;
  const artifactRelative = phase698TransportReentryV2C2ArtifactRelativePath(state.runId);
  const artifactPath = resolveContained(state.root, artifactRelative);
  const tempPath = `${artifactPath}.tmp-${randomUUID()}`;
  await writeExclusive(tempPath, artifactBytes);
  await syncFileAndDirectory(tempPath);
  try {
    await link(tempPath, artifactPath);
    await syncDirectory(dirname(artifactPath));
  } finally {
    await unlink(tempPath).catch(() => undefined);
  }
  const evidenceSha256 = phase698TransportReentryV2C2Sha256(artifactBytes);
  await appendStateRecord(state, { event: 'evidence_published', evidenceSha256 });
  return Object.freeze({ evidenceSha256, relativePath: artifactRelative });
}

export async function validatePhase698TransportReentryV2C2Bundle(input: {
  root: string;
}): Promise<Phase698TransportReentryV2C2Validation> {
  try {
    const root = await requireSyntheticRoot(input.root);
    await assertSyntheticTmpDirectory(root);
    const markerPath = resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_RELATIVE);
    const markerBytes = await readRegular(markerPath);
    const marker = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${phase698TransportReentryV2C2Canonical(marker)}\n`)
      throw new Error('marker_canonical');
    const records = await readJournal(root, marker);
    const terminal = records.find((record) => record.event === 'run_terminal');
    const publication = records.find((record) => record.event === 'publication_started');
    const published = records.find((record) => record.event === 'evidence_published');
    if (!terminal || !publication || !published) throw new Error('terminal_missing');
    const reportPath = resolveContained(
      root,
      phase698TransportReentryV2C2ReportRelativePath(marker.runId),
    );
    const reportBytes = await readRegular(reportPath);
    const report = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_REPORT_SCHEMA.parse(JSON.parse(reportBytes));
    if (reportBytes !== `${phase698TransportReentryV2C2Canonical(report)}\n`)
      throw new Error('report_canonical');
    const reportSha = phase698TransportReentryV2C2Sha256(
      phase698TransportReentryV2C2Canonical(report),
    );
    const artifactPath = resolveContained(
      root,
      phase698TransportReentryV2C2ArtifactRelativePath(marker.runId),
    );
    const artifactBytes = await readRegular(artifactPath);
    const artifact = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_ARTIFACT_SCHEMA.parse(
      JSON.parse(artifactBytes),
    );
    if (artifactBytes !== `${phase698TransportReentryV2C2Canonical(artifact)}\n`)
      throw new Error('artifact_canonical');
    const terminalRecords = records.filter((record) => record.event === 'slot_terminal');
    if (terminalRecords.length !== 3) throw new Error('slot_count');
    const expected = new Map(
      report.slots.map((slot) => [slot.slot, phase698TransportReentryV2C2Canonical(slot)]),
    );
    for (const record of terminalRecords) {
      if (expected.get(record.result.slot) !== phase698TransportReentryV2C2Canonical(record.result))
        throw new Error('slot_mismatch');
    }
    if (
      terminal.reportSha256 !== reportSha ||
      publication.reportSha256 !== reportSha ||
      artifact.runId !== marker.runId ||
      artifact.markerSha256 !== phase698TransportReentryV2C2Sha256(markerBytes) ||
      artifact.reportLogicalSha256 !== reportSha ||
      artifact.durability.terminalSequence !== terminal.sequence ||
      artifact.durability.terminalRecordHash !== terminal.recordHash ||
      artifact.durability.journalRecordsBeforePublication !== publication.sequence ||
      published.evidenceSha256 !== phase698TransportReentryV2C2Sha256(artifactBytes) ||
      phase698TransportReentryV2C2Canonical(artifact.report) !==
        phase698TransportReentryV2C2Canonical(report) ||
      artifact.report.lineage !== PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE ||
      artifact.report.providerCalls !== 0 ||
      artifact.report.credentialReads !== 0 ||
      artifact.report.formalEvidence !== 0
    ) {
      throw new Error('artifact_mismatch');
    }
    const statInfo = await lstat(artifactPath);
    if (!statInfo.isFile()) throw new Error('artifact_not_regular');
    await ensureOnlyExpectedFiles(root, marker.runId);
    return Object.freeze({
      ok: true,
      runId: marker.runId,
      gate: report.gate,
      qualityAuthority: report.qualityAuthority,
      finalJournalEvent: 'evidence_published' as const,
      journalRecords: records.length,
      reportLogicalSha256: reportSha,
      physicalArtifactSha256: phase698TransportReentryV2C2Sha256(artifactBytes),
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      formalEvidence: 0 as const,
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
      providerCalls: 0 as const,
      credentialReads: 0 as const,
      formalEvidence: 0 as const,
    });
  }
}

export async function recoverPhase698TransportReentryV2C2InterruptedAttempt(input: {
  root: string;
  isProcessAlive: (processId: number) => boolean;
}): Promise<Phase698TransportReentryV2C2RecoveryResult> {
  let root: string;
  let marker: z.infer<typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA>;
  let markerBytes: string;
  try {
    root = await requireSyntheticRoot(input.root);
    await assertSyntheticTmpDirectory(root);
    markerBytes = await readRegular(
      resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_RELATIVE),
    );
    marker = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA.parse(JSON.parse(markerBytes));
    if (markerBytes !== `${phase698TransportReentryV2C2Canonical(marker)}\n`)
      throw new Error('marker_canonical');
  } catch {
    return { ok: false, code: 'marker_missing_or_invalid' };
  }
  if (input.isProcessAlive(marker.creatorPid)) return { ok: false, code: 'process_active' };
  try {
    const records = await readJournal(root, marker);
    if (records.some((record) => record.event === 'evidence_published'))
      return { ok: false, code: 'already_published' };
    const state = await stateFromReplay(root, marker, markerBytes, records);
    const artifactPath = resolveContained(
      root,
      phase698TransportReentryV2C2ArtifactRelativePath(marker.runId),
    );
    const artifactExists = await pathExists(artifactPath);
    if (artifactExists && !records.some((record) => record.event === 'publication_started'))
      return { ok: false, code: 'publication_invalid' };
    if (!records.some((record) => record.event === 'recovery_claimed')) {
      await appendStateRecord(state, {
        event: 'recovery_claimed',
        claimSha256: phase698TransportReentryV2C2Sha256(
          `${PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RECOVERY_CLAIM_VERSION}:${state.runId}`,
        ),
      });
      await writeRecoveryClaim(root, state.runId);
    }
    if (artifactExists) {
      const artifactBytes = await readRegular(artifactPath);
      if (!records.some((record) => record.event === 'publication_started'))
        return { ok: false, code: 'publication_invalid' };
      await appendStateRecord(state, {
        event: 'evidence_published',
        evidenceSha256: phase698TransportReentryV2C2Sha256(artifactBytes),
      });
      const validation = await validatePhase698TransportReentryV2C2Bundle({ root });
      if (!validation.ok || !validation.physicalArtifactSha256)
        return { ok: false, code: 'publication_invalid' };
      return {
        ok: true,
        runId: marker.runId,
        disposition: 'terminal_publication_recovered',
        artifactSha256: validation.physicalArtifactSha256,
      };
    }
    let report = state.report;
    const disposition: 'crash_only_sealed' | 'terminal_publication_recovered' = report
      ? 'terminal_publication_recovered'
      : 'crash_only_sealed';
    if (!report) {
      const recoveredSlots = await recoverSlotPrefix(state);
      while (recoveredSlots.length < 3) {
        const slot = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER[recoveredSlots.length];
        const result = suffixResult(
          slot,
          recoveredSlots.length + 1,
          'not_started_quality_breaker',
          'validation',
        );
        await appendStateRecord(state, { event: 'slot_terminal', result });
        state.slots.set(slot, result);
        recoveredSlots.push(result);
      }
      report = buildReport(
        recoveredSlots,
        recoveredSlots.reduce((sum, slot) => sum + slot.syntheticPortCalls, 0),
        'validation',
      );
      await ensureReportSnapshot(state, report);
      state.report = report;
      await appendStateRecord(state, {
        event: 'run_terminal',
        reportSha256: phase698TransportReentryV2C2Sha256(
          phase698TransportReentryV2C2Canonical(report),
        ),
        slotCount: 3,
      });
    }
    const published = await publishStateArtifact(state, report, { mode: 'recovery' });
    const validation = await validatePhase698TransportReentryV2C2Bundle({ root });
    if (!validation.ok) return { ok: false, code: 'publication_invalid' };
    return {
      ok: true,
      runId: marker.runId,
      disposition,
      artifactSha256: published.evidenceSha256,
    };
  } catch {
    return { ok: false, code: 'journal_invalid' };
  }
}

async function stateFromReplay(
  root: string,
  marker: z.infer<typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA>,
  markerBytes: string,
  records: Phase698TransportReentryV2C2JournalRecord[],
): Promise<MutableState> {
  const state: MutableState = {
    root,
    runId: marker.runId,
    marker,
    markerBytes,
    markerSha256: phase698TransportReentryV2C2Sha256(markerBytes),
    journalPath: resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_RELATIVE),
    records: [...records],
    slotEvents: new Map(),
    slots: new Map(),
    report: null,
    queue: Promise.resolve(),
  };
  for (const record of records) {
    if (record.event === 'slot_dispatch_started') addSlotEvent(state, record.slot, 'dispatch');
    if (record.event === 'slot_response_observed') addSlotEvent(state, record.slot, 'response');
    if (record.event === 'slot_usage_verified') addSlotEvent(state, record.slot, 'usage');
    if (record.event === 'slot_terminal') state.slots.set(record.result.slot, record.result);
  }
  const terminal = records.find((record) => record.event === 'run_terminal');
  if (terminal) {
    const reportPath = resolveContained(
      root,
      phase698TransportReentryV2C2ReportRelativePath(marker.runId),
    );
    const reportBytes = await readRegular(reportPath);
    const report = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_REPORT_SCHEMA.parse(JSON.parse(reportBytes));
    if (
      reportBytes !== `${phase698TransportReentryV2C2Canonical(report)}\n` ||
      terminal.reportSha256 !==
        phase698TransportReentryV2C2Sha256(phase698TransportReentryV2C2Canonical(report)) ||
      state.slots.size !== 3
    )
      throw new Error('C2_REPLAY_REPORT_INVALID');
    state.report = report;
  }
  return state;
}

async function recoverSlotPrefix(state: MutableState) {
  const results: Phase698TransportReentryV2C2SlotResult[] = [];
  for (let index = 0; index < 3; index += 1) {
    const slot = PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_SLOT_ORDER[index];
    const existing = state.slots.get(slot);
    if (existing) {
      results.push(existing);
      continue;
    }
    const events = state.slotEvents.get(slot);
    if (events?.has('dispatch')) {
      const failure = failureResult(
        slot,
        index + 1,
        events.has('response') ? 'validation' : 'transport',
        baseWire(),
        !events.has('response'),
        false,
      );
      state.slots.set(slot, failure);
      await appendStateRecord(state, { event: 'slot_terminal', result: failure });
      results.push(failure);
    }
    break;
  }
  return results;
}

function addSlotEvent(state: MutableState, slot: Phase698TransportReentryV2C2Slot, event: string) {
  const current = state.slotEvents.get(slot) ?? new Set<string>();
  current.add(event);
  state.slotEvents.set(slot, current);
}

async function readJournal(
  root: string,
  marker: z.infer<typeof PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_SCHEMA>,
) {
  const bytes = await readRegular(
    resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_RELATIVE),
  );
  const records = bytes
    .trimEnd()
    .split('\n')
    .filter(Boolean)
    .map((line) => PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_SCHEMA.parse(JSON.parse(line)));
  if (!records.length) throw new Error('C2_JOURNAL_EMPTY');
  let previousHash: string | null = null;
  let terminalSeen = false;
  let publicationSeen = false;
  let publicationStartedSeen = false;
  const slots: string[] = [];
  const eventsBySlot = new Map<Phase698TransportReentryV2C2Slot, Set<string>>();
  records.forEach((record, index) => {
    const { recordHash, ...unsigned } = record;
    if (
      record.sequence !== index ||
      record.previousHash !== previousHash ||
      record.runId !== marker.runId ||
      recordHash !==
        phase698TransportReentryV2C2Sha256(phase698TransportReentryV2C2Canonical(unsigned))
    )
      throw new Error('C2_JOURNAL_HASH_CHAIN');
    previousHash = record.recordHash;
    if (publicationSeen) throw new Error('C2_JOURNAL_AFTER_PUBLICATION');
    if (record.event === 'attempt_reserved') {
      if (
        index !== 0 ||
        record.markerSha256 !==
          phase698TransportReentryV2C2Sha256(`${phase698TransportReentryV2C2Canonical(marker)}\n`)
      )
        throw new Error('C2_JOURNAL_PREFIX');
    }
    if (record.event === 'slot_terminal') {
      if (record.result.sequence !== slots.length + 1 || slots.includes(record.result.slot))
        throw new Error('C2_JOURNAL_SLOT_ORDER');
      const slotEvents = eventsBySlot.get(record.result.slot) ?? new Set<string>();
      if (record.result.runnerWire.dispatches === 1 && !slotEvents.has('dispatch'))
        throw new Error('C2_JOURNAL_DISPATCH_PREFIX');
      if (record.result.providerWire.responses === 1 && !slotEvents.has('response'))
        throw new Error('C2_JOURNAL_RESPONSE_PREFIX');
      if (record.result.providerWire.verifiedUsage === 1 && !slotEvents.has('usage'))
        throw new Error('C2_JOURNAL_USAGE_PREFIX');
      slots.push(record.result.slot);
      eventsBySlot.set(record.result.slot, slotEvents);
    }
    if (record.event === 'slot_dispatch_started') {
      if (terminalSeen || eventsBySlot.has(record.slot))
        throw new Error('C2_JOURNAL_DISPATCH_ORDER');
      eventsBySlot.set(record.slot, new Set(['dispatch']));
    }
    if (record.event === 'slot_response_observed') {
      const slotEvents = eventsBySlot.get(record.slot);
      if (!slotEvents || slotEvents.has('response') || !slotEvents.has('dispatch'))
        throw new Error('C2_JOURNAL_RESPONSE_ORDER');
      slotEvents.add('response');
    }
    if (record.event === 'slot_usage_verified') {
      const slotEvents = eventsBySlot.get(record.slot);
      if (!slotEvents || slotEvents.has('usage') || !slotEvents.has('response'))
        throw new Error('C2_JOURNAL_USAGE_ORDER');
      slotEvents.add('usage');
    }
    if (record.event === 'run_terminal') {
      if (terminalSeen || slots.length !== 3) throw new Error('C2_JOURNAL_TERMINAL');
      terminalSeen = true;
    }
    if (record.event === 'publication_started') {
      if (!terminalSeen || publicationSeen || publicationStartedSeen)
        throw new Error('C2_JOURNAL_PUBLICATION');
      publicationStartedSeen = true;
    }
    if (record.event === 'evidence_published') {
      if (!terminalSeen || !publicationStartedSeen) throw new Error('C2_JOURNAL_PUBLISHED');
      publicationSeen = true;
    }
  });
  if (records[0]?.event !== 'attempt_reserved') throw new Error('C2_JOURNAL_PREFIX');
  return records;
}

async function ensureReportSnapshot(
  state: MutableState,
  report: Phase698TransportReentryV2C2Report,
) {
  const reportPath = resolveContained(
    state.root,
    phase698TransportReentryV2C2ReportRelativePath(state.runId),
  );
  const bytes = `${phase698TransportReentryV2C2Canonical(report)}\n`;
  if (await pathExists(reportPath)) {
    const existing = await readRegular(reportPath);
    if (existing !== bytes) throw new Error('C2_REPORT_SNAPSHOT_MISMATCH');
    return;
  }
  await writeExclusive(reportPath, bytes);
  await syncFileAndDirectory(reportPath);
}

async function writeRecoveryClaim(root: string, runId: string) {
  const path = resolveContained(root, PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RECOVERY_RELATIVE);
  const bytes = `${phase698TransportReentryV2C2Canonical({
    version: PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RECOVERY_CLAIM_VERSION,
    lineage: PHASE_6_9_8_TRANSPORT_REENTRY_V2_LINEAGE,
    runId,
    providerCalls: 0,
    credentialReads: 0,
    rawDataRetained: false,
  })}\n`;
  if (await pathExists(path)) {
    if ((await readRegular(path)) !== bytes) throw new Error('C2_RECOVERY_CLAIM_MISMATCH');
    return;
  }
  await writeExclusive(path, bytes);
  await syncFileAndDirectory(path);
}

async function ensureNoFormalFiles(root: string) {
  await assertSyntheticTmpDirectory(root);
  const tmp = await readdir(join(root, '.tmp'), { withFileTypes: true });
  const rootEntries = await readdir(root, { withFileTypes: true });
  const forbidden = tmp.length > 0 || rootEntries.some((entry) => entry.name !== '.tmp');
  if (forbidden) throw new Error('C2_FORMAL_FILES_ALREADY_EXIST');
}

async function ensureOnlyExpectedFiles(root: string, runId: string) {
  await assertSyntheticTmpDirectory(root);
  const tmp = await readdir(join(root, '.tmp'), { withFileTypes: true });
  const rootEntries = await readdir(root, { withFileTypes: true });
  const expectedTmp = new Set([
    basename(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_MARKER_RELATIVE),
    basename(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_JOURNAL_RELATIVE),
    basename(PHASE_6_9_8_TRANSPORT_REENTRY_V2_C2_RECOVERY_RELATIVE),
    basename(phase698TransportReentryV2C2ReportRelativePath(runId)),
  ]);
  const expectedRoot = new Set([basename(phase698TransportReentryV2C2ArtifactRelativePath(runId))]);
  if (tmp.some((entry) => !entry.isFile() || !expectedTmp.has(entry.name)))
    throw new Error('C2_UNEXPECTED_TMP_FILE');
  if (
    rootEntries.some((entry) =>
      entry.name === '.tmp'
        ? !entry.isDirectory() || entry.isSymbolicLink()
        : !entry.isFile() || entry.isSymbolicLink() || !expectedRoot.has(entry.name),
    )
  )
    throw new Error('C2_UNEXPECTED_ROOT_FILE');
}

async function requireSyntheticRoot(input: string) {
  const root = resolve(input);
  const [info, canonicalRoot] = await Promise.all([lstat(root), realpath(root)]);
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    canonicalRoot !== root ||
    !basename(root).startsWith(phase698TransportReentryV2C2SyntheticRootPrefix())
  )
    throw new Error('C2_SYNTHETIC_ROOT_INVALID');
  return root;
}

async function prepareSyntheticTmpDirectory(root: string) {
  const tmp = resolveContained(root, '.tmp');
  await mkdir(tmp, { recursive: true });
  await assertSyntheticTmpDirectory(root);
}

async function assertSyntheticTmpDirectory(root: string) {
  const tmp = resolveContained(root, '.tmp');
  const [info, canonicalTmp] = await Promise.all([lstat(tmp), realpath(tmp)]);
  if (!info.isDirectory() || info.isSymbolicLink() || canonicalTmp !== tmp)
    throw new Error('C2_SYNTHETIC_TMP_INVALID');
}

function resolveContained(root: string, relativePath: string) {
  if (
    !relativePath ||
    relativePath.includes('\\') ||
    relativePath.includes('..') ||
    relativePath.startsWith('/')
  )
    throw new Error('C2_PATH_INVALID');
  const candidate = resolve(root, relativePath);
  const normalizedRoot = resolve(root);
  if (candidate !== normalizedRoot && !candidate.startsWith(`${normalizedRoot}${sep}`))
    throw new Error('C2_PATH_ESCAPE');
  return candidate;
}

async function writeExclusive(path: string, bytes: string) {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, 'wx');
  try {
    await handle.writeFile(bytes, 'utf8');
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
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch {
    // Windows may reject fsync on a directory; the file fsync remains mandatory.
  }
}

async function readRegular(path: string) {
  const info = await lstat(path);
  if (!info.isFile()) throw new Error('C2_NOT_REGULAR');
  return readFile(path, 'utf8');
}

async function pathExists(path: string) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
