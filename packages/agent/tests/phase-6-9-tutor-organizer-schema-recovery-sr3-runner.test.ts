import { describe, expect, test } from 'bun:test';

import {
  parseTutorSchemaRecoveryProviderContent,
  type TutorSchemaRecoveryBoundedDiagnostic,
} from '../src/model-candidates/tutor-schema-recovery-contract.ts';
import {
  PHASE_6_9_7_SCHEMA_RECOVERY_CHECKPOINT_AUTHORITY,
  PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_SCHEMA,
  parsePhase697SchemaRecoveryReport,
} from '../src/evals/phase-6-9-tutor-organizer-schema-recovery-contract.ts';
import { runPhase697TutorOrganizerSchemaRecovery } from '../src/evals/run-phase-6-9-tutor-organizer-schema-recovery.ts';
import { F2_SAFE } from './phase-6-9-tutor-organizer-full-gate-f2-helpers.ts';
import {
  SR3_CANONICAL_SCHEMA,
  SR3_RUN_ID,
  createSr3MemoryLifecycle,
  createSr3Source,
  createSr3SuccessHarness,
  schemaObservation,
} from './phase-6-9-tutor-organizer-schema-recovery-sr3-helpers.ts';

describe('Phase 6.9.7 Schema Recovery SR3 runner and report', () => {
  test('keeps 72/24/48/24/32, runs guards first, and persists bounded schema stages', async () => {
    const memory = createSr3MemoryLifecycle();
    const report = await runPhase697TutorOrganizerSchemaRecovery({
      runId: SR3_RUN_ID,
      runScope: 'branch',
      source: createSr3Source(),
      harness: createSr3SuccessHarness(),
      lifecycle: memory.lifecycle,
      signal: new AbortController().signal,
    });

    expect(report.counts).toEqual({
      cases: 72,
      guards: 24,
      runtimePairs: 24,
      runtimeLanes: 48,
      organizerDecisionUnits: 32,
    });
    expect(report.schemaAccounting).toEqual({
      complete: true,
      canonical: 48,
      extensionFieldsDiscarded: 0,
      rejected: 0,
      notObserved: 0,
    });
    expect(report.checkpointAuthority).toBe(PHASE_6_9_7_SCHEMA_RECOVERY_CHECKPOINT_AUTHORITY);
    expect(report.qualityAuthority).toBe('none');
    expect(report.caseEntries).toHaveLength(72);
    expect(PHASE_6_9_7_SCHEMA_RECOVERY_REPORT_SCHEMA.safeParse(report).success).toBe(true);
    expect(parsePhase697SchemaRecoveryReport(JSON.parse(JSON.stringify(report)))).toEqual(report);
    expect(memory.report()).toEqual(report);
    expect(memory.trace.slice(0, 24).every((event) => event.startsWith('guard:'))).toBe(true);
    expect(memory.trace[24]).toBe('reserve:tutor-v2-runtime-01');
    for (const events of memory.schema.values()) {
      expect(events.map((event) => event.event)).toEqual(['started', 'succeeded']);
    }
  });

  test('counts extension discard without granting authority or retaining raw content', async () => {
    const diagnostic = requireDiagnostic('{"explanation":"private","intentIndex":0}');
    const memory = createSr3MemoryLifecycle();
    const report = await runPhase697TutorOrganizerSchemaRecovery({
      runId: '00000000-0000-4000-8000-000000000974',
      runScope: 'branch',
      source: createSr3Source(),
      harness: createSr3SuccessHarness((caseId, result) =>
        caseId === 'tutor-v2-runtime-01'
          ? Object.freeze({
              ...result,
              schema: schemaObservation('extension_fields_discarded', diagnostic),
            })
          : result,
      ),
      lifecycle: memory.lifecycle,
      signal: new AbortController().signal,
    });

    expect(report.schemaAccounting).toMatchObject({
      complete: true,
      canonical: 47,
      extensionFieldsDiscarded: 1,
      rejected: 0,
      notObserved: 0,
    });
    expect(report.qualityAuthority).toBe('none');
    expect(JSON.stringify(report)).not.toContain('private');
  });

  test('closes the sibling, opens the breaker, and nulls aggregates after a rejected schema', async () => {
    const diagnostic = requireRejectedDiagnostic('{"intentIndex":0,"intentIndex":1}');
    const memory = createSr3MemoryLifecycle();
    const report = await runPhase697TutorOrganizerSchemaRecovery({
      runId: '00000000-0000-4000-8000-000000000975',
      runScope: 'branch',
      source: createSr3Source(),
      harness: createSr3SuccessHarness((caseId, result) =>
        caseId === 'tutor-v2-runtime-01'
          ? Object.freeze({
              disposition: 'attempted_failed' as const,
              failureCategory: 'schema' as const,
              strictRuntimeSuccess: false,
              durationMs: null,
              orchestrationDurationMs: null,
              usage: null,
              semantic: null,
              safety: F2_SAFE,
              schema: schemaObservation('rejected', diagnostic),
            })
          : result,
      ),
      lifecycle: memory.lifecycle,
      signal: new AbortController().signal,
    });

    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 46,
    });
    expect(report.schemaAccounting).toEqual({
      complete: false,
      canonical: 1,
      extensionFieldsDiscarded: 0,
      rejected: 1,
      notObserved: 46,
    });
    expect(report.breaker).toEqual({ opened: true, reason: 'schema' });
    expect(report.metrics.complete).toBe(false);
    expect(report.metrics.combinedSemanticScore).toBeNull();
    expect(report.latency.pairedCandidateP95Ms).toBeNull();
    expect(report.usage.inputTokens).toBeNull();
    expect(report.usage.estimatedCostCny).toBeNull();
    expect(
      report.caseEntries.find((entry) => entry.base.caseId === 'organizer-v2-runtime-01'),
    ).toMatchObject({ base: { disposition: 'succeeded' }, schema: SR3_CANONICAL_SCHEMA });
  });

  test('rejects old reports and recomputes every aggregate instead of trusting serialized claims', async () => {
    const memory = createSr3MemoryLifecycle();
    const report = await runPhase697TutorOrganizerSchemaRecovery({
      runId: '00000000-0000-4000-8000-000000000976',
      runScope: 'branch',
      source: createSr3Source(),
      harness: createSr3SuccessHarness(),
      lifecycle: memory.lifecycle,
      signal: new AbortController().signal,
    });
    const tampered = JSON.parse(JSON.stringify(report));
    tampered.schemaAccounting.canonical = 47;
    expect(parsePhase697SchemaRecoveryReport(tampered)).toBeNull();
    expect(
      parsePhase697SchemaRecoveryReport({
        reportVersion: 'phase-6.9.7-tutor-organizer-full-gate-report-v1',
        lineage: 'phase-6.9.7-tutor-organizer-full-gate-v1',
      }),
    ).toBeNull();
  });

  test('does not retry or downgrade a schema terminal after an ambiguous durability failure', async () => {
    const memory = createSr3MemoryLifecycle();
    const terminalAttempts: string[] = [];
    const lifecycle = Object.freeze({
      ...memory.lifecycle,
      async reserveLane(identity: Parameters<typeof memory.lifecycle.reserveLane>[0]) {
        const lane = await memory.lifecycle.reserveLane(identity);
        return Object.freeze({
          appendWireStage: lane.appendWireStage,
          async appendSchemaStage(event: Parameters<typeof lane.appendSchemaStage>[0]) {
            if (event.event !== 'started') {
              terminalAttempts.push(`${identity.caseId}:${event.event}`);
              throw new Error('ambiguous_fsync_completion');
            }
            await lane.appendSchemaStage(event);
          },
        });
      },
    });

    await expect(
      runPhase697TutorOrganizerSchemaRecovery({
        runId: '00000000-0000-4000-8000-000000000977',
        runScope: 'branch',
        source: createSr3Source(),
        harness: createSr3SuccessHarness(),
        lifecycle,
        signal: new AbortController().signal,
      }),
    ).rejects.toThrow('PHASE_6_9_7_SCHEMA_RECOVERY_DURABILITY_FAILED');
    expect(terminalAttempts).toEqual([
      'tutor-v2-runtime-01:succeeded',
      'organizer-v2-runtime-01:succeeded',
    ]);
    expect(terminalAttempts.some((event) => event.endsWith(':failed'))).toBe(false);
    expect(memory.schema.get('tutor-v2-runtime-01')?.map((event) => event.event)).toEqual([
      'started',
    ]);
  });
});

function requireDiagnostic(content: string): TutorSchemaRecoveryBoundedDiagnostic {
  const parsed = parseTutorSchemaRecoveryProviderContent(content);
  if (!parsed.ok || parsed.diagnostic === null) throw new Error('SR3_DIAGNOSTIC_FIXTURE_INVALID');
  return parsed.diagnostic;
}

function requireRejectedDiagnostic(content: string): TutorSchemaRecoveryBoundedDiagnostic {
  const parsed = parseTutorSchemaRecoveryProviderContent(content);
  if (parsed.ok) throw new Error('SR3_REJECTED_FIXTURE_INVALID');
  return parsed.diagnostic;
}
