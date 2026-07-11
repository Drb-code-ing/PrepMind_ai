import { createHash } from 'node:crypto';

import type { ConversationSummaryTriggerReason } from '@repo/types/api/conversation-context';

export type SummarySourceMessage = {
  id: string;
  order: number;
  role: 'USER' | 'ASSISTANT';
  content: string;
};

export function resolveSummaryTrigger(input: {
  uncoveredMessageCount: number;
  estimatedFullContextTokens: number;
  maxInputTokens: number;
}): ConversationSummaryTriggerReason {
  if (
    !Number.isSafeInteger(input.uncoveredMessageCount) ||
    input.uncoveredMessageCount < 0 ||
    !Number.isSafeInteger(input.estimatedFullContextTokens) ||
    input.estimatedFullContextTokens < 0 ||
    !Number.isSafeInteger(input.maxInputTokens) ||
    input.maxInputTokens <= 0
  ) {
    return 'none';
  }
  if (input.uncoveredMessageCount >= 12) return 'message_count';
  if (
    input.estimatedFullContextTokens >= Math.floor(input.maxInputTokens * 0.7)
  ) {
    return 'token_pressure';
  }
  return 'none';
}

export function selectCompleteSummaryTarget(messages: SummarySourceMessage[]) {
  const ordered = [...messages].sort((left, right) => left.order - right.order);
  const latestAssistantIndex = ordered.findLastIndex(
    (message) => message.role === 'ASSISTANT',
  );
  if (latestAssistantIndex < 0) return null;

  return {
    coveredThroughOrder: ordered[latestAssistantIndex].order,
    sourceMessageCount: latestAssistantIndex + 1,
  };
}

export function hashSummarySource(messages: SummarySourceMessage[]) {
  const stable = [...messages]
    .sort((left, right) => left.order - right.order)
    .map((message) => [
      message.id,
      message.order,
      message.role,
      message.content,
    ]);
  return `sha256:${createHash('sha256').update(JSON.stringify(stable)).digest('hex')}`;
}
