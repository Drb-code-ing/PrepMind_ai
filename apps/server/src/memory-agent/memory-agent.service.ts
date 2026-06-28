import { createHash } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { analyzeMemory, type MemoryAgentInput } from '@repo/agent/memory';
import type {
  AcceptMemoryCandidateResponse,
  GenerateMemoryCandidatesRequest,
  GenerateMemoryCandidatesResponse,
  MemoryCandidate,
  MemoryCandidateListQuery,
  RejectMemoryCandidateResponse,
  UpdateUserMemoryRequest,
  UserMemory,
  UserMemoryListQuery,
  UserMemoryListResponse,
} from '@repo/types/api/memory-agent';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const SIGNAL_WINDOW_DAYS = 60;
const MAX_CREATED_CANDIDATES = 5;

const candidateSelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  content: true,
  reason: true,
  evidence: true,
  confidence: true,
  status: true,
  sourceHash: true,
  acceptedMemoryId: true,
  createdAt: true,
  updatedAt: true,
  decidedAt: true,
} satisfies Prisma.UserMemoryCandidateSelect;

const memorySelect = {
  id: true,
  userId: true,
  type: true,
  title: true,
  content: true,
  status: true,
  sourceCandidateId: true,
  confidence: true,
  lastUsedAt: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserMemorySelect;

type MemoryPrismaClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class MemoryAgentService {
  constructor(private readonly prisma: PrismaService) {}

  async listCandidates(
    userId: string,
    query: MemoryCandidateListQuery,
  ): Promise<{ items: MemoryCandidate[] }> {
    const candidates = await this.prisma.userMemoryCandidate.findMany({
      where: {
        userId,
        status: query.status,
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
      select: candidateSelect,
    });

    return {
      items: candidates.map((candidate) => this.toCandidate(candidate)),
    };
  }

  async generateCandidates(
    userId: string,
    input: GenerateMemoryCandidatesRequest,
  ): Promise<GenerateMemoryCandidatesResponse> {
    const now = new Date();
    const pendingCandidateLimit = input.force ? 50 : 20;
    const agentInput = await this.buildAgentInput(userId, now);
    const result = analyzeMemory(agentInput);
    const drafts = result.candidates.slice(0, MAX_CREATED_CANDIDATES);
    const createResult =
      drafts.length > 0
        ? await this.prisma.userMemoryCandidate.createMany({
            data: drafts.map((draft) => ({
              userId,
              type: draft.type,
              title: draft.title,
              content: draft.content,
              reason: draft.reason,
              evidence: draft.evidence,
              confidence: draft.confidence,
              status: 'PENDING',
              sourceHash: this.createSourceHash(userId, draft),
            })),
            skipDuplicates: true,
          })
        : { count: 0 };

    const candidates = await this.prisma.userMemoryCandidate.findMany({
      where: { userId, status: 'PENDING' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: pendingCandidateLimit,
      select: candidateSelect,
    });

    return {
      generatedAt: now.toISOString(),
      createdCount: createResult.count,
      candidates: candidates.map((candidate) => this.toCandidate(candidate)),
      summary:
        createResult.count > 0
          ? `已生成 ${createResult.count} 条学习记忆候选，请确认后再启用。`
          : '暂时没有新的长期记忆候选。',
    };
  }

  async acceptCandidate(
    userId: string,
    candidateId: string,
  ): Promise<AcceptMemoryCandidateResponse> {
    const { candidate, memory } = await this.prisma.$transaction(async (tx) => {
      const existing = await this.findOwnedCandidate(userId, candidateId, tx);

      if (existing.status === 'ACCEPTED' && existing.acceptedMemoryId) {
        const acceptedMemory = await this.findOwnedMemory(
          userId,
          existing.acceptedMemoryId,
          tx,
        );
        return { candidate: existing, memory: acceptedMemory };
      }

      if (existing.status !== 'PENDING') {
        throw this.candidateAlreadyDecided();
      }

      const claimed = await tx.userMemoryCandidate.updateMany({
        where: { id: existing.id, userId, status: 'PENDING' },
        data: {
          status: 'ACCEPTED',
          decidedAt: new Date(),
        },
      });

      if (claimed.count === 0) {
        return this.resolveAlreadyDecidedAccept(userId, candidateId, tx);
      }

      const createdMemory = await tx.userMemory.upsert({
        where: { sourceCandidateId: existing.id },
        update: {},
        create: {
          userId,
          type: existing.type,
          title: existing.title,
          content: existing.content,
          status: 'ACTIVE',
          sourceCandidateId: existing.id,
          confidence: existing.confidence,
        },
        select: memorySelect,
      });
      const updatedCandidate = await tx.userMemoryCandidate.update({
        where: { id: existing.id },
        data: {
          acceptedMemoryId: createdMemory.id,
        },
        select: candidateSelect,
      });

      return { candidate: updatedCandidate, memory: createdMemory };
    });

    return {
      candidate: this.toCandidate(candidate),
      memory: this.toMemory(memory),
    };
  }

  async rejectCandidate(
    userId: string,
    candidateId: string,
  ): Promise<RejectMemoryCandidateResponse> {
    const claimed = await this.prisma.userMemoryCandidate.updateMany({
      where: { id: candidateId, userId, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        decidedAt: new Date(),
      },
    });
    const candidate = await this.findOwnedCandidate(userId, candidateId);

    if (claimed.count === 0 && candidate.status === 'PENDING') {
      throw this.candidateAlreadyDecided();
    }

    return { candidate: this.toCandidate(candidate) };
  }

  async listMemories(
    userId: string,
    query: UserMemoryListQuery,
  ): Promise<UserMemoryListResponse> {
    const where: Prisma.UserMemoryWhereInput = { userId };
    if (query.status !== 'all') where.status = query.status;
    if (query.type) where.type = query.type;

    const memories = await this.prisma.userMemory.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      select: memorySelect,
    });

    return { items: memories.map((memory) => this.toMemory(memory)) };
  }

  async updateMemory(
    userId: string,
    memoryId: string,
    input: UpdateUserMemoryRequest,
  ): Promise<UserMemory> {
    await this.findOwnedMemory(userId, memoryId);
    const data: Prisma.UserMemoryUpdateInput = {};

    if (input.title !== undefined) data.title = input.title;
    if (input.content !== undefined) data.content = input.content;
    if (input.status !== undefined) {
      data.status = input.status;
      data.archivedAt = input.status === 'ARCHIVED' ? new Date() : null;
    }

    const memory = await this.prisma.userMemory.update({
      where: { id: memoryId },
      data,
      select: memorySelect,
    });

    return this.toMemory(memory);
  }

  async deleteMemory(userId: string, memoryId: string): Promise<{ ok: true }> {
    const result = await this.prisma.userMemory.deleteMany({
      where: { id: memoryId, userId },
    });

    if (result.count === 0) {
      throw this.memoryNotFound();
    }

    return { ok: true };
  }

  private async resolveAlreadyDecidedAccept(
    userId: string,
    candidateId: string,
    tx: Prisma.TransactionClient,
  ) {
    const candidate = await this.findOwnedCandidate(userId, candidateId, tx);

    if (candidate.status === 'ACCEPTED' && candidate.acceptedMemoryId) {
      const memory = await this.findOwnedMemory(
        userId,
        candidate.acceptedMemoryId,
        tx,
      );
      return { candidate, memory };
    }

    throw this.candidateAlreadyDecided();
  }

  private async buildAgentInput(
    userId: string,
    now: Date,
  ): Promise<MemoryAgentInput> {
    const since = new Date(
      now.getTime() - SIGNAL_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const [messages, cards, logs, preference, existingMemories] =
      await Promise.all([
        this.prisma.chatMessage.findMany({
          where: {
            userId,
            role: 'USER',
            createdAt: { gte: since },
          },
          select: {
            id: true,
            conversationId: true,
            content: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        this.prisma.card.findMany({
          where: { userId, suspendedAt: null },
          select: {
            difficulty: true,
            stability: true,
            wrongQuestion: {
              select: {
                subject: true,
                knowledgePoints: true,
              },
            },
          },
        }),
        this.prisma.reviewLog.findMany({
          where: {
            reviewedAt: { gte: since },
            card: { userId },
          },
          select: {
            rating: true,
            reviewedAt: true,
            card: {
              select: {
                wrongQuestion: {
                  select: {
                    subject: true,
                    knowledgePoints: true,
                  },
                },
              },
            },
          },
          orderBy: { reviewedAt: 'desc' },
          take: 200,
        }),
        this.prisma.reviewPreference.findUnique({
          where: { userId },
          select: {
            dailyMinutes: true,
            preferredReviewTime: true,
            updatedAt: true,
          },
        }),
        this.prisma.userMemory.findMany({
          where: { userId, status: 'ACTIVE' },
          select: {
            type: true,
            content: true,
          },
        }),
      ]);

    return {
      now: now.toISOString(),
      recentChatSignals: messages
        .filter((message) => this.isPreferenceLikeMessage(message.content))
        .map((message) => ({
          conversationId: message.conversationId,
          messageId: message.id,
          text: message.content,
          createdAt: message.createdAt.toISOString(),
        })),
      weakPointSignals: this.buildWeakPointSignals(cards, logs),
      reviewSignals: {
        consecutiveActiveDays: this.countConsecutiveActiveDays(logs, now),
        totalReviewsInWindow: logs.length,
        preferredReviewTime: preference?.preferredReviewTime,
      },
      existingMemories,
    };
  }

  private buildWeakPointSignals(
    cards: readonly CardSignal[],
    logs: readonly ReviewLogSignal[],
  ) {
    const aggregates = new Map<string, WeakPointAggregate>();

    for (const card of cards) {
      const wrongQuestion = card.wrongQuestion;
      if (!wrongQuestion) continue;

      for (const label of this.normalizeLabels(wrongQuestion.knowledgePoints)) {
        const aggregate = this.getWeakPointAggregate(aggregates, label);
        aggregate.wrongCount += 1;
        aggregate.subject ??= wrongQuestion.subject;
      }
    }

    for (const log of logs) {
      if (log.rating !== 1) continue;

      const wrongQuestion = log.card.wrongQuestion;
      if (!wrongQuestion) continue;

      for (const label of this.normalizeLabels(wrongQuestion.knowledgePoints)) {
        const aggregate = this.getWeakPointAggregate(aggregates, label);
        aggregate.recentAgainCount += 1;
        aggregate.subject ??= wrongQuestion.subject;
      }
    }

    return [...aggregates.values()].sort(
      (left, right) =>
        right.recentAgainCount - left.recentAgainCount ||
        right.wrongCount - left.wrongCount ||
        left.label.localeCompare(right.label, 'zh-Hans-CN'),
    );
  }

  private getWeakPointAggregate(
    aggregates: Map<string, WeakPointAggregate>,
    label: string,
  ) {
    const existing = aggregates.get(label);
    if (existing) return existing;

    const created: WeakPointAggregate = {
      label,
      wrongCount: 0,
      recentAgainCount: 0,
    };
    aggregates.set(label, created);
    return created;
  }

  private normalizeLabels(labels: readonly string[]) {
    return [
      ...new Set(
        labels.map((label) => label.trim()).filter((label) => label.length > 0),
      ),
    ];
  }

  private countConsecutiveActiveDays(
    logs: readonly ReviewLogSignal[],
    now: Date,
  ) {
    const activeDates = new Set(
      logs.map((log) => log.reviewedAt.toISOString().slice(0, 10)),
    );
    let count = 0;

    for (let dayOffset = 0; dayOffset < SIGNAL_WINDOW_DAYS; dayOffset += 1) {
      const dateKey = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      if (!activeDates.has(dateKey)) break;
      count += 1;
    }

    return count;
  }

  private async findOwnedCandidate(
    userId: string,
    candidateId: string,
    client: MemoryPrismaClient = this.prisma,
  ) {
    const candidate = await client.userMemoryCandidate.findFirst({
      where: { id: candidateId, userId },
      select: candidateSelect,
    });

    if (!candidate) {
      throw new AppError(
        'MEMORY_CANDIDATE_NOT_FOUND',
        '记忆候选不存在',
        HttpStatus.NOT_FOUND,
      );
    }

    return candidate;
  }

  private async findOwnedMemory(
    userId: string,
    memoryId: string,
    client: MemoryPrismaClient = this.prisma,
  ) {
    const memory = await client.userMemory.findFirst({
      where: { id: memoryId, userId },
      select: memorySelect,
    });

    if (!memory) {
      throw this.memoryNotFound();
    }

    return memory;
  }

  private memoryNotFound() {
    return new AppError(
      'USER_MEMORY_NOT_FOUND',
      '学习记忆不存在',
      HttpStatus.NOT_FOUND,
    );
  }

  private candidateAlreadyDecided() {
    return new AppError(
      'MEMORY_CANDIDATE_ALREADY_DECIDED',
      '该记忆候选已处理',
      HttpStatus.CONFLICT,
    );
  }

  private createSourceHash(
    userId: string,
    draft: {
      type: string;
      content: string;
      evidence: Array<{ summary: string }>;
    },
  ) {
    const source = [
      userId,
      draft.type,
      this.normalizeText(draft.content),
      draft.evidence.map((item) => this.normalizeText(item.summary)).join('|'),
    ].join('|');

    return `sha256:${createHash('sha256').update(source).digest('hex')}`;
  }

  private normalizeText(value: string) {
    return value.replace(/\s+/g, '').toLowerCase();
  }

  private isPreferenceLikeMessage(value: string) {
    return /以后|下次|总是|先.*提示|不要直接|苏格拉底|详细/.test(value);
  }

  private toCandidate(candidate: CandidateRecord): MemoryCandidate {
    return {
      id: candidate.id,
      userId: candidate.userId,
      type: candidate.type,
      title: candidate.title,
      content: candidate.content,
      reason: candidate.reason,
      evidence: candidate.evidence as MemoryCandidate['evidence'],
      confidence: candidate.confidence,
      status: candidate.status,
      createdAt: candidate.createdAt.toISOString(),
      updatedAt: candidate.updatedAt.toISOString(),
      decidedAt: candidate.decidedAt?.toISOString() ?? null,
    };
  }

  private toMemory(memory: MemoryRecord): UserMemory {
    return {
      id: memory.id,
      userId: memory.userId,
      type: memory.type,
      title: memory.title,
      content: memory.content,
      status: memory.status,
      confidence: memory.confidence,
      lastUsedAt: memory.lastUsedAt?.toISOString() ?? null,
      archivedAt: memory.archivedAt?.toISOString() ?? null,
      createdAt: memory.createdAt.toISOString(),
      updatedAt: memory.updatedAt.toISOString(),
    };
  }
}

type CandidateRecord = Prisma.UserMemoryCandidateGetPayload<{
  select: typeof candidateSelect;
}>;

type MemoryRecord = Prisma.UserMemoryGetPayload<{
  select: typeof memorySelect;
}>;

type CardSignal = Prisma.CardGetPayload<{
  select: {
    difficulty: true;
    stability: true;
    wrongQuestion: {
      select: {
        subject: true;
        knowledgePoints: true;
      };
    };
  };
}>;

type ReviewLogSignal = Prisma.ReviewLogGetPayload<{
  select: {
    rating: true;
    reviewedAt: true;
    card: {
      select: {
        wrongQuestion: {
          select: {
            subject: true;
            knowledgePoints: true;
          };
        };
      };
    };
  };
}>;

type WeakPointAggregate = {
  label: string;
  subject?: string;
  wrongCount: number;
  recentAgainCount: number;
};
