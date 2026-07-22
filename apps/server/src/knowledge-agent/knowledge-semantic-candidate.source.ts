import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION =
  'knowledge-semantic-shortlist-v1';
export const KNOWLEDGE_SEMANTIC_THRESHOLD = 0.78;
export const KNOWLEDGE_SEMANTIC_HIGH_THRESHOLD = 0.9;
export const MAX_KNOWLEDGE_DOCUMENTS = 20;
export const MAX_CHUNKS_PER_DOCUMENT = 6;
export const MAX_SEMANTIC_PAIRS = 12;
export const KNOWLEDGE_EMBEDDING_DIMENSIONS = 1536;
export const KNOWLEDGE_EMBEDDING_PROVIDER = 'qwen';
export const KNOWLEDGE_EMBEDDING_MODEL = 'text-embedding-v4';

const MAX_RAW_PAIR_ROWS =
  (MAX_KNOWLEDGE_DOCUMENTS *
    MAX_CHUNKS_PER_DOCUMENT *
    (MAX_KNOWLEDGE_DOCUMENTS * MAX_CHUNKS_PER_DOCUMENT - 1)) /
  2;

export type KnowledgeSemanticScopeDocument = Readonly<{
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED';
  contentHash: string | null;
}>;

export type KnowledgeSemanticCandidateScope = Readonly<{
  userId: string;
  documents: readonly KnowledgeSemanticScopeDocument[];
  targetDocumentId?: string;
}>;

export type KnowledgeSemanticSelectedChunk = Readonly<{
  id: string;
  documentId: string;
  index: number;
}>;

export type KnowledgeSemanticPair = Readonly<{
  leftDocumentId: string;
  rightDocumentId: string;
  score: number;
  evidenceBand: 'medium' | 'high';
}>;

export type KnowledgeSemanticShortlist = Readonly<{
  version: typeof KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION;
  selectedChunks: readonly KnowledgeSemanticSelectedChunk[];
  pairs: readonly KnowledgeSemanticPair[];
}>;

export type KnowledgeChunkSimilarityRow = Readonly<{
  leftChunkId: string;
  leftDocumentId: string;
  leftIndex: number;
  rightChunkId: string;
  rightDocumentId: string;
  rightIndex: number;
  score: number;
}>;

const EMPTY_SHORTLIST = Object.freeze({
  version: KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
  selectedChunks: Object.freeze([]),
  pairs: Object.freeze([]),
}) satisfies KnowledgeSemanticShortlist;

