import { createHash } from 'node:crypto';

import {
  PHASE_6_9_7_V7_WIRE_CAPABILITY_VERSION as PHASE_6_9_7_V9_WIRE_CAPABILITY_VERSION,
  PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION as PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION,
  PHASE_6_9_7_V7_WIRE_STAGES as PHASE_6_9_7_V9_WIRE_STAGES,
  type Phase697V7WireSnapshot as Phase697V9WireSnapshot,
  type Phase697V7WireStage as Phase697V9WireStage,
} from '@repo/ai';
import { z } from 'zod';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  type Phase697V2Case,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_V6_DURATION_EVIDENCE_SCHEMA,
  PHASE_6_9_7_V6_RUNTIME_EVIDENCE_VERSION,
  type Phase697V6CaseEntry,
} from './phase-6-9-tutor-wrong-question-v6-contract.ts';
import {
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9,
  PHASE_6_9_7_V9_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_V9_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V9_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V9_EVIDENCE_PREFIX,
  PHASE_6_9_7_V9_JOURNAL_VERSION,
  PHASE_6_9_7_V9_MARKER_PATH,
  PHASE_6_9_7_V9_MARKER_SCHEMA,
  PHASE_6_9_7_V9_MARKER_VERSION,
  PHASE_6_9_7_V9_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_V9_RECOVERY_CLAIM_VERSION,
  PHASE_6_9_7_V9_RUNTIME_EVIDENCE_VERSION,
  PHASE_6_9_7_V9_SOURCE_MANIFEST_SHA256,
  buildPhase697TutorOrganizerV9Report,
  buildPhase697V9CaseEntry,
  phase697V9DispatchKeySha256,
  phase697V9EvidencePath as phase697V9EvidencePathNullable,
  phase697V9JournalPath as phase697V9JournalPathNullable,
  phase697V9RecoveryClaimPath as phase697V9RecoveryClaimPathNullable,
  projectPhase697V9EntryToV6,
  sha256Phase697V9Stable,
  type Phase697TutorOrganizerV9Report,
  type Phase697V9CaseEntry,
  type Phase697V9EvidenceEnvelope,
  type Phase697V9Marker,
  type Phase697V9RecoveryClaimRecord,
} from './phase-6-9-tutor-wrong-question-v9-contract.ts';
import {
  buildPhase697TutorOrganizerV6Report,
  buildPhase697V6NotStartedEntry,
  buildPhase697V6OrphanedEntry,
} from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';

export {
  PHASE_6_9_7_V9_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V9_MARKER_PATH,
  PHASE_6_9_7_V9_MARKER_SCHEMA,
  PHASE_6_9_7_V9_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_V9_RECOVERY_CLAIM_VERSION,
};
export type { Phase697V9EvidenceEnvelope, Phase697V9Marker, Phase697V9RecoveryClaimRecord };

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const runIdSchema = z.string().uuid();
const caseIdSchema = z.string().regex(/^(tutor|organizer)-v2-(zero|runtime)-[a-z0-9-]+$/);
const agentSchema = z.enum(['tutor', 'wrong_question_organizer']);
const pairedRunIndexSchema = z.number().int().min(0).max(23);

export const PHASE_6_9_7_V9_TERMINAL_PROJECTION_SCHEMA = z
  .object({
    runtimeEvidenceVersion: z.literal(PHASE_6_9_7_V9_RUNTIME_EVIDENCE_VERSION),
    entry: PHASE_6_9_7_V9_CASE_ENTRY_SCHEMA,
    terminalEntrySha256: sha256Schema,
  })
  .strict();

export type Phase697V9TerminalProjection = z.infer<
  typeof PHASE_6_9_7_V9_TERMINAL_PROJECTION_SCHEMA
>;

