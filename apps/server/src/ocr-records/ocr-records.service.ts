import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateOcrRecordRequest,
  ListOcrRecordsQuery,
} from '@repo/types/api/ocr-record';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class OcrRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListOcrRecordsQuery) {
    const where = this.buildListWhere(userId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.ocrRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.ocrRecord.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(userId: string, id: string) {
    const item = await this.prisma.ocrRecord.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw this.notFound();
    }

    return this.toResponse(item);
  }

  async create(userId: string, input: CreateOcrRecordRequest) {
    this.assertSupportedImageUrl(input.imageUrl);

    const parsedJson = input.parsedJson as Prisma.InputJsonValue | undefined;
    const item = await this.prisma.ocrRecord.upsert({
      where: {
        userId_groupId: {
          userId,
          groupId: input.groupId,
        },
      },
      update: {
        rawText: input.rawText,
        parsedJson,
        imageUrl: input.imageUrl,
        status: input.status,
      },
      create: {
        userId,
        groupId: input.groupId,
        rawText: input.rawText,
        parsedJson,
        imageUrl: input.imageUrl,
        status: input.status,
      },
    });

    return this.toResponse(item);
  }

  async delete(userId: string, id: string): Promise<{ ok: true }> {
    await this.ensureOwned(userId, id);
    await this.prisma.ocrRecord.delete({
      where: { id },
    });

    return { ok: true };
  }

  private async ensureOwned(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.ocrRecord.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      throw this.notFound();
    }
  }

  private buildListWhere(
    userId: string,
    query: ListOcrRecordsQuery,
  ): Prisma.OcrRecordWhereInput {
    const where: Prisma.OcrRecordWhereInput = { userId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.keyword) {
      where.rawText = { contains: query.keyword, mode: 'insensitive' };
    }
    if (query.isQuestion !== undefined) {
      where.parsedJson = {
        path: ['isQuestion'],
        equals: query.isQuestion,
      };
    }

    return where;
  }

  private assertSupportedImageUrl(imageUrl: string | undefined): void {
    if (imageUrl?.startsWith('data:')) {
      throw new AppError(
        'OCR_RECORD_IMAGE_NOT_SUPPORTED',
        'OCR 图片暂不支持上传 base64，请先保存在本地缓存',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private toResponse(item: OcrRecordRecord) {
    return {
      id: item.id,
      userId: item.userId,
      groupId: item.groupId,
      imageUrl: item.imageUrl,
      rawText: item.rawText,
      parsedJson: item.parsedJson,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private notFound(): AppError {
    return new AppError(
      'OCR_RECORD_NOT_FOUND',
      'OCR 记录不存在',
      HttpStatus.NOT_FOUND,
    );
  }
}

type OcrRecordRecord = Prisma.OcrRecordGetPayload<object>;
