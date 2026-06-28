import { NotFoundException } from '@nestjs/common';

import { PrismaService } from '../database/prisma.service';
import { AgentTracesService } from './agent-traces.service';

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

const anySelect = () => expect.any(Object) as unknown as Record<string, true>;

describe('AgentTracesService', () => {
  const now = new Date('2026-06-28T08:00:00.000Z');
  const finishedAt = new Date('2026-06-28T08:00:02.000Z');
  const traceRun = createRunRecord();
  const traceStep = createStepRecord();
  const prisma = {
    agentTraceRun: {
      upsert: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    agentTraceStep: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers().setSystemTime(now);
    prisma.agentTraceRun.upsert.mockResolvedValue(traceRun);
    prisma.agentTraceRun.findMany.mockResolvedValue([traceRun]);
    prisma.agentTraceRun.findFirst.mockResolvedValue(traceRun);
    prisma.agentTraceStep.deleteMany.mockResolvedValue({ count: 1 });
    prisma.agentTraceStep.createMany.mockResolvedValue({ count: 1 });
    prisma.agentTraceStep.findMany.mockResolvedValue([traceStep]);
    prisma.$transaction.mockImplementation(
      <T>(callback: (client: typeof prisma) => T | Promise<T>) =>
        callback(prisma),
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function createService() {
    return new AgentTracesService(prisma as unknown as PrismaService);
  }

  it('creates a trace run with sanitized preview and steps', async () => {
    const result = await createService().createTrace('user_1', {
      runId: 'trace_run_1',
      conversationId: null,
      route: 'rag_answer',
      confidence: 0.91,
      status: 'degraded',
      mode: 'live',
      modelProvider: 'deepseek',
      modelName: 'deepseek-v4-flash',
      inputTokenEstimate: 800,
      outputTokenEstimate: 1200,
      maxOutputTokens: 1200,
      pricingKnown: false,
      costEstimate: 0.0034,
      ragHitCount: 2,
      verifierStatus: 'suspicious',
      verifierChunkCount: 2,
      degraded: true,
      inputHash: 'hash_2',
      inputPreview: '根据我的资料回答'.repeat(20),
      startedAt: now.toISOString(),
      finishedAt: finishedAt.toISOString(),
      totalDurationMs: 2000,
      steps: [
        {
          node: 'RouterAgent',
          status: 'completed',
          startedAt: now.toISOString(),
          finishedAt: now.toISOString(),
          durationMs: 20,
          inputSummary: `资料型问题 DEEPSEEK_API_KEY=sk-secret ${'x'.repeat(200)}`,
          outputSummary: 'route=rag_answer Authorization: Bearer token-secret',
          errorMessage: 'Cookie: session=secret',
        },
      ],
    });
    const upsertInput = prisma.agentTraceRun.upsert.mock.calls[0]?.[0];
    const createManyInput = prisma.agentTraceStep.createMany.mock.calls[0]?.[0];
    const stepData = createManyInput.data[0];

    expect(upsertInput.create.status).toBe('DEGRADED');
    expect(upsertInput.create.mode).toBe('LIVE');
    expect(upsertInput.create.inputPreview).toHaveLength(80);
    expect(stepData.inputSummary).toHaveLength(160);
    expect(stepData.inputSummary).not.toContain('sk-secret');
    expect(stepData.outputSummary).toContain('Authorization: Bearer [redacted]');
    expect(stepData.errorMessage).toContain('Cookie: [redacted]');
    expect(result.run.status).toBe('degraded');
    expect(result.run.mode).toBe('live');
    expect(result.run.costEstimate).toBe(0.0034);
    expect(result.run.pricingKnown).toBe(false);
    expect(result.steps[0]?.status).toBe('completed');
  });

  it('upserts by runId for the same user and replaces steps', async () => {
    await createService().createTrace('user_1', createTraceInput());

    expect(prisma.agentTraceRun.upsert).toHaveBeenCalledWith(
      objectContaining({
        where: {
          id_userId: {
            id: 'trace_run_1',
            userId: 'user_1',
          },
        },
        select: anySelect(),
      }),
    );
    expect(prisma.agentTraceStep.deleteMany).toHaveBeenCalledWith({
      where: { runId: 'trace_run_1', userId: 'user_1' },
    });
    expect(prisma.agentTraceStep.createMany).toHaveBeenCalledWith(
      objectContaining({
        data: [
          objectContaining({
            userId: 'user_1',
            runId: 'trace_run_1',
            node: 'RouterAgent',
          }),
        ],
      }),
    );
  });

  it('lists only current user traces with filters', async () => {
    const result = await createService().listTraces('user_1', {
      limit: 5,
      route: 'tutor',
      mode: 'mock',
      status: 'completed',
    });

    expect(prisma.agentTraceRun.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        route: 'tutor',
        mode: 'MOCK',
        status: 'COMPLETED',
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 5,
      select: anySelect(),
    });
    expect(result.runs[0]?.id).toBe('trace_run_1');
  });

  it('returns summary with route and verifier breakdown', async () => {
    prisma.agentTraceRun.findMany.mockResolvedValueOnce([
      traceRun,
      createRunRecord({
        id: 'trace_run_2',
        route: 'tutor',
        mode: 'MOCK',
        status: 'COMPLETED',
        costEstimate: 0,
        verifierStatus: 'skipped',
      }),
    ]);

    const result = await createService().getSummary('user_1', { days: 7 });

    expect(prisma.agentTraceRun.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        createdAt: { gte: new Date('2026-06-21T08:00:00.000Z') },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: anySelect(),
    });
    expect(result.totalRuns).toBe(2);
    expect(result.liveRuns).toBe(1);
    expect(result.mockRuns).toBe(1);
    expect(result.totalCostEstimate).toBe(0.0034);
    expect(result.routeBreakdown).toEqual(
      expect.arrayContaining([{ route: 'rag_answer', count: 1 }]),
    );
    expect(result.verifierBreakdown).toEqual(
      expect.arrayContaining([{ status: 'suspicious', count: 1 }]),
    );
  });

  it('rejects detail lookup for another user trace', async () => {
    prisma.agentTraceRun.findFirst.mockResolvedValueOnce(null);

    await expect(createService().getTrace('user_2', 'trace_run_1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.agentTraceRun.findFirst).toHaveBeenCalledWith({
      where: { id: 'trace_run_1', userId: 'user_2' },
      select: anySelect(),
    });
  });
});

function createTraceInput() {
  return {
    runId: 'trace_run_1',
    conversationId: null,
    route: 'rag_answer' as const,
    confidence: 0.91,
    status: 'degraded' as const,
    mode: 'live' as const,
    modelProvider: 'deepseek',
    modelName: 'deepseek-v4-flash',
    inputTokenEstimate: 800,
    outputTokenEstimate: 1200,
    maxOutputTokens: 1200,
    pricingKnown: false,
    costEstimate: 0.0034,
    ragHitCount: 2,
    verifierStatus: 'suspicious' as const,
    verifierChunkCount: 2,
    degraded: true,
    inputHash: 'hash_2',
    inputPreview: '根据我的资料回答',
    startedAt: '2026-06-28T08:00:00.000Z',
    finishedAt: '2026-06-28T08:00:02.000Z',
    totalDurationMs: 2000,
    steps: [
      {
        node: 'RouterAgent',
        status: 'completed' as const,
        startedAt: '2026-06-28T08:00:00.000Z',
        finishedAt: '2026-06-28T08:00:00.020Z',
        durationMs: 20,
        inputSummary: '资料型问题',
        outputSummary: 'route=rag_answer',
        errorMessage: null,
      },
    ],
  };
}

function createRunRecord(
  overrides: Partial<ReturnType<typeof createRunRecordBase>> = {},
) {
  return {
    ...createRunRecordBase(),
    ...overrides,
  };
}

function createRunRecordBase() {
  return {
    id: 'trace_run_1',
    userId: 'user_1',
    conversationId: null,
    route: 'rag_answer',
    confidence: 0.91,
    status: 'DEGRADED',
    mode: 'LIVE',
    modelProvider: 'deepseek',
    modelName: 'deepseek-v4-flash',
    inputTokenEstimate: 800,
    outputTokenEstimate: 1200,
    maxOutputTokens: 1200,
    pricingKnown: false,
    costEstimate: { toNumber: () => 0.0034 },
    ragHitCount: 2,
    verifierStatus: 'suspicious',
    verifierChunkCount: 2,
    tutorIntent: null,
    tutorDepth: null,
    degraded: true,
    inputHash: 'hash_2',
    inputPreview: '根据我的资料回答',
    startedAt: new Date('2026-06-28T08:00:00.000Z'),
    finishedAt: new Date('2026-06-28T08:00:02.000Z'),
    totalDurationMs: 2000,
    createdAt: new Date('2026-06-28T08:00:00.000Z'),
    updatedAt: new Date('2026-06-28T08:00:02.000Z'),
  };
}

function createStepRecord() {
  return {
    id: 'step_1',
    userId: 'user_1',
    runId: 'trace_run_1',
    node: 'RouterAgent',
    status: 'COMPLETED',
    startedAt: new Date('2026-06-28T08:00:00.000Z'),
    finishedAt: new Date('2026-06-28T08:00:00.020Z'),
    durationMs: 20,
    inputSummary: '资料型问题',
    outputSummary: 'route=rag_answer',
    errorMessage: null,
    createdAt: new Date('2026-06-28T08:00:00.020Z'),
  };
}
