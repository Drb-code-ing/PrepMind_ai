import { createHash } from 'node:crypto';

import { z } from 'zod';

import {
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
  PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
  type Phase697V2Case,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import { PHASE_6_9_7_V6_EVAL_POLICY_SHA256 } from './phase-6-9-tutor-wrong-question-v6-policy.ts';
import {
  PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
  PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
} from './phase-6-9-tutor-wrong-question-v6-dataset-binding.ts';
import {
  PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA,
  PHASE_6_9_7_V6_DURATION_EVIDENCE_SCHEMA,
  PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6,
  PHASE_6_9_7_V6_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V6_EVIDENCE_PREFIX,
  PHASE_6_9_7_V6_JOURNAL_VERSION,
  PHASE_6_9_7_V6_MARKER_PATH,
  PHASE_6_9_7_V6_MARKER_SCHEMA,
  PHASE_6_9_7_V6_MARKER_VERSION,
  PHASE_6_9_7_V6_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_V6_RECOVERY_CLAIM_VERSION,
  PHASE_6_9_7_V6_RUNTIME_EVIDENCE_VERSION,
  phase697V6EvidencePath as phase697V6EvidencePathNullable,
  phase697V6JournalPath as phase697V6JournalPathNullable,
  phase697V6RecoveryClaimPath as phase697V6RecoveryClaimPathNullable,
  runtimeContractSuccessV6,
  sha256Phase697V6Stable,
  type Phase697TutorOrganizerV6Report,
  type Phase697V6CaseEntry,
  type Phase697V6EvidenceEnvelope,
  type Phase697V6Marker,
  type Phase697V6RecoveryClaimRecord,
} from './phase-6-9-tutor-wrong-question-v6-contract.ts';
import {
  buildPhase697TutorOrganizerV6Report,
  buildPhase697V6NotStartedEntry,
  buildPhase697V6OrphanedEntry,
} from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';

export {
  PHASE_6_9_7_V6_EVIDENCE_ENVELOPE_SCHEMA,
  PHASE_6_9_7_V6_MARKER_PATH,
  PHASE_6_9_7_V6_MARKER_SCHEMA,
  PHASE_6_9_7_V6_RECOVERY_CLAIM_SCHEMA,
  PHASE_6_9_7_V6_RECOVERY_CLAIM_VERSION,
};
export type { Phase697V6EvidenceEnvelope, Phase697V6Marker, Phase697V6RecoveryClaimRecord };

const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const runIdSchema = z.string().uuid();
const caseIdSchema = z.string().regex(/^(tutor|organizer)-v2-(zero|runtime)-[a-z0-9-]+$/);
const agentSchema = z.enum(['tutor', 'wrong_question_organizer']);
const pairedRunIndexSchema = z.number().int().min(0).max(23);

export const PHASE_6_9_7_V6_TERMINAL_PROJECTION_SCHEMA = z
  .object({
    runtimeEvidenceVersion: z.literal(PHASE_6_9_7_V6_RUNTIME_EVIDENCE_VERSION),
    entry: PHASE_6_9_7_V6_CASE_ENTRY_SCHEMA,
    terminalEntrySha256: sha256Schema,
  })
  .strict();

export type Phase697V6TerminalProjection = z.infer<
  typeof PHASE_6_9_7_V6_TERMINAL_PROJECTION_SCHEMA
>;

export const PHASE_6_9_7_V6_JOURNAL_PAYLOAD_SCHEMA = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('journal_initialized'),
      markerSha256: sha256Schema,
      runScope: z.enum(['branch', 'main']),
      mode: z.literal('live'),
      datasetBindingVersion: z.literal(PHASE_6_9_7_V6_DATASET_BINDING_VERSION),
      datasetBindingSha256: z.literal(PHASE_6_9_7_V6_DATASET_BINDING_SHA256),
      datasetVersion: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION),
      datasetSha256: z.literal(PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256),
      evalPolicySha256: z.literal(PHASE_6_9_7_V6_EVAL_POLICY_SHA256),
    })
    .strict(),
  z
    .object({
      kind: z.literal('guard_terminal'),
      terminal: PHASE_6_9_7_V6_TERMINAL_PROJECTION_SCHEMA,
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
      terminal: PHASE_6_9_7_V6_TERMINAL_PROJECTION_SCHEMA,
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
      disposition: z.enum(['completed_run', 'orphan_sealed', 'journal_missing_sealed']),
      sealedFromJournalSha256: sha256Schema.nullable(),
      evidenceSha256: sha256Schema,
    })
    .strict(),
]);

