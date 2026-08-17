-- Mastery is recall on a separate day, not a run inside one sitting, so a skill
-- row now counts the distinct local days it has been got right on.
ALTER TABLE "TopicSkill" ADD COLUMN     "correctDays" INTEGER NOT NULL DEFAULT 0,
                         ADD COLUMN     "lastCorrectDay" INTEGER;

-- Which day an answer counts towards is the child's day, not UTC's. Existing rows
-- predate the column and are left at UTC, which is what they were folded as.
ALTER TABLE "Attempt" ADD COLUMN     "offsetMinutes" INTEGER NOT NULL DEFAULT 0;

-- Backfill from the attempts themselves, so the rows agree with their history
-- rather than starting from zero and locking every topic out of `secure`.
WITH days AS (
  SELECT
    ls."userId",
    a."subject",
    a."topic",
    a."level",
    COUNT(DISTINCT floor((extract(epoch FROM a."answeredAt") + a."offsetMinutes" * 60) / 86400)) AS "correctDays",
    MAX(floor((extract(epoch FROM a."answeredAt") + a."offsetMinutes" * 60) / 86400)) AS "lastCorrectDay"
  FROM "Attempt" a
  JOIN "LearningSession" ls ON ls."id" = a."learningSessionId"
  WHERE a."correct"
  GROUP BY ls."userId", a."subject", a."topic", a."level"
)
UPDATE "TopicSkill" ts
SET "correctDays" = days."correctDays",
    "lastCorrectDay" = days."lastCorrectDay"
FROM days
WHERE ts."userId" = days."userId"
  AND ts."subject" = days."subject"
  AND ts."topic" = days."topic"
  AND ts."level" = days."level";

-- History is always read for one child and one subject: narrow to their sessions
-- here, then walk each session's attempts already in answeredAt order.
CREATE INDEX "LearningSession_userId_subject_level_idx" ON "LearningSession"("userId", "subject", "level");

DROP INDEX "Attempt_learningSessionId_idx";
CREATE INDEX "Attempt_learningSessionId_answeredAt_idx" ON "Attempt"("learningSessionId", "answeredAt");

-- Superseded by TopicSkill, which answers "which topics are weak?" directly.
DROP INDEX "Attempt_subject_topic_level_correct_idx";
