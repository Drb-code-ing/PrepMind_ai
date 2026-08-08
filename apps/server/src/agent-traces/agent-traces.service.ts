import { createHash, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AgentTraceMode as PrismaAgentTraceMode,
  AgentTraceStatus as PrismaAgentTraceStatus,
  Prisma,
} from '@prisma/client';
import type {
  AgentTraceCreateRequest,
  AgentTraceDetailResponse,
  AgentTraceRealtimeFinalizeRequest,
  AgentTraceRealtimePreparation,
  AgentTraceRealtimePrepareRequest,
  AgentTraceRealtimeStartRequest,
  AgentTraceListQuery,
  AgentTraceListResponse,
  AgentTraceMode,
  AgentTraceRun,
  AgentTraceStatus,
  AgentTraceStep,
  AgentTraceSummaryQuery,
  AgentTraceSummaryResponse,
  AgentTraceVerifierStatus,
  RealtimeAgentTraceStepRequest,
} from '@repo/types/api/agent-trace';

import { PrismaService } from '../database/prisma.service';

const INPUT_PREVIEW_LIMIT = 80;
const STEP_SUMMARY_LIMIT = 160;
const ERROR_SUMMARY_LIMIT = 240;

const runSelect = {
  id: true,
  userId: true,
  conversationId: true,
  route: true,
  confidence: true,
  status: true,
  mode: true,
  modelProvider: true,
  modelName: true,
  inputTokenEstimate: true,
  outputTokenEstimate: true,
  maxOutputTokens: true,
  pricingKnown: true,
  costEstimate: true,
  modelCallId: true,
  realtimePreparedAt: true,
  realtimePreparationDigest: true,
  firstTokenLatencyMs: true,
  finishReason: true,
  verifiedInputTokens: true,
  verifiedOutputTokens: true,
  priceProfile: true,
  verifiedCostCny: true,
  qualityAuthority: true,
  ragHitCount: true,
  verifierStatus: true,
  verifierChunkCount: true,
  tutorIntent: true,
  tutorDepth: true,
  degraded: true,
  inputHash: true,
  inputPreview: true,
  startedAt: true,
  finishedAt: true,
  totalDurationMs: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AgentTraceRunSelect;

const stepSelect = {
  id: true,
  userId: true,
  runId: true,
  node: true,
  status: true,
  startedAt: true,
  finishedAt: true,
  durationMs: true,
  inputSummary: true,
  outputSummary: true,
  errorMessage: true,
  createdAt: true,
} satisfies Prisma.AgentTraceStepSelect;

type AgentTraceRunRecord = Prisma.AgentTraceRunGetPayload<{
  select: typeof runSelect;
}>;
type AgentTraceStepRecord = Prisma.AgentTraceStepGetPayload<{
  select: typeof stepSelect;
}>;
type RealtimeTraceState = Readonly<{
  preparedAt: string | null;
  preparationDigest: string | null;
  detail: AgentTraceDetailResponse;
}>;
type AgentTraceRunWriteData = {
  conversationId: string | null;
  route: AgentTraceRun['route'];
  confidence: number;
  status: PrismaAgentTraceStatus;
  mode: PrismaAgentTraceMode;
  modelProvider: string;
  modelName: string;
  inputTokenEstimate: number;
  outputTokenEstimate: number;
  maxOutputTokens: number;
  pricingKnown: boolean;
  costEstimate: number;
  modelCallId: string | null;
  firstTokenLatencyMs: number | null;
  finishReason: AgentTraceRun['finishReason'];
  verifiedInputTokens: number | null;
  verifiedOutputTokens: number | null;
  priceProfile: string | null;
  verifiedCostCny: number | null;
  qualityAuthority: 'none';
  ragHitCount: number;
  verifierStatus: AgentTraceVerifierStatus | null;
  verifierChunkCount: number;
  tutorIntent: string | null;
  tutorDepth: string | null;
  degraded: boolean;
  inputHash?: string;
  inputPreview: string | null;
  startedAt: Date;
  finishedAt: Date | null;
  totalDurationMs: number | null;
};

@Injectable()
export class AgentTracesService {
  constructor(private readonly prisma: PrismaService) {}

  async createTrace(
    userId: string,
    input: AgentTraceCreateRequest,
  ): Promise<AgentTraceDetailResponse> {
    const runId = input.runId ?? randomUUID();
    const runData = this.toRunWriteData(input);
    const stepData = input.steps.map((step) => ({
      userId,
      runId,
      node: sanitizeSummary(step.node, STEP_SUMMARY_LIMIT),
      status: toDbStatus(step.status),
      startedAt: new Date(step.startedAt),
      finishedAt: step.finishedAt ? new Date(step.finishedAt) : null,
      durationMs: step.durationMs,
      inputSummary: sanitizeSummary(step.inputSummary, STEP_SUMMARY_LIMIT),
      outputSummary: sanitizeSummary(step.outputSummary, STEP_SUMMARY_LIMIT),
      errorMessage:
        step.errorMessage === null
          ? null
          : sanitizeSummary(step.errorMessage, ERROR_SUMMARY_LIMIT),
    }));

    let result: { run: AgentTraceRunRecord; steps: AgentTraceStepRecord[] };
    try {
      result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.agentTraceRun.findUnique({
          where: { id: runId },
          select: { userId: true, modelCallId: true },
        });
        if (
          existing !== null &&
          (existing.userId !== userId || existing.modelCallId !== null)
        ) {
          throw new ConflictException('Agent trace identity is already in use');
        }
        const run =
          existing === null
            ? await tx.agentTraceRun.create({
                data: {
                  id: runId,
                  userId,
                  ...runData,
                },
                select: runSelect,
              })
            : await tx.agentTraceRun.update({
                where: {
                  id_userId: {
                    id: runId,
                    userId,
                  },
                },
                data: runData,
                select: runSelect,
              });

        await tx.agentTraceStep.deleteMany({
          where: { runId, userId },
        });

        if (stepData.length > 0) {
          await tx.agentTraceStep.createMany({
            data: stepData,
          });
        }

        const steps = await tx.agentTraceStep.findMany({
          where: { runId, userId },
          orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
          select: stepSelect,
        });

        return { run, steps };
      });
    } catch (error) {
      if (isUniqueConstraintViolation(error)) {
        throw new ConflictException('Agent trace identity is already in use');
      }
      throw error;
    }

    return {
      run: this.toRun(result.run),
      steps: result.steps.map((step) => this.toStep(step)),
    };
  }

  async startRealtimeTrace(
    userId: string,
    input: AgentTraceRealtimeStartRequest,
  ): Promise<AgentTraceDetailResponse> {
    const runData = {
      id: input.runId,
      userId,
      conversationId: input.conversationId,
      route: null,
      confidence: 0,
      status: PrismaAgentTraceStatus.RUNNING,
      mode: toDbMode(input.mode),
      modelProvider: 'pending',
      modelName: 'pending',
      inputTokenEstimate: 0,
      outputTokenEstimate: 0,
      maxOutputTokens: 0,
      pricingKnown: false,
      costEstimate: 0,
      modelCallId: input.modelCallId,
      realtimePreparedAt: null,
      realtimePreparationDigest: null,
      firstTokenLatencyMs: null,
      finishReason: null,
      verifiedInputTokens: null,
      verifiedOutputTokens: null,
      priceProfile: null,
      verifiedCostCny: null,
      qualityAuthority: 'none',
      ragHitCount: 0,
      verifierStatus: null,
      verifierChunkCount: 0,
      tutorIntent: null,
      tutorDepth: null,
      degraded: false,
      inputHash: null,
      inputPreview: null,
      startedAt: new Date(input.startedAt),
      finishedAt: null,
      totalDurationMs: null,
    } satisfies Prisma.AgentTraceRunUncheckedCreateInput;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const run = await tx.agentTraceRun.create({
          data: runData,
          select: runSelect,
        });
        const steps = await tx.agentTraceStep.findMany({
          where: { runId: input.runId, userId },
          orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
          select: stepSelect,
        });
        return {
          run: this.toRun(run),
          steps: steps.map((step) => this.toStep(step)),
        };
      });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const existing = await this.findRealtimeState(userId, input.runId);
      if (existing !== null && realtimeStartMatches(existing, input))
        return existing.detail;
      throw new ConflictException(
        'Realtime agent trace identity is already in use',
      );
    }
  }

  async prepareRealtimeTrace(
    userId: string,
    runId: string,
    input: AgentTraceRealtimePrepareRequest,
  ): Promise<AgentTraceDetailResponse> {
    if (runId !== input.runId) {
      throw new ConflictException('Realtime agent trace run identity mismatch');
    }
    const stepData = this.toStepWriteData(
      userId,
      runId,
      input.preparation.steps,
    );
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findRealtimeState(userId, runId, tx);
      if (existing === null)
        throw new NotFoundException('Agent trace not found');
      if (
        existing.detail.run.status !== 'running' ||
        existing.detail.run.modelCallId !== input.modelCallId
      ) {
        throw new ConflictException('Realtime agent trace cannot be prepared');
      }
      if (existing.preparedAt !== null) {
        if (realtimePreparationMatches(existing, input.preparation, stepData)) {
          return existing.detail;
        }
        throw new ConflictException(
          'Realtime agent trace preparation conflicts',
        );
      }
      if (
        existing.preparationDigest !== null ||
        existing.detail.steps.length !== 0 ||
        !realtimePreparationTimelineIsValid(existing.detail, input.preparation)
      ) {
        throw new ConflictException(
          'Realtime agent trace preparation is invalid',
        );
      }

      const update = await tx.agentTraceRun.updateMany({
        where: {
          id: runId,
          userId,
          status: PrismaAgentTraceStatus.RUNNING,
          modelCallId: input.modelCallId,
          realtimePreparedAt: null,
          realtimePreparationDigest: null,
        },
        data: toPreparationRunData(input.preparation),
      });
      if (update.count === 0) {
        const current = await this.findRealtimeState(userId, runId, tx);
        if (
          current !== null &&
          current.detail.run.status === 'running' &&
          realtimePreparationMatches(current, input.preparation, stepData)
        ) {
          return current.detail;
        }
        throw new ConflictException(
          'Realtime agent trace preparation conflicts',
        );
      }

      if (stepData.length > 0)
        await tx.agentTraceStep.createMany({ data: stepData });
      const prepared = await this.findRealtimeState(userId, runId, tx);
      if (prepared === null)
        throw new NotFoundException('Agent trace not found');
      return prepared.detail;
    });
  }

  async finalizeRealtimeTrace(
    userId: string,
    runId: string,
    input: AgentTraceRealtimeFinalizeRequest,
  ): Promise<AgentTraceDetailResponse> {
    if (runId !== input.runId) {
      throw new ConflictException('Realtime agent trace run identity mismatch');
    }
    const stepData = this.toStepWriteData(userId, runId, input.steps);
    return this.prisma.$transaction(async (tx) => {
      let existing = await this.findRealtimeState(userId, runId, tx);
      if (existing === null)
        throw new NotFoundException('Agent trace not found');
      if (existing.detail.run.status !== 'running') {
        if (realtimeFinalizeMatches(existing, input, stepData))
          return existing.detail;
        throw new ConflictException(
          'Realtime agent trace is already terminal or mismatched',
        );
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        if (!realtimeFinalizeCanApply(existing, input)) {
          throw new ConflictException(
            'Realtime agent trace terminal does not match its lifecycle',
          );
        }
        const update = await tx.agentTraceRun.updateMany({
          where: {
            id: runId,
            userId,
            status: PrismaAgentTraceStatus.RUNNING,
            modelCallId: input.modelCallId,
            realtimePreparedAt:
              existing.preparedAt === null
                ? null
                : new Date(existing.preparedAt),
            realtimePreparationDigest:
              existing.preparationDigest === null
                ? null
                : existing.preparationDigest,
          },
          data: {
            ...(existing.preparedAt === null && input.preparation !== undefined
              ? toPreparationRunData(input.preparation)
              : {}),
            status: toDbStatus(input.status),
            pricingKnown: input.pricingKnown,
            firstTokenLatencyMs: input.firstTokenLatencyMs,
            finishReason: input.finishReason,
            verifiedInputTokens: input.verifiedInputTokens,
            verifiedOutputTokens: input.verifiedOutputTokens,
            priceProfile: input.priceProfile,
            verifiedCostCny: input.verifiedCostCny,
            qualityAuthority: input.qualityAuthority,
            degraded: input.degraded,
            finishedAt: new Date(input.finishedAt),
            totalDurationMs: input.totalDurationMs,
          },
        });

        if (update.count === 1) {
          await tx.agentTraceStep.deleteMany({ where: { runId, userId } });
          if (stepData.length > 0)
            await tx.agentTraceStep.createMany({ data: stepData });
          const terminal = await this.findRealtimeState(userId, runId, tx);
          if (terminal === null)
            throw new NotFoundException('Agent trace not found');
          return terminal.detail;
        }

        const current = await this.findRealtimeState(userId, runId, tx);
        if (current === null)
          throw new NotFoundException('Agent trace not found');
        if (realtimeFinalizeMatches(current, input, stepData))
          return current.detail;
        if (current.detail.run.status !== 'running') {
          throw new ConflictException(
            'Realtime agent trace is already terminal or mismatched',
          );
        }
        existing = current;
      }
      throw new ConflictException('Realtime agent trace terminal conflicts');
    });
  }

  private toStepWriteData(
    userId: string,
    runId: string,
    steps: readonly RealtimeAgentTraceStepRequest[],
  ): Prisma.AgentTraceStepCreateManyInput[] {
    return steps.map((step) => ({
      userId,
      runId,
      node: sanitizeSummary(step.node, STEP_SUMMARY_LIMIT),
      status: toDbStatus(step.status),
      startedAt: new Date(step.startedAt),
      finishedAt: step.finishedAt ? new Date(step.finishedAt) : null,
      durationMs: step.durationMs,
      inputSummary: sanitizeSummary(step.inputSummary, STEP_SUMMARY_LIMIT),
      outputSummary: sanitizeSummary(step.outputSummary, STEP_SUMMARY_LIMIT),
      errorMessage:
        step.errorMessage === null
          ? null
          : sanitizeSummary(step.errorMessage, ERROR_SUMMARY_LIMIT),
    }));
  }

  private async findRealtimeState(
    userId: string,
    runId: string,
    client: Pick<
      Prisma.TransactionClient,
      'agentTraceRun' | 'agentTraceStep'
    > = this.prisma,
  ): Promise<RealtimeTraceState | null> {
    const run = await client.agentTraceRun.findFirst({
      where: { id: runId, userId },
      select: runSelect,
    });
    if (run === null) return null;
    const steps = await client.agentTraceStep.findMany({
      where: { runId, userId },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      select: stepSelect,
    });
    return {
      preparedAt: run.realtimePreparedAt?.toISOString() ?? null,
      preparationDigest: run.realtimePreparationDigest,
      detail: {
        run: this.toRun(run),
        steps: steps.map((step) => this.toStep(step)),
      },
    };
  }

  async listTraces(
    userId: string,
    query: AgentTraceListQuery,
  ): Promise<AgentTraceListResponse> {
    const where: Prisma.AgentTraceRunWhereInput = { userId };
    if (query.route) where.route = query.route;
    if (query.mode) where.mode = toDbMode(query.mode);
    if (query.status) where.status = toDbStatus(query.status);

    const runs = await this.prisma.agentTraceRun.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      select: runSelect,
    });

    return {
      runs: runs.map((run) => this.toRun(run)),
    };
  }

  async getTrace(
    userId: string,
    id: string,
  ): Promise<AgentTraceDetailResponse> {
    const run = await this.prisma.agentTraceRun.findFirst({
      where: { id, userId },
      select: runSelect,
    });

    if (!run) {
      throw new NotFoundException('Agent trace not found');
    }

    const steps = await this.prisma.agentTraceStep.findMany({
      where: { runId: id, userId },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      select: stepSelect,
    });

    return {
      run: this.toRun(run),
      steps: steps.map((step) => this.toStep(step)),
    };
  }

  async getSummary(
    userId: string,
    query: AgentTraceSummaryQuery,
  ): Promise<AgentTraceSummaryResponse> {
    const startDate = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);
    const runs = await this.prisma.agentTraceRun.findMany({
      where: {
        userId,
        createdAt: { gte: startDate },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: runSelect,
    });
    const routeCounts = new Map<NonNullable<AgentTraceRun['route']>, number>();
    const verifierCounts = new Map<AgentTraceVerifierStatus, number>();

    let liveRuns = 0;
    let mockRuns = 0;
    let runningRuns = 0;
    let degradedRuns = 0;
    let failedRuns = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostEstimate = 0;
    let verifiedUsageRuns = 0;
    let totalVerifiedInputTokens = 0;
    let totalVerifiedOutputTokens = 0;
    let totalVerifiedCostCny = 0;

    for (const run of runs) {
      if (run.mode === 'LIVE') liveRuns += 1;
      if (run.mode === 'MOCK') mockRuns += 1;
      if (run.status === 'RUNNING') runningRuns += 1;
      if (run.status === 'DEGRADED') degradedRuns += 1;
      if (run.status === 'FAILED') failedRuns += 1;
      totalInputTokens += run.inputTokenEstimate;
      totalOutputTokens += run.outputTokenEstimate;
      totalCostEstimate += decimalToNumber(run.costEstimate);
      if (
        run.verifiedInputTokens !== null &&
        run.verifiedOutputTokens !== null &&
        run.verifiedCostCny !== null
      ) {
        verifiedUsageRuns += 1;
        totalVerifiedInputTokens += run.verifiedInputTokens;
        totalVerifiedOutputTokens += run.verifiedOutputTokens;
        totalVerifiedCostCny += decimalToNumber(run.verifiedCostCny);
      }

      if (run.route) {
        const route = run.route as NonNullable<AgentTraceRun['route']>;
        routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1);
      }

      if (run.verifierStatus) {
        const status = run.verifierStatus as AgentTraceVerifierStatus;
        verifierCounts.set(status, (verifierCounts.get(status) ?? 0) + 1);
      }
    }

    return {
      days: query.days,
      totalRuns: runs.length,
      runningRuns,
      liveRuns,
      mockRuns,
      degradedRuns,
      failedRuns,
      totalInputTokens,
      totalOutputTokens,
      totalCostEstimate: roundCost(totalCostEstimate),
      verifiedUsageRuns,
      totalVerifiedInputTokens,
      totalVerifiedOutputTokens,
      totalVerifiedCostCny: roundCost(totalVerifiedCostCny),
      lastRunAt: runs[0]?.createdAt.toISOString() ?? null,
      routeBreakdown: [...routeCounts.entries()].map(([route, count]) => ({
        route,
        count,
      })),
      verifierBreakdown: [...verifierCounts.entries()].map(
        ([status, count]) => ({
          status,
          count,
        }),
      ),
    };
  }

  private toRunWriteData(
    input: AgentTraceCreateRequest,
  ): AgentTraceRunWriteData {
    return {
      conversationId: input.conversationId ?? null,
      route: input.route ?? null,
      confidence: input.confidence,
      status: toDbStatus(input.status),
      mode: toDbMode(input.mode),
      modelProvider: input.modelProvider,
      modelName: input.modelName,
      inputTokenEstimate: input.inputTokenEstimate,
      outputTokenEstimate: input.outputTokenEstimate,
      maxOutputTokens: input.maxOutputTokens,
      pricingKnown: input.pricingKnown,
      costEstimate: input.costEstimate,
      modelCallId: null,
      firstTokenLatencyMs: null,
      finishReason: null,
      verifiedInputTokens: null,
      verifiedOutputTokens: null,
      priceProfile: null,
      verifiedCostCny: null,
      qualityAuthority: 'none',
      ragHitCount: input.ragHitCount,
      verifierStatus: input.verifierStatus ?? null,
      verifierChunkCount: input.verifierChunkCount,
      tutorIntent: input.tutorIntent ?? null,
      tutorDepth: input.tutorDepth ?? null,
      degraded: input.degraded,
      inputHash: input.inputHash,
      inputPreview: input.inputPreview
        ? truncateText(input.inputPreview.trim(), INPUT_PREVIEW_LIMIT)
        : null,
      startedAt: new Date(input.startedAt),
      finishedAt: input.finishedAt ? new Date(input.finishedAt) : null,
      totalDurationMs: input.totalDurationMs,
    };
  }

  private toRun(run: AgentTraceRunRecord): AgentTraceRun {
    const result: AgentTraceRun = {
      id: run.id,
      userId: run.userId,
      conversationId: run.conversationId,
      route: run.route as AgentTraceRun['route'],
      confidence: run.confidence,
      status: fromDbStatus(run.status),
      mode: fromDbMode(run.mode),
      modelProvider: run.modelProvider,
      modelName: run.modelName,
      inputTokenEstimate: run.inputTokenEstimate,
      outputTokenEstimate: run.outputTokenEstimate,
      maxOutputTokens: run.maxOutputTokens,
      pricingKnown: run.pricingKnown,
      costEstimate: decimalToNumber(run.costEstimate),
      modelCallId: run.modelCallId,
      firstTokenLatencyMs: run.firstTokenLatencyMs,
      finishReason: run.finishReason as AgentTraceRun['finishReason'],
      verifiedInputTokens: run.verifiedInputTokens,
      verifiedOutputTokens: run.verifiedOutputTokens,
      priceProfile: run.priceProfile,
      verifiedCostCny:
        run.verifiedCostCny === null
          ? null
          : decimalToNumber(run.verifiedCostCny),
      qualityAuthority: run.qualityAuthority as 'none',
      ragHitCount: run.ragHitCount,
      verifierChunkCount: run.verifierChunkCount,
      degraded: run.degraded,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      totalDurationMs: run.totalDurationMs,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
    };

    if (run.verifierStatus) {
      result.verifierStatus = run.verifierStatus as AgentTraceVerifierStatus;
    }
    if (run.tutorIntent) result.tutorIntent = run.tutorIntent;
    if (run.tutorDepth) result.tutorDepth = run.tutorDepth;
    if (run.inputHash) result.inputHash = run.inputHash;
    if (run.inputPreview) result.inputPreview = run.inputPreview;

    return result;
  }

  private toStep(step: AgentTraceStepRecord): AgentTraceStep {
    return {
      id: step.id,
      runId: step.runId,
      node: step.node,
      status: fromDbStatus(step.status),
      startedAt: step.startedAt.toISOString(),
      finishedAt: step.finishedAt?.toISOString() ?? null,
      durationMs: step.durationMs,
      inputSummary: step.inputSummary,
      outputSummary: step.outputSummary,
      errorMessage: step.errorMessage,
    };
  }
}

