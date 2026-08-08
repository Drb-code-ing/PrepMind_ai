import { ConflictException, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { PrismaService } from '../database/prisma.service';
import { AgentTracesService } from './agent-traces.service';
import { createReviewPlannerTrace } from '../review-agent/review-planner-trace';

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

const anySelect = () => expect.any(Object) as unknown as Record<string, true>;

type MockWithFirstArg<T> = {
  mock: {
    calls: Array<[T, ...unknown[]]>;
  };
};

type TraceRunCreateInput = {
  data: {
    status: string;
    mode: string;
    inputPreview: string;
  };
};

type TraceStepCreateManyInput = {
  data: Array<{
    inputSummary: string;
    outputSummary: string;
    errorMessage: string | null;
  }>;
};

function firstMockArg<T>(mock: MockWithFirstArg<T>) {
  return mock.mock.calls[0]?.[0];
}

describe('AgentTracesService', () => {
  const now = new Date('2026-06-28T08:00:00.000Z');
  const finishedAt = new Date('2026-06-28T08:00:02.000Z');
  const traceRun = createRunRecord();
  const traceStep = createStepRecord();
  const prisma = {
    agentTraceRun: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findUnique: jest.fn(),
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
    prisma.agentTraceRun.create.mockResolvedValue(traceRun);
    prisma.agentTraceRun.update.mockResolvedValue(traceRun);
    prisma.agentTraceRun.updateMany.mockResolvedValue({ count: 1 });
    prisma.agentTraceRun.findUnique.mockResolvedValue(null);
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
    const createInput = firstMockArg<TraceRunCreateInput>(
      prisma.agentTraceRun.create,
    );
    const createManyInput = firstMockArg<TraceStepCreateManyInput>(
      prisma.agentTraceStep.createMany,
    );
    const stepData = createManyInput?.data[0];

    expect(createInput?.data.status).toBe('DEGRADED');
    expect(createInput?.data.mode).toBe('LIVE');
    expect(createInput?.data.inputPreview).toHaveLength(80);
    expect(stepData?.inputSummary).toHaveLength(160);
    expect(stepData?.inputSummary).not.toContain('sk-secret');
    expect(stepData?.outputSummary).toContain(
      'Authorization: Bearer [redacted]',
    );
    expect(stepData?.errorMessage).toContain('Cookie: [redacted]');
    expect(result.run.status).toBe('degraded');
    expect(result.run.mode).toBe('live');
    expect(result.run.costEstimate).toBe(0.0034);
    expect(result.run.pricingKnown).toBe(false);
    expect(result.steps[0]?.status).toBe('completed');
  });

  it('upserts by runId for the same user and replaces steps', async () => {
    prisma.agentTraceRun.findUnique.mockResolvedValueOnce({
      userId: 'user_1',
      modelCallId: null,
    });
    await createService().createTrace('user_1', createTraceInput());

    expect(prisma.agentTraceRun.update).toHaveBeenCalledWith(
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

  it('keeps the legacy replace endpoint from overwriting a realtime run', async () => {
    prisma.agentTraceRun.findUnique.mockResolvedValueOnce({
      userId: 'user_1',
      modelCallId: 'model_call_1',
    });

    await expect(
      createService().createTrace('user_1', createTraceInput()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.agentTraceRun.update).not.toHaveBeenCalled();
    expect(prisma.agentTraceStep.deleteMany).not.toHaveBeenCalled();
  });

  it('persists the Review Planner projection without its candidate source material', async () => {
    const trace = createReviewPlannerTrace({
      runId: 'review_planner_trace_1',
      startedAt: now,
      finishedAt: finishedAt,
      deterministicReviewDurationMs: 10,
      deterministicPlannerDurationMs: 10,
      review: localCandidateObservation(),
      planner: localCandidateObservation(),
    });

    await createService().createTrace('user_1', trace);

    const createManyInput = firstMockArg<TraceStepCreateManyInput>(
      prisma.agentTraceStep.createMany,
    );
    expect(createManyInput?.data.map((step) => step.inputSummary)).toEqual([
      'scope=owner_read_only',
      'scope=local_projection',
      'scope=owner_read_only',
      'scope=local_projection',
    ]);
    expect(JSON.stringify(createManyInput)).not.toMatch(
      /prompt|api.?key|base.?url|raw.error|secret/i,
    );
  });

  it('creates a dedicated realtime RUNNING trace before model streaming', async () => {
    const running = createUnpreparedRealtimeRunRecord();
    prisma.agentTraceRun.create.mockResolvedValueOnce(running);
    prisma.agentTraceRun.findFirst.mockResolvedValueOnce(running);
    prisma.agentTraceStep.findMany.mockResolvedValueOnce([]);

    const result = await createService().startRealtimeTrace(
      'user_1',
      createRealtimeStartInput(),
    );

    expect(prisma.agentTraceRun.create).toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({
          id: 'trace_run_1',
          userId: 'user_1',
          status: 'RUNNING',
          modelCallId: 'model_call_1',
          route: null,
          modelProvider: 'pending',
          realtimePreparedAt: null,
          realtimePreparationDigest: null,
          inputHash: null,
          inputPreview: null,
          finishedAt: null,
        }),
      }),
    );
    expect(result.run.status).toBe('running');
    expect(result.run.modelCallId).toBe('model_call_1');
    expect(result.run.route).toBeNull();
    expect(result.steps).toEqual([]);
  });

  it('prepares an unprepared RUNNING trace once with safe fixed steps', async () => {
    const running = createUnpreparedRealtimeRunRecord();
    const prepared = createPreparedRealtimeRunRecord();
    prisma.agentTraceRun.findFirst
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(prepared);
    prisma.agentTraceStep.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createStepRecord()]);

    const result = await createService().prepareRealtimeTrace(
      'user_1',
      'trace_run_1',
      createRealtimePrepareInput(),
    );

    expect(prisma.agentTraceRun.updateMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          id: 'trace_run_1',
          userId: 'user_1',
          status: 'RUNNING',
          modelCallId: 'model_call_1',
          realtimePreparedAt: null,
        }),
        data: objectContaining({
          route: 'rag_answer',
          modelProvider: 'deepseek',
          realtimePreparedAt: new Date('2026-06-28T08:00:01.000Z'),
          inputHash: null,
          inputPreview: null,
        }),
      }),
    );
    expect(result.run.status).toBe('running');
    expect(result.run.route).toBe('rag_answer');
  });

  it('returns an identical preparation idempotently without another write', async () => {
    prisma.agentTraceRun.findFirst.mockResolvedValueOnce(
      createPreparedRealtimeRunRecord(),
    );
    prisma.agentTraceStep.findMany.mockResolvedValueOnce([createStepRecord()]);

    const result = await createService().prepareRealtimeTrace(
      'user_1',
      'trace_run_1',
      createRealtimePrepareInput(),
    );

    expect(result.run.status).toBe('running');
    expect(prisma.agentTraceRun.updateMany).not.toHaveBeenCalled();
    expect(prisma.agentTraceStep.createMany).not.toHaveBeenCalled();
  });

  it('rejects conflicting or terminal-late preparations', async () => {
    prisma.agentTraceRun.findFirst.mockResolvedValueOnce(
      createPreparedRealtimeRunRecord(),
    );
    prisma.agentTraceStep.findMany.mockResolvedValueOnce([createStepRecord()]);
    const conflicting = createRealtimePrepareInput();
    conflicting.preparation.modelName = 'tampered-model';

    await expect(
      createService().prepareRealtimeTrace(
        'user_1',
        'trace_run_1',
        conflicting,
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      <T>(callback: (client: typeof prisma) => T | Promise<T>) =>
        callback(prisma),
    );
    prisma.agentTraceRun.findFirst.mockResolvedValueOnce(
      createRunRecord({
        status: 'FAILED',
        modelCallId: 'model_call_1',
        realtimePreparedAt: null,
        realtimePreparationDigest: null,
      }),
    );
    prisma.agentTraceStep.findMany.mockResolvedValueOnce([]);
    await expect(
      createService().prepareRealtimeTrace(
        'user_1',
        'trace_run_1',
        createRealtimePrepareInput(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('atomically backfills an identical preparation when its ACK was unavailable', async () => {
    const terminal = createRunRecord({
      status: 'COMPLETED',
      modelCallId: 'model_call_1',
      realtimePreparedAt: new Date('2026-06-28T08:00:01.000Z'),
      realtimePreparationDigest: createRealtimePrepareDigest(),
      pricingKnown: true,
      costEstimate: { toNumber: () => 0 },
      firstTokenLatencyMs: 40,
      finishReason: 'stop',
      verifiedInputTokens: 256,
      verifiedOutputTokens: 32,
      priceProfile: 'deepseek-v4-pro-cny-2026-07-15',
      verifiedCostCny: { toNumber: () => 0.00096 },
      degraded: false,
      inputHash: null,
      inputPreview: null,
    });
    prisma.agentTraceRun.findFirst
      .mockResolvedValueOnce(createUnpreparedRealtimeRunRecord())
      .mockResolvedValueOnce(terminal);
    prisma.agentTraceStep.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(terminalStepRecords());

    await createService().finalizeRealtimeTrace(
      'user_1',
      'trace_run_1',
      createRealtimeFinalizeInput(),
    );

    expect(prisma.agentTraceRun.updateMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          realtimePreparedAt: null,
          realtimePreparationDigest: null,
        }),
        data: objectContaining({
          realtimePreparedAt: new Date('2026-06-28T08:00:01.000Z'),
          realtimePreparationDigest: createRealtimePrepareDigest(),
          status: 'COMPLETED',
        }),
      }),
    );
  });

  it('atomically finalizes only the matching RUNNING model call', async () => {
    const running = createPreparedRealtimeRunRecord();
    const terminal = createRunRecord({
      status: 'COMPLETED',
      modelCallId: 'model_call_1',
      firstTokenLatencyMs: 40,
      finishReason: 'stop',
      verifiedInputTokens: 256,
      verifiedOutputTokens: 32,
      priceProfile: 'deepseek-v4-pro-cny-2026-07-15',
      verifiedCostCny: { toNumber: () => 0.00096 },
      qualityAuthority: 'none',
      pricingKnown: true,
      costEstimate: { toNumber: () => 0 },
      realtimePreparedAt: new Date('2026-06-28T08:00:01.000Z'),
      realtimePreparationDigest: createRealtimePrepareDigest(),
      degraded: false,
      inputHash: null,
      inputPreview: null,
    });
    prisma.agentTraceRun.findFirst
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(terminal);
    prisma.agentTraceStep.findMany
      .mockResolvedValueOnce([createStepRecord()])
      .mockResolvedValueOnce(terminalStepRecords());

    const result = await createService().finalizeRealtimeTrace(
      'user_1',
      'trace_run_1',
      createRealtimeFinalizeInput(),
    );

    expect(prisma.agentTraceRun.updateMany).toHaveBeenCalledWith(
      objectContaining({
        where: objectContaining({
          id: 'trace_run_1',
          userId: 'user_1',
          status: 'RUNNING',
          modelCallId: 'model_call_1',
        }),
      }),
    );
    expect(result.run.status).toBe('completed');
    expect(result.run.verifiedInputTokens).toBe(256);
    expect(result.run.verifiedCostCny).toBe(0.00096);
  });

  it('rejects a terminal that changes the prepared snapshot before the CAS update', async () => {
    const running = createPreparedRealtimeRunRecord();
    prisma.agentTraceRun.findFirst.mockResolvedValueOnce(running);
    prisma.agentTraceStep.findMany.mockResolvedValueOnce([createStepRecord()]);

    await expect(
      createService().finalizeRealtimeTrace('user_1', 'trace_run_1', {
        ...createRealtimeFinalizeInput(),
        preparation: {
          ...createRealtimeFinalizeInput().preparation,
          modelName: 'tampered-model',
        },
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.agentTraceRun.updateMany).not.toHaveBeenCalled();
  });

  it('returns an identical existing terminal without rewriting steps', async () => {
    const terminal = createRunRecord({
      status: 'COMPLETED',
      modelCallId: 'model_call_1',
      firstTokenLatencyMs: 40,
      finishReason: 'stop',
      verifiedInputTokens: 256,
      verifiedOutputTokens: 32,
      priceProfile: 'deepseek-v4-pro-cny-2026-07-15',
      verifiedCostCny: { toNumber: () => 0.00096 },
      qualityAuthority: 'none',
      pricingKnown: true,
      costEstimate: { toNumber: () => 0 },
      degraded: false,
      realtimePreparedAt: new Date('2026-06-28T08:00:01.000Z'),
      realtimePreparationDigest: createRealtimePrepareDigest(),
      inputHash: null,
      inputPreview: null,
    });
    prisma.agentTraceRun.findFirst.mockResolvedValueOnce(terminal);
    prisma.agentTraceStep.findMany.mockResolvedValueOnce(terminalStepRecords());

    const result = await createService().finalizeRealtimeTrace(
      'user_1',
      'trace_run_1',
      createRealtimeFinalizeInput(),
    );

    expect(result.run.status).toBe('completed');
    expect(prisma.agentTraceRun.updateMany).not.toHaveBeenCalled();
    expect(prisma.agentTraceStep.deleteMany).not.toHaveBeenCalled();
  });

  it('returns the identical winner when a concurrent finalize wins the CAS', async () => {
    const running = createPreparedRealtimeRunRecord();
    const terminal = createCompletedRealtimeRunRecord();
    prisma.agentTraceRun.updateMany.mockResolvedValueOnce({ count: 0 });
    prisma.agentTraceRun.findFirst
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(terminal);
    prisma.agentTraceStep.findMany
      .mockResolvedValueOnce([createStepRecord()])
      .mockResolvedValueOnce(terminalStepRecords());

    const result = await createService().finalizeRealtimeTrace(
      'user_1',
      'trace_run_1',
      createRealtimeFinalizeInput(),
    );

    expect(result.run.status).toBe('completed');
    expect(prisma.agentTraceRun.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.agentTraceStep.deleteMany).not.toHaveBeenCalled();
  });

  it('seals an early unprepared abort without fabricating Agent steps', async () => {
    const terminal = createRunRecord({
      ...createUnpreparedRealtimeRunRecord(),
      status: 'FAILED',
      degraded: true,
      finishReason: 'aborted',
      finishedAt: new Date('2026-06-28T08:00:00.100Z'),
      totalDurationMs: 100,
    });
    prisma.agentTraceRun.findFirst
      .mockResolvedValueOnce(createUnpreparedRealtimeRunRecord())
      .mockResolvedValueOnce(terminal);
    prisma.agentTraceStep.findMany.mockResolvedValue([]);

    const result = await createService().finalizeRealtimeTrace(
      'user_1',
      'trace_run_1',
      createEarlyRealtimeAbortInput(),
    );

    expect(result.run.status).toBe('failed');
    expect(result.steps).toEqual([]);
    expect(prisma.agentTraceStep.createMany).not.toHaveBeenCalled();
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
    expect(result.runningRuns).toBe(0);
    expect(result.liveRuns).toBe(1);
    expect(result.mockRuns).toBe(1);
    expect(result.totalCostEstimate).toBe(0.0034);
    expect(result.verifiedUsageRuns).toBe(0);
    expect(result.totalVerifiedCostCny).toBe(0);
    expect(result.routeBreakdown).toEqual(
      expect.arrayContaining([{ route: 'rag_answer', count: 1 }]),
    );
    expect(result.verifierBreakdown).toEqual(
      expect.arrayContaining([{ status: 'suspicious', count: 1 }]),
    );
  });

  it('rejects detail lookup for another user trace', async () => {
    prisma.agentTraceRun.findFirst.mockResolvedValueOnce(null);

    await expect(
      createService().getTrace('user_2', 'trace_run_1'),
    ).rejects.toBeInstanceOf(NotFoundException);
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

function createRealtimeStartInput() {
  const trace = createTraceInput();
  return {
    runId: trace.runId,
    modelCallId: 'model_call_1',
    conversationId: trace.conversationId,
    mode: trace.mode,
    startedAt: trace.startedAt,
  };
}

function createRealtimePrepareInput() {
  const start = createRealtimeStartInput();
  const trace = createTraceInput();
  return {
    runId: start.runId,
    modelCallId: start.modelCallId,
    preparation: {
      route: trace.route,
      confidence: trace.confidence,
      modelProvider: trace.modelProvider,
      modelName: trace.modelName,
      inputTokenEstimate: trace.inputTokenEstimate,
      outputTokenEstimate: trace.outputTokenEstimate,
      maxOutputTokens: trace.maxOutputTokens,
      pricingKnown: false,
      costEstimate: 0,
      ragHitCount: trace.ragHitCount,
      verifierStatus: trace.verifierStatus,
      verifierChunkCount: trace.verifierChunkCount,
      degraded: false,
      preparedAt: '2026-06-28T08:00:01.000Z',
      steps: [
        {
          node: 'RouterAgent' as const,
          status: 'completed' as const,
          startedAt: '2026-06-28T08:00:00.000Z',
          finishedAt: '2026-06-28T08:00:00.020Z',
          durationMs: 20,
          inputSummary: 'scope=canonical_route',
          outputSummary: 'route=rag_answer',
          errorMessage: null,
        },
      ],
    },
  };
}

function createRealtimeFinalizeInput() {
  const start = createRealtimeStartInput();
  const prepare = createRealtimePrepareInput();
  return {
    runId: start.runId,
    modelCallId: start.modelCallId,
    status: 'completed' as const,
    pricingKnown: true,
    degraded: false,
    finishedAt: '2026-06-28T08:00:02.000Z',
    totalDurationMs: 2000,
    firstTokenLatencyMs: 40,
    finishReason: 'stop' as const,
    verifiedInputTokens: 256,
    verifiedOutputTokens: 32,
    priceProfile: 'deepseek-v4-pro-cny-2026-07-15',
    verifiedCostCny: 0.00096,
    qualityAuthority: 'none' as const,
    preparation: prepare.preparation,
    steps: [
      ...prepare.preparation.steps,
      {
        node: 'FinalResponseAgent',
        status: 'completed' as const,
        startedAt: '2026-06-28T08:00:01.000Z',
        finishedAt: '2026-06-28T08:00:02.000Z',
        durationMs: 1000,
        inputSummary: 'scope=final_response',
        outputSummary: 'disposition=completed finish=stop',
        errorMessage: null,
      },
    ],
  };
}

function createEarlyRealtimeAbortInput() {
  const start = createRealtimeStartInput();
  return {
    runId: start.runId,
    modelCallId: start.modelCallId,
    status: 'failed' as const,
    pricingKnown: false,
    degraded: true,
    finishedAt: '2026-06-28T08:00:00.100Z',
    totalDurationMs: 100,
    firstTokenLatencyMs: null,
    finishReason: 'aborted' as const,
    verifiedInputTokens: null,
    verifiedOutputTokens: null,
    priceProfile: null,
    verifiedCostCny: null,
    qualityAuthority: 'none' as const,
    steps: [],
  };
}

function localCandidateObservation() {
  return {
    attempted: false as const,
    disposition: 'not_eligible' as const,
    budget: {
      maxCalls: 2,
      usedCalls: 0,
      maxInputTokens: 1950,
      usedInputTokens: 0,
      maxOutputTokens: 440,
      usedOutputTokens: 0,
    },
    usage: { inputTokens: 0, outputTokens: 0 },
    reasonCodes: ['not_eligible'] as const,
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

function createUnpreparedRealtimeRunRecord() {
  return createRunRecord({
    route: null,
    confidence: 0,
    status: 'RUNNING',
    modelProvider: 'pending',
    modelName: 'pending',
    inputTokenEstimate: 0,
    outputTokenEstimate: 0,
    maxOutputTokens: 0,
    pricingKnown: false,
    costEstimate: { toNumber: () => 0 },
    modelCallId: 'model_call_1',
    realtimePreparedAt: null,
    realtimePreparationDigest: null,
    ragHitCount: 0,
    verifierStatus: null,
    verifierChunkCount: 0,
    degraded: false,
    inputHash: null,
    inputPreview: null,
    finishedAt: null,
    totalDurationMs: null,
  });
}

function createPreparedRealtimeRunRecord() {
  return createRunRecord({
    status: 'RUNNING',
    pricingKnown: false,
    costEstimate: { toNumber: () => 0 },
    modelCallId: 'model_call_1',
    realtimePreparedAt: new Date('2026-06-28T08:00:01.000Z'),
    realtimePreparationDigest: createRealtimePrepareDigest(),
    degraded: false,
    inputHash: null,
    inputPreview: null,
    finishedAt: null,
    totalDurationMs: null,
  });
}

function createCompletedRealtimeRunRecord() {
  return createRunRecord({
    status: 'COMPLETED',
    modelCallId: 'model_call_1',
    realtimePreparedAt: new Date('2026-06-28T08:00:01.000Z'),
    realtimePreparationDigest: createRealtimePrepareDigest(),
    pricingKnown: true,
    costEstimate: { toNumber: () => 0 },
    firstTokenLatencyMs: 40,
    finishReason: 'stop',
    verifiedInputTokens: 256,
    verifiedOutputTokens: 32,
    priceProfile: 'deepseek-v4-pro-cny-2026-07-15',
    verifiedCostCny: { toNumber: () => 0.00096 },
    degraded: false,
    inputHash: null,
    inputPreview: null,
  });
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
    modelCallId: null,
    realtimePreparedAt: null,
    realtimePreparationDigest: null,
    firstTokenLatencyMs: null,
    finishReason: null,
    verifiedInputTokens: null,
    verifiedOutputTokens: null,
    priceProfile: null,
    verifiedCostCny: null,
    qualityAuthority: 'none',
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
    inputSummary: 'scope=canonical_route',
    outputSummary: 'route=rag_answer',
    errorMessage: null,
    createdAt: new Date('2026-06-28T08:00:00.020Z'),
  };
}

function terminalStepRecords() {
  return [
    createStepRecord(),
    {
      id: 'step_final_response',
      userId: 'user_1',
      runId: 'trace_run_1',
      node: 'FinalResponseAgent',
      status: 'COMPLETED',
      startedAt: new Date('2026-06-28T08:00:01.000Z'),
      finishedAt: new Date('2026-06-28T08:00:02.000Z'),
      durationMs: 1000,
      inputSummary: 'scope=final_response',
      outputSummary: 'disposition=completed finish=stop',
      errorMessage: null,
      createdAt: new Date('2026-06-28T08:00:02.000Z'),
    },
  ];
}

function createRealtimePrepareDigest() {
  return createHash('sha256')
    .update(JSON.stringify(createRealtimePrepareInput().preparation))
    .digest('hex');
}
