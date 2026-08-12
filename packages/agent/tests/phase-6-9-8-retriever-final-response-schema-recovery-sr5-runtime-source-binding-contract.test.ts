import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_SR5_RUNTIME_AUTHORIZATION_CONFIRMATION,
  bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider,
  createPhase698Sr5RuntimeSourceBindingInputForTest,
  parsePhase698Sr5RuntimeSourceBindingArgs,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-runtime-source-binding-contract.ts';

describe('Phase 6.9.8 SR5 runtime source binding contract', () => {
  test('binds dynamic final tag identity without hard-coding commit, bundle, or tag object', () => {
    const input = createPhase698Sr5RuntimeSourceBindingInputForTest(
      'd'.repeat(40),
      `sha256:${'e'.repeat(64)}`,
      'f'.repeat(40),
    );
    const result = bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record).toMatchObject({
      qualityAuthority: 'none',
      mode: 'zero_provider_runtime_source_binding_contract',
      source: {
        head: 'd'.repeat(40),
        sourceBundleSha256: `sha256:${'e'.repeat(64)}`,
        approvedTagObjectId: 'f'.repeat(40),
      },
      invocation: 'once',
      gitAuthorityIssued: false,
      runnerInvocationAllowed: false,
      providerDispatchAllowed: false,
      credentialReads: 0,
      providerCalls: 0,
      formalEvidence: 0,
      businessWrites: 0,
    });
    expect(result.record.authorizationConfirmationSha256).not.toContain(
      PHASE_6_9_8_SR5_RUNTIME_AUTHORIZATION_CONFIRMATION,
    );
  });

  test.each([
    ['branch', { branch: 'feature' }],
    ['head parity', { upstream: '1'.repeat(40) }],
    ['origin parity', { origin: '2'.repeat(40) }],
    ['dirty', { clean: false }],
    ['manifest', { sourceManifestSha256: `sha256:${'3'.repeat(64)}` }],
    ['tag', { approvedTag: 'v3' }],
    ['tag ref', { approvedTagRef: 'refs/tags/v3' }],
    ['lightweight tag', { approvedTagKind: 'commit' }],
    ['remote tag', { originTagObjectId: '4'.repeat(40) }],
    ['peeled', { peeledCommit: '5'.repeat(40) }],
    ['target', { targetCommit: '6'.repeat(40) }],
    ['evidence', { currentLineageEvidencePaths: ['.tmp/v4.marker'] }],
    ['extra', { extra: true }],
  ])('rejects source receipt %s drift', (_name, patch) => {
    const input = createPhase698Sr5RuntimeSourceBindingInputForTest();
    expect(
      bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider({
        ...input,
        sourceReceipt: { ...input.sourceReceipt, ...patch },
      }),
    ).toEqual({ ok: false, reasonCode: 'source_receipt_invalid' });
  });

  test.each([
    ['commit', { sourceCommit: '7'.repeat(40) }],
    ['bundle', { sourceBundleSha256: `sha256:${'8'.repeat(64)}` }],
    ['tag object', { approvedTagObjectId: '9'.repeat(40) }],
  ])('rejects authorization %s mismatch against dynamic receipt', (_name, patch) => {
    const input = createPhase698Sr5RuntimeSourceBindingInputForTest();
    expect(
      bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider({
        ...input,
        authorization: { ...input.authorization, ...patch },
      }),
    ).toEqual({ ok: false, reasonCode: 'source_authorization_mismatch' });
  });

  test('rejects wrong boundary, old authorization, extra fields, and hostile input', () => {
    const input = createPhase698Sr5RuntimeSourceBindingInputForTest();
    expect(
      bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider({
        ...input,
        dataBoundary: { ...input.dataBoundary, confirmation: 'wrong' },
      }),
    ).toEqual({ ok: false, reasonCode: 'data_boundary_invalid' });
    expect(
      bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider({
        ...input,
        authorization: { ...input.authorization, confirmation: 'old' },
      }),
    ).toEqual({ ok: false, reasonCode: 'authorization_invalid' });
    expect(
      bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider({
        ...input,
        authorization: { ...input.authorization, extra: true },
      }),
    ).toEqual({ ok: false, reasonCode: 'authorization_invalid' });
    const hostile = new Proxy(input, {
      get() {
        throw new Error('raw-secret-must-not-escape');
      },
    });
    expect(bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider(hostile)).toEqual({
      ok: false,
      reasonCode: 'source_receipt_invalid',
    });
  });

  test('exposes no executable authorization argv and reads no environment or network', () => {
    expect(parsePhase698Sr5RuntimeSourceBindingArgs([]).kind).toBe('help');
    for (const args of [
      ['live'],
      ['--run'],
      [PHASE_6_9_8_SR5_RUNTIME_AUTHORIZATION_CONFIRMATION],
    ]) {
      expect(parsePhase698Sr5RuntimeSourceBindingArgs(args).kind).toBe('rejected');
    }
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
      expect(
        bindPhase698Sr5RuntimeSourceAuthorizationZeroProvider(
          createPhase698Sr5RuntimeSourceBindingInputForTest(),
        ).ok,
      ).toBe(true);
    } finally {
      Object.defineProperty(process, 'env', { configurable: true, value: environment });
    }
    expect(reads).toBe(0);
    expect(globalThis.fetch).toBe(fetchBefore);
  });
});
