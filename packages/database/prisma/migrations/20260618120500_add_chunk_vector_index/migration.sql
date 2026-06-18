CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Chunk"
ALTER COLUMN "embedding" TYPE vector(1536)
USING "embedding"::vector(1536);

CREATE INDEX IF NOT EXISTS "Chunk_embedding_vector_cosine_idx"
ON "Chunk"
USING ivfflat ("embedding" vector_cosine_ops)
WITH (lists = 100);
