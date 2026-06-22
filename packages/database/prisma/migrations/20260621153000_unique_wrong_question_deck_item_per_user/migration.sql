WITH ranked AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "userId", "wrongQuestionId"
            ORDER BY "createdAt" ASC, "id" ASC
        ) AS row_number
    FROM "WrongQuestionDeckItem"
)
DELETE FROM "WrongQuestionDeckItem" AS item
USING ranked
WHERE item."id" = ranked."id"
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX "WrongQuestionDeckItem_userId_wrongQuestionId_key"
ON "WrongQuestionDeckItem"("userId", "wrongQuestionId");
