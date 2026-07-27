import { PHASE_6_9_7_V6_EVAL_POLICY } from './phase-6-9-tutor-wrong-question-v6-policy.ts';

export const PHASE_6_9_7_V6_DURATION_STAGES = [
  'executor',
  'runtime_trace',
  'candidate_orchestration',
  'paired_request',
] as const;

export type Phase697V6DurationStage = (typeof PHASE_6_9_7_V6_DURATION_STAGES)[number];
export type Phase697V6MonotonicClock = () => number;

export type Phase697V6DurationFailureCode =
  | 'clock_read_failed'
  | 'clock_value_invalid'
  | 'clock_rollback'
  | 'clock_jump'
  | 'deadline_invalid'
  | 'sample_count_invalid'
  | 'sample_value_invalid';

export type Phase697V6DurationEvidence = Readonly<{
  stage: Phase697V6DurationStage;
  durationMs: number;
  deadlineMs: number | null;
  deadlineExceeded: boolean | null;
  deadlineOvershootMs: number | null;
}>;

export type Phase697V6DurationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; reasonCode: Phase697V6DurationFailureCode }>;

export type Phase697V6LatencyAggregate = Readonly<{
  complete: boolean;
  tutorCandidateP95Ms: number | null;
  organizerCandidateP95Ms: number | null;
  pairedCandidateP95Ms: number | null;
  tutorOrchestrationP95Ms: number | null;
}>;

const INCOMPLETE_LATENCY_AGGREGATE: Phase697V6LatencyAggregate = Object.freeze({
  complete: false,
  tutorCandidateP95Ms: null,
  organizerCandidateP95Ms: null,
  pairedCandidateP95Ms: null,
  tutorOrchestrationP95Ms: null,
});

export function createPhase697V6MonotonicClock(): Phase697V6MonotonicClock {
  return () => globalThis.performance.now();
}

export function readPhase697V6MonotonicMs(
  clock: Phase697V6MonotonicClock,
): Phase697V6DurationResult<number> {
  try {
    const value = clock();
    return isClockReading(value)
      ? { ok: true, value }
      : { ok: false, reasonCode: 'clock_value_invalid' };
  } catch {
    return { ok: false, reasonCode: 'clock_read_failed' };
  }
}

export function derivePhase697V6DurationEvidence(
  input: unknown,
): Phase697V6DurationResult<Phase697V6DurationEvidence> {
  try {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return { ok: false, reasonCode: 'sample_value_invalid' };
    }
    const sample = input as Readonly<Record<string, unknown>>;
    const stage = sample.stage;
    if (!isDurationStage(stage)) {
      return { ok: false, reasonCode: 'sample_value_invalid' };
    }
    const startedMs = sample.startedMs;
    const finishedMs = sample.finishedMs;
    if (!isClockReading(startedMs) || !isClockReading(finishedMs)) {
      return { ok: false, reasonCode: 'clock_value_invalid' };
    }
    if (finishedMs < startedMs) {
      return { ok: false, reasonCode: 'clock_rollback' };
    }
    const rawDuration = finishedMs - startedMs;
    if (
      !Number.isFinite(rawDuration) ||
      rawDuration < 0 ||
      rawDuration > PHASE_6_9_7_V6_EVAL_POLICY.latency.maxRecordedDurationMs
    ) {
      return { ok: false, reasonCode: 'clock_jump' };
    }
    const deadlineMs = sample.deadlineMs;
    if (
      deadlineMs !== undefined &&
      (typeof deadlineMs !== 'number' ||
        !Number.isSafeInteger(deadlineMs) ||
        deadlineMs <= 0 ||
        deadlineMs > PHASE_6_9_7_V6_EVAL_POLICY.latency.maxRecordedDurationMs)
    ) {
      return { ok: false, reasonCode: 'deadline_invalid' };
    }
    const durationMs = roundDuration(rawDuration);
    const deadlineExceeded = deadlineMs === undefined ? null : durationMs > deadlineMs;
    return {
      ok: true,
      value: Object.freeze({
        stage,
        durationMs,
        deadlineMs: deadlineMs ?? null,
        deadlineExceeded,
        deadlineOvershootMs:
          deadlineMs === undefined ? null : roundDuration(Math.max(0, durationMs - deadlineMs)),
      }),
    };
  } catch {
    return { ok: false, reasonCode: 'sample_value_invalid' };
  }
}

export function calculatePhase697V6NearestRankP95(
  samples: unknown,
): Phase697V6DurationResult<number> {
  try {
    if (
      !Array.isArray(samples) ||
      samples.length !== PHASE_6_9_7_V6_EVAL_POLICY.latency.requiredSamplesPerGate
    ) {
      return { ok: false, reasonCode: 'sample_count_invalid' };
    }
    const validated: number[] = [];
    for (
      let index = 0;
      index < PHASE_6_9_7_V6_EVAL_POLICY.latency.requiredSamplesPerGate;
      index += 1
    ) {
      const sample = (samples as readonly unknown[])[index];
      if (
        typeof sample !== 'number' ||
        !Number.isFinite(sample) ||
        sample < 0 ||
        sample > PHASE_6_9_7_V6_EVAL_POLICY.latency.maxRecordedDurationMs
      ) {
        return { ok: false, reasonCode: 'sample_value_invalid' };
      }
      validated.push(sample);
    }
    const sorted = validated.sort((left, right) => left - right);
    const index =
      Math.ceil(PHASE_6_9_7_V6_EVAL_POLICY.latency.nearestRankQuantile * sorted.length) - 1;
    const value = sorted[index];
    return value === undefined
      ? { ok: false, reasonCode: 'sample_count_invalid' }
      : { ok: true, value: roundDuration(value) };
  } catch {
    return { ok: false, reasonCode: 'sample_value_invalid' };
  }
}

export function buildPhase697V6LatencyAggregate(input: unknown): Phase697V6LatencyAggregate {
  try {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return INCOMPLETE_LATENCY_AGGREGATE;
    }
    const samples = input as Readonly<Record<string, unknown>>;
    const tutorCandidate = calculatePhase697V6NearestRankP95(samples.tutorCandidateMs);
    const organizerCandidate = calculatePhase697V6NearestRankP95(samples.organizerCandidateMs);
    const pairedCandidate = calculatePhase697V6NearestRankP95(samples.pairedCandidateMs);
    const tutorOrchestration = calculatePhase697V6NearestRankP95(samples.tutorOrchestrationMs);
    if (
      !tutorCandidate.ok ||
      !organizerCandidate.ok ||
      !pairedCandidate.ok ||
      !tutorOrchestration.ok
    ) {
      return INCOMPLETE_LATENCY_AGGREGATE;
    }
    return Object.freeze({
      complete: true,
      tutorCandidateP95Ms: tutorCandidate.value,
      organizerCandidateP95Ms: organizerCandidate.value,
      pairedCandidateP95Ms: pairedCandidate.value,
      tutorOrchestrationP95Ms: tutorOrchestration.value,
    });
  } catch {
    return INCOMPLETE_LATENCY_AGGREGATE;
  }
}

function isClockReading(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER
  );
}

function isDurationStage(value: unknown): value is Phase697V6DurationStage {
  return (
    typeof value === 'string' &&
    PHASE_6_9_7_V6_DURATION_STAGES.includes(value as Phase697V6DurationStage)
  );
}

function roundDuration(value: number) {
  const factor = 10 ** PHASE_6_9_7_V6_EVAL_POLICY.latency.durationPrecisionDecimals;
  return Math.round(value * factor) / factor;
}
