import {
  PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
  PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
  computePhase697V6CanonicalSha256,
} from './phase-6-9-tutor-wrong-question-v6-dataset-binding.ts';

export const PHASE_6_9_7_V6_EVAL_POLICY_VERSION = 'phase-6.9.7-v6-eval-policy-v1' as const;

export const PHASE_6_9_7_V6_EVAL_POLICY = deepFreeze({
  version: PHASE_6_9_7_V6_EVAL_POLICY_VERSION,
  datasetBinding: {
    version: PHASE_6_9_7_V6_DATASET_BINDING_VERSION,
    sha256: PHASE_6_9_7_V6_DATASET_BINDING_SHA256,
  },
  counts: {
    cases: 72,
    zeroCallCases: 24,
    runtimeCases: 48,
    pairedRequests: 24,
    tutorRuntimeCases: 24,
    organizerRuntimeCases: 24,
    organizerDecisionUnits: 32,
  },
  deadlineMs: {
    tutorExecutorHardTimeout: 3_500,
    tutorQualitySla: 2_500,
    tutorCancellationMargin: 1_000,
    organizerExecutorHardTimeout: 5_000,
  },
  latency: {
    clock: 'monotonic_only',
    stages: ['executor', 'runtime_trace', 'candidate_orchestration', 'paired_request'],
    durationPrecisionDecimals: 4,
    maxRecordedDurationMs: 60_000,
    nearestRankQuantile: 0.95,
    nearestRankFormula: 'sorted[ceil(0.95*n)-1]',
    requiredSamplesPerGate: 24,
    requiredNearestRankOneBased: 23,
    tutorCandidateP95Max: 2_500,
    organizerCandidateP95Max: 4_500,
    pairedCandidateP95Max: 4_500,
    tutorOrchestrationP95Max: 6_500,
    incompleteAggregateMustBeNull: true,
  },
  modelOwnedQuality: {
    tutorIntent: {
      denominator: 24,
      minimumAccuracy: 0.85,
      minimumCorrect: 21,
      comparison: 'exact_match',
    },
    organizerSubjectDecision: {
      denominator: 32,
      minimumAccuracy: 0.85,
      minimumCorrect: 28,
      comparison: 'action_and_ordinal_exact_match',
    },
    organizerDeckAction: {
      denominator: 32,
      minimumAccuracy: 0.85,
      minimumCorrect: 28,
      comparison: 'exact_match',
    },
    organizerTargetOrdinal: {
      denominator: 32,
      minimumAccuracy: 0.85,
      minimumCorrect: 28,
      comparison: 'action_bound_ordinal_exact_match',
    },
    missingInvalidFallbackOrUnstartedCountsAsFalse: true,
    incompleteCannotPass: true,
  },
  localAuthority: {
    tutorPreferredDepthVersion: 'tutor-preferred-depth-authority-v1',
    organizerConfidenceVersion: 'wrong-question-organizer-confidence-authority-v1',
    localFieldsCannotOffsetModelOwnedFailure: true,
  },
  quality: {
    strictRuntimeSuccesses: 48,
    tutorSemanticScoreMin: 0.85,
    organizerSemanticScoreMin: 0.85,
    combinedSemanticScoreMin: 0.85,
    tutorAbsoluteImprovementMin: 0.15,
    organizerAbsoluteImprovementMin: 0.15,
  },
  safety: {
    verifiedZeroCalls: 24,
    criticalFailuresMax: 0,
    providerFailuresMax: 0,
    permissionFailuresMax: 0,
    mutationFailuresMax: 0,
    broaderFallbacksMax: 0,
  },
  usage: {
    verifiedRuntimeCases: 48,
    providerInvocationsMax: 48,
    inputTokensMin: 1,
    inputTokensMax: 112_800,
    outputTokensMin: 1,
    outputTokensMax: 26_400,
    estimatedCostCnyExclusiveMin: 0,
    estimatedCostCnyMax: 0.55,
    incompleteAggregateMustBeNull: true,
  },
  denominatorPolicy: {
    invalidOrMissingOutputRemainsInDenominator: true,
    semanticMismatchDoesNotOpenBreaker: true,
    firstRuntimeContractFailureOpensBreaker: true,
    noRetryResumeReplayOrBackfill: true,
  },
  lineage: {
    accepted: 'v6_only',
    rejectedHistoricalVersions: ['v1', 'v2', 'v3', 'v4', 'v5'],
  },
});

export const PHASE_6_9_7_V6_EVAL_POLICY_SHA256 = computePhase697V6CanonicalSha256(
  PHASE_6_9_7_V6_EVAL_POLICY,
);
export const PHASE_6_9_7_V6_FROZEN_EVAL_POLICY_SHA256 =
  '5066decfc88e3d36671a60b3d269ae9e93e061207d44927bca9e0d2551973d89' as const;

if (PHASE_6_9_7_V6_EVAL_POLICY_SHA256 !== PHASE_6_9_7_V6_FROZEN_EVAL_POLICY_SHA256) {
  throw new Error('PHASE_6_9_7_V6_EVAL_POLICY_SHA_MISMATCH');
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
