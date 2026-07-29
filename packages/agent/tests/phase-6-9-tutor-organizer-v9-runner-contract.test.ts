import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA,
  PHASE_6_9_7_V9_EVAL_POLICY,
  buildPhase697V9EvidenceEnvelope,
  parsePhase697TutorOrganizerV9Report,
} from '../src/evals/phase-6-9-tutor-wrong-question-v9-contract.ts';
import {
  runPhase697TutorOrganizerPairedEvalV9,
  type Phase697V9Harness,
  type Phase697V9RunnerLifecycle,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-v9-paired.ts';
import { runPhase697TutorOrganizerPairedEvalV6 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import { validatePhase697TutorOrganizerV9EvidenceValue } from '../scripts/validate-phase-6-9-7-tutor-wrong-question-v9-evidence.ts';
import {
  createPhase697V6SyntheticHarness,
  successfulOrganizerResult,
  successfulTutorResult,
} from './fixtures/phase-6-9-tutor-organizer-v6-runner.ts';
import {
  createPhase697V9SchemaFailureHarness,
  createPhase697V9SyntheticHarness,
} from './fixtures/phase-6-9-tutor-organizer-v9-runner.ts';

const RUN_ID = '00000000-0000-4000-8000-000000000701';

describe('Phase 6.9.7 V9 R3 runner and report contract', () => {
  test('keeps fixed denominators and derives four independent wire counters', async () => {
    const recordedStages: string[] = [];
    const report = await runPhase697TutorOrganizerPairedEvalV9(createPhase697V9SyntheticHarness(), {
      lifecycle: {
        recordWireStage(_reservation, stage) {
          recordedStages.push(stage);
          return Promise.resolve();
        },
      },
    });

    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(report).success).toBe(true);
    expect(report.counts).toEqual({
      cases: 72,
      zeroCallCases: 24,
      runtimeCases: 48,
      pairedRequests: 24,
      organizerDecisionUnits: 32,
    });
    expect(report.wire).toEqual({
      complete: true,
      executorInvocations: 48,
      providerDispatches: 48,
      providerResponses: 48,
      verifiedUsages: 48,
    });
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 48,
      terminalEntries: 48,
      orphanedEntries: 0,
      notStartedEntries: 0,
    });
    expect(report.usage).toMatchObject({
      complete: true,
      executorInvocations: 48,
      providerDispatches: 48,
      providerResponses: 48,
      verifiedUsages: 48,
      verifiedRuntimeCases: 48,
    });
    expect(report.metrics).toMatchObject({ complete: true, strictRuntimeSuccesses: 48 });
    expect(report.gate).toBe('mock_quality_not_evidence');
    expect(recordedStages).toHaveLength(48 * 8);
    expect(PHASE_6_9_7_V9_EVAL_POLICY.wire).toMatchObject({
      executorInvocations: 48,
      providerDispatches: 48,
      providerResponses: 48,
      verifiedUsages: 48,
    });
  });

  test('fails before the delegate when durable dispatch evidence cannot be appended', async () => {
    let delegateCalls = 0;
    const lifecycle: Phase697V9RunnerLifecycle = {
      async recordWireStage(_reservation, stage) {
        if (stage === 'provider_dispatch_started')
          throw new Error('synthetic durable hook failure');
      },
    };
    const report = await runPhase697TutorOrganizerPairedEvalV9(
      createPhase697V9SyntheticHarness({
        onDelegate() {
          delegateCalls += 1;
        },
        returnFailureAfterWireError: true,
      }),
      { lifecycle },
    );

    expect(delegateCalls).toBe(0);
    expect(report.scheduler).toMatchObject({
      breakerState: 'quality_gate_impossible',
      dispatchedPairs: 1,
      completedPairs: 1,
    });
    expect(report.wire).toEqual({
      complete: false,
      executorInvocations: 2,
      providerDispatches: 0,
      providerResponses: 0,
      verifiedUsages: 0,
    });
    expect(report.runtimeAccounting).toEqual({
      reservedEntries: 2,
      terminalEntries: 2,
      orphanedEntries: 0,
      notStartedEntries: 46,
    });
    expect(report.metrics).toMatchObject({
      complete: false,
      strictRuntimeSuccesses: 0,
      tutorSemanticScore: null,
      organizerSemanticScore: null,
      combinedSemanticScore: null,
    });
    expect(report.latency).toEqual({
      complete: false,
      tutorCandidateP95Ms: null,
      organizerCandidateP95Ms: null,
      pairedCandidateP95Ms: null,
      tutorOrchestrationP95Ms: null,
    });
    expect(report.usage).toMatchObject({
      complete: false,
      inputTokens: null,
      outputTokens: null,
      estimatedCostCny: null,
    });
  });

  test('rejects first-party Live provenance before guards or executors without a full durable lifecycle', async () => {
    const synthetic = createPhase697V9SyntheticHarness({ mode: 'live' });
    let guardOperations = 0;
    let delegateOperations = 0;
    const harness: Phase697V9Harness = Object.freeze({
      ...synthetic,
      executorProvenance: 'first_party_deepseek_v4_pro_direct',
      async runZeroCall(entry) {
        guardOperations += 1;
        return synthetic.runZeroCall(entry);
      },
      async runTutor(entry, signal, capability) {
        delegateOperations += 1;
        return synthetic.runTutor(entry, signal, capability);
      },
      async runOrganizer(entry, signal, capability) {
        delegateOperations += 1;
        return synthetic.runOrganizer(entry, signal, capability);
      },
    });

    await expect(runPhase697TutorOrganizerPairedEvalV9(harness)).rejects.toThrow(
      'PHASE_6_9_7_V9_DURABLE_LIVE_LIFECYCLE_REQUIRED',
    );
    expect(guardOperations).toBe(0);
    expect(delegateOperations).toBe(0);
  });

  test('turns a semantic success without wire completion into a fail-closed breaker terminal', async () => {
    const base = createPhase697V6SyntheticHarness({ runId: RUN_ID });
    const harness: Phase697V9Harness = Object.freeze({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'mock',
      provider: 'mock',
      model: 'mock',
      structuredOutputMode: 'mock_json_v9',
      executorProvenance: 'mock_synthetic',
      runZeroCall: base.runZeroCall,
      runTutor: async (entry) => successfulTutorResult(entry),
      runOrganizer: async (entry) => ({
        ...successfulOrganizerResult(entry),
        boundedSchemaDiagnostic: null,
      }),
    });
    const report = await runPhase697TutorOrganizerPairedEvalV9(harness);
    expect(report.scheduler).toMatchObject({
      breakerState: 'quality_gate_impossible',
      dispatchedPairs: 1,
      completedPairs: 1,
    });
    expect(report.metrics).toMatchObject({ complete: false, strictRuntimeSuccesses: 0 });
    expect(report.wire).toMatchObject({
      executorInvocations: 0,
      providerDispatches: 0,
      providerResponses: 0,
      verifiedUsages: 0,
    });
  });

  test('carries a bounded Organizer schema diagnostic into the breaker report and rejects drift', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV9(
      createPhase697V9SchemaFailureHarness(),
    );
    expect(report.scheduler).toMatchObject({
      breakerState: 'quality_gate_impossible',
      dispatchedPairs: 1,
      completedPairs: 1,
    });
    const organizer = report.caseEntries.find(
      (entry) => entry.caseId === 'organizer-v2-runtime-01',
    );
    if (!organizer?.boundedSchemaDiagnostic) {
      throw new Error('V9 bounded Organizer diagnostic unavailable');
    }
    expect(organizer.wireEvidence.snapshot).toMatchObject({
      state: 'failed',
      failureCategory: 'provider_type_validation',
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 1,
        verifiedUsages: 0,
      },
    });
    expect(organizer.boundedSchemaDiagnostic).toMatchObject({
      reason: 'top_level_keys',
      topLevelShape: 'plain_object',
      rawDataRetained: false,
    });
    expect(report.metrics).toMatchObject({ complete: false, strictRuntimeSuccesses: 0 });
    expect(report.latency.complete).toBe(false);
    expect(report.usage).toMatchObject({
      complete: false,
      inputTokens: null,
      outputTokens: null,
      estimatedCostCny: null,
    });

    const missingDiagnostic = JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
    const missingEntry = (missingDiagnostic.caseEntries as Array<Record<string, unknown>>).find(
      (entry) => entry.caseId === organizer.caseId,
    );
    if (!missingEntry) throw new Error('V9 diagnostic entry unavailable');
    missingEntry.boundedSchemaDiagnostic = null;
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(missingDiagnostic).success).toBe(
      false,
    );

    const envelope = buildPhase697V9EvidenceEnvelope({
      report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    if (!envelope) throw new Error('V9 diagnostic evidence envelope unavailable');
    const tamperCases: Array<
      Readonly<{ label: string; mutate(diagnostic: Record<string, unknown>): void }>
    > = [
      {
        label: 'reason',
        mutate(diagnostic) {
          diagnostic.reason = 'dynamic_authority';
        },
      },
      {
        label: 'shapeFingerprint',
        mutate(diagnostic) {
          diagnostic.shapeFingerprint = `sha256:${'0'.repeat(64)}`;
        },
      },
      {
        label: 'missingRequiredFieldCount',
        mutate(diagnostic) {
          diagnostic.missingRequiredFieldCount = Number(diagnostic.missingRequiredFieldCount) + 1;
        },
      },
      {
        label: 'rawDataRetained',
        mutate(diagnostic) {
          diagnostic.rawDataRetained = true;
        },
      },
    ];
    for (const { label, mutate } of tamperCases) {
      const tampered = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
      const tamperedReport = tampered.report as Record<string, unknown>;
      const tamperedEntry = (tamperedReport.caseEntries as Array<Record<string, unknown>>).find(
        (entry) => entry.caseId === organizer.caseId,
      );
      const diagnostic = tamperedEntry?.boundedSchemaDiagnostic as
        | Record<string, unknown>
        | undefined;
      if (!diagnostic) throw new Error('V9 tamper diagnostic unavailable');
      mutate(diagnostic);
      expect(validatePhase697TutorOrganizerV9EvidenceValue(tampered), label).toEqual({
        ok: false,
        code: 'report_contract_invalid',
      });
    }
  });

  test('recomputes V9 identities, wire aggregates, entry linkage, and synthetic Live gate', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV9(createPhase697V9SyntheticHarness());
    const clone = () => JSON.parse(JSON.stringify(report)) as Record<string, unknown>;

    const wireTamper = clone();
    (wireTamper.wire as Record<string, unknown>).providerDispatches = 47;
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(wireTamper).success).toBe(false);

    const identityTamper = clone();
    (identityTamper.identities as Record<string, unknown>).semanticAuthoritySha256 =
      `sha256:${'0'.repeat(64)}`;
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(identityTamper).success).toBe(
      false,
    );

    const entryTamper = clone();
    const firstRuntime = (entryTamper.caseEntries as Array<Record<string, unknown>>).find(
      (entry) => entry.executionKind === 'runtime',
    );
    if (!firstRuntime) throw new Error('V9 runtime entry unavailable');
    firstRuntime.wireEvidence = { disposition: 'missing_after_attempt', snapshot: null };
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(entryTamper).success).toBe(false);

    const liveReport = await runPhase697TutorOrganizerPairedEvalV9(
      createPhase697V9SyntheticHarness({ mode: 'live' }),
    );
    expect(liveReport.executorProvenance).toBe('synthetic_test');
    expect(liveReport.gate).toBe('quality_gate_failed');
    const liveGateTamper = JSON.parse(JSON.stringify(liveReport)) as Record<string, unknown>;
    liveGateTamper.gate = 'quality_gate_passed';
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(liveGateTamper).success).toBe(
      false,
    );
  });

  test('rejects every derived wire counter and formal aggregate when report bytes drift', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV9(createPhase697V9SyntheticHarness());
    const clone = () => JSON.parse(JSON.stringify(report)) as Record<string, unknown>;
    const tamperCases: Array<
      Readonly<{ label: string; mutate(value: Record<string, unknown>): void }>
    > = [
      ...['executorInvocations', 'providerDispatches', 'providerResponses', 'verifiedUsages'].map(
        (counter) => ({
          label: `wire.${counter}`,
          mutate(value: Record<string, unknown>) {
            (value.wire as Record<string, unknown>)[counter] = 47;
          },
        }),
      ),
      {
        label: 'metrics.strictRuntimeSuccesses',
        mutate(value) {
          (value.metrics as Record<string, unknown>).strictRuntimeSuccesses = 47;
        },
      },
      {
        label: 'latency.complete',
        mutate(value) {
          (value.latency as Record<string, unknown>).complete = false;
        },
      },
      {
        label: 'usage.inputTokens',
        mutate(value) {
          const usage = value.usage as Record<string, unknown>;
          usage.inputTokens = Number(usage.inputTokens) + 1;
        },
      },
      {
        label: 'safety.criticalFailures',
        mutate(value) {
          (value.safety as Record<string, unknown>).criticalFailures = 1;
        },
      },
      {
        label: 'counts.runtimeCases',
        mutate(value) {
          (value.counts as Record<string, unknown>).runtimeCases = 47;
        },
      },
    ];

    for (const { label, mutate } of tamperCases) {
      const tampered = clone();
      mutate(tampered);
      expect(PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(tampered).success, label).toBe(
        false,
      );
    }

    const missingReservedTerminal = clone();
    (missingReservedTerminal.ledger as Record<string, unknown>).terminalEntries = 47;
    (missingReservedTerminal.runtimeAccounting as Record<string, unknown>).terminalEntries = 47;
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(missingReservedTerminal).success,
      'reserved lane without terminal or orphan',
    ).toBe(false);

    const runtimeCounterTamper = clone();
    const runtimeEntry = (runtimeCounterTamper.caseEntries as Array<Record<string, unknown>>).find(
      (entry) => entry.executionKind === 'runtime',
    );
    if (!runtimeEntry) throw new Error('V9 runtime entry unavailable');
    const snapshot = (runtimeEntry.wireEvidence as Record<string, unknown>).snapshot as Record<
      string,
      unknown
    >;
    (snapshot.counters as Record<string, unknown>).providerResponses = 0;
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(runtimeCounterTamper).success,
    ).toBe(false);
  });

  test('keeps V6 and V9 report/artifact identities mutually isolated', async () => {
    const v6Report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({ runId: RUN_ID }),
    );
    const v9Report = await runPhase697TutorOrganizerPairedEvalV9(
      createPhase697V9SyntheticHarness(),
    );
    expect(parsePhase697TutorOrganizerV9Report(v6Report)).toBeNull();
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(v9Report).success).toBe(false);
    expect(JSON.stringify(v9Report)).not.toContain('phase-6.9.7-tutor-organizer-runner-v6');
    expect(JSON.stringify(v9Report)).not.toContain('phase-6.9.7-v6-runtime-evidence');

    const envelope = buildPhase697V9EvidenceEnvelope({
      report: v9Report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    expect(envelope).not.toBeNull();
    const oldRunner = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
    oldRunner.runnerVersion = 'phase-6.9.7-tutor-organizer-runner-v6';
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V9_REPORT_SCHEMA.safeParse(oldRunner).success).toBe(false);
  });
});
