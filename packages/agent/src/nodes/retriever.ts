import { createHash } from 'node:crypto';

import {
  invokeRetrieverSearchPortV1,
  RETRIEVER_SEARCH_PORT_FAILURE_CODES,
  RETRIEVER_SEARCH_PORT_REQUEST_VERSION,
  type RetrieverSearchPortOutcomeV1,
  type RetrieverSearchPortRequestV1,
  type RetrieverSearchPortV1,
} from '@repo/rag';
import { ragSafetyClassificationSchema } from '@repo/types/api/rag-safety';
import { z } from 'zod';

import {
  isAgentExecutionContextV1,
  parseRetrieverRequestV1,
  parseRetrieverResultV1,
  type AgentExecutionContextV1,
  type EvidenceCandidateV1,
  type RetrieverReasonCode,
  type RetrieverRequestV1,
  type RetrieverResultV1,
} from '../contracts/realtime-chat.ts';
import {
  clonePlainEvidenceData,
  deepFreezeModelValue,
  scanCompleteModelField,
} from '../model-candidates/model-projection-safety.ts';
import {
  RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION,
  RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS,
  RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS,
  RETRIEVER_QUERY_REWRITE_OBSERVATION_VERSION,
  runRetrieverQueryRewriteModelCandidateV1,
  type RetrieverQueryRewriteObservationV1,
} from '../model-candidates/retriever-query-rewrite-model-candidate.ts';

export {
  createRetrieverSearchPortV1,
  RETRIEVER_SEARCH_PORT_FAILURE_CODES,
  RETRIEVER_SEARCH_PORT_REQUEST_VERSION,
  RETRIEVER_SEARCH_PORT_VERSION,
  type CreateRetrieverSearchPortResultV1,
  type RetrieverSearchPortExecutorV1,
  type RetrieverSearchPortFailureCode,
  type RetrieverSearchPortOutcomeV1,
  type RetrieverSearchPortRequestV1,
  type RetrieverSearchPortV1,
} from '@repo/rag';

export const RETRIEVER_AGENT_VERSION = 'retriever-agent-v1' as const;
export const RETRIEVER_AGENT_TRACE_SUMMARY_VERSION = 'retriever-agent-trace-summary-v1' as const;
export const RETRIEVER_AGENT_POLICY_V1 = deepFreezeModelValue({
  topK: 8,
  minScore: 0.72,
  sourceTypes: ['knowledge_document'] as const,
  documentStatuses: ['DONE'] as const,
});

const MAX_PORT_HITS = 64;
const MAX_PORT_CONTENT_UTF16 = 100_000;
const MAX_EVIDENCE_EXCERPT_UTF16 = 700;
const MAX_RETRIEVAL_LATENCY_MS = 120_000;
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const BLOCKED_EXCERPT = '[unsafe knowledge excerpt removed]';

const IDENTIFIER_SCHEMA = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u);
const SCORE_SCHEMA = z.number().finite().min(0).max(1);
const PORT_HIT_SCHEMA = z
  .object({
    chunkId: IDENTIFIER_SCHEMA,
    documentId: IDENTIFIER_SCHEMA,
    documentName: z.string().min(1).max(512),
    content: z.string().min(1).max(MAX_PORT_CONTENT_UTF16),
    score: SCORE_SCHEMA,
    metadata: z.record(z.unknown()),
  })
  .strict();
const PORT_RESPONSE_SCHEMA = z
  .object({
    hits: z.array(PORT_HIT_SCHEMA).max(MAX_PORT_HITS),
  })
  .strict();
const PORT_OUTCOME_SCHEMA = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), response: z.unknown() }).strict(),
  z
    .object({
      ok: z.literal(false),
      reasonCode: z.enum(RETRIEVER_SEARCH_PORT_FAILURE_CODES),
    })
    .strict(),
]);

type RetrieverNodeFailureReason = 'invalid_input' | 'principal_binding_invalid';

