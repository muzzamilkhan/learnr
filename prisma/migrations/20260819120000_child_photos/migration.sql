-- A child's cropped profile picture, one row per child, cascading with them.
-- Separate from `User` because the Auth.js adapter selects whole user rows on
-- every authenticated request, and the picture is only ever wanted where a face
-- is actually drawn.
CREATE TABLE "ChildPhoto" (
    "childId" TEXT NOT NULL,
    "dataUrl" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildPhoto_pkey" PRIMARY KEY ("childId")
);

ALTER TABLE "ChildPhoto" ADD CONSTRAINT "ChildPhoto_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
