import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_8_TASK9_EVAL_POLICY,
  PHASE_6_9_8_TASK9_POLICY_SHA256,
  expectedPhase698Task9CallSchedule,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-contract.ts';
import {
  PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_FROZEN_SHA256,
  PHASE_6_9_8_TASK9B_REVIEWED_MOCK_REPORT_FROZEN_SHA256,
  buildPhase698Task9BReviewedMockCheckpoint,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-reviewed-mock.ts';
import {
  consumePhase698Task9AdmissionCapability,
  consumePhase698Task9ReservationAdmissionCapability,
  createPhase698Task9SyntheticAdmissionForTest,
} from '../src/evals/phase-6-9-8-retriever-final-response-task9-source-admission.ts';

describe('Phase 6.9.8 Task 9B contract and reviewed Mock', () => {
  test('freezes the 16-guard, 64-call serial schedule and independent provider caps', () => {
    const schedule = expectedPhase698Task9CallSchedule();

    expect(schedule).toHaveLength(64);
    expect(schedule.slice(0, 48).filter((entry) => entry.provider === 'qwen')).toHaveLength(32);
    expect(schedule.filter((entry) => entry.provider === 'deepseek')).toHaveLength(32);
    expect(schedule.slice(48).every((entry) => entry.phase === 'final_response_model')).toBe(true);
    expect(PHASE_6_9_8_TASK9_EVAL_POLICY).toMatchObject({
      counts: {
        guards: 16,
        rewritePairs: 16,
        finalResponseCases: 16,
        providerCalls: 64,
        deepseekCalls: 32,
        qwenEmbeddingCalls: 32,
      },
      totalRunCostCnyMax: 0.451072,
      schedule: {
        guardsFirst: true,
        pairSerial: true,
        retry: false,
        replay: false,
        resume: false,
        backfill: false,
      },
      qwen: { verifiedInputTokensRunMax: 262_144, runCostCnyMax: 0.131072 },
      deepseek: { runCostCnyMax: 0.32 },
    });
    expect(PHASE_6_9_8_TASK9_POLICY_SHA256).toMatch(/^[0-9a-f]{64}$/u);
  });

  test('runs the reviewed Mock through the real runner without gaining Live authority', async () => {
    const checkpoint = await buildPhase698Task9BReviewedMockCheckpoint();

    expect(checkpoint).toMatchObject({
      authority: 'zero_provider_retriever_final_response_runner_durability',
      qualityAuthority: 'none',
      providerCalls: 0,
      credentialReads: 0,
      syntheticTransportInvocations: 64,
      qwenExternalCalls: 0,
      deepseekExternalCalls: 0,
      reviewedMockFactorySha256: PHASE_6_9_8_TASK9B_REVIEWED_MOCK_FACTORY_FROZEN_SHA256,
      reportLogicalSha256: PHASE_6_9_8_TASK9B_REVIEWED_MOCK_REPORT_FROZEN_SHA256,
    });
    expect(checkpoint.report.gate).toEqual({
      status: 'task9b_mock_quality_not_evidence',
      passed: true,
      qualityAuthority: 'none',
      failureReasons: [],
    });
    expect(checkpoint.report.execution).toMatchObject({
      mode: 'reviewed_mock',
      credentialReads: 0,
      transportInvocations: 64,
      externalProviderCalls: 0,
      qwenEmbeddingInvocations: 32,
    });
    expect(checkpoint.report.providers.qwen).toMatchObject({
      attempts: 32,
      dispatches: 32,
      responses: 32,
      verifiedUsage: 32,
    });
    expect(checkpoint.report.providers.deepseek).toMatchObject({
      attempts: 32,
      dispatches: 32,
      responses: 32,
      verifiedUsage: 32,
    });
  });

  test('issues separate opaque single-consume runner and reservation capabilities', () => {
    const admission = createPhase698Task9SyntheticAdmissionForTest();

    expect(
      consumePhase698Task9AdmissionCapability(admission.capability, 'synthetic_test').source,
    ).toEqual(admission.source);
    expect(() =>
      consumePhase698Task9AdmissionCapability(admission.capability, 'synthetic_test'),
    ).toThrow('PHASE_6_9_8_TASK9_ADMISSION_CAPABILITY_INVALID');

    expect(
      consumePhase698Task9ReservationAdmissionCapability(
        admission.reservationCapability,
        process.cwd(),
      ).source,
    ).toEqual(admission.source);
    expect(() =>
      consumePhase698Task9ReservationAdmissionCapability(
        admission.reservationCapability,
        process.cwd(),
      ),
    ).toThrow('PHASE_6_9_8_TASK9_RESERVATION_ADMISSION_CAPABILITY_INVALID');
  });

  test('rejects forged capability-shaped objects', () => {
    expect(() =>
      consumePhase698Task9AdmissionCapability(
        {
          version: 'phase-6.9.8-retriever-final-response-task9-admission-capability-v1',
        },
        'synthetic_test',
      ),
    ).toThrow('PHASE_6_9_8_TASK9_ADMISSION_CAPABILITY_INVALID');
    expect(() =>
      consumePhase698Task9ReservationAdmissionCapability(
        {
          version: 'phase-6.9.8-retriever-final-response-task9-reservation-admission-capability-v1',
        },
        process.cwd(),
      ),
    ).toThrow('PHASE_6_9_8_TASK9_RESERVATION_ADMISSION_CAPABILITY_INVALID');
  });
});
