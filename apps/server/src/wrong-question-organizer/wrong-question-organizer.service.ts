import { HttpStatus, Injectable } from '@nestjs/common';
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
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WrongQuestionOrganizerService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroups(userId: string): Promise<WrongQuestionGroupListResponse> {
    const groups = await this.prisma.wrongQuestionSubjectGroup.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });

    if (groups.length === 0) {
      return { items: [] };
    }

    const stats = await this.loadGroupStats(userId, groups.map((group) => group.id));

    return {
      items: groups.map((group) => this.toSubjectGroupResponse(group, stats.groups.get(group.id))),
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
      subjectGroup: this.toSubjectGroupResponse(subjectGroup, stats.groups.get(subjectGroup.id)),
      items: decks.map((deck) => this.toDeckResponse(deck, stats.decks.get(deck.id))),
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
      items: items.map((item) => this.toWrongQuestionResponse(item.wrongQuestion)),
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
    const wrongQuestion = await this.prisma.wrongQuestion.findFirst({
      where: { id: wrongQuestionId, userId },
    });

    if (!wrongQuestion) {
      throw this.wrongQuestionNotFound();
    }

    if (!input.force) {
      const existingItem = await this.prisma.wrongQuestionDeckItem.findFirst({
        where: { userId, wrongQuestionId },
        include: {
          deck: {
            include: { subjectGroup: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (existingItem) {
        const stats = await this.loadGroupStats(userId, [
          existingItem.deck.subjectGroupId,
        ]);

        return {
          subjectGroup: this.toSubjectGroupResponse(
            existingItem.deck.subjectGroup,
            stats.groups.get(existingItem.deck.subjectGroupId),
          ),
          deck: this.toDeckResponse(
            existingItem.deck,
            stats.decks.get(existingItem.deckId),
          ),
          item: this.toDeckItemResponse(existingItem),
          createdSubjectGroup: false,
          createdDeck: false,
          createdItem: false,
          reason: existingItem.reason ?? '',
          confidence: existingItem.confidence,
        };
      }
    }

    const firstPass = organizeWrongQuestion({
      wrongQuestion,
      existingDecks: [],
    });
    const existingSubjectGroup =
      await this.prisma.wrongQuestionSubjectGroup.findFirst({
        where: { userId, subject: firstPass.subjectKey },
        select: { id: true },
      });
    const subjectGroup = await this.prisma.wrongQuestionSubjectGroup.upsert({
      where: {
        userId_subject: {
          userId,
          subject: firstPass.subjectKey,
        },
      },
      update: { displayName: firstPass.subjectDisplayName },
      create: {
        userId,
        subject: firstPass.subjectKey,
        displayName: firstPass.subjectDisplayName,
      },
    });

    const existingDecks = await this.prisma.wrongQuestionDeck.findMany({
      where: { userId, subjectGroupId: subjectGroup.id },
      include: {
        items: {
          include: {
            wrongQuestion: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const policy = organizeWrongQuestion({
      wrongQuestion,
      existingDecks: existingDecks.map((deck) => ({
        id: deck.id,
        name: deck.name,
        nameLocked: deck.nameLocked,
        keywords: this.collectDeckKeywords(deck),
      })),
    });
    const matchedDeck = policy.matchedDeckId
      ? existingDecks.find((deck) => deck.id === policy.matchedDeckId)
      : undefined;
    const deck =
      matchedDeck ??
      (await this.prisma.wrongQuestionDeck.create({
        data: {
          userId,
          subjectGroupId: subjectGroup.id,
          name: policy.deckName,
          description: policy.deckDescription,
          source: 'AI',
          nameLocked: false,
          confidence: policy.confidence,
        },
      }));
    const existingItem = await this.prisma.wrongQuestionDeckItem.findFirst({
      where: { userId, deckId: deck.id, wrongQuestionId },
      select: { id: true },
    });
    const upsertDeckItemArgs: Prisma.WrongQuestionDeckItemUpsertArgs = {
      where: {
        userId_wrongQuestionId: {
          userId,
          wrongQuestionId,
        },
      },
      update: {
        deckId: deck.id,
        reason: policy.reason,
        confidence: policy.confidence,
        source: 'AI',
      },
      create: {
        userId,
        deckId: deck.id,
        wrongQuestionId,
        reason: policy.reason,
        confidence: policy.confidence,
        source: 'AI',
      },
    };
    const item = input.force
      ? await this.prisma.$transaction(async (tx) => {
          await tx.wrongQuestionDeckItem.deleteMany({
            where: {
              userId,
              wrongQuestionId,
              deckId: { not: deck.id },
            },
          });

          return tx.wrongQuestionDeckItem.upsert(upsertDeckItemArgs);
        })
      : await this.prisma.wrongQuestionDeckItem.upsert(upsertDeckItemArgs);
    const stats = await this.loadGroupStats(userId, [subjectGroup.id]);

    return {
      subjectGroup: this.toSubjectGroupResponse(subjectGroup, stats.groups.get(subjectGroup.id)),
      deck: this.toDeckResponse(deck, stats.decks.get(deck.id)),
      item: this.toDeckItemResponse(item),
      createdSubjectGroup: !existingSubjectGroup,
      createdDeck: !matchedDeck,
      createdItem: !existingItem,
      reason: policy.reason,
      confidence: policy.confidence,
    };
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
      items.push(await this.organizeOne(userId, wrongQuestion.id, { force: false }));
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
    const existing = await this.prisma.wrongQuestionDeck.findFirst({
      where: { id: deckId, userId },
    });

    if (!existing) {
      throw this.deckNotFound();
    }

    const deck = await this.prisma.wrongQuestionDeck.update({
      where: { id: deckId },
      data: {
        ...input,
        source: 'USER',
      },
    });
    const stats = await this.loadGroupStats(userId, [deck.subjectGroupId]);

    return this.toDeckResponse(deck, stats.decks.get(deck.id));
  }

  async moveToDeck(
    userId: string,
    deckId: string,
    input: MoveWrongQuestionToDeckRequest,
  ): Promise<WrongQuestionDeckItemResponse> {
    const deck = await this.prisma.wrongQuestionDeck.findFirst({
      where: { id: deckId, userId },
      select: { id: true },
    });

    if (!deck) {
      throw this.deckNotFound();
    }

    const wrongQuestion = await this.prisma.wrongQuestion.findFirst({
      where: { id: input.wrongQuestionId, userId },
      select: { id: true },
    });

    if (!wrongQuestion) {
      throw this.wrongQuestionNotFound();
    }

    const item = await this.prisma.$transaction(async (tx) => {
      await tx.wrongQuestionDeckItem.deleteMany({
        where: {
          userId,
          wrongQuestionId: input.wrongQuestionId,
          deckId: { not: deckId },
        },
      });

      return tx.wrongQuestionDeckItem.upsert({
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
    });

    return this.toDeckItemResponse(item);
  }

  async removeDeckItem(
    userId: string,
    deckId: string,
    wrongQuestionId: string,
  ): Promise<{ ok: true }> {
    const deck = await this.prisma.wrongQuestionDeck.findFirst({
      where: { id: deckId, userId },
      select: { id: true },
    });

    if (!deck) {
      throw this.deckNotFound();
    }

    await this.prisma.wrongQuestionDeckItem.deleteMany({
      where: { userId, deckId, wrongQuestionId },
    });

    return { ok: true };
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
      const groupStat = getOrCreateCountStats(stats.groups, deck.subjectGroupId);

      groupStat.deckIds.add(deck.id);
      getOrCreateCountStats(stats.decks, deck.id);
    }

    for (const item of items) {
      const groupStat = getOrCreateCountStats(stats.groups, item.deck.subjectGroupId);
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

  private collectDeckKeywords(deck: DeckWithQuestionItems): string[] {
    return uniqueStrings(
      (deck.items ?? []).flatMap((item) => [
        ...item.wrongQuestion.knowledgePoints,
        item.wrongQuestion.category,
        item.wrongQuestion.errorType,
      ]),
    );
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

  private toDeckItemResponse(item: WrongQuestionDeckItemRecord): WrongQuestionDeckItemResponse {
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

  private toWrongQuestionResponse(item: WrongQuestionRecord): WrongQuestionResponse {
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

function getOrCreateCountStats(map: Map<string, CountStats>, key: string): CountStats {
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
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(([point]) => point);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))] as string[];
}

type WrongQuestionRecord = Prisma.WrongQuestionGetPayload<object>;
type StatsWrongQuestionRecord = Pick<
  WrongQuestionRecord,
  'id' | 'status' | 'knowledgePoints' | 'updatedAt'
>;
type WrongQuestionSubjectGroupRecord = Prisma.WrongQuestionSubjectGroupGetPayload<object>;
type WrongQuestionDeckRecord = Prisma.WrongQuestionDeckGetPayload<object>;
type WrongQuestionDeckItemRecord = Prisma.WrongQuestionDeckItemGetPayload<object>;
type DeckWithQuestionItems = Prisma.WrongQuestionDeckGetPayload<{
  include: {
    items: {
      include: {
        wrongQuestion: true;
      };
    };
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