export const PHASE_6_9_7_V9_JOURNAL_PAYLOAD_SCHEMA = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('journal_initialized'),
      markerSha256: sha256Schema,
      runScope: z.enum(['branch', 'main']),
      mode: z.literal('live'),
      sourceManifestSha256: z.literal(PHASE_6_9_7_V9_SOURCE_MANIFEST_SHA256),
      evalPolicySha256: z.literal(PHASE_6_9_7_V9_EVAL_POLICY_SHA256),
      wireDiagnosticsVersion: z.literal(PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION),
    })
    .strict(),
  z
    .object({
      kind: z.literal('guard_terminal'),
      terminal: PHASE_6_9_7_V9_TERMINAL_PROJECTION_SCHEMA,
    })
    .strict(),
  z
    .object({
      kind: z.literal('lane_reserved'),
      caseId: caseIdSchema,
      agent: agentSchema,
      pairedRunIndex: pairedRunIndexSchema,
      dispatchKeySha256: sha256Schema,
      wireCapabilityVersion: z.literal(PHASE_6_9_7_V9_WIRE_CAPABILITY_VERSION),
    })
    .strict(),
  z
    .object({
      kind: z.literal('wire_stage'),
      dispatchKeySha256: sha256Schema,
      stage: z.enum(PHASE_6_9_7_V9_WIRE_STAGES),
    })
    .strict(),
  z
    .object({
      kind: z.literal('runtime_terminal'),
      dispatchKeySha256: sha256Schema,
      terminal: PHASE_6_9_7_V9_TERMINAL_PROJECTION_SCHEMA,
    })
    .strict(),
  z
    .object({
      kind: z.literal('pair_terminal'),
      pairedRunIndex: pairedRunIndexSchema,
      pairedDurationEvidence: PHASE_6_9_7_V6_DURATION_EVIDENCE_SCHEMA.nullable(),
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
      disposition: z.enum(['completed_run', 'orphan_sealed']),
      sealedFromJournalSha256: sha256Schema,
      evidenceSha256: sha256Schema,
    })
    .strict(),
]);

export type Phase697V9JournalPayload = z.infer<typeof PHASE_6_9_7_V9_JOURNAL_PAYLOAD_SCHEMA>;

export const PHASE_6_9_7_V9_JOURNAL_RECORD_SCHEMA = z
  .object({
    journalVersion: z.literal(PHASE_6_9_7_V9_JOURNAL_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9),
    runId: runIdSchema,
    sequence: z.number().int().safe().nonnegative(),
    previousRecordSha256: sha256Schema.nullable(),
    payload: PHASE_6_9_7_V9_JOURNAL_PAYLOAD_SCHEMA,
    recordSha256: sha256Schema,
  })
  .strict();

export type Phase697V9JournalRecord = z.infer<typeof PHASE_6_9_7_V9_JOURNAL_RECORD_SCHEMA>;

type ValidatedLane = Readonly<{
  caseId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  pairedRunIndex: number;
  stages: readonly Phase697V9WireStage[];
}>;

export type Phase697V9ValidatedJournal = Readonly<{
  records: readonly Phase697V9JournalRecord[];
  runId: string;
  runScope: 'branch' | 'main';
  markerSha256: string;
  tailSha256: string;
  lastSequence: number;
  guardTerminals: ReadonlyMap<string, Phase697V9CaseEntry>;
  lanes: ReadonlyMap<string, ValidatedLane>;
  runtimeTerminals: ReadonlyMap<string, Phase697V9CaseEntry>;
  pairedDurations: ReadonlyMap<
    number,
    Extract<Phase697V9JournalPayload, { kind: 'pair_terminal' }>['pairedDurationEvidence']
  >;
  breaker: Extract<Phase697V9JournalPayload, { kind: 'breaker_opened' }> | null;
  runCompleted: Readonly<{
    reportSha256: string;
    gate: 'quality_gate_passed' | 'quality_gate_failed';
  }> | null;
  sealed: Extract<Phase697V9JournalPayload, { kind: 'evidence_sealed' }> | null;
}>;

export function stablePhase697V9JsonStringify(value: unknown): string {
  return JSON.stringify(sortStableValue(value));
}

