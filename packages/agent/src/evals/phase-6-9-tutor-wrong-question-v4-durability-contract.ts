import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
} from './phase-6-9-tutor-wrong-question-cases.ts';
import {
  PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
  type Phase697V3CaseEntry,
} from './phase-6-9-tutor-wrong-question-v3-contract.ts';
import {
  PHASE_6_9_7_V3_TERMINAL_PROJECTION_SCHEMA,
  buildPhase697V3Marker,
  buildPhase697V3SealedReport,
  projectPhase697V3TerminalEntry,
  restorePhase697V3TerminalEntry,
  type Phase697V3ValidatedJournal,
} from './phase-6-9-tutor-wrong-question-v3-durability-contract.ts';
import {
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4,
  PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V4_EVIDENCE_PREFIX,
  PHASE_6_9_7_V4_JOURNAL_VERSION,
  PHASE_6_9_7_V4_MARKER_PATH,
  PHASE_6_9_7_V4_MARKER_SCHEMA,
  PHASE_6_9_7_V4_MARKER_VERSION,
  PHASE_6_9_7_V4_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_V4_RECOVERY_CLAIM_VERSION,
  PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION,
  buildPhase697TutorOrganizerV4Report,
  buildPhase697V4CaseEntry,
  phase697V4EvidencePath as phase697V4EvidencePathNullable,
  phase697V4JournalPath as phase697V4JournalPathNullable,
  phase697V4RecoveryClaimPath as phase697V4RecoveryClaimPathNullable,
  runtimeContractSuccessV4,
  sha256Phase697V4Stable,
  toPhase697V3CaseEntry,
  type Phase697TutorOrganizerV4Report,
  type Phase697V4CaseEntry,
  type Phase697V4EvidenceEnvelope,
  type Phase697V4Marker,
  type Phase697V4RecoveryClaimRecord,
} from './phase-6-9-tutor-wrong-question-v4-contract.ts';

export {
  PHASE_6_9_7_V4_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V4_MARKER_PATH,
  PHASE_6_9_7_V4_MARKER_SCHEMA,
  PHASE_6_9_7_V4_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_V4_RECOVERY_CLAIM_VERSION,
};
export type { Phase697V4EvidenceEnvelope, Phase697V4Marker, Phase697V4RecoveryClaimRecord };

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const runIdSchema = z.string().uuid();
const caseIdSchema = z.string().regex(/^(tutor|organizer)-[a-z0-9-]+$/);
const agentSchema = z.enum(['tutor', 'wrong_question_organizer']);
const pairedRunIndexSchema = z.number().int().min(0).max(23);
const finiteNonNegative = z.number().finite().nonnegative();

export const PHASE_6_9_7_V4_TERMINAL_PROJECTION_SCHEMA =
  PHASE_6_9_7_V3_TERMINAL_PROJECTION_SCHEMA.omit({
    runtimeEvidenceVersion: true,
    terminalEntrySha256: true,
  })
    .extend({
      runtimeEvidenceVersion: z.literal(PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION),
      sourceV3TerminalEntrySha256: sha256Schema,
      terminalEntrySha256: sha256Schema,
    })
    .strict();

export type Phase697V4TerminalProjection = z.infer<
  typeof PHASE_6_9_7_V4_TERMINAL_PROJECTION_SCHEMA
>;

