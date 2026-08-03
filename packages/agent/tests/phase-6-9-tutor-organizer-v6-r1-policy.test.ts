import { describe, expect, test } from 'bun:test';

import {
  PHASE_6_9_7_V6_DATASET_BINDING,
  PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
  PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
  PHASE_6_9_7_V6_FROZEN_DATASET_BINDING_SHA256,
  computePhase697V6CanonicalSha256,
  type Phase697V6SubjectDecision,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-dataset-binding.ts';
import {
  buildPhase697V6LatencyAggregate,
  calculatePhase697V6NearestRankP95,
  derivePhase697V6DurationEvidence,
  readPhase697V6MonotonicMs,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-deadline.ts';
import { scorePhase697V6ModelOwnedMetrics } from '../src/evals/phase-6-9-tutor-wrong-question-v6-model-owned-metrics.ts';
import {
  PHASE_6_9_7_V6_EVAL_POLICY,
  PHASE_6_9_7_V6_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V6_EVAL_POLICY_VERSION,
  PHASE_6_9_7_V6_FROZEN_EVAL_POLICY_SHA256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v6-policy.ts';
import { PHASE_6_9_7_V5_LANE_POLICY } from '../src/evals/phase-6-9-tutor-wrong-question-v5-contract.ts';
import {
  PHASE_6_9_7_V5_EVAL_POLICY_SHA256,
  PHASE_6_9_7_V5_FROZEN_EVAL_POLICY_SHA256,
} from '../src/evals/phase-6-9-tutor-wrong-question-v5-policy.ts';

describe('Phase 6.9.7 V6 R1 eval and deadline contracts', () => {
  test('binds unchanged V2 bytes to an independent V6 identity', () => {
    expect(PHASE_6_9_7_V6_DATASET_BINDING_VERSION).toBe('phase-6.9.7-v6-dataset-binding-v1');
    expect(PHASE_6_9_7_V6_DATASET_BINDING.source).toEqual({
      datasetVersion: 'phase-6.9-tutor-wrong-question-v2',
      datasetSha256: '42803d454fe59f2854ba1ccb115f2b813cc17cd9e26f3221a19b03fdd67b437b',
      deterministicBaselineSha256:
        '0ce7c3ca5f6f7d2c78f37f88c5f90c24c7f1ed19575d4e43d9edcd41341116ca',
      expectedBytesPolicy: 'reuse_without_modification',
    });
    expect(PHASE_6_9_7_V6_DATASET_BINDING_SHA256).toBe(
      PHASE_6_9_7_V6_FROZEN_DATASET_BINDING_SHA256,
    );
    expect(PHASE_6_9_7_V6_DATASET_BINDING.tutorModelOwnedExpectations).toHaveLength(24);
    expect(PHASE_6_9_7_V6_DATASET_BINDING.organizerModelOwnedExpectations).toHaveLength(32);
    expect(
      new Set(
        PHASE_6_9_7_V6_DATASET_BINDING.organizerModelOwnedExpectations.map(
          (entry) => entry.decisionId,
        ),
      ).size,
    ).toBe(32);
    expect(isDeepFrozen(PHASE_6_9_7_V6_DATASET_BINDING)).toBe(true);

    const drift = structuredClone(PHASE_6_9_7_V6_DATASET_BINDING);
    drift.counts.organizerDecisionUnits = 31 as 32;
    expect(computePhase697V6CanonicalSha256(drift)).not.toBe(PHASE_6_9_7_V6_DATASET_BINDING_SHA256);
  });

  test('freezes independent timeout, P95, model-owned, and lineage policy', () => {
    expect(PHASE_6_9_7_V6_EVAL_POLICY_VERSION).toBe('phase-6.9.7-v6-eval-policy-v1');
    expect(PHASE_6_9_7_V6_EVAL_POLICY_SHA256).toBe(PHASE_6_9_7_V6_FROZEN_EVAL_POLICY_SHA256);
    expect(PHASE_6_9_7_V6_EVAL_POLICY.deadlineMs).toEqual({
      tutorExecutorHardTimeout: 3500,
      tutorQualitySla: 2500,
      tutorCancellationMargin: 1000,
      organizerExecutorHardTimeout: 5000,
    });
    expect(PHASE_6_9_7_V6_EVAL_POLICY.latency).toMatchObject({
      nearestRankFormula: 'sorted[ceil(0.95*n)-1]',
      requiredSamplesPerGate: 24,
      requiredNearestRankOneBased: 23,
      tutorCandidateP95Max: 2500,
      organizerCandidateP95Max: 4500,
      pairedCandidateP95Max: 4500,
      tutorOrchestrationP95Max: 6500,
      incompleteAggregateMustBeNull: true,
    });
    expect(PHASE_6_9_7_V6_EVAL_POLICY.modelOwnedQuality).toMatchObject({
      tutorIntent: { denominator: 24, minimumCorrect: 21 },
      organizerSubjectDecision: { denominator: 32, minimumCorrect: 28 },
      organizerDeckAction: { denominator: 32, minimumCorrect: 28 },
      organizerTargetOrdinal: { denominator: 32, minimumCorrect: 28 },
      incompleteCannotPass: true,
    });
    expect(PHASE_6_9_7_V6_EVAL_POLICY.lineage).toEqual({
      accepted: 'v6_only',
      rejectedHistoricalVersions: ['v1', 'v2', 'v3', 'v4', 'v5'],
    });
    expect(isDeepFrozen(PHASE_6_9_7_V6_EVAL_POLICY)).toBe(true);
  });

  test('uses monotonic bounded durations and records deadline overshoot without retry semantics', () => {
    expect(readPhase697V6MonotonicMs(() => 12.25)).toEqual({ ok: true, value: 12.25 });
    expect(
      readPhase697V6MonotonicMs(() => {
        throw new Error('clock failed');
      }),
    ).toEqual({ ok: false, reasonCode: 'clock_read_failed' });
    expect(readPhase697V6MonotonicMs(() => Number.NaN)).toEqual({
      ok: false,
      reasonCode: 'clock_value_invalid',
    });

    expect(
      derivePhase697V6DurationEvidence({
        stage: 'executor',
        startedMs: 1_000,
        finishedMs: 4_521.12345,
        deadlineMs: 3_500,
      }),
    ).toEqual({
      ok: true,
      value: {
        stage: 'executor',
        durationMs: 3521.1235,
        deadlineMs: 3500,
        deadlineExceeded: true,
        deadlineOvershootMs: 21.1235,
      },
    });
    expect(
      derivePhase697V6DurationEvidence({
        stage: 'executor',
        startedMs: 2,
        finishedMs: 1,
        deadlineMs: 3500,
      }),
    ).toEqual({ ok: false, reasonCode: 'clock_rollback' });
    expect(
      derivePhase697V6DurationEvidence({
        stage: 'runtime_trace',
        startedMs: 0,
        finishedMs: 60_001,
      }),
    ).toEqual({ ok: false, reasonCode: 'clock_jump' });
    expect(
      derivePhase697V6DurationEvidence({
        stage: 'executor',
        startedMs: 0,
        finishedMs: 1,
        deadlineMs: 0,
      }),
    ).toEqual({ ok: false, reasonCode: 'deadline_invalid' });
    expect(derivePhase697V6DurationEvidence(null)).toEqual({
      ok: false,
      reasonCode: 'sample_value_invalid',
    });
    const hostileInput = Object.defineProperty({}, 'stage', {
      get() {
        throw new Error('hostile accessor');
      },
    });
    expect(derivePhase697V6DurationEvidence(hostileInput)).toEqual({
      ok: false,
      reasonCode: 'sample_value_invalid',
    });
  });

  test('uses the 23rd sorted value for a complete 24-sample nearest-rank P95', () => {
    expect(calculatePhase697V6NearestRankP95([...Array(24)].map((_, index) => 24 - index))).toEqual(
      { ok: true, value: 23 },
    );
    expect(calculatePhase697V6NearestRankP95([...Array(23)].map((_, index) => index))).toEqual({
      ok: false,
      reasonCode: 'sample_count_invalid',
    });
    expect(calculatePhase697V6NearestRankP95([...Array(25)].map((_, index) => index))).toEqual({
      ok: false,
      reasonCode: 'sample_count_invalid',
    });
    expect(calculatePhase697V6NearestRankP95(null)).toEqual({
      ok: false,
      reasonCode: 'sample_count_invalid',
    });
    const hostileIterator = [...Array(24)].map((_, index) => index + 1);
    Object.defineProperty(hostileIterator, Symbol.iterator, {
      get() {
        throw new Error('caller-controlled iterator must not run');
      },
    });
    expect(calculatePhase697V6NearestRankP95(hostileIterator)).toEqual({
      ok: true,
      value: 23,
    });
    expect(
      calculatePhase697V6NearestRankP95([
        ...[...Array(23)].map((_, index) => index),
        Number.POSITIVE_INFINITY,
      ]),
    ).toEqual({ ok: false, reasonCode: 'sample_value_invalid' });
  });

  test('nulls every latency gate when any fixed-denominator lane is incomplete', () => {
    const complete = completeLatencySamples();
    expect(buildPhase697V6LatencyAggregate(complete)).toEqual({
      complete: true,
      tutorCandidateP95Ms: 23,
      organizerCandidateP95Ms: 1023,
      pairedCandidateP95Ms: 2023,
      tutorOrchestrationP95Ms: 3023,
    });

    const missingAfterTimeout = completeLatencySamples();
    missingAfterTimeout.tutorCandidateMs.pop();
    expect(buildPhase697V6LatencyAggregate(missingAfterTimeout)).toEqual({
      complete: false,
      tutorCandidateP95Ms: null,
      organizerCandidateP95Ms: null,
      pairedCandidateP95Ms: null,
      tutorOrchestrationP95Ms: null,
    });

    const invalidAfterTimeout = completeLatencySamples();
    invalidAfterTimeout.organizerCandidateMs[5] = Number.NaN;
    expect(buildPhase697V6LatencyAggregate(invalidAfterTimeout)).toEqual({
      complete: false,
      tutorCandidateP95Ms: null,
      organizerCandidateP95Ms: null,
      pairedCandidateP95Ms: null,
      tutorOrchestrationP95Ms: null,
    });
  });

  test('keeps the V5 3000ms timeout and frozen policy isolated from V6 3500ms', () => {
    expect(PHASE_6_9_7_V5_LANE_POLICY.tutor.timeoutMs).toBe(3_000);
    expect(PHASE_6_9_7_V5_EVAL_POLICY_SHA256).toBe(PHASE_6_9_7_V5_FROZEN_EVAL_POLICY_SHA256);
    expect(PHASE_6_9_7_V5_FROZEN_EVAL_POLICY_SHA256).toBe(
      'b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d',
    );
    expect(PHASE_6_9_7_V6_EVAL_POLICY.deadlineMs.tutorExecutorHardTimeout).toBe(3_500);
  });

  test('scores exact model-owned axes at frozen discrete thresholds', () => {
    const perfect = perfectObservations();
    const perfectScore = scorePhase697V6ModelOwnedMetrics(perfect);
    expect(perfectScore.ok).toBe(true);
    if (!perfectScore.ok) throw new Error('V6_MODEL_OWNED_PERFECT_SCORE_FAILED');
    expect(perfectScore.value).toMatchObject({
      tutorIntent: { correct: 24, denominator: 24, accuracy: 1, complete: true, passed: true },
      organizerSubjectDecision: {
        correct: 32,
        denominator: 32,
        accuracy: 1,
        complete: true,
        passed: true,
      },
      organizerDeckAction: { correct: 32, complete: true, passed: true },
      organizerTargetOrdinal: { correct: 32, complete: true, passed: true },
      qualityGatePassed: true,
    });

    const boundary = perfectObservations();
    for (let index = 0; index < 3; index += 1) boundary.tutor[index]!.intent = null;
    for (let index = 0; index < 4; index += 1) {
      boundary.organizer[index]!.subjectDecision = wrongSubjectDecision(
        boundary.organizer[index]!.subjectDecision,
      );
      boundary.organizer[index]!.deckAction =
        boundary.organizer[index]!.deckAction === 'reuse_existing'
          ? 'create_topic'
          : 'reuse_existing';
      boundary.organizer[index]!.targetOrdinal += 1;
    }
    const boundaryScore = scorePhase697V6ModelOwnedMetrics(boundary);
    expect(boundaryScore.ok).toBe(true);
    if (!boundaryScore.ok) throw new Error('V6_MODEL_OWNED_BOUNDARY_SCORE_FAILED');
    expect(boundaryScore.value.tutorIntent).toMatchObject({ correct: 21, passed: true });
    expect(boundaryScore.value.organizerSubjectDecision).toMatchObject({
      correct: 28,
      passed: true,
    });
    expect(boundaryScore.value.organizerDeckAction).toMatchObject({ correct: 28, passed: true });
    expect(boundaryScore.value.organizerTargetOrdinal).toMatchObject({
      correct: 28,
      passed: true,
    });

    boundary.tutor[3]!.intent = null;
    boundary.organizer[4]!.subjectDecision = wrongSubjectDecision(
      boundary.organizer[4]!.subjectDecision,
    );
    boundary.organizer[4]!.deckAction =
      boundary.organizer[4]!.deckAction === 'reuse_existing' ? 'create_topic' : 'reuse_existing';
    boundary.organizer[4]!.targetOrdinal += 1;
    const failed = scorePhase697V6ModelOwnedMetrics(boundary);
    expect(failed.ok).toBe(true);
    if (!failed.ok) throw new Error('V6_MODEL_OWNED_FAILED_SCORE_MISSING');
    expect(failed.value.qualityGatePassed).toBe(false);
    expect(failed.value.tutorIntent.correct).toBe(20);
    expect(failed.value.organizerSubjectDecision.correct).toBe(27);
    expect(failed.value.organizerDeckAction.correct).toBe(27);
    expect(failed.value.organizerTargetOrdinal.correct).toBe(27);
  });

  test('keeps missing observations in the fixed denominator and rejects identity corruption', () => {
    const partial = perfectObservations();
    partial.tutor = partial.tutor.slice(0, 21);
    partial.organizer = partial.organizer.slice(0, 28);
    const score = scorePhase697V6ModelOwnedMetrics(partial);
    expect(score.ok).toBe(true);
    if (!score.ok) throw new Error('V6_MODEL_OWNED_PARTIAL_SCORE_FAILED');
    expect(score.value.tutorIntent).toMatchObject({ correct: 21, complete: false, passed: false });
    expect(score.value.organizerSubjectDecision).toMatchObject({
      correct: 28,
      complete: false,
      passed: false,
    });
    expect(score.value.qualityGatePassed).toBe(false);

    const duplicate = perfectObservations();
    duplicate.tutor[1]!.caseId = duplicate.tutor[0]!.caseId;
    expect(scorePhase697V6ModelOwnedMetrics(duplicate)).toEqual({
      ok: false,
      reasonCode: 'duplicate_observation',
    });
    const unknown = perfectObservations();
    unknown.organizer[0]!.decisionId = 'organizer-v2-runtime-unknown:q0';
    expect(scorePhase697V6ModelOwnedMetrics(unknown)).toEqual({
      ok: false,
      reasonCode: 'unknown_observation',
    });

    const hostile = Object.defineProperty({}, 'tutor', {
      get() {
        throw new Error('hostile observation accessor');
      },
    });
    expect(scorePhase697V6ModelOwnedMetrics(hostile)).toEqual({
      ok: false,
      reasonCode: 'invalid_input',
    });
  });
});

function perfectObservations() {
  return {
    tutor: PHASE_6_9_7_V6_DATASET_BINDING.tutorModelOwnedExpectations.map((expected) => ({
      caseId: expected.caseId,
      intent: expected.intent as (typeof expected)['intent'] | null,
    })),
    organizer: PHASE_6_9_7_V6_DATASET_BINDING.organizerModelOwnedExpectations.map((expected) => ({
      decisionId: expected.decisionId,
      subjectDecision: structuredClone(
        expected.subjectDecision,
      ) as Phase697V6SubjectDecision | null,
      deckAction: expected.deckAction as typeof expected.deckAction | null,
      targetOrdinal: expected.targetOrdinal,
    })),
  };
}

function completeLatencySamples() {
  return {
    tutorCandidateMs: [...Array(24)].map((_, index) => index + 1),
    organizerCandidateMs: [...Array(24)].map((_, index) => index + 1_001),
    pairedCandidateMs: [...Array(24)].map((_, index) => index + 2_001),
    tutorOrchestrationMs: [...Array(24)].map((_, index) => index + 3_001),
  };
}

function wrongSubjectDecision(
  decision: Phase697V6SubjectDecision | null,
): Phase697V6SubjectDecision {
  return decision?.action === 'keep_local'
    ? { action: 'select_subject', subjectIndex: 0 }
    : { action: 'keep_local' };
}

function isDeepFrozen(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return true;
  return Object.isFrozen(value) && Object.values(value).every(isDeepFrozen);
}
