import {
  phase697V6DispatchKeySha256,
  projectPhase697V6TerminalEntry,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-durability-contract.ts';
import { sha256Phase697V6Stable } from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import type { Phase697V6RunnerLifecycle } from '../src/evals/run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import type { Phase697V6JournalWriter } from './phase-6-9-7-tutor-wrong-question-v6-durability.ts';

export function createPhase697V6JournalLifecycle(
  writer: Phase697V6JournalWriter,
  runId: string,
): Phase697V6RunnerLifecycle {
  return Object.freeze({
    async recordGuardTerminal(entry) {
      const terminal = projectPhase697V6TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V6_GUARD_PROJECTION_INVALID');
      await writer.append({ kind: 'guard_terminal', terminal });
    },
    async recordDispatchStarted(reservation, caseId) {
      await writer.append({
        kind: 'dispatch_started',
        caseId,
        agent: reservation.agent,
        pairedRunIndex: reservation.pairedRunIndex,
        dispatchKeySha256: phase697V6DispatchKeySha256({
          runId,
          agent: reservation.agent,
          pairedRunIndex: reservation.pairedRunIndex,
        }),
      });
    },
    async recordRuntimeTerminal(reservation, entry) {
      const terminal = projectPhase697V6TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V6_RUNTIME_PROJECTION_INVALID');
      await writer.append({
        kind: 'runtime_terminal',
        dispatchKeySha256: phase697V6DispatchKeySha256({
          runId,
          agent: reservation.agent,
          pairedRunIndex: reservation.pairedRunIndex,
        }),
        terminal,
      });
    },
    async recordPairTerminal(pairedRunIndex, durationEvidence) {
      await writer.append({
        kind: 'pair_terminal',
        pairedRunIndex,
        pairedDurationEvidence: durationEvidence,
      });
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
        throw new Error('PHASE_6_9_7_V6_LIVE_JOURNAL_MOCK_GATE_REJECTED');
      }
      await writer.append({
        kind: 'run_completed',
        reportSha256: sha256Phase697V6Stable(report),
        gate: report.gate,
      });
    },
  });
}