export type RetrieverAgentTraceSummaryV1 = Readonly<{
  schemaVersion: typeof RETRIEVER_AGENT_TRACE_SUMMARY_VERSION;
  agent: 'RetrieverAgent';
  agentVersion: typeof RETRIEVER_AGENT_VERSION;
  runId: string;
  requestId: string;
  status: RetrieverResultV1['status'];
  reasonCodes: readonly RetrieverReasonCode[];
  originalQueryHash: string;
  executedQueryHash: string;
  rewrite: Readonly<{
    attempted: boolean;
    disposition: RetrieverResultV1['rewrite']['disposition'];
    reasonCode: RetrieverReasonCode;
  }>;
  retrieval: Readonly<{
    mode: 'hybrid';
    topK: number;
    minScore: number;
    hitCount: number;
    latencyMs: number;
  }>;
}>;

export type RetrieverAgentNodeExecutionV1 =
  | Readonly<{
      ok: true;
      result: RetrieverResultV1;
      traceSummary: RetrieverAgentTraceSummaryV1;
      queryRewriteObservation: RetrieverQueryRewriteObservationV1;
    }>
  | Readonly<{ ok: false; reasonCode: RetrieverNodeFailureReason }>;

export type RunRetrieverAgentNodeInputV1 = Readonly<{
  request: unknown;
  context: unknown;
  port: RetrieverSearchPortV1;
  queryRewrite?: Readonly<{
    config: unknown;
    createRuntime: Parameters<typeof runRetrieverQueryRewriteModelCandidateV1>[0]['createRuntime'];
  }>;
  now?: () => number;
}>;

type SafePortHit = z.infer<typeof PORT_HIT_SCHEMA>;
type NormalizedEvidence = EvidenceCandidateV1 & Readonly<{ rawContent: string }>;

const retrieverResultBindings = new WeakMap<RetrieverResultV1, AgentExecutionContextV1>();

export function isRetrieverResultBoundToExecutionContextV1(
  result: unknown,
  context: unknown,
): result is RetrieverResultV1 {
  return (
    result !== null &&
    typeof result === 'object' &&
    isAgentExecutionContextV1(context) &&
    retrieverResultBindings.get(result as RetrieverResultV1) === context
  );
}

