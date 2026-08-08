import { describe, expect, test } from 'bun:test';

import {
  admitPhase698P1L2ZeroProvider,
  consumePhase698P1L2AdmissionCapability,
  createPhase698P1L2SyntheticAdmissionInput,
  issuePhase698P1L2AdmissionCapability,
  PHASE_6_9_8_P1_L2_AUTHORIZATION_CONFIRMATION,
  PHASE_6_9_8_P1_L2_DATA_BOUNDARY_CONFIRMATION,
} from '../src/evals/phase-6-9-8-retriever-final-response-p1-l2-admission.ts';

describe('Phase 6.9.8 P1 L2 zero-provider admission contract', () => {
  test('admits only the frozen source, boundary, authorization, and budget tuple', () => {
    const input = createPhase698P1L2SyntheticAdmissionInput();
    const result = admitPhase698P1L2ZeroProvider(input);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('synthetic L2 admission did not pass');
    expect(result.admission).toMatchObject({
      authority: 'zero_provider_retriever_final_response_p1_l2_admission_contract',
      gate: 'l2_admission_zero_provider',
      mode: 'zero_provider_admission',
      providerDispatchAllowed: false,
      providerCalls: 0,
      credentialReads: 0,
      formalEvidence: 0,
      source: { head: 'a'.repeat(40), approvedTag: 'phase-6.9.8-retriever-final-response-p1-l2-approved' },
      dataBoundary: { accepted: true, providers: ['deepseek', 'qwen'], scope: 'current_account' },
      budget: { maxCandidateInvocations: 12, maxInputTokens: 37_600, maxOutputTokens: 8_800 },
    });
    const serialized = JSON.stringify(result.admission);
    expect(serialized.includes(PHASE_6_9_8_P1_L2_AUTHORIZATION_CONFIRMATION)).toBe(false);
    expect(serialized.includes(PHASE_6_9_8_P1_L2_DATA_BOUNDARY_CONFIRMATION)).toBe(false);
  });

  test('rejects source drift, tag drift, boundary drift, authorization drift, and budget expansion', () => {
    const input = createPhase698P1L2SyntheticAdmissionInput();
    expect(admitPhase698P1L2ZeroProvider({ ...input, source: { ...input.source, clean: false } })).toMatchObject({
      ok: false,
      code: 'source_dirty',
    });
    expect(
      admitPhase698P1L2ZeroProvider({
        ...input,
        source: { ...input.source, approvedTag: { ...input.source.approvedTag, commit: 'b'.repeat(40) } },
      }),
    ).toMatchObject({ ok: false, code: 'approved_tag_mismatch' });
    expect(
      admitPhase698P1L2ZeroProvider({
        ...input,
        dataBoundary: { ...input.dataBoundary, providers: ['deepseek', 'other'] as never },
      }),
    ).toMatchObject({ ok: false, code: 'data_boundary_invalid' });
    expect(
      admitPhase698P1L2ZeroProvider({
        ...input,
        authorization: { ...input.authorization, sourceCommit: 'b'.repeat(40) },
      }),
    ).toMatchObject({ ok: false, code: 'authorization_invalid' });
    expect(
      admitPhase698P1L2ZeroProvider({
        ...input,
        budget: { ...input.budget, maxCandidateInvocations: 13 },
      }),
    ).toMatchObject({ ok: false, code: 'budget_invalid' });
  });

  test('fails closed on hostile accessors and keeps the capability single-use', () => {
    const input = createPhase698P1L2SyntheticAdmissionInput();
    const hostile = new Proxy(input, {
      ownKeys() {
        throw new Error('hostile ownKeys');
      },
    });
    expect(admitPhase698P1L2ZeroProvider(hostile)).toMatchObject({ ok: false, code: 'input_invalid' });
    const hostileBoundary = new Proxy(input.dataBoundary.providers, {
      get() {
        throw new Error('hostile providers');
      },
    });
    expect(
      admitPhase698P1L2ZeroProvider({
        ...input,
        dataBoundary: { ...input.dataBoundary, providers: hostileBoundary as never },
      }),
    ).toMatchObject({ ok: false, code: 'data_boundary_invalid' });

    const capability = issuePhase698P1L2AdmissionCapability(input);
    expect(consumePhase698P1L2AdmissionCapability(capability)).toMatchObject({
      providerDispatchAllowed: false,
      providerCalls: 0,
      credentialReads: 0,
    });
    expect(() => consumePhase698P1L2AdmissionCapability(capability)).toThrow(
      'PHASE_6_9_8_P1_L2_CAPABILITY_CONSUMED',
    );
    expect(() => consumePhase698P1L2AdmissionCapability({})).toThrow(
      'PHASE_6_9_8_P1_L2_CAPABILITY_CONSUMED',
    );
  });

  test('never creates a provider or credential port and keeps input immutable', () => {
    const input = createPhase698P1L2SyntheticAdmissionInput();
    const before = JSON.stringify(input);
    const result = admitPhase698P1L2ZeroProvider(input);
    expect(result.ok).toBe(true);
    expect(JSON.stringify(input)).toBe(before);
    if (result.ok) {
      expect(Object.isFrozen(result.admission)).toBe(true);
      expect(Object.isFrozen(result.admission.source)).toBe(true);
      expect(result.admission.qualityAuthority).toBe('none');
    }
  });
});
