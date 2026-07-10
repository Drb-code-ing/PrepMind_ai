-- CreateEnum
CREATE TYPE "BackgroundJobScope" AS ENUM ('ACCOUNT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OperatorAuditExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OperatorAuditMaintenanceStatus" AS ENUM ('IDLE', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- AlterEnum
ALTER TYPE "OperatorAuditAction" ADD VALUE 'AUDIT_EXPORT_REQUEST';
ALTER TYPE "OperatorAuditAction" ADD VALUE 'AUDIT_EXPORT_DOWNLOAD';

-- AlterTable
ALTER TABLE "BackgroundJob"
  ADD COLUMN "scope" "BackgroundJobScope" NOT NULL DEFAULT 'ACCOUNT',
  ALTER COLUMN "userId" DROP NOT NULL;

-- AddConstraint
ALTER TABLE "BackgroundJob"
  ADD CONSTRAINT "BackgroundJob_scope_user_check" CHECK (
    ("scope" = 'ACCOUNT' AND "userId" IS NOT NULL) OR
    ("scope" = 'SYSTEM' AND "userId" IS NULL)
  );

-- CreateTable
CREATE TABLE "OperatorAuditExport" (
  "id" TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "clientRequestId" VARCHAR(80) NOT NULL,
  "requestHash" VARCHAR(71) NOT NULL,
  "backgroundJobId" TEXT NOT NULL,
  "status" "OperatorAuditExportStatus" NOT NULL DEFAULT 'QUEUED',
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "snapshotAt" TIMESTAMP(3) NOT NULL,
  "filterAction" "OperatorAuditAction",
  "filterStatus" "OperatorAuditStatus",
  "filterTargetType" VARCHAR(120),
  "filterTargetId" VARCHAR(200),
  "filterActorUserId" TEXT,
  "reason" VARCHAR(240) NOT NULL,
  "objectKey" VARCHAR(500),
  "fileName" VARCHAR(180),
  "archiveSize" INTEGER,
  "recordCount" INTEGER,
  "csvSha256" VARCHAR(71),
  "archiveSha256" VARCHAR(71),
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "errorCode" VARCHAR(120),
  "errorPreview" VARCHAR(240),
  "processingToken" VARCHAR(80),
  "leaseExpiresAt" TIMESTAMP(3),
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "expiredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperatorAuditExport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorAuditMaintenanceState" (
  "name" TEXT NOT NULL,
  "lastStartedAt" TIMESTAMP(3),
  "lastSucceededAt" TIMESTAMP(3),
  "lastFinishedAt" TIMESTAMP(3),
  "status" "OperatorAuditMaintenanceStatus" NOT NULL DEFAULT 'IDLE',
  "expiredExportCount" INTEGER NOT NULL DEFAULT 0,
  "deletedAuditCount" INTEGER NOT NULL DEFAULT 0,
  "deletedExportCount" INTEGER NOT NULL DEFAULT 0,
  "errorCode" VARCHAR(120),
  "errorPreview" VARCHAR(240),
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperatorAuditMaintenanceState_pkey" PRIMARY KEY ("name")
);

-- CreateIndex
CREATE INDEX "BackgroundJob_scope_status_createdAt_idx" ON "BackgroundJob"("scope", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OperatorAuditLog_createdAt_id_idx" ON "OperatorAuditLog"("createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorAuditExport_backgroundJobId_key" ON "OperatorAuditExport"("backgroundJobId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorAuditExport_objectKey_key" ON "OperatorAuditExport"("objectKey");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorAuditExport_requestedByUserId_clientRequestId_key" ON "OperatorAuditExport"("requestedByUserId", "clientRequestId");

-- CreateIndex
CREATE INDEX "OperatorAuditExport_requestedByUserId_createdAt_idx" ON "OperatorAuditExport"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OperatorAuditExport_status_expiresAt_idx" ON "OperatorAuditExport"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "OperatorAuditExport_status_startAt_idx" ON "OperatorAuditExport"("status", "startAt");

-- CreateIndex
CREATE INDEX "OperatorAuditExport_createdAt_id_idx" ON "OperatorAuditExport"("createdAt", "id");

-- AddForeignKey
ALTER TABLE "OperatorAuditExport" ADD CONSTRAINT "OperatorAuditExport_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
