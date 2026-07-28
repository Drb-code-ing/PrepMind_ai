import { describe, expect, test } from 'bun:test';

import { PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA } from '../src/evals/phase-6-9-tutor-wrong-question-v6-contract.ts';
import {
  PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA,
  PHASE_6_9_7_V7_EVAL_POLICY,
  buildPhase697V7EvidenceEnvelope,
  parsePhase697TutorOrganizerV7Report,
} from '../src/evals/phase-6-9-tutor-wrong-question-v7-contract.ts';
import {
  runPhase697TutorOrganizerPairedEvalV7,
  type Phase697V7Harness,
  type Phase697V7RunnerLifecycle,
} from '../src/evals/run-phase-6-9-tutor-wrong-question-v7-paired.ts';
import { runPhase697TutorOrganizerPairedEvalV6 } from '../src/evals/run-phase-6-9-tutor-wrong-question-v6-paired.ts';
import {
  createPhase697V6SyntheticHarness,
  successfulOrganizerResult,
  successfulTutorResult,
} from './fixtures/phase-6-9-tutor-organizer-v6-runner.ts';
import { createPhase697V7SyntheticHarness } from './fixtures/phase-6-9-tutor-organizer-v7-runner.ts';

const RUN_ID = '00000000-0000-4000-8000-000000000701';

describe('Phase 6.9.7 V7 R2 runner and report contract', () => {
  test('keeps fixed denominators and derives four independent wire counters', async () => {
    const recordedStages: string[] = [];
    const report = await runPhase697TutorOrganizerPairedEvalV7(createPhase697V7SyntheticHarness(), {
      lifecycle: {
        recordWireStage(_reservation, stage) {
          recordedStages.push(stage);
          return Promise.resolve();
        },
      },
    });

    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA.safeParse(report).success).toBe(true);
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
    expect(PHASE_6_9_7_V7_EVAL_POLICY.wire).toMatchObject({
      executorInvocations: 48,
      providerDispatches: 48,
      providerResponses: 48,
      verifiedUsages: 48,
    });
  });

  test('fails before the delegate when durable dispatch evidence cannot be appended', async () => {
    let delegateCalls = 0;
    const lifecycle: Phase697V7RunnerLifecycle = {
      async recordWireStage(_reservation, stage) {
        if (stage === 'provider_dispatch_started')
          throw new Error('synthetic durable hook failure');
      },
    };
    const report = await runPhase697TutorOrganizerPairedEvalV7(
      createPhase697V7SyntheticHarness({
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

  test('turns a semantic success without wire completion into a fail-closed breaker terminal', async () => {
    const base = createPhase697V6SyntheticHarness({ runId: RUN_ID });
    const harness: Phase697V7Harness = Object.freeze({
      runId: RUN_ID,
      runScope: 'branch',
      mode: 'mock',
      provider: 'mock',
      model: 'mock',
      structuredOutputMode: 'mock_json_v7',
      executorProvenance: 'mock_synthetic',
      runZeroCall: base.runZeroCall,
      runTutor: async (entry) => successfulTutorResult(entry),
      runOrganizer: async (entry) => successfulOrganizerResult(entry),
    });
    const report = await runPhase697TutorOrganizerPairedEvalV7(harness);
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

  test('recomputes V7 identities, wire aggregates, entry linkage, and synthetic Live gate', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV7(createPhase697V7SyntheticHarness());
    const clone = () => JSON.parse(JSON.stringify(report)) as Record<string, unknown>;

    const wireTamper = clone();
    (wireTamper.wire as Record<string, unknown>).providerDispatches = 47;
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA.safeParse(wireTamper).success).toBe(false);

    const identityTamper = clone();
    (identityTamper.identities as Record<string, unknown>).semanticAuthoritySha256 =
      `sha256:${'0'.repeat(64)}`;
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA.safeParse(identityTamper).success).toBe(
      false,
    );

    const entryTamper = clone();
    const firstRuntime = (entryTamper.caseEntries as Array<Record<string, unknown>>).find(
      (entry) => entry.executionKind === 'runtime',
    );
    if (!firstRuntime) throw new Error('V7 runtime entry unavailable');
    firstRuntime.wireEvidence = { disposition: 'missing_after_attempt', snapshot: null };
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA.safeParse(entryTamper).success).toBe(false);

    const liveReport = await runPhase697TutorOrganizerPairedEvalV7(
      createPhase697V7SyntheticHarness({ mode: 'live' }),
    );
    expect(liveReport.executorProvenance).toBe('synthetic_test');
    expect(liveReport.gate).toBe('quality_gate_failed');
    const liveGateTamper = JSON.parse(JSON.stringify(liveReport)) as Record<string, unknown>;
    liveGateTamper.gate = 'quality_gate_passed';
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA.safeParse(liveGateTamper).success).toBe(
      false,
    );
  });

  test('rejects every derived wire counter and formal aggregate when report bytes drift', async () => {
    const report = await runPhase697TutorOrganizerPairedEvalV7(createPhase697V7SyntheticHarness());
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
      expect(PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA.safeParse(tampered).success, label).toBe(
        false,
      );
    }

    const runtimeCounterTamper = clone();
    const runtimeEntry = (runtimeCounterTamper.caseEntries as Array<Record<string, unknown>>).find(
      (entry) => entry.executionKind === 'runtime',
    );
    if (!runtimeEntry) throw new Error('V7 runtime entry unavailable');
    const snapshot = (runtimeEntry.wireEvidence as Record<string, unknown>).snapshot as Record<
      string,
      unknown
    >;
    (snapshot.counters as Record<string, unknown>).providerResponses = 0;
    expect(
      PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA.safeParse(runtimeCounterTamper).success,
    ).toBe(false);
  });

  test('keeps V6 and V7 report/artifact identities mutually isolated', async () => {
    const v6Report = await runPhase697TutorOrganizerPairedEvalV6(
      createPhase697V6SyntheticHarness({ runId: RUN_ID }),
    );
    const v7Report = await runPhase697TutorOrganizerPairedEvalV7(
      createPhase697V7SyntheticHarness(),
    );
    expect(parsePhase697TutorOrganizerV7Report(v6Report)).toBeNull();
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V6_REPORT_SCHEMA.safeParse(v7Report).success).toBe(false);
    expect(JSON.stringify(v7Report)).not.toContain('phase-6.9.7-tutor-organizer-runner-v6');
    expect(JSON.stringify(v7Report)).not.toContain('phase-6.9.7-v6-runtime-evidence');

    const envelope = buildPhase697V7EvidenceEnvelope({
      report: v7Report,
      disposition: 'mock_direct',
      markerSha256: null,
      journalTailSha256: null,
      journalSequence: null,
    });
    expect(envelope).not.toBeNull();
    const oldRunner = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
    oldRunner.runnerVersion = 'phase-6.9.7-tutor-organizer-runner-v6';
    expect(PHASE_6_9_7_TUTOR_ORGANIZER_V7_REPORT_SCHEMA.safeParse(oldRunner).success).toBe(false);
  });
});