export const PHASE_6_9_7_V4_JOURNAL_PAYLOAD_SCHEMA = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('journal_initialized'),
      markerSha256: sha256Schema,
      runScope: z.enum(['branch', 'main']),
      mode: z.literal('live'),
      datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256),
    })
    .strict(),
  z
    .object({
      kind: z.literal('guard_terminal'),
      terminal: PHASE_6_9_7_V4_TERMINAL_PROJECTION_SCHEMA,
    })
    .strict(),
  z
    .object({
      kind: z.literal('dispatch_started'),
      caseId: caseIdSchema,
      agent: agentSchema,
      pairedRunIndex: pairedRunIndexSchema,
      dispatchKeySha256: sha256Schema,
    })
    .strict(),
  z
    .object({
      kind: z.literal('runtime_terminal'),
      dispatchKeySha256: sha256Schema,
      terminal: PHASE_6_9_7_V4_TERMINAL_PROJECTION_SCHEMA,
    })
    .strict(),
  z
    .object({
      kind: z.literal('pair_terminal'),
      pairedRunIndex: pairedRunIndexSchema,
      pairedLatencyMs: finiteNonNegative.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('breaker_opened'),
      breakerState: z.enum(['guard_failed', 'quality_gate_impossible']),
      triggerCaseId: caseIdSchema,
      triggerAgent: agentSchema,
      triggerPairedRunIndex: pairedRunIndexSchema.nullable(),
    })
    .strict(),
  z
    .object({
      kind: z.literal('run_completed'),
      reportSha256: sha256Schema,
      gate: z.enum(['quality_gate_passed', 'quality_gate_failed']),
    })
    .strict(),
  z
    .object({
      kind: z.literal('evidence_sealed'),
      disposition: z.enum(['completed_run', 'orphan_sealed', 'journal_missing_sealed']),
      sealedFromJournalSha256: sha256Schema.nullable(),
      evidenceSha256: sha256Schema,
    })
    .strict(),
]);

export type Phase697V4JournalPayload = z.infer<typeof PHASE_6_9_7_V4_JOURNAL_PAYLOAD_SCHEMA>;

export const PHASE_6_9_7_V4_JOURNAL_RECORD_SCHEMA = z
  .object({
    journalVersion: z.literal(PHASE_6_9_7_V4_JOURNAL_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4),
    runId: runIdSchema,
    sequence: z.number().int().safe().nonnegative(),
    previousRecordSha256: sha256Schema.nullable(),
    payload: PHASE_6_9_7_V4_JOURNAL_PAYLOAD_SCHEMA,
    recordSha256: sha256Schema,
  })
  .strict();

export type Phase697V4JournalRecord = z.infer<typeof PHASE_6_9_7_V4_JOURNAL_RECORD_SCHEMA>;

export type Phase697V4ValidatedJournal = Readonly<{
  records: readonly Phase697V4JournalRecord[];
  runId: string;
  runScope: 'branch' | 'main';
  markerSha256: string;
  tailSha256: string;
  lastSequence: number;
  guardTerminals: ReadonlyMap<string, Phase697V4CaseEntry>;
  dispatches: ReadonlyMap<
    string,
    Readonly<{
      caseId: string;
      agent: 'tutor' | 'wrong_question_organizer';
      pairedRunIndex: number;
    }>
  >;
  runtimeTerminals: ReadonlyMap<string, Phase697V4CaseEntry>;
  pairedLatencies: ReadonlyMap<number, number | null>;
  runCompleted: Readonly<{
    reportSha256: string;
    gate: 'quality_gate_passed' | 'quality_gate_failed';
  }> | null;
  sealed: Extract<Phase697V4JournalPayload, { kind: 'evidence_sealed' }> | null;
}>;

export function stablePhase697V4JsonStringify(value: unknown): string {
  return JSON.stringify(sortStableValue(value));
}

export const stableJsonStringify = stablePhase697V4JsonStringify;

export function sha256Phase697V4Bytes(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export const sha256Bytes = sha256Phase697V4Bytes;

export function buildPhase697V4Marker(input: {
  runId: string;
  runScope: 'branch' | 'main';
  executorProvenance?: 'deepseek_network' | 'synthetic_test';
  ownerProcessId?: number;
}): Phase697V4Marker {
  return PHASE_6_9_7_V4_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_7_V4_MARKER_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_DATASET_SHA256,
    runId: input.runId,
    runScope: input.runScope,
    mode: 'live',
    executorProvenance: input.executorProvenance ?? 'deepseek_network',
    ownerProcessId: input.ownerProcessId ?? process.pid,
    state: 'attempt_reserved',
  });
}

