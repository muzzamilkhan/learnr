-- Stars move from a sum over sittings, recounted from the answers, to one
-- incremented total on the child.
--
-- The sum had to go because a daily target is mutable. A child who hits a
-- 10-question target on Monday and has it raised to 40 on Tuesday would fail a
-- recount of Monday, and lose stars they had already been shown. So the total is
-- banked as it is earned, and each award is guarded instead of being made
-- repeatable: "roundsBanked" for a round of ten, "targetDay" for a day's target.

ALTER TABLE "LearningSession" ADD COLUMN "roundsBanked" INTEGER NOT NULL DEFAULT 0;

-- Every closed round of every sitting, valued the way `starsEarned` values one:
-- 3 for a clean round, 1 for a round with nothing right, 2 for anything between.
-- A part-finished round at the end of a sitting is worth nothing, which is why
-- the ordering matters - rounds chunk from the *first* answer.
WITH numbered AS (
  SELECT
    a."learningSessionId",
    ls."userId",
    a."correct",
    (row_number() OVER (PARTITION BY a."learningSessionId" ORDER BY a."answeredAt", a."id") - 1) / 10 AS round
  FROM "Attempt" a
  JOIN "LearningSession" ls ON ls."id" = a."learningSessionId"
),
scored AS (
  SELECT "userId", "learningSessionId", round, COUNT(*) FILTER (WHERE "correct") AS correct
  FROM numbered
  GROUP BY "userId", "learningSessionId", round
  HAVING COUNT(*) = 10
),
per_session AS (
  SELECT "learningSessionId", COUNT(*) AS rounds
  FROM scored
  GROUP BY "learningSessionId"
)
UPDATE "LearningSession" ls
SET "roundsBanked" = per_session.rounds
FROM per_session
WHERE ls."id" = per_session."learningSessionId";

-- The child's total is recounted from the answers one last time rather than
-- summed from the old column, so any award that was dropped before today is paid
-- at last. This migration can only move a total up.
WITH numbered AS (
  SELECT
    a."learningSessionId",
    ls."userId",
    a."correct",
    (row_number() OVER (PARTITION BY a."learningSessionId" ORDER BY a."answeredAt", a."id") - 1) / 10 AS round
  FROM "Attempt" a
  JOIN "LearningSession" ls ON ls."id" = a."learningSessionId"
),
scored AS (
  SELECT "userId", "learningSessionId", round, COUNT(*) FILTER (WHERE "correct") AS correct
  FROM numbered
  GROUP BY "userId", "learningSessionId", round
  HAVING COUNT(*) = 10
),
per_user AS (
  SELECT "userId",
         SUM(CASE WHEN correct = 10 THEN 3 WHEN correct > 0 THEN 2 ELSE 1 END) AS stars
  FROM scored
  GROUP BY "userId"
)
UPDATE "User" u
SET "stars" = per_user.stars
FROM per_user
WHERE u."id" = per_user."userId";

-- The sum this replaces. Its data has been carried onto "User"."stars" above.
ALTER TABLE "LearningSession" DROP COLUMN "stars";
