import { describe, expect, test } from 'bun:test';

import {
  buildPhase697ArchitectureRecoveryR2CanaryArtifact,
  phase697ArchitectureRecoveryR2CanaryArtifactPath,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_PREFIX,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_OUTCOMES,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
  type Phase697ArchitectureRecoveryR2CanaryReport,
} from '../src/phase-6-9-7-architecture-recovery-r2-canary-contract.ts';

const RUN_ID = '11111111-2222-4333-8444-555555555555';
const GENERATED_AT = '2026-07-30T12:00:00.000Z';

describe('Phase 6.9.7 Architecture Recovery R2 canary contract', () => {
  test('freezes an independent request, budget, report, and artifact identity', () => {
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-r2-provider-canary-request-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-r2-provider-canary-budget-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-r2-provider-canary-report-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-r2-provider-canary-artifact-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_PREFIX).toBe(
      'phase-6-9-7-architecture-recovery-r2-provider-canary',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_OUTCOMES).toEqual([
      'complete',
      'response_observed',
      'transport_failed',
      'response_invalid',
      'aborted',
      'timeout',
      'budget_exceeded',
      'config_invalid',
      'harness_internal',
    ]);
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE).toEqual({
      version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-request-v1',
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      endpointPolicy: 'deepseek-v4-pro-exact-chat-completions-v1',
      responseContract: 'exact-ok-true-json-v1',
      nonThinking: true,
      jsonObject: true,
      stream: false,
      tools: false,
      retry: false,
      maxOutputTokens: 16,
      systemPrompt: 'Return exactly one JSON object with ok=true. Use no tools or external facts.',
      userPrompt: 'Run the fact-free provider health canary.',
    });
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET).toEqual({
      version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-budget-v1',
      scope: 'per_invocation',
      maxCalls: 1,
      maxInputTokens: 512,
      maxOutputTokens: 16,
      hardCapCny: '0.00200000',
    });
    for (const value of [
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_OUTCOMES,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_PROFILE,
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET,
    ]) {
      expect(Object.isFrozen(value)).toBe(true);
    }
  });

  test('accepts only the strict bounded report shape and coupled invariants', () => {
    const report = successReport();
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA.safeParse(report).success,
    ).toBe(true);

    const invalid: unknown[] = [
      { ...report, rawError: 'never' },
      { ...report, authority: 'deepseek_network' },
      { ...report, outcome: 'complete', responseObserved: false },
      { ...report, outcome: 'complete', usage: null },
      {
        ...report,
        outcome: 'transport_failed',
        providerFailureCategory: 'transport',
        transportSubtype: null,
      },
      {
        ...report,
        budget: { ...report.budget, reservedCalls: 2 },
      },
      {
        ...report,
        wire: { ...report.wire, counters: { ...report.wire.counters, providerDispatches: 2 } },
      },
      {
        ...report,
        outcome: 'aborted',
        usage: null,
        budget: {
          ...report.budget,
          actualInputTokens: null,
          actualOutputTokens: null,
          withinBudget: null,
        },
      },
      {
        ...report,
        outcome: 'timeout',
        usage: null,
        budget: {
          ...report.budget,
          actualInputTokens: null,
          actualOutputTokens: null,
          withinBudget: null,
        },
        wire: {
          ...report.wire,
          state: 'failed',
          failureCategory: 'post_dispatch_abort',
        },
      },
    ];
    for (const value of invalid) {
      expect(
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA.safeParse(value).success,
      ).toBe(false);
    }
  });

  test('builds only an in-memory diagnostic artifact under a new non-V9 path', () => {
    const artifact = buildPhase697ArchitectureRecoveryR2CanaryArtifact({
      runId: RUN_ID,
      generatedAt: GENERATED_AT,
      report: successReport(),
    });

    expect(artifact).toMatchObject({
      version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-artifact-v1',
      runId: RUN_ID,
      generatedAt: GENERATED_AT,
      authority: 'synthetic_test',
      status: 'diagnostic_only',
      qualityAuthority: 'none',
    });
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_SCHEMA.safeParse(artifact).success,
    ).toBe(true);
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.isFrozen(artifact.report)).toBe(true);

    const path = phase697ArchitectureRecoveryR2CanaryArtifactPath({ runId: RUN_ID });
    expect(path).toBe(`.tmp/phase-6-9-7-architecture-recovery-r2-provider-canary-${RUN_ID}.json`);
    expect(path).not.toMatch(
      /tutor-organizer-v[1-9]|controlled-live|marker|journal|recovery-claim/u,
    );

    expect(() =>
      buildPhase697ArchitectureRecoveryR2CanaryArtifact({
        runId: '../v9',
        generatedAt: GENERATED_AT,
        report: successReport(),
      }),
    ).toThrow('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT');
    expect(() => phase697ArchitectureRecoveryR2CanaryArtifactPath({ runId: '../v9' })).toThrow(
      'INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT',
    );
  });

  test('rejects artifact authority drift and every raw provider field', () => {
    const report = successReport();
    const base = {
      version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_VERSION,
      runId: RUN_ID,
      generatedAt: GENERATED_AT,
      authority: 'synthetic_test',
      status: 'diagnostic_only',
      qualityAuthority: 'none',
      report,
    } as const;
    const invalid: unknown[] = [
      { ...base, authority: 'controlled_live' },
      { ...base, prompt: 'never' },
      { ...base, responseBody: {} },
      { ...base, endpoint: 'https://api.deepseek.com' },
      { ...base, credential: 'never' },
      { ...base, report: { ...report, message: 'never' } },
    ];
    for (const value of invalid) {
      expect(
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_ARTIFACT_SCHEMA.safeParse(value).success,
      ).toBe(false);
    }
  });
});

function successReport(): Phase697ArchitectureRecoveryR2CanaryReport {
  return {
    version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_VERSION,
    requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REQUEST_VERSION,
    authority: 'synthetic_test',
    provider: 'deepseek',
    model: 'deepseek-v4-pro',
    timeoutMs: 1_000,
    outcome: 'complete',
    responseObserved: true,
    providerFailureCategory: null,
    structuredOutputStage: null,
    transportSubtype: null,
    wire: {
      version: 'phase-6.9.7-v7-wire-diagnostics-v1',
      state: 'succeeded',
      lastCompletedStage: 'usage_validated',
      failureCategory: null,
      counters: {
        executorInvocations: 1,
        providerDispatches: 1,
        providerResponses: 1,
        verifiedUsages: 1,
      },
    },
    budget: {
      version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_BUDGET_VERSION,
      scope: 'per_invocation',
      maxCalls: 1,
      maxInputTokens: 512,
      maxOutputTokens: 16,
      hardCapCny: '0.00200000',
      reservedCalls: 1,
      reservedInputTokens: 512,
      reservedOutputTokens: 16,
      actualInputTokens: 32,
      actualOutputTokens: 4,
      withinBudget: true,
    },
    usage: { inputTokens: 32, outputTokens: 4 },
  };
}
