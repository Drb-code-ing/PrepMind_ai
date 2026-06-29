export const CHAT_CONTEXT_MAX_INPUT_TOKENS = 2500;
const MESSAGE_OVERHEAD_TOKENS = 4;
const ACTIVE_CONTEXT_MAX_QUESTION_CHARS = 2400;
const ACTIVE_CONTEXT_MAX_ANALYSIS_CHARS = 1000;
const ACTIVE_CONTEXT_MAX_ANSWER_CHARS = 600;

export type ChatContextMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type ActiveStudyContext = {
  type: 'ocr-question';
  sourceGroupId?: string;
  questionId?: string;
  questionText: string;
  subject?: string;
  questionType?: string;
  difficulty?: string;
  knowledgePoints?: string[];
  analysis?: string;
  answer?: string;
  rawContent?: string;
  warnings?: string[];
  updatedAt?: number;
};

type BuildChatContextOptions = {
  maxInputTokens?: number;
};

export type ActiveStudyContextLimits = {
  questionChars?: number;
  analysisChars?: number;
  answerChars?: number;
};

type BuildChatSystemPromptOptions = {
  activeContextLimits?: ActiveStudyContextLimits;
  summaryBuffer?: string;
};

export function estimateTextTokens(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;

  const cjkChars = normalized.match(/[\p{Script=Han}，。！？；：“”‘’（）《》、]/gu)?.length ?? 0;
  const nonCjkChars = normalized.replace(/[\p{Script=Han}，。！？；：“”‘’（）《》、\s]/gu, '').length;

  return cjkChars + Math.ceil(nonCjkChars / 4);
}

function estimateMessageTokens(message: ChatContextMessage) {
  return MESSAGE_OVERHEAD_TOKENS + estimateTextTokens(message.content);
}

export function estimateChatContextTokens(messages: ChatContextMessage[]) {
  return messages.reduce((total, message) => total + estimateMessageTokens(message), 0);
}

function normalizeMessages(messages: ChatContextMessage[]) {
  return messages
    .filter((message) => ['user', 'assistant', 'system'].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0);
}

export function buildChatContextMessages(
  messages: ChatContextMessage[],
  options: BuildChatContextOptions = {},
) {
  const maxInputTokens = options.maxInputTokens ?? CHAT_CONTEXT_MAX_INPUT_TOKENS;
  const normalizedMessages = normalizeMessages(messages);
  if (normalizedMessages.length === 0) return [];

  const selected: ChatContextMessage[] = [];
  let usedTokens = 0;
  const latestIndex = normalizedMessages.length - 1;

  for (let index = latestIndex; index >= 0; index -= 1) {
    const message = normalizedMessages[index];
    const messageTokens = estimateMessageTokens(message);
    const isLatestMessage = index === latestIndex;

    if (!isLatestMessage && usedTokens + messageTokens > maxInputTokens) {
      break;
    }

    selected.push(message);
    usedTokens += messageTokens;
  }

  return selected.reverse();
}

function clampText(text: string, maxChars: number) {
  const normalized = text.trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars).trim()}...`;
}

function formatActiveStudyContext(
  activeContext: ActiveStudyContext,
  limits: ActiveStudyContextLimits = {},
) {
  const questionChars = limits.questionChars ?? ACTIVE_CONTEXT_MAX_QUESTION_CHARS;
  const analysisChars = limits.analysisChars ?? ACTIVE_CONTEXT_MAX_ANALYSIS_CHARS;
  const answerChars = limits.answerChars ?? ACTIVE_CONTEXT_MAX_ANSWER_CHARS;

  const lines = [
    '当前正在讨论的题目来自用户刚才的拍照识题结果。用户后续提到“这道题”“刚才那一步”“为什么这样做”时，优先指向下面这道题。',
    '',
    `题目：${clampText(activeContext.questionText, questionChars)}`,
  ];

  if (activeContext.questionId?.trim()) {
    lines.push(`题目ID：${activeContext.questionId.trim()}`);
  }

  if (activeContext.subject?.trim()) {
    lines.push(`学科：${activeContext.subject.trim()}`);
  }

  if (activeContext.questionType?.trim()) {
    lines.push(`题型：${activeContext.questionType.trim()}`);
  }

  if (activeContext.difficulty?.trim()) {
    lines.push(`难度：${activeContext.difficulty.trim()}`);
  }

  if (activeContext.knowledgePoints?.length) {
    lines.push(`知识点：${activeContext.knowledgePoints.map((point) => point.trim()).filter(Boolean).join('、')}`);
  }

  if (activeContext.analysis?.trim()) {
    lines.push(`已有分析：${clampText(activeContext.analysis, analysisChars)}`);
  }

  if (activeContext.answer?.trim()) {
    lines.push(`参考答案：${clampText(activeContext.answer, answerChars)}`);
  }

  const warnings = activeContext.warnings?.map((warning) => warning.trim()).filter(Boolean);
  if (warnings?.length) {
    lines.push(`识别提醒：${warnings.join('、')}`);
  }

  return lines.join('\n');
}

export function buildChatSystemPrompt(
  basePrompt: string,
  activeContext?: ActiveStudyContext | null,
  options: BuildChatSystemPromptOptions = {},
) {
  const normalizedBasePrompt = basePrompt.trim();
  const sections = [normalizedBasePrompt];

  if (options.summaryBuffer?.trim()) {
    sections.push(formatSummaryBuffer(options.summaryBuffer));
  }

  if (!activeContext?.questionText.trim()) return sections.join('\n\n---\n\n');

  sections.push(formatActiveStudyContext(activeContext, options.activeContextLimits));

  return sections.join('\n\n---\n\n');
}

function formatSummaryBuffer(summaryBuffer: string) {
  return `旧对话摘要：\n${clampText(summaryBuffer, 1200)}`;
}
