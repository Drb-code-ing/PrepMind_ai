import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_AUTHORITY,
  PHASE_6_9_8_SR5_NEXT_LINEAGE,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256,
  PHASE_6_9_8_SR5_SEALED_V2_RECEIPT,
  consumePhase698Sr5NextLineageAdmissionCapability,
  createPhase698Sr5NextLineageSyntheticAdmissionForTest,
  createPhase698Sr5NextLineageSyntheticObservationForTest,
  isPhase698Sr5NextLineageEvidenceRelativePath,
  parsePhase698Sr5NextLineageAdmissionArgs,
  validatePhase698Sr5NextLineageObservationForTest,
  type Phase698Sr5NextLineageRepositoryObservation,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-admission.ts';

describe('Phase 6.9.8 SR5 next-lineage zero-provider admission', () => {
  test('freezes an independent identity, future tag and immutable sealed predecessor receipt', () => {
    expect(PHASE_6_9_8_SR5_NEXT_LINEAGE).toEndWith('live-v2');
    expect(PHASE_6_9_8_SR5_NEXT_LINEAGE_FUTURE_TAG).toEndWith('live-v3-approved');
    expect(PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST_SHA256).toMatch(/^sha256:[0-9a-f]{64}$/u);
    expect(PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST.sealedPredecessor).toEqual(
      PHASE_6_9_8_SR5_SEALED_V2_RECEIPT,
    );
    expect(PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.providerCalls).toBe(0);
    expect(PHASE_6_9_8_SR5_SEALED_V2_RECEIPT.qualityAuthority).toBe('none');
    expect(Object.isFrozen(PHASE_6_9_8_SR5_NEXT_LINEAGE_SOURCE_MANIFEST)).toBe(true);
  });

  test('issues a module-owned single-use capability with no Live authority', () => {
    const issued = createPhase698Sr5NextLineageSyntheticAdmissionForTest();
    expect(issued.admission).toMatchObject({
      version: PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION,
      authority: PHASE_6_9_8_SR5_NEXT_LINEAGE_AUTHORITY,
      qualityAuthority: 'none',
      mode: 'zero_provider_admission',
      providerDispatchAllowed: false,
      credentialReads: 0,
      providerCalls: 0,
      formalEvidence: 0,
      businessWrites: 0,
      futureTagCreated: false,
      liveAuthorizationDefined: false,
      dataBoundaryAcceptanceDefined: false,
    });
    expect(
      consumePhase698Sr5NextLineageAdmissionCapability(issued.capability, 'synthetic_test'),
    ).toBe(issued.admission);
    expect(() =>
      consumePhase698Sr5NextLineageAdmissionCapability(issued.capability, 'synthetic_test'),
    ).toThrow('PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_CAPABILITY_INVALID');
  });

  test('rejects forged capability and authority relabeling', () => {
    const issued = createPhase698Sr5NextLineageSyntheticAdmissionForTest();
    expect(() =>
      consumePhase698Sr5NextLineageAdmissionCapability(issued.capability, 'git_verified'),
    ).toThrow('PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_CAPABILITY_INVALID');
    expect(() =>
      consumePhase698Sr5NextLineageAdmissionCapability(
        { version: PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_VERSION },
        'synthetic_test',
      ),
    ).toThrow('PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_CAPABILITY_INVALID');
    const hostileCapability = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('raw-secret-must-not-escape');
        },
      },
    );
    expect(() =>
      consumePhase698Sr5NextLineageAdmissionCapability(hostileCapability, 'synthetic_test'),
    ).toThrow('PHASE_6_9_8_SR5_NEXT_LINEAGE_ADMISSION_CAPABILITY_INVALID');
  });

  test.each([
    ['old branch', { branch: 'drb/phase-6-9-8-sr5-proxy-port-recovery' }],
    ['dirty source', { clean: false }],
    ['head/upstream drift', { upstream: 'c'.repeat(40) }],
    ['head/origin drift', { origin: 'd'.repeat(40) }],
    ['future tag already exists', { futureTagExists: true }],
    ['new evidence exists', { currentLineageEvidencePaths: ['.tmp/example.marker'] }],
    ['old tag object moved', { sealedV2TagObjectId: 'e'.repeat(40) }],
    ['old peeled commit moved', { sealedV2PeeledCommit: 'f'.repeat(40) }],
    ['invalid bundle', { sourceBundleSha256: 'sha256:not-a-sha' }],
  ])('fails closed for %s', (_name, patch) => {
    const baseline = createPhase698Sr5NextLineageSyntheticObservationForTest();
    const observation = { ...baseline, ...patch } as Phase698Sr5NextLineageRepositoryObservation;
    expect(validatePhase698Sr5NextLineageObservationForTest(observation)).toBe(false);
  });

  test('accepts only the bounded zero-provider inspection CLI vocabulary', () => {
    expect(parsePhase698Sr5NextLineageAdmissionArgs([]).kind).toBe('help');
    expect(parsePhase698Sr5NextLineageAdmissionArgs(['--help']).kind).toBe('help');
    expect(parsePhase698Sr5NextLineageAdmissionArgs(['--inspect-zero-provider']).kind).toBe(
      'inspect_zero_provider',
    );
    for (const args of [
      ['live'],
      ['--live'],
      ['recover'],
      ['seal'],
      ['I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_CONTROLLED_LIVE_ONCE'],
      ['--inspect-zero-provider', 'extra'],
    ]) {
      expect(parsePhase698Sr5NextLineageAdmissionArgs(args).kind).toBe('rejected');
    }
  });

  test('keeps v3 evidence names isolated from sealed v1/v2 names', () => {
    const runId = '9eb57600-97e2-4513-8654-8686b38e856e';
    expect(
      isPhase698Sr5NextLineageEvidenceRelativePath(
        '.tmp/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v3.marker',
      ),
    ).toBe(true);
    expect(
      isPhase698Sr5NextLineageEvidenceRelativePath(
        `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v3-${runId}.journal.jsonl`,
      ),
    ).toBe(true);
    expect(
      isPhase698Sr5NextLineageEvidenceRelativePath(
        'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live.marker',
      ),
    ).toBe(false);
    expect(
      isPhase698Sr5NextLineageEvidenceRelativePath(
        `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-${runId}.report.json`,
      ),
    ).toBe(false);
  });

  test('fails closed without leaking hostile observation accessor errors', () => {
    const hostile = new Proxy(createPhase698Sr5NextLineageSyntheticObservationForTest(), {
      get() {
        throw new Error('raw-secret-must-not-escape');
      },
    });
    expect(validatePhase698Sr5NextLineageObservationForTest(hostile)).toBe(false);
  });

  test('does not inspect environment or install network hooks', () => {
    let environmentReads = 0;
    const originalEnvironment = process.env;
    const fetchBefore = globalThis.fetch;
    try {
      Object.defineProperty(process, 'env', {
        configurable: true,
        value: new Proxy(originalEnvironment, {
          get() {
            environmentReads += 1;
            throw new Error('environment access forbidden');
          },
        }),
      });
      const issued = createPhase698Sr5NextLineageSyntheticAdmissionForTest();
      expect(issued.admission.providerCalls).toBe(0);
    } finally {
      Object.defineProperty(process, 'env', { configurable: true, value: originalEnvironment });
    }
    expect(environmentReads).toBe(0);
    expect(globalThis.fetch).toBe(fetchBefore);
  });
});
