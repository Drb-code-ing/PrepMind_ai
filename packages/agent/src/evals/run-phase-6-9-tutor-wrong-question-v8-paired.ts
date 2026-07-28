import {
  createPhase697V7WireDiagnostics as createPhase697V8WireDiagnostics,
  type Phase697V7WireCapability as Phase697V8WireCapability,
  type Phase697V7WireDiagnostics as Phase697V8WireDiagnostics,
  type Phase697V7WireSnapshot as Phase697V8WireSnapshot,
  type Phase697V7WireStage as Phase697V8WireStage,
} from '@repo/ai';

import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  buildPhase697TutorOrganizerV8Report,
  buildPhase697V8CaseEntry,
  phase697V8DispatchKeySha256,
  sha256Phase697V8Stable,
  type Phase697TutorOrganizerV8Report,
  type Phase697V8CaseEntry,
} from './phase-6-9-tutor-wrong-question-v8-contract.ts';
import type { Phase697V6DurationEvidence } from './phase-6-9-tutor-wrong-question-v6-deadline.ts';
import {
  runPhase697TutorOrganizerPairedEvalV6,
  type Phase697V6Harness,
  type Phase697V6RunnerLifecycle,
  type Phase697V6RuntimeResult,
} from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import {
  WRONG_QUESTION_ORGANIZER_V8_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA,
  type WrongQuestionOrganizerV8BoundedSchemaDiagnostic,
} from '../model-candidates/wrong-question-organizer-v8-schema-diagnostic.ts';

type Phase697V8Agent = 'tutor' | 'wrong_question_organizer';

export type Phase697V8OrganizerRuntimeResult = Phase697V6RuntimeResult &
  Readonly<{
    boundedSchemaDiagnostic: WrongQuestionOrganizerV8BoundedSchemaDiagnostic | null;
  }>;

export type Phase697V8Harness = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  provider: 'mock' | 'deepseek';
  model: 'mock' | 'deepseek-v4-pro';
  structuredOutputMode: 'mock_json_v8' | 'deepseek_v4_pro_direct_json';
  executorProvenance: 'mock_synthetic' | 'first_party_deepseek_v4_pro_direct' | 'synthetic_test';
  runZeroCall: Phase697V6Harness['runZeroCall'];
  runTutor(
    entry: Phase697V2TutorRuntimeCase,
    signal: AbortSignal,
    wireCapability: Phase697V8WireCapability,
  ): Promise<Phase697V6RuntimeResult>;
  runOrganizer(
    entry: Phase697V2OrganizerRuntimeCase,
    signal: AbortSignal,
    wireCapability: Phase697V8WireCapability,
  ): Promise<Phase697V8OrganizerRuntimeResult>;
}>;

export type Phase697V8LaneReservation = Readonly<{
  runId: string;
  caseId: string;
  agent: Phase697V8Agent;
  pairedRunIndex: number;
  dispatchKeySha256: `sha256:${string}`;
}>;

export type Phase697V8RunnerLifecycle = Readonly<{
  recordGuardTerminal?(entry: Readonly<Phase697V8CaseEntry>): Promise<void>;
  recordLaneReserved?(reservation: Readonly<Phase697V8LaneReservation>): Promise<void>;
  recordWireStage?(
    reservation: Readonly<Phase697V8LaneReservation>,
    stage: Phase697V8WireStage,
  ): Promise<void>;
  recordRuntimeTerminal?(
    reservation: Readonly<Phase697V8LaneReservation>,
    entry: Readonly<Phase697V8CaseEntry>,
  ): Promise<void>;
  recordPairTerminal?(
    pairedRunIndex: number,
    durationEvidence: Phase697V6DurationEvidence | null,
  ): Promise<void>;
  recordBreakerOpened?(entry: Readonly<Phase697V8CaseEntry>): Promise<void>;
  recordRunCompleted?(report: Readonly<Phase697TutorOrganizerV8Report>): Promise<void>;
}>;

export type Phase697V8RunnerOptions = Readonly<{
  siblingSettlementTimeoutMs?: number;
  monotonicClock?: () => number;
  lifecycle?: Phase697V8RunnerLifecycle;
}>;

type LaneContext = {
  reservation: Phase697V8LaneReservation;
  diagnostics: Phase697V8WireDiagnostics;
  signal: AbortSignal | null;
};