function realtimeStartMatches(
  state: RealtimeTraceState,
  input: AgentTraceRealtimeStartRequest,
): boolean {
  const run = state.detail.run;
  return (
    state.preparedAt === null &&
    state.preparationDigest === null &&
    run.status === 'running' &&
    run.modelCallId === input.modelCallId &&
    run.conversationId === input.conversationId &&
    run.mode === input.mode &&
    realtimeRunHasPlaceholderPreparationFields(run) &&
    run.degraded === false &&
    run.startedAt === new Date(input.startedAt).toISOString() &&
    run.finishedAt === null &&
    run.totalDurationMs === null &&
    run.firstTokenLatencyMs === null &&
    run.finishReason === null &&
    run.verifiedInputTokens === null &&
    run.verifiedOutputTokens === null &&
    run.priceProfile === null &&
    run.verifiedCostCny === null &&
    run.qualityAuthority === 'none' &&
    state.detail.steps.length === 0
  );
}

function toPreparationRunData(
  preparation: AgentTraceRealtimePreparation,
): Prisma.AgentTraceRunUpdateManyMutationInput {
  return {
    route: preparation.route,
    confidence: preparation.confidence,
    modelProvider: preparation.modelProvider,
    modelName: preparation.modelName,
    inputTokenEstimate: preparation.inputTokenEstimate,
    outputTokenEstimate: preparation.outputTokenEstimate,
    maxOutputTokens: preparation.maxOutputTokens,
    pricingKnown: preparation.pricingKnown,
    costEstimate: preparation.costEstimate,
    realtimePreparedAt: new Date(preparation.preparedAt),
    realtimePreparationDigest: createRealtimePreparationDigest(preparation),
    ragHitCount: preparation.ragHitCount,
    verifierStatus: preparation.verifierStatus ?? null,
    verifierChunkCount: preparation.verifierChunkCount,
    tutorIntent: preparation.tutorIntent ?? null,
    tutorDepth: preparation.tutorDepth ?? null,
    degraded: preparation.degraded,
    inputHash: null,
    inputPreview: null,
  };
}

