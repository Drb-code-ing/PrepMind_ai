import {
  createPhase697V7WireDiagnostics,
  type Phase697V7WireCapability,
  type Phase697V7WireDiagnostics,
  type Phase697V7WireSnapshot,
  type Phase697V7WireStage,
} from '@repo/ai';

import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  buildPhase697TutorOrganizerV7Report,
  buildPhase697V7CaseEntry,
  phase697V7DispatchKeySha256,
  sha256Phase697V7Stable,
  type Phase697TutorOrganizerV7Report,
  type Phase697V7CaseEntry,
} from './phase-6-9-tutor-wrong-question-v7-contract.ts';
import type { Phase697V6DurationEvidence } from './phase-6-9-tutor-wrong-question-v6-deadline.ts';
import {
  runPhase697TutorOrganizerPairedEvalV6,
  type Phase697V6Harness,
  type Phase697V6RunnerLifecycle,
  type Phase697V6RuntimeResult,
} from './run-phase-6-9-tutor-wrong-question-v6-paired.ts';

type Phase697V7Agent = 'tutor' | 'wrong_question_organizer';

export type Phase697V7Harness = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  mode: 'mock' | 'live';
  provider: 'mock' | 'deepseek';
  model: 'mock' | 'deepseek-v4-pro';
  structuredOutputMode: 'mock_json_v7' | 'deepseek_v4_pro_direct_json';
  executorProvenance: 'mock_synthetic' | 'first_party_deepseek_v4_pro_direct' | 'synthetic_test';
  runZeroCall: Phase697V6Harness['runZeroCall'];
  runTutor(
    entry: Phase697V2TutorRuntimeCase,
    signal: AbortSignal,
    wireCapability: Phase697V7WireCapability,
  ): Promise<Phase697V6RuntimeResult>;
  runOrganizer(
    entry: Phase697V2OrganizerRuntimeCase,
    signal: AbortSignal,
    wireCapability: Phase697V7WireCapability,
  ): Promise<Phase697V6RuntimeResult>;
}>;

export type Phase697V7LaneReservation = Readonly<{
  runId: string;
  caseId: string;
  agent: Phase697V7Agent;
  pairedRunIndex: number;
  dispatchKeySha256: `sha256:${string}`;
}>;

export type Phase697V7RunnerLifecycle = Readonly<{
  recordGuardTerminal?(entry: Readonly<Phase697V7CaseEntry>): Promise<void>;
  recordLaneReserved?(reservation: Readonly<Phase697V7LaneReservation>): Promise<void>;
  recordWireStage?(
    reservation: Readonly<Phase697V7LaneReservation>,
    stage: Phase697V7WireStage,
  ): Promise<void>;
  recordRuntimeTerminal?(
    reservation: Readonly<Phase697V7LaneReservation>,
    entry: Readonly<Phase697V7CaseEntry>,
  ): Promise<void>;
  recordPairTerminal?(
    pairedRunIndex: number,
    durationEvidence: Phase697V6DurationEvidence | null,
  ): Promise<void>;
  recordBreakerOpened?(entry: Readonly<Phase697V7CaseEntry>): Promise<void>;
  recordRunCompleted?(report: Readonly<Phase697TutorOrganizerV7Report>): Promise<void>;
}>;

export type Phase697V7RunnerOptions = Readonly<{
  siblingSettlementTimeoutMs?: number;
  monotonicClock?: () => number;
  lifecycle?: Phase697V7RunnerLifecycle;
}>;

type LaneContext = {
  reservation: Phase697V7LaneReservation;
  diagnostics: Phase697V7WireDiagnostics;
  signal: AbortSignal | null;
};

