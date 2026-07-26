import {
  phase697V5DispatchKeySha256,
  projectPhase697V5TerminalEntry,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-durability-contract.ts';
import { sha256Phase697V5Stable } from '../src/evals/phase-6-9-tutor-wrong-question-v5-contract.ts';
import type { Phase697V5RunnerLifecycle } from '../src/evals/run-phase-6-9-tutor-wrong-question-v5-paired.ts';
import type { Phase697V5JournalWriter } from './phase-6-9-7-tutor-wrong-question-v5-durability.ts';

export function createPhase697V5JournalLifecycle(
  writer: Phase697V5JournalWriter,
  runId: string,
): Phase697V5RunnerLifecycle {
  return Object.freeze({
    async recordGuardTerminal(entry) {
      const terminal = projectPhase697V5TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V5_GUARD_PROJECTION_INVALID');
      await writer.append({ kind: 'guard_terminal', terminal });
    },
    async recordDispatchStarted(reservation, caseId) {
      await writer.append({
        kind: 'dispatch_started',
        caseId,
        agent: reservation.agent,
        pairedRunIndex: reservation.pairedRunIndex,
        dispatchKeySha256: phase697V5DispatchKeySha256({
          runId,
          agent: reservation.agent,
          pairedRunIndex: reservation.pairedRunIndex,
        }),
      });
    },
    async recordRuntimeTerminal(reservation, entry) {
      const terminal = projectPhase697V5TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V5_RUNTIME_PROJECTION_INVALID');
      await writer.append({
        kind: 'runtime_terminal',
        dispatchKeySha256: phase697V5DispatchKeySha256({
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
      if (report.gate === 'mock_quality_not_evidence') {
        throw new Error('PHASE_6_9_7_V5_LIVE_JOURNAL_MOCK_GATE_REJECTED');
      }
      await writer.append({
        kind: 'run_completed',
        reportSha256: sha256Phase697V5Stable(report),
        gate: report.gate,
      });
    },
  });
}
