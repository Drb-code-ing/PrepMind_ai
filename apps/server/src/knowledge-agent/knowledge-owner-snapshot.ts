import { createHash, createHmac } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { KnowledgeAgentDocumentInput } from '@repo/agent/knowledge-dedup';
import { ragSafetyClassificationSchema } from '@repo/types/api/rag-safety';

import { AppError } from '../common/errors/app-error';
import {
  KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
  KnowledgeSemanticCandidateSource,
  type KnowledgeSemanticPair,
  type KnowledgeSemanticShortlist,
} from './knowledge-semantic-candidate.source';

export { KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION } from './knowledge-semantic-candidate.source';

export const KNOWLEDGE_OWNER_SNAPSHOT_VERSION = 'knowledge-owner-snapshot-v1';
export const KNOWLEDGE_CHUNK_SAFETY_VERSION = 'rag-safety-v1';

const MAX_SNAPSHOT_DOCUMENTS = 20;
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
  semanticPairs: readonly KnowledgeSemanticPair[];
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

type SnapshotPrisma = Pick<
  Prisma.TransactionClient,
  'document' | 'chunk' | '$queryRaw'
>;

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
    _count: { select: { chunks: { where: { userId } } } },
  }) satisfies Prisma.DocumentSelect;

type KnowledgeOwnerDocumentRow = Prisma.DocumentGetPayload<{
  select: ReturnType<typeof buildDocumentSnapshotSelect>;
}>;

@Injectable()
export class KnowledgeOwnerSnapshotSource {
  constructor(
    private readonly semanticSource: KnowledgeSemanticCandidateSource,
  ) {}

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

    const semantic = await this.semanticSource.load(
      transaction,
      semanticScope(input.userId, rows, input.documentId),
    );
    const chunks = await loadSelectedChunks(
      transaction,
      input.userId,
      semantic,
    );
    return buildSnapshot({
      userId: input.userId,
      ownerHashSecret: input.ownerHashSecret,
      ...(input.documentId ? { targetDocumentId: input.documentId } : {}),
      rows,
      semantic: chunks === null ? emptySemanticShortlist() : semantic,
      chunks: chunks ?? [],
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

      const semantic = await this.semanticSource.load(
        prisma as Prisma.TransactionClient,
        semanticScope(input.userId, rows, input.snapshot.targetDocumentId),
      );
      const chunks = await loadSelectedChunks(prisma, input.userId, semantic);
      if (chunks === null) return false;
      const fresh = buildSnapshot({
        userId: input.userId,
        ownerHashSecret: input.ownerHashSecret,
        ...(input.snapshot.targetDocumentId
          ? { targetDocumentId: input.snapshot.targetDocumentId }
          : {}),
        rows,
        semantic,
        chunks,
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
  const canonicalPairs = [...input.semanticPairs]
    .map(({ leftDocumentId, rightDocumentId, score, evidenceBand }) => ({
      leftDocumentId,
      rightDocumentId,
      score,
      evidenceBand,
    }))
    .sort(
      (left, right) =>
        compareCodeUnits(left.leftDocumentId, right.leftDocumentId) ||
        compareCodeUnits(left.rightDocumentId, right.rightDocumentId),
    );

  return createHash('sha256')
    .update(
      stableJson({
        version: input.version,
        ownerHash: input.ownerHash,
        targetDocumentId: input.targetDocumentId ?? null,
        documents: canonicalDocuments,
        selectedChunks: canonicalChunks,
        semanticPairs: canonicalPairs,
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
  semantic: KnowledgeSemanticShortlist;
  chunks: readonly KnowledgeOwnerChunk[];
}): KnowledgeOwnerSnapshot {
  const chunksByDocument = new Map<string, KnowledgeOwnerChunk[]>();
  for (const chunk of input.chunks) {
    const existing = chunksByDocument.get(chunk.documentId) ?? [];
    existing.push(chunk);
    chunksByDocument.set(chunk.documentId, existing);
  }
  const documents = input.rows.map((row) =>
    detachDocumentRow(row, chunksByDocument.get(row.id) ?? []),
  );
  const material: KnowledgeOwnerSnapshotMaterial = {
    version: KNOWLEDGE_OWNER_SNAPSHOT_VERSION,
    ownerHash: ownerHash(input.userId, input.ownerHashSecret),
    ...(input.targetDocumentId
      ? { targetDocumentId: input.targetDocumentId }
      : {}),
    documents,
    selectedChunks: input.chunks,
    semanticPairs: input.semantic.pairs,
    shortlistVersion: input.semantic.version,
  };
  return deepFreezeSnapshot({
    ...material,
    fingerprint: fingerprintKnowledgeOwnerSnapshot(material),
  });
}

function detachDocumentRow(
  row: KnowledgeOwnerDocumentRow,
  chunks: readonly KnowledgeOwnerChunk[],
): KnowledgeOwnerDocument {
  return {
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
  };
}

function semanticScope(
  userId: string,
  rows: readonly KnowledgeOwnerDocumentRow[],
  targetDocumentId?: string,
) {
  return {
    userId,
    documents: rows.map(({ id, status, contentHash }) => ({
      id,
      status,
      contentHash,
    })),
    ...(targetDocumentId ? { targetDocumentId } : {}),
  };
}

async function loadSelectedChunks(
  prisma: Pick<Prisma.TransactionClient, 'chunk'>,
  userId: string,
  semantic: KnowledgeSemanticShortlist,
): Promise<KnowledgeOwnerChunk[] | null> {
  if (semantic.version !== KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION) return null;
  if (semantic.selectedChunks.length === 0) return [];
  const selectedIds = semantic.selectedChunks.map((chunk) => chunk.id);
  if (new Set(selectedIds).size !== selectedIds.length) return null;
  const rows = await prisma.chunk.findMany({
    where: { userId, id: { in: selectedIds } },
    select: {
      id: true,
      documentId: true,
      userId: true,
      content: true,
      index: true,
      metadata: true,
    },
    orderBy: [{ documentId: 'asc' }, { index: 'asc' }, { id: 'asc' }],
  });
  if (rows.length !== semantic.selectedChunks.length) return null;
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const chunks: KnowledgeOwnerChunk[] = [];
  for (const selected of semantic.selectedChunks) {
    const row = rowById.get(selected.id);
    if (
      row === undefined ||
      row.userId !== userId ||
      row.documentId !== selected.documentId ||
      row.index !== selected.index
    ) {
      return null;
    }
    const safety = safetyFacts(row.metadata);
    if (!safety.safeForModel) return null;
    chunks.push({
      id: row.id,
      documentId: row.documentId,
      index: row.index,
      content: row.content,
      contentHash: hashText(row.content),
      safetyVersion: safety.version,
      safeForModel: true,
    });
  }
  return chunks;
}

function emptySemanticShortlist(): KnowledgeSemanticShortlist {
  return Object.freeze({
    version: KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
    selectedChunks: Object.freeze([]),
    pairs: Object.freeze([]),
  });
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
    safeForModel:
      parsed.success &&
      parsed.data.riskLevel === 'low' &&
      parsed.data.safeForPrompt,
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
  semanticPairs: readonly KnowledgeSemanticPair[];
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
  const semanticPairs = snapshot.semanticPairs.map((pair) =>
    Object.freeze({ ...pair }),
  );
  return Object.freeze({
    ...snapshot,
    documents: Object.freeze(documents),
    selectedChunks: Object.freeze(selectedChunks),
    semanticPairs: Object.freeze(semanticPairs),
  });
}
