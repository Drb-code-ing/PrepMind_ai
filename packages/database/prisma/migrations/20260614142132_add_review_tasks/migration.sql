-- CreateEnum
CREATE TYPE "ReviewTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReviewTaskSource" AS ENUM ('FSRS', 'MANUAL', 'PLANNER');

-- CreateTable
CREATE TABLE "ReviewTask" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "reviewLogId" TEXT,
    "scheduledDate" VARCHAR(10) NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "ReviewTaskStatus" NOT NULL DEFAULT 'PENDING',
    "source" "ReviewTaskSource" NOT NULL DEFAULT 'FSRS',
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTask_reviewLogId_key" ON "ReviewTask"("reviewLogId");

-- CreateIndex
CREATE INDEX "ReviewTask_userId_scheduledDate_status_idx" ON "ReviewTask"("userId", "scheduledDate", "status");

-- CreateIndex
CREATE INDEX "ReviewTask_userId_status_dueAt_idx" ON "ReviewTask"("userId", "status", "dueAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewTask_cardId_scheduledDate_key" ON "ReviewTask"("cardId", "scheduledDate");

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewTask" ADD CONSTRAINT "ReviewTask_reviewLogId_fkey" FOREIGN KEY ("reviewLogId") REFERENCES "ReviewLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
