import type { CalendarDay } from '@/lib/analytics/report';

/**
 * Four weeks of days, one cell each, filled by how much was answered.
 *
 * The gaps are the point. A weekly total hides a fortnight off; a row of empty
 * cells does not, and "are they actually using it" is the question a parent
 * opens this screen with.
 *
 * Rows are real Monday-to-Sunday weeks, so the weekday labels above them are a
 * claim the grid can actually keep. The tail of the current week is left blank
 * rather than drawn as an unpractised day — a Friday nobody has reached yet is
 * not a Friday nobody used.
 *
 * A CSS grid rather than an SVG, because the two axes want different things:
 * the width is whatever the column gives it, while the height is a fixed 14px.
 * Scaling one viewBox cannot do that without stretching the corner radii with
 * it, and seven `1fr` columns get it exactly.
 */

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
  return (
    <div
      role="img"
      aria-label={`Practised on ${practisedDays(weeks)} of the last ${elapsedDays(weeks)} days`}
      className="grid grid-cols-7 gap-1"
    >
      {WEEKDAYS.map((label) => (
        <span key={label} className="text-center text-xs text-(--color-ink-soft)">
          {label}
        </span>
      ))}

      {weeks.flat().map((day) =>
        // A day that has not happened gets no cell at all, only its grid slot.
        day.future ? (
          <span key={day.start} />
        ) : (
          <span
            key={day.start}
            className="h-[14px] rounded-[3px]"
            style={{ backgroundColor: shade(day.attempts) }}
            title={`${dayLabel.format(new Date(day.start + offsetMinutes * 60_000))}${
              day.attempts === 0
                ? ' — no practice'
                : ` — ${day.attempts} question${day.attempts === 1 ? '' : 's'}`
            }`}
          />
        ),
      )}
    </div>
  );
}