export type Phase697V6JournalPayload = z.infer<typeof PHASE_6_9_7_V6_JOURNAL_PAYLOAD_SCHEMA>;

export const PHASE_6_9_7_V6_JOURNAL_RECORD_SCHEMA = z
  .object({
    journalVersion: z.literal(PHASE_6_9_7_V6_JOURNAL_VERSION),
    runnerVersion: z.literal(PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6),
    runId: runIdSchema,
    sequence: z.number().int().safe().nonnegative(),
    previousRecordSha256: sha256Schema.nullable(),
    payload: PHASE_6_9_7_V6_JOURNAL_PAYLOAD_SCHEMA,
    recordSha256: sha256Schema,
  })
  .strict();

export type Phase697V6JournalRecord = z.infer<typeof PHASE_6_9_7_V6_JOURNAL_RECORD_SCHEMA>;

export type Phase697V6ValidatedJournal = Readonly<{
  records: readonly Phase697V6JournalRecord[];
  runId: string;
  runScope: 'branch' | 'main';
  markerSha256: string;
  tailSha256: string;
  lastSequence: number;
  guardTerminals: ReadonlyMap<string, Phase697V6CaseEntry>;
  dispatches: ReadonlyMap<
    string,
    Readonly<{
      caseId: string;
      agent: 'tutor' | 'wrong_question_organizer';
      pairedRunIndex: number;
    }>
  >;
  runtimeTerminals: ReadonlyMap<string, Phase697V6CaseEntry>;
  pairedDurations: ReadonlyMap<
    number,
    Extract<Phase697V6JournalPayload, { kind: 'pair_terminal' }>['pairedDurationEvidence']
  >;
  breaker: Extract<Phase697V6JournalPayload, { kind: 'breaker_opened' }> | null;
  runCompleted: Readonly<{
    reportSha256: string;
    gate: 'quality_gate_passed' | 'quality_gate_failed';
  }> | null;
  sealed: Extract<Phase697V6JournalPayload, { kind: 'evidence_sealed' }> | null;
}>;

export function stablePhase697V6JsonStringify(value: unknown): string {
  return JSON.stringify(sortStableValue(value));
}

export const stableJsonStringify = stablePhase697V6JsonStringify;

