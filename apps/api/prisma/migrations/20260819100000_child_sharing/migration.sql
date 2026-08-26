-- Sharing a child with a second grown-up: a separated parent, a grandparent, a
-- tutor. Two tables and no change to "User", because sharing must not touch what
-- ownership is: "User"."parentId" stays the only thing that says whose child this
-- is, so every existing query that edits a child keeps refusing everyone else
-- without being taught about viewers at all.

-- The link. Short-lived and single-use, like a child's login code - and like that
-- code, what it buys outlives it.
CREATE TABLE "ShareInvite" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    -- What was offered when the link was made, not a live set: it is read once,
    -- at acceptance, and every id in it is checked against the issuer's children
    -- then. Hence a bare array with no foreign keys of its own.
    "childIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptedById" TEXT,

    CONSTRAINT "ShareInvite_pkey" PRIMARY KEY ("id")
);

-- Unique because acceptance looks a token up directly, and because the accepting
-- statement matches on the token and a null "acceptedAt" together - two taps
-- arriving at once can then only produce one winner.
CREATE UNIQUE INDEX "ShareInvite_token_key" ON "ShareInvite"("token");

-- "The links I have sent", newest first: the sharing panel's only read.
CREATE INDEX "ShareInvite_ownerId_createdAt_idx" ON "ShareInvite"("ownerId", "createdAt");

-- The standing grant an accepted invite leaves behind, and the row a revoke
-- deletes. No "ownerId": who owns the child is "User"."parentId", and a copy here
-- would be a second truth to keep in step.
CREATE TABLE "ChildShare" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChildShare_pkey" PRIMARY KEY ("id")
);

-- Sharing the same child with the same person twice is one grant, so accepting a
-- second invite covering a child they already see changes nothing.
CREATE UNIQUE INDEX "ChildShare_childId_viewerId_key" ON "ChildShare"("childId", "viewerId");

-- "The children shared with me", which every screen a viewer sees starts from.
CREATE INDEX "ChildShare_viewerId_idx" ON "ChildShare"("viewerId");

ALTER TABLE "ShareInvite" ADD CONSTRAINT "ShareInvite_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The invite outlives the account that accepted it as a record that it was spent:
-- a deleted viewer must not make a used link live again.
ALTER TABLE "ShareInvite" ADD CONSTRAINT "ShareInvite_acceptedById_fkey"
  FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Both sides cascade: a removed child takes its grants with it, and so does a
-- viewer who deletes their account. Access to a row that no longer exists is not
-- something anyone should have to tidy up by hand.
ALTER TABLE "ChildShare" ADD CONSTRAINT "ChildShare_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChildShare" ADD CONSTRAINT "ChildShare_viewerId_fkey"
  FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