@Injectable()
export class KnowledgeSemanticCandidateSource {
  async load(
    transaction: Prisma.TransactionClient,
    input: KnowledgeSemanticCandidateScope,
  ): Promise<KnowledgeSemanticShortlist> {
    const scope = validateScope(input);
    if (scope === null || scope.documents.length === 0) return EMPTY_SHORTLIST;

    try {
      const documentIds = scope.documents.map((document) => document.id);
      const selectedRows = await transaction.$queryRaw<unknown[]>(
        Prisma.sql`
          WITH eligible AS (
            SELECT c.id, c."documentId", c.index
            FROM "Chunk" c
            JOIN "Document" d ON d.id = c."documentId"
            WHERE
              c."userId" = ${scope.userId}
              AND d."userId" = ${scope.userId}
              AND d.id IN (${Prisma.join(documentIds)})
              AND d.status = 'DONE'
              AND c.embedding IS NOT NULL
              AND vector_dims(c.embedding) = ${KNOWLEDGE_EMBEDDING_DIMENSIONS}
              AND jsonb_typeof(c.metadata -> 'safety') = 'object'
              AND jsonb_typeof(c.metadata #> '{safety,safeForPrompt}') = 'boolean'
              AND c.metadata #>> '{safety,safeForPrompt}' = 'true'
              AND c.metadata #>> '{safety,riskLevel}' = 'low'
              AND c.metadata #>> '{embedding,provider}' = ${KNOWLEDGE_EMBEDDING_PROVIDER}
              AND c.metadata #>> '{embedding,model}' = ${KNOWLEDGE_EMBEDDING_MODEL}
              AND c.metadata #>> '{embedding,dimensions}' = ${String(KNOWLEDGE_EMBEDDING_DIMENSIONS)}
          ), bucketed AS (
            SELECT
              id,
              "documentId",
              index,
              ntile(${MAX_CHUNKS_PER_DOCUMENT}::integer) OVER (
                PARTITION BY "documentId"
                ORDER BY index ASC, id ASC
              ) AS bucket
            FROM eligible
          ), sampled AS (
            SELECT
              id,
              "documentId",
              index,
              row_number() OVER (
                PARTITION BY "documentId", bucket
                ORDER BY index ASC, id ASC
              ) AS bucket_rank
            FROM bucketed
          )
          SELECT id, "documentId", index
          FROM sampled
          WHERE bucket_rank = 1
          ORDER BY "documentId" ASC, index ASC, id ASC
        `,
      );
      const selectedChunks = validateSelectedChunks(
        selectedRows,
        scope.documents,
      );
      if (selectedChunks === null) return EMPTY_SHORTLIST;

      const selectedDocumentIds = [
        ...new Set(selectedChunks.map((chunk) => chunk.documentId)),
      ];
      if (selectedChunks.length === 0 || selectedDocumentIds.length < 2) {
        return freezeShortlist(selectedChunks, []);
      }

      const selectedChunkIds = selectedChunks.map((chunk) => chunk.id);
      const pairRows = await transaction.$queryRaw<unknown[]>(
        Prisma.sql`
          SELECT
            left_chunk.id AS "leftChunkId",
            left_chunk."documentId" AS "leftDocumentId",
            left_chunk.index AS "leftIndex",
            right_chunk.id AS "rightChunkId",
            right_chunk."documentId" AS "rightDocumentId",
            right_chunk.index AS "rightIndex",
            (1 - (left_chunk.embedding <=> right_chunk.embedding))::float8 AS score
          FROM "Chunk" left_chunk
          JOIN "Document" left_document
            ON left_document.id = left_chunk."documentId"
          JOIN "Chunk" right_chunk
            ON left_chunk."documentId" < right_chunk."documentId"
          JOIN "Document" right_document
            ON right_document.id = right_chunk."documentId"
          WHERE
            left_chunk."userId" = ${scope.userId}
            AND right_chunk."userId" = ${scope.userId}
            AND left_document."userId" = ${scope.userId}
            AND right_document."userId" = ${scope.userId}
            AND left_document.id IN (${Prisma.join(documentIds)})
            AND right_document.id IN (${Prisma.join(documentIds)})
            AND left_chunk.id IN (${Prisma.join(selectedChunkIds)})
            AND right_chunk.id IN (${Prisma.join(selectedChunkIds)})
            AND left_document.status = 'DONE'
            AND right_document.status = 'DONE'
            AND left_chunk.embedding IS NOT NULL
            AND right_chunk.embedding IS NOT NULL
            AND vector_dims(left_chunk.embedding) = ${KNOWLEDGE_EMBEDDING_DIMENSIONS}
            AND vector_dims(right_chunk.embedding) = ${KNOWLEDGE_EMBEDDING_DIMENSIONS}
            AND jsonb_typeof(left_chunk.metadata #> '{safety,safeForPrompt}') = 'boolean'
            AND jsonb_typeof(right_chunk.metadata #> '{safety,safeForPrompt}') = 'boolean'
            AND left_chunk.metadata #>> '{safety,safeForPrompt}' = 'true'
            AND right_chunk.metadata #>> '{safety,safeForPrompt}' = 'true'
            AND left_chunk.metadata #>> '{safety,riskLevel}' = 'low'
            AND right_chunk.metadata #>> '{safety,riskLevel}' = 'low'
            AND left_chunk.metadata #>> '{embedding,provider}' = ${KNOWLEDGE_EMBEDDING_PROVIDER}
            AND right_chunk.metadata #>> '{embedding,provider}' = ${KNOWLEDGE_EMBEDDING_PROVIDER}
            AND left_chunk.metadata #>> '{embedding,model}' = ${KNOWLEDGE_EMBEDDING_MODEL}
            AND right_chunk.metadata #>> '{embedding,model}' = ${KNOWLEDGE_EMBEDDING_MODEL}
            AND left_chunk.metadata #>> '{embedding,dimensions}' = ${String(KNOWLEDGE_EMBEDDING_DIMENSIONS)}
            AND right_chunk.metadata #>> '{embedding,dimensions}' = ${String(KNOWLEDGE_EMBEDDING_DIMENSIONS)}
            AND (
              left_document."contentHash" IS NULL
              OR left_document."contentHash" = ''
              OR right_document."contentHash" IS NULL
              OR right_document."contentHash" = ''
              OR left_document."contentHash" <> right_document."contentHash"
            )
          ORDER BY
            left_chunk."documentId" ASC,
            right_chunk."documentId" ASC,
            left_chunk.index ASC,
            left_chunk.id ASC,
            right_chunk.index ASC,
            right_chunk.id ASC
        `,
      );
      const validatedPairRows = validatePairRows(pairRows, {
        documents: scope.documents,
        selectedChunks,
      });
      if (validatedPairRows === null) {
        return EMPTY_SHORTLIST;
      }

      return freezeShortlist(
        selectedChunks,
        finalizeKnowledgeSemanticPairs({
          rows: validatedPairRows,
          documents: scope.documents,
          ...(scope.targetDocumentId
            ? { targetDocumentId: scope.targetDocumentId }
            : {}),
        }),
      );
    } catch {
      return EMPTY_SHORTLIST;
    }
  }
}