function realtimePreparationMatches(
  state: RealtimeTraceState,
  preparation: AgentTraceRealtimePreparation,
  steps: readonly Prisma.AgentTraceStepCreateManyInput[],
): boolean {
  const run = state.detail.run;
  return (
    state.preparedAt === new Date(preparation.preparedAt).toISOString() &&
    state.preparationDigest === createRealtimePreparationDigest(preparation) &&
    run.route === preparation.route &&
    run.confidence === preparation.confidence &&
    run.modelProvider === preparation.modelProvider &&
    run.modelName === preparation.modelName &&
    run.inputTokenEstimate === preparation.inputTokenEstimate &&
    run.outputTokenEstimate === preparation.outputTokenEstimate &&
    run.maxOutputTokens === preparation.maxOutputTokens &&
    (run.status !== 'running' ||
      run.pricingKnown === preparation.pricingKnown) &&
    roundCost(run.costEstimate) === roundCost(preparation.costEstimate) &&
    run.ragHitCount === preparation.ragHitCount &&
    run.verifierStatus === preparation.verifierStatus &&
    run.verifierChunkCount === preparation.verifierChunkCount &&
    run.tutorIntent === preparation.tutorIntent &&
    run.tutorDepth === preparation.tutorDepth &&
    (run.status !== 'running' || run.degraded === preparation.degraded) &&
    run.inputHash === undefined &&
    run.inputPreview === undefined &&
    traceStepsMatch(
      state.detail.steps.filter((step) => step.node !== 'FinalResponseAgent'),
      steps,
    )
  );
}

