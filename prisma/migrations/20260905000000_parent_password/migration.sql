-- CreateTable
CREATE TABLE "ParentPassword" (
    "userId" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentPassword_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "ParentPassword" ADD CONSTRAINT "ParentPassword_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

