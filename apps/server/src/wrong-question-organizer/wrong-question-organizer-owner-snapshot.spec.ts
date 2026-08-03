import {
  WRONG_QUESTION_ORGANIZER_OWNER_SNAPSHOT_VERSION,
  WrongQuestionOrganizerOwnerSnapshotSource,
} from './wrong-question-organizer-owner-snapshot';

const NOW = new Date('2026-07-23T00:00:00.000Z');
const OWNER_SECRET = 'snapshot-secret-at-least-16-bytes';

describe('WrongQuestionOrganizerOwnerSnapshotSource', () => {
  const wrongQuestion = {
    id: 'wrong_1',
    source: 'OCR' as const,
    sourceRecordId: null,
    sourceGroupId: null,
    questionText: '计算闭合曲线积分。',
    subject: '高等数学',
    category: '曲线积分',
    knowledgePoints: ['格林公式'],
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
    id: 'group_1',
    subject: '高等数学',
    displayName: '高等数学',
    sortOrder: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
  const deck = {
    id: 'deck_1',
    subjectGroupId: 'group_1',
    name: '格林公式',
    description: '用于整理格林公式错题。',
    source: 'AI' as const,
    nameLocked: false,
    confidence: 0.86,
    createdAt: NOW,
    updatedAt: NOW,
    subjectGroup: { subject: '高等数学' },
    items: [
      {
        id: 'deck_item_keyword_1',
        createdAt: NOW,
        wrongQuestion: {
          knowledgePoints: ['格林公式'],
          category: '曲线积分',
          errorType: '概念混淆',
          updatedAt: NOW,
        },
      },
    ],
  };

  function createPrisma(
    input: {
      wrongQuestions?: unknown[];
      groups?: unknown[];
      decks?: unknown[];
      items?: unknown[];
    } = {},
  ) {
    return {
      $executeRawUnsafe: jest.fn().mockResolvedValue(0),
      wrongQuestion: {
        findMany: jest
          .fn()
          .mockResolvedValue(input.wrongQuestions ?? [wrongQuestion]),
      },
      wrongQuestionDeckItem: {
        findMany: jest.fn().mockResolvedValue(input.items ?? []),
      },
      wrongQuestionSubjectGroup: {
        findMany: jest.fn().mockResolvedValue(input.groups ?? [subjectGroup]),
      },
      wrongQuestionDeck: {
        findMany: jest.fn().mockResolvedValue(input.decks ?? [deck]),
      },
    };
  }

  it('loads one bounded owner-scoped read-only snapshot with a domain-separated HMAC', async () => {
    const prisma = createPrisma();
    const source = new WrongQuestionOrganizerOwnerSnapshotSource();

    const snapshot = await source.load(prisma as never, {
      userId: 'user_1',
      ownerHashSecret: OWNER_SECRET,
      wrongQuestionIds: ['wrong_1'],
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      'SET TRANSACTION READ ONLY',
    );
    expect(prisma.wrongQuestion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_1', id: { in: ['wrong_1'] } },
      }),
    );
    expect(snapshot.version).toBe(
      WRONG_QUESTION_ORGANIZER_OWNER_SNAPSHOT_VERSION,
    );
    expect(snapshot.ownerHash).toMatch(/^hmac-sha256:[a-f0-9]{64}$/u);
    expect(snapshot.ownerHash).not.toContain('user_1');
    expect(snapshot.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/u);
    expect(snapshot.targetWrongQuestionIds).toEqual(['wrong_1']);
    expect(snapshot.decks[0]?.keywords).toEqual([
      '格林公式',
      '曲线积分',
      '概念混淆',
    ]);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.wrongQuestions)).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain(OWNER_SECRET);
  });

  it('returns the same not-found error for missing and cross-owner targets', async () => {
    const source = new WrongQuestionOrganizerOwnerSnapshotSource();

    for (const userId of ['user_missing', 'user_other']) {
      const prisma = createPrisma({ wrongQuestions: [] });
      await expect(
        source.load(prisma as never, {
          userId,
          ownerHashSecret: OWNER_SECRET,
          wrongQuestionIds: ['wrong_1'],
        }),
      ).rejects.toMatchObject({
        code: 'WRONG_QUESTION_NOT_FOUND',
        status: 404,
      });
    }
  });

  it('fails revalidation closed when wrong-question or deck authority drifts', async () => {
    const prisma = createPrisma();
    const source = new WrongQuestionOrganizerOwnerSnapshotSource();
    const snapshot = await source.load(prisma as never, {
      userId: 'user_1',
      ownerHashSecret: OWNER_SECRET,
      wrongQuestionIds: ['wrong_1'],
    });

    prisma.wrongQuestion.findMany.mockResolvedValue([
      { ...wrongQuestion, updatedAt: new Date('2026-07-23T00:00:01.000Z') },
    ]);
    expect(
      await source.revalidate(prisma as never, {
        userId: 'user_1',
        ownerHashSecret: OWNER_SECRET,
        snapshot,
      }),
    ).toBe(false);

    prisma.wrongQuestion.findMany.mockResolvedValue([wrongQuestion]);
    prisma.wrongQuestionDeck.findMany.mockResolvedValue([
      { ...deck, name: '用户重命名专题', nameLocked: true },
    ]);
    expect(
      await source.revalidate(prisma as never, {
        userId: 'user_1',
        ownerHashSecret: OWNER_SECRET,
        snapshot,
      }),
    ).toBe(false);
  });
});
