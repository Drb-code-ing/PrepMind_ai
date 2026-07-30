import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_APPROVAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTRACT_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CRASH_SEAL_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CREDENTIAL_ENV,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RECORD_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX,
  buildPhase697ArchitectureRecoveryProviderCanaryV2C2Artifact,
  buildPhase697ArchitectureRecoveryProviderCanaryV2C2Marker,
  buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report,
  calculatePhase697ArchitectureRecoveryProviderCanaryV2C2Cost,
  phase697ArchitectureRecoveryProviderCanaryV2C2ArtifactPath,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c2-contract.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_PROXY_ATTESTATION_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c1-contract.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_PREFIX,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CRASH_SEAL_CONFIRMATION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_RELATIVE_PATH,
  buildPhase697ArchitectureRecoveryR3CanaryMarker,
} from '../src/phase-6-9-7-architecture-recovery-r3-canary-contract.ts';
import { PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION } from '../src/phase-6-9-7-architecture-recovery-proxy-preflight.ts';
import { PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION } from '../src/phase-6-9-7-v7-wire-diagnostics.ts';

const RUN_ID = '33333333-3333-4333-8333-333333333333';
const OWNER_TOKEN = '44444444-4444-4444-8444-444444444444';
const COMMIT = 'a'.repeat(40);
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SOURCE = Object.freeze({
  version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_VERSION,
  branch: 'codex/phase-6-9-7-tutor-wrong-question-agents' as const,
  commit: COMMIT,
  trackingCommit: COMMIT,
  remoteCommit: COMMIT,
  trackedWorktreeClean: true as const,
  formalArtifactCount: 0 as const,
  r3BundleValid: true as const,
  r3RunId: '253a5df5-c443-4950-b517-849efb941728' as const,
  r3MarkerSha256: '6eef1a3244b162e42fb784f7601e3518653fc40297735cfeb8ed2c2eb0c89b6a' as const,
  r3JournalSha256: '426d64622ef71b88aa4154ca479fcc823d0d23a90c6f7daae0bb4a3cebcb7f7b' as const,
  r3ArtifactSha256: '56fb5b1d196d2af9cc4aab5476d766d87ca9d794896e3c93df9268d13e62e6c4' as const,
});
const PROXY = Object.freeze({
  version: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_PROXY_ATTESTATION_VERSION,
  preflightVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_VERSION,
  mode: 'direct' as const,
  configuredProxyVariables: 0 as const,
  listener: 'not_required' as const,
  listenerProbeCalls: 0 as const,
  providerCalls: 0 as const,
});

