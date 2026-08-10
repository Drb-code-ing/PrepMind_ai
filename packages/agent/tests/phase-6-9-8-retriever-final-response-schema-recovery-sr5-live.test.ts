import { mkdir, mkdtemp, readdir, rename, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'bun:test';

import {
  PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS,
  runPhase697ArchitectureRecoveryProxyPreflight,
} from '@repo/ai';

import {
  buildPhase698RetrieverSchemaRecoverySr5LiveReport,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SYNTHETIC_AUTHORITY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_ARGUMENT,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_VALIDATE_ARGUMENT,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-contract.ts';
import { createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-admission.ts';
import {
  createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest,
  runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-runner.ts';
import {
  reservePhase698RetrieverSchemaRecoverySr5LiveAttempt,
  sealPhase698RetrieverSchemaRecoverySr5LiveInterruptedAttemptForTest,
  artifactRelativePath,
  journalRelativePath,
  validatePhase698RetrieverSchemaRecoverySr5LiveBundle,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-durability.ts';
import {
  executePhase698RetrieverSchemaRecoverySr5LiveCliCore,
  readPhase698RetrieverSchemaRecoverySr5RootCredentialEnv,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-cli-core.ts';
import {
  snapshotPhase698RetrieverSchemaRecoverySr5LiveAuthorizationEnv,
  snapshotPhase698RetrieverSchemaRecoverySr5LiveProxyEnv,
} from '../scripts/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-cli.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_TAG,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';
import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_OBJECTS,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-manifest.ts';
import { createPhase698RetrieverSchemaRecoverySr5LiveSyntheticSourceFixture } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-source-schema.ts';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createReservation() {
  const root = await mkdtemp(join(tmpdir(), 'prepmind-sr5-live-'));
  roots.push(root);
  const liveBound = createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest();
  const runId = crypto.randomUUID();
  const reservation = await reservePhase698RetrieverSchemaRecoverySr5LiveAttempt({
    root,
    runId,
    createdAt: new Date().toISOString(),
    admissionAuthority: 'synthetic_test_live',
    reservationCapability: liveBound.reservationCapability,
  });
  return { root, runId, reservation, bound: liveBound };
}

describe('SR5 live lineage (zero-provider tests)', () => {
  it('keeps the historical admission manifest immutable and binds a separate live tree bundle', () => {
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256).toBe(
      'sha256:f71bdee19cf4509395566d8bf54d85ad1f37cf867ca2cbf37211b1daef8fa38b',
    );
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256).toMatch(
      /^sha256:[0-9a-f]{64}$/u,
    );
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256).not.toBe(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
    );
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_TAG).toBe(
      'phase-6-9-8-retriever-final-response-schema-recovery-sr5-approved',
    );
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG).toBe(
      'phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-v1-approved',
    );
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG).not.toBe(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_APPROVED_TAG,
    );
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST).toMatchObject({
      approvedSourceRef: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
      historicalAdmissionManifestSha256:
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
    });
    expect(createPhase698RetrieverSchemaRecoverySr5LiveSyntheticSourceFixture()).toMatchObject({
      approvedTag: {
        name: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_TAG,
        ref: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_APPROVED_SOURCE_REF,
      },
      admissionManifestSha256:
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_MANIFEST_SHA256,
      historicalAdmissionManifestSha256:
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
    });
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SOURCE_OBJECTS).toEqual(
      expect.arrayContaining([
        { path: 'packages/agent', objectKind: 'tree' },
        { path: 'packages/ai', objectKind: 'tree' },
        { path: 'packages/types', objectKind: 'tree' },
      ]),
    );
  });

  it('runs the complete 24-call reviewed Mock schedule without external calls', async () => {
    const { root, runId, reservation, bound } = await createReservation();
    const report = await runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest({
      runId,
      repositoryRoot: root,
      admissionAuthority: 'synthetic_test_live',
      admissionCapability: bound.capability,
      harness: createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest(),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    expect(report.authority).toBe(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_SYNTHETIC_AUTHORITY,
    );
    expect(report.gate.passed).toBe(false);
    expect(report.callEntries).toHaveLength(24);
    expect(report.execution.externalProviderCalls).toBe(0);
    expect(report.execution.credentialReads).toBe(0);
    expect(report.execution.transportInvocations).toBe(24);
    const published = await reservation.publishArtifact(report);
    expect(published.evidenceSha256).toMatch(/^[0-9a-f]{64}$/u);
    const validation = await validatePhase698RetrieverSchemaRecoverySr5LiveBundle({ root });
    expect(validation.ok).toBe(true);
    expect(validation.runId).toBe(runId);
    await expect(reservation.publishArtifact(report)).rejects.toThrow();
  });

  it('stops before dispatch when the parent signal is already aborted', async () => {
    const { root, runId, reservation, bound } = await createReservation();
    const controller = new AbortController();
    controller.abort();
    const report = await runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest({
      runId,
      repositoryRoot: root,
      admissionAuthority: 'synthetic_test_live',
      admissionCapability: bound.capability,
      harness: createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest(),
      lifecycle: reservation.lifecycle,
      signal: controller.signal,
    });
    expect(report.execution.externalProviderCalls).toBe(0);
    expect(report.callEntries.every((entry) => entry.wire.dispatches === 0)).toBe(true);
    expect(report.gate.failureReasons).toContain('guard_count');
  });

  it('keeps live CLI gates ahead of credentials and Provider ports', async () => {
    const writes: string[] = [];
    let credentialReads = 0;
    const code = await executePhase698RetrieverSchemaRecoverySr5LiveCliCore(
      {
        args: [PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_ARGUMENT],
        root: 'synthetic-root',
        proxyEnv: {},
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      {
        readCredential: () => {
          credentialReads += 1;
          return 'should-not-be-read';
        },
        write: (line) => writes.push(line),
      },
    );
    expect(code).toBe(1);
    expect(credentialReads).toBe(0);
    expect(JSON.parse(writes[0] ?? '{}').code).toBe('data_boundary_not_accepted');
  });

  it('exposes only exact validation intent for the live CLI', async () => {
    const writes: string[] = [];
    const code = await executePhase698RetrieverSchemaRecoverySr5LiveCliCore(
      {
        args: [PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_VALIDATE_ARGUMENT],
        root: 'synthetic-root',
        proxyEnv: {},
        authorizationEnv: {},
        signal: new AbortController().signal,
      },
      { write: (line) => writes.push(line), validate: () => ({ ok: false, runId: null }) },
    );
    expect(code).toBe(1);
    expect(JSON.parse(writes[0] ?? '{}').operation).toBe('validate');
  });

  it('keeps the proxy preflight ahead of root credential projection', async () => {
    const writes: string[] = [];
    let credentialReads = 0;
    const code = await executePhase698RetrieverSchemaRecoverySr5LiveCliCore(
      {
        args: [PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_RUN_ARGUMENT],
        root: 'synthetic-root',
        proxyEnv: {},
        authorizationEnv: {
          PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_ACCEPTED:
            'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_DEEPSEEK_AND_QWEN_DATA_BOUNDARY',
          PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_APPROVED:
            'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_CONTROLLED_LIVE_ONCE',
        },
        signal: new AbortController().signal,
      },
      {
        readAdmission: () =>
          createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest(),
        runProxyPreflight: async () => ({
          ok: false,
          code: 'loopback_proxy_unavailable',
          providerCalls: 0,
          listenerProbeCalls: 1,
        }),
        loadCredentialEnv: async () => {
          credentialReads += 1;
          throw new Error('must-not-load');
        },
        readCredential: () => {
          credentialReads += 1;
          throw new Error('must-not-read');
        },
        write: (line) => writes.push(line),
      },
    );
    expect(code).toBe(1);
    expect(credentialReads).toBe(0);
    expect(JSON.parse(writes[0] ?? '{}').code).toBe('proxy_preflight_not_ready');
  });

  it('materializes Bun-style accessor proxy variables before shared preflight', async () => {
    const env = Object.create(null) as Record<string, unknown>;
    for (const key of PHASE_6_9_7_ARCHITECTURE_RECOVERY_PROXY_PREFLIGHT_ENV_KEYS) {
      const value = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'].includes(key)
        ? 'http://127.0.0.1:7897'
        : undefined;
      Object.defineProperty(env, key, {
        configurable: true,
        enumerable: true,
        get: () => value,
      });
    }
    const snapshot = snapshotPhase698RetrieverSchemaRecoverySr5LiveProxyEnv(env);
    expect(Object.keys(snapshot)).toEqual(
      expect.arrayContaining(['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']),
    );
    expect(Object.getOwnPropertyDescriptor(snapshot, 'HTTP_PROXY')).toMatchObject({
      value: 'http://127.0.0.1:7897',
      writable: false,
      configurable: false,
    });
    const report = await runPhase697ArchitectureRecoveryProxyPreflight(
      { env: snapshot, signal: new AbortController().signal },
      { probeLoopbackListener: async () => true },
    );
    expect(report).toMatchObject({
      ok: true,
      code: 'loopback_proxy_ready',
      configuredProxyVariables: 4,
      listenerProbeCalls: 1,
      providerCalls: 0,
    });
  });

  it('ignores inherited proxy values and rejects an own getter that throws', async () => {
    const inherited = Object.create({ HTTP_PROXY: 'http://127.0.0.1:7897' }) as Record<
      string,
      unknown
    >;
    const inheritedSnapshot = snapshotPhase698RetrieverSchemaRecoverySr5LiveProxyEnv(inherited);
    expect(Object.hasOwn(inheritedSnapshot, 'HTTP_PROXY')).toBe(false);
    expect(
      await runPhase697ArchitectureRecoveryProxyPreflight(
        { env: inheritedSnapshot, signal: new AbortController().signal },
        { probeLoopbackListener: async () => true },
      ),
    ).toMatchObject({
      ok: true,
      code: 'direct_ready',
      configuredProxyVariables: 0,
      providerCalls: 0,
    });

    const hostile = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(hostile, 'HTTP_PROXY', {
      configurable: true,
      enumerable: true,
      get: () => {
        throw new Error('hostile getter');
      },
    });
    const hostileSnapshot = snapshotPhase698RetrieverSchemaRecoverySr5LiveProxyEnv(hostile);
    expect(Object.getOwnPropertyDescriptor(hostileSnapshot, 'HTTP_PROXY')).toMatchObject({
      value: undefined,
      writable: false,
      configurable: false,
    });
    expect(
      await runPhase697ArchitectureRecoveryProxyPreflight(
        { env: hostileSnapshot, signal: new AbortController().signal },
        { probeLoopbackListener: async () => true },
      ),
    ).toMatchObject({ ok: false, code: 'proxy_environment_invalid', providerCalls: 0 });
  });

  it('materializes Bun-style accessor authorization variables before admission', () => {
    const env = Object.create(null) as Record<string, unknown>;
    Object.defineProperty(
      env,
      'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_ACCEPTED',
      {
        configurable: true,
        enumerable: true,
        get: () =>
          'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_DEEPSEEK_AND_QWEN_DATA_BOUNDARY',
      },
    );
    Object.defineProperty(
      env,
      'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_APPROVED',
      {
        configurable: true,
        enumerable: true,
        get: () =>
          'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_CONTROLLED_LIVE_ONCE',
      },
    );
    const snapshot = snapshotPhase698RetrieverSchemaRecoverySr5LiveAuthorizationEnv(env);
    expect(snapshot).toMatchObject({
      PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_ACCEPTED:
        'I_ACCEPT_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_DEEPSEEK_AND_QWEN_DATA_BOUNDARY',
      PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_APPROVED:
        'I_AUTHORIZE_PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_CONTROLLED_LIVE_ONCE',
    });
    expect(
      Object.getOwnPropertyDescriptor(
        snapshot,
        'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_APPROVED',
      ),
    ).toMatchObject({ writable: false, configurable: false });
  });

  it('rejects current-lineage temp leftovers before creating a marker', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-sr5-live-temp-fence-'));
    roots.push(root);
    await mkdir(join(root, '.tmp'), { recursive: true });
    await Bun.write(
      join(
        root,
        '.tmp',
        `phase-6-9-8-retriever-final-response-schema-recovery-sr5-live-${crypto.randomUUID()}.report.json.tmp.${crypto.randomUUID()}`,
      ),
      '{}\n',
    ).catch(async () => {
      await Bun.write(join(root, '.tmp', 'placeholder'), '{}\n');
    });
    const bound = createPhase698RetrieverSchemaRecoverySr5LiveSyntheticAdmissionForTest();
    await expect(
      reservePhase698RetrieverSchemaRecoverySr5LiveAttempt({
        root,
        runId: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        admissionAuthority: 'synthetic_test_live',
        reservationCapability: bound.reservationCapability,
      }),
    ).rejects.toThrow();
  });

  it('fails closed if the trusted temp directory is replaced after reservation', async () => {
    const { root, runId, reservation, bound } = await createReservation();
    const report = await runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest({
      runId,
      repositoryRoot: root,
      admissionAuthority: 'synthetic_test_live',
      admissionCapability: bound.capability,
      harness: createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest(),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    const trustedTmp = join(root, '.tmp');
    const displacedTmp = join(root, '.tmp-original');
    await rename(trustedTmp, displacedTmp);
    await symlink(displacedTmp, trustedTmp, process.platform === 'win32' ? 'junction' : 'dir');

    await expect(reservation.publishArtifact(report)).rejects.toThrow();
    const artifactName = artifactRelativePath(runId).split('/').at(-1)!;
    expect((await readdir(displacedTmp)).includes(artifactName)).toBe(false);
  });

  it('fails closed on journal tamper and seals an interrupted prefix once', async () => {
    const { root, runId, reservation, bound } = await createReservation();
    const report = await runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest({
      runId,
      repositoryRoot: root,
      admissionAuthority: 'synthetic_test_live',
      admissionCapability: bound.capability,
      harness: createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest(),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    await reservation.publishArtifact(report);
    const journalPath = join(root, journalRelativePath(runId));
    const original = await Bun.file(journalPath).text();
    await Bun.write(journalPath, `${original}tampered`);
    expect(await validatePhase698RetrieverSchemaRecoverySr5LiveBundle({ root })).toMatchObject({
      ok: false,
    });

    const interrupted = await createReservation();
    const sealed = await sealPhase698RetrieverSchemaRecoverySr5LiveInterruptedAttemptForTest({
      root: interrupted.root,
      isProcessAlive: () => false,
    });
    expect(sealed.ok).toBe(true);
    expect(
      await validatePhase698RetrieverSchemaRecoverySr5LiveBundle({ root: interrupted.root }),
    ).toMatchObject({ ok: true });
    const second = await sealPhase698RetrieverSchemaRecoverySr5LiveInterruptedAttemptForTest({
      root: interrupted.root,
      isProcessAlive: () => false,
    });
    expect(second).toEqual({ ok: false, code: 'already_published' });
  });

  it('selectively projects compatible root credentials and rejects alias conflict', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-sr5-live-env-'));
    roots.push(root);
    await Bun.write(
      join(root, '.env'),
      [
        'DATABASE_URL=ignored-project-setting',
        'DEEPSEEK_API_KEY=synthetic-deepseek',
        'Qwen_API_KEY=synthetic-qwen',
      ].join('\n'),
    );
    const projected = await readPhase698RetrieverSchemaRecoverySr5RootCredentialEnv(root);
    expect(Object.keys(projected).sort()).toEqual([
      'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_FINAL_RESPONSE_DEEPSEEK_API_KEY',
      'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_QWEN_API_KEY',
      'PHASE_6_9_8_RETRIEVER_FINAL_RESPONSE_SCHEMA_RECOVERY_SR5_REWRITE_DEEPSEEK_API_KEY',
    ]);
    expect(JSON.stringify(projected)).not.toContain('DATABASE_URL');

    await Bun.write(
      join(root, '.env'),
      'DEEPSEEK_API_KEY=synthetic-deepseek\nQWEN_API_KEY=qwen-one\nQwen_API_KEY=qwen-two\n',
    );
    await expect(readPhase698RetrieverSchemaRecoverySr5RootCredentialEnv(root)).rejects.toThrow();
  });

  it('withholds semantic authority when retrieval or citation metrics miss thresholds', async () => {
    const { root, runId, reservation, bound } = await createReservation();
    const synthetic = await runPhase698RetrieverSchemaRecoverySr5ControlledLiveForTest({
      runId,
      repositoryRoot: root,
      admissionAuthority: 'synthetic_test_live',
      admissionCapability: bound.capability,
      harness: createPhase698RetrieverSchemaRecoverySr5LiveReviewedMockHarnessForTest(),
      lifecycle: reservation.lifecycle,
      signal: new AbortController().signal,
    });
    const live = buildPhase698RetrieverSchemaRecoverySr5LiveReport({
      runId,
      authority: PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_LIVE_AUTHORITY,
      completionMode: 'runtime',
      source: synthetic.source,
      sourceBinding: synthetic.sourceBinding,
      guardEntries: synthetic.guardEntries,
      callEntries: synthetic.callEntries.map((entry) => ({
        ...entry,
        transportAuthority: 'external_provider' as const,
      })),
      rewriteEntries: synthetic.rewriteEntries.map((entry, index) =>
        index === 0 ? { ...entry, candidateRecallAt5: 0, candidateNdcgAt5: 0 } : entry,
      ),
      finalResponseEntries: synthetic.finalResponseEntries.map((entry, index) =>
        index === 0
          ? {
              ...entry,
              requiredCitationCount: 1,
              observedCitationCount: 1,
              citationTruePositiveCount: 0,
            }
          : entry,
      ),
    });
    expect(live.gate.passed).toBe(false);
    expect(live.qualityAuthority).toBe('none');
    expect(live.gate.failureReasons).toEqual(
      expect.arrayContaining([
        'rewrite_recall',
        'rewrite_ndcg',
        'citation_precision',
        'citation_recall',
      ]),
    );
  });
});
