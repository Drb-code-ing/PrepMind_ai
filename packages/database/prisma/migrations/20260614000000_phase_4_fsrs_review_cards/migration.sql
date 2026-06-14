-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_questionId_fkey";

-- DropForeignKey
ALTER TABLE "Card" DROP CONSTRAINT "Card_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReviewLog" DROP CONSTRAINT "ReviewLog_cardId_fkey";

-- AlterTable
ALTER TABLE "Card" ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "wrongQuestionId" TEXT,
ALTER COLUMN "questionId" DROP NOT NULL,
ALTER COLUMN "lastReview" DROP NOT NULL,
ALTER COLUMN "lastReview" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReviewLog" ADD COLUMN     "elapsedDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reviewDurationMs" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Card_wrongQuestionId_key" ON "Card"("wrongQuestionId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_wrongQuestionId_fkey" FOREIGN KEY ("wrongQuestionId") REFERENCES "WrongQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewLog" ADD CONSTRAINT "ReviewLog_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE CASCADE ON UPDATE CASCADE;
