-- The resolved figure a child actually saw, for a question with one. Nothing is
-- backfilled: every attempt recorded before this feature had no figure to draw,
-- which is exactly what `null` already means, and every read of this column
-- goes through `parseFigure` rather than trusting the row.

ALTER TABLE "Attempt" ADD COLUMN     "figure" JSONB;
