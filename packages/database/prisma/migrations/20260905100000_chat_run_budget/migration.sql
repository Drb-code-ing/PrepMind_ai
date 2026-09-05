-- CreateEnum
CREATE TYPE "ChatRunBudgetStage" AS ENUM ('ROUTER', 'TUTOR', 'RETRIEVER', 'VERIFIER', 'FINAL_RESPONSE', 'WORKER');

CREATE TYPE "ChatRunBudgetReservationStatus" AS ENUM ('RESERVED', 'DISPATCHED', 'SETTLED', 'RELEASED', 'UNCERTAIN');

CREATE TYPE "ChatRunBudgetEventType" AS ENUM ('RESERVED', 'DISPATCHED', 'SETTLED', 'RELEASED', 'UNCERTAIN', 'CANCELLED');

-- CreateTable
CREATE TABLE "ChatRunBudget" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "turnId" TEXT NOT NULL,
  "policyVersion" VARCHAR(80) NOT NULL,
  "maxCalls" INTEGER NOT NULL,
  "maxInputTokens" INTEGER NOT NULL,
  "maxOutputTokens" INTEGER NOT NULL,
  "maxCostMicros" INTEGER NOT NULL,
  "usedCalls" INTEGER NOT NULL DEFAULT 0,
  "usedInputTokens" INTEGER NOT NULL DEFAULT 0,
  "usedOutputTokens" INTEGER NOT NULL DEFAULT 0,
  "usedCostMicros" INTEGER NOT NULL DEFAULT 0,
  "heldCalls" INTEGER NOT NULL DEFAULT 0,
  "heldInputTokens" INTEGER NOT NULL DEFAULT 0,
  "heldOutputTokens" INTEGER NOT NULL DEFAULT 0,
  "heldCostMicros" INTEGER NOT NULL DEFAULT 0,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatRunBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatRunBudgetReservation" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "turnId" TEXT NOT NULL,
  "ledgerId" TEXT NOT NULL,
  "stage" "ChatRunBudgetStage" NOT NULL,
  "status" "ChatRunBudgetReservationStatus" NOT NULL DEFAULT 'RESERVED',
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "costMicros" INTEGER NOT NULL,
  "usageInputTokens" INTEGER NOT NULL DEFAULT 0,
  "usageOutputTokens" INTEGER NOT NULL DEFAULT 0,
  "usageCostMicros" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "releasedAt" TIMESTAMP(3),
  CONSTRAINT "ChatRunBudgetReservation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChatRunBudgetEvent" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "turnId" TEXT NOT NULL,
  "ledgerId" TEXT NOT NULL,
  "reservationId" TEXT,
  "stage" "ChatRunBudgetStage",
  "type" "ChatRunBudgetEventType" NOT NULL,
  "usageInputTokens" INTEGER,
  "usageOutputTokens" INTEGER,
  "usageCostMicros" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatRunBudgetEvent_pkey" PRIMARY KEY ("id")
);

-- Contract checks keep persisted facts aligned with the shared Zod contract.
ALTER TABLE "ChatRunBudget"
  ADD CONSTRAINT "ChatRunBudget_non_negative_check" CHECK (
    char_length("policyVersion") BETWEEN 1 AND 80
    AND "maxCalls" BETWEEN 1 AND 64
    AND "maxInputTokens" BETWEEN 1 AND 1000000
    AND "maxOutputTokens" BETWEEN 1 AND 1000000
    AND "maxCostMicros" BETWEEN 0 AND 2000000000
    AND "usedCalls" >= 0 AND "usedInputTokens" >= 0 AND "usedOutputTokens" >= 0 AND "usedCostMicros" >= 0
    AND "heldCalls" >= 0 AND "heldInputTokens" >= 0 AND "heldOutputTokens" >= 0 AND "heldCostMicros" >= 0
    AND "usedCalls" + "heldCalls" <= "maxCalls"
    AND "usedInputTokens" + "heldInputTokens" <= "maxInputTokens"
    AND "usedOutputTokens" + "heldOutputTokens" <= "maxOutputTokens"
    AND "usedCostMicros" + "heldCostMicros" <= "maxCostMicros"
  );

ALTER TABLE "ChatRunBudgetReservation"
  ADD CONSTRAINT "ChatRunBudgetReservation_values_check" CHECK (
    "inputTokens" BETWEEN 0 AND 1000000
    AND "outputTokens" BETWEEN 0 AND 1000000
    AND "costMicros" BETWEEN 0 AND 2000000000
    AND "usageInputTokens" BETWEEN 0 AND "inputTokens"
    AND "usageOutputTokens" BETWEEN 0 AND "outputTokens"
    AND "usageCostMicros" BETWEEN 0 AND "costMicros"
  ),
  ADD CONSTRAINT "ChatRunBudgetReservation_lifecycle_check" CHECK (
    (
      "status" = 'RESERVED' AND "dispatchedAt" IS NULL AND "settledAt" IS NULL AND "releasedAt" IS NULL
      AND "usageInputTokens" = 0 AND "usageOutputTokens" = 0 AND "usageCostMicros" = 0
    ) OR (
      "status" = 'DISPATCHED' AND "dispatchedAt" IS NOT NULL AND "settledAt" IS NULL AND "releasedAt" IS NULL
      AND "usageInputTokens" = 0 AND "usageOutputTokens" = 0 AND "usageCostMicros" = 0
    ) OR (
      "status" = 'SETTLED' AND "dispatchedAt" IS NOT NULL AND "settledAt" IS NOT NULL AND "releasedAt" IS NULL
    ) OR (
      "status" = 'RELEASED' AND "dispatchedAt" IS NULL AND "settledAt" IS NULL AND "releasedAt" IS NOT NULL
      AND "usageInputTokens" = 0 AND "usageOutputTokens" = 0 AND "usageCostMicros" = 0
    ) OR (
      "status" = 'UNCERTAIN' AND "dispatchedAt" IS NOT NULL AND "settledAt" IS NULL AND "releasedAt" IS NULL
      AND "usageInputTokens" = 0 AND "usageOutputTokens" = 0 AND "usageCostMicros" = 0
    )
  ),
  ADD CONSTRAINT "ChatRunBudgetReservation_timeline_check" CHECK (
    ("dispatchedAt" IS NULL OR "dispatchedAt" >= "createdAt")
    AND ("settledAt" IS NULL OR "settledAt" >= "createdAt")
    AND ("releasedAt" IS NULL OR "releasedAt" >= "createdAt")
    AND ("settledAt" IS NULL OR "dispatchedAt" IS NULL OR "settledAt" >= "dispatchedAt")
  );