export async function runPhase697TutorOrganizerPairedEvalV8(
  harness: Phase697V8Harness,
  options?: Phase697V8RunnerOptions,
): Promise<Readonly<Phase697TutorOrganizerV8Report>> {
  assertHarnessIdentity(harness);
  const lanes = new Map<string, LaneContext>();
  const wireSnapshots = new Map<string, Readonly<Phase697V8WireSnapshot>>();
  const boundedSchemaDiagnostics = new Map<
    string,
    Readonly<WrongQuestionOrganizerV8BoundedSchemaDiagnostic>
  >();
  const terminalEntries = new Map<string, Readonly<Phase697V8CaseEntry>>();
  let completedReport: Readonly<Phase697TutorOrganizerV8Report> | null = null;

  const v6Lifecycle: Phase697V6RunnerLifecycle = Object.freeze({
    async recordGuardTerminal(entry) {
      const terminal = buildPhase697V8CaseEntry(entry, null, null);
      terminalEntries.set(terminal.caseId, terminal);
      await options?.lifecycle?.recordGuardTerminal?.(terminal);
    },
    async recordDispatchStarted(reservation, caseId) {
      if (lanes.has(caseId)) throw new Error('PHASE_6_9_7_V8_DUPLICATE_LANE_RESERVATION');
      const dispatchKeySha256 = phase697V8DispatchKeySha256({
        runId: harness.runId,
        agent: reservation.agent,
        pairedRunIndex: reservation.pairedRunIndex,
      });
      if (dispatchKeySha256 === null) {
        throw new Error('PHASE_6_9_7_V8_LANE_RESERVATION_INVALID');
      }
      const v8Reservation: Phase697V8LaneReservation = Object.freeze({
        runId: harness.runId,
        caseId,
        agent: reservation.agent,
        pairedRunIndex: reservation.pairedRunIndex,
        dispatchKeySha256,
      });
      await options?.lifecycle?.recordLaneReserved?.(v8Reservation);
      const diagnostics = createPhase697V8WireDiagnostics({
        appendStage: (stage) => options?.lifecycle?.recordWireStage?.(v8Reservation, stage),
      });
      lanes.set(caseId, { reservation: v8Reservation, diagnostics, signal: null });
    },
    async recordRuntimeTerminal(reservation, entry) {
      const lane = requireLane(lanes, entry.caseId, reservation.agent, reservation.pairedRunIndex);
      const snapshot = await ensureTerminalSnapshot(lane, entry.executionOutcome);
      wireSnapshots.set(entry.caseId, snapshot);
      const terminal = buildPhase697V8CaseEntry(
        entry,
        snapshot,
        boundedSchemaDiagnostics.get(entry.caseId) ?? null,
      );
      terminalEntries.set(entry.caseId, terminal);
      await options?.lifecycle?.recordRuntimeTerminal?.(lane.reservation, terminal);
    },
    recordPairTerminal: (pairedRunIndex, durationEvidence) =>
      options?.lifecycle?.recordPairTerminal?.(pairedRunIndex, durationEvidence) ??
      Promise.resolve(),
    async recordBreakerOpened(entry) {
      const terminal = terminalEntries.get(entry.caseId);
      if (!terminal) throw new Error('PHASE_6_9_7_V8_BREAKER_TRIGGER_MISSING');
      await options?.lifecycle?.recordBreakerOpened?.(terminal);
    },
    async recordRunCompleted(v6Report) {
      const report = buildPhase697TutorOrganizerV8Report({
        v6Report,
        wireSnapshots,
        boundedSchemaDiagnostics,
        executorProvenance: harness.executorProvenance,
      });
      completedReport = report;
      await options?.lifecycle?.recordRunCompleted?.(report);
    },
  });

  const v6Report = await runPhase697TutorOrganizerPairedEvalV6(
    Object.freeze({
      runId: harness.runId,
      runScope: harness.runScope,
      mode: harness.mode,
      provider: harness.provider,
      model: harness.model,
      structuredOutputMode:
        harness.mode === 'mock' ? 'mock_json_v6' : 'deepseek_v4_pro_nonthinking_json',
      executorProvenance:
        harness.executorProvenance === 'first_party_deepseek_v4_pro_direct'
          ? 'deepseek_network'
          : harness.executorProvenance,
      runZeroCall: harness.runZeroCall,
      runTutor: (entry, signal) =>
        runLane({
          lane: requireLane(lanes, entry.id, 'tutor', entry.pairedRunIndex),
          signal,
          operation: (capability) => harness.runTutor(entry, signal, capability),
        }),
      runOrganizer: (entry, signal) =>
        runLane({
          lane: requireLane(lanes, entry.id, 'wrong_question_organizer', entry.pairedRunIndex),
          signal,
          operation: async (capability) => {
            const result = await harness.runOrganizer(entry, signal, capability);
            const diagnostic = snapshotBoundedSchemaDiagnostic(result.boundedSchemaDiagnostic);
            if (diagnostic !== null) boundedSchemaDiagnostics.set(entry.id, diagnostic);
            return result;
          },
        }),
    }),
    {
      ...(options?.siblingSettlementTimeoutMs === undefined
        ? {}
        : { siblingSettlementTimeoutMs: options.siblingSettlementTimeoutMs }),
      ...(options?.monotonicClock === undefined ? {} : { monotonicClock: options.monotonicClock }),
      lifecycle: v6Lifecycle,
    },
  );

  const rebuilt = buildPhase697TutorOrganizerV8Report({
    v6Report,
    wireSnapshots,
    boundedSchemaDiagnostics,
    executorProvenance: harness.executorProvenance,
  });
  if (
    completedReport === null ||
    sha256Phase697V8Stable(completedReport) !== sha256Phase697V8Stable(rebuilt)
  ) {
    throw new Error('PHASE_6_9_7_V8_RUN_COMPLETION_DRIFT');
  }
  return completedReport;
}

