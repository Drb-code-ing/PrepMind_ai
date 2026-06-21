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

  const prisma = {
    wrongQuestion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
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
    jest.clearAllMocks();
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
});
