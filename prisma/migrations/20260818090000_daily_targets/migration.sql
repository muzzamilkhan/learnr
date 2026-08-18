-- The optional daily target a parent sets on a child, and the column that will
-- become the app's only star total. Nothing is backfilled into the target
-- columns: no target is the correct state for every child that already exists,
-- and a target is a decision a parent makes rather than one that can be guessed
-- from their child's history. `stars` is filled by the next migration, which is
-- where the total it replaces is retired.

ALTER TABLE "User" ADD COLUMN     "targetKind" TEXT,
                  ADD COLUMN     "targetValue" INTEGER,
                  ADD COLUMN     "targetDay" INTEGER,
                  ADD COLUMN     "stars" INTEGER NOT NULL DEFAULT 0;
