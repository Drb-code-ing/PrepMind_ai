import {
  phase697V4DispatchKeySha256,
  projectPhase697V4TerminalEntry,
} from '../src/evals/phase-6-9-tutor-wrong-question-v4-durability-contract.ts';
import { sha256Phase697V4Stable } from '../src/evals/phase-6-9-tutor-wrong-question-v4-contract.ts';
import type { Phase697V4RunnerLifecycle } from '../src/evals/run-phase-6-9-tutor-wrong-question-v4-paired.ts';
import type { Phase697V4JournalWriter } from './phase-6-9-7-tutor-wrong-question-v4-durability.ts';

export function createPhase697V4JournalLifecycle(
  writer: Phase697V4JournalWriter,
  runId: string,
): Phase697V4RunnerLifecycle {
  return Object.freeze({
    async recordGuardTerminal(entry) {
      const terminal = projectPhase697V4TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V4_GUARD_PROJECTION_INVALID');
      await writer.append({ kind: 'guard_terminal', terminal });
    },
    async recordDispatchStarted(reservation, caseId) {
      await writer.append({
        kind: 'dispatch_started',
        caseId,
        agent: reservation.agent,
        pairedRunIndex: reservation.pairedRunIndex,
        dispatchKeySha256: phase697V4DispatchKeySha256({
          runId,
          agent: reservation.agent,
          pairedRunIndex: reservation.pairedRunIndex,
        }),
      });
    },
    async recordRuntimeTerminal(reservation, entry) {
      const terminal = projectPhase697V4TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V4_RUNTIME_PROJECTION_INVALID');
      await writer.append({
        kind: 'runtime_terminal',
        dispatchKeySha256: phase697V4DispatchKeySha256({
          runId,
          agent: reservation.agent,
          pairedRunIndex: reservation.pairedRunIndex,
        }),
        terminal,
      });
    },
    async recordPairTerminal(pairedRunIndex, latencyMs) {
      await writer.append({ kind: 'pair_terminal', pairedRunIndex, pairedLatencyMs: latencyMs });
    },
    async recordBreakerOpened(entry) {
      await writer.append({
        kind: 'breaker_opened',
        breakerState:
          entry.executionKind === 'zero_call' ? 'guard_failed' : 'quality_gate_impossible',
        triggerCaseId: entry.caseId,
        triggerAgent: entry.agent,
        triggerPairedRunIndex: entry.executionKind === 'runtime' ? entry.pairedRunIndex : null,
      });
    },
    async recordRunCompleted(report) {
      await writer.append({
        kind: 'run_completed',
        reportSha256: sha256Phase697V4Stable(report),
        gate: report.gate,
      });
    },
  });
}
