-- CreateEnum
CREATE TYPE "ConversationSummaryMode" AS ENUM ('MOCK', 'LIVE');

-- CreateTable
CREATE TABLE "ConversationSummary" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "coveredThroughOrder" INTEGER NOT NULL,
  "sourceMessageCount" INTEGER NOT NULL,
  "sourceHash" VARCHAR(71) NOT NULL,
  "summaryVersion" INTEGER NOT NULL DEFAULT 1,
  "modelMode" "ConversationSummaryMode" NOT NULL,
  "modelProvider" VARCHAR(80) NOT NULL,
  "modelName" VARCHAR(120) NOT NULL,
  "promptVersion" VARCHAR(80) NOT NULL,
  "inputTokenCount" INTEGER NOT NULL,
  "outputTokenCount" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConversationSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversationState" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "activeGoal" VARCHAR(300),
  "activeQuestionId" VARCHAR(100),
  "pendingActionProposal" JSONB,
  "lastToolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "stateVersion" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ConversationState_pkey" PRIMARY KEY ("id")
);

-- AddConstraint
ALTER TABLE "ConversationSummary"
  ADD CONSTRAINT "ConversationSummary_watermark_check" CHECK (
    "coveredThroughOrder" >= 0 AND
    "coveredThroughOrder" <= 2147483647 AND
    "sourceMessageCount" BETWEEN 1 AND 1000000 AND
    "summaryVersion" > 0 AND
    "summaryVersion" <= 2147483647 AND
    "inputTokenCount" BETWEEN 0 AND 12000 AND
    "outputTokenCount" BETWEEN 0 AND 12000 AND
    "sourceHash" ~ '^sha256:[0-9a-f]{64}$' AND
    char_length("summary") BETWEEN 1 AND 4000
  );

ALTER TABLE "ConversationState"
  ADD CONSTRAINT "ConversationState_version_check" CHECK ("stateVersion" BETWEEN 1 AND 2147483647),
  ADD CONSTRAINT "ConversationState_expiry_check" CHECK ("expiresAt" > "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_id_userId_key" ON "Conversation"("id", "userId");

CREATE UNIQUE INDEX "ConversationSummary_conversationId_key" ON "ConversationSummary"("conversationId");

CREATE UNIQUE INDEX "ConversationSummary_conversationId_userId_key" ON "ConversationSummary"("conversationId", "userId");

CREATE INDEX "ConversationSummary_userId_conversationId_idx" ON "ConversationSummary"("userId", "conversationId");

CREATE UNIQUE INDEX "ConversationState_conversationId_key" ON "ConversationState"("conversationId");

CREATE UNIQUE INDEX "ConversationState_conversationId_userId_key" ON "ConversationState"("conversationId", "userId");

CREATE INDEX "ConversationState_userId_updatedAt_idx" ON "ConversationState"("userId", "updatedAt");

CREATE INDEX "ConversationState_expiresAt_idx" ON "ConversationState"("expiresAt");

-- AddForeignKey
ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "Conversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationSummary" ADD CONSTRAINT "ConversationSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_conversationId_userId_fkey" FOREIGN KEY ("conversationId", "userId") REFERENCES "Conversation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ConversationState" ADD CONSTRAINT "ConversationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
