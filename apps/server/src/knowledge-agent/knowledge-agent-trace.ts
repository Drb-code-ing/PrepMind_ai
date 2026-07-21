import type { ModelCandidateObservation } from '@repo/agent/model-candidates';
import type { ModelAgentTrace } from '@repo/ai';
import type { KnowledgeAgentRuntimeMetadata } from '@repo/types/api/knowledge-agent';
import type { AgentTraceCreateRequest } from '@repo/types/api/agent-trace';

import { estimateKnowledgeRequestCostCny } from './knowledge-model-config';

type CandidateObservation = ModelCandidateObservation<string>;
type RuntimeDisposition = KnowledgeAgentRuntimeMetadata['disposition'];

export type KnowledgeTraceCandidateInput = Readonly<{
  runtime: KnowledgeAgentRuntimeMetadata;
  observation?: CandidateObservation | null;
  usageRef?: string | null;
}>;

export function toKnowledgeRuntimeMetadata(input: {
  observation?: CandidateObservation | null;
  traceId: string | null;
  disposition?: RuntimeDisposition;
  reasonCode?: string;
  attempted?: boolean;
}): KnowledgeAgentRuntimeMetadata {
  try {
    const observation = input.observation ?? null;
    const attempted = input.attempted ?? observation?.attempted ?? false;
    let disposition =
      input.disposition ?? mapCandidateDisposition(observation?.disposition);
    const verified = verifiedUsage(observation);
    let traceId = readTraceId(input.traceId);

    if (
      disposition === 'candidate_applied' &&
      (!attempted || verified === null || traceId === null)
    ) {
      disposition =
        verified === null ? 'fallback_usage_invalid' : 'fallback_runtime_error';
      traceId = null;
    }

    const cost =
      verified === null ? null : estimateKnowledgeRequestCostCny(verified);
    const pricingKnown = cost !== null && cost > 0;
    const source =
      disposition === 'candidate_applied'
        ? ('hybrid_model' as const)
        : ('local_deterministic' as const);

    return {
      source,
      disposition,
      reasonCode: canonicalReasonCode(
        input.reasonCode ?? observationReason(observation) ?? disposition,
      ),
      attempted,
      degraded: isDegraded(disposition),
      usage: {
        inputTokens: verified?.inputTokens ?? 0,
        outputTokens: verified?.outputTokens ?? 0,
        pricingKnown,
        estimatedCostCny: pricingKnown ? cost : null,
      },
      traceId,
    };
  } catch {
    return fallbackRuntimeMetadata();
  }
}

export function buildKnowledgeSuggestionTrace(input: {
  runId: string;
  startedAt: Date;
  finishedAt: Date;
  dedup: KnowledgeTraceCandidateInput;
  organizer: KnowledgeTraceCandidateInput;
}): AgentTraceCreateRequest {
  const candidates = [
    { key: 'dedup' as const, value: input.dedup },
    { key: 'organizer' as const, value: input.organizer },
  ];
  const aggregate = aggregateVerifiedUsage(candidates);
  const traces = candidates
    .map(({ value }) => modelTrace(value.observation))
    .filter((trace): trace is ModelAgentTrace => trace !== null);
  const primary = traces[0] ?? null;
  const degraded =
    aggregate.conflict ||
    candidates.some(({ value }) => value.runtime.degraded);
  const totalDurationMs = elapsed(input.startedAt, input.finishedAt);
  const steps: AgentTraceCreateRequest['steps'] = [
    {
      node: 'knowledge_suggestion_parent',
      status: degraded ? 'degraded' : 'completed',
      startedAt: input.startedAt.toISOString(),
      finishedAt: input.finishedAt.toISOString(),
      durationMs: totalDurationMs,
      inputSummary: 'scope=owner_read_only;budget=2_calls_6000_1200',
      outputSummary: `dedup=${input.dedup.runtime.disposition};organizer=${input.organizer.runtime.disposition}`,
      errorMessage: aggregate.conflict ? 'error_code=usage_ref_conflict' : null,
    },
    candidateStep('dedup', input.dedup, input.startedAt, aggregate.refAliases),
    candidateStep(
      'organizer',
      input.organizer,
      input.startedAt,
      aggregate.refAliases,
    ),
  ];

  return {
    runId: input.runId,
    conversationId: null,
    route: 'knowledge_dedup',
    confidence: 1,
    status: degraded ? 'degraded' : 'completed',
    mode: primary?.mode ?? 'mock',
    modelProvider: primary?.provider ?? 'local_deterministic',
    modelName: primary?.model ?? 'knowledge-agents-local',
    inputTokenEstimate: aggregate.inputTokens,
    outputTokenEstimate: aggregate.outputTokens,
    maxOutputTokens: 1200,
    // AgentTrace costEstimate is USD-denominated. Knowledge runtime pricing is
    // intentionally CNY-only, so never place CNY in this USD field.
    pricingKnown: false,
    costEstimate: 0,
    ragHitCount: 0,
    verifierStatus: 'skipped',
    verifierChunkCount: 0,
    degraded,
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    totalDurationMs,
    steps,
  };
}