export async function runRetrieverAgentNodeV1(
  input: RunRetrieverAgentNodeInputV1,
): Promise<RetrieverAgentNodeExecutionV1> {
  if (!isAgentExecutionContextV1(input.context)) {
    return nodeFailure('principal_binding_invalid');
  }
  const context = input.context;
  const parsedRequest = parseRetrieverRequestV1(input.request);
  if (!parsedRequest.ok) return nodeFailure('invalid_input');
  const request = parsedRequest.value;

  if (!isRequestBoundToContext(request, context)) {
    return nodeFailure('principal_binding_invalid');
  }
  if (!isFrozenRetrieverPolicy(request)) return nodeFailure('invalid_input');

  const now = readClock(input.now);
  const deadlineMs = Date.parse(request.deadlineAt);
  if (now === null || !Number.isFinite(deadlineMs)) return nodeFailure('invalid_input');

  const originalQueryHash = hashReference(request.originalQuery);
  if (!request.requiresRag) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'skipped',
        reasonCodes: ['not_required'],
        originalQueryHash,
        executedQueryHash: originalQueryHash,
        rewrite: rewriteNotEligible(),
        latencyMs: 0,
        evidenceCandidates: [],
      }),
    );
  }
  if (context.principal.kind !== 'authenticated') {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'failed',
        reasonCodes: ['anonymous_forbidden', 'rewrite_not_eligible'],
        originalQueryHash,
        executedQueryHash: originalQueryHash,
        rewrite: rewriteNotEligible(),
        latencyMs: 0,
        evidenceCandidates: [],
      }),
    );
  }
  if (!isRetrieverRequestSafe(request)) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'failed',
        reasonCodes: ['unsafe_input', 'rewrite_not_eligible'],
        originalQueryHash,
        executedQueryHash: originalQueryHash,
        rewrite: rewriteNotEligible(),
        latencyMs: 0,
        evidenceCandidates: [],
      }),
    );
  }
  if (context.signal.aborted) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'failed',
        reasonCodes: ['aborted', 'rewrite_gate_off'],
        originalQueryHash,
        executedQueryHash: originalQueryHash,
        rewrite: rewriteGateOff(),
        latencyMs: 0,
        evidenceCandidates: [],
      }),
    );
  }
  if (deadlineMs <= now) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'failed',
        reasonCodes: ['deadline_exceeded', 'rewrite_gate_off'],
        originalQueryHash,
        executedQueryHash: originalQueryHash,
        rewrite: rewriteGateOff(),
        latencyMs: 0,
        evidenceCandidates: [],
      }),
    );
  }

  const queryRewriteDependency = readQueryRewriteDependency(input.queryRewrite);
  const queryRewriteOutcome =
    queryRewriteDependency === null
      ? defaultQueryRewriteOutcome(request.originalQuery)
      : await runRetrieverQueryRewriteModelCandidateV1({
          request,
          context,
          config: queryRewriteDependency.config,
          createRuntime: queryRewriteDependency.createRuntime,
          ...(input.now ? { now: input.now } : {}),
        });
  if (!queryRewriteOutcome.ok) {
    return nodeFailure(queryRewriteOutcome.failureReasonCode ?? 'invalid_input');
  }
  const executedQuery = queryRewriteOutcome.executedQuery;
  const executedQueryHash = hashReference(executedQuery);
  const rewrite = queryRewriteOutcome.rewrite;
  const rewriteObservation = queryRewriteOutcome.observation;
  const afterRewriteNow = readClock(input.now) ?? now;
  const rewriteLatencyMs = boundedLatency(afterRewriteNow - now);
  if (context.signal.aborted) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'failed',
        reasonCodes: ['aborted', rewrite.reasonCode],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs: rewriteLatencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }
  if (deadlineMs <= afterRewriteNow) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'failed',
        reasonCodes: ['deadline_exceeded', rewrite.reasonCode],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs: rewriteLatencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }
  if (rewrite.disposition === 'failed_no_rag') {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'degraded',
        reasonCodes: ['rewrite_failed_no_rag'],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs: rewriteLatencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }

  const control = createSearchControl(context.signal, deadlineMs - afterRewriteNow);
  const portRequest = createPortRequest(request, executedQuery, control.signal);
  const invocation = invokeRetrieverSearchPortV1({
    port: input.port,
    scope: context,
    request: portRequest,
  })
    .then((value) => ({ kind: 'invoked' as const, value }))
    .catch(() => ({ kind: 'thrown' as const }));

  const raced = await Promise.race([invocation, control.interrupted]);
  control.cleanup();
  const finishedAt = readClock(input.now) ?? now;
  const latencyMs = boundedLatency(finishedAt - now);

  if (raced.kind === 'interrupted') {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'failed',
        reasonCodes: [raced.reasonCode, rewrite.reasonCode],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }
  if (context.signal.aborted) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'failed',
        reasonCodes: ['aborted', rewrite.reasonCode],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }
  if (finishedAt >= deadlineMs) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'failed',
        reasonCodes: ['deadline_exceeded', rewrite.reasonCode],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }
  if (raced.kind === 'thrown') {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'degraded',
        reasonCodes: ['retrieval_failed', rewrite.reasonCode],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }
  if (!raced.value.ok) return nodeFailure('principal_binding_invalid');

  const portOutcome = parsePortOutcome(raced.value.outcome);
  if (portOutcome === null) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'degraded',
        reasonCodes: ['schema_invalid', rewrite.reasonCode],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }
  if (!portOutcome.ok) {
    if (portOutcome.reasonCode === 'unauthorized') {
      return nodeFailure('principal_binding_invalid');
    }
    const reasonCode = mapPortFailureReason(portOutcome.reasonCode);
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status:
          reasonCode === 'aborted' || reasonCode === 'deadline_exceeded' ? 'failed' : 'degraded',
        reasonCodes: [reasonCode, rewrite.reasonCode],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }

  const evidenceCandidates = normalizePortResponse(
    portOutcome.response,
    request.policy.minScore,
    request.policy.topK,
  );
  if (evidenceCandidates === null) {
    return completedExecution(
      context,
      buildRetrieverResult({
        request,
        status: 'degraded',
        reasonCodes: ['schema_invalid', rewrite.reasonCode],
        originalQueryHash,
        executedQueryHash,
        rewrite,
        latencyMs,
        evidenceCandidates: [],
      }),
      rewriteObservation,
    );
  }

  return completedExecution(
    context,
    buildRetrieverResult({
      request,
      status: 'completed',
      reasonCodes: [
        evidenceCandidates.length === 0 ? 'no_hits' : 'retrieval_completed',
        rewrite.reasonCode,
      ],
      originalQueryHash,
      executedQueryHash,
      rewrite,
      latencyMs,
      evidenceCandidates,
    }),
    rewriteObservation,
  );
}