export function sha256Phase697V9Bytes(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export function phase697V9JournalPath(runId: string): string {
  const path = phase697V9JournalPathNullable(runId);
  if (path === null) throw new Error('PHASE_6_9_7_V9_RUN_ID_INVALID');
  return path;
}

export function phase697V9RecoveryClaimPath(runId: string): string {
  const path = phase697V9RecoveryClaimPathNullable(runId);
  if (path === null) throw new Error('PHASE_6_9_7_V9_RUN_ID_INVALID');
  return path;
}

export function phase697V9EvidencePath(input: {
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  runId: string;
}): string {
  const path = phase697V9EvidencePathNullable(input);
  if (path === null) throw new Error('PHASE_6_9_7_V9_RUN_ID_INVALID');
  return path;
}

export function projectPhase697V9TerminalEntry(
  entry: Readonly<Phase697V9CaseEntry>,
): Readonly<Phase697V9TerminalProjection> | null {
  const parsed = PHASE_6_9_7_V9_TERMINAL_PROJECTION_SCHEMA.safeParse({
    runtimeEvidenceVersion: PHASE_6_9_7_V9_RUNTIME_EVIDENCE_VERSION,
    entry,
    terminalEntrySha256: sha256Phase697V9Stable(entry),
  });
  return parsed.success ? Object.freeze(parsed.data) : null;
}

export function restorePhase697V9TerminalEntry(
  projection: unknown,
): Readonly<Phase697V9CaseEntry> | null {
  const parsed = PHASE_6_9_7_V9_TERMINAL_PROJECTION_SCHEMA.safeParse(projection);
  if (!parsed.success) return null;
  return sha256Phase697V9Stable(parsed.data.entry) === parsed.data.terminalEntrySha256
    ? Object.freeze(parsed.data.entry)
    : null;
}

export function buildPhase697V9JournalRecord(input: {
  runId: string;
  sequence: number;
  previousRecordSha256: string | null;
  payload: Phase697V9JournalPayload;
}): Phase697V9JournalRecord {
  const withoutHash = {
    journalVersion: PHASE_6_9_7_V9_JOURNAL_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V9,
    runId: input.runId,
    sequence: input.sequence,
    previousRecordSha256: input.previousRecordSha256,
    payload: input.payload,
  };
  return PHASE_6_9_7_V9_JOURNAL_RECORD_SCHEMA.parse({
    ...withoutHash,
    recordSha256: sha256Phase697V9Stable(withoutHash),
  });
}

export function parseAndValidatePhase697V9Journal(text: string): Phase697V9ValidatedJournal | null {
  if (typeof text !== 'string' || text.length === 0 || !text.endsWith('\n')) return null;
  const lines = text.slice(0, -1).split('\n');
  if (lines.length === 0 || lines.some((line) => line.length === 0 || line.length > 65_536)) {
    return null;
  }
  const records: Phase697V9JournalRecord[] = [];
  try {
    for (const line of lines) {
      const parsed = PHASE_6_9_7_V9_JOURNAL_RECORD_SCHEMA.parse(JSON.parse(line) as unknown);
      const { recordSha256, ...withoutHash } = parsed;
      if (sha256Phase697V9Stable(withoutHash) !== recordSha256) return null;
      records.push(parsed);
    }
  } catch {
    return null;
  }
  const first = records[0];
  if (!first || first.sequence !== 0 || first.payload.kind !== 'journal_initialized') return null;

  const runId = first.runId;
  const guards = new Map<string, Phase697V9CaseEntry>();
  const mutableLanes = new Map<
    string,
    {
      caseId: string;
      agent: 'tutor' | 'wrong_question_organizer';
      pairedRunIndex: number;
      stages: Phase697V9WireStage[];
    }
  >();
  const terminals = new Map<string, Phase697V9CaseEntry>();
  const pairDurations = new Map<
    number,
    Extract<Phase697V9JournalPayload, { kind: 'pair_terminal' }>['pairedDurationEvidence']
  >();
  let breaker: Extract<Phase697V9JournalPayload, { kind: 'breaker_opened' }> | null = null;
  let runCompleted: Phase697V9ValidatedJournal['runCompleted'] = null;
  let sealed: Phase697V9ValidatedJournal['sealed'] = null;
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
    if (payload.kind === 'journal_initialized') continue;

    if (payload.kind === 'guard_terminal') {
      const terminal = restorePhase697V9TerminalEntry(payload.terminal);
      if (
        mutableLanes.size > 0 ||
        breaker !== null ||
        runCompleted !== null ||
        !terminal ||
        terminal.executionKind !== 'zero_call' ||
        terminal.wireEvidence.disposition !== 'not_observed' ||
        guards.has(terminal.caseId)
      ) {
        return null;
      }
      guards.set(terminal.caseId, terminal);
      continue;
    }

    if (payload.kind === 'lane_reserved') {
      const expectedKey = phase697V9DispatchKeySha256({
        runId,
        agent: payload.agent,
        pairedRunIndex: payload.pairedRunIndex,
      });
      const expectedCase = runtimeCase(payload.agent, payload.pairedRunIndex);
      const pairLanes = [...mutableLanes.values()].filter(
        (lane) => lane.pairedRunIndex === payload.pairedRunIndex,
      );
      if (
        breaker !== null ||
        runCompleted !== null ||
        guards.size !== 24 ||
        [...guards.values()].some((entry) => !entry.zeroCallVerified) ||
        payload.pairedRunIndex !== pairDurations.size ||
        expectedKey === null ||
        payload.dispatchKeySha256 !== expectedKey ||
        payload.caseId !== expectedCase?.id ||
        mutableLanes.has(payload.dispatchKeySha256) ||
        pairLanes.length >= 2 ||
        pairLanes.some((lane) => lane.agent === payload.agent)
      ) {
        return null;
      }
      mutableLanes.set(payload.dispatchKeySha256, {
        caseId: payload.caseId,
        agent: payload.agent,
        pairedRunIndex: payload.pairedRunIndex,
        stages: [],
      });
      continue;
    }

    if (payload.kind === 'wire_stage') {
      const lane = mutableLanes.get(payload.dispatchKeySha256);
      if (
        breaker !== null ||
        runCompleted !== null ||
        !lane ||
        terminals.has(payload.dispatchKeySha256) ||
        payload.stage !== PHASE_6_9_7_V9_WIRE_STAGES[lane.stages.length]
      ) {
        return null;
      }
      lane.stages.push(payload.stage);
      continue;
    }

    if (payload.kind === 'runtime_terminal') {
      const lane = mutableLanes.get(payload.dispatchKeySha256);
      const terminal = restorePhase697V9TerminalEntry(payload.terminal);
      const snapshot = terminal?.wireEvidence.snapshot ?? null;
      if (
        breaker !== null ||
        runCompleted !== null ||
        !lane ||
        !terminal ||
        terminal.caseId !== lane.caseId ||
        terminal.agent !== lane.agent ||
        terminal.pairedRunIndex !== lane.pairedRunIndex ||
        terminal.executionKind !== 'runtime' ||
        terminal.wireEvidence.disposition !== 'observed' ||
        snapshot === null ||
        snapshot.state === 'active' ||
        JSON.stringify(snapshot.stages) !== JSON.stringify(lane.stages) ||
        terminals.has(payload.dispatchKeySha256)
      ) {
        return null;
      }
      terminals.set(payload.dispatchKeySha256, terminal);
      continue;
    }

    if (payload.kind === 'pair_terminal') {
      const pairLanes = [...mutableLanes.entries()].filter(
        ([, lane]) => lane.pairedRunIndex === payload.pairedRunIndex,
      );
      const pairTerminals = pairLanes.flatMap(([key]) => {
        const terminal = terminals.get(key);
        return terminal ? [terminal] : [];
      });
      const terminalLatencies = pairTerminals.map((entry) => entry.latencyMs);
      const expectedLatencyPresent = terminalLatencies.every((entry) => entry !== null);
      const pairedDuration = payload.pairedDurationEvidence;
      if (
        breaker !== null ||
        runCompleted !== null ||
        payload.pairedRunIndex !== pairDurations.size ||
        pairDurations.has(payload.pairedRunIndex) ||
        pairLanes.length !== 2 ||
        pairTerminals.length !== 2 ||
        (expectedLatencyPresent
          ? pairedDuration === null ||
            pairedDuration.stage !== 'paired_request' ||
            pairedDuration.durationMs < Math.max(...terminalLatencies)
          : pairedDuration !== null)
      ) {
        return null;
      }
      pairDurations.set(payload.pairedRunIndex, pairedDuration);
      continue;
    }

    if (payload.kind === 'breaker_opened') {
      if (breaker !== null || runCompleted !== null || guards.size !== 24) return null;
      if (payload.breakerState === 'guard_failed') {
        const trigger = guards.get(payload.triggerCaseId);
        if (
          mutableLanes.size !== 0 ||
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
          runtimeContractSuccessV9(trigger) ||
          trigger.agent !== payload.triggerAgent ||
          trigger.pairedRunIndex !== payload.triggerPairedRunIndex ||
          payload.triggerPairedRunIndex === null ||
          !pairDurations.has(payload.triggerPairedRunIndex)
        ) {
          return null;
        }
      }
      breaker = payload;
      continue;
    }

    if (payload.kind === 'run_completed') {
      const guardFailure = [...guards.values()].some((entry) => !entry.zeroCallVerified);
      const runtimeFailure = [...terminals.values()].some(
        (entry) => !runtimeContractSuccessV9(entry),
      );
      if (
        runCompleted !== null ||
        guards.size !== 24 ||
        (guardFailure && breaker?.breakerState !== 'guard_failed') ||
        (!guardFailure && runtimeFailure && breaker?.breakerState !== 'quality_gate_impossible') ||
        (!guardFailure &&
          !runtimeFailure &&
          (breaker !== null ||
            mutableLanes.size !== 48 ||
            terminals.size !== 48 ||
            pairDurations.size !== 24)) ||
        (!guardFailure && breaker?.breakerState === 'guard_failed')
      ) {
        return null;
      }
      runCompleted = { reportSha256: payload.reportSha256, gate: payload.gate };
      continue;
    }

    if (
      payload.sealedFromJournalSha256 !== record.previousRecordSha256 ||
      (payload.disposition === 'completed_run' && runCompleted === null)
    ) {
      return null;
    }
    sealed = payload;
  }

  const lanes = new Map<string, ValidatedLane>();
  for (const [key, lane] of mutableLanes) {
    lanes.set(
      key,
      Object.freeze({
        caseId: lane.caseId,
        agent: lane.agent,
        pairedRunIndex: lane.pairedRunIndex,
        stages: Object.freeze([...lane.stages]),
      }),
    );
  }
  return Object.freeze({
    records: Object.freeze(records),
    runId,
    runScope: first.payload.runScope,
    markerSha256: first.payload.markerSha256,
    tailSha256: records.at(-1)!.recordSha256,
    lastSequence: records.length - 1,
    guardTerminals: guards,
    lanes,
    runtimeTerminals: terminals,
    pairedDurations: pairDurations,
    breaker,
    runCompleted,
    sealed,
  });
}

