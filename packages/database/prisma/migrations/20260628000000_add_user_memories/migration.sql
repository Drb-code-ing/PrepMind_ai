CREATE TYPE "UserMemoryType" AS ENUM (
  'LEARNING_GOAL',
  'EXPLANATION_PREFERENCE',
  'WEAK_POINT',
  'STUDY_HABIT'
);

CREATE TYPE "UserMemoryCandidateStatus" AS ENUM (
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED'
);

CREATE TYPE "UserMemoryStatus" AS ENUM (
  'ACTIVE',
  'ARCHIVED'
);

CREATE TABLE "UserMemory" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "UserMemoryType" NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "content" TEXT NOT NULL,
  "status" "UserMemoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "sourceCandidateId" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "lastUsedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserMemory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserMemoryCandidate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "UserMemoryType" NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "content" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidence" JSONB NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  "status" "UserMemoryCandidateStatus" NOT NULL DEFAULT 'PENDING',
  "sourceHash" TEXT NOT NULL,
  "acceptedMemoryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "decidedAt" TIMESTAMP(3),
  CONSTRAINT "UserMemoryCandidate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMemoryCandidate_userId_sourceHash_key"
  ON "UserMemoryCandidate"("userId", "sourceHash");

CREATE INDEX "UserMemoryCandidate_userId_status_updatedAt_idx"
  ON "UserMemoryCandidate"("userId", "status", "updatedAt");

CREATE INDEX "UserMemoryCandidate_userId_type_updatedAt_idx"
  ON "UserMemoryCandidate"("userId", "type", "updatedAt");

CREATE INDEX "UserMemory_userId_status_updatedAt_idx"
  ON "UserMemory"("userId", "status", "updatedAt");

CREATE INDEX "UserMemory_userId_type_updatedAt_idx"
  ON "UserMemory"("userId", "type", "updatedAt");

CREATE UNIQUE INDEX "UserMemory_sourceCandidateId_key"
  ON "UserMemory"("sourceCandidateId");

ALTER TABLE "UserMemory"
  ADD CONSTRAINT "UserMemory_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMemoryCandidate"
  ADD CONSTRAINT "UserMemoryCandidate_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserMemoryCandidate"
  ADD CONSTRAINT "UserMemoryCandidate_acceptedMemoryId_fkey"
  FOREIGN KEY ("acceptedMemoryId") REFERENCES "UserMemory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