function realtimePreparationTimelineIsValid(
  detail: AgentTraceDetailResponse,
  preparation: AgentTraceRealtimePreparation,
): boolean {
  const startedAt = Date.parse(detail.run.startedAt);
  const preparedAt = Date.parse(preparation.preparedAt);
  return (
    Number.isFinite(startedAt) &&
    Number.isFinite(preparedAt) &&
    preparedAt >= startedAt &&
    preparation.steps.every((step) => {
      const stepStartedAt = Date.parse(step.startedAt);
      const stepFinishedAt =
        step.finishedAt === null ? Number.NaN : Date.parse(step.finishedAt);
      return (
        Number.isFinite(stepStartedAt) &&
        Number.isFinite(stepFinishedAt) &&
        stepStartedAt >= startedAt &&
        stepFinishedAt >= stepStartedAt &&
        stepFinishedAt <= preparedAt
      );
    })
  );
}

function realtimeFinalizeMatches(
  state: RealtimeTraceState,
  input: AgentTraceRealtimeFinalizeRequest,
  steps: readonly Prisma.AgentTraceStepCreateManyInput[],
): boolean {
  const run = state.detail.run;
  return (
    run.status === input.status &&
    run.modelCallId === input.modelCallId &&
    run.pricingKnown === input.pricingKnown &&
    run.degraded === input.degraded &&
    run.finishedAt === new Date(input.finishedAt).toISOString() &&
    run.totalDurationMs === input.totalDurationMs &&
    run.firstTokenLatencyMs === input.firstTokenLatencyMs &&
    run.finishReason === input.finishReason &&
    run.verifiedInputTokens === input.verifiedInputTokens &&
    run.verifiedOutputTokens === input.verifiedOutputTokens &&
    run.priceProfile === input.priceProfile &&
    (run.verifiedCostCny === null
      ? input.verifiedCostCny === null
      : input.verifiedCostCny !== null &&
        roundCost(run.verifiedCostCny) === roundCost(input.verifiedCostCny)) &&
    run.qualityAuthority === input.qualityAuthority &&
    (input.preparation === undefined
      ? state.preparedAt === null &&
        state.preparationDigest === null &&
        realtimeRunHasPlaceholderPreparationFields(run)
      : realtimePreparationMatches(
          state,
          input.preparation,
          steps.filter((step) => step.node !== 'FinalResponseAgent'),
        )) &&
    traceStepsMatch(state.detail.steps, steps)
  );
}

