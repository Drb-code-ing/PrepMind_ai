import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_ENV,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ACCEPTANCE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER,
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ZERO_PROVIDER_ARGUMENT,
  consumePhase698TransportEvidenceT3AdmissionCapability,
  consumePhase698TransportEvidenceT3ReservationCapability,
  createPhase698TransportEvidenceT3SyntheticAdmissionForTest,
  parsePhase698TransportEvidenceT3ProxyReceipt,
  readPhase698TransportEvidenceT3Approval,
  readPhase698TransportEvidenceT3DataBoundary,
  validatePhase698TransportEvidenceT3GateBinding,
  validatePhase698TransportEvidenceT3SourceAdmissionForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-admission.ts';
import {
  executePhase698TransportEvidenceT3CliCore,
  type Phase698TransportEvidenceT3CliCorePorts,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-cli-core.ts';
import {
  PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_SPECS,
  runPhase698TransportEvidenceT3ZeroProvider,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t3-runner.ts';
import { runPhase698TransportEvidenceT2Static } from '../src/evals/phase-6-9-8-retriever-final-response-transport-evidence-t2.ts';

const NONCE = '00000000-0000-4000-8000-000000000001';
const ROOT = 'C:/synthetic-t3';
describe('Phase 6.9.8 Transport Evidence Recovery T3 zero-provider runner', () => {
  test('keeps the fixed three-slot order and never crosses the Provider boundary', () => {
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('T3_FETCH_MUST_NOT_RUN');
    }) as typeof fetch;
    try {
      const report = runPhase698TransportEvidenceT3ZeroProvider();
      expect(report).toMatchObject({
        gate: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE,
        passed: true,
        slotCount: 3,
        startedSlots: 3,
        completedSlots: 3,
        syntheticCalls: 3,
        providerCalls: 0,
        credentialReads: 0,
        formalEvidence: 0,
        productWrites: 0,
        traceWrites: 0,
        qualityAuthority: 'none',
        rawDataRetained: false,
      });
      expect(report.slotOrder).toEqual(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_ORDER);
      expect(
        PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_SLOT_SPECS.reduce(
          (total, slot) => total + slot.maxCostCny,
          0,
        ),
      ).toBe(PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY);
      expect(
        report.slots.every(
          (slot) => slot.providerCalls === 0 && slot.providerWire.executions === 0,
        ),
      ).toBe(true);
      expect(JSON.stringify(report)).not.toContain('T3_FETCH_MUST_NOT_RUN');
    } finally {
      globalThis.fetch = originalFetch;
    }
    expect(fetchCalls).toBe(0);
  });

  test('opens the first-failure breaker and preserves the unstarted suffix', () => {
    const report = runPhase698TransportEvidenceT3ZeroProvider({
      outcomes: ['pass', 'failure', 'pass'],
    });
    expect(report).toMatchObject({
      gate: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED,
      passed: false,
      startedSlots: 2,
      completedSlots: 2,
      notStartedQualityBreaker: 1,
      notStartedExternalAbort: 0,
      breaker: { open: true, reason: 'synthetic_failure', openedAtSequence: 2 },
    });
    expect(report.slots[2]).toMatchObject({
      slot: 'final_response',
      sequence: 3,
      disposition: 'not_started_quality_breaker',
      providerCalls: 0,
      diagnostic: null,
    });
  });

  test('classifies parent abort and budget overflow before any synthetic slot', () => {
    const controller = new AbortController();
    controller.abort();
    const aborted = runPhase698TransportEvidenceT3ZeroProvider({ signal: controller.signal });
    expect(aborted).toMatchObject({
      gate: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED,
      startedSlots: 0,
      notStartedExternalAbort: 3,
      notStartedQualityBreaker: 0,
      breaker: { reason: 'external_abort', openedAtSequence: null },
      providerCalls: 0,
    });

    const overBudget = runPhase698TransportEvidenceT3ZeroProvider({
      requestedBudgetCny: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_MAX_COST_CNY + 0.000001,
    });
    expect(overBudget).toMatchObject({
      gate: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED,
      startedSlots: 0,
      notStartedQualityBreaker: 3,
      breaker: { reason: 'budget_exceeded', openedAtSequence: null },
      providerCalls: 0,
    });
  });

  test('rejects extra or malformed runner input without coercion', () => {
    expect(() =>
      runPhase698TransportEvidenceT3ZeroProvider({
        outcomes: ['pass', 'pass', 'pass', 'pass'] as never,
      }),
    ).not.toThrow();
    const malformed = runPhase698TransportEvidenceT3ZeroProvider({
      outcomes: ['pass', 'pass', 'pass', 'pass'] as never,
    });
    expect(malformed).toMatchObject({
      gate: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE_FAILED,
      breaker: { reason: 'input_invalid' },
      providerCalls: 0,
    });
    expect(() =>
      runPhase698TransportEvidenceT3ZeroProvider({ extra: true } as never),
    ).not.toThrow();
    expect(
      runPhase698TransportEvidenceT3ZeroProvider({ extra: true } as never).breaker.reason,
    ).toBe('input_invalid');
  });
});

