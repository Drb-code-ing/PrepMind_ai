import type { KnowledgeVerifierResult } from '@repo/agent/knowledge-verifier';
import {
  MODEL_CANDIDATE_DISPOSITIONS,
  type ModelCandidateDisposition,
} from '@repo/agent/model-candidates';
import {
  MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES,
  type ModelAgentErrorCode,
  type ModelAgentProviderFailureCategory,
} from '@repo/ai';
import type { AgentContextPolicy, AgentRoute } from '@repo/types/api/agent';
import {
  agentTraceCreateRequestSchema,
  type AgentTraceCreateRequest,
  type AgentTraceMode,
  type AgentTraceStatus,
  type AgentTraceVerifierStatus,
  type CreateAgentTraceStepRequest,
} from '@repo/types/api/agent-trace';

import { estimateAiCost } from './ai-cost-estimator.ts';
import type { SafeChatModelAgentObservation } from './chat-model-agent-observation.ts';

type TraceMessage = {
  role: string;
  content: string;
};

type TraceBudget = {
  estimatedInputTokens: number;
  maxOutputTokens: number;
  contextPolicy?: AgentContextPolicy;
};

type TraceTutorStrategy = {
  intent: string;
  depth: string;
};

type TraceAgentDecision = {
  route: AgentRoute;
  confidence: number;
  reason: string;
  requiresRag: boolean;
  requiresHumanApproval: boolean;
  degraded?: boolean;
  tutorStrategy?: TraceTutorStrategy;
};

type TraceKnowledgeHit = {
  documentId: string;
  chunkId: string;
  content?: string;
  score?: number;
  documentName?: string;
  title?: string;
};

export type SafeTraceModelAgentObservation = SafeChatModelAgentObservation & {
  usageUnavailable?: boolean;
};

export type BuildChatAgentTracePayloadInput = {
  runId: string;
  conversationId?: string | null;
  messages: TraceMessage[];
  mode: AgentTraceMode;
  modelProvider: string;
  modelName: string;
  budget: TraceBudget;
  agentDecision: TraceAgentDecision;
  knowledgeHits?: TraceKnowledgeHit[];
  knowledgeVerifierResult?: KnowledgeVerifierResult;
  modelAgentObservations?: {
    router?: SafeTraceModelAgentObservation;
    verifier?: SafeTraceModelAgentObservation;
  };
  startedAt: Date;
  finishedAt: Date;
};

const INPUT_PREVIEW_MAX = 80;
const SUMMARY_MAX = 160;
const ERROR_MAX = 240;
const MAX_SAFE_COUNT = Number.MAX_SAFE_INTEGER;

const MODEL_AGENT_ERROR_CODES = Object.freeze([
  'INVALID_REQUEST',
  'INVALID_RUNTIME_CONFIG',
  'LIVE_CALLS_DISABLED',
  'EXECUTOR_UNAVAILABLE',
  'CALL_BUDGET_EXCEEDED',
  'INPUT_BUDGET_EXCEEDED',
  'OUTPUT_BUDGET_EXCEEDED',
  'SCHEMA_INVALID',
  'TIMEOUT',
  'ABORTED',
  'PROVIDER_ERROR',
] as const satisfies readonly ModelAgentErrorCode[]);

const SENSITIVE_PATTERNS: Array<[RegExp, string]> = [
  [/DEEPSEEK_API_KEY\s*=\s*[^\s;,)]+/gi, 'DEEPSEEK_API_KEY=[redacted]'],
  [/OPENAI_API_KEY\s*=\s*[^\s;,)]+/gi, 'OPENAI_API_KEY=[redacted]'],
  [/Authorization\s*:\s*Bearer\s+[^\s,;)]+/gi, 'Authorization: Bearer [redacted]'],
  [/Cookie\s*:\s*[^\r\n]+/gi, 'Cookie: [redacted]'],
];

export function createInputPreview(text: string): string {
  return truncateText(redactSensitiveText(text).trim(), INPUT_PREVIEW_MAX);
}