export function phase697V4JournalPath(runId: string): string {
  const path = phase697V4JournalPathNullable(runId);
  if (path === null) throw new Error('PHASE_6_9_7_V4_RUN_ID_INVALID');
  return path;
}

export function phase697V4RecoveryClaimPath(runId: string): string {
  const path = phase697V4RecoveryClaimPathNullable(runId);
  if (path === null) throw new Error('PHASE_6_9_7_V4_RUN_ID_INVALID');
  return path;
}

export function phase697V4EvidencePath(input: {
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  runId: string;
}): string {
  const path = phase697V4EvidencePathNullable(input);
  if (path === null) throw new Error('PHASE_6_9_7_V4_RUN_ID_INVALID');
  return path;
}

export function phase697V4DispatchKeySha256(input: {
  runId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  pairedRunIndex: number;
}): `sha256:${string}` {
  return sha256Phase697V4Stable(input);
}

export function projectPhase697V4TerminalEntry(
  entry: Readonly<Phase697V4CaseEntry>,
): Readonly<Phase697V4TerminalProjection> | null {
  const v3Entry = toPhase697V3CaseEntry(entry);
  if (v3Entry === null) return null;
  const v3Projection = projectPhase697V3TerminalEntry(v3Entry);
  if (v3Projection === null) return null;
  const {
    runtimeEvidenceVersion: _runtimeEvidenceVersion,
    terminalEntrySha256: sourceV3TerminalEntrySha256,
    ...bounded
  } = v3Projection;
  void _runtimeEvidenceVersion;
  const parsed = PHASE_6_9_7_V4_TERMINAL_PROJECTION_SCHEMA.safeParse({
    ...bounded,
    runtimeEvidenceVersion: PHASE_6_9_7_V4_RUNTIME_EVIDENCE_VERSION,
    sourceV3TerminalEntrySha256,
    terminalEntrySha256: sha256Phase697V4Stable(entry),
  });
  return parsed.success ? Object.freeze(parsed.data) : null;
}

export function restorePhase697V4TerminalEntry(
  projection: unknown,
): Readonly<Phase697V4CaseEntry> | null {
  const parsed = PHASE_6_9_7_V4_TERMINAL_PROJECTION_SCHEMA.safeParse(projection);
  if (!parsed.success) return null;
  const {
    runtimeEvidenceVersion: _runtimeEvidenceVersion,
    sourceV3TerminalEntrySha256,
    terminalEntrySha256,
    ...bounded
  } = parsed.data;
  void _runtimeEvidenceVersion;
  const v3Entry = restorePhase697V3TerminalEntry({
    ...bounded,
    runtimeEvidenceVersion: PHASE_6_9_7_V3_RUNTIME_EVIDENCE_VERSION,
    terminalEntrySha256: sourceV3TerminalEntrySha256,
  });
  if (v3Entry === null) return null;
  const v4Entry = buildPhase697V4CaseEntry(v3Entry);
  return v4Entry !== null && sha256Phase697V4Stable(v4Entry) === terminalEntrySha256
    ? v4Entry
    : null;
}

export function buildPhase697V4JournalRecord(input: {
  runId: string;
  sequence: number;
  previousRecordSha256: string | null;
  payload: Phase697V4JournalPayload;
}): Phase697V4JournalRecord {
  const withoutHash = {
    journalVersion: PHASE_6_9_7_V4_JOURNAL_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4,
    runId: input.runId,
    sequence: input.sequence,
    previousRecordSha256: input.previousRecordSha256,
    payload: input.payload,
  };
  return PHASE_6_9_7_V4_JOURNAL_RECORD_SCHEMA.parse({
    ...withoutHash,
    recordSha256: sha256Phase697V4Stable(withoutHash),
  });
}

