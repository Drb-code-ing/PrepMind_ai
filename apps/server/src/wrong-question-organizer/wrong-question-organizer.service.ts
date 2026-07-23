import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { organizeWrongQuestion } from '@repo/agent/wrong-question-organizer';
import { Prisma } from '@prisma/client';
import type {
  MoveWrongQuestionToDeckRequest,
  OrganizeWrongQuestionBatchRequest,
  OrganizeWrongQuestionBatchResponse,
  OrganizeWrongQuestionRequest,
  OrganizeWrongQuestionResponse,
  UpdateWrongQuestionDeckRequest,
  WrongQuestionDeckItemResponse,
  WrongQuestionDeckListResponse,
  WrongQuestionDeckQuestionListQuery,
  WrongQuestionDeckQuestionListResponse,
  WrongQuestionDeckResponse,
  WrongQuestionGroupListResponse,
  WrongQuestionSubjectGroupResponse,
} from '@repo/types/api/wrong-question-organizer';
import type { WrongQuestionResponse } from '@repo/types/api/wrong-question';

import { AppError } from '../common/errors/app-error';
import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import {
  buildWrongQuestionOrganizerCommand,
  WrongQuestionOrganizerCommandExecutor,
  type WrongQuestionOrganizerCommandResult,
} from './wrong-question-organizer-command';
import {
  hashWrongQuestionOrganizerOwner,
  type WrongQuestionOrganizerOwnerSnapshot,
  WrongQuestionOrganizerOwnerSnapshotSource,
} from './wrong-question-organizer-owner-snapshot';

const SNAPSHOT_TRANSACTION_MAX_WAIT_MS = 2_000;
const SNAPSHOT_TRANSACTION_TIMEOUT_MS = 5_000;
const MAX_LOCAL_STALE_ATTEMPTS = 2;
const MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS = 3;

