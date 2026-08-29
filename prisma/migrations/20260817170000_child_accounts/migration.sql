-- Parent and child accounts. A parent sets up child profiles and hands each child
-- a short-lived code to sign in with; a child who signs in with their own Google
-- account is unaffected.
--
-- All of it is columns on "User" - a managed child is still just a User row, so
-- LearningSession, Attempt and TopicSkill need no changes and every existing read
-- of a child's history keeps working.

ALTER TABLE "User" ADD COLUMN     "role" TEXT,
                  ADD COLUMN     "parentId" TEXT,
                  ADD COLUMN     "avatar" TEXT,
                  ADD COLUMN     "loginCode" TEXT,
                  ADD COLUMN     "loginCodeExpiresAt" TIMESTAMP(3);

-- Deliberately no backfill of "role". Null is the "hasn't chosen" state, so every
-- account that already exists meets the chooser once on its next sign-in and says
-- for itself which it is. Guessing on their behalf would be a permanent choice
-- made from no evidence.

ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "User_parentId_idx" ON "User"("parentId");

-- Unique so redemption can look a code up directly and two live codes can never
-- collide. Postgres treats nulls as distinct, so the many rows with no live code
-- - every parent, and every child between codes - do not contend for the value.
CREATE UNIQUE INDEX "User_loginCode_key" ON "User"("loginCode");