describe('Phase 6.9.8 Transport Evidence Recovery T3 admission boundaries', () => {
  test('binds admission to the T2 zero-provider gate and consumes capabilities once', () => {
    const admission = createPhase698TransportEvidenceT3SyntheticAdmissionForTest();
    const t2 = runPhase698TransportEvidenceT2Static();
    expect(validatePhase698TransportEvidenceT3GateBinding(t2)).toBe(true);
    expect(validatePhase698TransportEvidenceT3GateBinding({ ...t2, passedCases: 29 })).toBe(false);
    expect(validatePhase698TransportEvidenceT3GateBinding({ ...t2, authority: 'forged' })).toBe(
      false,
    );

    expect(
      consumePhase698TransportEvidenceT3AdmissionCapability(
        admission.capability,
        admission.authority,
      ),
    ).toMatchObject({
      authority: 'synthetic_test',
      source: admission.source,
    });
    expect(() =>
      consumePhase698TransportEvidenceT3AdmissionCapability(
        admission.capability,
        admission.authority,
      ),
    ).toThrow('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ADMISSION_CAPABILITY_INVALID');
    expect(() =>
      consumePhase698TransportEvidenceT3AdmissionCapability(
        { ...admission.capability },
        'synthetic_test',
      ),
    ).toThrow('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ADMISSION_CAPABILITY_INVALID');
    let getterCalls = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'version', {
      get() {
        getterCalls += 1;
        throw new Error('getter must not run');
      },
    });
    expect(() =>
      consumePhase698TransportEvidenceT3AdmissionCapability(hostile, 'synthetic_test'),
    ).toThrow('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ADMISSION_CAPABILITY_INVALID');
    expect(getterCalls).toBe(0);
  });

  test('keeps reservation capability opaque and rejects forged or reused values', () => {
    const admission = createPhase698TransportEvidenceT3SyntheticAdmissionForTest();
    expect(
      consumePhase698TransportEvidenceT3ReservationCapability(
        admission.reservationCapability,
        ROOT,
      ),
    ).toMatchObject({
      authority: 'synthetic_test',
    });
    expect(() =>
      consumePhase698TransportEvidenceT3ReservationCapability(
        admission.reservationCapability,
        ROOT,
      ),
    ).toThrow('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_RESERVATION_CAPABILITY_INVALID');
    expect(() =>
      consumePhase698TransportEvidenceT3ReservationCapability(
        { ...admission.reservationCapability },
        ROOT,
      ),
    ).toThrow('PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_RESERVATION_CAPABILITY_INVALID');
    let getterCalls = 0;
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'version', {
      get() {
        getterCalls += 1;
        throw new Error('getter must not run');
      },
    });
    expect(() => consumePhase698TransportEvidenceT3ReservationCapability(hostile, ROOT)).toThrow(
      'PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_RESERVATION_CAPABILITY_INVALID',
    );
    expect(getterCalls).toBe(0);
  });

  test('requires exact fresh proxy nonce and refuses unavailable or hostile receipts', () => {
    const ready = {
      nonce: NONCE,
      ok: true,
      code: 'loopback_proxy_ready',
      mode: 'loopback_proxy',
      listener: 'listening',
      listenerProbeCalls: 1,
      providerCalls: 0,
    };
    expect(parsePhase698TransportEvidenceT3ProxyReceipt(ready, NONCE)).toMatchObject({
      code: 'loopback_proxy_ready',
    });
    expect(
      parsePhase698TransportEvidenceT3ProxyReceipt(ready, '00000000-0000-4000-8000-000000000002'),
    ).toBeNull();
    expect(
      parsePhase698TransportEvidenceT3ProxyReceipt(
        { ...ready, code: 'loopback_proxy_unavailable' },
        NONCE,
      ),
    ).toBeNull();
    expect(
      parsePhase698TransportEvidenceT3ProxyReceipt({ ...ready, secret: 'sk-test' }, NONCE),
    ).toBeNull();
  });

  test('reads only fixed own data descriptors for data boundary and approval', () => {
    const env = {
      [PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV]:
        PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ACCEPTANCE,
      [PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_ENV]:
        PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_EXACT_AUTHORIZATION,
    };
    expect(readPhase698TransportEvidenceT3DataBoundary(env)).toBe(true);
    expect(readPhase698TransportEvidenceT3Approval(env)).toBe(true);
    expect(() =>
      readPhase698TransportEvidenceT3Approval({
        ...env,
        [PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_APPROVAL_ENV]: 'continue',
      }),
    ).toThrow();
    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_DATA_BOUNDARY_ENV, {
      get() {
        throw new Error('getter must not run');
      },
    });
    expect(() => readPhase698TransportEvidenceT3DataBoundary(hostile)).toThrow();
  });

  test('pure source comparison detects branch, parity, cleanliness, artifact, and bundle drift', () => {
    const admission = createPhase698TransportEvidenceT3SyntheticAdmissionForTest();
    const source = { ...admission.source, admissionAuthority: 'git_verified' as const };
    const observation = {
      root: ROOT,
      branch: source.branch,
      head: source.commit,
      tracking: source.trackingCommit,
      remote: source.remoteCommit,
      approvedSourceCommit: source.approvedSourceCommit,
      workingTreeClean: source.workingTreeClean,
      formalArtifactCount: source.formalArtifactCount,
      sourceBundleSha256: source.sourceBundleSha256,
    };
    expect(validatePhase698TransportEvidenceT3SourceAdmissionForTest(source, observation)).toBe(
      true,
    );
    expect(
      validatePhase698TransportEvidenceT3SourceAdmissionForTest(
        { ...source, branch: 'main' } as never,
        observation,
      ),
    ).toBe(false);
    expect(
      validatePhase698TransportEvidenceT3SourceAdmissionForTest(
        { ...source, formalArtifactCount: 1 } as never,
        observation,
      ),
    ).toBe(false);
    expect(
      validatePhase698TransportEvidenceT3SourceAdmissionForTest(
        { ...source, sourceBundleSha256: 'f'.repeat(64) },
        observation,
      ),
    ).toBe(false);
  });
});

