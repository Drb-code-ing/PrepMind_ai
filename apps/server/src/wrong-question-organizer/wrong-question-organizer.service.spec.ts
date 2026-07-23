import { WrongQuestionOrganizerService } from './wrong-question-organizer.service';
import { PrismaService } from '../database/prisma.service';
import {
  fingerprintWrongQuestionOrganizerOwnerSnapshot,
  WRONG_QUESTION_ORGANIZER_OWNER_SNAPSHOT_VERSION,
  type WrongQuestionOrganizerOwnerSnapshot,
} from './wrong-question-organizer-owner-snapshot';

const objectContaining = <T extends object>(value: T) =>
  expect.objectContaining(value) as unknown as T;

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

  const snapshotMaterial = {
    version: WRONG_QUESTION_ORGANIZER_OWNER_SNAPSHOT_VERSION,
    ownerHash: `hmac-sha256:${'a'.repeat(64)}`,
    targetWrongQuestionIds: [wrongQuestion.id],
    wrongQuestions: [
      {
        id: wrongQuestion.id,
        source: wrongQuestion.source,
        sourceRecordId: wrongQuestion.sourceRecordId,
        sourceGroupId: wrongQuestion.sourceGroupId,
        questionText: wrongQuestion.questionText,
        subject: wrongQuestion.subject,
        category: wrongQuestion.category,
        knowledgePoints: wrongQuestion.knowledgePoints,
        analysis: wrongQuestion.analysis,
        answer: wrongQuestion.answer,
        errorType: wrongQuestion.errorType,
        userNote: wrongQuestion.userNote,
        rawContent: wrongQuestion.rawContent,
        status: wrongQuestion.status,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ],
    subjectGroups: [
      {
        id: subjectGroup.id,
        subject: subjectGroup.subject,
        displayName: subjectGroup.displayName,
        sortOrder: subjectGroup.sortOrder,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ],
    decks: [
      {
        id: deck.id,
        subjectGroupId: deck.subjectGroupId,
        subject: subjectGroup.subject,
        name: deck.name,
        description: deck.description,
        source: deck.source,
        nameLocked: deck.nameLocked,
        confidence: deck.confidence,
        keywords: [KNOWLEDGE_POINT, CATEGORY, wrongQuestion.errorType],
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    ],
    items: [],
  } as const;
  const ownerSnapshot = {
    ...snapshotMaterial,
    fingerprint:
      fingerprintWrongQuestionOrganizerOwnerSnapshot(snapshotMaterial),
  } satisfies WrongQuestionOrganizerOwnerSnapshot;

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
  const config = {
    get: jest.fn().mockReturnValue('test-jwt-secret-at-least-16-bytes'),
  };
  const snapshotSource = {
    load: jest.fn(),
    revalidate: jest.fn(),
  };
  const commandExecutor = {
    execute: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    config.get.mockReturnValue('test-jwt-secret-at-least-16-bytes');
  });

  function createService() {
    return new WrongQuestionOrganizerService(
      prisma as unknown as PrismaService,
      config as never,
      snapshotSource as never,
      commandExecutor as never,
    );
  }

  function prepareOrganizerFlow(input?: {
    snapshot?: WrongQuestionOrganizerOwnerSnapshot;
    result?: unknown;
  }) {
    const snapshot = input?.snapshot ?? ownerSnapshot;
    snapshotSource.load.mockResolvedValue(snapshot);
    snapshotSource.revalidate.mockResolvedValue(true);
    commandExecutor.execute.mockResolvedValue(
      input?.result ?? {
        status: 'applied',
        entries: [
          {
            wrongQuestionId: wrongQuestion.id,
            subjectGroup,
            deck,
            item,
            createdSubjectGroup: true,
            createdDeck: true,
            createdItem: true,
            reason: item.reason ?? '',
            confidence: item.confidence,
          },
        ],
      },
    );
    prisma.$transaction.mockImplementation(
      <T>(callback: (transaction: object) => T | Promise<T>) =>
        Promise.resolve(callback({})),
    );
  }

  it('creates subject group, deck, and item for an owned wrong question', async () => {
    prepareOrganizerFlow();
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([deck]);
    prisma.wrongQuestionDeckItem.findMany.mockResolvedValue([
      {
        deck,
        deckId: deck.id,
        wrongQuestionId: wrongQuestion.id,
        wrongQuestion,
      },
    ]);

    const service = createService();
    const result = await service.organizeOne('user_1', 'wrong_1', {
      force: false,
    });

    expect(config.get).toHaveBeenCalledWith('JWT_SECRET', { infer: true });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
      maxWait: 2_000,
      timeout: 5_000,
    });
    expect(snapshotSource.load).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        userId: 'user_1',
        wrongQuestionIds: ['wrong_1'],
      }),
    );
    expect(snapshotSource.revalidate).toHaveBeenCalledTimes(2);
    expect(commandExecutor.execute).toHaveBeenCalledWith(
      objectContaining({
        userId: 'user_1',
        snapshot: ownerSnapshot,
        command: objectContaining({
          entries: [
            objectContaining({
              wrongQuestionId: 'wrong_1',
              force: false,
            }),
          ],
        }),
      }),
    );
    expect(prisma.wrongQuestionSubjectGroup.upsert).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeck.create).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.upsert).not.toHaveBeenCalled();
    expect(result.createdSubjectGroup).toBe(true);
    expect(result.createdDeck).toBe(true);
    expect(result.item.id).toBe('deck_item_1');
  });

  it('does not overwrite locked deck names when organizing again', async () => {
    const existingDeck = {
      ...deck,
      name: '我的专题',
      nameLocked: true,
    };
    const lockedMaterial = {
      ...snapshotMaterial,
      decks: [
        {
          ...snapshotMaterial.decks[0],
          name: existingDeck.name,
          nameLocked: true,
        },
      ],
    };
    const lockedSnapshot = {
      ...lockedMaterial,
      fingerprint:
        fingerprintWrongQuestionOrganizerOwnerSnapshot(lockedMaterial),
    } satisfies WrongQuestionOrganizerOwnerSnapshot;
    prepareOrganizerFlow({
      snapshot: lockedSnapshot,
      result: {
        status: 'applied',
        entries: [
          {
            wrongQuestionId: wrongQuestion.id,
            subjectGroup,
            deck: existingDeck,
            item,
            createdSubjectGroup: false,
            createdDeck: false,
            createdItem: true,
            reason: item.reason ?? '',
            confidence: item.confidence,
          },
        ],
      },
    });
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([existingDeck]);
    prisma.wrongQuestionDeckItem.findMany.mockResolvedValue([
      {
        deck: existingDeck,
        deckId: existingDeck.id,
        wrongQuestionId: wrongQuestion.id,
        wrongQuestion,
      },
    ]);

    const service = createService();
    await service.organizeOne('user_1', 'wrong_1', { force: false });

    expect(commandExecutor.execute).toHaveBeenCalledWith(
      objectContaining({
        command: objectContaining({
          entries: [
            objectContaining({
              deck: { action: 'reuse', id: existingDeck.id },
            }),
          ],
        }),
      }),
    );
    expect(prisma.wrongQuestionDeck.update).not.toHaveBeenCalledWith(
      objectContaining({
        data: objectContaining({ name: KNOWLEDGE_POINT }),
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
    prisma.wrongQuestion.findMany.mockResolvedValue([
      { id: 'wrong_1' },
      { id: 'wrong_2' },
    ]);
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
    expect(organizeOne).toHaveBeenNthCalledWith(1, 'user_1', 'wrong_1', {
      force: false,
    });
    expect(organizeOne).toHaveBeenNthCalledWith(2, 'user_1', 'wrong_2', {
      force: false,
    });
    expect(result).toMatchObject({
      organizedCount: 2,
      skippedCount: 0,
      items: [organizeResponse, organizeResponse],
    });
  });

  it('returns an existing organization without creating another item when force is false', async () => {
    const existingDeck = {
      ...deck,
      id: 'deck_existing',
      name: '用户整理专题',
      subjectGroup,
    };
    const existingItem = {
      ...item,
      id: 'deck_item_existing',
      deckId: existingDeck.id,
      reason: '用户已经整理过。',
      confidence: 0.42,
      source: 'USER' as const,
      deck: existingDeck,
    };
    prepareOrganizerFlow({
      result: {
        status: 'authority',
        entries: [{ wrongQuestionId: wrongQuestion.id, item: existingItem }],
      },
    });
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([existingDeck]);
    prisma.wrongQuestionDeckItem.findMany.mockResolvedValue([
      {
        deck: existingDeck,
        deckId: existingDeck.id,
        wrongQuestionId: wrongQuestion.id,
        wrongQuestion,
      },
    ]);

    const service = createService();
    const result = await service.organizeOne('user_1', 'wrong_1', {
      force: false,
    });

    expect(commandExecutor.execute).toHaveBeenCalledTimes(1);
    expect(snapshotSource.revalidate).toHaveBeenCalledTimes(2);
    expect(prisma.wrongQuestionSubjectGroup.upsert).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeck.create).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.upsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      createdSubjectGroup: false,
      createdDeck: false,
      createdItem: false,
      reason: '用户已经整理过。',
      confidence: 0.42,
      item: {
        id: 'deck_item_existing',
        deckId: 'deck_existing',
        source: 'USER',
      },
      deck: {
        id: 'deck_existing',
      },
    });
  });

  it('passes force through the frozen command while direct service writes remain disabled', async () => {
    const targetItem = {
      ...item,
      id: 'deck_item_target',
      deckId: deck.id,
    };
    prepareOrganizerFlow({
      result: {
        status: 'applied',
        entries: [
          {
            wrongQuestionId: wrongQuestion.id,
            subjectGroup,
            deck,
            item: targetItem,
            createdSubjectGroup: false,
            createdDeck: false,
            createdItem: true,
            reason: targetItem.reason ?? '',
            confidence: targetItem.confidence,
          },
        ],
      },
    });
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([deck]);
    prisma.wrongQuestionDeckItem.findMany.mockResolvedValue([
      {
        deck,
        deckId: deck.id,
        wrongQuestionId: wrongQuestion.id,
        wrongQuestion,
      },
    ]);

    const service = createService();
    const result = await service.organizeOne('user_1', 'wrong_1', {
      force: true,
    });

    expect(commandExecutor.execute).toHaveBeenCalledWith(
      objectContaining({
        command: objectContaining({
          entries: [objectContaining({ force: true })],
        }),
      }),
    );
    expect(prisma.wrongQuestionDeckItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.upsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      createdItem: true,
      item: { id: 'deck_item_target', deckId: deck.id },
      deck: { id: deck.id },
    });
  });

  it('drops a stale post-decision command and rebuilds a fresh local snapshot once', async () => {
    prepareOrganizerFlow();
    snapshotSource.revalidate
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([deck]);
    prisma.wrongQuestionDeckItem.findMany.mockResolvedValue([
      {
        deck,
        deckId: deck.id,
        wrongQuestionId: wrongQuestion.id,
        wrongQuestion,
      },
    ]);

    const service = createService();
    await expect(
      service.organizeOne('user_1', wrongQuestion.id, { force: false }),
    ).resolves.toMatchObject({ item: { id: item.id } });

    expect(snapshotSource.load).toHaveBeenCalledTimes(2);
    expect(snapshotSource.revalidate).toHaveBeenCalledTimes(4);
    expect(commandExecutor.execute).toHaveBeenCalledTimes(1);
  });

  it('moves an owned wrong question to an owned deck', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      wrongQuestionDeck: {
        findFirst: jest.fn().mockResolvedValue({ id: 'deck_1' }),
      },
      wrongQuestion: {
        findFirst: jest.fn().mockResolvedValue({ id: 'wrong_1' }),
      },
      wrongQuestionDeckItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        upsert: jest.fn().mockResolvedValue({
          ...item,
          source: 'USER',
          confidence: 1,
          reason: '用户手动归入专题。',
        }),
      },
    };

    prisma.$transaction.mockImplementation(
      <T>(callback: (transaction: typeof tx) => T | Promise<T>) =>
        Promise.resolve(callback(tx)),
    );

    const service = createService();
    const result = await service.moveToDeck('user_1', 'deck_1', {
      wrongQuestionId: 'wrong_1',
      source: 'USER',
    });

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.wrongQuestionDeck.findFirst).toHaveBeenCalledWith({
      where: { id: 'deck_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(tx.wrongQuestion.findFirst).toHaveBeenCalledWith({
      where: { id: 'wrong_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
      maxWait: 2_000,
      timeout: 5_000,
    });
    expect(tx.wrongQuestionDeckItem.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        wrongQuestionId: 'wrong_1',
        deckId: { not: 'deck_1' },
      },
    });
    expect(tx.wrongQuestionDeckItem.upsert).toHaveBeenCalledWith({
      where: {
        userId_wrongQuestionId: {
          userId: 'user_1',
          wrongQuestionId: 'wrong_1',
        },
      },
      update: { deckId: 'deck_1', source: 'USER' },
      create: {
        userId: 'user_1',
        deckId: 'deck_1',
        wrongQuestionId: 'wrong_1',
        source: 'USER',
        confidence: 1,
        reason: '用户手动归入专题。',
      },
    });
    expect(prisma.wrongQuestionDeckItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.upsert).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      deckId: 'deck_1',
      wrongQuestionId: 'wrong_1',
      source: 'USER',
    });
  });

  it('rejects moveToDeck when the target deck is not owned by the current user', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      wrongQuestionDeck: { findFirst: jest.fn().mockResolvedValue(null) },
      wrongQuestion: { findFirst: jest.fn() },
      wrongQuestionDeckItem: { deleteMany: jest.fn(), upsert: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      <T>(callback: (transaction: typeof tx) => T | Promise<T>) =>
        Promise.resolve(callback(tx)),
    );

    const service = createService();

    await expect(
      service.moveToDeck('user_2', 'deck_1', {
        wrongQuestionId: 'wrong_1',
        source: 'USER',
      }),
    ).rejects.toMatchObject({ code: 'WRONG_QUESTION_DECK_NOT_FOUND' });
    expect(tx.wrongQuestion.findFirst).not.toHaveBeenCalled();
    expect(tx.wrongQuestionDeckItem.deleteMany).not.toHaveBeenCalled();
    expect(tx.wrongQuestionDeckItem.upsert).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.wrongQuestionDeckItem.upsert).not.toHaveBeenCalled();
  });

  it('removes only the deck item relation for the current user', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(0),
      wrongQuestionDeck: {
        findFirst: jest.fn().mockResolvedValue({ id: 'deck_1' }),
      },
      wrongQuestionDeckItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(
      <T>(callback: (transaction: typeof tx) => T | Promise<T>) =>
        Promise.resolve(callback(tx)),
    );

    const service = createService();
    const result = await service.removeDeckItem('user_1', 'deck_1', 'wrong_1');

    expect(tx.wrongQuestionDeck.findFirst).toHaveBeenCalledWith({
      where: { id: 'deck_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(tx.wrongQuestionDeckItem.deleteMany).toHaveBeenCalledWith({
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

  it('uses compact stats selects and does not double count duplicate group questions', async () => {
    const duplicateDeck = {
      ...deck,
      id: 'deck_2',
    };

    prisma.wrongQuestionSubjectGroup.findMany.mockResolvedValue([subjectGroup]);
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([deck, duplicateDeck]);
    prisma.wrongQuestionDeckItem.findMany.mockResolvedValue([
      {
        deck,
        deckId: deck.id,
        wrongQuestionId: wrongQuestion.id,
        wrongQuestion,
      },
      {
        deck: duplicateDeck,
        deckId: duplicateDeck.id,
        wrongQuestionId: wrongQuestion.id,
        wrongQuestion,
      },
    ]);

    const service = createService();
    const result = await service.listGroups('user_1');

    expect(prisma.wrongQuestionDeck.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        subjectGroupId: { in: [subjectGroup.id] },
      },
      select: {
        id: true,
        subjectGroupId: true,
      },
    });
    expect(prisma.wrongQuestionDeckItem.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        deck: {
          subjectGroupId: { in: [subjectGroup.id] },
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
    expect(result.items[0]).toMatchObject({
      deckCount: 2,
      totalCount: 1,
      unresolvedCount: 1,
      resolvedCount: 0,
    });
  });
});