export function buildPhase697V9SealedReport(input: {
  marker: Readonly<Phase697V9Marker>;
  markerSha256: string;
  journal: Readonly<Phase697V9ValidatedJournal> | null;
}): Readonly<Phase697TutorOrganizerV9Report> | null {
  if (
    !sha256Schema.safeParse(input.markerSha256).success ||
    (input.journal !== null &&
      (input.journal.runId !== input.marker.runId ||
        input.journal.runScope !== input.marker.runScope ||
        input.journal.markerSha256 !== input.markerSha256))
  ) {
    return null;
  }

  const wireSnapshots = new Map<string, Readonly<Phase697V9WireSnapshot>>();
  const boundedSchemaDiagnostics = new Map<
    string,
    NonNullable<Phase697V9CaseEntry['boundedSchemaDiagnostic']>
  >();
  const v6Entries: Phase697V6CaseEntry[] = [];
  const expectedTerminals = new Map<string, Phase697V9CaseEntry>();
  const journal = input.journal;
  const completed = journal?.runCompleted ?? null;
  const breaker = journal?.breaker ?? null;
  const undispatchedOutcome =
    completed === null
      ? ('not_started_orphaned' as const)
      : breaker?.breakerState === 'guard_failed'
        ? ('not_started_case_guard' as const)
        : breaker?.breakerState === 'quality_gate_impossible'
          ? ('not_started_quality_breaker' as const)
          : ('not_started_orphaned' as const);
  for (const testCase of PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES) {
    let v9Entry: Phase697V9CaseEntry;
    if (testCase.expectedRuntimeInvocations === 0) {
      v9Entry =
        input.journal?.guardTerminals.get(testCase.id) ??
        buildPhase697V9CaseEntry(buildMissingGuardEntry(testCase), null);
    } else {
      const dispatchKey = phase697V9DispatchKeySha256({
        runId: input.marker.runId,
        agent: testCase.agent,
        pairedRunIndex: testCase.pairedRunIndex,
      });
      if (dispatchKey === null) return null;
      const terminal = input.journal?.runtimeTerminals.get(dispatchKey);
      if (terminal) {
        v9Entry = terminal;
        expectedTerminals.set(testCase.id, terminal);
      } else {
        const lane = input.journal?.lanes.get(dispatchKey);
        if (lane) {
          const activeSnapshot = buildActiveSnapshot(lane.stages);
          wireSnapshots.set(testCase.id, activeSnapshot);
          v9Entry = buildPhase697V9CaseEntry(
            buildPhase697V6OrphanedEntry(testCase, true),
            activeSnapshot,
          );
        } else {
          v9Entry = buildPhase697V9CaseEntry(
            buildPhase697V6NotStartedEntry(testCase, undispatchedOutcome),
            null,
          );
        }
      }
      if (v9Entry.wireEvidence.snapshot !== null) {
        wireSnapshots.set(testCase.id, v9Entry.wireEvidence.snapshot);
      }
    }
    const projected = projectPhase697V9EntryToV6(v9Entry);
    if (projected === null) return null;
    if (v9Entry.boundedSchemaDiagnostic !== null) {
      boundedSchemaDiagnostics.set(testCase.id, v9Entry.boundedSchemaDiagnostic);
    }
    v6Entries.push(projected);
  }

  const dispatchedPairs = new Set(
    [...(journal?.lanes.values() ?? [])].map((lane) => lane.pairedRunIndex),
  ).size;
  const triggerEntry =
    breaker === null
      ? (v6Entries.find(
          (entry) =>
            entry.executionKind === 'runtime' &&
            (entry.executionOutcome === 'attempted_orphaned' ||
              entry.executionOutcome === 'executed_failure'),
        ) ?? null)
      : (v6Entries.find((entry) => entry.caseId === breaker.triggerCaseId) ?? null);

  try {
    const v6Report = buildPhase697TutorOrganizerV6Report({
      runId: input.marker.runId,
      runScope: input.marker.runScope,
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      executorProvenance:
        input.marker.executorProvenance === 'first_party_deepseek_v4_pro_direct'
          ? 'deepseek_network'
          : 'synthetic_test',
      caseEntries: v6Entries,
      pairedDurations: journal?.pairedDurations ?? new Map(),
      scheduler: {
        guardPhasePassed:
          journal !== null &&
          journal.guardTerminals.size === 24 &&
          [...journal.guardTerminals.values()].every((entry) => entry.zeroCallVerified),
        breakerState:
          completed === null
            ? 'orphaned'
            : breaker?.breakerState === 'guard_failed'
              ? 'guard_failed'
              : breaker?.breakerState === 'quality_gate_impossible'
                ? 'quality_gate_impossible'
                : 'closed',
        triggerCaseId: triggerEntry?.caseId ?? null,
        triggerAgent: triggerEntry?.agent ?? null,
        triggerPairedRunIndex:
          triggerEntry?.executionKind === 'runtime' ? triggerEntry.pairedRunIndex : null,
        dispatchedPairs,
        completedPairs: journal?.pairedDurations.size ?? 0,
        maxConcurrentPairs: dispatchedPairs > 0 ? 1 : 0,
        maxConcurrentLaneOperations: dispatchedPairs > 0 ? 2 : 0,
      },
      ledger: {
        reservedEntries: journal?.lanes.size ?? 0,
        terminalEntries: journal?.runtimeTerminals.size ?? 0,
        duplicateDispatchRejected: 0,
      },
    });
    const report = buildPhase697TutorOrganizerV9Report({
      v6Report,
      wireSnapshots,
      boundedSchemaDiagnostics,
      executorProvenance: input.marker.executorProvenance,
    });
    for (const [caseId, terminal] of expectedTerminals) {
      const rebuilt = report.caseEntries.find((entry) => entry.caseId === caseId);
      if (!rebuilt || sha256Phase697V9Stable(rebuilt) !== sha256Phase697V9Stable(terminal)) {
        return null;
      }
    }
    if (
      completed !== null &&
      (completed.reportSha256 !== sha256Phase697V9Stable(report) || completed.gate !== report.gate)
    ) {
      return null;
    }
    return report;
  } catch {
    return null;
  }
}