export function createInputHash(text: string): string {
  let hash = 0x811c9dc5;

  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function buildChatAgentTracePayload(
  input: BuildChatAgentTracePayloadInput,
): AgentTraceCreateRequest {
  const latestUserText = getLatestUserText(input.messages);
  const inputPreview = createInputPreview(latestUserText);
  const verifierStatus = toVerifierStatus(input.knowledgeVerifierResult?.status);
  const degraded =
    Boolean(input.agentDecision.degraded) || isVerifierDegraded(verifierStatus);
  const status: AgentTraceStatus = degraded ? 'degraded' : 'completed';
  const routerModelObservation = normalizeModelAgentObservation(
    input.modelAgentObservations?.router,
  );
  const verifierModelObservation = normalizeModelAgentObservation(
    input.modelAgentObservations?.verifier,
  );
  const inputTokenEstimate = saturatingSum([
    input.budget.estimatedInputTokens,
    routerModelObservation?.inputTokens ?? 0,
    verifierModelObservation?.inputTokens ?? 0,
  ]);
  const outputTokenEstimate = saturatingSum([
    input.budget.maxOutputTokens,
    routerModelObservation?.outputTokens ?? 0,
    verifierModelObservation?.outputTokens ?? 0,
  ]);
  const cost = estimateAiCost({
    model: input.modelName,
    inputTokens: inputTokenEstimate,
    outputTokens: outputTokenEstimate,
  });
  const startedAt = input.startedAt.toISOString();
  const finishedAt = input.finishedAt.toISOString();
  const totalDurationMs = Math.max(
    0,
    input.finishedAt.getTime() - input.startedAt.getTime(),
  );
  const steps = buildTraceSteps({
    startedAt,
    finishedAt,
    inputPreview,
    status,
    input,
    verifierStatus,
    routerModelObservation,
    verifierModelObservation,
  });

  return agentTraceCreateRequestSchema.parse({
    runId: input.runId,
    conversationId: input.conversationId ?? null,
    route: input.agentDecision.route,
    confidence: clampProbability(input.agentDecision.confidence),
    status,
    mode: input.mode,
    modelProvider: input.modelProvider,
    modelName: input.modelName,
    inputTokenEstimate,
    outputTokenEstimate,
    maxOutputTokens: normalizeCount(input.budget.maxOutputTokens),
    pricingKnown: cost.pricingKnown,
    costEstimate: cost.totalCostEstimate,
    ragHitCount: input.knowledgeHits?.length ?? 0,
    verifierStatus,
    verifierChunkCount: input.knowledgeVerifierResult?.debug.checkedChunkCount ?? 0,
    tutorIntent: input.agentDecision.tutorStrategy?.intent,
    tutorDepth: input.agentDecision.tutorStrategy?.depth,
    degraded,
    inputHash: createInputHash(latestUserText),
    inputPreview,
    startedAt,
    finishedAt,
    totalDurationMs,
    steps,
  });
}

function buildTraceSteps(input: {
  startedAt: string;
  finishedAt: string;
  inputPreview: string;
  status: AgentTraceStatus;
  input: BuildChatAgentTracePayloadInput;
  verifierStatus: AgentTraceVerifierStatus;
  routerModelObservation?: NormalizedModelAgentObservation;
  verifierModelObservation?: NormalizedModelAgentObservation;
}): CreateAgentTraceStepRequest[] {
  const steps: CreateAgentTraceStepRequest[] = [
    createStep({
      node: 'RouterAgent',
      status: input.input.agentDecision.degraded ? 'degraded' : 'completed',
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      inputSummary: formatTraceInputSummary(
        input.inputPreview,
        input.input.budget.contextPolicy,
      ),
      outputSummary: [
        `route=${input.input.agentDecision.route}`,
        `confidence=${clampProbability(input.input.agentDecision.confidence).toFixed(2)}`,
        `requiresRag=${input.input.agentDecision.requiresRag}`,
      ].join(' '),
    }),
  ];

  if (input.routerModelObservation) {
    steps.push(
      createModelCandidateStep({
        node: 'RouterModelCandidate',
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        observation: input.routerModelObservation,
      }),
    );
  }

  if (input.input.agentDecision.tutorStrategy) {
    steps.push(
      createStep({
        node: 'TutorAgent',
        status: input.input.agentDecision.degraded ? 'degraded' : 'completed',
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        inputSummary: formatTraceInputSummary(
          input.inputPreview,
          input.input.budget.contextPolicy,
        ),
        outputSummary: [
          `intent=${input.input.agentDecision.tutorStrategy.intent}`,
          `depth=${input.input.agentDecision.tutorStrategy.depth}`,
        ].join(' '),
      }),
    );
  }

  if (input.input.knowledgeVerifierResult) {
    steps.push(
      createStep({
        node: 'KnowledgeVerifierAgent',
        status: isVerifierDegraded(input.verifierStatus) ? 'degraded' : 'completed',
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        inputSummary: `hits=${input.input.knowledgeHits?.length ?? 0}`,
        outputSummary: [
          `status=${input.verifierStatus}`,
          `checked=${input.input.knowledgeVerifierResult.debug.checkedChunkCount}`,
        ].join(' '),
      }),
    );
  }

  if (input.verifierModelObservation) {
    steps.push(
      createModelCandidateStep({
        node: 'KnowledgeVerifierModelCandidate',
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        observation: input.verifierModelObservation,
      }),
    );
  }

  return steps;
}

type NormalizedModelAgentObservation = SafeChatModelAgentObservation & {
  usageUnavailable: boolean;
};

function createModelCandidateStep(input: {
  node: 'RouterModelCandidate' | 'KnowledgeVerifierModelCandidate';
  startedAt: string;
  finishedAt: string;
  observation: NormalizedModelAgentObservation;
}): CreateAgentTraceStepRequest {
  return createStep({
    node: input.node,
    status: 'completed',
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.observation.durationMs,
    inputSummary: 'safeObservation=true',
    outputSummary: formatModelAgentObservation(input.observation),
  });
}

function normalizeModelAgentObservation(
  value?: SafeTraceModelAgentObservation,
): NormalizedModelAgentObservation | undefined {
  if (value === undefined) return undefined;

  const inputTokens = normalizeCount(value.inputTokens);
  const outputTokens = normalizeCount(value.outputTokens);
  const usageUnavailable =
    value.usageUnavailable === true ||
    !isSafeCount(value.inputTokens) ||
    !isSafeCount(value.outputTokens);
  const errorCode = normalizeModelAgentErrorCode(value.errorCode);
  const providerFailureCategory = normalizeProviderFailureCategory(
    value.providerFailureCategory,
  );

  return {
    attempted: value.attempted === true,
    disposition: normalizeModelCandidateDisposition(value.disposition),
    durationMs: normalizeCount(value.durationMs),
    inputTokens,
    outputTokens,
    usageUnavailable,
    ...(errorCode ? { errorCode } : {}),
    ...(providerFailureCategory ? { providerFailureCategory } : {}),
  };
}

function formatModelAgentObservation(
  observation: NormalizedModelAgentObservation,
): string {
  const required = [
    `attempted=${observation.attempted}`,
    `disposition=${observation.disposition}`,
    `durationMs=${observation.durationMs}`,
    `inputTokens=${observation.inputTokens}`,
    `outputTokens=${observation.outputTokens}`,
  ].join(' ');
  const usageMarker = observation.usageUnavailable
    ? 'usageUnavailable=true'
    : undefined;
  const optional = [
    observation.errorCode ? `error=${observation.errorCode}` : undefined,
    observation.providerFailureCategory
      ? `provider=${observation.providerFailureCategory}`
      : undefined,
  ];
  const parts = [required];

  for (const candidate of optional) {
    if (!candidate) continue;
    const withCandidate = [...parts, candidate, usageMarker]
      .filter((part): part is string => part !== undefined)
      .join(' ');
    if (Array.from(withCandidate).length <= SUMMARY_MAX) parts.push(candidate);
  }
  if (usageMarker) parts.push(usageMarker);

  return parts.join(' ');
}

function formatTraceInputSummary(inputPreview: string, contextPolicy?: AgentContextPolicy) {
  const preview = `latestUserPreview=${inputPreview}`;
  if (!contextPolicy) return preview;

  const layers = contextPolicy.layerTokenCounts;
  const layerSummary = layers
    ? `layerTokens=m:${layers.mandatory},a:${layers.agentGuidance},s:${layers.stateGuidance},o:${layers.activeStudy},r:${layers.recentMessages},k:${layers.rag},y:${layers.summary}`
    : null;

  return [
    `recentMessages=${contextPolicy.recentMessageCount}`,
    `summary=${contextPolicy.summaryIncluded}`,
    `droppedMessages=${contextPolicy.droppedMessageCount}`,
    layerSummary,
    preview,
  ]
    .filter((value): value is string => value !== null)
    .join(' ');
}

function createStep(input: {
  node: string;
  status: AgentTraceStatus;
  startedAt: string;
  finishedAt: string;
  inputSummary: string;
  outputSummary: string;
  errorMessage?: string | null;
  durationMs?: number;
}): CreateAgentTraceStepRequest {
  return {
    node: input.node,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: input.durationMs ?? 0,
    inputSummary: sanitizeSummary(input.inputSummary, SUMMARY_MAX),
    outputSummary: sanitizeSummary(input.outputSummary, SUMMARY_MAX),
    errorMessage:
      input.errorMessage === undefined || input.errorMessage === null
        ? null
        : sanitizeSummary(input.errorMessage, ERROR_MAX),
  };
}

function getLatestUserText(messages: TraceMessage[]) {
  return (
    [...messages]
      .reverse()
      .find((message) => message.role === 'user')
      ?.content.trim() ?? ''
  );
}

function toVerifierStatus(status?: string): AgentTraceVerifierStatus {
  if (
    status === 'trusted' ||
    status === 'suspicious' ||
    status === 'conflict' ||
    status === 'insufficient' ||
    status === 'skipped'
  ) {
    return status;
  }

  return 'skipped';
}

function isVerifierDegraded(status: AgentTraceVerifierStatus) {
  return status === 'suspicious' || status === 'conflict' || status === 'insufficient';
}

function sanitizeSummary(text: string, maxChars: number) {
  const redacted = redactSensitiveText(text);
  return truncateText(redacted.replace(/\s+/g, ' ').trim(), maxChars);
}

function redactSensitiveText(text: string) {
  return SENSITIVE_PATTERNS.reduce(
    (value, [pattern, replacement]) => value.replace(pattern, replacement),
    text,
  );
}

function truncateText(text: string, maxChars: number) {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  return chars.slice(0, maxChars).join('');
}

function normalizeCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_SAFE_COUNT, Math.max(0, Math.trunc(value)));
}

