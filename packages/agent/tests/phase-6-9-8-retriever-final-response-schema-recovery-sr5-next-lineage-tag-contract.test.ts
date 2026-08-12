import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_AUTHORITY,
  PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CONTRACT_VERSION,
  consumePhase698Sr5NextLineageTagCapability,
  createPhase698Sr5NextLineageSyntheticTagBindingForTest,
  createPhase698Sr5NextLineageSyntheticTagObservationForTest,
  createPhase698Sr5NextLineageTagMessage,
  validatePhase698Sr5NextLineageTagObservationForTest,
  type Phase698Sr5NextLineageTagObservation,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-tag-contract.ts';

describe('Phase 6.9.8 SR5 next-lineage annotated tag contract', () => {
  test('freezes a canonical zero-provider annotated tag message', () => {
    const message = createPhase698Sr5NextLineageTagMessage(`sha256:${'a'.repeat(64)}`);
    expect(message).toContain('Phase 6.9.8 SR5 next-lineage v3 approved source');
    expect(message).toContain(
      'lineage=phase-6.9.8-retriever-final-response-schema-recovery-sr5-live-v2',
    );
    expect(message).toContain(`sourceBundleSha256=sha256:${'a'.repeat(64)}`);
    expect(message).toContain(
      'providerCalls:0,credentialReads:0,formalEvidence:0,businessWrites:0',
    );
    expect(() => createPhase698Sr5NextLineageTagMessage('invalid')).toThrow(
      'PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_SOURCE_BUNDLE_INVALID',
    );
  });

  test('issues a single-use zero-provider tag binding without Live authority', () => {
    const issued = createPhase698Sr5NextLineageSyntheticTagBindingForTest();
    expect(issued.binding).toMatchObject({
      version: PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CONTRACT_VERSION,
      authority: PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_AUTHORITY,
      qualityAuthority: 'none',
      mode: 'zero_provider_tag_parity',
      branch: 'main',
      annotatedTagVerified: true,
      providerDispatchAllowed: false,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
      businessWrites: 0,
      liveAuthorizationDefined: false,
      dataBoundaryAcceptanceDefined: false,
    });
    expect(consumePhase698Sr5NextLineageTagCapability(issued.capability, 'synthetic_test')).toBe(
      issued.binding,
    );
    expect(() =>
      consumePhase698Sr5NextLineageTagCapability(issued.capability, 'synthetic_test'),
    ).toThrow('PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CAPABILITY_INVALID');
  });

  test.each([
    ['feature branch', { branch: 'drb/phase-6-9-8-sr5-next-lineage-tag-contract' }],
    ['dirty tree', { clean: false }],
    ['upstream drift', { upstream: 'd'.repeat(40) }],
    ['origin drift', { origin: 'e'.repeat(40) }],
    ['lightweight tag', { tag: { objectKind: 'commit' } }],
    ['tag name drift', { tag: { name: 'wrong' } }],
    ['tag ref drift', { tag: { ref: 'refs/tags/wrong' } }],
    ['peeled drift', { tag: { peeledCommit: 'f'.repeat(40) } }],
    ['target drift', { tag: { targetCommit: '1'.repeat(40) } }],
    ['message drift', { tag: { message: 'wrong' } }],
    ['tag object invalid', { tag: { objectId: 'wrong' } }],
    ['origin tag missing', { tag: { originObjectId: '' } }],
    ['origin tag mismatch', { tag: { originObjectId: '4'.repeat(40) } }],
    ['bundle invalid', { sourceBundleSha256: 'wrong' }],
    ['v3 evidence exists', { currentLineageEvidencePaths: ['.tmp/v3.marker'] }],
    ['sealed tag moved', { sealedV2TagObjectId: '2'.repeat(40) }],
    ['sealed commit moved', { sealedV2PeeledCommit: '3'.repeat(40) }],
  ])('fails closed for %s', (_name, patch) => {
    const baseline = createPhase698Sr5NextLineageSyntheticTagObservationForTest();
    const observation = {
      ...baseline,
      ...patch,
      tag: 'tag' in patch ? { ...baseline.tag, ...patch.tag } : baseline.tag,
    } as Phase698Sr5NextLineageTagObservation;
    expect(validatePhase698Sr5NextLineageTagObservationForTest(observation)).toBe(false);
  });

  test('rejects forged, relabeled and hostile capabilities with a fixed error', () => {
    const issued = createPhase698Sr5NextLineageSyntheticTagBindingForTest();
    expect(() =>
      consumePhase698Sr5NextLineageTagCapability(issued.capability, 'git_verified'),
    ).toThrow('PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CAPABILITY_INVALID');
    expect(() =>
      consumePhase698Sr5NextLineageTagCapability(
        { version: PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CONTRACT_VERSION },
        'synthetic_test',
      ),
    ).toThrow('PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CAPABILITY_INVALID');
    const hostile = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: () => {
          throw new Error('raw');
        },
      },
    );
    expect(() => consumePhase698Sr5NextLineageTagCapability(hostile, 'synthetic_test')).toThrow(
      'PHASE_6_9_8_SR5_NEXT_LINEAGE_TAG_CAPABILITY_INVALID',
    );
  });

  test('contains hostile observation accessors and performs no environment or fetch access', () => {
    const hostile = new Proxy(createPhase698Sr5NextLineageSyntheticTagObservationForTest(), {
      get() {
        throw new Error('raw-secret-must-not-escape');
      },
    });
    expect(validatePhase698Sr5NextLineageTagObservationForTest(hostile)).toBe(false);
    const environment = process.env;
    const fetchBefore = globalThis.fetch;
    let reads = 0;
    try {
      Object.defineProperty(process, 'env', {
        configurable: true,
        value: new Proxy(environment, {
          get() {
            reads += 1;
            throw new Error('forbidden');
          },
        }),
      });
      createPhase698Sr5NextLineageSyntheticTagBindingForTest();
    } finally {
      Object.defineProperty(process, 'env', { configurable: true, value: environment });
    }
    expect(reads).toBe(0);
    expect(globalThis.fetch).toBe(fetchBefore);
  });
});
