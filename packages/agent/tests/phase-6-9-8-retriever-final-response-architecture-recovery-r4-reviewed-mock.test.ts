import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY,
  buildPhase698ArchitectureRecoveryR4ReviewedMockStaticV1,
  createPhase698ArchitectureRecoveryR4ReviewedMockCapability,
  runPhase698ArchitectureRecoveryR4ReviewedMockStaticV1,
  validatePhase698ArchitectureRecoveryR4ReviewedMockBytes,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock.ts';
import { PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256 } from '../src/evals/phase-6-9-8-retriever-final-response-manifest.ts';
import {
  PHASE_6_9_8_TASK9C_SEALED_ARTIFACT_SHA256,
  PHASE_6_9_8_TASK9C_SEALED_REPORT_SHA256,
} from '../src/evals/phase-6-9-8-retriever-final-response-architecture-recovery-runner-contract.ts';
import { runPhase698ArchitectureRecoveryR4ReviewedMockCli } from '../scripts/phase-6-9-8-retriever-final-response-architecture-recovery-r4-reviewed-mock.ts';

describe('Phase 6.9.8 Architecture Recovery R4 reviewed Mock/static', () => {
  test('runs the complete 16-guard/64-call production-path checkpoint with Mock-only authority', async () => {
    const bundle = await buildPhase698ArchitectureRecoveryR4ReviewedMockStaticV1();
    expect(bundle.report.gate).toEqual({
      status: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY,
      passed: true,
      qualityAuthority: 'none',
      failureReasons: [],
    });
    expect(bundle.report.counts).toEqual({
      guards: 16,
      rewritePairs: 16,
      finalResponseCases: 16,
      providerCalls: 64,
      deepseekCalls: 32,
      qwenCalls: 32,
    });
    expect(bundle.report.diagnostics).toEqual({
      terminalCount: 64,
      appliedCount: 64,
      failedCount: 0,
      notStartedCount: 0,
    });
    expect(bundle.report.wire).toEqual({
      runner: { reservations: 64, dispatches: 64, harnessReturns: 64, verifiedResults: 64 },
      provider: { executions: 64, dispatches: 64, responses: 64, verifiedUsage: 64 },
    });
    expect(bundle.report.quality).toMatchObject({
      rewriteStrict: 16,
      finalResponseStrict: 16,
      candidateRecallAt5: 1,
      candidateNdcgAt5: 1,
      criticalTargetRecall: 1,
      intentPreservation: 1,
      groundedRubric: 1,
      citationPrecision: 1,
      requiredCitationRecall: 1,
      criticalNoticeRecall: 1,
      unsafeRewriteCount: 0,
      falseToolSuccessCount: 0,
      falseCitationCount: 0,
    });
    expect(bundle.report.execution).toMatchObject({
      providerCalls: 0,
      credentialReads: 0,
      externalProviderCalls: 0,
      qwenExternalCalls: 0,
      deepseekExternalCalls: 0,
      syntheticTransportInvocations: 64,
      sourceAdmissionExecuted: false,
      retry: false,
      replay: false,
      resume: false,
      backfill: false,
      backgroundJob: false,
      outbox: false,
    });
    expect(bundle.report.formalEvidence).toEqual({
      approvedTagCount: 0,
      markerCount: 0,
      journalCount: 0,
      artifactCount: 0,
      recoveryClaimCount: 0,
    });
    expect(bundle.report.qualityAuthority).toBe('none');
  });

  test('keeps source/legacy parity and separates synthetic accounting from Provider cost authority', async () => {
    const bundle = await buildPhase698ArchitectureRecoveryR4ReviewedMockStaticV1();
    expect(bundle.report.sourceIdentities.task8ManifestSha256).toBe(
      PHASE_6_9_8_TASK8_FROZEN_MANIFEST_SHA256,
    );
    expect(bundle.report.sourceIdentities.task9cSealedReportSha256).toBe(
      PHASE_6_9_8_TASK9C_SEALED_REPORT_SHA256,
    );
    expect(bundle.report.sourceIdentities.task9cSealedArtifactSha256).toBe(
      PHASE_6_9_8_TASK9C_SEALED_ARTIFACT_SHA256,
    );
    expect(bundle.report.accounting.deepseek.calls).toBe(32);
    expect(bundle.report.accounting.qwen.calls).toBe(32);
    expect(bundle.report.accounting.aggregateSyntheticCostCny).toBeGreaterThan(0);
    expect(bundle.report.accounting.aggregateVerifiedProviderCostCny).toBeNull();
    expect(bundle.report.antiOracle).toMatchObject({
      actualProductionPath: true,
      expectedRead: false,
      oracleRead: false,
      rawDataRetained: false,
      rawDerivedHashRetained: false,
      credentialRead: false,
      externalProviderCall: false,
      responderFactoryCalls: 16,
      finalExecutorCalls: 16,
    });
    const serialized = JSON.stringify(bundle.report);
    for (const forbidden of [
      'api.deepseek.com',
      'sk-',
      'provider.invalid',
      'case_id_answer_table',
      'expected_output',
      'raw_provider_response',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test('validates canonical bytes and rejects mutation/invalid UTF-8', async () => {
    const bundle = await buildPhase698ArchitectureRecoveryR4ReviewedMockStaticV1();
    await expect(
      validatePhase698ArchitectureRecoveryR4ReviewedMockBytes(bundle.canonicalBytes),
    ).resolves.toEqual({
      ok: true,
      sha256: bundle.sha256,
      gate: PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_STATIC_AUTHORITY,
    });
    await expect(
      validatePhase698ArchitectureRecoveryR4ReviewedMockBytes(
        bundle.canonicalBytes.replace('"passed":true', '"passed":false'),
      ),
    ).resolves.toMatchObject({ ok: false, reasonCode: 'bytes_mismatch' });
    await expect(
      validatePhase698ArchitectureRecoveryR4ReviewedMockBytes(new Uint8Array([0xff, 0xfe])),
    ).resolves.toEqual({ ok: false, reasonCode: 'invalid_utf8' });
  });

  test('consumes the R4 capability once and does not accept a Live-shaped run', async () => {
    const capability = createPhase698ArchitectureRecoveryR4ReviewedMockCapability();
    const first = await runPhase698ArchitectureRecoveryR4ReviewedMockStaticV1(capability);
    expect(first.report.gate.passed).toBe(true);
    await expect(runPhase698ArchitectureRecoveryR4ReviewedMockStaticV1(capability)).rejects.toThrow(
      'PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_CAPABILITY_INVALID',
    );
  });

  test('keeps the public CLI closed unless argv is exactly one mock token', async () => {
    for (const args of [[], ['live'], ['seal'], ['validate'], ['mock', 'mock']] as const) {
      await expect(runPhase698ArchitectureRecoveryR4ReviewedMockCli(args)).rejects.toThrow(
        'PHASE_6_9_8_ARCHITECTURE_RECOVERY_R4_ONLY_MOCK',
      );
    }
  });
});