ALTER TABLE "ChatRunBudgetEvent"
  ADD CONSTRAINT "ChatRunBudgetEvent_values_check" CHECK (
    ("usageInputTokens" IS NULL OR "usageInputTokens" BETWEEN 0 AND 1000000)
    AND ("usageOutputTokens" IS NULL OR "usageOutputTokens" BETWEEN 0 AND 1000000)
    AND ("usageCostMicros" IS NULL OR "usageCostMicros" BETWEEN 0 AND 2000000000)
  ),
  ADD CONSTRAINT "ChatRunBudgetEvent_contract_check" CHECK (
    (
      "type" = 'CANCELLED' AND "reservationId" IS NULL AND "stage" IS NULL
      AND "usageInputTokens" IS NULL AND "usageOutputTokens" IS NULL AND "usageCostMicros" IS NULL
    ) OR (
      "type" <> 'CANCELLED' AND "reservationId" IS NOT NULL AND "stage" IS NOT NULL
      AND (
        ("type" = 'SETTLED' AND "usageInputTokens" IS NOT NULL AND "usageOutputTokens" IS NOT NULL AND "usageCostMicros" IS NOT NULL)
        OR ("type" <> 'SETTLED' AND "usageInputTokens" IS NULL AND "usageOutputTokens" IS NULL AND "usageCostMicros" IS NULL)
      )
    )
  );

-- CreateIndex
CREATE UNIQUE INDEX "ChatRunBudget_id_userId_key" ON "ChatRunBudget"("id", "userId");
CREATE UNIQUE INDEX "ChatRunBudget_turnId_userId_key" ON "ChatRunBudget"("turnId", "userId");
CREATE INDEX "ChatRunBudget_userId_cancelledAt_idx" ON "ChatRunBudget"("userId", "cancelledAt");

CREATE UNIQUE INDEX "ChatRunBudgetReservation_id_userId_key" ON "ChatRunBudgetReservation"("id", "userId");
CREATE INDEX "ChatRunBudgetReservation_userId_turnId_status_idx" ON "ChatRunBudgetReservation"("userId", "turnId", "status");
CREATE INDEX "ChatRunBudgetReservation_userId_ledgerId_stage_idx" ON "ChatRunBudgetReservation"("userId", "ledgerId", "stage");

CREATE UNIQUE INDEX "ChatRunBudgetEvent_id_userId_key" ON "ChatRunBudgetEvent"("id", "userId");
CREATE INDEX "ChatRunBudgetEvent_userId_turnId_createdAt_idx" ON "ChatRunBudgetEvent"("userId", "turnId", "createdAt");
CREATE INDEX "ChatRunBudgetEvent_userId_ledgerId_createdAt_idx" ON "ChatRunBudgetEvent"("userId", "ledgerId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatRunBudget" ADD CONSTRAINT "ChatRunBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRunBudget" ADD CONSTRAINT "ChatRunBudget_turnId_userId_fkey" FOREIGN KEY ("turnId", "userId") REFERENCES "ChatTurn"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatRunBudgetReservation" ADD CONSTRAINT "ChatRunBudgetReservation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRunBudgetReservation" ADD CONSTRAINT "ChatRunBudgetReservation_turnId_userId_fkey" FOREIGN KEY ("turnId", "userId") REFERENCES "ChatTurn"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRunBudgetReservation" ADD CONSTRAINT "ChatRunBudgetReservation_ledgerId_userId_fkey" FOREIGN KEY ("ledgerId", "userId") REFERENCES "ChatRunBudget"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatRunBudgetEvent" ADD CONSTRAINT "ChatRunBudgetEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRunBudgetEvent" ADD CONSTRAINT "ChatRunBudgetEvent_turnId_userId_fkey" FOREIGN KEY ("turnId", "userId") REFERENCES "ChatTurn"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRunBudgetEvent" ADD CONSTRAINT "ChatRunBudgetEvent_ledgerId_userId_fkey" FOREIGN KEY ("ledgerId", "userId") REFERENCES "ChatRunBudget"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRunBudgetEvent" ADD CONSTRAINT "ChatRunBudgetEvent_reservationId_userId_fkey" FOREIGN KEY ("reservationId", "userId") REFERENCES "ChatRunBudgetReservation"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
