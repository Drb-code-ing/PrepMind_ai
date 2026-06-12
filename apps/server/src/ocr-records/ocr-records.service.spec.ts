import { PrismaService } from '../database/prisma.service';
import { OcrRecordsService } from './ocr-records.service';

describe('OcrRecordsService', () => {
  const now = new Date('2026-06-12T00:00:00.000Z');
  const record = {
    id: 'ocr_1',
    userId: 'user_1',
    groupId: 'group_1',
    imageUrl: null,
    rawText: '## 识别结果\n题目',
    parsedJson: {
      isQuestion: true,
      questionText: '计算极限',
      knowledgePoints: ['极限'],
    },
    status: 'DONE' as const,
    createdAt: now,
    updatedAt: now,
  };
  const prisma = {
    $transaction: jest.fn(),
    ocrRecord: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService() {
    return new OcrRecordsService(prisma as unknown as PrismaService);
  }

  it('lists records scoped to the current user with filters', async () => {
    prisma.ocrRecord.findMany.mockResolvedValue([record]);
    prisma.ocrRecord.count.mockResolvedValue(1);
    prisma.$transaction.mockImplementation((queries: Promise<unknown>[]) =>
      Promise.all(queries),
    );

    const result = await createService().list('user_1', {
      page: 1,
      pageSize: 20,
      status: 'DONE',
      keyword: '极限',
      isQuestion: true,
    });

    expect(prisma.ocrRecord.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_1',
        status: 'DONE',
        rawText: { contains: '极限', mode: 'insensitive' },
        parsedJson: { path: ['isQuestion'], equals: true },
      },
      orderBy: { createdAt: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 20,
      items: [{ id: 'ocr_1', groupId: 'group_1' }],
    });
  });

  it('returns the owned record detail', async () => {
    prisma.ocrRecord.findFirst.mockResolvedValue(record);

    await expect(
      createService().getById('user_1', 'ocr_1'),
    ).resolves.toMatchObject({
      id: 'ocr_1',
      userId: 'user_1',
    });
    expect(prisma.ocrRecord.findFirst).toHaveBeenCalledWith({
      where: { id: 'ocr_1', userId: 'user_1' },
    });
  });

  it('throws OCR_RECORD_NOT_FOUND for unowned records', async () => {
    prisma.ocrRecord.findFirst.mockResolvedValue(null);

    await expect(createService().getById('user_2', 'ocr_1')).rejects.toMatchObject({
      code: 'OCR_RECORD_NOT_FOUND',
    });
  });

  it('upserts records by user id and group id', async () => {
    prisma.ocrRecord.upsert.mockResolvedValue(record);

    const result = await createService().create('user_1', {
      groupId: 'group_1',
      rawText: '## 识别结果\n题目',
      parsedJson: { isQuestion: true, questionText: '计算极限' },
      status: 'DONE',
    });

    expect(prisma.ocrRecord.upsert).toHaveBeenCalledWith({
      where: {
        userId_groupId: {
          userId: 'user_1',
          groupId: 'group_1',
        },
      },
      update: {
        rawText: '## 识别结果\n题目',
        parsedJson: { isQuestion: true, questionText: '计算极限' },
        imageUrl: undefined,
        status: 'DONE',
      },
      create: {
        userId: 'user_1',
        groupId: 'group_1',
        rawText: '## 识别结果\n题目',
        parsedJson: { isQuestion: true, questionText: '计算极限' },
        imageUrl: undefined,
        status: 'DONE',
      },
    });
    expect(result.id).toBe('ocr_1');
  });

  it('rejects base64 image urls', async () => {
    await expect(
      createService().create('user_1', {
        groupId: 'group_1',
        rawText: 'text',
        imageUrl: 'data:image/png;base64,abc',
        status: 'DONE',
      }),
    ).rejects.toMatchObject({ code: 'OCR_RECORD_IMAGE_NOT_SUPPORTED' });
  });

  it('deletes only owned records', async () => {
    prisma.ocrRecord.findFirst.mockResolvedValue({ id: 'ocr_1' });
    prisma.ocrRecord.delete.mockResolvedValue(record);

    await expect(createService().delete('user_1', 'ocr_1')).resolves.toEqual({
      ok: true,
    });
    expect(prisma.ocrRecord.delete).toHaveBeenCalledWith({
      where: { id: 'ocr_1' },
    });
  });
});