export function finalizeKnowledgeSemanticPairs(input: {
  rows: readonly KnowledgeChunkSimilarityRow[];
  documents: readonly KnowledgeSemanticScopeDocument[];
  targetDocumentId?: string;
}): readonly KnowledgeSemanticPair[] {
  const documents = new Map(
    input.documents.map((document) => [document.id, document]),
  );
  const grouped = new Map<
    string,
    { left: string; right: string; scores: number[] }
  >();

  for (const row of input.rows) {
    if (!isFiniteCosine(row.score)) continue;
    const [left, right] = canonicalPair(
      row.leftDocumentId,
      row.rightDocumentId,
    );
    if (left === right || !documents.has(left) || !documents.has(right))
      continue;
    const leftDocument = documents.get(left)!;
    const rightDocument = documents.get(right)!;
    if (
      hasEqualExactHash(leftDocument.contentHash, rightDocument.contentHash) ||
      (input.targetDocumentId !== undefined &&
        left !== input.targetDocumentId &&
        right !== input.targetDocumentId)
    ) {
      continue;
    }
    const key = `${left}\0${right}`;
    const group = grouped.get(key) ?? { left, right, scores: [] };
    group.scores.push(row.score);
    grouped.set(key, group);
  }

  return Object.freeze(
    [...grouped.values()]
      .map((group) => ({
        leftDocumentId: group.left,
        rightDocumentId: group.right,
        score: scoreDocumentPair(group.scores),
        evidenceBand: 'medium' as const,
      }))
      .filter((pair) => pair.score >= KNOWLEDGE_SEMANTIC_THRESHOLD)
      .map((pair) => ({
        ...pair,
        evidenceBand:
          pair.score >= KNOWLEDGE_SEMANTIC_HIGH_THRESHOLD
            ? ('high' as const)
            : ('medium' as const),
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          compareCodeUnits(left.leftDocumentId, right.leftDocumentId) ||
          compareCodeUnits(left.rightDocumentId, right.rightDocumentId),
      )
      .slice(0, MAX_SEMANTIC_PAIRS)
      .map((pair) => Object.freeze(pair)),
  );
}

function validateScope(input: unknown): {
  userId: string;
  documents: KnowledgeSemanticScopeDocument[];
  targetDocumentId?: string;
} | null {
  if (!isRecord(input)) return null;
  const userId = readBoundedIdentifier(input.userId);
  const documentValues = readUnknownArray(input.documents);
  if (
    userId === null ||
    documentValues === null ||
    documentValues.length > MAX_KNOWLEDGE_DOCUMENTS
  ) {
    return null;
  }
  const documents: KnowledgeSemanticScopeDocument[] = [];
  for (const value of documentValues) {
    const document = parseScopeDocument(value);
    if (document === null) return null;
    documents.push(document);
  }
  if (
    new Set(documents.map((document) => document.id)).size !== documents.length
  ) {
    return null;
  }
  const targetDocumentId =
    input.targetDocumentId === undefined
      ? undefined
      : readBoundedIdentifier(input.targetDocumentId);
  if (
    targetDocumentId === null ||
    (targetDocumentId !== undefined &&
      !documents.some(
        (document) =>
          document.id === targetDocumentId && document.status === 'DONE',
      ))
  ) {
    return null;
  }
  const eligibleDocuments = documents.filter(
    (document) => document.status === 'DONE',
  );
  return {
    userId,
    documents: eligibleDocuments.map((document) => ({ ...document })),
    ...(targetDocumentId ? { targetDocumentId } : {}),
  };
}

function validateSelectedChunks(
  value: unknown,
  documents: readonly KnowledgeSemanticScopeDocument[],
): KnowledgeSemanticSelectedChunk[] | null {
  const rows = readUnknownArray(value);
  if (
    rows === null ||
    rows.length > documents.length * MAX_CHUNKS_PER_DOCUMENT
  ) {
    return null;
  }
  const documentIds = new Set(documents.map((document) => document.id));
  const ids = new Set<string>();
  const counts = new Map<string, number>();
  const selected: KnowledgeSemanticSelectedChunk[] = [];
  for (const value of rows) {
    const row = parseSelectedChunk(value);
    if (row === null || !documentIds.has(row.documentId) || ids.has(row.id)) {
      return null;
    }
    const count = (counts.get(row.documentId) ?? 0) + 1;
    if (count > MAX_CHUNKS_PER_DOCUMENT) return null;
    counts.set(row.documentId, count);
    ids.add(row.id);
    selected.push({
      id: row.id,
      documentId: row.documentId,
      index: row.index,
    });
  }
  return selected.sort(
    (left, right) =>
      compareCodeUnits(left.documentId, right.documentId) ||
      left.index - right.index ||
      compareCodeUnits(left.id, right.id),
  );
}

function validatePairRows(
  value: unknown,
  input: {
    documents: readonly KnowledgeSemanticScopeDocument[];
    selectedChunks: readonly KnowledgeSemanticSelectedChunk[];
  },
): KnowledgeChunkSimilarityRow[] | null {
  const rows = readUnknownArray(value);
  if (rows === null || rows.length > MAX_RAW_PAIR_ROWS) return null;
  const documents = new Set(input.documents.map((document) => document.id));
  const chunks = new Map(
    input.selectedChunks.map((chunk) => [chunk.id, chunk]),
  );
  const seen = new Set<string>();
  const validated: KnowledgeChunkSimilarityRow[] = [];
  for (const value of rows) {
    const row = parsePairRow(value);
    if (row === null) return null;
    const left = chunks.get(row.leftChunkId);
    const right = chunks.get(row.rightChunkId);
    if (
      left === undefined ||
      right === undefined ||
      row.leftDocumentId !== left.documentId ||
      row.rightDocumentId !== right.documentId ||
      row.leftIndex !== left.index ||
      row.rightIndex !== right.index ||
      !documents.has(row.leftDocumentId) ||
      !documents.has(row.rightDocumentId) ||
      row.leftDocumentId === row.rightDocumentId ||
      !isFiniteCosine(row.score)
    ) {
      return null;
    }
    const [first, second] = canonicalPair(row.leftChunkId, row.rightChunkId);
    const key = `${first}\0${second}`;
    if (seen.has(key)) return null;
    seen.add(key);
    validated.push(row);
  }
  return validated;
}

function parseScopeDocument(
  value: unknown,
): KnowledgeSemanticScopeDocument | null {
  if (!isRecord(value)) return null;
  const id = readBoundedIdentifier(value.id);
  if (
    id === null ||
    !isKnowledgeDocumentStatus(value.status) ||
    (value.contentHash !== null && typeof value.contentHash !== 'string')
  ) {
    return null;
  }
  return {
    id,
    status: value.status,
    contentHash: value.contentHash,
  };
}

function isKnowledgeDocumentStatus(
  value: unknown,
): value is KnowledgeSemanticScopeDocument['status'] {
  return (
    value === 'PENDING' ||
    value === 'PROCESSING' ||
    value === 'DONE' ||
    value === 'FAILED'
  );
}

function parseSelectedChunk(
  value: unknown,
): KnowledgeSemanticSelectedChunk | null {
  if (!isRecord(value)) return null;
  const id = readBoundedIdentifier(value.id);
  const documentId = readBoundedIdentifier(value.documentId);
  if (
    id === null ||
    documentId === null ||
    !Number.isSafeInteger(value.index) ||
    (value.index as number) < 0
  ) {
    return null;
  }
  return { id, documentId, index: value.index as number };
}

function parsePairRow(value: unknown): KnowledgeChunkSimilarityRow | null {
  if (!isRecord(value)) return null;
  const leftChunkId = readBoundedIdentifier(value.leftChunkId);
  const leftDocumentId = readBoundedIdentifier(value.leftDocumentId);
  const rightChunkId = readBoundedIdentifier(value.rightChunkId);
  const rightDocumentId = readBoundedIdentifier(value.rightDocumentId);
  if (
    leftChunkId === null ||
    leftDocumentId === null ||
    rightChunkId === null ||
    rightDocumentId === null ||
    !Number.isSafeInteger(value.leftIndex) ||
    (value.leftIndex as number) < 0 ||
    !Number.isSafeInteger(value.rightIndex) ||
    (value.rightIndex as number) < 0 ||
    !isFiniteCosine(value.score)
  ) {
    return null;
  }
  return {
    leftChunkId,
    leftDocumentId,
    leftIndex: value.leftIndex as number,
    rightChunkId,
    rightDocumentId,
    rightIndex: value.rightIndex as number,
    score: value.score,
  };
}

function readUnknownArray(value: unknown): readonly unknown[] | null {
  return Array.isArray(value) ? (value as readonly unknown[]) : null;
}

function readBoundedIdentifier(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= 256
    ? value
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scoreDocumentPair(scores: readonly number[]) {
  const top = [...scores].sort((left, right) => right - left).slice(0, 3);
  if (top.length === 0) return 0;
  return roundScore(top.reduce((sum, value) => sum + value, 0) / top.length);
}

function isFiniteCosine(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= -1 &&
    value <= 1
  );
}

function hasEqualExactHash(left: string | null, right: string | null) {
  return Boolean(left && right && left === right);
}

function canonicalPair(left: string, right: string): [string, string] {
  return compareCodeUnits(left, right) <= 0 ? [left, right] : [right, left];
}

function roundScore(value: number) {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}

function compareCodeUnits(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function freezeShortlist(
  selectedChunks: readonly KnowledgeSemanticSelectedChunk[],
  pairs: readonly KnowledgeSemanticPair[],
): KnowledgeSemanticShortlist {
  return Object.freeze({
    version: KNOWLEDGE_SEMANTIC_SHORTLIST_VERSION,
    selectedChunks: Object.freeze(
      selectedChunks.map((chunk) => Object.freeze({ ...chunk })),
    ),
    pairs: Object.freeze(pairs.map((pair) => Object.freeze({ ...pair }))),
  });
}
