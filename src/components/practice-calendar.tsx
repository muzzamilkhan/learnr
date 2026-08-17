import type { ProgressBucket } from '@/lib/analytics/report';

/**
 * Eight weeks of days, one square each, filled by how much was answered.
 *
 * The gaps are the point. A weekly total hides a fortnight off; a row of empty
 * squares does not, and "are they actually using it" is the question a parent
 * opens this screen with.
 *
 * Rows are runs of seven ending today rather than calendar weeks, so there are
 * no weekday labels — claiming a Monday column that does not line up would be
 * worse than not claiming one.
 */

const COLUMNS = 7;
const CELL = 14;
const GAP = 4;
const STEP = CELL + GAP;

/** Four steps, so a long sitting reads differently from a single question. */
function shade(attempts: number): string {
  if (attempts === 0) return 'var(--color-line)';
  if (attempts < 5) return 'var(--color-brand-soft)';
  if (attempts < 15) return 'color-mix(in srgb, var(--color-brand) 45%, white)';
  return 'var(--color-brand)';
}

const dayLabel = new Intl.DateTimeFormat('en-AU', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  // The bucket start is already shifted into the child's day, so it is read
  // back as UTC rather than through whatever timezone the server happens to be in.
  timeZone: 'UTC',
});

/** Days with at least one answer. The other half of what the grid shows. */
export function practisedDays(buckets: readonly ProgressBucket[]): number {
  return buckets.filter((bucket) => bucket.attempts > 0).length;
}

export function PracticeCalendar({
  buckets,
  offsetMinutes,
}: {
  buckets: ProgressBucket[];
  offsetMinutes: number;
}) {
  const rows = Math.ceil(buckets.length / COLUMNS);
  const width = COLUMNS * STEP - GAP;
  const height = rows * STEP - GAP;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Practised on ${practisedDays(buckets)} of the last ${buckets.length} days`}
    >
      {buckets.map((bucket, index) => (
        <rect
          key={bucket.start}
          x={(index % COLUMNS) * STEP}
          y={Math.floor(index / COLUMNS) * STEP}
          width={CELL}
          height={CELL}
          rx={3}
          fill={shade(bucket.attempts)}
        >
          <title>
            {dayLabel.format(new Date(bucket.start + offsetMinutes * 60_000))}
            {bucket.attempts === 0
              ? ' — no practice'
              : ` — ${bucket.attempts} question${bucket.attempts === 1 ? '' : 's'}`}
          </title>
        </rect>
      ))}
    </svg>
  );
}
