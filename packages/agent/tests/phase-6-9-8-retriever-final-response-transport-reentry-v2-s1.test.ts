import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  createPhase698TransportReentryV2C2SyntheticAdmissionForTest,
  makePhase698TransportReentryV2C2SyntheticConfigurationForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2-contract.ts';
import {
  createPhase698TransportReentryV2C2SyntheticRootForTest,
  removePhase698TransportReentryV2C2SyntheticRootForTest,
  runPhase698TransportReentryV2C2Synthetic,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-c2.ts';
import {
  createPhase698TransportReentryV2S1SyntheticAdmissionForTest,
  consumePhase698TransportReentryV2S1AdmissionCapability,
  countPhase698TransportReentryV2S1FormalRepositoryPaths,
  inspectPhase698TransportReentryV2S1SourceAdmission,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_PATHS,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-contract.ts';
import {
  buildPhase698TransportReentryV2S1ReviewedMockCheckpoint,
  createPhase698TransportReentryV2S1ReviewedMockHarnessForTest,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_SHA256,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_FACTORY_SHA256,
  PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_REPORT_SHA256,
  runPhase698TransportReentryV2S1FaultMatrixForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock.ts';

const PACKAGE_DIR = resolve(import.meta.dir, '..');
const REPOSITORY_ROOT = resolve(PACKAGE_DIR, '../..');

async function withRoot<T>(task: (root: string) => Promise<T>) {
  const root = await createPhase698TransportReentryV2C2SyntheticRootForTest();
  try {
    return await task(root);
  } finally {
    await removePhase698TransportReentryV2C2SyntheticRootForTest(root);
  }
}

describe('Phase 6.9.8 Transport Re-entry V2 S1 source and authority', () => {
  test('uses an independent single-consume synthetic admission', () => {
    const admission = createPhase698TransportReentryV2S1SyntheticAdmissionForTest();
    expect(admission.authority).toBe('synthetic_test');
    expect(admission.source.admissionAuthority).toBe('synthetic_fixture');
    const issued = consumePhase698TransportReentryV2S1AdmissionCapability(
      admission.capability,
      'synthetic_test',
    );
    expect(issued.source.formalArtifactCount).toBe(0);
    expect(() =>
      consumePhase698TransportReentryV2S1AdmissionCapability(
        admission.capability,
        'synthetic_test',
      ),
    ).toThrow('S1_ADMISSION_CAPABILITY_INVALID');
  });

  test('rejects source drift and keeps every admitted source path present', async () => {
    const admission = createPhase698TransportReentryV2S1SyntheticAdmissionForTest();
    expect(
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_SOURCE_PATHS.every(
        (path) => Bun.file(resolve(REPOSITORY_ROOT, path)).size > 0,
      ),
    ).toBe(true);
    expect(
      inspectPhase698TransportReentryV2S1SourceAdmission(resolve(REPOSITORY_ROOT, 'missing')),
    ).toEqual({
      ok: false,
      reasonCode: 'source_admission_invalid',
    });
    expect(admission.source.commit).toBe('0'.repeat(40));
    const sourceContract = await readFile(
      resolve(
        PACKAGE_DIR,
        'src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-contract.ts',
      ),
      'utf8',
    );
    expect(sourceContract).not.toContain('process.env');
    expect(sourceContract).not.toContain('DEEPSEEK_API_KEY');
    expect(sourceContract).not.toContain('QWEN_API_KEY');
  });

  test('counts only current V2 formal evidence and ignores historical runtime files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-transport-reentry-v2-s1-admission-'));
    try {
      await writeFile(
        join(
          root,
          'phase-6-9-8-retriever-final-response-transport-reentry-v2-00000000-0000-4000-8000-000000000101.json',
        ),
        '{}\n',
        'utf8',
      );
      expect(countPhase698TransportReentryV2S1FormalRepositoryPaths(root)).toBe(1);

      await mkdir(join(root, '.tmp'));
      await writeFile(join(root, '.tmp', 'historical-run.log'), 'history\n', 'utf8');
      await writeFile(
        join(root, '.tmp', 'phase-6-9-8-retriever-final-response-task9c-controlled-live.marker'),
        '{}\n',
        'utf8',
      );
      await writeFile(
        join(root, '.tmp', 'phase-6-9-8-retriever-final-response-transport-reentry-v2.once.json'),
        '{}\n',
        'utf8',
      );
      await mkdir(
        join(
          root,
          '.tmp',
          'phase-6-9-8-retriever-final-response-transport-reentry-v2-00000000-0000-4000-8000-000000000102.report.json',
        ),
      );
      expect(countPhase698TransportReentryV2S1FormalRepositoryPaths(root)).toBe(3);

      const notDirectory = join(root, 'not-a-directory');
      await writeFile(notDirectory, 'not a directory\n', 'utf8');
      expect(() => countPhase698TransportReentryV2S1FormalRepositoryPaths(notDirectory)).toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('Phase 6.9.8 Transport Re-entry V2 S1 reviewed Mock', () => {
  test('passes the three first-party synthetic adapters through the C2 runner seam', async () => {
    const checkpoint = await buildPhase698TransportReentryV2S1ReviewedMockCheckpoint();
    expect(checkpoint.report.gate).toEqual({
      status: 'transport_reentry_v2_s1_mock_quality_not_evidence',
      passed: true,
      qualityAuthority: 'none',
      failureReasons: [],
    });
    expect(checkpoint.report.adapters.map((adapter) => adapter.slot)).toEqual([
      'rewrite',
      'qwen',
      'final_response',
    ]);
    expect(checkpoint.report.adapters.every((adapter) => adapter.providerCalls === 0)).toBe(true);
    expect(checkpoint.report.execution).toMatchObject({
      providerCalls: 0,
      credentialReads: 0,
      syntheticPortCalls: 3,
      retry: false,
      replay: false,
      resume: false,
      backfill: false,
      traceWrites: 0,
      businessWrites: 0,
    });
    expect(checkpoint.report.wire).toEqual({
      runnerReservations: 3,
      runnerDispatches: 3,
      runnerReturns: 3,
      runnerVerifiedResults: 3,
      providerExecutions: 3,
      providerDispatches: 3,
      providerResponses: 3,
      providerVerifiedUsage: 3,
    });
    expect(checkpoint.report.formalEvidence).toEqual({
      approvedTagCount: 0,
      markerCount: 0,
      journalCount: 0,
      artifactCount: 0,
      recoveryClaimCount: 0,
    });
    expect(checkpoint.factorySha256).toBe(
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_FACTORY_SHA256,
    );
    expect(checkpoint.reportSha256).toBe(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_REPORT_SHA256);
    expect(PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FACTORY_SHA256).toBe(
      PHASE_6_9_8_TRANSPORT_REENTRY_V2_S1_FROZEN_FACTORY_SHA256,
    );
  });

  test('records only bounded audit metadata and no raw payload', async () => {
    const audits: string[] = [];
    const harness = createPhase698TransportReentryV2S1ReviewedMockHarnessForTest({
      onAudit: (audit) => audits.push(`${audit.slot}:${audit.modelRef}`),
    });
    await withRoot(async (root) => {
      const admission = createPhase698TransportReentryV2C2SyntheticAdmissionForTest();
      const configuration = makePhase698TransportReentryV2C2SyntheticConfigurationForTest();
      const result = await runPhase698TransportReentryV2C2Synthetic({
        root,
        admissionCapability: admission.capability,
        configurationCapability: configuration.capability,
        reservationCapability: admission.reservationCapability,
        ports: harness.ports,
      });
      expect(result.validation.ok).toBe(true);
    });
    expect(audits).toEqual([
      'rewrite:deepseek-v4-pro',
      'qwen:text-embedding-v4',
      'final_response:deepseek-v4-pro',
    ]);
    expect(harness.audits.every((audit) => audit.rawDataRetained === false)).toBe(true);
    expect(harness.audits.every((audit) => audit.oracleRead === false)).toBe(true);
  });

  test('faults open the C2 breaker without retry, suffix dispatch, or Provider calls', async () => {
    const outcomes = await runPhase698TransportReentryV2S1FaultMatrixForTest();
    expect(outcomes).toHaveLength(6);
    expect(outcomes[0]).toEqual({
      fault: 'success',
      bundleValid: true,
      providerCalls: 0,
      audits: 3,
    });
    for (const outcome of outcomes.slice(1, -1)) {
      expect(outcome.bundleValid).toBe(true);
      expect(outcome.providerCalls).toBe(0);
      expect(outcome.audits).toBe(0);
    }
    expect(outcomes.at(-1)).toEqual({
      fault: 'abort_before_qwen',
      bundleValid: true,
      providerCalls: 0,
      audits: 1,
    });
  });
});

describe('Phase 6.9.8 Transport Re-entry V2 S1 package boundary', () => {
  test('exports only the reviewed Mock module and zero-provider script', async () => {
    const packageJson = JSON.parse(
      await readFile(resolve(PACKAGE_DIR, 'package.json'), 'utf8'),
    ) as { exports?: Record<string, unknown>; scripts?: Record<string, unknown> };
    expect(packageJson.exports?.['./transport-reentry-v2-s1']).toBe(
      './src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock.ts',
    );
    expect(packageJson.exports?.['./transport-reentry-v2-s1-contract']).toBe(
      './src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-contract.ts',
    );
    expect(packageJson.scripts?.['eval:phase-6-9-8:transport-reentry:v2:s1']).toBe(
      'bun scripts/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1.ts',
    );
    const source = await readFile(
      resolve(
        PACKAGE_DIR,
        'src/evals/phase-6-9-8-retriever-final-response-transport-reentry-v2-s1-reviewed-mock.ts',
      ),
      'utf8',
    );
    expect(source).not.toContain('process.env');
    expect(source).not.toContain('DEEPSEEK_API_KEY');
    expect(source).not.toContain('QWEN_API_KEY');
    expect(source).not.toMatch(/\bfetch\s*\(/u);
  });
});