describe('Phase 6.9.7 Provider Canary V2 C2 contract', () => {
  test('freezes a new source, report, durability, and authorization identity', () => {
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTRACT_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-provider-canary-v2-c2-contract-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX).toBe(
      'phase-6-9-7-architecture-recovery-provider-canary-v2',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_APPROVAL_ENV).toBe(
      'PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_APPROVED',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CREDENTIAL_ENV).toBe(
      'PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_DEEPSEEK_API_KEY',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION).toBe(
      'I_AUTHORIZE_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_ONCE',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION).not.toContain(
      'RECOVERY_R3',
    );
  });

  test('requires branch, tracking, remote, clean, artifact-zero, and sealed R3 parity', () => {
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA.parse(SOURCE),
    ).toEqual(SOURCE);
    for (const invalid of [
      { ...SOURCE, commit: 'b'.repeat(40) },
      { ...SOURCE, remoteCommit: 'b'.repeat(40) },
      { ...SOURCE, trackedWorktreeClean: false },
      { ...SOURCE, formalArtifactCount: 1 },
      { ...SOURCE, r3BundleValid: false },
      { ...SOURCE, r3MarkerSha256: 'd'.repeat(64) },
      { ...SOURCE, extra: true },
    ]) {
      expect(
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_SOURCE_SCHEMA.safeParse(invalid)
          .success,
      ).toBe(false);
    }
  });

  test('keeps V2 and sealed R3 confirmation, filename, and marker identities bidirectionally isolated', () => {
    const v2Marker = buildPhase697ArchitectureRecoveryProviderCanaryV2C2Marker({
      runId: RUN_ID,
      createdAt: '2026-07-30T10:00:00.000Z',
      ownerProcessId: 123,
      ownerToken: OWNER_TOKEN,
      source: SOURCE,
      proxyAttestation: PROXY,
    });
    const r3Marker = buildPhase697ArchitectureRecoveryR3CanaryMarker({
      runId: RUN_ID,
      createdAt: '2026-07-30T10:00:00.000Z',
      ownerProcessId: 123,
      ownerToken: OWNER_TOKEN,
      source: {
        branch: 'codex/phase-6-9-7-tutor-wrong-question-agents',
        commit: COMMIT,
        trackingCommit: COMMIT,
        trackedWorktreeClean: true,
      },
    });

    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_SCHEMA.safeParse(v2Marker).success,
    ).toBe(false);
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_SCHEMA.safeParse(r3Marker)
        .success,
    ).toBe(false);
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONFIRMATION).not.toBe(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CONFIRMATION,
    );
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CRASH_SEAL_CONFIRMATION,
    ).not.toBe(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_CRASH_SEAL_CONFIRMATION);
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX).not.toBe(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_ARTIFACT_PREFIX,
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_RELATIVE_PATH).not.toBe(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_MARKER_RELATIVE_PATH,
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RELATIVE_PATH).not.toBe(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_JOURNAL_RELATIVE_PATH,
    );
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_RECOVERY_CLAIM_RELATIVE_PATH,
    ).not.toBe(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_RECOVERY_CLAIM_RELATIVE_PATH);
  });

  test('builds only a bounded independent synthetic report', () => {
    const report = buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
      authority: 'synthetic_test',
      executorProvenance: 'synthetic_test',
      outcome: 'complete',
      responseObserved: true,
      strictResponseObserved: true,
      providerFailureCategory: null,
      structuredOutputStage: null,
      transportSubtype: null,
      wire: {
        version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
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
      usage: { inputTokens: 64, outputTokens: 4 },
    });
    expect(report).toMatchObject({
      namespace: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
      requestVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION,
      budgetVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET_VERSION,
      authority: 'synthetic_test',
      executorProvenance: 'synthetic_test',
      qualityAuthority: 'none',
      providerHealth: 'unknown',
      outcome: 'complete',
      usage: { inputTokens: 64, outputTokens: 4 },
    });
    expect(report.cost).toEqual({
      version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-price-v1',
      currency: 'CNY',
      nonCachedInputCnyPerMillionTokens: '3.00000000',
      outputCnyPerMillionTokens: '6.00000000',
      hardCapCny: '0.00200000',
      estimatedCostCny: '0.00021600',
      withinHardCap: true,
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.wire.counters)).toBe(true);
    expect(JSON.stringify(report)).not.toContain('provider-canary-report-v1');
  });

  test('upgrades provider health only for controlled-Live strict response plus verified usage', () => {
    const controlled = buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
      authority: 'controlled_live',
      executorProvenance: 'deepseek_network',
      outcome: 'complete',
      responseObserved: true,
      strictResponseObserved: true,
      providerFailureCategory: null,
      structuredOutputStage: null,
      transportSubtype: null,
      wire: successfulWire(),
      usage: { inputTokens: 64, outputTokens: 4 },
    });
    expect(controlled.providerHealth).toBe('strict_response_with_verified_usage');
    expect(() =>
      buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
        authority: 'controlled_live',
        executorProvenance: 'synthetic_test',
        outcome: 'complete',
        responseObserved: true,
        strictResponseObserved: true,
        providerFailureCategory: null,
        structuredOutputStage: null,
        transportSubtype: null,
        wire: successfulWire(),
        usage: { inputTokens: 64, outputTokens: 4 },
      }),
    ).toThrow('INVALID_PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT');
  });

  test('rejects legacy C1/R2/R3 report identities and raw fields', () => {
    for (const legacy of [
      { version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-report-v1' },
      { version: 'phase-6.9.7-architecture-recovery-r2-provider-canary-report-v1' },
      { version: 'phase-6.9.7-architecture-recovery-r3-provider-canary-report-v1' },
      { ...minimalInvalidReport(), rawError: 'secret' },
      { ...minimalInvalidReport(), credential: 'secret' },
      { ...minimalInvalidReport(), responseBody: '{"ok":true}' },
    ]) {
      expect(
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_REPORT_SCHEMA.safeParse(legacy)
          .success,
      ).toBe(false);
    }
  });

  test('builds a marker without serializing the opaque capability or proxy address', () => {
    const marker = buildPhase697ArchitectureRecoveryProviderCanaryV2C2Marker({
      runId: RUN_ID,
      createdAt: '2026-07-30T10:00:00.000Z',
      ownerProcessId: 123,
      ownerToken: OWNER_TOKEN,
      source: SOURCE,
      proxyAttestation: PROXY,
    });
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_MARKER_SCHEMA.parse(marker),
    ).toEqual(marker);
    expect(marker).toMatchObject({
      runId: RUN_ID,
      authority: 'controlled_live',
      maxProviderCalls: 1,
      retry: false,
      resume: false,
      replay: false,
    });
    expect(JSON.stringify(marker)).not.toMatch(/127\.0\.0\.1|7897|https?:\/\//u);
    expect(JSON.stringify(marker)).not.toContain('capability');
  });

  test('couples artifact authority, status, report, hashes, and attempt disposition', () => {
    const report = buildPhase697ArchitectureRecoveryProviderCanaryV2C2Report({
      authority: 'synthetic_test',
      executorProvenance: 'synthetic_test',
      outcome: 'transport_failed',
      responseObserved: false,
      strictResponseObserved: false,
      providerFailureCategory: 'transport',
      structuredOutputStage: null,
      transportSubtype: 'dns',
      wire: failedWire(),
      usage: null,
    });
    const artifact = buildPhase697ArchitectureRecoveryProviderCanaryV2C2Artifact({
      runId: RUN_ID,
      generatedAt: '2026-07-30T10:00:01.000Z',
      source: SOURCE,
      proxyAttestation: PROXY,
      markerSha256: SHA_A,
      terminalSequence: 4,
      terminalRecordHash: SHA_B,
      completionMode: 'runtime',
      publicationMode: 'runtime',
      recoveryClaimSha256: null,
      report,
    });
    expect(artifact).toMatchObject({
      authority: 'synthetic_test',
      status: 'synthetic_test_only',
      qualityAuthority: 'none',
      attemptDisposition: 'dispatched_no_response',
    });
    expect(artifact.durability.terminalReportSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA.parse(artifact),
    ).toEqual(artifact);
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_SCHEMA.safeParse({
        ...artifact,
        authority: 'controlled_live',
      }).success,
    ).toBe(false);
    expect(phase697ArchitectureRecoveryProviderCanaryV2C2ArtifactPath({ runId: RUN_ID })).toBe(
      `.tmp/${PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_ARTIFACT_PREFIX}-${RUN_ID}.json`,
    );
  });

  test('rejects malformed journal hashes, old versions, and raw values', () => {
    const base = {
      version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-journal-v1',
      runId: RUN_ID,
      sequence: 1,
      recordedAt: '2026-07-30T10:00:00.000Z',
      event: 'attempt_reserved',
      previousHash: null,
      markerSha256: SHA_A,
      sourceSha256: SHA_B,
      proxyAttestationSha256: SHA_C,
      wireStage: null,
      outcome: null,
      reportSha256: null,
      evidenceSha256: null,
      recoveryClaimSha256: null,
      completionMode: null,
      report: null,
      recordHash: SHA_A,
    } as const;
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RECORD_SCHEMA.safeParse(base)
        .success,
    ).toBe(true);
    for (const invalid of [
      { ...base, version: 'phase-6.9.7-architecture-recovery-r3-provider-canary-journal-v1' },
      { ...base, previousHash: 'bad' },
      { ...base, sequence: 0 },
      { ...base, rawError: 'secret' },
    ]) {
      expect(
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_JOURNAL_RECORD_SCHEMA.safeParse(
          invalid,
        ).success,
      ).toBe(false);
    }
  });

  test('calculates the fixed price without floating-point authority drift', () => {
    expect(calculatePhase697ArchitectureRecoveryProviderCanaryV2C2Cost(null)).toEqual({
      estimatedCostCny: null,
      withinHardCap: null,
    });
    expect(
      calculatePhase697ArchitectureRecoveryProviderCanaryV2C2Cost({
        inputTokens: 512,
        outputTokens: 16,
      }),
    ).toEqual({ estimatedCostCny: '0.00163200', withinHardCap: true });
  });
});

function successfulWire() {
  return {
    version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
    state: 'succeeded' as const,
    lastCompletedStage: 'usage_validated' as const,
    failureCategory: null,
    counters: {
      executorInvocations: 1 as const,
      providerDispatches: 1 as const,
      providerResponses: 1 as const,
      verifiedUsages: 1 as const,
    },
  };
}

function failedWire() {
  return {
    version: PHASE_6_9_7_V7_WIRE_DIAGNOSTICS_VERSION,
    state: 'failed' as const,
    lastCompletedStage: 'provider_dispatch_started' as const,
    failureCategory: 'transport' as const,
    counters: {
      executorInvocations: 1 as const,
      providerDispatches: 1 as const,
      providerResponses: 0 as const,
      verifiedUsages: 0 as const,
    },
  };
}

function minimalInvalidReport() {
  return {
    version: 'phase-6.9.7-architecture-recovery-provider-canary-v2-c2-report-v1',
    contractVersion: PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C2_CONTRACT_VERSION,
  };
}