function isRequestBoundToContext(
  request: RetrieverRequestV1,
  context: AgentExecutionContextV1,
): boolean {
  return (
    request.runId === context.runId &&
    request.requestId === context.requestId &&
    request.deadlineAt === context.deadlineAt
  );
}

function isFrozenRetrieverPolicy(request: RetrieverRequestV1): boolean {
  return (
    request.policy.topK === RETRIEVER_AGENT_POLICY_V1.topK &&
    request.policy.minScore === RETRIEVER_AGENT_POLICY_V1.minScore &&
    request.policy.sourceTypes.length === 1 &&
    request.policy.sourceTypes[0] === 'knowledge_document' &&
    request.policy.documentStatuses.length === 1 &&
    request.policy.documentStatuses[0] === 'DONE'
  );
}

function isRetrieverRequestSafe(request: RetrieverRequestV1): boolean {
  const fields = [
    request.originalQuery,
    ...request.recentTurns.map((turn) => turn.content),
    ...(request.activeContext?.question === undefined ? [] : [request.activeContext.question]),
    ...(request.activeContext?.goal === undefined ? [] : [request.activeContext.goal]),
  ];
  return fields.every(
    (value) =>
      scanCompleteModelField(value, {
        maxUtf16CodeUnits: MAX_PORT_CONTENT_UTF16,
      }).ok,
  );
}

function createPortRequest(
  request: RetrieverRequestV1,
  query: string,
  signal: AbortSignal,
): RetrieverSearchPortRequestV1 {
  const portRequest = {
    schemaVersion: RETRIEVER_SEARCH_PORT_REQUEST_VERSION,
    runId: request.runId,
    requestId: request.requestId,
    deadlineAt: request.deadlineAt,
    query,
    topK: RETRIEVER_AGENT_POLICY_V1.topK,
    minScore: RETRIEVER_AGENT_POLICY_V1.minScore,
    sourceTypes: RETRIEVER_AGENT_POLICY_V1.sourceTypes,
    documentStatuses: RETRIEVER_AGENT_POLICY_V1.documentStatuses,
  } as RetrieverSearchPortRequestV1;
  Object.defineProperty(portRequest, 'signal', {
    value: signal,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  return Object.freeze(portRequest);
}

function parsePortOutcome(input: unknown): RetrieverSearchPortOutcomeV1 | null {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok) return null;
  const parsed = PORT_OUTCOME_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) return null;
  if (parsed.data.ok && !Object.hasOwn(parsed.data, 'response')) return null;
  return deepFreezeModelValue(parsed.data) as RetrieverSearchPortOutcomeV1;
}

