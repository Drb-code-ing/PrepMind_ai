import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  CreateWrongQuestionRequest,
  ListWrongQuestionsQuery,
  UpdateWrongQuestionRequest,
} from '@repo/types/api/wrong-question';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class WrongQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ListWrongQuestionsQuery) {
    const where = this.buildListWhere(userId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.wrongQuestion.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.wrongQuestion.count({ where }),
    ]);

    return {
      items: items.map((item) => this.toResponse(item)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(userId: string, id: string) {
    const item = await this.prisma.wrongQuestion.findFirst({
      where: { id, userId },
    });

    if (!item) {
      throw this.notFound();
    }

    return this.toResponse(item);
  }

  async create(userId: string, input: CreateWrongQuestionRequest) {
    if (input.sourceGroupId) {
      const existing = await this.prisma.wrongQuestion.findUnique({
        where: {
          userId_sourceGroupId: {
            userId,
            sourceGroupId: input.sourceGroupId,
          },
        },
      });

      if (existing) {
        throw new AppError(
          'WRONG_QUESTION_DUPLICATED',
          '该错题已保存',
          HttpStatus.CONFLICT,
        );
      }
    }

    const item = await this.prisma.wrongQuestion.create({
      data: {
        userId,
        source: input.source,
        sourceRecordId: input.sourceRecordId,
        sourceGroupId: input.sourceGroupId,
        imageUrl: input.imageUrl,
        questionText: input.questionText,
        subject: input.subject,
        category: input.category,
        knowledgePoints: input.knowledgePoints,
        analysis: input.analysis,
        answer: input.answer,
        errorType: input.errorType,
        userNote: input.userNote,
        rawContent: input.rawContent,
      },
    });

    return this.toResponse(item);
  }

  async update(userId: string, id: string, input: UpdateWrongQuestionRequest) {
    await this.ensureOwned(userId, id);

    const item = await this.prisma.wrongQuestion.update({
      where: { id },
      data: input,
    });

    return this.toResponse(item);
  }

  async delete(userId: string, id: string): Promise<{ ok: true }> {
    await this.ensureOwned(userId, id);
    await this.prisma.wrongQuestion.delete({
      where: { id },
    });

    return { ok: true };
  }

  private async ensureOwned(userId: string, id: string): Promise<void> {
    const existing = await this.prisma.wrongQuestion.findFirst({
      where: { id, userId },
      select: { id: true },
    });

    if (!existing) {
      throw this.notFound();
    }
  }

  private buildListWhere(
    userId: string,
    query: ListWrongQuestionsQuery,
  ): Prisma.WrongQuestionWhereInput {
    const where: Prisma.WrongQuestionWhereInput = { userId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.subject) {
      where.subject = query.subject;
    }
    if (query.keyword) {
      where.OR = [
        { questionText: { contains: query.keyword, mode: 'insensitive' } },
        { category: { contains: query.keyword, mode: 'insensitive' } },
        { analysis: { contains: query.keyword, mode: 'insensitive' } },
        { answer: { contains: query.keyword, mode: 'insensitive' } },
        { errorType: { contains: query.keyword, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  private toResponse(item: WrongQuestionRecord) {
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

  private notFound(): AppError {
    return new AppError(
      'WRONG_QUESTION_NOT_FOUND',
      '错题不存在',
      HttpStatus.NOT_FOUND,
    );
  }
}

type WrongQuestionRecord = Prisma.WrongQuestionGetPayload<object>;
