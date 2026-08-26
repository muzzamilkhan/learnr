-- Every record set before `SpeedAttempt` existed, as one run.
--
-- `SpeedRecord` is the maximum and was the only thing kept, so the history the
-- cabinet now draws starts empty: a player with four records saw four blank
-- cards while the leaderboard, which still reads the records, showed the same
-- four scores. One run each is all that can honestly be recovered - a best is
-- the only run that was ever written down - and it carries the record's own
-- `achievedAt`, so the date under it is the date it was set.
--
-- Skipped where an attempt for that player and mode already exists, so a run
-- finished between the deploy and this migration is not counted twice.
INSERT INTO "SpeedAttempt" ("id", "userId", "mode", "correct", "answered", "playedAt")
SELECT
  -- Derived from the record's own id, so re-running this migration against a
  -- database that already has the rows collides on the primary key rather than
  -- inserting a second copy.
  'backfill_' || r."id",
  r."userId",
  r."mode",
  r."best",
  r."answered",
  r."achievedAt"
FROM "SpeedRecord" r
WHERE NOT EXISTS (
  SELECT 1 FROM "SpeedAttempt" a
  WHERE a."userId" = r."userId" AND a."mode" = r."mode"
);