export function sha256Phase697V6Bytes(value: string | Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export const sha256Bytes = sha256Phase697V6Bytes;

export function buildPhase697V6Marker(input: {
  runId: string;
  runScope: 'branch' | 'main';
  executorProvenance?: 'deepseek_network' | 'synthetic_test';
  ownerProcessId?: number;
}): Phase697V6Marker {
  return PHASE_6_9_7_V6_MARKER_SCHEMA.parse({
    markerVersion: PHASE_6_9_7_V6_MARKER_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6,
    datasetBindingVersion: PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
    datasetBindingSha256: PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
    datasetVersion: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_VERSION,
    datasetSha256: PHASE_6_9_TUTOR_WRONG_QUESTION_V2_DATASET_SHA256,
    evalPolicySha256: PHASE_6_9_7_V6_EVAL_POLICY_SHA256,
    runId: input.runId,
    runScope: input.runScope,
    mode: 'live',
    executorProvenance: input.executorProvenance ?? 'deepseek_network',
    ownerProcessId: input.ownerProcessId ?? process.pid,
    state: 'attempt_reserved',
  });
}

export function phase697V6JournalPath(runId: string): string {
  const path = phase697V6JournalPathNullable(runId);
  if (path === null) throw new Error('PHASE_6_9_7_V6_RUN_ID_INVALID');
  return path;
}

export function phase697V6RecoveryClaimPath(runId: string): string {
  const path = phase697V6RecoveryClaimPathNullable(runId);
  if (path === null) throw new Error('PHASE_6_9_7_V6_RUN_ID_INVALID');
  return path;
}

export function phase697V6EvidencePath(input: {
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  runId: string;
}): string {
  const path = phase697V6EvidencePathNullable(input);
  if (path === null) throw new Error('PHASE_6_9_7_V6_RUN_ID_INVALID');
  return path;
}

export function phase697V6DispatchKeySha256(input: {
  runId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  pairedRunIndex: number;
}): `sha256:${string}` {
  return sha256Phase697V6Stable({
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6,
    ...input,
  });
}

export function projectPhase697V6TerminalEntry(
  entry: Readonly<Phase697V6CaseEntry>,
): Readonly<Phase697V6TerminalProjection> | null {
  const parsed = PHASE_6_9_7_V6_TERMINAL_PROJECTION_SCHEMA.safeParse({
    runtimeEvidenceVersion: PHASE_6_9_7_V6_RUNTIME_EVIDENCE_VERSION,
    entry,
    terminalEntrySha256: sha256Phase697V6Stable(entry),
  });
  return parsed.success ? Object.freeze(parsed.data) : null;
}

export function restorePhase697V6TerminalEntry(
  projection: unknown,
): Readonly<Phase697V6CaseEntry> | null {
  const parsed = PHASE_6_9_7_V6_TERMINAL_PROJECTION_SCHEMA.safeParse(projection);
  if (!parsed.success) return null;
  return sha256Phase697V6Stable(parsed.data.entry) === parsed.data.terminalEntrySha256
    ? Object.freeze(parsed.data.entry)
    : null;
}

export function buildPhase697V6JournalRecord(input: {
  runId: string;
  sequence: number;
  previousRecordSha256: string | null;
  payload: Phase697V6JournalPayload;
}): Phase697V6JournalRecord {
  const withoutHash = {
    journalVersion: PHASE_6_9_7_V6_JOURNAL_VERSION,
    runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6,
    runId: input.runId,
    sequence: input.sequence,
    previousRecordSha256: input.previousRecordSha256,
    payload: input.payload,
  };
  return PHASE_6_9_7_V6_JOURNAL_RECORD_SCHEMA.parse({
    ...withoutHash,
    recordSha256: sha256Phase697V6Stable(withoutHash),
  });
}

export function parseAndValidatePhase697V6Journal(text: string): Phase697V6ValidatedJournal | null {
  if (typeof text !== 'string' || text.length === 0 || !text.endsWith('\n')) return null;
  const lines = text.slice(0, -1).split('\n');
  if (lines.length === 0 || lines.some((line) => line.length === 0 || line.length > 65_536)) {
    return null;
  }
  const records: Phase697V6JournalRecord[] = [];
  try {
    for (const line of lines) {
      const parsed = PHASE_6_9_7_V6_JOURNAL_RECORD_SCHEMA.parse(JSON.parse(line) as unknown);
      const { recordSha256, ...withoutHash } = parsed;
      if (sha256Phase697V6Stable(withoutHash) !== recordSha256) return null;
      records.push(parsed);
    }
  } catch {
    return null;
  }
  const first = records[0];
  if (!first || first.payload.kind !== 'journal_initialized' || first.sequence !== 0) return null;
  const runId = first.runId;
  const guards = new Map<string, Phase697V6CaseEntry>();
  const dispatches = new Map<
    string,
    Readonly<{
      caseId: string;
      agent: 'tutor' | 'wrong_question_organizer';
      pairedRunIndex: number;
    }>
  >();
  const terminals = new Map<string, Phase697V6CaseEntry>();
  const pairDurations = new Map<
    number,
    Extract<Phase697V6JournalPayload, { kind: 'pair_terminal' }>['pairedDurationEvidence']
  >();
  let breaker: Extract<Phase697V6JournalPayload, { kind: 'breaker_opened' }> | null = null;
  let runCompleted: Phase697V6ValidatedJournal['runCompleted'] = null;
  let sealed: Phase697V6ValidatedJournal['sealed'] = null;
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
      const terminal = restorePhase697V6TerminalEntry(payload.terminal);
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
      const expectedKey = phase697V6DispatchKeySha256({
        runId,
        agent: payload.agent,
        pairedRunIndex: payload.pairedRunIndex,
      });
      const expectedPairIndex = pairDurations.size;
      const expectedCase = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.find(
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
      const terminal = restorePhase697V6TerminalEntry(payload.terminal);
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
      const pairedDuration = payload.pairedDurationEvidence;
      if (
        breaker !== null ||
        runCompleted !== null ||
        payload.pairedRunIndex !== pairDurations.size ||
        pairDurations.has(payload.pairedRunIndex) ||
        pairDispatches.length !== 2 ||
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
          runtimeContractSuccessV6(trigger) ||
          trigger.agent !== payload.triggerAgent ||
          trigger.pairedRunIndex !== payload.triggerPairedRunIndex ||
          payload.triggerPairedRunIndex === null ||
          !pairDurations.has(payload.triggerPairedRunIndex)
        ) {
          return null;
        }
      }
      breaker = payload;
    } else if (payload.kind === 'run_completed') {
      const guardFailure = [...guards.values()].some((entry) => !entry.zeroCallVerified);
      const runtimeFailure = [...terminals.values()].some(
        (entry) => !runtimeContractSuccessV6(entry),
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
            pairDurations.size !== 24)) ||
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
    pairedDurations: pairDurations,
    breaker,
    runCompleted,
    sealed,
  });
}

