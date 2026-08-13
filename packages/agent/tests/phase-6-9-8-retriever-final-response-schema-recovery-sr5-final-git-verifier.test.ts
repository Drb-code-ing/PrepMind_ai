import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_AUTHORITY,
  PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_VERSION,
  consumePhase698Sr5FinalGitCapability,
  createPhase698Sr5FinalGitSyntheticAuthorityForTest,
  createPhase698Sr5FinalGitSyntheticObservationForTest,
  createPhase698Sr5FinalGitTagMessage,
  parsePhase698Sr5FinalGitVerifierArgs,
  validatePhase698Sr5FinalGitObservationForTest,
  verifyPhase698Sr5FinalGitSourceZeroProvider,
  type Phase698Sr5FinalGitObservation,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-final-git-verifier.ts';

describe('Phase 6.9.8 SR5 D5 final Git verifier', () => {
  test('creates the exact v8 annotated tag message without Live authority', () => {
    const message = createPhase698Sr5FinalGitTagMessage(`sha256:${'a'.repeat(64)}`);
    expect(message).toContain('Phase 6.9.8 SR5 runtime v8 approved source');
    expect(message).toContain(`sourceBundleSha256=sha256:${'a'.repeat(64)}`);
    expect(message).toContain('qualityAuthority:none');
    expect(() => createPhase698Sr5FinalGitTagMessage('invalid')).toThrow(
      'PHASE_6_9_8_SR5_FINAL_GIT_SOURCE_BUNDLE_INVALID',
    );
  });

  test('issues a single-use Git/source-only authority containing the D3 receipt', () => {
    const issued = createPhase698Sr5FinalGitSyntheticAuthorityForTest();
    expect(issued.record).toMatchObject({
      version: PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_VERSION,
      authority: PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_AUTHORITY,
      qualityAuthority: 'none',
      mode: 'zero_provider_final_git_verifier',
      gitAuthorityIssued: true,
      runnerInvocationAllowed: false,
      providerDispatchAllowed: false,
      liveAuthorizationDefined: false,
      dataBoundaryAcceptanceDefined: false,
      credentialReads: 0,
      providerCalls: 0,
      formalEvidence: 0,
      businessWrites: 0,
    });
    expect(issued.record.sourceReceipt).toMatchObject({
      branch: 'main',
      clean: true,
      approvedTagKind: 'tag',
      currentLineageEvidencePaths: [],
    });
    expect(consumePhase698Sr5FinalGitCapability(issued.capability, 'synthetic_test')).toBe(
      issued.record,
    );
    expect(() => consumePhase698Sr5FinalGitCapability(issued.capability, 'synthetic_test')).toThrow(
      'PHASE_6_9_8_SR5_FINAL_GIT_CAPABILITY_INVALID',
    );
  });

  test.each([
    ['feature branch', { branch: 'drb/feature' }],
    ['dirty tree', { clean: false }],
    ['upstream drift', { upstream: 'd'.repeat(40) }],
    ['origin drift', { origin: 'e'.repeat(40) }],
    ['lightweight tag', { tag: { objectKind: 'commit' } }],
    ['wrong tag name', { tag: { name: 'wrong' } }],
    ['wrong tag ref', { tag: { ref: 'refs/tags/wrong' } }],
    ['local remote tag mismatch', { tag: { originObjectId: '4'.repeat(40) } }],
    ['peeled commit drift', { tag: { peeledCommit: 'f'.repeat(40) } }],
    ['target commit drift', { tag: { targetCommit: '1'.repeat(40) } }],
    ['tag message drift', { tag: { message: 'wrong' } }],
    ['invalid tag object', { tag: { objectId: 'wrong' } }],
    ['invalid bundle', { sourceBundleSha256: 'wrong' }],
    ['current evidence exists', { currentLineageEvidencePaths: ['.tmp/v4.marker'] }],
    ['sealed tag moved', { sealedV2TagObjectId: '2'.repeat(40) }],
    ['sealed commit moved', { sealedV2PeeledCommit: '3'.repeat(40) }],
  ])('fails closed for %s', (_name, patch) => {
    const baseline = createPhase698Sr5FinalGitSyntheticObservationForTest();
    const observation = {
      ...baseline,
      ...patch,
      tag: 'tag' in patch ? { ...baseline.tag, ...patch.tag } : baseline.tag,
    } as Phase698Sr5FinalGitObservation;
    expect(validatePhase698Sr5FinalGitObservationForTest(observation)).toBe(false);
  });

  test('rejects forged, relabeled and hostile capabilities', () => {
    const issued = createPhase698Sr5FinalGitSyntheticAuthorityForTest();
    expect(() => consumePhase698Sr5FinalGitCapability(issued.capability, 'git_verified')).toThrow(
      'PHASE_6_9_8_SR5_FINAL_GIT_CAPABILITY_INVALID',
    );
    expect(() =>
      consumePhase698Sr5FinalGitCapability(
        { version: PHASE_6_9_8_SR5_FINAL_GIT_VERIFIER_VERSION },
        'synthetic_test',
      ),
    ).toThrow('PHASE_6_9_8_SR5_FINAL_GIT_CAPABILITY_INVALID');
    const hostile = new Proxy(
      {},
      {
        getOwnPropertyDescriptor: () => {
          throw new Error('raw');
        },
      },
    );
    expect(() => consumePhase698Sr5FinalGitCapability(hostile, 'synthetic_test')).toThrow(
      'PHASE_6_9_8_SR5_FINAL_GIT_CAPABILITY_INVALID',
    );
  });

  test('contains hostile observations and does not read environment or fetch in synthetic mode', () => {
    const hostile = new Proxy(createPhase698Sr5FinalGitSyntheticObservationForTest(), {
      get() {
        throw new Error('raw-secret-must-not-escape');
      },
    });
    expect(validatePhase698Sr5FinalGitObservationForTest(hostile)).toBe(false);
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
      createPhase698Sr5FinalGitSyntheticAuthorityForTest();
    } finally {
      Object.defineProperty(process, 'env', { configurable: true, value: environment });
    }
    expect(reads).toBe(0);
    expect(globalThis.fetch).toBe(fetchBefore);
  });

  test('exposes no executable or authorization-shaped CLI mode', () => {
    expect(parsePhase698Sr5FinalGitVerifierArgs([])).toEqual({ kind: 'help' });
    expect(parsePhase698Sr5FinalGitVerifierArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parsePhase698Sr5FinalGitVerifierArgs(['inspect-zero-provider'])).toEqual({
      kind: 'inspect-zero-provider',
    });
    for (const args of [['live'], ['run'], ['authorize'], ['inspect-zero-provider', 'extra']]) {
      expect(parsePhase698Sr5FinalGitVerifierArgs(args)).toEqual({ kind: 'rejected' });
    }
  });

  test('a non-repository root fails closed without depending on the real tag lifecycle', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-sr5-final-git-invalid-'));
    try {
      expect(verifyPhase698Sr5FinalGitSourceZeroProvider(root)).toEqual({
        ok: false,
        reasonCode: 'final_git_source_invalid',
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