function realtimeFinalizeCanApply(
  state: RealtimeTraceState,
  input: AgentTraceRealtimeFinalizeRequest,
): boolean {
  const run = state.detail.run;
  return (
    run.status === 'running' &&
    run.modelCallId === input.modelCallId &&
    run.finishedAt === null &&
    run.totalDurationMs === null &&
    run.firstTokenLatencyMs === null &&
    run.finishReason === null &&
    run.verifiedInputTokens === null &&
    run.verifiedOutputTokens === null &&
    run.priceProfile === null &&
    run.verifiedCostCny === null &&
    run.qualityAuthority === 'none' &&
    realtimeFinalizeTimelineIsValid(state, input) &&
    (state.preparedAt === null
      ? state.preparationDigest === null &&
        realtimeRunHasPlaceholderPreparationFields(run) &&
        state.detail.steps.length === 0 &&
        (input.preparation === undefined ||
          realtimePreparationTimelineIsValid(state.detail, input.preparation))
      : state.preparationDigest !== null &&
        input.preparation !== undefined &&
        realtimePreparationMatches(
          state,
          input.preparation,
          input.preparation.steps.map((step) => ({
            userId: run.userId,
            runId: run.id,
            node: step.node,
            status: toDbStatus(step.status),
            startedAt: new Date(step.startedAt),
            finishedAt: step.finishedAt ? new Date(step.finishedAt) : null,
            durationMs: step.durationMs,
            inputSummary: step.inputSummary,
            outputSummary: step.outputSummary,
            errorMessage: step.errorMessage,
          })),
        ))
  );
}

