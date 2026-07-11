import { randomUUID } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ConversationSummaryStatus } from '@repo/types/api/conversation-context';

import { PrismaService } from '../database/prisma.service';
import {
  CONVERSATION_SUMMARY_PROMPT_VERSION,
  conversationSummaryOutputSchema,
} from './conversation-summary-contract';
import {
  hashSummarySource,
  resolveSummaryTrigger,
  selectCompleteSummaryTarget,
} from './conversation-summary-policy';
import type { SummarySourceMessage } from './conversation-summary-policy';
import {
  CONVERSATION_SUMMARY_RUNTIME,
  type ConversationSummaryRuntimeBundle,
} from './conversation-summary-runtime.factory';
import {
  assertSafeSummaryOutput,
  redactSummaryCredentials,
} from './conversation-summary-safety';

const SUMMARY_PROMPT_OVERHEAD_TOKENS = 160;
const SUMMARY_SYSTEM_PROMPT =
  'Summarize only durable conversational context, current study goals, corrections, and unresolved questions. Never retain credentials.';

@Injectable()
export class ConversationSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CONVERSATION_SUMMARY_RUNTIME)
    private readonly runtimeBundle: ConversationSummaryRuntimeBundle,
  ) {}

  async prepare(
    userId: string,
    conversationId: string,
    maxInputTokens: number,
  ) {
    const snapshot = await this.readSnapshot(userId, conversationId);
    const triggerReason = resolveSummaryTrigger({
      uncoveredMessageCount: snapshot.uncoveredMessages.length,
      estimatedFullContextTokens: estimateTokens(
        snapshot.uncoveredMessages,
        snapshot.summary?.summary ?? null,
      ),
      maxInputTokens,
    });
    if (triggerReason === 'none') {
      return this.resultFromExisting(
        snapshot.summary,
        'reused',
        triggerReason,
        snapshot.uncoveredMessages.length,
      );
    }

    const target = selectCompleteSummaryTarget(snapshot.uncoveredMessages);
    if (!target) {
      return this.resultFromExisting(
        snapshot.summary,
        'not_needed',
        triggerReason,
        snapshot.uncoveredMessages.length,
      );
    }
    const coveredThroughOrder = target.coveredThroughOrder;
    const targetMessages = snapshot.messages.filter(
      (message) => message.order <= coveredThroughOrder,
    );
    const incrementalMessages = snapshot.uncoveredMessages.filter(
      (message) => message.order <= coveredThroughOrder,
    );
    const sourceHash = hashSummarySource(targetMessages);
    const userPrompt = buildUserPrompt(
      snapshot.summary?.summary ?? null,
      incrementalMessages,
    );
    const modelResult = await this.runtimeBundle.runtime.invokeStructured({
      runId: `conversation-summary:${randomUUID()}`,
      task: 'conversation_summary',
      schema: conversationSummaryOutputSchema,
      systemPrompt: SUMMARY_SYSTEM_PROMPT,
      userPrompt,
      estimatedInputTokens: estimatePromptTokens(userPrompt),
      maxOutputTokens: this.runtimeBundle.maxOutputTokens,
      budget: this.runtimeBundle.createBudget(),
    });
    if (!modelResult.ok) {
      return this.resultFromExisting(
        snapshot.summary,
        'degraded',
        triggerReason,
        snapshot.uncoveredMessages.length,
        modelResult.error.code,
        this.runtimeBundle.mode,
      );
    }

    try {
      assertSafeSummaryOutput(modelResult.data.summary);
    } catch {
      return this.resultFromExisting(
        snapshot.summary,
        'degraded',
        triggerReason,
        snapshot.uncoveredMessages.length,
        'CONVERSATION_SUMMARY_CREDENTIAL_OUTPUT_REJECTED',
        this.runtimeBundle.mode,
      );
    }
    if (!isBoundedUsage(modelResult.usage)) {
      return this.resultFromExisting(
        snapshot.summary,
        'degraded',
        triggerReason,
        snapshot.uncoveredMessages.length,
        'CONVERSATION_SUMMARY_USAGE_INVALID',
        this.runtimeBundle.mode,
      );
    }

    const persisted = await this.persistWithCas({
      userId,
      conversationId,
      snapshotSummary: snapshot.summary,
      targetMessages,
      sourceHash,
      coveredThroughOrder,
      summary: modelResult.data.summary,
      inputTokenCount: modelResult.usage.inputTokens,
      outputTokenCount: modelResult.usage.outputTokens,
    });
    if (persisted !== 'generated') {
      return this.resultFromExisting(
        snapshot.summary,
        persisted,
        triggerReason,
        snapshot.uncoveredMessages.length,
        null,
        this.runtimeBundle.mode,
      );
    }

    return {
      summaryBuffer: modelResult.data.summary,
      coveredThroughOrder,
      summaryVersion: (snapshot.summary?.summaryVersion ?? 0) + 1,
      summaryStatus: 'generated' as const,
      triggerReason,
      modelMode: this.runtimeBundle.mode,
      errorCode: null,
      uncoveredMessageCount: snapshot.uncoveredMessages.length,
    };
  }

  private async readSnapshot(userId: string, conversationId: string) {
    const [summary, records] = await Promise.all([
      this.prisma.conversationSummary.findFirst({
        where: { conversationId, userId },
      }),
      this.prisma.chatMessage.findMany({
        where: {
          conversationId,
          userId,
          role: { in: ['USER', 'ASSISTANT'] },
        },
        orderBy: { order: 'asc' },
        select: { id: true, order: true, role: true, content: true },
      }),
    ]);
    const messages = filterSummaryMessages(records);
    return {
      summary,
      messages,
      uncoveredMessages: messages.filter(
        (message) => message.order > (summary?.coveredThroughOrder ?? -1),
      ),
    };
  }

  private async persistWithCas(input: PersistSummaryInput) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const currentSummary = await tx.conversationSummary.findFirst({
            where: {
              conversationId: input.conversationId,
              userId: input.userId,
            },
          });
          if (
            (input.snapshotSummary === null && currentSummary !== null) ||
            (input.snapshotSummary !== null &&
              currentSummary?.summaryVersion !==
                input.snapshotSummary.summaryVersion)
          ) {
            return 'cas_conflict' as const;
          }

          const currentRecords = await tx.chatMessage.findMany({
            where: {
              conversationId: input.conversationId,
              userId: input.userId,
              order: { lte: input.coveredThroughOrder },
              role: { in: ['USER', 'ASSISTANT'] },
            },
            orderBy: { order: 'asc' },
            select: { id: true, order: true, role: true, content: true },
          });
          const currentMessages = filterSummaryMessages(currentRecords);
          if (hashSummarySource(currentMessages) !== input.sourceHash) {
            return 'stale_snapshot' as const;
          }

          const fields = this.persistenceFields(input);
          if (!input.snapshotSummary) {
            await tx.conversationSummary.create({
              data: {
                conversationId: input.conversationId,
                userId: input.userId,
                ...fields,
                summaryVersion: 1,
              },
            });
            return 'generated' as const;
          }
          const updated = await tx.conversationSummary.updateMany({
            where: {
              id: input.snapshotSummary.id,
              userId: input.userId,
              summaryVersion: input.snapshotSummary.summaryVersion,
              coveredThroughOrder: input.snapshotSummary.coveredThroughOrder,
            },
            data: {
              ...fields,
              summaryVersion: { increment: 1 },
            },
          });
          return updated.count === 1
            ? ('generated' as const)
            : ('cas_conflict' as const);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isPrismaCode(error, 'P2002')) return 'cas_conflict' as const;
      if (isPrismaCode(error, 'P2034')) return 'stale_snapshot' as const;
      throw error;
    }
  }

  private persistenceFields(input: PersistSummaryInput) {
    return {
      summary: input.summary,
      coveredThroughOrder: input.coveredThroughOrder,
      sourceMessageCount: input.targetMessages.length,
      sourceHash: input.sourceHash,
      modelMode: this.runtimeBundle.mode.toUpperCase() as 'MOCK' | 'LIVE',
      modelProvider: this.runtimeBundle.provider,
      modelName: this.runtimeBundle.model,
      promptVersion: CONVERSATION_SUMMARY_PROMPT_VERSION,
      inputTokenCount: input.inputTokenCount,
      outputTokenCount: input.outputTokenCount,
    };
  }

  private resultFromExisting(
    summary: SummaryRecord | null,
    summaryStatus: ConversationSummaryStatus,
    triggerReason: 'message_count' | 'token_pressure' | 'none',
    uncoveredMessageCount: number,
    errorCode: string | null = null,
    attemptedMode?: 'mock' | 'live',
  ) {
    return {
      summaryBuffer: summary?.summary ?? null,
      coveredThroughOrder: summary?.coveredThroughOrder ?? null,
      summaryVersion: summary?.summaryVersion ?? null,
      summaryStatus:
        summaryStatus === 'reused' && !summary
          ? ('not_needed' as const)
          : summaryStatus,
      triggerReason,
      modelMode:
        attemptedMode ??
        (summary
          ? (summary.modelMode.toLowerCase() as 'mock' | 'live')
          : ('none' as const)),
      errorCode,
      uncoveredMessageCount,
    };
  }
}

