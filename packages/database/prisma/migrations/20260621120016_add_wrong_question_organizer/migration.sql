-- CreateEnum
CREATE TYPE "WrongQuestionDeckSource" AS ENUM ('AI', 'USER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WrongQuestionDeckItemSource" AS ENUM ('AI', 'USER', 'SYSTEM');

-- CreateTable
CREATE TABLE "WrongQuestionSubjectGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WrongQuestionSubjectGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WrongQuestionDeck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subjectGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" "WrongQuestionDeckSource" NOT NULL DEFAULT 'AI',
    "nameLocked" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WrongQuestionDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WrongQuestionDeckItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "wrongQuestionId" TEXT NOT NULL,
    "reason" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "source" "WrongQuestionDeckItemSource" NOT NULL DEFAULT 'AI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WrongQuestionDeckItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WrongQuestion_id_userId_key" ON "WrongQuestion"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "WrongQuestionSubjectGroup_id_userId_key" ON "WrongQuestionSubjectGroup"("id", "userId");

-- CreateIndex
CREATE INDEX "WrongQuestionSubjectGroup_userId_sortOrder_idx" ON "WrongQuestionSubjectGroup"("userId", "sortOrder");

-- CreateIndex
CREATE INDEX "WrongQuestionSubjectGroup_userId_updatedAt_idx" ON "WrongQuestionSubjectGroup"("userId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WrongQuestionSubjectGroup_userId_subject_key" ON "WrongQuestionSubjectGroup"("userId", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "WrongQuestionDeck_id_userId_key" ON "WrongQuestionDeck"("id", "userId");

-- CreateIndex
CREATE INDEX "WrongQuestionDeck_subjectGroupId_userId_idx" ON "WrongQuestionDeck"("subjectGroupId", "userId");

-- CreateIndex
CREATE INDEX "WrongQuestionDeck_userId_subjectGroupId_updatedAt_idx" ON "WrongQuestionDeck"("userId", "subjectGroupId", "updatedAt");

-- CreateIndex
CREATE INDEX "WrongQuestionDeck_userId_updatedAt_idx" ON "WrongQuestionDeck"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "WrongQuestionDeckItem_wrongQuestionId_userId_idx" ON "WrongQuestionDeckItem"("wrongQuestionId", "userId");

-- CreateIndex
CREATE INDEX "WrongQuestionDeckItem_userId_wrongQuestionId_idx" ON "WrongQuestionDeckItem"("userId", "wrongQuestionId");

-- CreateIndex
CREATE INDEX "WrongQuestionDeckItem_userId_deckId_idx" ON "WrongQuestionDeckItem"("userId", "deckId");

-- CreateIndex
CREATE UNIQUE INDEX "WrongQuestionDeckItem_deckId_wrongQuestionId_key" ON "WrongQuestionDeckItem"("deckId", "wrongQuestionId");

-- AddForeignKey
ALTER TABLE "WrongQuestionSubjectGroup" ADD CONSTRAINT "WrongQuestionSubjectGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrongQuestionDeck" ADD CONSTRAINT "WrongQuestionDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrongQuestionDeck" ADD CONSTRAINT "WrongQuestionDeck_subjectGroupId_userId_fkey" FOREIGN KEY ("subjectGroupId", "userId") REFERENCES "WrongQuestionSubjectGroup"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrongQuestionDeckItem" ADD CONSTRAINT "WrongQuestionDeckItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrongQuestionDeckItem" ADD CONSTRAINT "WrongQuestionDeckItem_deckId_userId_fkey" FOREIGN KEY ("deckId", "userId") REFERENCES "WrongQuestionDeck"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WrongQuestionDeckItem" ADD CONSTRAINT "WrongQuestionDeckItem_wrongQuestionId_userId_fkey" FOREIGN KEY ("wrongQuestionId", "userId") REFERENCES "WrongQuestion"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;
