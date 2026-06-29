import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  analyzeKnowledgeDedup,
  type KnowledgeAgentDocumentInput,
} from '@repo/agent/knowledge-dedup';
import { organizeKnowledgeDocuments } from '@repo/agent/knowledge-organizer';
import type {
  KnowledgeAgentSuggestionQuery,
  KnowledgeAgentSuggestionResponse,
} from '@repo/types/api/knowledge-agent';

import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';

const buildDocumentSignalSelect = (userId: string) =>
  ({
    id: true,
    name: true,
    type: true,
    size: true,
    status: true,
    sourceType: true,
    contentHash: true,
    processedAt: true,
    createdAt: true,
    updatedAt: true,
    chunks: {
      where: { userId },
      select: { content: true, index: true },
      orderBy: { index: 'asc' },
      take: 3,
    },
    _count: { select: { chunks: { where: { userId } } } },
  }) satisfies Prisma.DocumentSelect;

@Injectable()
export class KnowledgeAgentService {
  constructor(private readonly prisma: PrismaService) {}

  async getSuggestions(
    userId: string,
    query: KnowledgeAgentSuggestionQuery,
  ): Promise<KnowledgeAgentSuggestionResponse> {
    if (query.documentId) {
      await this.assertOwnedDocument(userId, query.documentId);
    }

    const now = new Date();
    const select = buildDocumentSignalSelect(userId);
    const documents = await this.prisma.document.findMany({
      where: { userId },
      select,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: query.limit,
    });
    const scopedDocuments = await this.includeTargetDocumentIfMissing(
      userId,
      query.documentId,
      documents,
      select,
    );
    const input = {
      now: now.toISOString(),
      documents: scopedDocuments.map((document) =>
        this.toAgentDocument(document),
      ),
    };

    return {
      generatedAt: now.toISOString(),
      dedup: analyzeKnowledgeDedup({
        ...input,
        ...(query.documentId ? { targetDocumentId: query.documentId } : {}),
      }),
      organizer: organizeKnowledgeDocuments(input),
    };
  }

  private async assertOwnedDocument(userId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
      select: { id: true },
    });

    if (!document) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_NOT_FOUND',
        'Knowledge document not found',
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async includeTargetDocumentIfMissing(
    userId: string,
    documentId: string | undefined,
    documents: KnowledgeAgentDocumentSignal[],
    select: ReturnType<typeof buildDocumentSignalSelect>,
  ) {
    if (!documentId || documents.some((document) => document.id === documentId)) {
      return documents;
    }

    const targetDocument = await this.prisma.document.findFirst({
      where: { id: documentId, userId },
      select,
    });

    if (!targetDocument) {
      throw new AppError(
        'KNOWLEDGE_DOCUMENT_NOT_FOUND',
        'Knowledge document not found',
        HttpStatus.NOT_FOUND,
      );
    }

    return [targetDocument, ...documents];
  }

  private toAgentDocument(
    document: KnowledgeAgentDocumentSignal,
  ): KnowledgeAgentDocumentInput {
    return {
      id: document.id,
      name: document.name,
      type: document.type,
      size: document.size,
      status: document.status,
      sourceType: document.sourceType,
      contentHash: document.contentHash,
      chunkCount: document._count.chunks,
      processedAt: document.processedAt?.toISOString() ?? null,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      chunkSummaries: document.chunks.map((chunk) =>
        chunk.content.slice(0, 180),
      ),
    };
  }
}

type KnowledgeAgentDocumentSignal = Prisma.DocumentGetPayload<{
  select: ReturnType<typeof buildDocumentSignalSelect>;
}>;
