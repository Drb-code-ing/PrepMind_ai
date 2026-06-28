CREATE TYPE "AgentTraceStatus" AS ENUM (
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'DEGRADED'
);

CREATE TYPE "AgentTraceMode" AS ENUM (
  'MOCK',
  'LIVE'
);

CREATE TABLE "AgentTraceRun" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT,
  "route" TEXT,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "AgentTraceStatus" NOT NULL DEFAULT 'COMPLETED',
  "mode" "AgentTraceMode" NOT NULL,
  "modelProvider" TEXT NOT NULL,
  "modelName" TEXT NOT NULL,
  "inputTokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "outputTokenEstimate" INTEGER NOT NULL DEFAULT 0,
  "maxOutputTokens" INTEGER NOT NULL DEFAULT 0,
  "pricingKnown" BOOLEAN NOT NULL DEFAULT true,
  "costEstimate" DECIMAL(12, 6) NOT NULL DEFAULT 0,
  "ragHitCount" INTEGER NOT NULL DEFAULT 0,
  "verifierStatus" TEXT,
  "verifierChunkCount" INTEGER NOT NULL DEFAULT 0,
  "tutorIntent" TEXT,
  "tutorDepth" TEXT,
  "degraded" BOOLEAN NOT NULL DEFAULT false,
  "inputHash" TEXT,
  "inputPreview" VARCHAR(80),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "totalDurationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgentTraceRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgentTraceStep" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "runId" TEXT NOT NULL,
  "node" TEXT NOT NULL,
  "status" "AgentTraceStatus" NOT NULL DEFAULT 'COMPLETED',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "finishedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "inputSummary" VARCHAR(160) NOT NULL,
  "outputSummary" VARCHAR(160) NOT NULL,
  "errorMessage" VARCHAR(240),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentTraceStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentTraceRun_id_userId_key"
  ON "AgentTraceRun"("id", "userId");

CREATE INDEX "AgentTraceRun_userId_createdAt_idx"
  ON "AgentTraceRun"("userId", "createdAt");

CREATE INDEX "AgentTraceRun_userId_route_createdAt_idx"
  ON "AgentTraceRun"("userId", "route", "createdAt");

CREATE INDEX "AgentTraceRun_userId_mode_createdAt_idx"
  ON "AgentTraceRun"("userId", "mode", "createdAt");

CREATE INDEX "AgentTraceStep_userId_runId_idx"
  ON "AgentTraceStep"("userId", "runId");

CREATE INDEX "AgentTraceStep_userId_node_createdAt_idx"
  ON "AgentTraceStep"("userId", "node", "createdAt");

ALTER TABLE "AgentTraceRun"
  ADD CONSTRAINT "AgentTraceRun_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentTraceStep"
  ADD CONSTRAINT "AgentTraceStep_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgentTraceStep"
  ADD CONSTRAINT "AgentTraceStep_runId_userId_fkey"
  FOREIGN KEY ("runId", "userId") REFERENCES "AgentTraceRun"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