export function parseAndValidatePhase697V4Journal(text: string): Phase697V4ValidatedJournal | null {
  if (typeof text !== 'string' || text.length === 0 || !text.endsWith('\n')) return null;
  const lines = text.slice(0, -1).split('\n');
  if (lines.length === 0 || lines.some((line) => line.length === 0 || line.length > 65_536)) {
    return null;
  }
  const records: Phase697V4JournalRecord[] = [];
  try {
    for (const line of lines) {
      const parsed = PHASE_6_9_7_V4_JOURNAL_RECORD_SCHEMA.parse(JSON.parse(line) as unknown);
      const { recordSha256, ...withoutHash } = parsed;
      if (sha256Phase697V4Stable(withoutHash) !== recordSha256) return null;
      records.push(parsed);
    }
  } catch {
    return null;
  }
  const first = records[0];
  if (!first || first.payload.kind !== 'journal_initialized' || first.sequence !== 0) return null;
  const runId = first.runId;
  const guards = new Map<string, Phase697V4CaseEntry>();
  const dispatches = new Map<
    string,
    Readonly<{
      caseId: string;
      agent: 'tutor' | 'wrong_question_organizer';
      pairedRunIndex: number;
    }>
  >();
  const terminals = new Map<string, Phase697V4CaseEntry>();
  const pairLatencies = new Map<number, number | null>();
  let breaker: Extract<Phase697V4JournalPayload, { kind: 'breaker_opened' }> | null = null;
  let runCompleted: Phase697V4ValidatedJournal['runCompleted'] = null;
  let sealed: Phase697V4ValidatedJournal['sealed'] = null;
  let previous: string | null = null;
  for (const [index, record] of records.entries()) {
    if (
      record.runId !== runId ||
      record.sequence !== index ||
      record.previousRecordSha256 !== previous ||
      (index > 0 && record.payload.kind === 'journal_initialized') ||
      sealed !== null
    ) {
      return null;
    }
    previous = record.recordSha256;
    const payload = record.payload;
    if (payload.kind === 'guard_terminal') {
      const terminal = restorePhase697V4TerminalEntry(payload.terminal);
      if (
        dispatches.size > 0 ||
        breaker !== null ||
        runCompleted !== null ||
        !terminal ||
        terminal.executionKind !== 'zero_call' ||
        terminal.dispatchRecorded ||
        terminal.runtimeTerminalRecorded ||
        guards.has(terminal.caseId)
      ) {
        return null;
      }
      guards.set(terminal.caseId, terminal);
    } else if (payload.kind === 'dispatch_started') {
      const expectedKey = phase697V4DispatchKeySha256({
        runId,
        agent: payload.agent,
        pairedRunIndex: payload.pairedRunIndex,
      });
      const expectedPairIndex = pairLatencies.size;
      const expectedCase = PHASE_6_9_TUTOR_WRONG_QUESTION_CASES.find(
        (entry) =>
          entry.expectedRuntimeInvocations === 1 &&
          entry.agent === payload.agent &&
          entry.pairedRunIndex === payload.pairedRunIndex,
      );
      if (
        breaker !== null ||
        runCompleted !== null ||
        guards.size !== 24 ||
        [...guards.values()].some((entry) => !entry.zeroCallVerified) ||
        payload.pairedRunIndex !== expectedPairIndex ||
        payload.dispatchKeySha256 !== expectedKey ||
        payload.caseId !== expectedCase?.id ||
        dispatches.has(expectedKey) ||
        [...dispatches.values()].some(
          (entry) =>
            entry.agent === payload.agent && entry.pairedRunIndex === payload.pairedRunIndex,
        )
      ) {
        return null;
      }
      dispatches.set(expectedKey, {
        caseId: payload.caseId,
        agent: payload.agent,
        pairedRunIndex: payload.pairedRunIndex,
      });
    } else if (payload.kind === 'runtime_terminal') {
      const dispatch = dispatches.get(payload.dispatchKeySha256);
      const terminal = restorePhase697V4TerminalEntry(payload.terminal);
      if (
        breaker !== null ||
        runCompleted !== null ||
        !dispatch ||
        !terminal ||
        terminal.caseId !== dispatch.caseId ||
        terminal.agent !== dispatch.agent ||
        terminal.pairedRunIndex !== dispatch.pairedRunIndex ||
        !terminal.dispatchRecorded ||
        !terminal.runtimeTerminalRecorded ||
        terminals.has(payload.dispatchKeySha256)
      ) {
        return null;
      }
      terminals.set(payload.dispatchKeySha256, terminal);
    } else if (payload.kind === 'pair_terminal') {
      const pairDispatches = [...dispatches.entries()].filter(
        ([, dispatch]) => dispatch.pairedRunIndex === payload.pairedRunIndex,
      );
      const pairTerminals = pairDispatches.flatMap(([key]) => {
        const terminal = terminals.get(key);
        return terminal ? [terminal] : [];
      });
      const terminalLatencies = pairTerminals.map((entry) => entry.latencyMs);
      const expectedLatencyPresent = terminalLatencies.every((entry) => entry !== null);
      if (
        breaker !== null ||
        runCompleted !== null ||
        payload.pairedRunIndex !== pairLatencies.size ||
        pairLatencies.has(payload.pairedRunIndex) ||
        pairDispatches.length !== 2 ||
        pairTerminals.length !== 2 ||
        (expectedLatencyPresent
          ? payload.pairedLatencyMs === null ||
            payload.pairedLatencyMs < Math.max(...terminalLatencies)
          : payload.pairedLatencyMs !== null)
      ) {
        return null;
      }
      pairLatencies.set(payload.pairedRunIndex, payload.pairedLatencyMs);
    } else if (payload.kind === 'breaker_opened') {
      if (breaker !== null || runCompleted !== null || guards.size !== 24) return null;
      if (payload.breakerState === 'guard_failed') {
        const trigger = guards.get(payload.triggerCaseId);
        if (
          dispatches.size !== 0 ||
          !trigger ||
          trigger.zeroCallVerified ||
          trigger.agent !== payload.triggerAgent ||
          payload.triggerPairedRunIndex !== null
        ) {
          return null;
        }
      } else {
        const trigger = [...terminals.values()].find(
          (entry) => entry.caseId === payload.triggerCaseId,
        );
        if (
          [...guards.values()].some((entry) => !entry.zeroCallVerified) ||
          !trigger ||
          runtimeContractSuccessV4(trigger) ||
          trigger.agent !== payload.triggerAgent ||
          trigger.pairedRunIndex !== payload.triggerPairedRunIndex ||
          payload.triggerPairedRunIndex === null ||
          !pairLatencies.has(payload.triggerPairedRunIndex)
        ) {
          return null;
        }
      }
      breaker = payload;
    } else if (payload.kind === 'run_completed') {
      const guardFailure = [...guards.values()].some((entry) => !entry.zeroCallVerified);
      const runtimeFailure = [...terminals.values()].some(
        (entry) => !runtimeContractSuccessV4(entry),
      );
      if (
        runCompleted ||
        guards.size !== 24 ||
        (guardFailure && breaker?.breakerState !== 'guard_failed') ||
        (!guardFailure && runtimeFailure && breaker?.breakerState !== 'quality_gate_impossible') ||
        (!guardFailure &&
          !runtimeFailure &&
          (breaker !== null ||
            dispatches.size !== 48 ||
            terminals.size !== 48 ||
            pairLatencies.size !== 24)) ||
        (!guardFailure && breaker?.breakerState === 'guard_failed')
      ) {
        return null;
      }
      runCompleted = { reportSha256: payload.reportSha256, gate: payload.gate };
    } else if (payload.kind === 'evidence_sealed') {
      if (payload.sealedFromJournalSha256 !== record.previousRecordSha256) return null;
      sealed = payload;
    }
  }
  return Object.freeze({
    records: Object.freeze(records),
    runId,
    runScope: first.payload.runScope,
    markerSha256: first.payload.markerSha256,
    tailSha256: records.at(-1)!.recordSha256,
    lastSequence: records.length - 1,
    guardTerminals: guards,
    dispatches,
    runtimeTerminals: terminals,
    pairedLatencies: pairLatencies,
    runCompleted,
    sealed,
  });
}