function snapshotBoundedSchemaDiagnostic(
  value: unknown,
): Readonly<WrongQuestionOrganizerV8BoundedSchemaDiagnostic> | null {
  if (value === null) return null;
  const parsed = WRONG_QUESTION_ORGANIZER_V8_BOUNDED_SCHEMA_DIAGNOSTIC_SCHEMA.safeParse(value);
  if (!parsed.success) throw new Error('PHASE_6_9_7_V8_BOUNDED_SCHEMA_DIAGNOSTIC_INVALID');
  return Object.freeze(parsed.data);
}

async function runLane(input: {
  lane: LaneContext;
  signal: AbortSignal;
  operation: (capability: Phase697V8WireCapability) => Promise<Phase697V6RuntimeResult>;
}): Promise<Phase697V6RuntimeResult> {
  if (input.lane.signal !== null) throw new Error('PHASE_6_9_7_V8_DUPLICATE_LANE_ENTRY');
  input.lane.signal = input.signal;
  try {
    const result = await input.operation(input.lane.diagnostics.capability);
    const snapshot = input.lane.diagnostics.readSnapshot();
    if (snapshot.state === 'active') {
      await terminateActiveLane(input.lane, input.signal.aborted ? 'abort' : 'harness');
    }
    const terminal = input.lane.diagnostics.readSnapshot();
    if (result.strictRuntimeSuccess && terminal.state !== 'succeeded') {
      throw new Error('PHASE_6_9_7_V8_RUNTIME_WIRE_MISMATCH');
    }
    return result;
  } catch (error) {
    await terminateActiveLane(input.lane, input.signal.aborted ? 'abort' : 'harness');
    throw error;
  }
}

async function ensureTerminalSnapshot(
  lane: LaneContext,
  executionOutcome: Phase697V8CaseEntry['executionOutcome'],
): Promise<Readonly<Phase697V8WireSnapshot>> {
  if (lane.diagnostics.readSnapshot().state === 'active') {
    const reason =
      executionOutcome === 'attempted_orphaned'
        ? lane.signal?.aborted
          ? 'abort'
          : 'timeout'
        : lane.signal?.aborted
          ? 'abort'
          : 'harness';
    await terminateActiveLane(lane, reason);
  }
  return lane.diagnostics.readSnapshot();
}

async function terminateActiveLane(
  lane: LaneContext,
  reason: 'abort' | 'timeout' | 'harness',
): Promise<void> {
  const snapshot = lane.diagnostics.readSnapshot();
  if (snapshot.state !== 'active') return;
  const category =
    reason === 'timeout'
      ? 'runtime_timeout'
      : reason === 'abort'
        ? snapshot.counters.providerDispatches === 1
          ? 'post_dispatch_abort'
          : 'pre_dispatch_abort'
        : 'harness_internal';
  await lane.diagnostics.terminateRuntime(category);
}

function requireLane(
  lanes: ReadonlyMap<string, LaneContext>,
  caseId: string,
  agent: Phase697V8Agent,
  pairedRunIndex: number,
): LaneContext {
  const lane = lanes.get(caseId);
  if (
    !lane ||
    lane.reservation.agent !== agent ||
    lane.reservation.pairedRunIndex !== pairedRunIndex
  ) {
    throw new Error('PHASE_6_9_7_V8_LANE_SCOPE_INVALID');
  }
  return lane;
}

function assertHarnessIdentity(harness: Phase697V8Harness): void {
  const valid =
    (harness.mode === 'mock' &&
      harness.provider === 'mock' &&
      harness.model === 'mock' &&
      harness.structuredOutputMode === 'mock_json_v8' &&
      harness.executorProvenance === 'mock_synthetic') ||
    (harness.mode === 'live' &&
      harness.provider === 'deepseek' &&
      harness.model === 'deepseek-v4-pro' &&
      harness.structuredOutputMode === 'deepseek_v4_pro_direct_json' &&
      (harness.executorProvenance === 'first_party_deepseek_v4_pro_direct' ||
        harness.executorProvenance === 'synthetic_test'));
  if (!valid) throw new Error('PHASE_6_9_7_V8_HARNESS_IDENTITY_INVALID');
}