export function buildPhase697V6SealedReport(input: {
  marker: Readonly<Phase697V6Marker>;
  markerSha256: string;
  journal: Readonly<Phase697V6ValidatedJournal> | null;
}): Readonly<Phase697TutorOrganizerV6Report> | null {
  if (
    !sha256Schema.safeParse(input.markerSha256).success ||
    (input.journal !== null &&
      (input.journal.runId !== input.marker.runId ||
        input.journal.runScope !== input.marker.runScope ||
        input.journal.markerSha256 !== input.markerSha256))
  ) {
    return null;
  }
  const journal = input.journal;
  const caseEntries = PHASE_6_9_TUTOR_WRONG_QUESTION_V2_CASES.map((testCase) => {
    if (testCase.expectedRuntimeInvocations === 0) {
      return journal?.guardTerminals.get(testCase.id) ?? buildMissingGuardEntry(testCase);
    }
    const dispatchKey = phase697V6DispatchKeySha256({
      runId: input.marker.runId,
      agent: testCase.agent,
      pairedRunIndex: testCase.pairedRunIndex,
    });
    const terminal = journal?.runtimeTerminals.get(dispatchKey);
    if (terminal) return terminal;
    return journal?.dispatches.has(dispatchKey)
      ? buildPhase697V6OrphanedEntry(testCase, true)
      : buildPhase697V6NotStartedEntry(testCase, 'not_started_orphaned');
  });
  const completed = journal?.runCompleted ?? null;
  const breaker = journal?.breaker ?? null;
  const dispatchedPairs = new Set(
    [...(journal?.dispatches.values() ?? [])].map((dispatch) => dispatch.pairedRunIndex),
  ).size;
  const triggerEntry =
    breaker === null
      ? (caseEntries.find(
          (entry) =>
            entry.executionKind === 'runtime' &&
            (entry.executionOutcome === 'attempted_orphaned' ||
              entry.executionOutcome === 'executed_failure'),
        ) ?? null)
      : (caseEntries.find((entry) => entry.caseId === breaker.triggerCaseId) ?? null);
  let v6Report: Readonly<Phase697TutorOrganizerV6Report>;
  try {
    v6Report = buildPhase697TutorOrganizerV6Report({
      runId: input.marker.runId,
      runScope: input.marker.runScope,
      mode: 'live',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      structuredOutputMode: 'deepseek_v4_pro_nonthinking_json',
      executorProvenance: input.marker.executorProvenance,
      caseEntries,
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
        reservedEntries: journal?.dispatches.size ?? 0,
        terminalEntries: journal?.runtimeTerminals.size ?? 0,
        duplicateDispatchRejected: 0,
      },
    });
  } catch {
    return null;
  }
  if (
    completed !== null &&
    (completed.reportSha256 !== sha256Phase697V6Stable(v6Report) ||
      completed.gate !== v6Report.gate)
  ) {
    return null;
  }
  return v6Report;
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
    durationEvidence: {
      executor: null,
      runtimeTrace: null,
      candidateOrchestration: null,
    },
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

export function assertPhase697V6PathIdentity(): void {
  if (
    !PHASE_6_9_7_V6_MARKER_PATH.includes('-v6-') ||
    !PHASE_6_9_7_V6_EVIDENCE_PREFIX.endsWith('-v6') ||
    PHASE_6_9_7_V6_RECOVERY_CLAIM_VERSION.includes('-v3-') ||
    !PHASE_6_9_7_V6_RECOVERY_CLAIM_SCHEMA.safeParse({
      claimVersion: PHASE_6_9_7_V6_RECOVERY_CLAIM_VERSION,
      runnerVersion: PHASE_6_9_7_TUTOR_ORGANIZER_RUNNER_VERSION_V6,
      runId: '00000000-0000-4000-8000-000000000000',
      ownerProcessId: 1,
      ownerToken: '00000000-0000-4000-8000-000000000001',
      markerSha256: `sha256:${'0'.repeat(64)}`,
      journalTailSha256: null,
      state: 'orphan_seal_claimed',
    }).success
  ) {
    throw new Error('PHASE_6_9_7_V6_DURABILITY_IDENTITY_INVALID');
  }
}

function sortStableValue(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('PHASE_6_9_7_V6_NON_FINITE_VALUE');
    return value;
  }
  if (Array.isArray(value)) return value.map(sortStableValue);
  if (typeof value !== 'object') throw new Error('PHASE_6_9_7_V6_UNSUPPORTED_VALUE');
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error('PHASE_6_9_7_V6_NON_PLAIN_VALUE');
  }
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, sortStableValue(child)]),
  );
}
