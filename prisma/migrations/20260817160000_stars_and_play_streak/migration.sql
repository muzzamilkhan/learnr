-- Gamification: stars for finishing a round of ten questions, and a day streak
-- for coming back. Both are rewards and nothing about which question is asked
-- next reads either of them.

-- Counted in the child's local days, so the "when" column is a day number rather
-- than a timestamp — see `src/lib/day.ts` for why a day is never the server's.
ALTER TABLE "User" ADD COLUMN     "playStreak" INTEGER NOT NULL DEFAULT 0,
                  ADD COLUMN     "playStreakDay" INTEGER;

ALTER TABLE "LearningSession" ADD COLUMN     "stars" INTEGER NOT NULL DEFAULT 0;

-- Backfill both from the attempts, which are the only history there is, so a
-- child who has been playing does not open the app on a blank tally.

-- One row per session: ten answers is a closed round, and its stars are 3 for a
-- clean round, 1 for a round with nothing right, 2 for anything between. The
-- part-finished round at the end of a sitting earns nothing, which is why the
-- ordering column matters — `starsEarned` chunks from the *first* answer.
WITH numbered AS (
  SELECT
    "learningSessionId",
    "correct",
    (row_number() OVER (PARTITION BY "learningSessionId" ORDER BY "answeredAt", "id") - 1) / 10 AS round
  FROM "Attempt"
),
scored AS (
  SELECT "learningSessionId", round, COUNT(*) FILTER (WHERE "correct") AS correct
  FROM numbered
  GROUP BY "learningSessionId", round
  HAVING COUNT(*) = 10
),
totals AS (
  SELECT "learningSessionId",
         SUM(CASE WHEN correct = 10 THEN 3 WHEN correct > 0 THEN 2 ELSE 1 END) AS stars
  FROM scored
  GROUP BY "learningSessionId"
)
UPDATE "LearningSession" ls
SET "stars" = totals.stars
FROM totals
WHERE ls."id" = totals."learningSessionId";

-- The streak is only meaningful up to the last day played: a run that ended a
-- month ago reads as zero anyway (`currentStreak`), so all this has to get right
-- is the run that is still live. Count back from the most recent day played
-- while the days are consecutive.
WITH days AS (
  SELECT DISTINCT
    ls."userId",
    floor((extract(epoch FROM a."answeredAt") + a."offsetMinutes" * 60) / 86400)::int AS day
  FROM "Attempt" a
  JOIN "LearningSession" ls ON ls."id" = a."learningSessionId"
),
-- Consecutive days share (day - row_number()), so that difference groups a run.
grouped AS (
  SELECT "userId", day, day - (row_number() OVER (PARTITION BY "userId" ORDER BY day))::int AS run
  FROM days
),
runs AS (
  SELECT "userId", run, COUNT(*) AS length, MAX(day) AS "lastDay"
  FROM grouped
  GROUP BY "userId", run
),
latest AS (
  SELECT DISTINCT ON ("userId") "userId", length, "lastDay"
  FROM runs
  ORDER BY "userId", "lastDay" DESC
)
UPDATE "User" u
SET "playStreak" = latest.length,
    "playStreakDay" = latest."lastDay"
FROM latest
WHERE u."id" = latest."userId";
