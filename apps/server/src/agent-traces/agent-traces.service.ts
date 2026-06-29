import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AgentTraceMode as PrismaAgentTraceMode,
  AgentTraceStatus as PrismaAgentTraceStatus,
  Prisma,
} from '@prisma/client';
import type {
  AgentTraceCreateRequest,
  AgentTraceDetailResponse,
  AgentTraceListQuery,
  AgentTraceListResponse,
  AgentTraceMode,
  AgentTraceRun,
  AgentTraceStatus,
  AgentTraceStep,
  AgentTraceSummaryQuery,
  AgentTraceSummaryResponse,
  AgentTraceVerifierStatus,
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

    const result = await this.prisma.$transaction(async (tx) => {
      const run = await tx.agentTraceRun.upsert({
        where: {
          id_userId: {
            id: runId,
            userId,
          },
        },
        create: {
          id: runId,
          userId,
          ...runData,
        },
        update: runData,
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

    return {
      run: this.toRun(result.run),
      steps: result.steps.map((step) => this.toStep(step)),
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
    let degradedRuns = 0;
    let failedRuns = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCostEstimate = 0;

    for (const run of runs) {
      if (run.mode === 'LIVE') liveRuns += 1;
      if (run.mode === 'MOCK') mockRuns += 1;
      if (run.status === 'DEGRADED') degradedRuns += 1;
      if (run.status === 'FAILED') failedRuns += 1;
      totalInputTokens += run.inputTokenEstimate;
      totalOutputTokens += run.outputTokenEstimate;
      totalCostEstimate += decimalToNumber(run.costEstimate);

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
      liveRuns,
      mockRuns,
      degradedRuns,
      failedRuns,
      totalInputTokens,
      totalOutputTokens,
      totalCostEstimate: roundCost(totalCostEstimate),
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