export function buildPhase697V4SealedReport(input: {
  marker: Readonly<Phase697V4Marker>;
  markerSha256: string;
  journal: Readonly<Phase697V4ValidatedJournal> | null;
}): Readonly<Phase697TutorOrganizerV4Report> | null {
  if (
    !sha256Schema.safeParse(input.markerSha256).success ||
    (input.journal !== null &&
      (input.journal.runId !== input.marker.runId ||
        input.journal.runScope !== input.marker.runScope ||
        input.journal.markerSha256 !== input.markerSha256))
  ) {
    return null;
  }
  const v3Marker = buildPhase697V3Marker({
    runId: input.marker.runId,
    runScope: input.marker.runScope,
    executorProvenance: input.marker.executorProvenance,
    ownerProcessId: input.marker.ownerProcessId,
  });
  const v3Journal = input.journal ? toV3ValidatedJournal(input.journal) : null;
  if (input.journal && v3Journal === null) return null;
  const v3Report = buildPhase697V3SealedReport({
    marker: v3Marker,
    markerSha256: input.markerSha256,
    journal: v3Journal,
  });
  if (v3Report === null) return null;
  const v4Report = buildPhase697TutorOrganizerV4Report(v3Report);
  const completed = input.journal?.runCompleted ?? null;
  if (
    v4Report === null ||
    (completed !== null &&
      (completed.reportSha256 !== sha256Phase697V4Stable(v4Report) ||
        completed.gate !== v4Report.gate))
  ) {
    return null;
  }
  return v4Report;
}