function realtimeFinalizeTimelineIsValid(
  state: RealtimeTraceState,
  input: AgentTraceRealtimeFinalizeRequest,
): boolean {
  const startedAt = Date.parse(state.detail.run.startedAt);
  const finishedAt = Date.parse(input.finishedAt);
  const preparedAt =
    state.preparedAt === null ? null : Date.parse(state.preparedAt);
  return (
    Number.isFinite(startedAt) &&
    Number.isFinite(finishedAt) &&
    finishedAt >= startedAt &&
    input.totalDurationMs >= finishedAt - startedAt &&
    (preparedAt === null ||
      (Number.isFinite(preparedAt) && preparedAt <= finishedAt))
  );
}

function realtimeRunHasPlaceholderPreparationFields(
  run: AgentTraceRun,
): boolean {
  return (
    run.route === null &&
    run.confidence === 0 &&
    run.modelProvider === 'pending' &&
    run.modelName === 'pending' &&
    run.inputTokenEstimate === 0 &&
    run.outputTokenEstimate === 0 &&
    run.maxOutputTokens === 0 &&
    run.costEstimate === 0 &&
    run.ragHitCount === 0 &&
    run.verifierStatus === undefined &&
    run.verifierChunkCount === 0 &&
    run.tutorIntent === undefined &&
    run.tutorDepth === undefined &&
    run.inputHash === undefined &&
    run.inputPreview === undefined
  );
}

