-- CreateEnum
CREATE TYPE "OperatorAuditAction" AS ENUM ('OUTBOX_REQUEUE');

-- CreateEnum
CREATE TYPE "OperatorAuditStatus" AS ENUM ('SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "OperatorAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" "OperatorAuditAction" NOT NULL,
    "status" "OperatorAuditStatus" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "reason" VARCHAR(240),
    "metadata" JSONB,
    "errorCode" TEXT,
    "errorPreview" VARCHAR(240),
    "requestId" VARCHAR(80),
    "ipAddressHash" VARCHAR(80),
    "userAgentHash" VARCHAR(80),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OperatorAuditLog_actorUserId_createdAt_idx" ON "OperatorAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OperatorAuditLog_action_createdAt_idx" ON "OperatorAuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "OperatorAuditLog_targetType_targetId_createdAt_idx" ON "OperatorAuditLog"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "OperatorAuditLog_status_createdAt_idx" ON "OperatorAuditLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "OperatorAuditLog" ADD CONSTRAINT "OperatorAuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
