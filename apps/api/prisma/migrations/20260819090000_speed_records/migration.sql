-- Speed runs keep one row per player per mode: their best, and nothing else.
--
-- Deliberately not an Attempt. An Attempt carries a curriculum topic and an
-- Australian school year, and a speed run has neither - writing forty of them in
-- ninety seconds would put a topic that is not in the curriculum into the
-- selector that decides what a child is asked next, and would swamp the
-- recency-weighted strength of everything genuinely being learned.
--
-- "seen" defaults to true because a first run is not a record and announces
-- nothing. It is set false only when a previous best is beaten, which is what
-- makes the parent's banner fire once per real achievement.

CREATE TABLE "SpeedRecord" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "mode"       TEXT NOT NULL,
  "best"       INTEGER NOT NULL,
  "answered"   INTEGER NOT NULL,
  "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seen"       BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "SpeedRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SpeedRecord_userId_mode_key" ON "SpeedRecord"("userId", "mode");
CREATE INDEX "SpeedRecord_userId_idx" ON "SpeedRecord"("userId");

ALTER TABLE "SpeedRecord" ADD CONSTRAINT "SpeedRecord_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
