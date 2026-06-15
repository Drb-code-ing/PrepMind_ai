ALTER TABLE "ReviewLog" ADD COLUMN "clientMutationId" TEXT;

CREATE UNIQUE INDEX "ReviewLog_clientMutationId_key" ON "ReviewLog"("clientMutationId");