function candidateStep(
  key: 'dedup' | 'organizer',
  candidate: KnowledgeTraceCandidateInput,
  startedAt: Date,
  refAliases: ReadonlyMap<string, string>,
): AgentTraceCreateRequest['steps'][number] {
  const trace = modelTrace(candidate.observation);
  const durationMs = normalizeDuration(trace?.durationMs);
  const finishedAt = new Date(startedAt.getTime() + durationMs);
  const usageRef = safeUsageRef(candidate.usageRef, key);
  const alias = refAliases.get(usageRef) ?? 'none';
  const runtime = candidate.runtime;
  const usage = runtime.usage;
  const pricing = usage.pricingKnown ? 'cny_known' : 'unknown';
  const cost =
    usage.estimatedCostCny === null ? 'na' : usage.estimatedCostCny.toFixed(6);
  return {
    node: `knowledge_${key}_candidate`,
    status: runtime.degraded ? 'degraded' : 'completed',
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs,
    inputSummary: `scope=local_projection;agent=knowledge_${key};version=knowledge-agents-v1;usage_ref=${alias}`,
    outputSummary: [
      `disposition=${runtime.disposition}`,
      `reason=${runtime.reasonCode}`,
      `usage=${usage.inputTokens}/${usage.outputTokens}`,
      `pricing=${pricing}`,
      `cost_cny=${cost}`,
    ].join(';'),
    errorMessage:
      runtime.degraded && trace?.errorCode
        ? `error_code=${canonicalReasonCode(trace.errorCode)}`
        : null,
  };
}

function aggregateVerifiedUsage(
  candidates: readonly {
    key: 'dedup' | 'organizer';
    value: KnowledgeTraceCandidateInput;
  }[],
) {
  const seen = new Map<string, { inputTokens: number; outputTokens: number }>();
  const refAliases = new Map<string, string>();
  let conflict = false;
  for (const { key, value } of candidates) {
    const usage = verifiedUsage(value.observation);
    if (usage === null) continue;
    const usageRef = safeUsageRef(value.usageRef, key);
    const prior = seen.get(usageRef);
    if (
      prior !== undefined &&
      (prior.inputTokens !== usage.inputTokens ||
        prior.outputTokens !== usage.outputTokens)
    ) {
      conflict = true;
      continue;
    }
    if (prior === undefined) {
      seen.set(usageRef, usage);
      refAliases.set(usageRef, `call_${seen.size}`);
    }
  }
  const usage = [...seen.values()].reduce(
    (total, current) => ({
      inputTokens: total.inputTokens + current.inputTokens,
      outputTokens: total.outputTokens + current.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
  return { ...usage, conflict, refAliases };
}

function verifiedUsage(observation: CandidateObservation | null | undefined) {
  const trace = modelTrace(observation);
  if (
    trace === null ||
    !Number.isSafeInteger(trace.inputTokens) ||
    trace.inputTokens <= 0 ||
    !Number.isSafeInteger(trace.outputTokens) ||
    trace.outputTokens <= 0 ||
    observation?.usage.inputTokens !== trace.inputTokens ||
    observation.usage.outputTokens !== trace.outputTokens
  ) {
    return null;
  }
  return {
    inputTokens: trace.inputTokens,
    outputTokens: trace.outputTokens,
  };
}

function modelTrace(
  observation: CandidateObservation | null | undefined,
): ModelAgentTrace | null {
  try {
    return observation?.attempted && 'trace' in observation
      ? (observation.trace ?? null)
      : null;
  } catch {
    return null;
  }
}

function mapCandidateDisposition(
  disposition: CandidateObservation['disposition'] | undefined,
): RuntimeDisposition {
  switch (disposition) {
    case 'candidate_applied':
    case 'not_eligible':
    case 'safety_blocked':
    case 'fallback_aborted':
    case 'fallback_runtime_error':
      return disposition;
    case 'fallback_budget_exceeded':
      return 'fallback_budget_exhausted';
    case 'fallback_invalid_input':
    case 'fallback_schema_invalid':
      return 'fallback_schema_invalid';
    case 'fallback_timeout':
      return 'fallback_runtime_error';
    default:
      return 'gate_disabled';
  }
}

function observationReason(
  observation: CandidateObservation | null,
): string | null {
  try {
    return observation?.reasonCodes[1] ?? observation?.reasonCodes[0] ?? null;
  } catch {
    return null;
  }
}

function isDegraded(disposition: RuntimeDisposition) {
  return (
    disposition === 'snapshot_stale' ||
    disposition === 'fallback_aborted' ||
    disposition === 'fallback_budget_exhausted' ||
    disposition === 'fallback_schema_invalid' ||
    disposition === 'fallback_runtime_error' ||
    disposition === 'fallback_usage_invalid'
  );
}

function canonicalReasonCode(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 96);
  return normalized || 'fallback_runtime_error';
}

function safeUsageRef(value: unknown, fallback: 'dedup' | 'organizer') {
  return typeof value === 'string' && /^[a-z0-9_:-]{1,96}$/i.test(value)
    ? value
    : `provider_call_${fallback}`;
}

function readTraceId(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function elapsed(startedAt: Date, finishedAt: Date) {
  return normalizeDuration(finishedAt.getTime() - startedAt.getTime());
}

function normalizeDuration(value: unknown) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

function fallbackRuntimeMetadata(): KnowledgeAgentRuntimeMetadata {
  return {
    source: 'local_deterministic',
    disposition: 'fallback_runtime_error',
    reasonCode: 'fallback_runtime_error',
    attempted: false,
    degraded: true,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      pricingKnown: false,
      estimatedCostCny: null,
    },
    traceId: null,
  };
}
