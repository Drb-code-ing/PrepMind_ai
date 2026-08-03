import {
  buildPhase697V4CaseEntry,
  buildPhase697TutorOrganizerV4Report,
  type Phase697V4CaseEntry,
  type Phase697TutorOrganizerV4Report,
} from './phase-6-9-tutor-wrong-question-v4-contract.ts';
import {
  runPhase697TutorOrganizerPairedEvalV3,
  type Phase697V3DispatchReservation,
  type Phase697V3RunnerLifecycle,
  type Phase697V3RunnerOptions,
} from './run-phase-6-9-tutor-wrong-question-v3-paired.ts';
import type { Phase697TutorOrganizerEvalHarness } from './run-phase-6-9-tutor-wrong-question-paired.ts';

export type Phase697V4RunnerOptions = Readonly<
  Pick<Phase697V3RunnerOptions, 'siblingSettlementTimeoutMs'> & {
    lifecycle?: Phase697V4RunnerLifecycle;
  }
>;

export type Phase697V4DispatchReservation = Readonly<{
  runId: string;
  agent: 'tutor' | 'wrong_question_organizer';
  pairedRunIndex: number;
  key: string;
}>;

export type Phase697V4RunnerLifecycle = Readonly<{
  recordGuardTerminal?(entry: Readonly<Phase697V4CaseEntry>): Promise<void>;
  recordDispatchStarted?(
    reservation: Readonly<Phase697V4DispatchReservation>,
    caseId: string,
  ): Promise<void>;
  recordRuntimeTerminal?(
    reservation: Readonly<Phase697V4DispatchReservation>,
    entry: Readonly<Phase697V4CaseEntry>,
  ): Promise<void>;
  recordPairTerminal?(pairedRunIndex: number, latencyMs: number | null): Promise<void>;
  recordBreakerOpened?(entry: Readonly<Phase697V4CaseEntry>): Promise<void>;
  recordRunCompleted?(report: Readonly<Phase697TutorOrganizerV4Report>): Promise<void>;
}>;

export async function runPhase697TutorOrganizerPairedEvalV4(
  harness: Phase697TutorOrganizerEvalHarness,
  options?: Phase697V4RunnerOptions,
): Promise<Phase697TutorOrganizerV4Report> {
  const v3Report = await runPhase697TutorOrganizerPairedEvalV3(harness, {
    ...(options?.siblingSettlementTimeoutMs === undefined
      ? {}
      : { siblingSettlementTimeoutMs: options.siblingSettlementTimeoutMs }),
    ...(options?.lifecycle === undefined ? {} : { lifecycle: adaptV4Lifecycle(options.lifecycle) }),
  });
  const report = buildPhase697TutorOrganizerV4Report(v3Report);
  if (report === null) throw new Error('PHASE_6_9_7_V4_REPORT_INVALID');
  return report;
}

function adaptV4Lifecycle(lifecycle: Phase697V4RunnerLifecycle): Phase697V3RunnerLifecycle {
  const toV4Entry = (
    entry: Parameters<NonNullable<Phase697V3RunnerLifecycle['recordGuardTerminal']>>[0],
  ) => {
    const projected = buildPhase697V4CaseEntry(entry);
    if (projected === null) throw new Error('PHASE_6_9_7_V4_CASE_ENTRY_INVALID');
    return projected;
  };
  return Object.freeze({
    async recordGuardTerminal(entry) {
      await lifecycle.recordGuardTerminal?.(toV4Entry(entry));
    },
    async recordDispatchStarted(reservation, caseId) {
      await lifecycle.recordDispatchStarted?.(asV4Reservation(reservation), caseId);
    },
    async recordRuntimeTerminal(reservation, entry) {
      await lifecycle.recordRuntimeTerminal?.(asV4Reservation(reservation), toV4Entry(entry));
    },
    async recordPairTerminal(pairedRunIndex, latencyMs) {
      await lifecycle.recordPairTerminal?.(pairedRunIndex, latencyMs);
    },
    async recordBreakerOpened(entry) {
      await lifecycle.recordBreakerOpened?.(toV4Entry(entry));
    },
    async recordRunCompleted(report) {
      const v4Report = buildPhase697TutorOrganizerV4Report(report);
      if (v4Report === null) throw new Error('PHASE_6_9_7_V4_REPORT_INVALID');
      await lifecycle.recordRunCompleted?.(v4Report);
    },
  });
}

function asV4Reservation(
  reservation: Readonly<Phase697V3DispatchReservation>,
): Readonly<Phase697V4DispatchReservation> {
  return Object.freeze({
    runId: reservation.runId,
    agent: reservation.agent,
    pairedRunIndex: reservation.pairedRunIndex,
    key: reservation.key,
  });
}
