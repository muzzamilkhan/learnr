-- CreateTable
CREATE TABLE "SpeedAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "correct" INTEGER NOT NULL,
    "answered" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpeedAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SpeedAttempt_userId_mode_correct_playedAt_idx" ON "SpeedAttempt"("userId", "mode", "correct" DESC, "playedAt");

-- AddForeignKey
ALTER TABLE "SpeedAttempt" ADD CONSTRAINT "SpeedAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
