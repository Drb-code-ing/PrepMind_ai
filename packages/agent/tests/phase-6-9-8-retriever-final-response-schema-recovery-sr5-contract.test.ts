import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_ARG,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_AUTHORIZATION_CONFIRMATION,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_CONFIRMATION,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_VALIDATE_ARG,
  admitPhase698RetrieverSchemaRecoverySr5ZeroProvider,
  consumePhase698RetrieverSchemaRecoverySr5AdmissionTupleCapability,
  createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput,
  issuePhase698RetrieverSchemaRecoverySr5AdmissionTupleCapability,
  parsePhase698RetrieverSchemaRecoverySr5CliArgs,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr5-contract.ts';

describe('Phase 6.9.8 Retriever / FinalResponse SR5 zero-provider admission contract', () => {
  test('binds the exact source, receipt, authorization, budget and upstream identities', () => {
    const input = createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput();
    const result = admitPhase698RetrieverSchemaRecoverySr5ZeroProvider(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('synthetic SR5 admission failed');
    expect(result.admission).toMatchObject({
      authority: 'zero_provider_retriever_final_response_schema_recovery_sr5_admission',
      gate: 'sr5_admission_zero_provider',
      qualityAuthority: 'none',
      mode: 'zero_provider_admission',
      providerDispatchAllowed: false,
      source: {
        branch: 'drb/phase-6-9-8-retriever-final-response-schema-recovery-sr5',
        head: 'a'.repeat(40),
        approvedTag: 'phase-6-9-8-retriever-final-response-schema-recovery-sr5-approved',
        approvedTagObjectId: 'b'.repeat(40),
        sourceBundleSha256: `sha256:${'0'.repeat(64)}`,
        admissionManifestSha256:
          PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_MANIFEST_SHA256,
      },
      dataBoundary: { accepted: true, providers: ['deepseek', 'qwen'], scope: 'current_account' },
      authorization: { invocation: 'once', sourceCommit: 'a'.repeat(40) },
      budget: {
        maxCandidateInvocations: 12,
        maxInputTokens: 37_600,
        maxOutputTokens: 8_800,
        maxCostMicrosCny: 176_000,
      },
      execution: {
        maximumConcurrency: 1,
        pairSerial: true,
        singleDispatchPerLane: true,
        retry: false,
        resume: false,
        replay: false,
        backfill: false,
      },
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
    });
    const serialized = JSON.stringify(result.admission);
    expect(
      serialized.includes(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_DATA_BOUNDARY_CONFIRMATION),
    ).toBe(false);
    expect(
      serialized.includes(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_AUTHORIZATION_CONFIRMATION),
    ).toBe(false);
  });

  test('rejects source, data-boundary, authorization and budget drift fail-closed', () => {
    const input = createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput();
    expect(
      admitPhase698RetrieverSchemaRecoverySr5ZeroProvider({
        ...input,
        source: { ...(input.source as object), clean: false },
      }),
    ).toMatchObject({ ok: false, code: 'source_invalid' });
    expect(
      admitPhase698RetrieverSchemaRecoverySr5ZeroProvider({
        ...input,
        dataBoundary: {
          ...(input.dataBoundary as object),
          providers: ['qwen', 'deepseek'],
        },
      }),
    ).toMatchObject({ ok: false, code: 'data_boundary_invalid' });
    expect(
      admitPhase698RetrieverSchemaRecoverySr5ZeroProvider({
        ...input,
        authorization: {
          ...(input.authorization as object),
          sourceBundleSha256: `sha256:${'1'.repeat(64)}`,
        },
      }),
    ).toMatchObject({ ok: false, code: 'source_authorization_mismatch' });
    expect(
      admitPhase698RetrieverSchemaRecoverySr5ZeroProvider({
        ...input,
        authorization: {
          ...(input.authorization as object),
          approvedTagObjectId: 'c'.repeat(40),
        },
      }),
    ).toMatchObject({ ok: false, code: 'source_authorization_mismatch' });
    expect(
      admitPhase698RetrieverSchemaRecoverySr5ZeroProvider({
        ...input,
        budget: { ...(input.budget as object), maxCandidateInvocations: 13 },
      }),
    ).toMatchObject({ ok: false, code: 'budget_invalid' });
  });

  test('rejects hostile accessors without observing credential or provider state', () => {
    const input = createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput();
    const hostile = new Proxy(input, {
      ownKeys() {
        throw new Error('hostile ownKeys');
      },
    });
    expect(admitPhase698RetrieverSchemaRecoverySr5ZeroProvider(hostile)).toEqual({
      ok: false,
      authority: 'none',
      code: 'input_invalid',
    });
    const accessor = Object.create(null) as Record<string, unknown>;
    for (const key of ['source', 'dataBoundary', 'authorization', 'budget']) {
      Object.defineProperty(accessor, key, {
        enumerable: true,
        get() {
          throw new Error('must not execute');
        },
      });
    }
    expect(admitPhase698RetrieverSchemaRecoverySr5ZeroProvider(accessor)).toMatchObject({
      ok: false,
      code: 'input_invalid',
    });
  });

  test('issues an opaque capability that is authority-bound and single-use', () => {
    const input = createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput();
    expect(() =>
      issuePhase698RetrieverSchemaRecoverySr5AdmissionTupleCapability(
        input,
        'git_verified' as never,
      ),
    ).toThrow('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_CAPABILITY_INVALID');
    const capability = issuePhase698RetrieverSchemaRecoverySr5AdmissionTupleCapability(
      input,
      'synthetic_test',
    );
    expect(() =>
      consumePhase698RetrieverSchemaRecoverySr5AdmissionTupleCapability(capability, 'git_verified'),
    ).toThrow('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_CAPABILITY_INVALID');
    expect(
      consumePhase698RetrieverSchemaRecoverySr5AdmissionTupleCapability(
        capability,
        'synthetic_test',
      ),
    ).toMatchObject({ providerDispatchAllowed: false, providerCalls: 0, credentialReads: 0 });
    expect(() =>
      consumePhase698RetrieverSchemaRecoverySr5AdmissionTupleCapability(
        capability,
        'synthetic_test',
      ),
    ).toThrow('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_CAPABILITY_CONSUMED');
    expect(() =>
      consumePhase698RetrieverSchemaRecoverySr5AdmissionTupleCapability({}, 'synthetic_test'),
    ).toThrow('PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_CAPABILITY_INVALID');
  });

  test('accepts only the two exact zero-provider CLI commands', () => {
    expect(parsePhase698RetrieverSchemaRecoverySr5CliArgs([]).kind).toBe('help');
    expect(parsePhase698RetrieverSchemaRecoverySr5CliArgs(['--help']).kind).toBe('help');
    expect(
      parsePhase698RetrieverSchemaRecoverySr5CliArgs([
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_ARG,
      ]).kind,
    ).toBe('admit_zero_provider');
    expect(
      parsePhase698RetrieverSchemaRecoverySr5CliArgs([
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_VALIDATE_ARG,
      ]).kind,
    ).toBe('validate_zero_provider');
    expect(parsePhase698RetrieverSchemaRecoverySr5CliArgs(['live']).kind).toBe('rejected');
    expect(
      parsePhase698RetrieverSchemaRecoverySr5CliArgs([
        PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR5_ADMISSION_ARG,
        'extra',
      ]).kind,
    ).toBe('rejected');
  });

  test('returns deeply frozen data without mutating caller input', () => {
    const input = createPhase698RetrieverSchemaRecoverySr5SyntheticAdmissionInput();
    const before = JSON.stringify(input);
    const result = admitPhase698RetrieverSchemaRecoverySr5ZeroProvider(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.admission)).toBe(true);
      expect(Object.isFrozen(result.admission.source)).toBe(true);
      expect(Object.isFrozen(result.admission.authorization)).toBe(true);
      expect(Object.isFrozen(result.admission.execution)).toBe(true);
    }
  });
});
