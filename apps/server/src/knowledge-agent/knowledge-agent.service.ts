import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { analyzeKnowledgeDedup } from '@repo/agent/knowledge-dedup';
import { organizeKnowledgeDocuments } from '@repo/agent/knowledge-organizer';
import type {
  KnowledgeAgentSuggestionQuery,
  KnowledgeAgentSuggestionResponse,
} from '@repo/types/api/knowledge-agent';

import type { ServerEnv } from '../config/env';
import { PrismaService } from '../database/prisma.service';
import {
  type KnowledgeOwnerSnapshot,
  KnowledgeOwnerSnapshotSource,
} from './knowledge-owner-snapshot';

const SNAPSHOT_TRANSACTION_MAX_WAIT_MS = 2_000;
const SNAPSHOT_TRANSACTION_TIMEOUT_MS = 5_000;

@Injectable()
export class KnowledgeAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ServerEnv, true>,
    private readonly snapshotSource: KnowledgeOwnerSnapshotSource,
  ) {}

  async getSuggestions(
    userId: string,
    query: KnowledgeAgentSuggestionQuery,
  ): Promise<KnowledgeAgentSuggestionResponse> {
    const now = new Date();
    // This snapshot is request-local and never persisted. The required JWT secret is
    // used only as domain-separated HMAC key material so raw owner IDs never enter
    // fingerprints; rotating it merely changes fingerprints for later requests.
    const ownerHashSecret = this.config.get('JWT_SECRET', { infer: true });
    const snapshot = await this.prisma.$transaction(
      (transaction) =>
        this.snapshotSource.load(transaction, {
          userId,
          ownerHashSecret,
          ...(query.documentId ? { documentId: query.documentId } : {}),
          limit: query.limit,
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: SNAPSHOT_TRANSACTION_MAX_WAIT_MS,
        timeout: SNAPSHOT_TRANSACTION_TIMEOUT_MS,
      },
    );

    const fresh = await this.snapshotSource.revalidate(this.prisma, {
      userId,
      ownerHashSecret,
      snapshot,
    });
    if (!fresh) {
      return this.localResponse(snapshot, now);
    }

    // Task 8 installs the default-off model dispatch immediately after this fence.
    // Until then both fresh and stale paths intentionally remain deterministic.
    return this.localResponse(snapshot, now);
  }

  private localResponse(
    snapshot: KnowledgeOwnerSnapshot,
    now: Date,
  ): KnowledgeAgentSuggestionResponse {
    const input = {
      now: now.toISOString(),
      documents: snapshot.documents,
    };
    return {
      generatedAt: now.toISOString(),
      dedup: analyzeKnowledgeDedup({
        ...input,
        ...(snapshot.targetDocumentId
          ? { targetDocumentId: snapshot.targetDocumentId }
          : {}),
      }),
      organizer: organizeKnowledgeDocuments(input),
    };
  }
}