export function assertPhase697V9PathIdentity(): void {
  const identities = [
    PHASE_6_9_7_V9_MARKER_PATH,
    PHASE_6_9_7_V9_EVIDENCE_PREFIX,
    PHASE_6_9_7_V9_RECOVERY_CLAIM_VERSION,
    PHASE_6_9_7_V9_MARKER_VERSION,
  ];
  if (
    !PHASE_6_9_7_V9_MARKER_PATH.includes('-v9-') ||
    !PHASE_6_9_7_V9_EVIDENCE_PREFIX.endsWith('-v9') ||
    !PHASE_6_9_7_V9_RECOVERY_CLAIM_VERSION.includes('phase-6.9.7-v9-') ||
    !PHASE_6_9_7_V9_MARKER_VERSION.includes('phase-6.9.7-v9-') ||
    identities.some((identity) =>
      /(?:phase-6[.-]9[.-]7|tutor-organizer)-v[1-8](?:[./-]|$)/u.test(identity),
    )
  ) {
    throw new Error('PHASE_6_9_7_V9_DURABILITY_IDENTITY_INVALID');
  }
}

function runtimeContractSuccessV9(entry: Readonly<Phase697V9CaseEntry>): boolean {
  if (entry.wireEvidence.disposition !== 'observed') return false;
  const snapshot = entry.wireEvidence.snapshot;
  return (
    entry.strictRuntimeSuccess &&
    snapshot.version === PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION &&
    snapshot.state === 'succeeded' &&
    snapshot.stages.length === PHASE_6_9_7_V9_WIRE_STAGES.length &&
    snapshot.usageDisposition === 'verified' &&
    snapshot.counters.executorInvocations === 1 &&
    snapshot.counters.providerDispatches === 1 &&
    snapshot.counters.providerResponses === 1 &&
    snapshot.counters.verifiedUsages === 1
  );
}

