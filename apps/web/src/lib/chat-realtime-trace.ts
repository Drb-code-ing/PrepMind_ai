import {
  FINAL_RESPONSE_AGENT_PRICE_PROFILE,
  type FinalResponseAgentObservationV1,
} from '@repo/agent/final-response';
import {
  agentTraceRealtimeFinalizeRequestSchema,
  agentTraceRealtimePrepareRequestSchema,
  agentTraceRealtimeStartRequestSchema,
  type AgentTraceCreateRequest,
  type AgentTraceRealtimeFinalizeRequest,
  type AgentTraceRealtimePrepareRequest,
  type AgentTraceRealtimeStartRequest,
  type RealtimeAgentTraceStepRequest,
} from '@repo/types/api/agent-trace';

import type {
  PreparedRealtimeFinalResponseV1,
  RealtimeRetrieverCompositionV1,
} from './chat-realtime-composition.ts';

export type RealtimeTraceFailureReasonV1 =
  | 'context_preparation_failed'
  | 'router_failed'
  | 'retrieval_failed'
  | 'budget_invalid'
  | 'final_response_prepare_failed'
  | 'composition_invalid'
  | 'terminal_missing'
  | 'request_aborted'
  | 'unexpected_failure';

export function buildRealtimeChatTraceStartV1(
  input: Readonly<{
    runId: string;
    modelCallId: string;
    conversationId: string | null;
    mode: 'mock' | 'live';
    startedAt: Date;
  }>,
): AgentTraceRealtimeStartRequest {
  return agentTraceRealtimeStartRequestSchema.parse({
    runId: input.runId,
    modelCallId: input.modelCallId,
    conversationId: input.conversationId,
    mode: input.mode,
    startedAt: input.startedAt.toISOString(),
  });
}

export function buildRealtimeChatTracePreparationV1(
  input: Readonly<{
    start: AgentTraceRealtimeStartRequest;
    base: AgentTraceCreateRequest;
    requiresRag: boolean;
    retriever: RealtimeRetrieverCompositionV1;
    evidence: PreparedRealtimeFinalResponseV1['evidence'];
    preparedAt: Date;
  }>,
): AgentTraceRealtimePrepareRequest {
  const finishedAt = input.preparedAt.toISOString();
  const steps: RealtimeAgentTraceStepRequest[] = [
    createStep({
      node: 'RouterAgent',
      status: 'completed',
      startedAt: input.start.startedAt,
      finishedAt,
      durationMs: 0,
      inputSummary: 'scope=canonical_route',
      outputSummary: [
        `route=${input.base.route ?? 'none'}`,
        `confidence=${input.base.confidence.toFixed(2)}`,
        `requiresRag=${input.requiresRag}`,
      ].join(' '),
    }),
  ];

  if (input.base.tutorIntent !== undefined && input.base.tutorDepth !== undefined) {
    steps.push(
      createStep({
        node: 'TutorAgent',
        status: input.base.degraded ? 'degraded' : 'completed',
        startedAt: input.start.startedAt,
        finishedAt,
        durationMs: 0,
        inputSummary: 'scope=local_tutor_projection',
        outputSummary: `intent=${input.base.tutorIntent} depth=${input.base.tutorDepth}`,
      }),
    );
  }

  steps.push(
    createStep({
      node: 'RetrieverQueryRewriteCandidate',
      status:
        input.retriever.retriever.queryRewriteObservation.disposition === 'failed_no_rag'
          ? 'degraded'
          : 'completed',
      startedAt: input.start.startedAt,
      finishedAt,
      durationMs: input.retriever.retriever.queryRewriteObservation.trace?.durationMs ?? 0,
      inputSummary: 'scope=bounded_query_projection',
      outputSummary: [
        `attempted=${input.retriever.retriever.queryRewriteObservation.attempted}`,
        `disposition=${input.retriever.retriever.queryRewriteObservation.disposition}`,
        `provenance=${input.retriever.retriever.queryRewriteObservation.provenance}`,
      ].join(' '),
    }),
    createStep({
      node: 'RetrieverAgent',
      status: toRetrieverStepStatus(input.retriever.retriever.result.status),
      startedAt: input.start.startedAt,
      finishedAt,
      durationMs: input.retriever.retriever.result.retrieval.latencyMs,
      inputSummary: [
        `mode=${input.retriever.retriever.result.retrieval.mode}`,
        `topK=${input.retriever.retriever.result.retrieval.topK}`,
      ].join(' '),
      outputSummary: [
        `status=${input.retriever.retriever.result.status}`,
        `hits=${input.retriever.retriever.result.evidenceCandidates.length}`,
        `reason=${input.retriever.retriever.result.reasonCodes.join(',') || 'none'}`,
      ].join(' '),
    }),
    createStep({
      node: 'KnowledgeVerifierAgent',
      status: toVerifierStepStatus(input.retriever.verifier.assessment.status),
      startedAt: input.start.startedAt,
      finishedAt,
      durationMs: 0,
      inputSummary: `hits=${input.retriever.retriever.result.evidenceCandidates.length}`,
      outputSummary: [
        `status=${input.retriever.verifier.assessment.status}`,
        `availability=${input.retriever.verifier.assessment.availability}`,
        `checked=${input.base.verifierChunkCount}`,
      ].join(' '),
    }),
    createStep({
      node: 'EvidenceProjector',
      status: 'completed',
      startedAt: finishedAt,
      finishedAt,
      durationMs: 0,
      inputSummary: [
        `candidates=${input.evidence.traceSummary.candidateCount}`,
        `verifier=${input.retriever.verifier.assessment.status}`,
      ].join(' '),
      outputSummary: [
        `status=${input.evidence.traceSummary.status}`,
        `projected=${input.evidence.traceSummary.projectedCount}`,
        `removed=${input.evidence.traceSummary.removedCount}`,
      ].join(' '),
    }),
  );

  return agentTraceRealtimePrepareRequestSchema.parse({
    runId: input.start.runId,
    modelCallId: input.start.modelCallId,
    preparation: {
      route: input.base.route ?? null,
      confidence: input.base.confidence,
      modelProvider: input.base.modelProvider,
      modelName: input.base.modelName,
      inputTokenEstimate: input.base.inputTokenEstimate,
      outputTokenEstimate: input.base.outputTokenEstimate,
      maxOutputTokens: input.base.maxOutputTokens,
      pricingKnown: input.base.pricingKnown,
      costEstimate: input.base.costEstimate,
      ragHitCount: input.retriever.retriever.result.evidenceCandidates.length,
      ...(input.base.verifierStatus === undefined
        ? {}
        : { verifierStatus: input.base.verifierStatus }),
      verifierChunkCount: input.base.verifierChunkCount,
      ...(input.base.tutorIntent === undefined ? {} : { tutorIntent: input.base.tutorIntent }),
      ...(input.base.tutorDepth === undefined ? {} : { tutorDepth: input.base.tutorDepth }),
      degraded: input.base.degraded,
      preparedAt: finishedAt,
      steps,
    },
  });
}

