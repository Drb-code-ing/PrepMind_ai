import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import {
  computePhase698RetrieverSchemaRecoverySr3GitSourceBundleSha256,
  createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_PATHS,
  validatePhase698RetrieverSchemaRecoverySr3ObservationForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-source-admission.ts';
import { reservePhase698RetrieverSchemaRecoverySr3Attempt } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-durability.ts';

describe('Phase 6.9.8 Retriever Schema Recovery SR3 source admission', () => {
  test('keeps synthetic source identities detached from Git and rejects malformed observations', () => {
    const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_SOURCE_PATHS).toContain(
      'packages/agent/src/index.ts',
    );
    expect(
      validatePhase698RetrieverSchemaRecoverySr3ObservationForTest(admission.source, {
        root: 'synthetic',
        branch: admission.source.branch,
        head: admission.source.commit,
        tracking: admission.source.trackingCommit,
        remote: admission.source.remoteCommit,
        approvedSourceCommit: admission.source.approvedSourceCommit,
        workingTreeClean: true,
        formalArtifactCount: 0,
        sourceBundleSha256: admission.source.sourceBundleSha256,
      }),
    ).toBe(false);
    expect(
      computePhase698RetrieverSchemaRecoverySr3GitSourceBundleSha256('missing', 'bad'),
    ).toEqual({
      ok: false,
      reasonCode: 'source_bundle_invalid',
    });
  });

  test('fails closed when a current-lineage formal marker already exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-sr3-admission-'));
    try {
      await mkdir(join(root, '.tmp'));
      await writeFile(
        join(root, '.tmp', 'phase-6-9-8-retriever-final-response-schema-recovery-v1.marker'),
        'foreign',
      );
      const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
      await expect(
        reservePhase698RetrieverSchemaRecoverySr3Attempt({
          root,
          runId: '00000000-0000-4000-8000-000000000006',
          createdAt: '2026-08-09T13:00:00.000Z',
          reservationCapability: admission.reservationCapability,
        }),
      ).rejects.toThrow();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('elects exactly one reservation winner under concurrent attempts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'prepmind-sr3-concurrent-'));
    try {
      const first = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
      const second = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
      const outcomes = await Promise.allSettled([
        reservePhase698RetrieverSchemaRecoverySr3Attempt({
          root,
          runId: '00000000-0000-4000-8000-000000000007',
          createdAt: '2026-08-09T13:00:00.000Z',
          reservationCapability: first.reservationCapability,
        }),
        reservePhase698RetrieverSchemaRecoverySr3Attempt({
          root,
          runId: '00000000-0000-4000-8000-000000000008',
          createdAt: '2026-08-09T13:00:00.000Z',
          reservationCapability: second.reservationCapability,
        }),
      ]);
      expect(outcomes.filter((entry) => entry.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((entry) => entry.status === 'rejected')).toHaveLength(1);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