function toV3ValidatedJournal(
  journal: Readonly<Phase697V4ValidatedJournal>,
): Readonly<Phase697V3ValidatedJournal> | null {
  const guards = toV3EntryMap(journal.guardTerminals);
  const terminals = toV3EntryMap(journal.runtimeTerminals);
  if (guards === null || terminals === null) return null;
  return Object.freeze({
    records: Object.freeze([]),
    runId: journal.runId,
    runScope: journal.runScope,
    markerSha256: journal.markerSha256,
    tailSha256: journal.tailSha256,
    lastSequence: journal.lastSequence,
    guardTerminals: guards,
    dispatches: journal.dispatches,
    runtimeTerminals: terminals,
    pairedLatencies: journal.pairedLatencies,
    runCompleted: null,
    sealed: null,
  });
}

function toV3EntryMap(
  entries: ReadonlyMap<string, Phase697V4CaseEntry>,
): ReadonlyMap<string, Phase697V3CaseEntry> | null {
  const converted = new Map<string, Phase697V3CaseEntry>();
  for (const [key, entry] of entries) {
    const v3Entry = toPhase697V3CaseEntry(entry);
    if (v3Entry === null) return null;
    converted.set(key, v3Entry);
  }
  return converted;
}

export function assertPhase697V4PathIdentity(): void {
  if (
    !PHASE_6_9_7_V4_MARKER_PATH.includes('-v4-') ||
    !PHASE_6_9_7_V4_EVIDENCE_PREFIX.endsWith('-v4') ||
    PHASE_6_9_7_V4_RECOVERY_CLAIM_VERSION.includes('-v3-') ||
    !PHASE_6_9_7_V4_RECOVERY_CLAIM_SCHEMA.safeParse({
      claimVersion: PHASE_6_9_7_V4_RECOVERY_CLAIM_VERSION,
      runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V4,
      runId: '00000000-0000-4000-8000-000000000000',
      ownerProcessId: 1,
      ownerToken: '00000000-0000-4000-8000-000000000001',
      state: 'orphan_seal_claimed',
    }).success
  ) {
    throw new Error('PHASE_6_9_7_V4_DURABILITY_IDENTITY_INVALID');
  }
}

function sortStableValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PHASE_6_9_7_V4_NON_FINITE_VALUE');
    return value;
  }
  if (Array.isArray(value)) return value.map(sortStableValue);
  if (typeof value !== 'object') throw new Error('PHASE_6_9_7_V4_UNSUPPORTED_VALUE');
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('PHASE_6_9_7_V4_NON_PLAIN_VALUE');
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortStableValue(child)]),
  );
}