function isSafeCount(value: number) {
  return Number.isSafeInteger(value) && value >= 0;
}

function saturatingSum(values: readonly number[]) {
  let total = 0;
  for (const value of values) {
    const normalized = normalizeCount(value);
    if (total >= MAX_SAFE_COUNT - normalized) return MAX_SAFE_COUNT;
    total += normalized;
  }
  return total;
}

function normalizeModelCandidateDisposition(
  value: ModelCandidateDisposition,
): ModelCandidateDisposition {
  return (MODEL_CANDIDATE_DISPOSITIONS as readonly unknown[]).includes(value)
    ? value
    : 'fallback_invalid_input';
}

function normalizeModelAgentErrorCode(
  value: SafeTraceModelAgentObservation['errorCode'],
): SafeChatModelAgentObservation['errorCode'] {
  if (value === undefined) return undefined;
  return (MODEL_AGENT_ERROR_CODES as readonly unknown[]).includes(value)
    ? value
    : 'UNKNOWN';
}

function normalizeProviderFailureCategory(
  value: SafeTraceModelAgentObservation['providerFailureCategory'],
): ModelAgentProviderFailureCategory | undefined {
  if (value === undefined) return undefined;
  return (MODEL_AGENT_PROVIDER_FAILURE_CATEGORIES as readonly unknown[]).includes(
    value,
  )
    ? value
    : 'unknown';
}

function clampProbability(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