describe('Phase 6.9.8 Transport Evidence Recovery T3 zero-provider CLI core', () => {
  test('runs gates in order and never exposes a credential port', async () => {
    const admission = createPhase698TransportEvidenceT3SyntheticAdmissionForTest();
    const calls: string[] = [];
    const output: string[] = [];
    const t2 = runPhase698TransportEvidenceT2Static();
    const ports: Phase698TransportEvidenceT3CliCorePorts = {
      readSource: () => {
        calls.push('source');
        return admission;
      },
      readT2Gate: () => {
        calls.push('t2');
        return t2;
      },
      runProxyPreflight: async ({ nonce }) => {
        calls.push('proxy');
        return {
          nonce,
          ok: true,
          code: 'direct_ready',
          mode: 'direct',
          listener: 'not_required',
          listenerProbeCalls: 0,
          providerCalls: 0,
        };
      },
      readDataBoundary: () => {
        calls.push('boundary');
        return true;
      },
      readApproval: () => {
        calls.push('approval');
        return true;
      },
      runZeroProvider: (input) => {
        calls.push('runner');
        return runPhase698TransportEvidenceT3ZeroProvider(input);
      },
      randomUUID: () => NONCE,
      write: (line) => output.push(line),
    };
    const code = await executePhase698TransportEvidenceT3CliCore(
      {
        args: [PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ZERO_PROVIDER_ARGUMENT],
        root: ROOT,
        proxyEnv: {},
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      ports,
    );
    expect(code).toBe(0);
    expect(calls).toEqual(['source', 't2', 'proxy', 'boundary', 'approval', 'runner']);
    expect(JSON.parse(output.at(-1) ?? '{}')).toMatchObject({
      ok: true,
      evidenceSealed: false,
      authority: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_AUTHORITY,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
      gate: PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_GATE,
    });
    expect(output.join('')).not.toContain('sk-');
  });

  test('blocks before later gates when source, proxy, boundary, or approval fails', async () => {
    const admission = createPhase698TransportEvidenceT3SyntheticAdmissionForTest();
    const t2 = runPhase698TransportEvidenceT2Static();
    const calls: string[] = [];
    const base: Phase698TransportEvidenceT3CliCorePorts = {
      readSource: () => {
        calls.push('source');
        return admission;
      },
      readT2Gate: () => {
        calls.push('t2');
        return t2;
      },
      runProxyPreflight: async ({ nonce }) => {
        calls.push('proxy');
        return {
          nonce,
          ok: true,
          code: 'direct_ready',
          mode: 'direct',
          listener: 'not_required',
          listenerProbeCalls: 0,
          providerCalls: 0,
        };
      },
      readDataBoundary: () => {
        calls.push('boundary');
        return true;
      },
      readApproval: () => {
        calls.push('approval');
        return true;
      },
      runZeroProvider: () => {
        calls.push('runner');
        return runPhase698TransportEvidenceT3ZeroProvider();
      },
      randomUUID: () => NONCE,
      write: () => undefined,
    };

    const blocked = await executePhase698TransportEvidenceT3CliCore(
      {
        args: [PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ZERO_PROVIDER_ARGUMENT],
        root: ROOT,
        proxyEnv: {},
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      {
        ...base,
        readDataBoundary: () => {
          calls.push('boundary');
          throw new Error('no boundary');
        },
      },
    );
    expect(blocked).toBe(1);
    expect(calls).toEqual(['source', 't2', 'proxy', 'boundary']);
    calls.splice(0);
    const admission2 = createPhase698TransportEvidenceT3SyntheticAdmissionForTest();
    const proxyBlocked = await executePhase698TransportEvidenceT3CliCore(
      {
        args: [PHASE_6_9_8_TRANSPORT_EVIDENCE_T3_ZERO_PROVIDER_ARGUMENT],
        root: ROOT,
        proxyEnv: {},
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      {
        ...base,
        readSource: () => {
          calls.push('source');
          return admission2;
        },
        runProxyPreflight: async () => {
          calls.push('proxy');
          return { ok: false };
        },
      },
    );
    expect(proxyBlocked).toBe(1);
    expect(calls).toEqual(['source', 't2', 'proxy']);
  });

  test('rejects loose continuation text and hostile extra ports before source access', async () => {
    const calls: string[] = [];
    const result = await executePhase698TransportEvidenceT3CliCore(
      {
        args: ['continue'],
        root: ROOT,
        proxyEnv: {},
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      {
        readSource: () => {
          calls.push('source');
          throw new Error('not reached');
        },
      } as never,
    );
    expect(result).toBe(1);
    expect(calls).toEqual([]);
  });
});
