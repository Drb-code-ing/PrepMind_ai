import type { AgentContextPolicy } from '@repo/types/api/agent';
import type { ConversationSummaryStatus } from '@repo/types/api/conversation-context';

import type { ChatRequestBudget } from './ai-usage-guard.ts';
import {
  estimateChatContextTokens,
  estimateTextTokens,
  type ActiveStudyContext,
  type ChatContextMessage,
} from './chat-context.ts';

const SYSTEM_MESSAGE_OVERHEAD_TOKENS = 4;
const LAYER_SEPARATOR = '\n\n---\n\n';
const SUMMARY_TOKEN_LIMIT = 400;
const GUIDANCE_MAX_CHARS = 2000;
const OCR_QUESTION_MAX_CHARS = 2400;
const OCR_ANALYSIS_MAX_CHARS = 1000;
const OCR_ANSWER_MAX_CHARS = 600;
const OCR_SHORT_FIELD_MAX_CHARS = 200;
const OCR_KNOWLEDGE_POINT_MAX_CHARS = 200;
const OCR_KNOWLEDGE_POINT_MAX_COUNT = 20;
const RAG_MAX_CHARS = 16000;
const SUMMARY_MAX_CHARS = 4000;

type AssembleChatContextInput = {
  baseSystemPrompt: string;
  agentGuidance?: string;
  stateGuidance?: string;
  activeStudyContext?: ActiveStudyContext | null;
  recentMessages: ChatContextMessage[];
  safeRagContext?: string;
  summaryBuffer?: string | null;
  summaryVersion?: number | null;
  summaryStatus?: ConversationSummaryStatus;
  maxInputTokens: number;
  maxOutputTokens: number;
};

type PromptLayer =
  | 'agentGuidance'
  | 'stateGuidance'
  | 'activeStudy'
  | 'rag'
  | 'summary';

type PreparedLayer = {
  code: PromptLayer;
  text: string;
};

function normalizeBudget(value: number) {
  return Number.isSafeInteger(value) && value > 0 ? value : 0;
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function boundOptionalText(value: string | null | undefined, maxChars: number) {
  if (!value || maxChars <= 0) return null;
  const boundedPrefix = value.slice(0, maxChars + 1).trim();
  if (!boundedPrefix) return null;
  if (value.length <= maxChars && boundedPrefix.length <= maxChars) return boundedPrefix;
  const truncated = boundedPrefix.slice(0, maxChars).trimEnd();
  return truncated ? `${truncated}…` : null;
}

function normalizeMessages(messages: ChatContextMessage[]) {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({ role: message.role, content: message.content.trim() }))
    .filter((message) => message.content.length > 0);
}

function splitConversation(messages: ChatContextMessage[]) {
  let latestUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      latestUserIndex = index;
      break;
    }
  }

  if (latestUserIndex < 0) {
    return { latestUser: null, history: messages, turns: [] as ChatContextMessage[][] };
  }

  const history = messages.slice(0, latestUserIndex);
  const turns: ChatContextMessage[][] = [];
  for (let index = 0; index < history.length - 1; index += 1) {
    const user = history[index];
    const assistant = history[index + 1];
    if (user?.role === 'user' && assistant?.role === 'assistant') {
      turns.push([user, assistant]);
      index += 1;
    }
  }

  return { latestUser: messages[latestUserIndex] ?? null, history, turns };
}

function layerCost(text: string) {
  return estimateTextTokens(`${LAYER_SEPARATOR}${text}`);
}

