import type { ModelCandidateObservation } from '@repo/agent/model-candidates';
import type {
  ReviewPlannerModelObservation,
  ReviewPlannerModelObservations,
} from '@repo/types/api/review-agent';

type CandidateObservation = ModelCandidateObservation<string>;

const LOCAL_BUDGET = Object.freeze({
  maxCalls: 2,
  usedCalls: 0,
  maxInputTokens: 1950,
  usedInputTokens: 0,
  maxOutputTokens: 440,
  usedOutputTokens: 0,
});

export function createLocalReviewPlannerCandidateObservation(): CandidateObservation {
  return {
    attempted: false,
    disposition: 'not_eligible',
    budget: { ...LOCAL_BUDGET },
    usage: { inputTokens: 0, outputTokens: 0 },
    reasonCodes: ['not_eligible'],
  };
}

/** This public projection excludes prompts, source facts, provider text and runtime configuration. */
export function toReviewPlannerModelObservations(input: {
  review: CandidateObservation;
  planner: CandidateObservation;
}): ReviewPlannerModelObservations {
  return {
    version: 1,
    review: toModelObservation(input.review),
    planner: toModelObservation(input.planner),
  };
}

function toModelObservation(
  observation: CandidateObservation,
): ReviewPlannerModelObservation {
  const trace = getTrace(observation);
  const isLiveProviderFailure =
    observation.attempted &&
    trace?.mode === 'live' &&
    trace.errorCode === 'PROVIDER_ERROR' &&
    trace.providerFailureCategory !== undefined;
  return {
    attempted: observation.attempted,
    disposition: observation.disposition,
    durationMs: normalizeDuration(trace?.durationMs),
    usage: {
      inputTokens: normalizeTokens(observation.usage.inputTokens),
      outputTokens: normalizeTokens(observation.usage.outputTokens),
    },
    ...(trace?.errorCode ? { errorCode: trace.errorCode } : {}),
    ...(isLiveProviderFailure
      ? { providerFailureCategory: trace.providerFailureCategory }
      : {}),
    provenance: trace
      ? trace.mode === 'live'
        ? 'live_candidate'
        : 'mock_candidate'
      : 'local_deterministic',
    degraded: trace?.degraded ?? true,
    cached: false,
  };
}

function getTrace(observation: CandidateObservation) {
  return observation.attempted && 'trace' in observation
    ? (observation.trace ?? null)
    : null;
}

function normalizeDuration(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function normalizeTokens(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}