function createRealtimePreparationDigest(
  preparation: AgentTraceRealtimePreparation,
): string {
  return createHash('sha256').update(JSON.stringify(preparation)).digest('hex');
}

function traceStepsMatch(
  actual: readonly AgentTraceStep[],
  expected: readonly Prisma.AgentTraceStepCreateManyInput[],
): boolean {
  const actualKeys = actual.map(actualTraceStepKey);
  const expectedKeys = expected.map(expectedTraceStepKey);
  actualKeys.sort();
  expectedKeys.sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((value, index) => value === expectedKeys[index])
  );
}

function actualTraceStepKey(step: AgentTraceStep): string {
  return JSON.stringify({
    node: step.node,
    status: step.status,
    startedAt: step.startedAt,
    finishedAt: step.finishedAt,
    durationMs: step.durationMs,
    inputSummary: step.inputSummary,
    outputSummary: step.outputSummary,
    errorMessage: step.errorMessage,
  });
}

function expectedTraceStepKey(
  step: Prisma.AgentTraceStepCreateManyInput,
): string {
  return JSON.stringify({
    node: step.node,
    status: fromDbStatus(step.status as PrismaAgentTraceStatus),
    startedAt: (step.startedAt as Date).toISOString(),
    finishedAt: step.finishedAt
      ? (step.finishedAt as Date).toISOString()
      : null,
    durationMs: step.durationMs ?? null,
    inputSummary: step.inputSummary,
    outputSummary: step.outputSummary,
    errorMessage: step.errorMessage ?? null,
  });
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  );
}