export async function runPhase697TutorOrganizerPairedEvalV7(
  harness: Phase697V7Harness,
  options?: Phase697V7RunnerOptions,
): Promise<Readonly<Phase697TutorOrganizerV7Report>> {
  assertHarnessIdentity(harness);
  const lanes = new Map<string, LaneContext>();
  const wireSnapshots = new Map<string, Readonly<Phase697V7WireSnapshot>>();
  const terminalEntries = new Map<string, Readonly<Phase697V7CaseEntry>>();
  let completedReport: Readonly<Phase697TutorOrganizerV7Report> | null = null;

  const v6Lifecycle: Phase697V6RunnerLifecycle = Object.freeze({
    async recordGuardTerminal(entry) {
      const terminal = buildPhase697V7CaseEntry(entry, null);
      terminalEntries.set(terminal.caseId, terminal);
      await options?.lifecycle?.recordGuardTerminal?.(terminal);
    },
    async recordDispatchStarted(reservation, caseId) {
      if (lanes.has(caseId)) throw new Error('PHASE_6_9_7_V7_DUPLICATE_LANE_RESERVATION');
      const dispatchKeySha256 = phase697V7DispatchKeySha256({
        runId: harness.runId,
        agent: reservation.agent,
        pairedRunIndex: reservation.pairedRunIndex,
      });
      if (dispatchKeySha256 === null) {
        throw new Error('PHASE_6_9_7_V7_LANE_RESERVATION_INVALID');
      }
      const v7Reservation: Phase697V7LaneReservation = Object.freeze({
        runId: harness.runId,
        caseId,
        agent: reservation.agent,
        pairedRunIndex: reservation.pairedRunIndex,
        dispatchKeySha256,
      });
      await options?.lifecycle?.recordLaneReserved?.(v7Reservation);
      const diagnostics = createPhase697V7WireDiagnostics({
        appendStage: (stage) => options?.lifecycle?.recordWireStage?.(v7Reservation, stage),
      });
      lanes.set(caseId, { reservation: v7Reservation, diagnostics, signal: null });
    },
    async recordRuntimeTerminal(reservation, entry) {
      const lane = requireLane(lanes, entry.caseId, reservation.agent, reservation.pairedRunIndex);
      const snapshot = await ensureTerminalSnapshot(lane, entry.executionOutcome);
      wireSnapshots.set(entry.caseId, snapshot);
      const terminal = buildPhase697V7CaseEntry(entry, snapshot);
      terminalEntries.set(entry.caseId, terminal);
      await options?.lifecycle?.recordRuntimeTerminal?.(lane.reservation, terminal);
    },
    recordPairTerminal: (pairedRunIndex, durationEvidence) =>
      options?.lifecycle?.recordPairTerminal?.(pairedRunIndex, durationEvidence) ??
      Promise.resolve(),
    async recordBreakerOpened(entry) {
      const terminal = terminalEntries.get(entry.caseId);
      if (!terminal) throw new Error('PHASE_6_9_7_V7_BREAKER_TRIGGER_MISSING');
      await options?.lifecycle?.recordBreakerOpened?.(terminal);
    },
    async recordRunCompleted(v6Report) {
      const report = buildPhase697TutorOrganizerV7Report({
        v6Report,
        wireSnapshots,
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
          operation: (capability) => harness.runOrganizer(entry, signal, capability),
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

  const rebuilt = buildPhase697TutorOrganizerV7Report({
    v6Report,
    wireSnapshots,
    executorProvenance: harness.executorProvenance,
  });
  if (
    completedReport === null ||
    sha256Phase697V7Stable(completedReport) !== sha256Phase697V7Stable(rebuilt)
  ) {
    throw new Error('PHASE_6_9_7_V7_RUN_COMPLETION_DRIFT');
  }
  return completedReport;
}

async function runLane(input: {
  lane: LaneContext;
  signal: AbortSignal;
  operation: (capability: Phase697V7WireCapability) => Promise<Phase697V6RuntimeResult>;
}): Promise<Phase697V6RuntimeResult> {
  if (input.lane.signal !== null) throw new Error('PHASE_6_9_7_V7_DUPLICATE_LANE_ENTRY');
  input.lane.signal = input.signal;
  try {
    const result = await input.operation(input.lane.diagnostics.capability);
    const snapshot = input.lane.diagnostics.readSnapshot();
    if (snapshot.state === 'active') {
      await terminateActiveLane(input.lane, input.signal.aborted ? 'abort' : 'harness');
    }
    const terminal = input.lane.diagnostics.readSnapshot();
    if (result.strictRuntimeSuccess && terminal.state !== 'succeeded') {
      throw new Error('PHASE_6_9_7_V7_RUNTIME_WIRE_MISMATCH');
    }
    return result;
  } catch (error) {
    await terminateActiveLane(input.lane, input.signal.aborted ? 'abort' : 'harness');
    throw error;
  }
}

async function ensureTerminalSnapshot(
  lane: LaneContext,
  executionOutcome: Phase697V7CaseEntry['executionOutcome'],
): Promise<Readonly<Phase697V7WireSnapshot>> {
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
  agent: Phase697V7Agent,
  pairedRunIndex: number,
): LaneContext {
  const lane = lanes.get(caseId);
  if (
    !lane ||
    lane.reservation.agent !== agent ||
    lane.reservation.pairedRunIndex !== pairedRunIndex
  ) {
    throw new Error('PHASE_6_9_7_V7_LANE_SCOPE_INVALID');
  }
  return lane;
}

function assertHarnessIdentity(harness: Phase697V7Harness): void {
  const valid =
    (harness.mode === 'mock' &&
      harness.provider === 'mock' &&
      harness.model === 'mock' &&
      harness.structuredOutputMode === 'mock_json_v7' &&
      harness.executorProvenance === 'mock_synthetic') ||
    (harness.mode === 'live' &&
      harness.provider === 'deepseek' &&
      harness.model === 'deepseek-v4-pro' &&
      harness.structuredOutputMode === 'deepseek_v4_pro_direct_json' &&
      (harness.executorProvenance === 'first_party_deepseek_v4_pro_direct' ||
        harness.executorProvenance === 'synthetic_test'));
  if (!valid) throw new Error('PHASE_6_9_7_V7_HARNESS_IDENTITY_INVALID');
}
