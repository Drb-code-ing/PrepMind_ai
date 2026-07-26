import { createHash } from 'node:crypto';

export const PHASE_6_9_7_V5_EVAL_POLICY_VERSION = 'phase-6.9.7-v5-eval-policy-v1' as const;

export const PHASE_6_9_7_V5_EVAL_POLICY = deepFreeze({
  version: PHASE_6_9_7_V5_EVAL_POLICY_VERSION,
  datasetVersion: 'phase-6.9-tutor-wrong-question-v2',
  counts: {
    cases: 72,
    zeroCallCases: 24,
    runtimeCases: 48,
    pairedRequests: 24,
    tutorRuntimeCases: 24,
    organizerRuntimeCases: 24,
    organizerDecisionUnits: 32,
  },
  languageCoverage: {
    tutorRuntime: { zh: 12, en: 10, mixed: 2 },
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
  latencyMs: {
    tutorP95Max: 2_500,
    organizerP95Max: 4_500,
    pairedP95Max: 4_500,
    orchestrationP95Max: 6_500,
    requiredSamplesPerLane: 24,
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
});

export const PHASE_6_9_7_V5_EVAL_POLICY_SHA256 = computePhase697V5PolicySha256(
  PHASE_6_9_7_V5_EVAL_POLICY,
);

export const PHASE_6_9_7_V5_FROZEN_EVAL_POLICY_SHA256 =
  'b39134038c22fe304cf3212da11da468d9a2d88a51a0162bbad1102186cf009d' as const;

if (PHASE_6_9_7_V5_EVAL_POLICY_SHA256 !== PHASE_6_9_7_V5_FROZEN_EVAL_POLICY_SHA256) {
  throw new Error('PHASE_6_9_7_V5_EVAL_POLICY_SHA_MISMATCH');
}

export function computePhase697V5PolicySha256(value: unknown) {
  return createHash('sha256')
    .update(JSON.stringify(sortObjectKeys(value)))
    .digest('hex');
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (typeof value !== 'object' || value === null) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => compareCodePoints(left, right))
      .map(([key, child]) => [key, sortObjectKeys(child)]),
  );
}

function compareCodePoints(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
