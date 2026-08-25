-- CreateEnum
CREATE TYPE "ChatTurnStatus" AS ENUM ('QUEUED', 'ACTIVE', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ChatTurnErrorCode" AS ENUM (
  'CANCELLED_BY_USER',
  'BUDGET_EXHAUSTED',
  'GENERATION_ABORTED',
  'GENERATION_TIMEOUT',
  'PROVIDER_FAILURE',
  'OUTPUT_INVALID',
  'INTERNAL_FAILURE'
);

-- CreateTable
CREATE TABLE "ChatTurn" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "clientRequestId" VARCHAR(120) NOT NULL,
  "status" "ChatTurnStatus" NOT NULL DEFAULT 'QUEUED',
  "inputHash" VARCHAR(71) NOT NULL,
  "inputMessageIds" TEXT[] NOT NULL,
  "budgetPolicyVersion" VARCHAR(80) NOT NULL,
  "responseMessageId" TEXT,
  "errorCode" "ChatTurnErrorCode",
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ChatTurn_pkey" PRIMARY KEY ("id")
);

-- AddConstraint
ALTER TABLE "ChatTurn"
  ADD CONSTRAINT "ChatTurn_input_contract_check" CHECK (
    "inputHash" ~ '^sha256:[0-9a-f]{64}$'
    AND cardinality("inputMessageIds") BETWEEN 1 AND 1000
    AND char_length("clientRequestId") BETWEEN 1 AND 120
    AND char_length("budgetPolicyVersion") BETWEEN 1 AND 80
  ),
  ADD CONSTRAINT "ChatTurn_lifecycle_check" CHECK (
    (
      "status" = 'QUEUED'
      AND "startedAt" IS NULL
      AND "finishedAt" IS NULL
      AND "responseMessageId" IS NULL
      AND "errorCode" IS NULL
    )
    OR (
      "status" = 'ACTIVE'
      AND "startedAt" IS NOT NULL
      AND "finishedAt" IS NULL
      AND "responseMessageId" IS NULL
      AND "errorCode" IS NULL
    )
    OR (
      "status" = 'SUCCEEDED'
      AND "startedAt" IS NOT NULL
      AND "finishedAt" IS NOT NULL
      AND "responseMessageId" IS NOT NULL
      AND "errorCode" IS NULL
    )
    OR (
      "status" = 'FAILED'
      AND "startedAt" IS NOT NULL
      AND "finishedAt" IS NOT NULL
      AND "responseMessageId" IS NULL
      AND "errorCode" IS NOT NULL
    )
    OR (
      "status" = 'CANCELLED'
      AND "finishedAt" IS NOT NULL
      AND "responseMessageId" IS NULL
      AND "errorCode" IS NOT NULL
    )
  ),
  ADD CONSTRAINT "ChatTurn_timeline_check" CHECK (
    ("startedAt" IS NULL OR "startedAt" >= "createdAt")
    AND ("finishedAt" IS NULL OR "finishedAt" >= "createdAt")
    AND (
      "startedAt" IS NULL
      OR "finishedAt" IS NULL
      OR "finishedAt" >= "startedAt"
    )
  );

-- CreateIndex
CREATE UNIQUE INDEX "ChatMessage_id_userId_key" ON "ChatMessage"("id", "userId");

CREATE UNIQUE INDEX "ChatTurn_id_userId_key" ON "ChatTurn"("id", "userId");

CREATE UNIQUE INDEX "ChatTurn_userId_clientRequestId_key" ON "ChatTurn"("userId", "clientRequestId");

CREATE UNIQUE INDEX "ChatTurn_responseMessageId_userId_key" ON "ChatTurn"("responseMessageId", "userId");

CREATE INDEX "ChatTurn_userId_conversationId_createdAt_idx" ON "ChatTurn"("userId", "conversationId", "createdAt");

CREATE INDEX "ChatTurn_userId_status_createdAt_idx" ON "ChatTurn"("userId", "status", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatTurn" ADD CONSTRAINT "ChatTurn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatTurn" ADD CONSTRAINT "ChatTurn_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "Conversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatTurn" ADD CONSTRAINT "ChatTurn_responseMessageId_userId_fkey" FOREIGN KEY ("responseMessageId", "userId") REFERENCES "ChatMessage"("id", "userId") ON DELETE RESTRICT ON UPDATE CASCADE;
