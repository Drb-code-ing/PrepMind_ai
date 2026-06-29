CREATE UNIQUE INDEX "Document_userId_sourceType_contentHash_upload_unique"
ON "Document"("userId", "sourceType", "contentHash")
WHERE "contentHash" IS NOT NULL;
