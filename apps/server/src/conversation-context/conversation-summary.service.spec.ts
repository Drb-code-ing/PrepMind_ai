import type { ModelAgentResult } from '@repo/ai';

import { PrismaService } from '../database/prisma.service';
import type { ConversationSummaryRuntimeBundle } from './conversation-summary-runtime.factory';
import { ConversationSummaryService } from './conversation-summary.service';

describe('ConversationSummaryService', () => {
  const messages = [
    { id: 'u1', order: 0, role: 'USER' as const, content: 'question' },
    { id: 'a1', order: 1, role: 'ASSISTANT' as const, content: 'answer' },
  ];
  const summaryRecord = {
    id: 'summary_1',
    conversationId: 'conv_1',
    userId: 'user_1',
    summary: 'previous summary',
    coveredThroughOrder: 1,
    sourceMessageCount: 2,
    sourceHash: `sha256:${'a'.repeat(64)}`,
    summaryVersion: 1,
    modelMode: 'MOCK' as const,
    modelProvider: 'mock',
    modelName: 'mock-conversation-summary',
    promptVersion: 'conversation-summary-v1',
    inputTokenCount: 20,
    outputTokenCount: 5,
    createdAt: new Date('2026-07-11T00:00:00.000Z'),
    updatedAt: new Date('2026-07-11T00:00:00.000Z'),
  };
  const prisma = {
    $transaction: jest.fn(),
    conversationSummary: {
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    chatMessage: { findMany: jest.fn() },
  };
  const invokeStructured = jest.fn();
  const runtime: ConversationSummaryRuntimeBundle = {
    runtime: { invokeStructured },
    mode: 'mock',
    provider: 'mock',
    model: 'mock-conversation-summary',
    maxOutputTokens: 400,
    createBudget: () => ({
      maxCalls: 1,
      usedCalls: 0,
      maxInputTokens: 1600,
      usedInputTokens: 0,
      maxOutputTokens: 400,
      usedOutputTokens: 0,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    prisma.conversationSummary.findFirst.mockResolvedValue(null);
    prisma.chatMessage.findMany.mockResolvedValue(messages);
    prisma.conversationSummary.create.mockResolvedValue({
      ...summaryRecord,
      summary: 'generated summary',
    });
    prisma.conversationSummary.updateMany.mockResolvedValue({ count: 1 });
    invokeStructured.mockResolvedValue(successResult('generated summary'));
  });

  function createService() {
    return new ConversationSummaryService(
      prisma as unknown as PrismaService,
      runtime,
    );
  }

  it('creates the first summary with the model call outside the transaction', async () => {
    const order: string[] = [];
    invokeStructured.mockImplementation(() => {
      order.push('model');
      return Promise.resolve(successResult('generated summary'));
    });
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => Promise<unknown>) => {
        order.push('transaction');
        return callback(prisma);
      },
    );

    const result = await createService().prepare('user_1', 'conv_1', 200);

    expect(order).toEqual(['model', 'transaction']);
    expect(result).toMatchObject({
      summaryBuffer: 'generated summary',
      coveredThroughOrder: 1,
      summaryVersion: 1,
      summaryStatus: 'generated',
      triggerReason: 'token_pressure',
    });
    expect(prisma.conversationSummary.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        conversationId: 'conv_1',
        userId: 'user_1',
        sourceMessageCount: 2,
        summaryVersion: 1,
      }) as Record<string, unknown>,
    });
  });

  it('reuses an existing summary when no trigger is reached', async () => {
    prisma.conversationSummary.findFirst.mockResolvedValue(summaryRecord);
    prisma.chatMessage.findMany.mockResolvedValue(messages);

    const result = await createService().prepare('user_1', 'conv_1', 2500);

    expect(result.summaryStatus).toBe('reused');
    expect(result.summaryVersion).toBe(1);
    expect(invokeStructured).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not count already covered raw history toward token pressure again', async () => {
    prisma.conversationSummary.findFirst.mockResolvedValue(summaryRecord);
    prisma.chatMessage.findMany.mockResolvedValue([
      { ...messages[0], content: 'old question'.repeat(500) },
      { ...messages[1], content: 'old answer'.repeat(500) },
    ]);

    const result = await createService().prepare('user_1', 'conv_1', 2500);

    expect(result.summaryStatus).toBe('reused');
    expect(result.triggerReason).toBe('none');
    expect(invokeStructured).not.toHaveBeenCalled();
  });

  it('never advances beyond the latest complete assistant message', async () => {
    prisma.chatMessage.findMany
      .mockResolvedValueOnce([
        ...messages,
        { id: 'u2', order: 2, role: 'USER', content: 'unfinished'.repeat(100) },
      ])
      .mockResolvedValueOnce(messages);

    const result = await createService().prepare('user_1', 'conv_1', 200);

    expect(result.coveredThroughOrder).toBe(1);
    expect(prisma.conversationSummary.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        coveredThroughOrder: 1,
        sourceMessageCount: 2,
      }) as Record<string, unknown>,
    });
  });

  it('excludes persisted system messages from provider input and source hashing', async () => {
    prisma.chatMessage.findMany.mockResolvedValue([
      { id: 's1', order: 0, role: 'SYSTEM', content: 'internal instruction' },
      { id: 'u1', order: 1, role: 'USER', content: 'question' },
      { id: 'a1', order: 2, role: 'ASSISTANT', content: 'answer' },
    ]);

    await createService().prepare('user_1', 'conv_1', 200);

    const requests = invokeStructured.mock.calls as unknown as Array<
      [{ userPrompt: string }]
    >;
    expect(requests[0]?.[0].userPrompt).not.toContain('internal instruction');
    expect(prisma.conversationSummary.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceMessageCount: 2,
      }) as Record<string, unknown>,
    });
    const calls = prisma.chatMessage.findMany.mock.calls as unknown as Array<
      [{ where: { role?: unknown } }]
    >;
    expect(calls.every(([query]) => query.where.role !== undefined)).toBe(true);
  });

  it('does not persist when the target range changes after the model call', async () => {
    prisma.chatMessage.findMany
      .mockResolvedValueOnce(messages)
      .mockResolvedValueOnce([
        { ...messages[0], content: 'changed' },
        messages[1],
      ]);

    const result = await createService().prepare('user_1', 'conv_1', 200);

    expect(result.summaryStatus).toBe('stale_snapshot');
    expect(prisma.conversationSummary.create).not.toHaveBeenCalled();
  });

  it('does not persist model failures or credential-like output', async () => {
    invokeStructured.mockResolvedValueOnce(failureResult('PROVIDER_ERROR'));
    const failed = await createService().prepare('user_1', 'conv_1', 200);
    expect(failed).toMatchObject({
      summaryStatus: 'degraded',
      errorCode: 'PROVIDER_ERROR',
      modelMode: 'mock',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();

    jest.clearAllMocks();
    prisma.conversationSummary.findFirst.mockResolvedValue(null);
    prisma.chatMessage.findMany.mockResolvedValue(messages);
    invokeStructured.mockResolvedValue(
      successResult('OPENAI_API_KEY=must-not-persist'),
    );
    const unsafe = await createService().prepare('user_1', 'conv_1', 200);
    expect(unsafe).toMatchObject({
      summaryStatus: 'degraded',
      errorCode: 'CONVERSATION_SUMMARY_CREDENTIAL_OUTPUT_REJECTED',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns cas_conflict for an update race without a second model call', async () => {
    prisma.conversationSummary.findFirst.mockResolvedValue(summaryRecord);
    prisma.chatMessage.findMany.mockResolvedValue([
      ...messages,
      { id: 'u2', order: 2, role: 'USER', content: 'new question'.repeat(100) },
      { id: 'a2', order: 3, role: 'ASSISTANT', content: 'new answer' },
    ]);
    prisma.conversationSummary.updateMany.mockResolvedValue({ count: 0 });

    const result = await createService().prepare('user_1', 'conv_1', 200);

    expect(result.summaryStatus).toBe('cas_conflict');
    expect(invokeStructured).toHaveBeenCalledTimes(1);
    const updateCalls = prisma.conversationSummary.updateMany.mock
      .calls as unknown as Array<
      [{ where: Record<string, unknown>; data: Record<string, unknown> }]
    >;
    expect(updateCalls[0]?.[0].data).not.toHaveProperty('conversationId');
    expect(updateCalls[0]?.[0].data).not.toHaveProperty('userId');
    expect(updateCalls[0]?.[0].where).toMatchObject({
      coveredThroughOrder: summaryRecord.coveredThroughOrder,
    });
  });

  it('degrades before persistence when provider usage exceeds DB bounds', async () => {
    invokeStructured.mockResolvedValue({
      ...successResult('generated summary'),
      usage: { inputTokens: 12_001, outputTokens: 5 },
    });

    const result = await createService().prepare('user_1', 'conv_1', 200);

    expect(result).toMatchObject({
      summaryStatus: 'degraded',
      errorCode: 'CONVERSATION_SUMMARY_USAGE_INVALID',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('maps a concurrent first-create unique conflict without retrying the model', async () => {
    prisma.conversationSummary.create.mockRejectedValue({ code: 'P2002' });

    const result = await createService().prepare('user_1', 'conv_1', 200);

    expect(result.summaryStatus).toBe('cas_conflict');
    expect(invokeStructured).toHaveBeenCalledTimes(1);
  });

  it('bounds the transaction recheck to the snapshotted target watermark', async () => {
    await createService().prepare('user_1', 'conv_1', 200);

    const calls = prisma.chatMessage.findMany.mock.calls as unknown as Array<
      [{ where: { order?: { lte: number } } }]
    >;
    expect(calls[1]?.[0].where.order).toEqual({ lte: 1 });
  });
});

function successResult(summary: string): ModelAgentResult<{ summary: string }> {
  return {
    ok: true,
    data: { summary },
    budget: {
      maxCalls: 1,
      usedCalls: 1,
      maxInputTokens: 1600,
      usedInputTokens: 20,
      maxOutputTokens: 400,
      usedOutputTokens: 400,
    },
    usage: { inputTokens: 20, outputTokens: 5 },
    trace: {
      runIdHash: `sha256:${'b'.repeat(64)}`,
      task: 'conversation_summary',
      mode: 'mock',
      provider: 'mock',
      model: 'mock-conversation-summary',
      status: 'succeeded',
      inputTokens: 20,
      outputTokens: 5,
      maxOutputTokens: 400,
      durationMs: 10,
      degraded: false,
    },
  };
}

function failureResult(
  code: 'PROVIDER_ERROR',
): ModelAgentResult<{ summary: string }> {
  return {
    ok: false,
    error: { code, message: 'Model provider request failed', retryable: true },
    budget: {
      maxCalls: 1,
      usedCalls: 1,
      maxInputTokens: 1600,
      usedInputTokens: 20,
      maxOutputTokens: 400,
      usedOutputTokens: 400,
    },
    usage: { inputTokens: 0, outputTokens: 0 },
    trace: {
      runIdHash: `sha256:${'c'.repeat(64)}`,
      task: 'conversation_summary',
      mode: 'mock',
      provider: 'mock',
      model: 'mock-conversation-summary',
      status: 'failed',
      inputTokens: 0,
      outputTokens: 0,
      maxOutputTokens: 400,
      durationMs: 10,
      degraded: true,
      errorCode: code,
    },
  };
}
