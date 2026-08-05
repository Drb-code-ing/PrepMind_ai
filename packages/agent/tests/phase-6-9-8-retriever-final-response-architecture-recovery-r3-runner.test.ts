import { randomUUID } from 'node:crypto';

import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
  type Phase698ArchitectureRecoveryBoundedDiagnostic,
  type Phase698ArchitectureRecoveryCallPhase,
  type Phase698ArchitectureRecoveryDiagnosticStage,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-diagnostic.ts';
import {
  architectureRecoveryDiagnosticSequence,
  calculatePhase698ArchitectureRecoveryCostCny,
  expectedPhase698ArchitectureRecoveryCallSchedule,
  type Phase698ArchitectureRecoveryCallIdentity,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';
import {
  createPhase698ArchitectureRecoverySyntheticOutcomeForTest,
  createPhase698ArchitectureRecoveryControlledOutcome,
  runPhase698ArchitectureRecoveryR3,
  type Phase698ArchitectureRecoveryHarness,
  type Phase698ArchitectureRecoveryLifecycle,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner.ts';
import { createPhase698ArchitectureRecoverySyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-source-admission.ts';

describe('Phase 6.9.8 Architecture Recovery R3 runner', () => {
  test('keeps shared runner-observation issuance inside the three module-owned capability maps', async () => {
    const module =
      await import('../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner-observation.ts');
    expect('issuePhase698ArchitectureRecoveryRunnerObservationFromFirstPartyModule' in module).toBe(
      false,
    );
  });

  test('runs the immutable 16-guard/64-call schedule with separate runner/provider wire authority', async () => {
    const seen: string[] = [];
    const report = await runWithHarness(successHarness(seen));

    expect(seen).toEqual(
      expectedPhase698ArchitectureRecoveryCallSchedule().map((entry) => entry.callId),
    );
    expect(report.caseCounts).toEqual({
      guards: 16,
      rewritePairs: 16,
      finalResponseCases: 16,
      providerCalls: 64,
      totalManifestCases: 48,
    });
    expect(report.diagnostics).toEqual({
      terminalCount: 64,
      appliedCount: 64,
      failedCount: 0,
      notStartedCount: 0,
    });
    expect(report.providers.deepseek.runnerWire).toEqual({
      reservations: 32,
      dispatches: 32,
      harnessReturns: 32,
      verifiedResults: 32,
    });
    expect(report.providers.deepseek.providerWire).toEqual({
      executions: 32,
      dispatches: 32,
      responses: 32,
      verifiedUsage: 32,
    });
    expect(report.providers.qwen.runnerWire).toEqual({
      reservations: 32,
      dispatches: 32,
      harnessReturns: 32,
      verifiedResults: 32,
    });
    expect(report.providers.qwen.providerWire).toEqual({
      executions: 32,
      dispatches: 32,
      responses: 32,
      verifiedUsage: 32,
    });
    expect(report.execution).toMatchObject({
      mode: 'synthetic_fault',
      credentialReads: 0,
      externalProviderCalls: 0,
      retry: false,
      replay: false,
      resume: false,
      backfill: false,
      backgroundJob: false,
      outbox: false,
    });
    expect(report.gate).toMatchObject({
      status: 'architecture_recovery_synthetic_contract_passed',
      passed: true,
      qualityAuthority: 'none',
    });
    expect(report.qualityAuthority).toBe('none');
  });

  test('keeps Provider response/usage evidence when a local diagnostic fails and nulls incomplete aggregates', async () => {
    const seen: string[] = [];
    const base = successHarness(seen);
    const harness: Phase698ArchitectureRecoveryHarness = Object.freeze({
      ...base,
      async invokeCall(input) {
        seen.push(input.identity.callId);
        if (input.identity.callId === 'rewrite_02.rewrite_candidate_model') {
          const terminal = failureTranscript(
            input.identity.phase,
            'rewrite_candidate_projection',
            'candidate_rejected',
            'response_observed',
          );
          return createPhase698ArchitectureRecoverySyntheticOutcomeForTest({
            identity: input.identity,
            ...terminal,
            providerWire: { executions: 1, dispatches: 1, responses: 1, verifiedUsage: 0 },
            usage: null,
            verifiedCostCny: null,
            result: null,
          });
        }
        return successOutcome(input.identity);
      },
    });

    const report = await runWithHarness(harness);
    const failed = report.callEntries[4];
    expect(failed).toMatchObject({
      callId: 'rewrite_02.rewrite_candidate_model',
      disposition: 'failed',
      failureReason: 'diagnostic_failed',
      runnerWire: { reservations: 1, dispatches: 1, harnessReturns: 1, verifiedResults: 0 },
      providerWire: { executions: 1, dispatches: 1, responses: 1, verifiedUsage: 0 },
      diagnostic: {
        stage: 'rewrite_candidate_projection',
        reasonCode: 'candidate_rejected',
        providerBoundary: 'response_observed',
      },
    });
    expect(
      report.callEntries
        .slice(5)
        .every((entry) => entry.disposition === 'not_started_quality_breaker'),
    ).toBe(true);
    expect(report.callEntries.slice(5).every((entry) => entry.diagnostic === null)).toBe(true);
    expect(seen).toHaveLength(5);
    expect(report.diagnostics).toEqual({
      terminalCount: 5,
      appliedCount: 4,
      failedCount: 1,
      notStartedCount: 59,
    });
    expect(report.providers.deepseek.inputTokens).toBeNull();
    expect(report.providers.qwen.inputTokens).toBeNull();
    expect(report.providers.aggregateVerifiedCostCny).toBeNull();
    expect(report.rewrite.candidateNdcgAt5).toBeNull();
    expect(report.latency.rewriteP95Ms).toBeNull();
    expect(report.gate).toMatchObject({
      status: 'architecture_recovery_quality_gate_failed',
      passed: false,
      qualityAuthority: 'none',
    });
  });

  test('fails closed on forged/reused/cross-call outcome capabilities without leaking thrown text', async () => {
    for (const mode of ['forged', 'reused', 'cross_call', 'throw'] as const) {
      const seen: string[] = [];
      const base = successHarness(seen);
      let captured: ReturnType<typeof successOutcome> | null = null;
      const harness: Phase698ArchitectureRecoveryHarness = Object.freeze({
        ...base,
        async invokeCall(input) {
          seen.push(input.identity.callId);
          if (mode === 'throw')
            throw new Error('secret raw provider response https://provider.invalid');
          if (mode === 'forged') {
            return Object.freeze({
              version:
                'phase-6.9.8-retriever-final-response-architecture-recovery-outcome-capability-v1',
            }) as never;
          }
          captured ??= successOutcome(input.identity);
          if (
            mode === 'reused' &&
            input.identity.callId !== 'rewrite_01.rewrite_original_retrieval'
          ) {
            return captured;
          }
          if (mode === 'cross_call') {
            const foreign = expectedPhase698ArchitectureRecoveryCallSchedule()[1];
            return successOutcome(foreign);
          }
          return captured;
        },
      });
      const report = await runWithHarness(harness);

      expect(report.callEntries[0].disposition).toBe(mode === 'reused' ? 'succeeded' : 'failed');
      const failure = mode === 'reused' ? report.callEntries[1] : report.callEntries[0];
      expect(failure).toMatchObject({
        disposition: 'failed',
        failureReason: 'runtime_contract_invalid',
        runnerWire: {
          reservations: 1,
          dispatches: 1,
          harnessReturns: mode === 'throw' ? 0 : 1,
          verifiedResults: 0,
        },
        providerWire: { executions: 0, dispatches: 0, responses: 0, verifiedUsage: 0 },
      });
      expect(failure.diagnostic).toMatchObject({ reasonCode: 'unknown', rawDataRetained: false });
      expect(JSON.stringify(report)).not.toContain('secret raw provider response');
      expect(JSON.stringify(report)).not.toContain('provider.invalid');
    }
  });

  test('consumes source admission once and rejects controlled-live authority at the synthetic seam', async () => {
    const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
    const runId = randomUUID();
    const input = {
      runId,
      authority: 'synthetic_test' as const,
      runMode: 'synthetic_fault' as const,
      credentialReads: 0,
      admissionCapability: admission.capability,
      harness: successHarness([]),
      lifecycle: noopLifecycle(runId),
      signal: new AbortController().signal,
    };
    await runPhase698ArchitectureRecoveryR3(input);
    await expect(runPhase698ArchitectureRecoveryR3(input)).rejects.toThrow(
      'PHASE_6_9_8_ARCHITECTURE_RECOVERY_ADMISSION_CAPABILITY_INVALID',
    );
  });

  test('rejects a forged first-party runner observation before controlled outcome issuance', () => {
    const identity = expectedPhase698ArchitectureRecoveryCallSchedule()[0]!;
    expect(() =>
      createPhase698ArchitectureRecoveryControlledOutcome({
        identity,
        observationCapability: Object.freeze({
          version:
            'phase-6.9.8-retriever-final-response-architecture-recovery-runner-observation-capability-v1',
        }),
        usage: { inputTokens: 8, outputTokens: 0 },
        verifiedCostCny: calculatePhase698ArchitectureRecoveryCostCny('qwen', {
          inputTokens: 8,
          outputTokens: 0,
        }),
        result: { phase: identity.phase, targetRank: 1, recallAt5: 1, ndcgAt5: 1 },
      }),
    ).toThrow('PHASE_6_9_8_ARCHITECTURE_RECOVERY_RUNNER_OBSERVATION_INVALID');
  });
});

function successHarness(seen: string[]): Phase698ArchitectureRecoveryHarness {
  return Object.freeze({
    runMode: 'synthetic_fault' as const,
    transportAuthority: 'synthetic_injected' as const,
    async runGuard(testCase) {
      return Object.freeze({
        observedReasonCode: testCase.expectedReasonCode,
        zeroCallVerified: true,
        permissionFailure: false,
        crossOwnerFailure: false,
        credentialFailure: false,
        injectionFailure: false,
      });
    },
    async invokeCall(input) {
      seen.push(input.identity.callId);
      return successOutcome(input.identity);
    },
  });
}

function successOutcome(identity: Phase698ArchitectureRecoveryCallIdentity) {
  const diagnosticStages = architectureRecoveryDiagnosticSequence(identity.phase);
  const diagnostic = appliedDiagnostic(identity.phase);
  const usage =
    identity.provider === 'qwen'
      ? { inputTokens: 8, outputTokens: 0 }
      : { inputTokens: 80, outputTokens: 8 };
  const verifiedCostCny = calculatePhase698ArchitectureRecoveryCostCny(identity.provider, usage)!;
  const result =
    identity.phase === 'rewrite_candidate_model'
      ? {
          phase: identity.phase,
          executedQuery: 'synthetic bounded query',
          intentPreserved: true,
          unsafeRewrite: false,
        }
      : identity.phase === 'final_response_model'
        ? {
            phase: identity.phase,
            responseTextHash: `sha256:${'a'.repeat(64)}`,
            terminal: 'response_completed' as const,
            terminalCount: 1 as const,
            terminalLast: true as const,
            grounded: true,
            noticeSatisfied: true,
            requiredCitationCount: 1,
            observedCitationCount: 1,
            citationTruePositiveCount: 1,
            falseToolSuccess: false,
            falseCitation: false,
            ttftMs: 5,
            totalMs: 10,
            endToEndMs: 15,
          }
        : {
            phase: identity.phase,
            targetRank: 1,
            recallAt5: 1,
            ndcgAt5: identity.phase === 'rewrite_original_retrieval' ? 0.8 : 1,
          };
  return createPhase698ArchitectureRecoverySyntheticOutcomeForTest({
    identity,
    diagnostic,
    diagnosticStages,
    providerWire: { executions: 1, dispatches: 1, responses: 1, verifiedUsage: 1 },
    usage,
    verifiedCostCny,
    result,
  });
}

function appliedDiagnostic(
  callPhase: Phase698ArchitectureRecoveryCallPhase,
): Phase698ArchitectureRecoveryBoundedDiagnostic {
  return Object.freeze({
    diagnosticVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
    callPhase,
    stage: 'applied',
    reasonCode: 'applied',
    providerBoundary: 'response_and_usage_observed',
    topLevelTypeBucket: 'object',
    fieldCountBucket: '1',
    terminalCountBucket: callPhase === 'final_response_model' ? '1' : 'not_applicable',
    rawDataRetained: false,
  });
}

function failureTranscript(
  callPhase: Phase698ArchitectureRecoveryCallPhase,
  stage: Phase698ArchitectureRecoveryDiagnosticStage,
  reasonCode: Phase698ArchitectureRecoveryBoundedDiagnostic['reasonCode'],
  providerBoundary: Phase698ArchitectureRecoveryBoundedDiagnostic['providerBoundary'],
) {
  const sequence = architectureRecoveryDiagnosticSequence(callPhase);
  const diagnosticStages = sequence.slice(0, sequence.indexOf(stage));
  const diagnostic: Phase698ArchitectureRecoveryBoundedDiagnostic = Object.freeze({
    diagnosticVersion: PHASE_6_9_8_ARCHITECTURE_RECOVERY_DIAGNOSTIC_VERSION,
    callPhase,
    stage,
    reasonCode,
    providerBoundary,
    topLevelTypeBucket: 'object',
    fieldCountBucket: '1',
    terminalCountBucket: callPhase === 'final_response_model' ? '1' : 'not_applicable',
    rawDataRetained: false,
  });
  return Object.freeze({ diagnostic, diagnosticStages });
}

async function runWithHarness(harness: Phase698ArchitectureRecoveryHarness) {
  const runId = randomUUID();
  const admission = createPhase698ArchitectureRecoverySyntheticAdmissionForTest();
  return runPhase698ArchitectureRecoveryR3({
    runId,
    authority: 'synthetic_test',
    runMode: 'synthetic_fault',
    credentialReads: 0,
    admissionCapability: admission.capability,
    harness,
    lifecycle: noopLifecycle(runId),
    signal: new AbortController().signal,
  });
}

function noopLifecycle(runId: string): Phase698ArchitectureRecoveryLifecycle {
  return Object.freeze({
    runId,
    appendGuardTerminal: async () => undefined,
    reserveCall: async () =>
      Object.freeze({
        appendRunnerStage: async () => undefined,
        appendDiagnosticStage: async () => undefined,
        appendCallPrepared: async () => undefined,
      }),
    appendCallTerminal: async () => undefined,
    appendRewriteTerminal: async () => undefined,
    appendFinalTerminal: async () => undefined,
    appendRunTerminal: async () => undefined,
  });
}
