import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CONTRACT_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_PROXY_ATTESTATION_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION,
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_SCHEMA,
  isPhase697ArchitectureRecoveryProviderCanaryV2C1Report,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c1-contract.ts';
import {
  consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation,
  runPhase697ArchitectureRecoveryProviderCanaryV2C1,
} from '../src/phase-6-9-7-architecture-recovery-provider-canary-v2-c1.ts';
import { PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA } from '../src/phase-6-9-7-architecture-recovery-r2-canary-contract.ts';
import { runPhase697ArchitectureRecoveryR2Canary } from '../src/phase-6-9-7-architecture-recovery-r2-canary-runner.ts';
import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA,
  buildPhase697ArchitectureRecoveryR3CanaryReport,
} from '../src/phase-6-9-7-architecture-recovery-r3-canary-contract.ts';

const LOOPBACK_PROXY = 'http://127.0.0.1:7897';
const RAW_SENTINEL = 'v2-c1-raw-value-must-never-escape';

describe('Phase 6.9.7 Architecture Recovery Provider Canary V2 C1 contract', () => {
  test('freezes a new request, attestation, budget, and report identity', () => {
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_NAMESPACE).toBe(
      'phase-6.9.7-architecture-recovery-provider-canary-v2',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_CONTRACT_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-provider-canary-v2-c1-contract-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-provider-canary-v2-request-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_PROXY_ATTESTATION_VERSION).toBe(
      'phase-6.9.7-architecture-recovery-provider-canary-v2-proxy-attestation-v1',
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_REQUEST_PROFILE).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      responseContract: 'exact-ok-true-json-v1',
      maxOutputTokens: 16,
    });
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET).toMatchObject({
      maxCalls: 1,
      maxInputTokens: 512,
      maxOutputTokens: 16,
      hardCapCny: '0.00200000',
    });
    expect(Object.isFrozen(PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_BUDGET)).toBe(true);
  });

  test('mints one opaque capability only after a direct zero-provider preflight', async () => {
    let probes = 0;
    const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
      { env: {}, signal: new AbortController().signal },
      {
        async probeLoopbackListener() {
          probes += 1;
          return true;
        },
      },
    );

    expect(probes).toBe(0);
    expect(admission.report).toMatchObject({
      authority: 'synthetic_test',
      qualityAuthority: 'none',
      providerHealth: 'unknown',
      zeroNetwork: true,
      disposition: 'preflight_ready',
      preflight: {
        ok: true,
        code: 'direct_ready',
        listenerProbeCalls: 0,
        providerCalls: 0,
      },
      attestation: { status: 'available' },
      downstream: {
        credentialReads: 0,
        sourceReads: 0,
        markerWrites: 0,
        providerDelegates: 0,
        providerCalls: 0,
      },
    });
    expect(admission.attestation).not.toBeNull();
    expect(Object.isFrozen(admission.attestation)).toBe(true);
    expect(Reflect.ownKeys(admission.attestation!)).toEqual([]);
    expect(JSON.stringify(admission.attestation)).toBe('{}');
    expect(
      PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_SCHEMA.parse(admission.report),
    ).toEqual(admission.report);
  });

  test('binds a loopback-ready result without exposing proxy authority', async () => {
    let probes = 0;
    const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
      {
        env: { HTTP_PROXY: LOOPBACK_PROXY, HTTPS_PROXY: LOOPBACK_PROXY },
        signal: new AbortController().signal,
      },
      {
        async probeLoopbackListener() {
          probes += 1;
          return true;
        },
      },
    );

    expect(probes).toBe(1);
    expect(admission.report.preflight).toMatchObject({
      code: 'loopback_proxy_ready',
      configuredProxyVariables: 2,
      listener: 'listening',
      listenerProbeCalls: 1,
      providerCalls: 0,
    });
    expect(JSON.stringify(admission)).not.toContain(LOOPBACK_PROXY);
  });

  test('fails closed without minting or touching downstream work when preflight is not ready', async () => {
    let probes = 0;
    const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
      { env: { HTTPS_PROXY: LOOPBACK_PROXY }, signal: new AbortController().signal },
      {
        async probeLoopbackListener() {
          probes += 1;
          return false;
        },
      },
    );

    expect(probes).toBe(1);
    expect(admission.attestation).toBeNull();
    expect(admission.report).toMatchObject({
      disposition: 'preflight_rejected',
      providerHealth: 'unknown',
      preflight: { code: 'loopback_proxy_unavailable', providerCalls: 0 },
      attestation: { status: 'not_minted' },
      downstream: {
        credentialReads: 0,
        sourceReads: 0,
        markerWrites: 0,
        providerDelegates: 0,
        providerCalls: 0,
      },
    });
  });

  test('never invokes hostile environment getters and never leaks raw failures', async () => {
    let getterReads = 0;
    const env: Record<string, unknown> = {};
    Object.defineProperty(env, 'HTTPS_PROXY', {
      enumerable: true,
      get() {
        getterReads += 1;
        return RAW_SENTINEL;
      },
    });
    const admission = await runPhase697ArchitectureRecoveryProviderCanaryV2C1(
      { env, signal: new AbortController().signal },
      {
        async probeLoopbackListener() {
          throw new Error(RAW_SENTINEL);
        },
      },
    );

    expect(getterReads).toBe(0);
    expect(admission.attestation).toBeNull();
    expect(admission.report.preflight.code).toBe('proxy_environment_invalid');
    expect(JSON.stringify(admission.report)).not.toContain(RAW_SENTINEL);
  });

  test('consumes the opaque capability once and rejects replay, clone, and forgery', async () => {
    const admission = await directAdmission();
    const capability = admission.attestation!;

    const first = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(capability);
    const replay = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(capability);
    const clone = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
      JSON.parse(JSON.stringify(capability)),
    );
    const forgery = consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(
      Object.freeze({ ok: true }),
    );

    expect(first).toMatchObject({
      ok: true,
      code: 'attestation_consumed',
      report: { disposition: 'capability_consumed', attestation: { status: 'consumed' } },
    });
    expect(replay).toMatchObject({
      ok: false,
      code: 'attestation_replayed',
      report: { disposition: 'capability_rejected', attestation: { status: 'rejected' } },
    });
    expect(clone).toEqual({ ok: false, code: 'attestation_invalid', report: null });
    expect(forgery).toEqual({ ok: false, code: 'attestation_invalid', report: null });
  });

  test('permits only one winner under concurrent consumption', async () => {
    const admission = await directAdmission();
    const capability = admission.attestation!;
    const results = await Promise.all(
      Array.from({ length: 16 }, async () =>
        consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(capability),
      ),
    );

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => result.code === 'attestation_replayed')).toHaveLength(15);
    expect(results.every((result) => JSON.stringify(result).includes(RAW_SENTINEL) === false)).toBe(
      true,
    );
  });

  test('rejects valid R2 and R3 reports in both V2 boundaries', async () => {
    const r2 = await runPhase697ArchitectureRecoveryR2Canary({
      mode: 'synthetic',
      scenario: 'complete',
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    });
    const r3 = buildPhase697ArchitectureRecoveryR3CanaryReport(r2);

    for (const legacy of [r2, r3]) {
      expect(isPhase697ArchitectureRecoveryProviderCanaryV2C1Report(legacy)).toBe(false);
      expect(
        PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROVIDER_CANARY_V2_C1_REPORT_SCHEMA.safeParse(legacy)
          .success,
      ).toBe(false);
      expect(consumePhase697ArchitectureRecoveryProviderCanaryV2ProxyAttestation(legacy)).toEqual({
        ok: false,
        code: 'attestation_invalid',
        report: null,
      });
    }

    const v2 = (await directAdmission()).report;
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R2_CANARY_REPORT_SCHEMA.safeParse(v2).success).toBe(
      false,
    );
    expect(PHASE_6_9_7_ARCHITECTURE_RECOVERY_R3_CANARY_REPORT_SCHEMA.safeParse(v2).success).toBe(
      false,
    );
  });
});

async function directAdmission() {
  return runPhase697ArchitectureRecoveryProviderCanaryV2C1(
    { env: {}, signal: new AbortController().signal },
    {
      async probeLoopbackListener() {
        return true;
      },
    },
  );
}