function normalizePortResponse(
  input: unknown,
  minScore: number,
  topK: number,
): readonly EvidenceCandidateV1[] | null {
  const cloned = clonePlainEvidenceData(input);
  if (!cloned.ok) return null;
  const parsed = PORT_RESPONSE_SCHEMA.safeParse(cloned.value);
  if (!parsed.success) return null;

  const byIdentity = new Map<string, NormalizedEvidence>();
  const documentByChunk = new Map<string, string>();
  for (const hit of parsed.data.hits) {
    const previousDocument = documentByChunk.get(hit.chunkId);
    if (previousDocument !== undefined && previousDocument !== hit.documentId) return null;
    documentByChunk.set(hit.chunkId, hit.documentId);

    const normalized = normalizeHit(hit);
    if (normalized === null) return null;
    const identity = hit.documentId + '\u0000' + hit.chunkId;
    const existing = byIdentity.get(identity);
    if (existing === undefined) {
      byIdentity.set(identity, normalized);
      continue;
    }
    if (existing.rawContent !== normalized.rawContent) return null;
    byIdentity.set(identity, mergeDuplicateEvidence(existing, normalized));
  }

  return Object.freeze(
    [...byIdentity.values()]
      .filter((candidate) => candidate.score >= minScore)
      .sort(compareEvidence)
      .slice(0, topK)
      .map(toPublicEvidenceCandidate),
  );
}

function toPublicEvidenceCandidate(candidate: NormalizedEvidence): EvidenceCandidateV1 {
  return deepFreezeModelValue({
    citationId: candidate.citationId,
    sourceRef: candidate.sourceRef,
    documentId: candidate.documentId,
    chunkId: candidate.chunkId,
    excerpt: candidate.excerpt,
    score: candidate.score,
    vectorScore: candidate.vectorScore,
    keywordScore: candidate.keywordScore,
    safety: candidate.safety,
    truncated: candidate.truncated,
  });
}

function normalizeHit(hit: SafePortHit): NormalizedEvidence | null {
  const retrieval = parseRetrievalMetadata(hit.metadata.retrieval);
  if (retrieval === null) return null;
  const rawContent = hit.content.trim();
  if (!rawContent) return null;
  const safety = classifyEvidenceSafety(rawContent, hit.metadata.safety);
  const excerpt =
    safety.status === 'blocked'
      ? Object.freeze({ value: BLOCKED_EXCERPT, truncated: true })
      : truncateUtf16(rawContent, MAX_EVIDENCE_EXCERPT_UTF16);
  if (!excerpt.value) return null;

  return deepFreezeModelValue({
    citationId: 'cite_' + shortHash(hit.documentId + '\u0000' + hit.chunkId),
    sourceRef: 'source_' + shortHash(hit.documentId),
    documentId: hit.documentId,
    chunkId: hit.chunkId,
    excerpt: excerpt.value,
    score: normalizedScore(hit.score),
    vectorScore: normalizedScore(retrieval.vectorScore),
    keywordScore: normalizedScore(retrieval.keywordScore),
    safety: {
      ownerScope: 'matched',
      status: safety.status,
      codes: safety.codes,
    },
    truncated: safety.status === 'blocked' || excerpt.truncated,
    rawContent,
  });
}

function parseRetrievalMetadata(
  input: unknown,
): Readonly<{ vectorScore: number; keywordScore: number }> | null {
  const parsed = z
    .object({
      mode: z.literal('hybrid'),
      vectorScore: SCORE_SCHEMA,
      keywordScore: SCORE_SCHEMA,
    })
    .strict()
    .safeParse(input);
  return parsed.success
    ? Object.freeze({
        vectorScore: parsed.data.vectorScore,
        keywordScore: parsed.data.keywordScore,
      })
    : null;
}

