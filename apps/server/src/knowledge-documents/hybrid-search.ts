import type { KnowledgeSearchHit } from '@repo/types/api/knowledge';

export type HybridSearchRow = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  metadata: unknown;
  vectorScore: number | string | null;
  keywordScore: number | string | null;
};

type MergeHybridSearchRowsInput = {
  vectorRows: HybridSearchRow[];
  keywordRows: HybridSearchRow[];
  topK: number;
  minScore: number;
};

type MergedHybridRow = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  metadata: Record<string, unknown>;
  vectorScore: number;
  keywordScore: number;
  score: number;
};

export function mergeHybridSearchRows(
  input: MergeHybridSearchRowsInput,
): KnowledgeSearchHit[] {
  const merged = new Map<string, MergedHybridRow>();

  for (const row of [...input.vectorRows, ...input.keywordRows]) {
    const vectorScore = toScore(row.vectorScore);
    const keywordScore = toScore(row.keywordScore);
    const existing = merged.get(row.chunkId);

    if (!existing) {
      const metadata = toMetadataRecord(row.metadata);
      merged.set(row.chunkId, {
        chunkId: row.chunkId,
        documentId: row.documentId,
        documentName: row.documentName,
        content: row.content,
        metadata,
        vectorScore,
        keywordScore,
        score: calculateHybridScore(vectorScore, keywordScore),
      });
      continue;
    }

    existing.vectorScore = Math.max(existing.vectorScore, vectorScore);
    existing.keywordScore = Math.max(existing.keywordScore, keywordScore);
    existing.score = calculateHybridScore(
      existing.vectorScore,
      existing.keywordScore,
    );
  }

  return [...merged.values()]
    .filter((row) => row.score >= input.minScore)
    .sort(compareMergedRows)
    .slice(0, input.topK)
    .map((row) => ({
      chunkId: row.chunkId,
      documentId: row.documentId,
      documentName: row.documentName,
      content: row.content,
      score: row.score,
      metadata: {
        ...row.metadata,
        retrieval: {
          mode: 'hybrid',
          vectorScore: row.vectorScore,
          keywordScore: row.keywordScore,
        },
      },
    }));
}

function calculateHybridScore(vectorScore: number, keywordScore: number) {
  return clampScore(
    Math.max(
      vectorScore,
      keywordScore * 0.95,
      vectorScore * 0.7 + keywordScore * 0.3,
    ),
  );
}

function compareMergedRows(left: MergedHybridRow, right: MergedHybridRow) {
  return (
    right.score - left.score ||
    right.keywordScore - left.keywordScore ||
    right.vectorScore - left.vectorScore ||
    left.documentName.localeCompare(right.documentName) ||
    left.chunkId.localeCompare(right.chunkId)
  );
}

function toScore(value: number | string | null) {
  const score = Number(value ?? 0);
  if (!Number.isFinite(score)) return 0;
  return clampScore(score);
}

function clampScore(score: number) {
  return Math.max(0, Math.min(1, Number(score.toFixed(6))));
}

function toMetadataRecord(metadata: unknown): Record<string, unknown> {
  if (
    typeof metadata === 'object' &&
    metadata !== null &&
    !Array.isArray(metadata)
  ) {
    return metadata as Record<string, unknown>;
  }

  return {};
}
