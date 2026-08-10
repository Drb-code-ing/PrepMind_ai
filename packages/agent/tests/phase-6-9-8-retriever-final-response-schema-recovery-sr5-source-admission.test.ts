import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';

import { createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput } from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';

import {
  computePhase698RetrieverSchemaRecoverySr5GitSourceBundleSha256,
  consumePhase698RetrieverSchemaRecoverySr5BoundAdmissionCapability,
  consumePhase698RetrieverSchemaRecoverySr5BoundReservationCapability,
  consumePhase698RetrieverSchemaRecoverySr5AdmissionCapability,
  consumePhase698RetrieverSchemaRecoverySr5ReservationCapability,
  createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest,
  createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionForTest,
  inspectPhase698RetrieverSchemaRecoverySr5SourceAdmission,
  phase698RetrieverSchemaRecoverySr5SyntheticSourceFixture,
  validatePhase698RetrieverSchemaRecoverySr5ObservationForTest,
  type Phase698RetrieverSchemaRecoverySr5RepositoryObservation,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-source-admission.ts';

const root = resolve(import.meta.dir, '../../..');

function observation(
  source = phase698RetrieverSchemaRecoverySr5SyntheticSourceFixture(),
): Phase698RetrieverSchemaRecoverySr5RepositoryObservation {
  return Object.freeze({
    root,
    branch: source.branch,
    head: source.head,
    upstream: source.upstream,
    origin: source.origin,
    approvedTag: source.approvedTag,
    clean: true,
    formalEvidencePaths: [],
    oldLineagePaths: [],
    sourceBundleSha256: source.sourceBundleSha256,
  });
}

describe('Phase 6.9.8 Retriever / FinalResponse SR5 source admission', () => {
  test('matches an exact clean source/tag/bundle observation', () => {
    const source = phase698RetrieverSchemaRecoverySr5SyntheticSourceFixture();
    expect(
      validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(source, observation(source)),
    ).toBe(true);
  });

  test('rejects branch, commit, tag, bundle, dirty and formal-evidence drift', () => {
    const source = phase698RetrieverSchemaRecoverySr5SyntheticSourceFixture();
    const base = observation(source);
    expect(
      validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(source, {
        ...base,
        branch: 'main',
      }),
    ).toBe(false);
    expect(
      validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(source, {
        ...base,
        head: '1'.repeat(40),
      }),
    ).toBe(false);
    expect(
      validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(source, {
        ...base,
        approvedTag: { ...base.approvedTag, commit: '1'.repeat(40) },
      }),
    ).toBe(false);
    expect(
      validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(source, {
        ...base,
        approvedTag: { ...base.approvedTag, objectId: '1'.repeat(40) },
      }),
    ).toBe(false);
    expect(
      validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(source, {
        ...base,
        sourceBundleSha256: `sha256:${'1'.repeat(64)}`,
      }),
    ).toBe(false);
    expect(
      validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(source, {
        ...base,
        clean: false,
      }),
    ).toBe(false);
    expect(
      validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(source, {
        ...base,
        formalEvidencePaths: [
          '.tmp/phase-6-9-8-retriever-final-response-schema-recovery-sr5.marker',
        ],
      }),
    ).toBe(false);
    expect(
      validatePhase698RetrieverSchemaRecoverySr5ObservationForTest(source, {
        ...base,
        oldLineagePaths: ['.tmp/old-lineage.marker'],
      }),
    ).toBe(false);
  });

  test('keeps run and reservation capabilities independent and single-use', () => {
    const admission = createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionForTest();
    expect(
      consumePhase698RetrieverSchemaRecoverySr5AdmissionCapability(
        admission.capability,
        'synthetic_test',
      ),
    ).toMatchObject({ authority: 'synthetic_test' });
    expect(() =>
      consumePhase698RetrieverSchemaRecoverySr5AdmissionCapability(
        admission.capability,
        'synthetic_test',
      ),
    ).toThrow('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_CAPABILITY_INVALID');
    expect(
      consumePhase698RetrieverSchemaRecoverySr5ReservationCapability(
        admission.reservationCapability,
        root,
      ),
    ).toMatchObject({ authority: 'synthetic_test' });
    expect(() =>
      consumePhase698RetrieverSchemaRecoverySr5ReservationCapability(
        admission.reservationCapability,
        root,
      ),
    ).toThrow('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_RESERVATION_CAPABILITY_INVALID');
  });

  test('composes the source, boundary, authorization and budget into one bound capability', () => {
    const input = createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput();
    const bound = createPhase698RetrieverSchemaRecoverySr5SyntheticBoundAdmissionForTest(input);
    expect(bound.admission.providerDispatchAllowed).toBe(false);
    expect(bound.admission.dataBoundary.providers).toEqual(['deepseek', 'qwen']);
    expect(bound.admission.authorization.invocation).toBe('once');
    expect(
      consumePhase698RetrieverSchemaRecoverySr5BoundAdmissionCapability(
        bound.capability,
        'synthetic_test',
        root,
      ),
    ).toMatchObject({ authority: 'synthetic_test', admission: { providerCalls: 0 } });
    expect(() =>
      consumePhase698RetrieverSchemaRecoverySr5BoundAdmissionCapability(
        bound.capability,
        'synthetic_test',
        root,
      ),
    ).toThrow('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_BOUND_ADMISSION_CAPABILITY_INVALID');
    expect(
      consumePhase698RetrieverSchemaRecoverySr5BoundReservationCapability(
        bound.reservationCapability,
        root,
      ),
    ).toMatchObject({ authority: 'synthetic_test', admission: { formalEvidence: 0 } });
  });

  test('rejects invalid repository roots and commit identities before bundle reads', () => {
    expect(computePhase698RetrieverSchemaRecoverySr5GitSourceBundleSha256(root, 'invalid')).toEqual(
      {
        ok: false,
        reasonCode: 'source_bundle_invalid',
      },
    );
    expect(
      computePhase698RetrieverSchemaRecoverySr5GitSourceBundleSha256(
        resolve(root, 'packages'),
        '0'.repeat(40),
      ),
    ).toEqual({ ok: false, reasonCode: 'source_bundle_invalid' });
  });

  test('keeps the real SR5 source gate closed until branch push and approved tag exist', () => {
    const result = inspectPhase698RetrieverSchemaRecoverySr5SourceAdmission(root);
    expect(result).toEqual({ ok: false, reasonCode: 'source_admission_invalid' });
  });
});
