-- A speed run only moves on a correct answer, so there is no longer a count of
-- questions answered that differs from the count got right. `answered` was the
-- second number, and with the two collapsed into one it is a column that can
-- only ever repeat `correct`.
--
-- Nothing is backfilled and nothing is recoverable: the stored `answered` was
-- the number of attempts under the old rules, which no future run will produce.
-- Keeping it would mean every row written from here on carried a copy of
-- `correct` under a name that used to mean something else, which is worse than
-- losing it - the cabinet and the report both read it, and "8 of 8" on every
-- new row beside "8 of 20" on an old one is a column that lies about both.
ALTER TABLE "SpeedRecord" DROP COLUMN "answered";
ALTER TABLE "SpeedAttempt" DROP COLUMN "answered";
