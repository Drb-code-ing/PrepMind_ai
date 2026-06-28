import type { KnowledgeVerifierResult } from '@repo/agent/knowledge-verifier';
import type { AgentRoute } from '@repo/types/api/agent';
import {
  agentTraceCreateRequestSchema,
  type AgentTraceCreateRequest,
  type AgentTraceMode,
  type AgentTraceStatus,
  type AgentTraceVerifierStatus,
  type CreateAgentTraceStepRequest,
} from '@repo/types/api/agent-trace';

import { estimateAiCost } from './ai-cost-estimator.ts';

type TraceMessage = {
  role: string;
  content: string;
};

type TraceBudget = {
  estimatedInputTokens: number;
  maxOutputTokens: number;
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
  startedAt: Date;
  finishedAt: Date;
};

const INPUT_PREVIEW_MAX = 80;
const SUMMARY_MAX = 160;
const ERROR_MAX = 240;

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
  const cost = estimateAiCost({
    model: input.modelName,
    inputTokens: input.budget.estimatedInputTokens,
    outputTokens: input.budget.maxOutputTokens,
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
    inputTokenEstimate: normalizeCount(input.budget.estimatedInputTokens),
    outputTokenEstimate: normalizeCount(input.budget.maxOutputTokens),
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
}): CreateAgentTraceStepRequest[] {
  const steps: CreateAgentTraceStepRequest[] = [
    createStep({
      node: 'RouterAgent',
      status: input.input.agentDecision.degraded ? 'degraded' : 'completed',
      startedAt: input.startedAt,
      finishedAt: input.finishedAt,
      inputSummary: `latestUserPreview=${input.inputPreview}`,
      outputSummary: [
        `route=${input.input.agentDecision.route}`,
        `confidence=${clampProbability(input.input.agentDecision.confidence).toFixed(2)}`,
        `requiresRag=${input.input.agentDecision.requiresRag}`,
      ].join(' '),
    }),
  ];

  if (input.input.agentDecision.tutorStrategy) {
    steps.push(
      createStep({
        node: 'TutorAgent',
        status: input.input.agentDecision.degraded ? 'degraded' : 'completed',
        startedAt: input.startedAt,
        finishedAt: input.finishedAt,
        inputSummary: `latestUserPreview=${input.inputPreview}`,
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

  return steps;
}

function createStep(input: {
  node: string;
  status: AgentTraceStatus;
  startedAt: string;
  finishedAt: string;
  inputSummary: string;
  outputSummary: string;
  errorMessage?: string | null;
}): CreateAgentTraceStepRequest {
  return {
    node: input.node,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: 0,
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
  return Math.max(0, Math.trunc(value));
}

function clampProbability(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
