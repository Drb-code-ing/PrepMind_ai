import type { Phase697V7WireCapability, Phase697V7WireStage } from '@repo/ai';

import {
  PHASE_6_9_7_FULL_GATE_SOURCE_HASHES,
  type Phase697FullGateCaseEntry,
} from './phase-6-9-tutor-organizer-full-gate-contract.ts';
import type {
  Phase697FullGateGuardCase,
  Phase697FullGateGuardResult,
  Phase697FullGateLaneIdentity,
  Phase697FullGateRuntimeResult,
} from './run-phase-6-9-tutor-organizer-full-gate.ts';
import { runPhase697TutorOrganizerFullGate } from './run-phase-6-9-tutor-organizer-full-gate.ts';
import type {
  Phase697V2OrganizerRuntimeCase,
  Phase697V2TutorRuntimeCase,
} from './phase-6-9-tutor-wrong-question-v2-cases.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_SCHEMA,
  type Phase697SchemaRecoverySource,
} from './phase-6-9-tutor-organizer-schema-recovery-authority.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA,
  type Phase697SchemaRecoverySr5Source,
} from './phase-6-9-tutor-organizer-schema-recovery-sr5-authority.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED,
  PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION,
  buildPhase697SchemaRecoveryReport,
  createPhase697SchemaRecoveryCaseEntry,
  type Phase697SchemaRecoveryCaseEntry,
  type Phase697SchemaRecoveryReport,
  type Phase697SchemaRecoverySchemaObservation,
} from './phase-6-9-tutor-organizer-schema-recovery-contract.ts';

export const PHASE_6_9_7_SCHEMA_RECOVERY_RUNNER_VERSION =
  'phase-6.9.7-tutor-organizer-schema-recovery-runner-v1' as const;

export type Phase697SchemaRecoveryRuntimeResult = Phase697FullGateRuntimeResult &
  Readonly<{
    schema: Phase697SchemaRecoverySchemaObservation;
  }>;

export type Phase697SchemaRecoveryHarness = Readonly<{
  mode: 'mock' | 'live';
  executorProvenance: 'deepseek_network' | 'mock_synthetic' | 'synthetic_test';
  runGuard(entry: Phase697FullGateGuardCase): Promise<Phase697FullGateGuardResult>;
  runTutor(
    entry: Phase697V2TutorRuntimeCase,
    signal: AbortSignal,
    wireCapability: Phase697V7WireCapability,
  ): Promise<Phase697SchemaRecoveryRuntimeResult>;
  runOrganizer(
    entry: Phase697V2OrganizerRuntimeCase,
    signal: AbortSignal,
    wireCapability: Phase697V7WireCapability,
  ): Promise<Phase697SchemaRecoveryRuntimeResult>;
}>;

export type Phase697SchemaRecoverySchemaStageEvent =
  | Readonly<{ event: 'started'; observation: null }>
  | Readonly<{
      event: 'succeeded' | 'failed';
      observation: Phase697SchemaRecoverySchemaObservation;
    }>;

export type Phase697SchemaRecoveryLifecycle = Readonly<{
  appendGuardTerminal(entry: Phase697SchemaRecoveryCaseEntry): Promise<void>;
  reserveLane(identity: Phase697FullGateLaneIdentity): Promise<
    Readonly<{
      appendWireStage(stage: Phase697V7WireStage): Promise<void>;
      appendSchemaStage(event: Phase697SchemaRecoverySchemaStageEvent): Promise<void>;
    }>
  >;
  appendLaneTerminal(
    identity: Phase697FullGateLaneIdentity,
    entry: Phase697SchemaRecoveryCaseEntry,
  ): Promise<void>;
  appendLaneNotStarted(entry: Phase697SchemaRecoveryCaseEntry): Promise<void>;
  appendPairTerminal(pairedRunIndex: number): Promise<void>;
  appendRunTerminal(report: Phase697SchemaRecoveryReport): Promise<void>;
}>;

