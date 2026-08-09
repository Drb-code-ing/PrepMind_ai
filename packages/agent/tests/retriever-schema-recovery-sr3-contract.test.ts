import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY,
  PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA,
  buildPhase698RetrieverSchemaRecoverySr3Report,
  expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule,
  parsePhase698RetrieverSchemaRecoverySr3Report,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-contract.ts';
import {
  createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest,
  phase698RetrieverSchemaRecoverySr3SyntheticSourceFixture,
} from '../src/evals/phase-6-9-8-retriever-final-response-schema-recovery-sr3-source-admission.ts';

function completeGuards() {
  return PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_MANIFEST.guardCases.map((entry) => ({
    kind: 'guard' as const,
    caseId: entry.caseId,
    disposition: 'passed' as const,
    observedReasonCode: entry.expectedReasonCode,
    expectedReasonCode: entry.expectedReasonCode,
    zeroCallVerified: true,
    permissionFailure: false,
    crossOwnerFailure: false,
    credentialFailure: false,
    injectionFailure: false,
  }));
}

function completeLanes() {
  return expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule().map((identity) => ({
    kind: 'candidate_lane' as const,
    ...identity,
    transportAuthority: 'synthetic_injected' as const,
    disposition: 'succeeded' as const,
    failureReason: null,
    wire: { reservations: 1, dispatches: 1, responses: 1, verifiedUsage: 1 },
    schemaStage:
      identity.phase === 'rewrite_candidate_model'
        ? ('rewrite_projection' as const)
        : ('final_response_stream' as const),
    schemaDisposition:
      identity.phase === 'rewrite_candidate_model'
        ? ('canonical' as const)
        : ('not_applicable' as const),
    schemaDiagnostic: null,
    usage: { inputTokens: 200, outputTokens: 100 },
    verifiedCostCny: 0.001,
    durationMs: 10,
    resultDigest: `sha256:${'a'.repeat(64)}`,
  }));
}

describe('Phase 6.9.8 Retriever Schema Recovery SR3 contract', () => {
  test('freezes the 8/6/6 denominator and pair-interleaved single-dispatch schedule', () => {
    expect(PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_POLICY.counts).toEqual({
      guards: 8,
      rewriteCandidates: 6,
      finalResponseCandidates: 6,
      candidateInvocations: 12,
      reportEntries: 20,
    });
    expect(expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule()).toHaveLength(12);
    expect(expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule()[0]?.laneId).toBe(
      'rewrite_01.rewrite_candidate_model',
    );
    expect(expectedPhase698RetrieverSchemaRecoverySr3LaneSchedule()[1]?.laneId).toBe(
      'final_01.final_response_model',
    );
  });

  test('recomputes a complete reviewed Mock report and rejects mutations', () => {
    const admission = createPhase698RetrieverSchemaRecoverySr3SyntheticAdmissionForTest();
    const report = buildPhase698RetrieverSchemaRecoverySr3Report({
      runId: '00000000-0000-4000-8000-000000000001',
      completionMode: 'runtime',
      runMode: 'reviewed_mock',
      source: admission.source,
      guardEntries: completeGuards(),
      laneEntries: completeLanes(),
    });
    expect(report.gate).toMatchObject({
      status: 'schema_recovery_mock_quality_not_evidence',
      passed: true,
      qualityAuthority: 'none',
    });
    expect(parsePhase698RetrieverSchemaRecoverySr3Report(report)).not.toBeNull();
    expect(
      PHASE_6_9_8_RETRIEVER_SCHEMA_RECOVERY_SR3_REPORT_SCHEMA.safeParse({
        ...report,
        execution: { ...report.execution, providerCalls: 1 },
      }).success,
    ).toBe(false);
    expect(phase698RetrieverSchemaRecoverySr3SyntheticSourceFixture().formalArtifactCount).toBe(0);
  });
});