function classifyEvidenceSafety(
  content: string,
  metadata: unknown,
): Readonly<{
  status: EvidenceCandidateV1['safety']['status'];
  codes: EvidenceCandidateV1['safety']['codes'];
}> {
  const codes = new Set<EvidenceCandidateV1['safety']['codes'][number]>();
  const scan = scanCompleteModelField(content, {
    maxUtf16CodeUnits: MAX_PORT_CONTENT_UTF16,
  });
  let status: EvidenceCandidateV1['safety']['status'] = 'unknown';
  if (!scan.ok) {
    status = 'blocked';
    if (scan.reasonCode === 'credential_material') codes.add('credential_material');
    else if (scan.reasonCode === 'control_character') codes.add('control_character');
    else if (
      scan.reasonCode === 'instruction_override' ||
      scan.reasonCode === 'system_prompt_exfiltration'
    ) {
      codes.add('prompt_injection');
    } else {
      codes.add('high_risk');
    }
  }

  const parsed = ragSafetyClassificationSchema.safeParse(metadata);
  if (parsed.success) {
    if (parsed.data.riskLevel === 'high' || !parsed.data.safeForPrompt) {
      status = 'blocked';
      codes.add('high_risk');
    } else if (status !== 'blocked') {
      status = parsed.data.riskLevel === 'medium' ? 'caution' : 'safe';
    }
    for (const category of parsed.data.categories) {
      if (category === 'instruction_override') codes.add('prompt_injection');
      else if (category === 'secret_exfiltration') codes.add('credential_material');
      else codes.add('high_risk');
    }
  } else if (status !== 'blocked') {
    status = 'unknown';
    codes.add('unknown_safety');
  }
  return Object.freeze({
    status,
    codes: sortSafetyCodes([...codes]),
  });
}

function mergeDuplicateEvidence(
  left: NormalizedEvidence,
  right: NormalizedEvidence,
): NormalizedEvidence {
  const safety = stricterSafety(left.safety, right.safety);
  const blocked = safety.status === 'blocked';
  return deepFreezeModelValue({
    ...left,
    excerpt: blocked ? BLOCKED_EXCERPT : left.excerpt,
    score: normalizedScore(Math.max(left.score, right.score)),
    vectorScore: normalizedScore(Math.max(left.vectorScore, right.vectorScore)),
    keywordScore: normalizedScore(Math.max(left.keywordScore, right.keywordScore)),
    safety,
    truncated: blocked || left.truncated || right.truncated,
  });
}

function stricterSafety(
  left: EvidenceCandidateV1['safety'],
  right: EvidenceCandidateV1['safety'],
): EvidenceCandidateV1['safety'] {
  const priority = { safe: 0, caution: 1, unknown: 2, blocked: 3 } as const;
  const status = priority[left.status] >= priority[right.status] ? left.status : right.status;
  return deepFreezeModelValue({
    ownerScope: 'matched' as const,
    status,
    codes: sortSafetyCodes([...new Set([...left.codes, ...right.codes])]),
  });
}

function sortSafetyCodes(
  codes: EvidenceCandidateV1['safety']['codes'][number][],
): EvidenceCandidateV1['safety']['codes'][number][] {
  const order = [
    'verified_safe',
    'verifier_caution',
    'prompt_injection',
    'credential_material',
    'high_risk',
    'control_character',
    'unknown_safety',
  ] as const;
  return codes.sort((left, right) => order.indexOf(left) - order.indexOf(right));
}

