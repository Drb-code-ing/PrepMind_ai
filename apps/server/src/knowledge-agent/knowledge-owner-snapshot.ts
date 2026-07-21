import { createHash, createHmac } from 'node:crypto';

import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { KnowledgeAgentDocumentInput } from '@repo/agent/knowledge-dedup';
import { ragSafetyClassificationSchema } from '@repo/types/api/rag-safety';

import { AppError } from '../common/errors/app-error';

export const KNOWLEDGE_OWNER_SNAPSHOT_VERSION = 'knowledge-owner-snapshot-v1';
export const KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION =
  'knowledge-semantic-shortlist-v1';
export const KNOWLEDGE_CHUNK_SAFETY_VERSION = 'rag-safety-v1';

const MAX_SNAPSHOT_DOCUMENTS = 20;
const MAX_SELECTED_CHUNKS_PER_DOCUMENT = 3;
const OWNER_HASH_DOMAIN = `${KNOWLEDGE_OWNER_SNAPSHOT_VERSION}\0owner\0`;

export type KnowledgeOwnerDocument = Readonly<KnowledgeAgentDocumentInput>;

export type KnowledgeOwnerChunk = Readonly<{
  id: string;
  documentId: string;
  index: number;
  content: string;
  contentHash: string;
  safetyVersion: string;
  safeForModel: boolean;
}>;

export type KnowledgeOwnerSnapshotMaterial = Readonly<{
  version: typeof KNOWLEDGE_OWNER_SNAPSHOT_VERSION;
  ownerHash: string;
  targetDocumentId?: string;
  documents: readonly KnowledgeOwnerDocument[];
  selectedChunks: readonly KnowledgeOwnerChunk[];
  shortlistVersion: typeof KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION;
}>;

export type KnowledgeOwnerSnapshot = Readonly<
  KnowledgeOwnerSnapshotMaterial & { fingerprint: string }
>;

export type KnowledgeOwnerSnapshotLoadInput = Readonly<{
  userId: string;
  ownerHashSecret: string;
  documentId?: string;
  limit: number;
}>;

export type KnowledgeOwnerSnapshotRevalidateInput = Readonly<{
  userId: string;
  ownerHashSecret: string;
  snapshot: KnowledgeOwnerSnapshot;
}>;

type SnapshotPrisma = Pick<Prisma.TransactionClient, 'document'>;

const buildDocumentSnapshotSelect = (userId: string) =>
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
      select: {
        id: true,
        documentId: true,
        userId: true,
        content: true,
        index: true,
        metadata: true,
      },
      orderBy: [{ index: 'asc' as const }, { id: 'asc' as const }],
      take: MAX_SELECTED_CHUNKS_PER_DOCUMENT,
    },
    _count: { select: { chunks: { where: { userId } } } },
  }) satisfies Prisma.DocumentSelect;

type KnowledgeOwnerDocumentRow = Prisma.DocumentGetPayload<{
  select: ReturnType<typeof buildDocumentSnapshotSelect>;
}>;

export class KnowledgeOwnerSnapshotSource {
  async load(
    transaction: Prisma.TransactionClient,
    input: KnowledgeOwnerSnapshotLoadInput,
  ): Promise<KnowledgeOwnerSnapshot> {
    assertScope(input.userId, input.ownerHashSecret);
    await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');

    const limit = clampLimit(input.limit);
    const select = buildDocumentSnapshotSelect(input.userId);
    const recent = await transaction.document.findMany({
      where: { userId: input.userId },
      select,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });

    let rows: KnowledgeOwnerDocumentRow[] = recent;
    if (
      input.documentId &&
      !recent.some((document) => document.id === input.documentId)
    ) {
      const target = await transaction.document.findFirst({
        where: { id: input.documentId, userId: input.userId },
        select,
      });
      if (!target) throwDocumentNotFound();
      rows = [target, ...recent.filter((row) => row.id !== target.id)].slice(
        0,
        limit,
      );
    }

    if (
      input.documentId &&
      !rows.some((document) => document.id === input.documentId)
    ) {
      throwDocumentNotFound();
    }

    return buildSnapshot({
      userId: input.userId,
      ownerHashSecret: input.ownerHashSecret,
      ...(input.documentId ? { targetDocumentId: input.documentId } : {}),
      rows,
    });
  }

