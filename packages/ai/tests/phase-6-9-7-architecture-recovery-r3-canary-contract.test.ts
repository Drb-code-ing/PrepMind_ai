import { describe, expect, test } from 'bun:test';

import { type Phase697ArchitectureRecoveryR2CanaryReport } from '../src/phase-6-9-7-architecture-recovery-r2-canary-contract.ts';
import {
  buildPhase697ArchitectureRecoveryR3CanaryArtifact,
  buildPhase697ArchitectureRecoveryR3CanaryMarker,
  buildPhase697ArchitectureRecoveryR3CanaryReport,
  phase697ArchitectureRecoveryR3CanaryArtifactPath,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_APPROVAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONTROLLED_LIVE_BRANCH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CREDENTIAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_PROFILE,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_VERSION,
  type Phase697ArchitectureRecoveryR3CanarySource,
} from '../src/phase-6-9-7-architecture-recovery-r3-canary-contract.ts';

const RUN_ID = '11111111-2222-4333-8444-555555555555';
const GENERATED_AT = '2026-07-30T12:00:00.000Z';
const HASH_A = 'a'.repeat(64);
const HASH_B = 'b'.repeat(64);

describe('Phase 6.9.7 Architecture Recovery R3 canary contract', () => {
  test('freezes an independent controlled-Live identity and exact one-call price cap', () => {
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-r3-provider-canary-report-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-r3-provider-canary-artifact-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-r3-provider-canary-marker-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-r3-provider-canary-journal-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_PROFILE).toEqual({
      version: 'phase-6.9.7-architecture-recovery-r3-deepseek-v4-pro-price-v1',
      currency: 'CNY',
      nonCachedInputCnyPerMillionTokens: '3.00000000',
      outputCnyPerMillionTokens: '6.00000000',
      hardCapCny: '0.00200000',
    });
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONTROLLED_LIVE_BRANCH).toBe(
      'codex/phase-6-9-7-tutor-wrong-question-agents',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_APPROVAL_ENV).not.toBe(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CREDENTIAL_ENV,
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION).toContain(
      'CONTROLLED_LIVE_ONCE',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH).not.toContain(RUN_ID);
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH).not.toMatch(
      /tutor-organizer-v[1-9]|recovery-claim/u,
    );
    expect(Object.isFrozen(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_PRICE_PROFILE)).toBe(true);
  });

  test('wraps the R2 request/report contract without upgrading synthetic authority', () => {
    const report = buildPhase697ArchitectureRecoveryR3CanaryReport(baseReport('synthetic_test'));
    expect(report).toMatchObject({
      version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_VERSION,
      authority: 'synthetic_test',
      cost: {
        estimatedCostCny: '0.00012000',
        withinHardCap: true,
      },
    });
    expect(report.providerReport.authority).toBe('synthetic_test');
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA.safeParse(report).success,
    ).toBe(true);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.providerReport)).toBe(true);
    expect(Object.isFrozen(report.cost)).toBe(true);

    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA.safeParse({
        ...report,
        authority: 'controlled_live',
      }).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA.safeParse({
        ...report,
        rawResponse: '{"ok":true}',
      }).success,
    ).toBe(false);
  });

  test('builds only controlled-Live formal artifacts with coupled durability facts', () => {
    const source = sourceState();
    const marker = buildPhase697ArchitectureRecoveryR3CanaryMarker({
      runId: RUN_ID,
      createdAt: GENERATED_AT,
      ownerProcessId: process.pid,
      ownerToken: '22222222-3333-4444-8555-666666666666',
      source,
    });
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA.safeParse(marker).success,
    ).toBe(true);
    expect(marker).toMatchObject({
      authority: 'controlled_live',
      maxProviderCalls: 1,
      retry: false,
      resume: false,
      replay: false,
    });

    const report = buildPhase697ArchitectureRecoveryR3CanaryReport(baseReport('controlled_live'));
    const artifact = buildPhase697ArchitectureRecoveryR3CanaryArtifact({
      runId: RUN_ID,
      generatedAt: GENERATED_AT,
      source,
      markerSha256: HASH_A,
      terminalSequence: 9,
      terminalRecordHash: HASH_B,
      completionMode: 'runtime_terminal',
      publicationMode: 'runtime',
      recoveryClaimSha256: null,
      report,
    });
    expect(artifact).toMatchObject({
      authority: 'controlled_live',
      status: 'diagnostic_only',
      qualityAuthority: 'none',
      attemptDisposition: 'response_observed',
      durability: {
        markerSha256: HASH_A,
        terminalSequence: 9,
        terminalRecordHash: HASH_B,
        completionMode: 'runtime_terminal',
        publicationMode: 'runtime',
        recoveryClaimSha256: null,
        publication: 'exclusive_hard_link',
      },
    });
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_SCHEMA.safeParse(artifact).success,
    ).toBe(true);
    expect(phase697ArchitectureRecoveryR3CanaryArtifactPath({ runId: RUN_ID })).toBe(
      `.tmp/phase-6-9-7-architecture-recovery-r3-provider-canary-${RUN_ID}.json`,
    );
    expect(JSON.stringify(artifact)).not.toMatch(
      /apiKey|authorization|systemPrompt|userPrompt|responseBody|rawError|api\.deepseek\.com/u,
    );

    expect(() =>
      buildPhase697ArchitectureRecoveryR3CanaryArtifact({
        runId: RUN_ID,
        generatedAt: GENERATED_AT,
        source,
        markerSha256: HASH_A,
        terminalSequence: 9,
        terminalRecordHash: HASH_B,
        completionMode: 'runtime_terminal',
        publicationMode: 'runtime',
        recoveryClaimSha256: null,
        report: buildPhase697ArchitectureRecoveryR3CanaryReport(baseReport('synthetic_test')),
      }),
    ).toThrow('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT');
  });
});

function sourceState(): Phase697ArchitectureRecoveryR3CanarySource {
  return {
    branch: PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONTROLLED_LIVE_BRANCH,
    commit: '1'.repeat(40),
    trackingCommit: '1'.repeat(40),
    trackedWorktreeClean: true,
  };
}

function baseReport(
  authority: 'synthetic_test' | 'controlled_live',
): Phase697ArchitectureRecoveryR2CanaryReport {
  return {
    version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-report-v1',
    requestVersion: 'phase-6.9.7-architecture-recovery-r2-provider-canary-request-v1',
    authority,
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
      version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-budget-v1',
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