@Injectable()
export class WrongQuestionOrganizerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ServerEnv, true>,
    private readonly snapshotSource: WrongQuestionOrganizerOwnerSnapshotSource,
    private readonly commandExecutor: WrongQuestionOrganizerCommandExecutor,
  ) {}

  async listGroups(userId: string): Promise<WrongQuestionGroupListResponse> {
    const groups = await this.prisma.wrongQuestionSubjectGroup.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });

    if (groups.length === 0) {
      return { items: [] };
    }

    const stats = await this.loadGroupStats(
      userId,
      groups.map((group) => group.id),
    );

    return {
      items: groups.map((group) =>
        this.toSubjectGroupResponse(group, stats.groups.get(group.id)),
      ),
    };
  }

  async listDecks(
    userId: string,
    subjectGroupId: string,
  ): Promise<WrongQuestionDeckListResponse> {
    const subjectGroup = await this.prisma.wrongQuestionSubjectGroup.findFirst({
      where: { id: subjectGroupId, userId },
    });

    if (!subjectGroup) {
      throw this.subjectGroupNotFound();
    }

    const decks = await this.prisma.wrongQuestionDeck.findMany({
      where: { userId, subjectGroupId },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'asc' }],
    });
    const stats = await this.loadGroupStats(userId, [subjectGroupId]);

    return {
      subjectGroup: this.toSubjectGroupResponse(
        subjectGroup,
        stats.groups.get(subjectGroup.id),
      ),
      items: decks.map((deck) =>
        this.toDeckResponse(deck, stats.decks.get(deck.id)),
      ),
    };
  }

  async listDeckQuestions(
    userId: string,
    deckId: string,
    query: WrongQuestionDeckQuestionListQuery,
  ): Promise<WrongQuestionDeckQuestionListResponse> {
    const deck = await this.prisma.wrongQuestionDeck.findFirst({
      where: { id: deckId, userId },
    });

    if (!deck) {
      throw this.deckNotFound();
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.wrongQuestionDeckItem.findMany({
        where: { userId, deckId },
        include: { wrongQuestion: true },
        orderBy: { createdAt: 'asc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.wrongQuestionDeckItem.count({ where: { userId, deckId } }),
    ]);
    const stats = await this.loadGroupStats(userId, [deck.subjectGroupId]);

    return {
      deck: this.toDeckResponse(deck, stats.decks.get(deck.id)),
      items: items.map((item) =>
        this.toWrongQuestionResponse(item.wrongQuestion),
      ),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async organizeOne(
    userId: string,
    wrongQuestionId: string,
    input: OrganizeWrongQuestionRequest,
  ): Promise<OrganizeWrongQuestionResponse> {
    const ownerHashSecret = this.config.get('JWT_SECRET', { infer: true });

    for (let attempt = 1; attempt <= MAX_LOCAL_STALE_ATTEMPTS; attempt += 1) {
      const snapshot = await this.prisma.$transaction(
        (transaction) =>
          this.snapshotSource.load(transaction, {
            userId,
            ownerHashSecret,
            wrongQuestionIds: [wrongQuestionId],
          }),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
          maxWait: SNAPSHOT_TRANSACTION_MAX_WAIT_MS,
          timeout: SNAPSHOT_TRANSACTION_TIMEOUT_MS,
        },
      );

      const freshBeforeDecision = await this.snapshotSource.revalidate(
        this.prisma,
        {
          userId,
          ownerHashSecret,
          snapshot,
        },
      );
      if (!freshBeforeDecision) continue;

      const policy = this.organizerDecision(snapshot, wrongQuestionId);

      // Task 6 has no provider dispatch. Keeping the post-decision fence here makes
      // the later Task 7 candidate insertion unable to bypass the write boundary.
      const freshAfterDecision = await this.snapshotSource.revalidate(
        this.prisma,
        {
          userId,
          ownerHashSecret,
          snapshot,
        },
      );
      if (!freshAfterDecision) continue;

      const command = buildWrongQuestionOrganizerCommand({
        snapshot,
        decisions: [
          {
            wrongQuestionId,
            force: input.force,
            result: policy,
          },
        ],
      });
      if (!command) continue;

      const result = await this.commandExecutor.execute({
        userId,
        ownerHashSecret,
        snapshot,
        command,
      });
      const response = await this.commandResultToResponse(
        userId,
        wrongQuestionId,
        result,
      );
      if (response) return response;
    }

    const authority = await this.loadExistingOrganization(
      userId,
      wrongQuestionId,
    );
    if (authority) return this.authorityToResponse(userId, authority);
    throw new AppError(
      'WRONG_QUESTION_ORGANIZER_STALE',
      '错题整理依据已变化，请重试',
      HttpStatus.CONFLICT,
    );
  }

  async organizeBatch(
    userId: string,
    input: OrganizeWrongQuestionBatchRequest,
  ): Promise<OrganizeWrongQuestionBatchResponse> {
    const wrongQuestions = await this.prisma.wrongQuestion.findMany({
      where: {
        userId,
        deckItems: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
      take: input.limit,
      select: { id: true },
    });
    const items: OrganizeWrongQuestionResponse[] = [];

    for (const wrongQuestion of wrongQuestions) {
      items.push(
        await this.organizeOne(userId, wrongQuestion.id, { force: false }),
      );
    }

    return {
      organizedCount: items.length,
      skippedCount: 0,
      items,
    };
  }

  async updateDeck(
    userId: string,
    deckId: string,
    input: UpdateWrongQuestionDeckRequest,
  ): Promise<WrongQuestionDeckResponse> {
    const deck = await this.runOwnerWriteTransaction(
      userId,
      async (transaction) => {
        const existing = await transaction.wrongQuestionDeck.findFirst({
          where: { id: deckId, userId },
        });
        if (!existing) throw this.deckNotFound();

        return transaction.wrongQuestionDeck.update({
          where: { id: deckId },
          data: { ...input, source: 'USER' },
        });
      },
    );
    const stats = await this.loadGroupStats(userId, [deck.subjectGroupId]);

    return this.toDeckResponse(deck, stats.decks.get(deck.id));
  }

  async moveToDeck(
    userId: string,
    deckId: string,
    input: MoveWrongQuestionToDeckRequest,
  ): Promise<WrongQuestionDeckItemResponse> {
    const item = await this.runOwnerWriteTransaction(
      userId,
      async (transaction) => {
        const deck = await transaction.wrongQuestionDeck.findFirst({
          where: { id: deckId, userId },
          select: { id: true },
        });
        if (!deck) throw this.deckNotFound();

        const wrongQuestion = await transaction.wrongQuestion.findFirst({
          where: { id: input.wrongQuestionId, userId },
          select: { id: true },
        });
        if (!wrongQuestion) throw this.wrongQuestionNotFound();

        await transaction.wrongQuestionDeckItem.deleteMany({
          where: {
            userId,
            wrongQuestionId: input.wrongQuestionId,
            deckId: { not: deckId },
          },
        });

        return transaction.wrongQuestionDeckItem.upsert({
          where: {
            userId_wrongQuestionId: {
              userId,
              wrongQuestionId: input.wrongQuestionId,
            },
          },
          update: {
            deckId,
            source: input.source,
          },
          create: {
            userId,
            deckId,
            wrongQuestionId: input.wrongQuestionId,
            source: input.source,
            confidence: 1,
            reason: '用户手动归入专题。',
          },
        });
      },
    );

    return this.toDeckItemResponse(item);
  }

  async removeDeckItem(
    userId: string,
    deckId: string,
    wrongQuestionId: string,
  ): Promise<{ ok: true }> {
    await this.runOwnerWriteTransaction(userId, async (transaction) => {
      const deck = await transaction.wrongQuestionDeck.findFirst({
        where: { id: deckId, userId },
        select: { id: true },
      });
      if (!deck) throw this.deckNotFound();

      await transaction.wrongQuestionDeckItem.deleteMany({
        where: { userId, deckId, wrongQuestionId },
      });
    });

    return { ok: true };
  }

  private organizerDecision(
    snapshot: WrongQuestionOrganizerOwnerSnapshot,
    wrongQuestionId: string,
  ) {
    const wrongQuestion = snapshot.wrongQuestions.find(
      ({ id }) => id === wrongQuestionId,
    );
    if (!wrongQuestion) throw this.wrongQuestionNotFound();

    const firstPass = organizeWrongQuestion({
      wrongQuestion,
      existingDecks: [],
    });
    const existingDecks = snapshot.decks
      .filter(({ subject }) => subject === firstPass.subjectKey)
      .map((deck) => ({
        id: deck.id,
        name: deck.name,
        nameLocked: deck.nameLocked,
        keywords: deck.keywords,
      }));
    return organizeWrongQuestion({ wrongQuestion, existingDecks });
  }

  private async runOwnerWriteTransaction<T>(
    userId: string,
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    const ownerHash = hashWrongQuestionOrganizerOwner(
      userId,
      this.config.get('JWT_SECRET', { infer: true }),
    );
    const run = () =>
      this.prisma.$transaction(
        async (transaction) => {
          await transaction.$executeRaw`
            SELECT pg_advisory_xact_lock(
              hashtextextended(${ownerHash}, 0)
            )
          `;
          return callback(transaction);
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: SNAPSHOT_TRANSACTION_MAX_WAIT_MS,
          timeout: SNAPSHOT_TRANSACTION_TIMEOUT_MS,
        },
      );

    for (
      let attempt = 1;
      attempt <= MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS;
      attempt += 1
    ) {
      try {
        return await run();
      } catch (error) {
        if (
          attempt === MAX_SERIALIZABLE_TRANSACTION_ATTEMPTS ||
          !isRetryableSerializableTransactionError(error)
        ) {
          throw error;
        }
      }
    }
    throw new Error('WRONG_QUESTION_ORGANIZER_TRANSACTION_RETRY_EXHAUSTED');
  }

  private async commandResultToResponse(
    userId: string,
    wrongQuestionId: string,
    result: WrongQuestionOrganizerCommandResult,
  ): Promise<OrganizeWrongQuestionResponse | null> {
    if (result.status === 'stale') return null;
    if (result.status === 'authority') {
      const entry = result.entries.find(
        (candidate) => candidate.wrongQuestionId === wrongQuestionId,
      );
      if (!entry) return null;
      return this.authorityToResponse(userId, entry.item);
    }

    const entry = result.entries.find(
      (candidate) => candidate.wrongQuestionId === wrongQuestionId,
    );
    if (!entry) return null;
    const stats = await this.loadGroupStats(userId, [entry.subjectGroup.id]);
    return {
      subjectGroup: this.toSubjectGroupResponse(
        entry.subjectGroup,
        stats.groups.get(entry.subjectGroup.id),
      ),
      deck: this.toDeckResponse(entry.deck, stats.decks.get(entry.deck.id)),
      item: this.toDeckItemResponse(entry.item),
      createdSubjectGroup: entry.createdSubjectGroup,
      createdDeck: entry.createdDeck,
      createdItem: entry.createdItem,
      reason: entry.reason,
      confidence: entry.confidence,
    };
  }

  private async loadExistingOrganization(
    userId: string,
    wrongQuestionId: string,
  ): Promise<OrganizerAuthorityItem | null> {
    return this.prisma.wrongQuestionDeckItem.findFirst({
      where: { userId, wrongQuestionId },
      include: { deck: { include: { subjectGroup: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async authorityToResponse(
    userId: string,
    item: OrganizerAuthorityItem,
  ): Promise<OrganizeWrongQuestionResponse> {
    const stats = await this.loadGroupStats(userId, [item.deck.subjectGroupId]);
    return {
      subjectGroup: this.toSubjectGroupResponse(
        item.deck.subjectGroup,
        stats.groups.get(item.deck.subjectGroupId),
      ),
      deck: this.toDeckResponse(item.deck, stats.decks.get(item.deckId)),
      item: this.toDeckItemResponse(item),
      createdSubjectGroup: false,
      createdDeck: false,
      createdItem: false,
      reason: item.reason ?? '',
      confidence: item.confidence,
    };
  }

  private async loadGroupStats(userId: string, subjectGroupIds: string[]) {
    const stats: OrganizerStats = {
      groups: new Map(),
      decks: new Map(),
    };

    if (subjectGroupIds.length === 0) {
      return stats;
    }

    const decks = await this.prisma.wrongQuestionDeck.findMany({
      where: {
        userId,
        subjectGroupId: { in: subjectGroupIds },
      },
      select: {
        id: true,
        subjectGroupId: true,
      },
    });
    const items = await this.prisma.wrongQuestionDeckItem.findMany({
      where: {
        userId,
        deck: {
          subjectGroupId: { in: subjectGroupIds },
        },
      },
      select: {
        deckId: true,
        wrongQuestionId: true,
        deck: {
          select: {
            subjectGroupId: true,
          },
        },
        wrongQuestion: {
          select: {
            id: true,
            status: true,
            knowledgePoints: true,
            updatedAt: true,
          },
        },
      },
    });

    for (const deck of decks) {
      const groupStat = getOrCreateCountStats(
        stats.groups,
        deck.subjectGroupId,
      );

      groupStat.deckIds.add(deck.id);
      getOrCreateCountStats(stats.decks, deck.id);
    }

    for (const item of items) {
      const groupStat = getOrCreateCountStats(
        stats.groups,
        item.deck.subjectGroupId,
      );
      const deckStat = getOrCreateCountStats(stats.decks, item.deckId);

      groupStat.deckIds.add(item.deckId);
      deckStat.deckIds.add(item.deckId);
      if (!groupStat.questionIds.has(item.wrongQuestionId)) {
        groupStat.questionIds.add(item.wrongQuestionId);
        applyQuestionToStats(groupStat, item.wrongQuestion);
      }
      deckStat.questionIds.add(item.wrongQuestionId);
      applyQuestionToStats(deckStat, item.wrongQuestion);
    }

    return stats;
  }

  private toSubjectGroupResponse(
    group: WrongQuestionSubjectGroupRecord,
    stats: CountStats = emptyStats(),
  ): WrongQuestionSubjectGroupResponse {
    return {
      id: group.id,
      userId: group.userId,
      subject: group.subject,
      displayName: group.displayName,
      sortOrder: group.sortOrder,
      totalCount: stats.totalCount,
      unresolvedCount: stats.unresolvedCount,
      resolvedCount: stats.resolvedCount,
      deckCount: stats.deckIds.size,
      topKnowledgePoints: topKnowledgePoints(stats.knowledgePoints),
      lastUpdatedAt: stats.lastUpdatedAt?.toISOString() ?? null,
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  private toDeckResponse(
    deck: WrongQuestionDeckRecord,
    stats: CountStats = emptyStats(),
  ): WrongQuestionDeckResponse {
    return {
      id: deck.id,
      userId: deck.userId,
      subjectGroupId: deck.subjectGroupId,
      name: deck.name,
      description: deck.description,
      source: deck.source,
      nameLocked: deck.nameLocked,
      confidence: deck.confidence,
      totalCount: stats.totalCount,
      unresolvedCount: stats.unresolvedCount,
      resolvedCount: stats.resolvedCount,
      topKnowledgePoints: topKnowledgePoints(stats.knowledgePoints),
      lastUpdatedAt: stats.lastUpdatedAt?.toISOString() ?? null,
      createdAt: deck.createdAt.toISOString(),
      updatedAt: deck.updatedAt.toISOString(),
    };
  }

  private toDeckItemResponse(
    item: WrongQuestionDeckItemRecord,
  ): WrongQuestionDeckItemResponse {
    return {
      id: item.id,
      deckId: item.deckId,
      wrongQuestionId: item.wrongQuestionId,
      reason: item.reason,
      confidence: item.confidence,
      source: item.source,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private toWrongQuestionResponse(
    item: WrongQuestionRecord,
  ): WrongQuestionResponse {
    return {
      id: item.id,
      userId: item.userId,
      source: item.source,
      sourceRecordId: item.sourceRecordId,
      sourceGroupId: item.sourceGroupId,
      imageUrl: item.imageUrl,
      questionText: item.questionText,
      subject: item.subject,
      category: item.category,
      knowledgePoints: item.knowledgePoints,
      analysis: item.analysis,
      answer: item.answer,
      errorType: item.errorType,
      userNote: item.userNote,
      rawContent: item.rawContent,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private wrongQuestionNotFound(): AppError {
    return new AppError(
      'WRONG_QUESTION_NOT_FOUND',
      '错题不存在',
      HttpStatus.NOT_FOUND,
    );
  }

  private subjectGroupNotFound(): AppError {
    return new AppError(
      'WRONG_QUESTION_SUBJECT_GROUP_NOT_FOUND',
      '错题学科分组不存在',
      HttpStatus.NOT_FOUND,
    );
  }

  private deckNotFound(): AppError {
    return new AppError(
      'WRONG_QUESTION_DECK_NOT_FOUND',
      '错题专题不存在',
      HttpStatus.NOT_FOUND,
    );
  }
}

function getOrCreateCountStats(
  map: Map<string, CountStats>,
  key: string,
): CountStats {
  const existing = map.get(key);

  if (existing) {
    return existing;
  }

  const created = emptyStats();
  map.set(key, created);
  return created;
}

function applyQuestionToStats(
  stats: CountStats,
  wrongQuestion: StatsWrongQuestionRecord,
): void {
  stats.totalCount += 1;
  if (wrongQuestion.status === 'RESOLVED') {
    stats.resolvedCount += 1;
  } else {
    stats.unresolvedCount += 1;
  }
  stats.lastUpdatedAt = maxDate(stats.lastUpdatedAt, wrongQuestion.updatedAt);

  for (const point of wrongQuestion.knowledgePoints) {
    const normalized = point.trim();
    if (normalized) {
      stats.knowledgePoints.set(
        normalized,
        (stats.knowledgePoints.get(normalized) ?? 0) + 1,
      );
    }
  }
}

function emptyStats(): CountStats {
  return {
    totalCount: 0,
    unresolvedCount: 0,
    resolvedCount: 0,
    deckIds: new Set(),
    questionIds: new Set(),
    knowledgePoints: new Map(),
    lastUpdatedAt: null,
  };
}

function maxDate(left: Date | null, right: Date): Date {
  if (!left || right.getTime() > left.getTime()) {
    return right;
  }

  return left;
}

function topKnowledgePoints(points: Map<string, number>) {
  return [...points.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, 5)
    .map(([point]) => point);
}

type WrongQuestionRecord = Prisma.WrongQuestionGetPayload<object>;
type StatsWrongQuestionRecord = Pick<
  WrongQuestionRecord,
  'id' | 'status' | 'knowledgePoints' | 'updatedAt'
>;
type WrongQuestionSubjectGroupRecord =
  Prisma.WrongQuestionSubjectGroupGetPayload<object>;
type WrongQuestionDeckRecord = Prisma.WrongQuestionDeckGetPayload<object>;
type WrongQuestionDeckItemRecord =
  Prisma.WrongQuestionDeckItemGetPayload<object>;
type OrganizerAuthorityItem = Prisma.WrongQuestionDeckItemGetPayload<{
  include: {
    deck: { include: { subjectGroup: true } };
  };
}>;

type CountStats = {
  totalCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  deckIds: Set<string>;
  questionIds: Set<string>;
  knowledgePoints: Map<string, number>;
  lastUpdatedAt: Date | null;
};

type OrganizerStats = {
  groups: Map<string, CountStats>;
  decks: Map<string, CountStats>;
};

function isRetryableSerializableTransactionError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2034';
  }
  if (typeof error !== 'object' || error === null) return false;
  const code = (error as { code?: unknown }).code;
  return code === '40001' || code === 'P2034';
}
