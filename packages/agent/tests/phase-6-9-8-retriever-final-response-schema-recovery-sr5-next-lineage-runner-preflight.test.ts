import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_SR5_NEXT_SOURCE_BUNDLE_SHA256,
  PHASE_6_9_8_SR5_NEXT_SOURCE_COMMIT,
  PHASE_6_9_8_SR5_NEXT_TAG_OBJECT_ID,
  admitPhase698Sr5NextAuthorizationZeroProvider,
  createPhase698Sr5NextAuthorizationInputForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-authorization-contract.ts';
import {
  createPhase698Sr5NextLineageSyntheticTagBindingForTest,
  createPhase698Sr5NextLineageSyntheticTagObservationForTest,
  type Phase698Sr5NextLineageTagObservation,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-tag-contract.ts';
import {
  PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_VERSION,
  composePhase698Sr5NextRunnerPreflightForTest,
  consumePhase698Sr5NextRunnerPreflightCapability,
  parsePhase698Sr5NextRunnerPreflightArgs,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-next-lineage-runner-preflight.ts';

function createCapabilities() {
  const baseTag = createPhase698Sr5NextLineageSyntheticTagObservationForTest(
    PHASE_6_9_8_SR5_NEXT_SOURCE_COMMIT,
    PHASE_6_9_8_SR5_NEXT_SOURCE_BUNDLE_SHA256,
  );
  const tagObservation: Phase698Sr5NextLineageTagObservation = {
    ...baseTag,
    tag: {
      ...baseTag.tag,
      objectId: PHASE_6_9_8_SR5_NEXT_TAG_OBJECT_ID,
      originObjectId: PHASE_6_9_8_SR5_NEXT_TAG_OBJECT_ID,
    },
  };
  const tag = createPhase698Sr5NextLineageSyntheticTagBindingForTest(tagObservation);
  const authorization = admitPhase698Sr5NextAuthorizationZeroProvider(
    createPhase698Sr5NextAuthorizationInputForTest(),
  );
  if (!authorization.ok) throw new Error('test authorization invalid');
  return { tag, authorization };
}

function compose(
  proxyAttestation: unknown = {
    ok: true,
    code: 'direct_ready',
    providerCalls: 0,
    listenerProbeCalls: 0,
  },
) {
  const { tag, authorization } = createCapabilities();
  return composePhase698Sr5NextRunnerPreflightForTest({
    tagCapability: tag.capability,
    authorizationCapability: authorization.capability,
    proxyAttestation,
    signal: new AbortController().signal,
  });
}

describe('Phase 6.9.8 SR5 next-lineage runner preflight', () => {
  test.each([
    ['direct', { ok: true, code: 'direct_ready', providerCalls: 0, listenerProbeCalls: 0 }],
    [
      'loopback',
      { ok: true, code: 'loopback_proxy_ready', providerCalls: 0, listenerProbeCalls: 1 },
    ],
  ])('composes exact %s source, authorization and proxy gates without dispatch', (_name, proxy) => {
    const result = compose(proxy);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record).toMatchObject({
      version: PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_VERSION,
      qualityAuthority: 'none',
      mode: 'zero_provider_runner_preflight',
      annotatedTagVerified: true,
      authorizationVerified: true,
      runnerInvocationAllowed: false,
      providerDispatchAllowed: false,
      credentialReads: 0,
      providerCalls: 0,
      formalEvidence: 0,
      businessWrites: 0,
      proxy: {
        code: proxy.code,
        listenerProbeCalls: proxy.listenerProbeCalls,
        providerCalls: 0,
      },
    });
    expect(consumePhase698Sr5NextRunnerPreflightCapability(result.capability)).toBe(result.record);
    expect(() => consumePhase698Sr5NextRunnerPreflightCapability(result.capability)).toThrow(
      'PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_CAPABILITY_INVALID',
    );
  });

  test.each([
    ['not ready', { ok: false, code: 'loopback_proxy_unavailable', providerCalls: 0 }],
    ['provider call', { ok: true, code: 'direct_ready', providerCalls: 1, listenerProbeCalls: 0 }],
    ['direct probe', { ok: true, code: 'direct_ready', providerCalls: 0, listenerProbeCalls: 1 }],
    [
      'missing loopback probe',
      { ok: true, code: 'loopback_proxy_ready', providerCalls: 0, listenerProbeCalls: 0 },
    ],
    [
      'extra field',
      { ok: true, code: 'direct_ready', providerCalls: 0, listenerProbeCalls: 0, raw: 'x' },
    ],
  ])('rejects %s proxy attestation', (_name, proxy) => {
    expect(compose(proxy)).toEqual({ ok: false, reasonCode: 'proxy_attestation_invalid' });
  });

  test('rejects abort before consuming upstream capabilities', () => {
    const { tag, authorization } = createCapabilities();
    const controller = new AbortController();
    controller.abort();
    expect(
      composePhase698Sr5NextRunnerPreflightForTest({
        tagCapability: tag.capability,
        authorizationCapability: authorization.capability,
        proxyAttestation: {
          ok: true,
          code: 'direct_ready',
          providerCalls: 0,
          listenerProbeCalls: 0,
        },
        signal: controller.signal,
      }),
    ).toEqual({ ok: false, reasonCode: 'aborted' });
  });

  test('rejects forged, reused and cross-authority upstream capabilities', () => {
    const first = createCapabilities();
    expect(
      composePhase698Sr5NextRunnerPreflightForTest({
        tagCapability: first.tag.capability,
        authorizationCapability: first.authorization.capability,
        proxyAttestation: {
          ok: true,
          code: 'direct_ready',
          providerCalls: 0,
          listenerProbeCalls: 0,
        },
        signal: new AbortController().signal,
      }).ok,
    ).toBe(true);
    expect(
      composePhase698Sr5NextRunnerPreflightForTest({
        tagCapability: first.tag.capability,
        authorizationCapability: first.authorization.capability,
        proxyAttestation: {
          ok: true,
          code: 'direct_ready',
          providerCalls: 0,
          listenerProbeCalls: 0,
        },
        signal: new AbortController().signal,
      }),
    ).toEqual({ ok: false, reasonCode: 'tag_capability_invalid' });
    const second = createCapabilities();
    expect(
      composePhase698Sr5NextRunnerPreflightForTest({
        tagCapability: {
          version: second.tag.capability.version,
        },
        authorizationCapability: second.authorization.capability,
        proxyAttestation: {
          ok: true,
          code: 'direct_ready',
          providerCalls: 0,
          listenerProbeCalls: 0,
        },
        signal: new AbortController().signal,
      }),
    ).toEqual({ ok: false, reasonCode: 'tag_capability_invalid' });
  });

  test('rejects a valid tag binding whose source does not match D1 authorization', () => {
    const mismatched = createPhase698Sr5NextLineageSyntheticTagObservationForTest(
      PHASE_6_9_8_SR5_NEXT_SOURCE_COMMIT,
      `sha256:${'9'.repeat(64)}`,
    );
    const tag = createPhase698Sr5NextLineageSyntheticTagBindingForTest(mismatched);
    const authorization = admitPhase698Sr5NextAuthorizationZeroProvider(
      createPhase698Sr5NextAuthorizationInputForTest(),
    );
    if (!authorization.ok) throw new Error('test authorization invalid');
    expect(
      composePhase698Sr5NextRunnerPreflightForTest({
        tagCapability: tag.capability,
        authorizationCapability: authorization.capability,
        proxyAttestation: {
          ok: true,
          code: 'direct_ready',
          providerCalls: 0,
          listenerProbeCalls: 0,
        },
        signal: new AbortController().signal,
      }),
    ).toEqual({ ok: false, reasonCode: 'source_authorization_mismatch' });
  });

  test('contains hostile inputs and capabilities behind fixed failures', () => {
    const hostileInput = new Proxy(
      {},
      {
        getOwnPropertyDescriptor() {
          throw new Error('raw-secret-must-not-escape');
        },
      },
    );
    expect(composePhase698Sr5NextRunnerPreflightForTest(hostileInput as never)).toEqual({
      ok: false,
      reasonCode: 'input_invalid',
    });
    expect(() =>
      consumePhase698Sr5NextRunnerPreflightCapability(
        new Proxy(
          {},
          {
            getOwnPropertyDescriptor() {
              throw new Error('raw');
            },
          },
        ),
      ),
    ).toThrow('PHASE_6_9_8_SR5_NEXT_RUNNER_PREFLIGHT_CAPABILITY_INVALID');
  });

  test('rejects executable and authorization-shaped argv', () => {
    expect(parsePhase698Sr5NextRunnerPreflightArgs([]).kind).toBe('help');
    expect(parsePhase698Sr5NextRunnerPreflightArgs(['--inspect-zero-provider']).kind).toBe(
      'inspect_zero_provider',
    );
    for (const args of [['live'], ['--run'], ['--authorize'], ['I_AUTHORIZE_PHASE_6_9_8']]) {
      expect(parsePhase698Sr5NextRunnerPreflightArgs(args).kind).toBe('rejected');
    }
  });

  test('does not read environment, call fetch, or expose runner and evidence ports', () => {
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
      expect(compose().ok).toBe(true);
    } finally {
      Object.defineProperty(process, 'env', { configurable: true, value: environment });
    }
    expect(reads).toBe(0);
    expect(globalThis.fetch).toBe(fetchBefore);
  });
});
