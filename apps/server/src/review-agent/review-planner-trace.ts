import type { ModelCandidateObservation } from '@repo/agent/model-candidates';
import type {
  AgentTraceCreateRequest,
  AgentTraceStatus,
} from '@repo/types/api/agent-trace';

type CandidateObservation = ModelCandidateObservation<string>;

export function createReviewPlannerTrace(input: {
  runId: string;
  startedAt: Date;
  finishedAt: Date;
  deterministicReviewDurationMs: number;
  deterministicPlannerDurationMs: number;
  review: CandidateObservation;
  planner: CandidateObservation;
}): AgentTraceCreateRequest {
  const traces = [input.review, input.planner]
    .map(getTrace)
    .filter(
      (trace): trace is NonNullable<ReturnType<typeof getTrace>> =>
        trace !== null,
    );
  const primary = traces[0] ?? null;
  const usage = traces.reduce(
    (total, trace) => ({
      inputTokens: total.inputTokens + trace.inputTokens,
      outputTokens: total.outputTokens + trace.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
  const degraded = [input.review, input.planner].some(isFallback);

  return {
    runId: input.runId,
    conversationId: null,
    route: 'review_analysis',
    confidence: 1,
    status: degraded ? 'degraded' : 'completed',
    mode: primary?.mode ?? 'mock',
    modelProvider: primary?.provider ?? 'local_deterministic',
    modelName: primary?.model ?? 'review-planner-local',
    inputTokenEstimate: usage.inputTokens,
    outputTokenEstimate: usage.outputTokens,
    maxOutputTokens: 440,
    pricingKnown: false,
    costEstimate: 0,
    ragHitCount: 0,
    verifierStatus: 'skipped',
    verifierChunkCount: 0,
    degraded,
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    totalDurationMs: elapsed(input.startedAt, input.finishedAt),
    steps: sequentialSteps(input),
  };
}

function sequentialSteps(
  input: Parameters<typeof createReviewPlannerTrace>[0],
) {
  let cursor = input.startedAt;
  const steps: AgentTraceCreateRequest['steps'] = [];
  const addDeterministic = (node: string, durationMs: number) => {
    const duration = normalizeDuration(durationMs);
    steps.push({
      node,
      status: 'completed',
      startedAt: cursor.toISOString(),
      finishedAt: new Date(cursor.getTime() + duration).toISOString(),
      durationMs: duration,
      inputSummary: 'scope=owner_read_only',
      outputSummary: 'result=deterministic',
      errorMessage: null,
    });
    cursor = new Date(cursor.getTime() + duration);
  };
  const addCandidate = (node: string, observation: CandidateObservation) => {
    const trace = getTrace(observation);
    const duration = normalizeDuration(trace?.durationMs);
    const status: AgentTraceStatus = isFallback(observation)
      ? 'degraded'
      : 'completed';
    steps.push({
      node,
      status,
      startedAt: cursor.toISOString(),
      finishedAt: new Date(cursor.getTime() + duration).toISOString(),
      durationMs: duration,
      inputSummary: 'scope=local_projection',
      outputSummary: `disposition=${observation.disposition}`,
      errorMessage: trace?.errorCode ? `error_code=${trace.errorCode}` : null,
    });
    cursor = new Date(cursor.getTime() + duration);
  };

  addDeterministic('deterministic_review', input.deterministicReviewDurationMs);
  addCandidate('review_candidate', input.review);
  addDeterministic(
    'deterministic_planner',
    input.deterministicPlannerDurationMs,
  );
  addCandidate('planner_candidate', input.planner);
  return steps;
}

function getTrace(observation: CandidateObservation) {
  return observation.attempted && 'trace' in observation
    ? (observation.trace ?? null)
    : null;
}

function isFallback(observation: CandidateObservation) {
  return (
    observation.attempted && observation.disposition !== 'candidate_applied'
  );
}

function elapsed(startedAt: Date, finishedAt: Date) {
  return normalizeDuration(finishedAt.getTime() - startedAt.getTime());
}

function normalizeDuration(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}
