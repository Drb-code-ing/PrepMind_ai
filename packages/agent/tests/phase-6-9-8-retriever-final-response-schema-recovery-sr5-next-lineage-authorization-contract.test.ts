import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CONFIRMATION,
  PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_VERSION,
  PHASE_6_9_8_SR5_NEXT_DATA_BOUNDARY_CONFIRMATION,
  admitPhase698Sr5NextAuthorizationZeroProvider,
  consumePhase698Sr5NextAuthorizationCapability,
  createPhase698Sr5NextAuthorizationInputForTest,
  parsePhase698Sr5NextAuthorizationArgs,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-authorization-contract.ts';

describe('Phase 6.9.8 SR5 next-lineage authorization contract', () => {
  test('accepts exact v3 source-bound boundary and authorization as zero-provider only', () => {
    const issued = admitPhase698Sr5NextAuthorizationZeroProvider(
      createPhase698Sr5NextAuthorizationInputForTest(),
    );
    expect(issued.ok).toBe(true);
    if (!issued.ok) return;
    expect(issued.record).toMatchObject({
      version: PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_VERSION,
      mode: 'zero_provider_authorization_contract',
      qualityAuthority: 'none',
      providerDispatchAllowed: false,
      credentialReads: 0,
      providerCalls: 0,
      formalEvidence: 0,
      businessWrites: 0,
    });
    expect(consumePhase698Sr5NextAuthorizationCapability(issued.capability)).toBe(issued.record);
    expect(() => consumePhase698Sr5NextAuthorizationCapability(issued.capability)).toThrow(
      'PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CAPABILITY_INVALID',
    );
  });

  test.each([
    [
      'wrong boundary',
      {
        dataBoundary: {
          accepted: true,
          confirmation: 'wrong',
          providers: ['deepseek', 'qwen'],
          scope: 'current_account',
        },
      },
    ],
    [
      'wrong boundary provider order',
      {
        dataBoundary: {
          accepted: true,
          confirmation: PHASE_6_9_8_SR5_NEXT_DATA_BOUNDARY_CONFIRMATION,
          providers: ['qwen', 'deepseek'],
          scope: 'current_account',
        },
      },
    ],
    ['wrong auth', { authorization: { confirmation: 'wrong' } }],
    [
      'old auth string',
      {
        authorization: {
          confirmation:
            'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_CONTROLLED_LIVE_ONCE',
        },
      },
    ],
    ['source commit mismatch', { authorization: { sourceCommit: 'd'.repeat(40) } }],
    ['bundle mismatch', { authorization: { sourceBundleSha256: `sha256:${'e'.repeat(64)}` } }],
    ['tag object mismatch', { authorization: { approvedTagObjectId: 'f'.repeat(40) } }],
    ['wrong invocation', { authorization: { invocation: 'twice' } }],
    ['extra authorization field', { authorization: { extra: true } }],
    [
      'v4 placeholder auth',
      {
        authorization: {
          confirmation:
            'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_V4_CONTROLLED_LIVE_ONCE',
        },
      },
    ],
  ])('fails closed for %s', (_name, patch) => {
    const baseline = createPhase698Sr5NextAuthorizationInputForTest();
    const input = {
      ...baseline,
      ...patch,
      dataBoundary:
        'dataBoundary' in patch
          ? { ...baseline.dataBoundary, ...patch.dataBoundary }
          : baseline.dataBoundary,
      authorization:
        'authorization' in patch
          ? { ...baseline.authorization, ...patch.authorization }
          : baseline.authorization,
    } as typeof baseline;
    const result = admitPhase698Sr5NextAuthorizationZeroProvider(input);
    expect(result.ok).toBe(false);
  });

  test('rejects executable authorization argv and hostile accessors', () => {
    const baseline = createPhase698Sr5NextAuthorizationInputForTest();
    const hostile = new Proxy(baseline, {
      get() {
        throw new Error('raw-secret-must-not-escape');
      },
    });
    expect(admitPhase698Sr5NextAuthorizationZeroProvider(hostile)).toMatchObject({ ok: false });
    for (const args of [
      ['live'],
      ['--authorize'],
      ['I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_CONTROLLED_LIVE_ONCE'],
      [PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CONFIRMATION],
      [baseline.authorization.confirmation, 'extra'],
    ]) {
      expect(parsePhase698Sr5NextAuthorizationArgs(args).kind).toBe('rejected');
    }
    expect(parsePhase698Sr5NextAuthorizationArgs(['--help']).kind).toBe('help');
  });

  test('rejects forged and hostile authorization capabilities', () => {
    expect(() =>
      consumePhase698Sr5NextAuthorizationCapability({
        version: PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_VERSION,
      }),
    ).toThrow('PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CAPABILITY_INVALID');
    const hostile = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('raw');
        },
      },
    );
    expect(() => consumePhase698Sr5NextAuthorizationCapability(hostile)).toThrow(
      'PHASE_6_9_8_SR5_NEXT_AUTHORIZATION_CAPABILITY_INVALID',
    );
  });

  test.each([
    ['branch', { branch: 'feature' }],
    ['commit', { sourceCommit: '1'.repeat(40) }],
    ['bundle', { sourceBundleSha256: `sha256:${'2'.repeat(64)}` }],
    ['manifest', { sourceManifestSha256: `sha256:${'3'.repeat(64)}` }],
    [
      'tag',
      { approvedTag: 'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v4-approved' },
    ],
    ['tag object', { approvedTagObjectId: '4'.repeat(40) }],
  ])('rejects source-side %s drift before admission', (_name, sourcePatch) => {
    const baseline = createPhase698Sr5NextAuthorizationInputForTest();
    const result = admitPhase698Sr5NextAuthorizationZeroProvider({
      ...baseline,
      source: { ...baseline.source, ...sourcePatch },
    } as typeof baseline);
    expect(result).toMatchObject({ ok: false, reasonCode: 'source_invalid' });
  });

  test('does not read environment or install a network hook', () => {
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
        admitPhase698Sr5NextAuthorizationZeroProvider(
          createPhase698Sr5NextAuthorizationInputForTest(),
        ).ok,
      ).toBe(true);
    } finally {
      Object.defineProperty(process, 'env', { configurable: true, value: environment });
    }
    expect(reads).toBe(0);
    expect(globalThis.fetch).toBe(fetchBefore);
  });
});
