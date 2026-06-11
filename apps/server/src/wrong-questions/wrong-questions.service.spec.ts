import { WrongQuestionsService } from './wrong-questions.service';
import { PrismaService } from '../database/prisma.service';

describe('WrongQuestionsService', () => {
  const record = {
    id: 'wrong_1',
    userId: 'user_1',
    source: 'OCR' as const,
    sourceRecordId: 'ocr_1',
    sourceGroupId: 'group_1',
    imageUrl: null,
    questionText: '计算曲线积分',
    subject: '高等数学',
    category: '曲线积分',
    knowledgePoints: ['格林公式'],
    analysis: '用格林公式',
    answer: '12',
    errorType: '概念混淆',
    userNote: null,
    rawContent: null,
    status: 'UNRESOLVED' as const,
    createdAt: new Date('2026-06-11T00:00:00.000Z'),
    updatedAt: new Date('2026-06-11T00:00:00.000Z'),
  };

  const prisma = {
    $transaction: jest.fn(),
    wrongQuestion: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService() {
    return new WrongQuestionsService(prisma as unknown as PrismaService);
  }

  it('scopes list queries to the current user and applies filters', async () => {
    prisma.wrongQuestion.findMany.mockReturnValue('findManyQuery');
    prisma.wrongQuestion.count.mockReturnValue('countQuery');
    prisma.$transaction.mockResolvedValue([[record], 1]);

    const service = createService();
    const result = await service.list('user_1', {
      page: 2,
      pageSize: 10,
      status: 'UNRESOLVED',
      subject: '高等数学',
      keyword: '格林',
    });

    expect(prisma.wrongQuestion.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        status: 'UNRESOLVED',
        subject: '高等数学',
        OR: [
          { questionText: { contains: '格林', mode: 'insensitive' } },
          { category: { contains: '格林', mode: 'insensitive' } },
          { analysis: { contains: '格林', mode: 'insensitive' } },
          { answer: { contains: '格林', mode: 'insensitive' } },
          { errorType: { contains: '格林', mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: 10,
      take: 10,
    });
    expect(prisma.wrongQuestion.count).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        status: 'UNRESOLVED',
        subject: '高等数学',
        OR: [
          { questionText: { contains: '格林', mode: 'insensitive' } },
          { category: { contains: '格林', mode: 'insensitive' } },
          { analysis: { contains: '格林', mode: 'insensitive' } },
          { answer: { contains: '格林', mode: 'insensitive' } },
          { errorType: { contains: '格林', mode: 'insensitive' } },
        ],
      },
    });
    expect(result).toMatchObject({
      total: 1,
      page: 2,
      pageSize: 10,
      items: [{ id: 'wrong_1', createdAt: '2026-06-11T00:00:00.000Z' }],
    });
  });

  it('rejects duplicate sourceGroupId for the same user', async () => {
    prisma.wrongQuestion.findUnique.mockResolvedValue(record);

    const service = createService();

    await expect(
      service.create('user_1', {
        source: 'OCR',
        sourceGroupId: 'group_1',
        questionText: '题干',
        subject: '数学',
        category: '极限',
        knowledgePoints: [],
        analysis: '',
        answer: '',
      }),
    ).rejects.toMatchObject({ code: 'WRONG_QUESTION_DUPLICATED' });
    expect(prisma.wrongQuestion.create).not.toHaveBeenCalled();
  });

  it('returns not found when reading an unowned wrong question', async () => {
    prisma.wrongQuestion.findFirst.mockResolvedValue(null);

    const service = createService();

    await expect(service.getById('user_2', 'wrong_1')).rejects.toMatchObject({
      code: 'WRONG_QUESTION_NOT_FOUND',
    });
  });

  it('checks ownership before updating a wrong question', async () => {
    prisma.wrongQuestion.findFirst.mockResolvedValue({ id: 'wrong_1' });
    prisma.wrongQuestion.update.mockResolvedValue({
      ...record,
      status: 'RESOLVED',
    });

    const service = createService();
    const result = await service.update('user_1', 'wrong_1', {
      status: 'RESOLVED',
    });

    expect(prisma.wrongQuestion.findFirst).toHaveBeenCalledWith({
      where: { id: 'wrong_1', userId: 'user_1' },
      select: { id: true },
    });
    expect(prisma.wrongQuestion.update).toHaveBeenCalledWith({
      where: { id: 'wrong_1' },
      data: { status: 'RESOLVED' },
    });
    expect(result.status).toBe('RESOLVED');
  });
});