export function buildRealtimeChatTraceFinalizeV1(
  input: Readonly<{
    start: AgentTraceRealtimeStartRequest;
    preparation: AgentTraceRealtimePrepareRequest;
    observation: FinalResponseAgentObservationV1;
    finishedAt: Date;
  }>,
): AgentTraceRealtimeFinalizeRequest {
  const successful = input.observation.disposition === 'completed';
  const status = successful
    ? input.preparation.preparation.degraded
      ? ('degraded' as const)
      : ('completed' as const)
    : ('failed' as const);
  const usage = successful ? input.observation.usage : null;
  const finishReason = successful
    ? input.observation.finishReason
    : input.observation.disposition === 'aborted'
      ? ('aborted' as const)
      : ('failed' as const);
  const finalStep = createFinalResponseStep({
    preparation: input.preparation,
    finishedAt: input.finishedAt,
    status: successful ? 'completed' : 'failed',
    durationMs: input.observation.totalLatencyMs,
    attempted: input.observation.attempted,
    disposition: input.observation.disposition,
    reasonCode: input.observation.reasonCode,
    firstTokenLatencyMs: input.observation.firstTokenLatencyMs,
    finishReason,
  });

  return agentTraceRealtimeFinalizeRequestSchema.parse({
    runId: input.start.runId,
    modelCallId: input.start.modelCallId,
    status,
    pricingKnown: usage !== null && input.observation.pricingKnown,
    degraded: status !== 'completed',
    finishedAt: input.finishedAt.toISOString(),
    totalDurationMs: elapsedSinceStart(
      input.start,
      input.finishedAt,
      input.observation.totalLatencyMs,
    ),
    firstTokenLatencyMs: input.observation.firstTokenLatencyMs,
    finishReason,
    verifiedInputTokens: usage?.inputTokens ?? null,
    verifiedOutputTokens: usage?.outputTokens ?? null,
    priceProfile:
      usage === null || !input.observation.pricingKnown ? null : FINAL_RESPONSE_AGENT_PRICE_PROFILE,
    verifiedCostCny:
      usage === null || !input.observation.pricingKnown ? null : input.observation.estimatedCostCny,
    qualityAuthority: 'none',
    preparation: input.preparation.preparation,
    steps: [...input.preparation.preparation.steps, finalStep],
  });
}

