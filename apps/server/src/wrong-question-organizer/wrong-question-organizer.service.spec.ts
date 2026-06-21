import { WrongQuestionOrganizerService } from './wrong-question-organizer.service';
import { PrismaService } from '../database/prisma.service';

const NOW = new Date('2026-06-21T00:00:00.000Z');
const SUBJECT = '高等数学';
const CATEGORY = '曲线积分';
const KNOWLEDGE_POINT = '格林公式';

describe('WrongQuestionOrganizerService', () => {
  const wrongQuestion = {
    id: 'wrong_1',
    userId: 'user_1',
    source: 'OCR' as const,
    sourceRecordId: null,
    sourceGroupId: null,
    imageUrl: null,
    questionText: '计算闭合曲线积分。',
    subject: SUBJECT,
    category: CATEGORY,
    knowledgePoints: [KNOWLEDGE_POINT],
    analysis: '使用格林公式。',
    answer: '12',
    errorType: '概念混淆',
    userNote: null,
    rawContent: null,
    status: 'UNRESOLVED' as const,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const subjectGroup = {
    id: 'subject_group_1',
    userId: 'user_1',
    subject: SUBJECT,
    displayName: SUBJECT,
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const deck = {
    id: 'deck_1',
    userId: 'user_1',
    subjectGroupId: 'subject_group_1',
    name: KNOWLEDGE_POINT,
    description: '用于整理高等数学中的格林公式相关错题。',
    source: 'AI' as const,
    nameLocked: false,
    confidence: 0.86,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const item = {
    id: 'deck_item_1',
    userId: 'user_1',
    deckId: 'deck_1',
    wrongQuestionId: 'wrong_1',
    reason: '根据知识点归入「格林公式」。',
    confidence: 0.86,
    source: 'AI' as const,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const organizeResponse = {
    subjectGroup: {
      id: subjectGroup.id,
      userId: subjectGroup.userId,
      subject: subjectGroup.subject,
      displayName: subjectGroup.displayName,
      sortOrder: subjectGroup.sortOrder,
      totalCount: 1,
      unresolvedCount: 1,
      resolvedCount: 0,
      deckCount: 1,
      topKnowledgePoints: [KNOWLEDGE_POINT],
      lastUpdatedAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    deck: {
      id: deck.id,
      userId: deck.userId,
      subjectGroupId: deck.subjectGroupId,
      name: deck.name,
      description: deck.description,
      source: deck.source,
      nameLocked: deck.nameLocked,
      confidence: deck.confidence,
      totalCount: 1,
      unresolvedCount: 1,
      resolvedCount: 0,
      topKnowledgePoints: [KNOWLEDGE_POINT],
      lastUpdatedAt: NOW.toISOString(),
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    item: {
      id: item.id,
      deckId: item.deckId,
      wrongQuestionId: item.wrongQuestionId,
      reason: item.reason,
      confidence: item.confidence,
      source: item.source,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
    createdSubjectGroup: false,
    createdDeck: false,
    createdItem: false,
    reason: item.reason,
    confidence: item.confidence,
  };

  const prisma = {
    $transaction: jest.fn(),
    wrongQuestion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
    wrongQuestionSubjectGroup: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    wrongQuestionDeck: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    wrongQuestionDeckItem: {
      findFirst: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  function createService() {
    return new WrongQuestionOrganizerService(prisma as unknown as PrismaService);
  }

  it('creates subject group, deck, and item for an owned wrong question', async () => {
    prisma.wrongQuestion.findFirst.mockResolvedValue(wrongQuestion);
    prisma.wrongQuestionSubjectGroup.findFirst.mockResolvedValue(null);
    prisma.wrongQuestionSubjectGroup.upsert.mockResolvedValue(subjectGroup);
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([]);
    prisma.wrongQuestionDeck.create.mockResolvedValue(deck);
    prisma.wrongQuestionDeckItem.findFirst.mockResolvedValue(null);
    prisma.wrongQuestionDeckItem.upsert.mockResolvedValue(item);
    prisma.wrongQuestionDeckItem.findMany.mockResolvedValue([{ deck, wrongQuestion }]);

    const service = createService();
    const result = await service.organizeOne('user_1', 'wrong_1', { force: false });

    expect(prisma.wrongQuestion.findFirst).toHaveBeenCalledWith({
      where: { id: 'wrong_1', userId: 'user_1' },
    });
    expect(prisma.wrongQuestionSubjectGroup.upsert).toHaveBeenCalledWith({
      where: { userId_subject: { userId: 'user_1', subject: SUBJECT } },
      update: { displayName: SUBJECT },
      create: {
        userId: 'user_1',
        subject: SUBJECT,
        displayName: SUBJECT,
      },
    });
    expect(prisma.wrongQuestionDeck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user_1',
        subjectGroupId: 'subject_group_1',
        name: KNOWLEDGE_POINT,
        source: 'AI',
        nameLocked: false,
      }),
    });
    expect(prisma.wrongQuestionDeckItem.upsert).toHaveBeenCalledWith({
      where: {
        deckId_wrongQuestionId: {
          deckId: 'deck_1',
          wrongQuestionId: 'wrong_1',
        },
      },
      update: expect.objectContaining({
        reason: expect.any(String),
        confidence: expect.any(Number),
        source: 'AI',
      }),
      create: expect.objectContaining({
        userId: 'user_1',
        deckId: 'deck_1',
        wrongQuestionId: 'wrong_1',
        source: 'AI',
      }),
    });
    expect(result.createdSubjectGroup).toBe(true);
    expect(result.createdDeck).toBe(true);
    expect(result.item.id).toBe('deck_item_1');
  });

  it('does not overwrite locked deck names when organizing again', async () => {
    const existingDeck = {
      ...deck,
      name: '我的专题',
      nameLocked: true,
      items: [{ wrongQuestion }],
    };

    prisma.wrongQuestion.findFirst.mockResolvedValue(wrongQuestion);
    prisma.wrongQuestionSubjectGroup.findFirst.mockResolvedValue({ id: subjectGroup.id });
    prisma.wrongQuestionSubjectGroup.upsert.mockResolvedValue(subjectGroup);
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([existingDeck]);
    prisma.wrongQuestionDeckItem.findFirst.mockResolvedValue({ id: item.id });
    prisma.wrongQuestionDeckItem.upsert.mockResolvedValue({
      ...item,
      deckId: existingDeck.id,
    });
    prisma.wrongQuestionDeckItem.findMany.mockResolvedValue([
      { deck: existingDeck, wrongQuestion },
    ]);

    const service = createService();
    await service.organizeOne('user_1', 'wrong_1', { force: false });

    expect(prisma.wrongQuestionDeck.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: KNOWLEDGE_POINT }),
      }),
    );
  });

  it('counts empty decks for subject groups without changing question totals', async () => {
    prisma.wrongQuestionSubjectGroup.findMany.mockResolvedValue([subjectGroup]);
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([deck]);
    prisma.wrongQuestionDeckItem.findMany.mockResolvedValue([]);

    const service = createService();
    const result = await service.listGroups('user_1');

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: subjectGroup.id,
      deckCount: 1,
      totalCount: 0,
      unresolvedCount: 0,
      resolvedCount: 0,
      topKnowledgePoints: [],
    });
  });

  it('returns an empty group list when no organization data exists', async () => {
    prisma.wrongQuestionSubjectGroup.findMany.mockResolvedValue([]);

    const service = createService();
    const result = await service.listGroups('user_1');

    expect(result).toEqual({ items: [] });
    expect(prisma.wrongQuestionSubjectGroup.findMany).toHaveBeenCalledWith({
      where: { userId: 'user_1' },
      orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }],
    });
    expect(prisma.wrongQuestionDeck.findMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.findMany).not.toHaveBeenCalled();
  });

  it('organizes only current user wrong questions without deck items up to the limit', async () => {
    prisma.wrongQuestion.findMany.mockResolvedValue([{ id: 'wrong_1' }, { id: 'wrong_2' }]);
    const service = createService();
    const organizeOne = jest
      .spyOn(service, 'organizeOne')
      .mockResolvedValue(organizeResponse);

    const result = await service.organizeBatch('user_1', { limit: 2 });

    expect(prisma.wrongQuestion.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        deckItems: { none: {} },
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
      select: { id: true },
    });
    expect(organizeOne).toHaveBeenCalledTimes(2);
    expect(organizeOne).toHaveBeenNthCalledWith(1, 'user_1', 'wrong_1', { force: false });
    expect(organizeOne).toHaveBeenNthCalledWith(2, 'user_1', 'wrong_2', { force: false });
    expect(result).toMatchObject({
      organizedCount: 2,
      skippedCount: 0,
      items: [organizeResponse, organizeResponse],
    });
  });

  it('moves an owned wrong question to an owned deck', async () => {
    prisma.wrongQuestionDeck.findFirst.mockResolvedValue({ id: 'deck_1' });
    prisma.wrongQuestion.findFirst.mockResolvedValue({ id: 'wrong_1' });
    prisma.wrongQuestionDeckItem.deleteMany.mockResolvedValue({ count: 1 });
    prisma.wrongQuestionDeckItem.upsert.mockResolvedValue({
      ...item,
      source: 'USER',
      confidence: 1,
      reason: '用户手动归入专题。',
    });

    const service = createService();
    const result = await service.moveToDeck('user_1', 'deck_1', {
      wrongQuestionId: 'wrong_1',
      source: 'USER',
    });

    expect(prisma.wrongQuestionDeck.findFirst).toHaveBeenCalledWith({
      where: { id: 'deck_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(prisma.wrongQuestion.findFirst).toHaveBeenCalledWith({
      where: { id: 'wrong_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(prisma.wrongQuestionDeckItem.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        wrongQuestionId: 'wrong_1',
        deckId: { not: 'deck_1' },
      },
    });
    expect(prisma.wrongQuestionDeckItem.upsert).toHaveBeenCalledWith({
      where: {
        deckId_wrongQuestionId: {
          deckId: 'deck_1',
          wrongQuestionId: 'wrong_1',
        },
      },
      update: { source: 'USER' },
      create: {
        userId: 'user_1',
        deckId: 'deck_1',
        wrongQuestionId: 'wrong_1',
        source: 'USER',
        confidence: 1,
        reason: '用户手动归入专题。',
      },
    });
    expect(result).toMatchObject({
      deckId: 'deck_1',
      wrongQuestionId: 'wrong_1',
      source: 'USER',
    });
  });

  it('rejects moveToDeck when the target deck is not owned by the current user', async () => {
    prisma.wrongQuestionDeck.findFirst.mockResolvedValue(null);

    const service = createService();

    await expect(
      service.moveToDeck('user_2', 'deck_1', {
        wrongQuestionId: 'wrong_1',
        source: 'USER',
      }),
    ).rejects.toMatchObject({ code: 'WRONG_QUESTION_DECK_NOT_FOUND' });
    expect(prisma.wrongQuestion.findFirst).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.upsert).not.toHaveBeenCalled();
  });

  it('removes only the deck item relation for the current user', async () => {
    prisma.wrongQuestionDeck.findFirst.mockResolvedValue({ id: 'deck_1' });
    prisma.wrongQuestionDeckItem.deleteMany.mockResolvedValue({ count: 1 });

    const service = createService();
    const result = await service.removeDeckItem('user_1', 'deck_1', 'wrong_1');

    expect(prisma.wrongQuestionDeck.findFirst).toHaveBeenCalledWith({
      where: { id: 'deck_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(prisma.wrongQuestionDeckItem.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        deckId: 'deck_1',
        wrongQuestionId: 'wrong_1',
      },
    });
    expect(prisma.wrongQuestion.delete).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeck.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it('lists deck questions with pagination and deck statistics', async () => {
    const newerDate = new Date('2026-06-22T00:00:00.000Z');
    const resolvedWrongQuestion = {
      ...wrongQuestion,
      id: 'wrong_2',
      status: 'RESOLVED' as const,
      knowledgePoints: [KNOWLEDGE_POINT, 'Stokes'],
      updatedAt: newerDate,
    };
    const secondItem = {
      ...item,
      id: 'deck_item_2',
      wrongQuestionId: 'wrong_2',
      wrongQuestion: resolvedWrongQuestion,
    };

    prisma.wrongQuestionDeck.findFirst.mockResolvedValue(deck);
    prisma.wrongQuestionDeckItem.findMany
      .mockImplementationOnce(() => 'deckQuestionsQuery')
      .mockImplementationOnce(() =>
        Promise.resolve([
          { deck, deckId: deck.id, wrongQuestion },
          { deck, deckId: deck.id, wrongQuestion: resolvedWrongQuestion },
        ]),
      );
    prisma.wrongQuestionDeckItem.count.mockReturnValue('countQuery');
    prisma.$transaction.mockResolvedValue([[secondItem], 2]);
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([deck]);

    const service = createService();
    const result = await service.listDeckQuestions('user_1', 'deck_1', {
      page: 2,
      pageSize: 1,
    });

    expect(prisma.wrongQuestionDeck.findFirst).toHaveBeenCalledWith({
      where: { id: 'deck_1', userId: 'user_1' },
    });
    expect(prisma.wrongQuestionDeckItem.findMany).toHaveBeenNthCalledWith(1, {
      where: { userId: 'user_1', deckId: 'deck_1' },
      include: { wrongQuestion: true },
      orderBy: { createdAt: 'asc' },
      skip: 1,
      take: 1,
    });
    expect(prisma.wrongQuestionDeckItem.count).toHaveBeenCalledWith({
      where: { userId: 'user_1', deckId: 'deck_1' },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith([
      'deckQuestionsQuery',
      'countQuery',
    ]);
    expect(result).toMatchObject({
      total: 2,
      page: 2,
      pageSize: 1,
      items: [{ id: 'wrong_2', status: 'RESOLVED' }],
      deck: {
        id: 'deck_1',
        totalCount: 2,
        unresolvedCount: 1,
        resolvedCount: 1,
        lastUpdatedAt: newerDate.toISOString(),
      },
    });
    expect(result.deck.topKnowledgePoints).toContain(KNOWLEDGE_POINT);
  });
});
