import {
  buildChatContextMessages,
  buildChatSystemPrompt,
  estimateChatContextTokens,
  estimateTextTokens,
  type ActiveStudyContext,
  type ActiveStudyContextLimits,
  type ChatContextMessage,
} from './chat-context.ts';

export const DEFAULT_AI_MAX_INPUT_TOKENS = 2500;
export const DEFAULT_AI_MAX_OUTPUT_TOKENS = 1200;
export const MOCK_AI_MODEL = 'mock-prepmind-chat';
export const MOCK_AI_BASE_URL = 'local-mock';

type TokenLimitBounds = {
  min: number;
  max: number;
};

export type ChatRequestBudget = {
  systemPrompt: string;
  modelMessages: ChatContextMessage[];
  estimatedInputTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  exceedsInputLimit: boolean;
};

type BuildChatRequestBudgetInput = {
  baseSystemPrompt: string;
  activeContext?: ActiveStudyContext | null;
  messages: ChatContextMessage[];
  maxInputTokens: number;
  maxOutputTokens: number;
  activeContextLimits?: ActiveStudyContextLimits;
};

export function parseAiTokenLimit(
  value: unknown,
  fallback: number,
  bounds: TokenLimitBounds,
) {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  if (parsed < bounds.min || parsed > bounds.max) return fallback;
  return parsed;
}

export function buildChatRequestBudget(input: BuildChatRequestBudgetInput): ChatRequestBudget {
  const systemPrompt = buildChatSystemPrompt(input.baseSystemPrompt, input.activeContext, {
    activeContextLimits: input.activeContextLimits,
  });
  const systemTokens = estimateTextTokens(systemPrompt) + 4;
  const messageBudget = Math.max(1, input.maxInputTokens - systemTokens);
  const modelMessages = buildChatContextMessages(input.messages, {
    maxInputTokens: messageBudget,
  });
  const estimatedInputTokens = systemTokens + estimateChatContextTokens(modelMessages);

  return {
    systemPrompt,
    modelMessages,
    estimatedInputTokens,
    maxInputTokens: input.maxInputTokens,
    maxOutputTokens: input.maxOutputTokens,
    exceedsInputLimit: estimatedInputTokens > input.maxInputTokens,
  };
}

export function createMockChatText(input: {
  hasActiveContext: boolean;
  latestUserText?: string;
}) {
  const latestUserText = input.latestUserText?.trim();
  const visibleQuestion = latestUserText
    ? `你刚才的问题是：“${latestUserText.slice(0, 80)}”。`
    : '我已经收到你的问题。';
  const contextLine = input.hasActiveContext
    ? '当前对话已带上拍照识题上下文，你可以继续追问“为什么这样做”或“这一步怎么来的”。'
    : '当前没有额外识题上下文，我会按普通学习问答方式回复。';

  return `## 本地 mock 模型回复

${visibleQuestion}

${contextLine}

1. 这里会模拟真实 AI 的 Markdown 流式输出，用来验证聊天 UI、自动滚动和公式渲染。

2. 真实验收时再显式切换到 live 模式，避免开发调试反复消耗模型额度。

公式渲染检查：

$$f'(x)=2x$$`;
}
