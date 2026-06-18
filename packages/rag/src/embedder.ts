export type EmbeddingProvider = {
  model: string;
  dimensions: number;
  embedBatch(texts: string[]): Promise<number[][]>;
};

export function assertEmbeddingDimensions(vector: number[], dimensions: number) {
  if (vector.length !== dimensions) {
    throw new Error(
      `Expected embedding dimension ${dimensions} but received ${vector.length}`,
    );
  }

  vector.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      throw new Error(`Embedding vector contains a non-finite value at index ${index}`);
    }
  });
}

export function assertEmbeddingBatchDimensions(
  vectors: number[][],
  dimensions: number,
  expectedCount: number,
) {
  if (vectors.length !== expectedCount) {
    throw new Error(
      `Expected ${expectedCount} embeddings but received ${vectors.length}`,
    );
  }

  vectors.forEach((vector) => assertEmbeddingDimensions(vector, dimensions));
}