export type RunPhase697SchemaRecoveryInput = Readonly<{
  runId: string;
  runScope: 'branch' | 'main';
  source: Phase697SchemaRecoverySource | Phase697SchemaRecoverySr5Source;
  harness: Phase697SchemaRecoveryHarness;
  lifecycle: Phase697SchemaRecoveryLifecycle;
  signal: AbortSignal;
}>;

/**
 * Schema Recovery owns its evidence and schema-stage lifecycle while reusing
 * the already-frozen F2 scheduler/metric kernel as a non-persisted calculator.
 */
export async function runPhase697TutorOrganizerSchemaRecovery(
  input: RunPhase697SchemaRecoveryInput,
): Promise<Readonly<Phase697SchemaRecoveryReport>> {
  const source = PHASE_6_9_7_SCHEMA_RECOVERY_SOURCE_SCHEMA.or(
    PHASE_6_9_7_SCHEMA_RECOVERY_SR5_SOURCE_SCHEMA,
  ).parse(input.source);
  if (input.signal === null || typeof input.signal !== 'object') {
    throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_RUNNER_INPUT_INVALID');
  }

  const schemas = new Map<string, Phase697SchemaRecoverySchemaObservation>();
  const lanes = new Map<
    string,
    Readonly<{
      appendWireStage(stage: Phase697V7WireStage): Promise<void>;
      appendSchemaStage(event: Phase697SchemaRecoverySchemaStageEvent): Promise<void>;
    }>
  >();
  const schemaStates = new Map<
    string,
    { started: boolean; terminal: boolean; closed: boolean; durabilityFailed: boolean }
  >();

  const ensureStarted = async (identity: Phase697FullGateLaneIdentity) => {
    const lane = lanes.get(identity.caseId);
    const state = schemaStates.get(identity.caseId);
    if (!lane || !state) throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_LANE_NOT_RESERVED');
    if (state.durabilityFailed) {
      throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_DURABILITY_FAILED');
    }
    if (!state.started) {
      try {
        await lane.appendSchemaStage({ event: 'started', observation: null });
      } catch {
        state.durabilityFailed = true;
        throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_DURABILITY_FAILED');
      }
      state.started = true;
    }
    return { lane, state };
  };

  const appendSchemaTerminal = async (
    identity: Phase697FullGateLaneIdentity,
    observation: Phase697SchemaRecoverySchemaObservation,
  ) => {
    const { lane, state } = await ensureStarted(identity);
    if (state.closed || state.terminal) return;
    const schema = PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse(observation);
    const event = ['canonical', 'extension_fields_discarded'].includes(schema.outcome)
      ? ('succeeded' as const)
      : ('failed' as const);
    try {
      await lane.appendSchemaStage({ event, observation: schema });
    } catch {
      state.durabilityFailed = true;
      throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_DURABILITY_FAILED');
    }
    state.terminal = true;
    schemas.set(identity.caseId, schema);
  };

  const wrapRuntime =
    <T extends Phase697V2TutorRuntimeCase | Phase697V2OrganizerRuntimeCase>(
      delegate: (
        entry: T,
        signal: AbortSignal,
        capability: Phase697V7WireCapability,
      ) => Promise<Phase697SchemaRecoveryRuntimeResult>,
    ) =>
    async (
      entry: T,
      signal: AbortSignal,
      capability: Phase697V7WireCapability,
    ): Promise<Phase697FullGateRuntimeResult> => {
      const identity = runtimeIdentity(entry);
      await ensureStarted(identity);
      let result: Phase697SchemaRecoveryRuntimeResult;
      let schema: Phase697SchemaRecoverySchemaObservation;
      try {
        result = await delegate(entry, signal, capability);
        schema = PHASE_6_9_7_SCHEMA_RECOVERY_SCHEMA_OBSERVATION.parse(result.schema);
      } catch (error) {
        await appendSchemaTerminal(identity, PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED);
        throw error;
      }
      // Durability failures are intentionally outside the harness catch. A
      // terminal append that may already be fsynced must never be retried as a
      // different schema outcome in the same process.
      await appendSchemaTerminal(identity, schema);
      return stripSchemaObservation(result);
    };

  const baseReport = await runPhase697TutorOrganizerFullGate({
    runId: input.runId,
    runScope: input.runScope,
    approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
    sourceHashes: PHASE_6_9_7_FULL_GATE_SOURCE_HASHES,
    harness: Object.freeze({
      mode: input.harness.mode,
      executorProvenance: input.harness.executorProvenance,
      runGuard: input.harness.runGuard,
      runTutor: wrapRuntime(input.harness.runTutor),
      runOrganizer: wrapRuntime(input.harness.runOrganizer),
    }),
    lifecycle: Object.freeze({
      async appendGuardTerminal(entry: Phase697FullGateCaseEntry) {
        await input.lifecycle.appendGuardTerminal(
          createPhase697SchemaRecoveryCaseEntry(entry, PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED),
        );
      },
      async reserveLane(identity: Phase697FullGateLaneIdentity) {
        const lane = await input.lifecycle.reserveLane(identity);
        lanes.set(identity.caseId, lane);
        schemaStates.set(identity.caseId, {
          started: false,
          terminal: false,
          closed: false,
          durabilityFailed: false,
        });
        // F2 is only the scheduling/metric calculator. Schema stages stay on
        // this recovery wrapper's private lifecycle and are never exposed to
        // the legacy F2 runner or persisted in its lineage.
        return Object.freeze({ appendWireStage: lane.appendWireStage });
      },
      async appendLaneTerminal(
        identity: Phase697FullGateLaneIdentity,
        entry: Phase697FullGateCaseEntry,
      ) {
        const state = schemaStates.get(identity.caseId);
        if (!state) throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_LANE_NOT_RESERVED');
        if (state.durabilityFailed) {
          throw new Error('PHASE_6_9_7_SCHEMA_RECOVERY_DURABILITY_FAILED');
        }
        if (!state.terminal) {
          await appendSchemaTerminal(identity, PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED);
        }
        const schema = schemas.get(identity.caseId) ?? PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED;
        await input.lifecycle.appendLaneTerminal(
          identity,
          createPhase697SchemaRecoveryCaseEntry(entry, schema),
        );
        state.closed = true;
      },
      async appendLaneNotStarted(entry: Phase697FullGateCaseEntry) {
        await input.lifecycle.appendLaneNotStarted(
          createPhase697SchemaRecoveryCaseEntry(entry, PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED),
        );
      },
      appendPairTerminal: input.lifecycle.appendPairTerminal,
      async appendRunTerminal() {
        // The legacy calculator report is deliberately not persisted.
      },
    }),
    signal: input.signal,
  });

  const report = buildPhase697SchemaRecoveryReport({
    runId: input.runId,
    runScope: input.runScope,
    mode: input.harness.mode,
    executorProvenance: input.harness.executorProvenance,
    approvedRunnableSourceCommit: source.approvedRunnableSourceCommit,
    caseEntries: baseReport.caseEntries.map((entry) =>
      createPhase697SchemaRecoveryCaseEntry(
        entry,
        schemas.get(entry.caseId) ?? PHASE_6_9_7_SCHEMA_RECOVERY_NOT_OBSERVED,
      ),
    ),
  });
  await input.lifecycle.appendRunTerminal(report);
  return report;
}

function runtimeIdentity(
  entry: Phase697V2TutorRuntimeCase | Phase697V2OrganizerRuntimeCase,
): Phase697FullGateLaneIdentity {
  return {
    caseId: entry.id,
    agent: entry.agent,
    pairedRunIndex: entry.pairedRunIndex,
  };
}

function stripSchemaObservation(
  result: Phase697SchemaRecoveryRuntimeResult,
): Phase697FullGateRuntimeResult {
  return Object.freeze({
    disposition: result.disposition,
    failureCategory: result.failureCategory,
    strictRuntimeSuccess: result.strictRuntimeSuccess,
    durationMs: result.durationMs,
    orchestrationDurationMs: result.orchestrationDurationMs,
    usage: result.usage,
    semantic: result.semantic,
    safety: result.safety,
  });
}
