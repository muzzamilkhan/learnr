import type { CalendarDay } from '@/lib/analytics/report';

/**
 * Four weeks of days, one square each, filled by how much was answered.
 *
 * The gaps are the point. A weekly total hides a fortnight off; a row of empty
 * squares does not, and "are they actually using it" is the question a parent
 * opens this screen with.
 *
 * Rows are real Monday-to-Sunday weeks, so the weekday labels above them are a
 * claim the grid can actually keep. The tail of the current week is left blank
 * rather than drawn as an unpractised day — a Friday nobody has reached yet is
 * not a Friday nobody used.
 */

const COLUMNS = 7;
const CELL = 14;
const GAP = 4;
const STEP = CELL + GAP;
/** Room for the weekday row above the grid, in the same units as the cells. */
const LABELS = 13;

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
export function practisedDays(weeks: readonly CalendarDay[][]): number {
  return weeks.flat().filter((day) => day.attempts > 0).length;
}

/** Days the grid covers that have actually happened — the denominator for the above. */
export function elapsedDays(weeks: readonly CalendarDay[][]): number {
  return weeks.flat().filter((day) => !day.future).length;
}

export function PracticeCalendar({
  weeks,
  offsetMinutes,
}: {
  weeks: CalendarDay[][];
  offsetMinutes: number;
}) {
  const width = COLUMNS * STEP - GAP;
  const height = LABELS + weeks.length * STEP - GAP;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      // Scaled up to whatever it is given rather than drawn at a fixed size, so
      // the squares grow with the column instead of huddling in one corner of it.
      className="h-auto w-full"
      role="img"
      aria-label={`Practised on ${practisedDays(weeks)} of the last ${elapsedDays(weeks)} days`}
    >
      {WEEKDAYS.map((label, column) => (
        <text
          key={label}
          x={column * STEP + CELL / 2}
          y={LABELS - 5}
          textAnchor="middle"
          fontSize="7"
          fill="var(--color-ink-soft)"
        >
          {label}
        </text>
      ))}

      {weeks.map((week, row) =>
        week.map((day, column) =>
          // A day that has not happened gets no square at all.
          day.future ? null : (
            <rect
              key={day.start}
              x={column * STEP}
              y={LABELS + row * STEP}
              width={CELL}
              height={CELL}
              rx={3}
              fill={shade(day.attempts)}
            >
              <title>
                {dayLabel.format(new Date(day.start + offsetMinutes * 60_000))}
                {day.attempts === 0
                  ? ' — no practice'
                  : ` — ${day.attempts} question${day.attempts === 1 ? '' : 's'}`}
              </title>
            </rect>
          ),
        ),
      )}
    </svg>
  );
}