export function buildRealtimeChatTraceFailureFinalizeV1(
  input: Readonly<{
    start: AgentTraceRealtimeStartRequest;
    preparation?: AgentTraceRealtimePrepareRequest;
    finishedAt: Date;
    reasonCode: RealtimeTraceFailureReasonV1;
    finalResponseAttempted?: boolean;
  }>,
): AgentTraceRealtimeFinalizeRequest {
  const finishReason = input.reasonCode === 'request_aborted' ? 'aborted' : 'failed';
  const preparationSteps = input.preparation?.preparation.steps ?? [];
  const finalStep =
    input.preparation !== undefined && input.finalResponseAttempted === true
      ? createFinalResponseStep({
          preparation: input.preparation,
          finishedAt: input.finishedAt,
          status: 'failed',
          durationMs: 0,
          attempted: true,
          disposition: finishReason === 'aborted' ? 'aborted' : 'failed',
          reasonCode: input.reasonCode,
          firstTokenLatencyMs: null,
          finishReason,
        })
      : undefined;
  return agentTraceRealtimeFinalizeRequestSchema.parse({
    runId: input.start.runId,
    modelCallId: input.start.modelCallId,
    status: 'failed',
    pricingKnown: false,
    degraded: true,
    finishedAt: input.finishedAt.toISOString(),
    totalDurationMs: elapsedSinceStart(input.start, input.finishedAt, 0),
    firstTokenLatencyMs: null,
    finishReason,
    verifiedInputTokens: null,
    verifiedOutputTokens: null,
    priceProfile: null,
    verifiedCostCny: null,
    qualityAuthority: 'none',
    ...(input.preparation === undefined ? {} : { preparation: input.preparation.preparation }),
    steps: finalStep === undefined ? preparationSteps : [...preparationSteps, finalStep],
  });
}

function createFinalResponseStep(input: {
  preparation: AgentTraceRealtimePrepareRequest;
  finishedAt: Date;
  status: 'completed' | 'failed';
  durationMs: number;
  attempted: boolean;
  disposition: string;
  reasonCode: string;
  firstTokenLatencyMs: number | null;
  finishReason: string | null;
}): RealtimeAgentTraceStepRequest {
  return createStep({
    node: 'FinalResponseAgent',
    status: input.status,
    startedAt: input.preparation.preparation.preparedAt,
    finishedAt: input.finishedAt.toISOString(),
    durationMs: input.durationMs,
    inputSummary: 'scope=local_verified_bundle',
    outputSummary: [
      `attempted=${input.attempted}`,
      `disposition=${input.disposition}`,
      `reason=${input.reasonCode}`,
      `ttftMs=${input.firstTokenLatencyMs ?? 'none'}`,
      `finish=${input.finishReason ?? 'none'}`,
    ].join(' '),
    errorMessage: input.status === 'failed' ? normalizeReasonCode(input.reasonCode) : null,
  });
}

function createStep(
  input: Omit<RealtimeAgentTraceStepRequest, 'errorMessage'> & {
    errorMessage?: string | null;
  },
): RealtimeAgentTraceStepRequest {
  return {
    ...input,
    inputSummary: input.inputSummary.slice(0, 160),
    outputSummary: input.outputSummary.slice(0, 160),
    errorMessage: input.errorMessage?.slice(0, 80) ?? null,
  };
}

function elapsedSinceStart(
  start: AgentTraceRealtimeStartRequest,
  finishedAt: Date,
  observedDurationMs: number,
) {
  return Math.max(
    observedDurationMs,
    0,
    finishedAt.getTime() - new Date(start.startedAt).getTime(),
  );
}

function normalizeReasonCode(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9_]/gu, '_')
      .slice(0, 80) || 'unknown_failure'
  );
}

function toRetrieverStepStatus(
  status: RealtimeRetrieverCompositionV1['retriever']['result']['status'],
): RealtimeAgentTraceStepRequest['status'] {
  if (status === 'failed') return 'failed';
  if (status === 'degraded') return 'degraded';
  return 'completed';
}

function toVerifierStepStatus(
  status: RealtimeRetrieverCompositionV1['verifier']['assessment']['status'],
): RealtimeAgentTraceStepRequest['status'] {
  return status === 'trusted' || status === 'skipped' ? 'completed' : 'degraded';
}
