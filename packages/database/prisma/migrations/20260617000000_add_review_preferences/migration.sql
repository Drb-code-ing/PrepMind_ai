CREATE TABLE "ReviewPreference" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dailyMinutes" INTEGER NOT NULL DEFAULT 25,
  "dailyCardLimit" INTEGER NOT NULL DEFAULT 12,
  "preferredReviewTime" VARCHAR(5) NOT NULL DEFAULT '20:30',
  "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
  "reminderLeadMinutes" INTEGER NOT NULL DEFAULT 30,
  "weekendMode" VARCHAR(16) NOT NULL DEFAULT 'same',
  "planWindowDays" INTEGER NOT NULL DEFAULT 7,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewPreference_userId_key" ON "ReviewPreference"("userId");

ALTER TABLE "ReviewPreference"
ADD CONSTRAINT "ReviewPreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