  async revalidate(
    prisma: SnapshotPrisma,
    input: KnowledgeOwnerSnapshotRevalidateInput,
  ): Promise<boolean> {
    try {
      assertScope(input.userId, input.ownerHashSecret);
      if (
        input.snapshot.version !== KNOWLEDGE_OWNER_SNAPSHOT_VERSION ||
        input.snapshot.shortlistVersion !==
          KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION ||
        input.snapshot.ownerHash !==
          ownerHash(input.userId, input.ownerHashSecret) ||
        input.snapshot.fingerprint !==
          fingerprintKnowledgeOwnerSnapshot(input.snapshot)
      ) {
        return false;
      }

      const documentIds = input.snapshot.documents.map(
        (document) => document.id,
      );
      if (
        new Set(documentIds).size !== documentIds.length ||
        (input.snapshot.targetDocumentId !== undefined &&
          !documentIds.includes(input.snapshot.targetDocumentId))
      ) {
        return false;
      }

      const rows = await prisma.document.findMany({
        where: { userId: input.userId, id: { in: documentIds } },
        select: buildDocumentSnapshotSelect(input.userId),
      });
      if (rows.length !== documentIds.length) return false;

      const fresh = buildSnapshot({
        userId: input.userId,
        ownerHashSecret: input.ownerHashSecret,
        ...(input.snapshot.targetDocumentId
          ? { targetDocumentId: input.snapshot.targetDocumentId }
          : {}),
        rows,
      });
      return fresh.fingerprint === input.snapshot.fingerprint;
    } catch {
      return false;
    }
  }
}

export function fingerprintKnowledgeOwnerSnapshot(
  input: KnowledgeOwnerSnapshotMaterial,
): string {
  const canonicalDocuments = [...input.documents]
    .map((document) => ({
      id: document.id,
      name: document.name,
      type: document.type,
      size: document.size,
      status: document.status,
      sourceType: document.sourceType,
      contentHash: document.contentHash,
      chunkCount: document.chunkCount,
      processedAt: document.processedAt,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      chunkSummaryHashes: document.chunkSummaries.map(hashText),
    }))
    .sort((left, right) => compareCodeUnits(left.id, right.id));
  const canonicalChunks = [...input.selectedChunks]
    .map(
      ({
        id,
        documentId,
        index,
        contentHash,
        safetyVersion,
        safeForModel,
      }) => ({
        id,
        documentId,
        index,
        contentHash,
        safetyVersion,
        safeForModel,
      }),
    )
    .sort(
      (left, right) =>
        compareCodeUnits(left.documentId, right.documentId) ||
        left.index - right.index ||
        compareCodeUnits(left.id, right.id),
    );

  return createHash('sha256')
    .update(
      stableJson({
        version: input.version,
        ownerHash: input.ownerHash,
        targetDocumentId: input.targetDocumentId ?? null,
        documents: canonicalDocuments,
        selectedChunks: canonicalChunks,
        shortlistVersion: input.shortlistVersion,
      }),
    )
    .digest('hex');
}

function buildSnapshot(input: {
  userId: string;
  ownerHashSecret: string;
  targetDocumentId?: string;
  rows: readonly KnowledgeOwnerDocumentRow[];
}): KnowledgeOwnerSnapshot {
  const detached = input.rows.map(detachDocumentRow);
  const material: KnowledgeOwnerSnapshotMaterial = {
    version: KNOWLEDGE_OWNER_SNAPSHOT_VERSION,
    ownerHash: ownerHash(input.userId, input.ownerHashSecret),
    ...(input.targetDocumentId
      ? { targetDocumentId: input.targetDocumentId }
      : {}),
    documents: detached.map((entry) => entry.document),
    selectedChunks: detached.flatMap((entry) => entry.chunks),
    shortlistVersion: KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
  };
  return deepFreezeSnapshot({
    ...material,
    fingerprint: fingerprintKnowledgeOwnerSnapshot(material),
  });
}