function compareEvidence(left: NormalizedEvidence, right: NormalizedEvidence): number {
  return (
    right.score - left.score ||
    right.keywordScore - left.keywordScore ||
    right.vectorScore - left.vectorScore ||
    compareText(left.documentId, right.documentId) ||
    compareText(left.chunkId, right.chunkId)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function buildRetrieverResult(input: {
  request: RetrieverRequestV1;
  status: RetrieverResultV1['status'];
  reasonCodes: RetrieverReasonCode[];
  originalQueryHash: string;
  executedQueryHash: string;
  rewrite: RetrieverResultV1['rewrite'];
  latencyMs: number;
  evidenceCandidates: readonly EvidenceCandidateV1[];
}): RetrieverResultV1 | null {
  const parsed = parseRetrieverResultV1({
    schemaVersion: 'retriever-result-v1',
    runId: input.request.runId,
    requestId: input.request.requestId,
    status: input.status,
    reasonCodes: input.reasonCodes,
    originalQueryHash: input.originalQueryHash,
    executedQueryHash: input.executedQueryHash,
    rewrite: input.rewrite,
    retrieval: {
      mode: 'hybrid',
      topK: input.request.policy.topK,
      minScore: input.request.policy.minScore,
      latencyMs: input.latencyMs,
    },
    evidenceCandidates: input.evidenceCandidates,
  });
  return parsed.ok ? parsed.value : null;
}

function completedExecution(
  context: AgentExecutionContextV1,
  result: RetrieverResultV1 | null,
  queryRewriteObservation: RetrieverQueryRewriteObservationV1 = defaultQueryRewriteObservation(),
): RetrieverAgentNodeExecutionV1 {
  if (result === null) return nodeFailure('invalid_input');
  retrieverResultBindings.set(result, context);
  return deepFreezeModelValue({
    ok: true as const,
    result,
    traceSummary: {
      schemaVersion: RETRIEVER_AGENT_TRACE_SUMMARY_VERSION,
      agent: 'RetrieverAgent' as const,
      agentVersion: RETRIEVER_AGENT_VERSION,
      runId: result.runId,
      requestId: result.requestId,
      status: result.status,
      reasonCodes: [...result.reasonCodes],
      originalQueryHash: result.originalQueryHash,
      executedQueryHash: result.executedQueryHash,
      rewrite: { ...result.rewrite },
      retrieval: {
        mode: result.retrieval.mode,
        topK: result.retrieval.topK,
        minScore: result.retrieval.minScore,
        hitCount: result.evidenceCandidates.length,
        latencyMs: result.retrieval.latencyMs,
      },
    },
    queryRewriteObservation,
  });
}

function nodeFailure(reasonCode: RetrieverNodeFailureReason): RetrieverAgentNodeExecutionV1 {
  return Object.freeze({ ok: false, reasonCode });
}

function rewriteNotEligible(): RetrieverResultV1['rewrite'] {
  return Object.freeze({
    attempted: false,
    disposition: 'not_eligible',
    reasonCode: 'rewrite_not_eligible',
  });
}

function rewriteGateOff(): RetrieverResultV1['rewrite'] {
  return Object.freeze({
    attempted: false,
    disposition: 'gate_off',
    reasonCode: 'rewrite_gate_off',
  });
}

function readQueryRewriteDependency(
  input: RunRetrieverAgentNodeInputV1['queryRewrite'],
): NonNullable<RunRetrieverAgentNodeInputV1['queryRewrite']> | null {
  if (input === undefined) return null;
  try {
    if (typeof input !== 'object' || input === null || Reflect.ownKeys(input).length !== 2) {
      return null;
    }
    const config = Reflect.getOwnPropertyDescriptor(input, 'config');
    const createRuntime = Reflect.getOwnPropertyDescriptor(input, 'createRuntime');
    if (
      !config ||
      !('value' in config) ||
      !createRuntime ||
      !('value' in createRuntime) ||
      typeof createRuntime.value !== 'function'
    ) {
      return null;
    }
    return Object.freeze({ config: config.value, createRuntime: createRuntime.value });
  } catch {
    return null;
  }
}

function defaultQueryRewriteOutcome(originalQuery: string) {
  return Object.freeze({
    ok: true as const,
    executedQuery: originalQuery,
    rewrite: rewriteGateOff(),
    observation: defaultQueryRewriteObservation(),
  });
}

function defaultQueryRewriteObservation(): RetrieverQueryRewriteObservationV1 {
  return deepFreezeModelValue({
    schemaVersion: RETRIEVER_QUERY_REWRITE_OBSERVATION_VERSION,
    candidateVersion: RETRIEVER_QUERY_REWRITE_CANDIDATE_VERSION,
    qualityAuthority: 'none' as const,
    provenance: 'not_invoked' as const,
    attempted: false,
    disposition: 'gate_off' as const,
    budget: {
      maxCalls: 1,
      usedCalls: 0,
      maxInputTokens: RETRIEVER_QUERY_REWRITE_MAX_INPUT_TOKENS,
      usedInputTokens: 0,
      maxOutputTokens: RETRIEVER_QUERY_REWRITE_MAX_OUTPUT_TOKENS,
      usedOutputTokens: 0,
    },
    usage: { inputTokens: 0, outputTokens: 0 },
  });
}

function mapPortFailureReason(
  reasonCode: Exclude<(typeof RETRIEVER_SEARCH_PORT_FAILURE_CODES)[number], 'unauthorized'>,
): RetrieverReasonCode {
  if (reasonCode === 'aborted' || reasonCode === 'deadline_exceeded') return reasonCode;
  if (reasonCode === 'schema_invalid') return 'schema_invalid';
  return 'retrieval_failed';
}

function createSearchControl(parent: AbortSignal, remainingMs: number) {
  const controller = new AbortController();
  let settled = false;
  let resolveInterrupted:
    | ((value: { kind: 'interrupted'; reasonCode: 'aborted' | 'deadline_exceeded' }) => void)
    | undefined;
  const interrupted = new Promise<{
    kind: 'interrupted';
    reasonCode: 'aborted' | 'deadline_exceeded';
  }>((resolve) => {
    resolveInterrupted = resolve;
  });
  const settle = (reasonCode: 'aborted' | 'deadline_exceeded') => {
    if (settled) return;
    settled = true;
    controller.abort();
    resolveInterrupted?.({ kind: 'interrupted', reasonCode });
  };
  const onParentAbort = () => settle('aborted');
  parent.addEventListener('abort', onParentAbort, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleDeadline = (delayMs: number) => {
    const timerDelayMs = Math.max(1, Math.min(Math.ceil(delayMs), MAX_TIMER_DELAY_MS));
    timer = setTimeout(() => {
      if (delayMs > MAX_TIMER_DELAY_MS) {
        scheduleDeadline(delayMs - MAX_TIMER_DELAY_MS);
        return;
      }
      settle('deadline_exceeded');
    }, timerDelayMs);
    timer.unref?.();
  };
  scheduleDeadline(remainingMs);
  return {
    signal: controller.signal,
    interrupted,
    cleanup() {
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      parent.removeEventListener('abort', onParentAbort);
    },
  };
}

function readClock(now: (() => number) | undefined): number | null {
  try {
    const value = (now ?? Date.now)();
    return Number.isFinite(value) && value >= 0 ? value : null;
  } catch {
    return null;
  }
}

function boundedLatency(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(MAX_RETRIEVAL_LATENCY_MS, Math.floor(value));
}

function hashReference(value: string): string {
  return 'sha256:' + createHash('sha256').update(value, 'utf8').digest('hex');
}

function shortHash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 32);
}

function normalizedScore(value: number): number {
  return Number(value.toFixed(6));
}

function truncateUtf16(
  value: string,
  maxUtf16CodeUnits: number,
): Readonly<{ value: string; truncated: boolean }> {
  if (value.length <= maxUtf16CodeUnits) {
    return Object.freeze({ value, truncated: false });
  }
  let output = '';
  for (const character of value) {
    if (output.length + character.length > maxUtf16CodeUnits) break;
    output += character;
  }
  return Object.freeze({ value: output.trim(), truncated: true });
}
