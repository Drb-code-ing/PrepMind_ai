CREATE TYPE "BackgroundJobStatus" AS ENUM (
  'QUEUED',
  'ACTIVE',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'STALE_SKIPPED'
);

CREATE TABLE "BackgroundJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "queueName" TEXT NOT NULL,
  "jobName" TEXT NOT NULL,
  "bullJobId" TEXT,
  "status" "BackgroundJobStatus" NOT NULL DEFAULT 'QUEUED',
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "dedupeKey" TEXT,
  "attempt" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "payloadHash" TEXT,
  "payloadPreview" JSONB,
  "resultSummary" JSONB,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BackgroundJob_bullJobId_key"
  ON "BackgroundJob"("bullJobId");

CREATE INDEX "BackgroundJob_userId_status_createdAt_idx"
  ON "BackgroundJob"("userId", "status", "createdAt");

CREATE INDEX "BackgroundJob_userId_resourceType_resourceId_createdAt_idx"
  ON "BackgroundJob"("userId", "resourceType", "resourceId", "createdAt");

CREATE INDEX "BackgroundJob_queueName_status_createdAt_idx"
  ON "BackgroundJob"("queueName", "status", "createdAt");

CREATE INDEX "BackgroundJob_dedupeKey_idx"
  ON "BackgroundJob"("dedupeKey");

CREATE UNIQUE INDEX "BackgroundJob_active_dedupeKey_unique"
  ON "BackgroundJob"("dedupeKey")
  WHERE "status" IN ('QUEUED', 'ACTIVE') AND "dedupeKey" IS NOT NULL;

ALTER TABLE "BackgroundJob"
  ADD CONSTRAINT "BackgroundJob_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