function detachDocumentRow(row: KnowledgeOwnerDocumentRow): {
  document: KnowledgeOwnerDocument;
  chunks: KnowledgeOwnerChunk[];
} {
  const chunks = row.chunks.map((chunk) => {
    const safety = safetyFacts(chunk.metadata);
    return {
      id: chunk.id,
      documentId: chunk.documentId,
      index: chunk.index,
      content: chunk.content,
      contentHash: hashText(chunk.content),
      safetyVersion: safety.version,
      safeForModel: safety.safeForModel,
    } satisfies KnowledgeOwnerChunk;
  });
  return {
    document: {
      id: row.id,
      name: row.name,
      type: row.type,
      size: row.size,
      status: row.status,
      sourceType: row.sourceType,
      contentHash: row.contentHash,
      chunkCount: row._count.chunks,
      processedAt: row.processedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      chunkSummaries: chunks.map((chunk) => chunk.content),
    },
    chunks,
  };
}

function safetyFacts(metadata: Prisma.JsonValue): {
  version: string;
  safeForModel: boolean;
} {
  const safety =
    typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata) &&
    'safety' in metadata
      ? metadata.safety
      : undefined;
  const parsed = ragSafetyClassificationSchema.safeParse(safety);
  const canonicalSafety = parsed.success
    ? parsed.data
    : { invalidOrMissingSafetyMetadata: true };
  return {
    version: `${KNOWLEDGE_CHUNK_SAFETY_VERSION}:${createHash('sha256')
      .update(stableJson(canonicalSafety))
      .digest('hex')}`,
    safeForModel: parsed.success && parsed.data.safeForPrompt,
  };
}

function ownerHash(userId: string, secret: string) {
  return `hmac-sha256:${createHmac('sha256', secret)
    .update(OWNER_HASH_DOMAIN)
    .update(userId)
    .digest('hex')}`;
}

function assertScope(userId: string, secret: string) {
  if (!userId.trim()) throw new Error('KNOWLEDGE_OWNER_SNAPSHOT_SCOPE_INVALID');
  if (typeof secret !== 'string' || secret.length < 16) {
    throw new Error('KNOWLEDGE_OWNER_SNAPSHOT_SECRET_INVALID');
  }
}

function clampLimit(limit: number) {
  if (!Number.isSafeInteger(limit) || limit < 1) return 1;
  return Math.min(limit, MAX_SNAPSHOT_DOCUMENTS);
}

function throwDocumentNotFound(): never {
  throw new AppError(
    'KNOWLEDGE_DOCUMENT_NOT_FOUND',
    'Knowledge document not found',
    HttpStatus.NOT_FOUND,
  );
}

function hashText(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort(compareCodeUnits);
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreezeSnapshot(snapshot: {
  version: typeof KNOWLEDGE_OWNER_SNAPSHOT_VERSION;
  ownerHash: string;
  fingerprint: string;
  targetDocumentId?: string;
  documents: readonly KnowledgeOwnerDocument[];
  selectedChunks: readonly KnowledgeOwnerChunk[];
  shortlistVersion: typeof KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION;
}): KnowledgeOwnerSnapshot {
  const documents = snapshot.documents.map((document) =>
    Object.freeze({
      ...document,
      chunkSummaries: Object.freeze([...document.chunkSummaries]),
    }),
  );
  const selectedChunks = snapshot.selectedChunks.map((chunk) =>
    Object.freeze({ ...chunk }),
  );
  return Object.freeze({
    ...snapshot,
    documents: Object.freeze(documents),
    selectedChunks: Object.freeze(selectedChunks),
  });
}