function buildUserPrompt(
  previousSummary: string | null,
  messages: SummarySourceMessage[],
) {
  return redactSummaryCredentials(
    JSON.stringify({
      previousSummary,
      messages: messages.map(({ order, role, content }) => ({
        order,
        role,
        content,
      })),
    }),
  );
}

function estimateTokens(
  messages: SummarySourceMessage[],
  summary: string | null,
) {
  const characters =
    messages.reduce((total, message) => total + message.content.length, 0) +
    (summary?.length ?? 0);
  return SUMMARY_PROMPT_OVERHEAD_TOKENS + Math.ceil(characters / 4);
}

function estimatePromptTokens(prompt: string) {
  return SUMMARY_PROMPT_OVERHEAD_TOKENS + Math.ceil(prompt.length / 4);
}

function filterSummaryMessages(
  messages: Array<{
    id: string;
    order: number;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content: string;
  }>,
): SummarySourceMessage[] {
  return messages.filter(
    (message): message is SummarySourceMessage =>
      message.role === 'USER' || message.role === 'ASSISTANT',
  );
}

function isPrismaCode(error: unknown, code: string) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}

function isBoundedUsage(usage: { inputTokens: number; outputTokens: number }) {
  return [usage.inputTokens, usage.outputTokens].every(
    (value) => Number.isSafeInteger(value) && value >= 0 && value <= 12_000,
  );
}

type SummaryRecord = Prisma.ConversationSummaryGetPayload<object>;
type PersistSummaryInput = {
  userId: string;
  conversationId: string;
  snapshotSummary: SummaryRecord | null;
  targetMessages: SummarySourceMessage[];
  sourceHash: string;
  coveredThroughOrder: number;
  summary: string;
  inputTokenCount: number;
  outputTokenCount: number;
};