function toDbStatus(status: AgentTraceStatus): PrismaAgentTraceStatus {
  return status.toUpperCase() as PrismaAgentTraceStatus;
}

function fromDbStatus(status: PrismaAgentTraceStatus): AgentTraceStatus {
  return status.toLowerCase() as AgentTraceStatus;
}

function toDbMode(mode: AgentTraceMode): PrismaAgentTraceMode {
  return mode.toUpperCase() as PrismaAgentTraceMode;
}

function fromDbMode(mode: PrismaAgentTraceMode): AgentTraceMode {
  return mode.toLowerCase() as AgentTraceMode;
}

function sanitizeSummary(value: string, maxLength: number) {
  const redacted = value
    .replace(
      /\b(DEEPSEEK_API_KEY|OPENAI_API_KEY)\s*=\s*[^\s,;]+/gi,
      '$1=[redacted]',
    )
    .replace(
      /\bAuthorization\s*:\s*Bearer\s+[^\s,;]+/gi,
      'Authorization: Bearer [redacted]',
    )
    .replace(/\bCookie\s*:\s*[^\n\r]+/gi, 'Cookie: [redacted]');

  return truncateText(redacted.trim(), maxLength);
}

function truncateText(value: string, maxLength: number) {
  return Array.from(value).slice(0, maxLength).join('');
}

function decimalToNumber(
  value: Prisma.Decimal | number | { toNumber: () => number },
) {
  if (typeof value === 'number') return value;
  return value.toNumber();
}

function roundCost(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