function fitTextLayer(
  code: PromptLayer,
  label: string,
  content: string,
  tokenCap: number,
): PreparedLayer | null {
  if (tokenCap <= 0) return null;
  const format = (value: string) => `${label}:\n${value}`;
  const full = format(content);
  if (layerCost(full) <= tokenCap) return { code, text: full };

  let low = 1;
  let high = content.length;
  let fitted: string | null = null;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const candidate = format(`${content.slice(0, middle).trimEnd()}…`);
    if (layerCost(candidate) <= tokenCap) {
      fitted = candidate;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return fitted ? { code, text: fitted } : null;
}

function prepareGuidanceLayer(
  code: 'agentGuidance' | 'stateGuidance',
  label: string,
  value: string | null | undefined,
  tokenCap: number,
) {
  const content = boundOptionalText(value, GUIDANCE_MAX_CHARS);
  if (!content) return null;
  return fitTextLayer(code, label, content, tokenCap);
}

function formatActiveStudyContext(context: ActiveStudyContext, includeOptional: boolean) {
  const lines = [`Current OCR question:\n${context.questionText.trim()}`];
  if (!includeOptional) return lines.join('\n');

  const optionalFields: Array<[string, string | null]> = [
    ['Subject', normalizeText(context.subject)],
    ['Question type', normalizeText(context.questionType)],
    ['Difficulty', normalizeText(context.difficulty)],
    ['Analysis', normalizeText(context.analysis)],
    ['Answer', normalizeText(context.answer)],
  ];
  for (const [label, value] of optionalFields) {
    if (value) lines.push(`${label}: ${value}`);
  }
  const knowledgePoints = context.knowledgePoints?.map((point) => point.trim()).filter(Boolean);
  if (knowledgePoints?.length) lines.push(`Knowledge points: ${knowledgePoints.join(', ')}`);
  return lines.join('\n');
}

function prepareActiveStudyLayer(
  context: ActiveStudyContext | null | undefined,
  tokenCap: number,
) {
  const questionText = boundOptionalText(context?.questionText, OCR_QUESTION_MAX_CHARS);
  if (!context || !questionText || tokenCap <= 0) return null;
  const normalizedContext: ActiveStudyContext = {
    type: 'ocr-question',
    questionText,
    subject: boundOptionalText(context.subject, OCR_SHORT_FIELD_MAX_CHARS) ?? undefined,
    questionType:
      boundOptionalText(context.questionType, OCR_SHORT_FIELD_MAX_CHARS) ?? undefined,
    difficulty:
      boundOptionalText(context.difficulty, OCR_SHORT_FIELD_MAX_CHARS) ?? undefined,
    analysis: boundOptionalText(context.analysis, OCR_ANALYSIS_MAX_CHARS) ?? undefined,
    answer: boundOptionalText(context.answer, OCR_ANSWER_MAX_CHARS) ?? undefined,
    knowledgePoints: context.knowledgePoints
      ?.slice(0, OCR_KNOWLEDGE_POINT_MAX_COUNT)
      .map((point) => boundOptionalText(point, OCR_KNOWLEDGE_POINT_MAX_CHARS))
      .filter((point): point is string => point !== null),
  };
  const full = formatActiveStudyContext(normalizedContext, true);
  if (layerCost(full) <= tokenCap) return { code: 'activeStudy' as const, text: full };

  const questionOnly = formatActiveStudyContext(normalizedContext, false);
  if (layerCost(questionOnly) <= tokenCap) {
    return { code: 'activeStudy' as const, text: questionOnly };
  }
  return fitTextLayer('activeStudy', 'Current OCR question', questionText, tokenCap);
}

function appendLayer(systemPrompt: string, layer: PreparedLayer) {
  return `${systemPrompt}${LAYER_SEPARATOR}${layer.text}`;
}

function getLayerTokenDelta(systemPrompt: string, layer: PreparedLayer) {
  return Math.max(
    0,
    estimateTextTokens(appendLayer(systemPrompt, layer)) - estimateTextTokens(systemPrompt),
  );
}

function selectRecentTurns(turns: ChatContextMessage[][], tokenBudget: number) {
  const selected: ChatContextMessage[][] = [];
  let usedTokens = 0;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index] ?? [];
    const turnTokens = estimateChatContextTokens(turn);
    if (usedTokens + turnTokens > tokenBudget) break;
    selected.push(turn);
    usedTokens += turnTokens;
  }
  return { messages: selected.reverse().flat(), usedTokens };
}

function safeSummaryMetadata(input: AssembleChatContextInput) {
  const summaryVersion = input.summaryVersion;
  const hasSafeVersion = Number.isSafeInteger(summaryVersion) && (summaryVersion ?? 0) > 0;
  return {
    ...(hasSafeVersion ? { summaryVersion: summaryVersion as number } : {}),
    ...(input.summaryStatus ? { summaryStatus: input.summaryStatus } : {}),
  };
}

