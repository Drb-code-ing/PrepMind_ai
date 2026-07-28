import { sha256Phase697V8Stable } from '../src/evals/phase-6-9-tutor-wrong-question-v8-contract.ts';
import { projectPhase697V8TerminalEntry } from '../src/evals/phase-6-9-tutor-wrong-question-v8-durability-contract.ts';
import type { Phase697V8RunnerLifecycle } from '../src/evals/run-phase-6-9-tutor-wrong-question-v8-paired.ts';
import type { Phase697V8JournalWriter } from './phase-6-9-7-tutor-wrong-question-v8-durability.ts';

export function createPhase697V8JournalLifecycle(
  writer: Phase697V8JournalWriter,
): Phase697V8RunnerLifecycle {
  return Object.freeze({
    async recordGuardTerminal(entry) {
      const terminal = projectPhase697V8TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V8_GUARD_PROJECTION_INVALID');
      await writer.append({ kind: 'guard_terminal', terminal });
    },
    async recordLaneReserved(reservation) {
      await writer.append({
        kind: 'lane_reserved',
        caseId: reservation.caseId,
        agent: reservation.agent,
        pairedRunIndex: reservation.pairedRunIndex,
        dispatchKeySha256: reservation.dispatchKeySha256,
        wireCapabilityVersion: 'phase-6.9.7-v7-wire-capability-v1',
      });
    },
    async recordWireStage(reservation, stage) {
      await writer.append({
        kind: 'wire_stage',
        dispatchKeySha256: reservation.dispatchKeySha256,
        stage,
      });
    },
    async recordRuntimeTerminal(reservation, entry) {
      const terminal = projectPhase697V8TerminalEntry(entry);
      if (!terminal) throw new Error('PHASE_6_9_7_V8_RUNTIME_PROJECTION_INVALID');
      await writer.append({
        kind: 'runtime_terminal',
        dispatchKeySha256: reservation.dispatchKeySha256,
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
        throw new Error('PHASE_6_9_7_V8_LIVE_JOURNAL_MOCK_GATE_REJECTED');
      }
      await writer.append({
        kind: 'run_completed',
        reportSha256: sha256Phase697V8Stable(report),
        gate: report.gate,
      });
    },
  });
}
