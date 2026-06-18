-- CreateEnum
CREATE TYPE "DocumentSourceType" AS ENUM ('UPLOAD', 'NOTE', 'WRONG_QUESTION', 'OCR', 'CHAT');

-- DropForeignKey
ALTER TABLE "Document" DROP CONSTRAINT "Document_userId_fkey";

-- AlterTable
ALTER TABLE "Chunk" ADD COLUMN     "tokenCount" INTEGER;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "contentHash" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3),
ADD COLUMN     "sourceType" "DocumentSourceType" NOT NULL DEFAULT 'UPLOAD';

-- CreateIndex
CREATE INDEX "Document_userId_status_updatedAt_idx" ON "Document"("userId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_userId_sourceType_updatedAt_idx" ON "Document"("userId", "sourceType", "updatedAt");

-- CreateIndex
CREATE INDEX "Document_contentHash_idx" ON "Document"("contentHash");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