export function assembleChatContext(input: AssembleChatContextInput): ChatRequestBudget {
  const maxInputTokens = normalizeBudget(input.maxInputTokens);
  const maxOutputTokens = normalizeBudget(input.maxOutputTokens);
  const baseSystemPrompt = input.baseSystemPrompt.trim();
  const normalizedMessages = normalizeMessages(input.recentMessages);
  const { latestUser, history, turns } = splitConversation(normalizedMessages);
  const mandatoryMessages = latestUser ? [latestUser] : [];
  const mandatoryTokens =
    estimateTextTokens(baseSystemPrompt) +
    SYSTEM_MESSAGE_OVERHEAD_TOKENS +
    estimateChatContextTokens(mandatoryMessages);
  const normalizedMessageCount = normalizedMessages.length;
  const agentGuidanceSource = Boolean(
    boundOptionalText(input.agentGuidance, GUIDANCE_MAX_CHARS),
  );
  const stateGuidanceSource = Boolean(
    boundOptionalText(input.stateGuidance, GUIDANCE_MAX_CHARS),
  );
  const activeStudySource = Boolean(
    boundOptionalText(input.activeStudyContext?.questionText, OCR_QUESTION_MAX_CHARS),
  );
  const ragSource = Boolean(boundOptionalText(input.safeRagContext, RAG_MAX_CHARS));
  const summarySource = Boolean(boundOptionalText(input.summaryBuffer, SUMMARY_MAX_CHARS));

  const failClosed = maxInputTokens === 0 || mandatoryTokens > maxInputTokens;
  if (failClosed) {
    const droppedLayers: PromptLayer[] = [];
    if (agentGuidanceSource) droppedLayers.push('agentGuidance');
    if (stateGuidanceSource) droppedLayers.push('stateGuidance');
    if (activeStudySource) droppedLayers.push('activeStudy');
    if (ragSource) droppedLayers.push('rag');
    if (summarySource && history.length > 0) droppedLayers.push('summary');
    const contextPolicy: AgentContextPolicy = {
      recentMessageCount: mandatoryMessages.length,
      droppedMessageCount: Math.max(0, normalizedMessageCount - mandatoryMessages.length),
      summaryIncluded: false,
      estimatedTokenCount: mandatoryTokens,
      layerTokenCounts: {
        mandatory: mandatoryTokens,
        agentGuidance: 0,
        stateGuidance: 0,
        activeStudy: 0,
        recentMessages: 0,
        rag: 0,
        summary: 0,
      },
      ...(droppedLayers.length > 0 ? { droppedLayers } : {}),
      ...safeSummaryMetadata(input),
    };
    return {
      systemPrompt: baseSystemPrompt,
      modelMessages: mandatoryMessages,
      estimatedInputTokens: mandatoryTokens,
      maxInputTokens,
      maxOutputTokens,
      exceedsInputLimit: true,
      contextPolicy,
    };
  }

  const guidanceCap = Math.floor(maxInputTokens * 0.1);
  const guidanceBaseCap = Math.floor(maxInputTokens * 0.05);
  const agentGuidanceCap = stateGuidanceSource ? guidanceBaseCap : guidanceCap;
  const stateGuidanceCap = agentGuidanceSource ? guidanceBaseCap : guidanceCap;
  const activeStudyCap = Math.floor(maxInputTokens * 0.2);
  const recentCap = Math.floor(maxInputTokens * 0.4);
  const ragCap = Math.floor(maxInputTokens * 0.25);
  const summaryCap = Math.min(Math.floor(maxInputTokens * 0.15), SUMMARY_TOKEN_LIMIT);
  let systemPrompt = baseSystemPrompt;
  let guidanceLayer = prepareGuidanceLayer(
    'agentGuidance',
    'Agent guidance',
    input.agentGuidance,
    agentGuidanceCap,
  );
  let guidanceTokens = guidanceLayer ? getLayerTokenDelta(systemPrompt, guidanceLayer) : 0;
  if (
    guidanceLayer &&
    guidanceTokens <= agentGuidanceCap &&
    mandatoryTokens + guidanceTokens <= maxInputTokens
  ) {
    systemPrompt = appendLayer(systemPrompt, guidanceLayer);
  } else {
    guidanceLayer = null;
    guidanceTokens = 0;
  }

  const highTokensBeforeState =
    estimateTextTokens(systemPrompt) - estimateTextTokens(baseSystemPrompt);
  const stateRemaining = Math.max(
    0,
    maxInputTokens - mandatoryTokens - highTokensBeforeState,
  );
  let stateGuidanceLayer = prepareGuidanceLayer(
    'stateGuidance',
    'Conversation state guidance',
    input.stateGuidance,
    Math.min(stateGuidanceCap, stateRemaining),
  );
  let stateGuidanceTokens = stateGuidanceLayer
    ? getLayerTokenDelta(systemPrompt, stateGuidanceLayer)
    : 0;
  if (
    stateGuidanceLayer &&
    stateGuidanceTokens <= stateGuidanceCap &&
    guidanceTokens + stateGuidanceTokens <= guidanceCap &&
    mandatoryTokens + highTokensBeforeState + stateGuidanceTokens <= maxInputTokens
  ) {
    systemPrompt = appendLayer(systemPrompt, stateGuidanceLayer);
  } else {
    stateGuidanceLayer = null;
    stateGuidanceTokens = 0;
  }

  const highTokensBeforeActive =
    estimateTextTokens(systemPrompt) - estimateTextTokens(baseSystemPrompt);
  const activeStudyRemaining = Math.max(
    0,
    maxInputTokens - mandatoryTokens - highTokensBeforeActive,
  );
  let activeStudyLayer = prepareActiveStudyLayer(
    input.activeStudyContext,
    Math.min(activeStudyCap, activeStudyRemaining),
  );
  let activeStudyTokens = activeStudyLayer
    ? getLayerTokenDelta(systemPrompt, activeStudyLayer)
    : 0;
  if (
    activeStudyLayer &&
    activeStudyTokens <= activeStudyCap &&
    mandatoryTokens + highTokensBeforeActive + activeStudyTokens <= maxInputTokens
  ) {
    systemPrompt = appendLayer(systemPrompt, activeStudyLayer);
  } else {
    activeStudyLayer = null;
    activeStudyTokens = 0;
  }
  const highLayerTokens =
    estimateTextTokens(systemPrompt) - estimateTextTokens(baseSystemPrompt);
  const ragText = boundOptionalText(input.safeRagContext, RAG_MAX_CHARS);
  const fullRagLayer = ragText
    ? ({ code: 'rag', text: `Safe RAG context:\n${ragText}` } as const)
    : null;
  const ragLayer = fullRagLayer && layerCost(fullRagLayer.text) <= ragCap ? fullRagLayer : null;
  const summaryText = boundOptionalText(input.summaryBuffer, SUMMARY_MAX_CHARS);
  const summaryLayer = summaryText
    ? fitTextLayer('summary', 'Conversation summary', summaryText, summaryCap)
    : null;
  const ragReservation = ragLayer ? layerCost(ragLayer.text) : 0;
  const summaryReservation = history.length > 0 && summaryLayer ? layerCost(summaryLayer.text) : 0;
  const unusedHighLanes =
    Math.max(0, guidanceCap - guidanceTokens - stateGuidanceTokens) +
    Math.max(0, activeStudyCap - activeStudyTokens);
  const unusedLowerLanes =
    Math.max(0, ragCap - ragReservation) +
    Math.max(0, summaryCap - summaryReservation);
  const remainingAfterHigh = Math.max(0, maxInputTokens - mandatoryTokens - highLayerTokens);
  const recentBudget = Math.min(
    remainingAfterHigh,
    recentCap + unusedHighLanes + unusedLowerLanes,
  );
  const recent = selectRecentTurns(turns, recentBudget);
  let selectedHistory = recent.messages;
  let modelMessages = [...selectedHistory, ...mandatoryMessages];
  let droppedMessageCount = Math.max(0, normalizedMessageCount - modelMessages.length);

  let ragIncluded = false;
  let summaryIncluded = false;
  if (ragLayer) {
    const candidate = appendLayer(systemPrompt, ragLayer);
    const candidateLayerTokens = getLayerTokenDelta(systemPrompt, ragLayer);
    const candidateTokens =
      estimateTextTokens(candidate) +
      SYSTEM_MESSAGE_OVERHEAD_TOKENS +
      estimateChatContextTokens(modelMessages);
    if (candidateLayerTokens <= ragCap && candidateTokens <= maxInputTokens) {
      systemPrompt = candidate;
      ragIncluded = true;
    }
  }
  if (droppedMessageCount > 0 && summaryLayer) {
    const candidate = appendLayer(systemPrompt, summaryLayer);
    const candidateLayerTokens = getLayerTokenDelta(systemPrompt, summaryLayer);
    const candidateTokens =
      estimateTextTokens(candidate) +
      SYSTEM_MESSAGE_OVERHEAD_TOKENS +
      estimateChatContextTokens(modelMessages);
    if (candidateLayerTokens <= summaryCap && candidateTokens <= maxInputTokens) {
      systemPrompt = candidate;
      summaryIncluded = true;
    }
  }

  let estimatedInputTokens =
    estimateTextTokens(systemPrompt) +
    SYSTEM_MESSAGE_OVERHEAD_TOKENS +
    estimateChatContextTokens(modelMessages);
  if (estimatedInputTokens < maxInputTokens && selectedHistory.length < turns.length * 2) {
    const expanded = selectRecentTurns(
      turns,
      recent.usedTokens + (maxInputTokens - estimatedInputTokens),
    );
    selectedHistory = expanded.messages;
    modelMessages = [...selectedHistory, ...mandatoryMessages];
    droppedMessageCount = Math.max(0, normalizedMessageCount - modelMessages.length);
    estimatedInputTokens =
      estimateTextTokens(systemPrompt) +
      SYSTEM_MESSAGE_OVERHEAD_TOKENS +
      estimateChatContextTokens(modelMessages);
  }

  const promptWithoutSummary = summaryIncluded
    ? systemPrompt.slice(0, systemPrompt.lastIndexOf(LAYER_SEPARATOR))
    : systemPrompt;
  const promptWithoutRag = ragIncluded
    ? promptWithoutSummary.slice(0, promptWithoutSummary.lastIndexOf(LAYER_SEPARATOR))
    : promptWithoutSummary;
  const ragTokens = ragIncluded
    ? Math.max(0, estimateTextTokens(promptWithoutSummary) - estimateTextTokens(promptWithoutRag))
    : 0;
  const summaryTokens = summaryIncluded
    ? Math.max(0, estimateTextTokens(systemPrompt) - estimateTextTokens(promptWithoutSummary))
    : 0;
  const recentTokens = estimateChatContextTokens(selectedHistory);
  const droppedLayers: PromptLayer[] = [];
  if (agentGuidanceSource && !guidanceLayer) droppedLayers.push('agentGuidance');
  if (stateGuidanceSource && !stateGuidanceLayer) droppedLayers.push('stateGuidance');
  if (activeStudySource && !activeStudyLayer) droppedLayers.push('activeStudy');
  if (ragSource && !ragIncluded) droppedLayers.push('rag');
  if (summarySource && droppedMessageCount > 0 && !summaryIncluded) droppedLayers.push('summary');

  const contextPolicy: AgentContextPolicy = {
    recentMessageCount: modelMessages.length,
    droppedMessageCount,
    summaryIncluded,
    estimatedTokenCount: estimatedInputTokens,
    layerTokenCounts: {
      mandatory: mandatoryTokens,
      agentGuidance: guidanceTokens,
      stateGuidance: stateGuidanceTokens,
      activeStudy: activeStudyTokens,
      recentMessages: recentTokens,
      rag: ragTokens,
      summary: summaryTokens,
    },
    ...(droppedLayers.length > 0 ? { droppedLayers } : {}),
    ...safeSummaryMetadata(input),
  };

  return {
    systemPrompt,
    modelMessages,
    estimatedInputTokens,
    maxInputTokens,
    maxOutputTokens,
    exceedsInputLimit: estimatedInputTokens > maxInputTokens,
    contextPolicy,
  };
}
