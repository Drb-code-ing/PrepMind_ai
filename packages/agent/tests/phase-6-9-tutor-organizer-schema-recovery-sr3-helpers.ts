import type { Phase697V7WireStage } from '@repo/ai';

import {
  createF2SuccessHarness,
  type createF2MemoryLifecycle,
} from './phase-6-9-tutor-organizer-full-gate-f2-helpers.ts';
import { createPhase697SchemaRecoverySyntheticSourceForTest } from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-authority.ts';
import {
  type Phase697SchemaRecoveryCaseEntry,
  type Phase697SchemaRecoveryReport,
  type Phase697SchemaRecoverySchemaObservation,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-contract.ts';
import { reservePhase697SchemaRecoverySyntheticAttemptForTest } from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-durability.ts';
import type {
  Phase697SchemaRecoveryHarness,
  Phase697SchemaRecoveryLifecycle,
  Phase697SchemaRecoveryRuntimeResult,
  Phase697SchemaRecoverySchemaStageEvent,
} from '../src/evals/run-phase-6-9-tutor-organizer-schema-recovery.ts';

export const SR3_RUN_ID = '00000000-0000-4000-8000-000000000973';
export const SR3_CREATED_AT = '2026-08-02T08:00:00.000Z';
export const SR3_CANONICAL_SCHEMA = Object.freeze({
  outcome: 'canonical' as const,
  diagnostic: null,
});

export function createSr3Source() {
  return createPhase697SchemaRecoverySyntheticSourceForTest();
}

export function reserveSr3SyntheticAttempt(root: string, runId = SR3_RUN_ID) {
  return reservePhase697SchemaRecoverySyntheticAttemptForTest({
    root,
    runId,
    runScope: 'branch',
    mode: 'live',
    executorProvenance: 'synthetic_test',
    createdAt: SR3_CREATED_AT,
    source: createSr3Source(),
  });
}

export function createSr3SuccessHarness(
  mutate?: (
    caseId: string,
    result: Phase697SchemaRecoveryRuntimeResult,
  ) => Phase697SchemaRecoveryRuntimeResult,
): Phase697SchemaRecoveryHarness {
  const base = createF2SuccessHarness();
  const run = async (
    caseId: string,
    invoke: () => Promise<Awaited<ReturnType<typeof base.runTutor>>>,
  ) => {
    const result: Phase697SchemaRecoveryRuntimeResult = Object.freeze({
      ...(await invoke()),
      schema: SR3_CANONICAL_SCHEMA,
    });
    return mutate?.(caseId, result) ?? result;
  };
  return Object.freeze({
    mode: base.mode,
    executorProvenance: base.executorProvenance,
    runGuard: base.runGuard,
    runTutor: (entry, signal, capability) =>
      run(entry.id, () => base.runTutor(entry, signal, capability)),
    runOrganizer: (entry, signal, capability) =>
      run(entry.id, () => base.runOrganizer(entry, signal, capability)),
  });
}

export function createSr3MemoryLifecycle() {
  const trace: string[] = [];
  const entries = new Map<string, Phase697SchemaRecoveryCaseEntry>();
  const wire = new Map<string, Phase697V7WireStage[]>();
  const schema = new Map<string, Phase697SchemaRecoverySchemaStageEvent[]>();
  let report: Phase697SchemaRecoveryReport | null = null;
  const lifecycle: Phase697SchemaRecoveryLifecycle = Object.freeze({
    async appendGuardTerminal(entry) {
      trace.push(`guard:${entry.base.caseId}`);
      entries.set(entry.base.caseId, entry);
    },
    async reserveLane(identity) {
      trace.push(`reserve:${identity.caseId}`);
      wire.set(identity.caseId, []);
      schema.set(identity.caseId, []);
      return Object.freeze({
        async appendWireStage(stage: Phase697V7WireStage) {
          trace.push(`wire:${identity.caseId}:${stage}`);
          wire.get(identity.caseId)?.push(stage);
        },
        async appendSchemaStage(event: Phase697SchemaRecoverySchemaStageEvent) {
          trace.push(`schema:${identity.caseId}:${event.event}`);
          schema.get(identity.caseId)?.push(event);
        },
      });
    },
    async appendLaneTerminal(identity, entry) {
      trace.push(`terminal:${identity.caseId}`);
      entries.set(identity.caseId, entry);
    },
    async appendLaneNotStarted(entry) {
      trace.push(`not-started:${entry.base.caseId}`);
      entries.set(entry.base.caseId, entry);
    },
    async appendPairTerminal(pairedRunIndex) {
      trace.push(`pair:${pairedRunIndex}`);
    },
    async appendRunTerminal(value) {
      trace.push(`run:${value.gate}`);
      report = value;
    },
  });
  return {
    lifecycle,
    trace,
    entries,
    wire,
    schema,
    report: () => report,
  };
}

export function schemaObservation(
  outcome: Phase697SchemaRecoverySchemaObservation['outcome'],
  diagnostic: Phase697SchemaRecoverySchemaObservation['diagnostic'] = null,
) {
  return Object.freeze({ outcome, diagnostic });
}

export type F2MemoryLifecycle = ReturnType<typeof createF2MemoryLifecycle>;