function runtimeCase(agent: 'tutor' | 'wrong_question_organizer', pairedRunIndex: number) {
  return PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.find(
    (entry) =>
      entry.expectedRuntimeInvocations === 1 &&
      entry.agent === agent &&
      entry.pairedRunIndex === pairedRunIndex,
  );
}

function buildActiveSnapshot(stages: readonly Phase697V9WireStage[]): Phase697V9WireSnapshot {
  return Object.freeze({
    version: PHASE_6_9_7_V9_WIRE_DIAGNOSTICS_VERSION,
    state: 'active',
    stages: Object.freeze([...stages]),
    lastCompletedStage: stages.at(-1) ?? null,
    failureCategory: null,
    usageDisposition: stages.includes('usage_validated') ? 'verified' : 'not_observed',
    counters: Object.freeze({
      executorInvocations: stages.includes('executor_entered') ? 1 : 0,
      providerDispatches: stages.includes('provider_dispatch_started') ? 1 : 0,
      providerResponses: stages.includes('provider_response_received') ? 1 : 0,
      verifiedUsages: stages.includes('usage_validated') ? 1 : 0,
    }),
  });
}

function buildMissingGuardEntry(
  testCase: Extract<Phase697V2Case, { expectedRuntimeInvocations: 0 }>,
): Phase697V6CaseEntry {
  return PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA.parse({
    runtimeEvidenceVersion: PHASE_6_9_7_V6_RUNTIME_EVIDENCE_VERSION,
    caseId: testCase.id,
    agent: testCase.agent,
    executionKind: 'zero_call',
    pairedRunIndex: null,
    runtimeInvocations: 0,
    executionOutcome: 'not_started_case_guard',
    candidateDisposition: 'fallback_runtime_error',
    failureCategory: 'orphaned',
    providerFailureCategory: null,
    structuredOutputStage: null,
    strictRuntimeSuccess: false,
    zeroCallVerified: false,
    semanticAxes: null,
    modelOwnedDecision: null,
    durationEvidence: { executor: null, runtimeTrace: null, candidateOrchestration: null },
    latencyMs: null,
    orchestrationLatencyMs: null,
    usageDisposition: 'absent_not_attempted',
    usage: null,
    safety: {
      criticalFailure: true,
      permissionFailure: false,
      mutationFailure: false,
      broaderThanDeterministicFallback: false,
    },
    dispatchRecorded: false,
    runtimeTerminalRecorded: false,
  });
}

function sortStableValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PHASE_6_9_7_V9_NON_FINITE_VALUE');
    return value;
  }
  if (Array.isArray(value)) return value.map(sortStableValue);
  if (typeof value !== 'object') throw new Error('PHASE_6_9_7_V9_UNSUPPORTED_VALUE');
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('PHASE_6_9_7_V9_NON_PLAIN_VALUE');
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortStableValue(child)]),
  );
}
