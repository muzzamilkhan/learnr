import type { CalendarDay } from '@/lib/analytics/report';
import { targetCell, type DailyTarget, type DayTotal } from '@/lib/rewards/target';

/**
 * Four weeks of days, one cell each, filled by how much was answered.
 *
 * The gaps are the point. A weekly total hides a fortnight off; a row of empty
 * cells does not, and "are they actually using it" is the question a parent
 * opens this screen with.
 *
 * Rows are real Monday-to-Sunday weeks, so the weekday labels above them are a
 * claim the grid can actually keep. The tail of the current week is left blank
 * rather than drawn as an unpractised day - a Friday nobody has reached yet is
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

/** Days the grid covers that have actually happened - the denominator for the above. */
export function elapsedDays(weeks: readonly CalendarDay[][]): number {
  return weeks.flat().filter((day) => !day.future).length;
}

/** Without a target, and with one: a tick has to fit inside the second. */
const CELL_HEIGHT = { plain: 14, target: 20 };

/** Below this a fill is a smudge rather than a fraction; a practised day must look practised. */
const MIN_VISIBLE = 0.12;

export function PracticeCalendar({
  weeks,
  offsetMinutes,
  target = null,
  totals,
}: {
  weeks: CalendarDay[][];
  offsetMinutes: number;
  /** The child's goal, if their parent set one. Without it the grid is unchanged. */
  target?: DailyTarget | null;
  /**
   * Every day's answers across all subjects, keyed by day bucket. Cross-subject
   * because a goal is the child's whole day, while the rest of this screen is
   * scoped to the subject in the dropdown. `null` is a failed read, and the
   * caller drops the target with it rather than drawing every day as missed.
   */
  totals?: Map<number, DayTotal> | null;
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
        ) : target && totals ? (
          <TargetCell
            key={day.start}
            day={day}
            target={target}
            total={totals.get(day.start) ?? { questions: 0, timeMs: 0 }}
            offsetMinutes={offsetMinutes}
          />
        ) : (
          <span
            key={day.start}
            className="rounded-[3px]"
            style={{ height: CELL_HEIGHT.plain, backgroundColor: shade(day.attempts) }}
            title={`${dayLabel.format(new Date(day.start + offsetMinutes * 60_000))}${
              day.attempts === 0
                ? ' - no practice'
                : ` - ${day.attempts} question${day.attempts === 1 ? '' : 's'}`
            }`}
          />
        ),
      )}
    </div>
  );
}

/**
 * One day measured against the goal: green with a tick for a day that met it,
 * filled left to right by how far it got for a day that did not, and line grey
 * for a day with nothing on it at all.
 *
 * The fill is a fraction of the width rather than a shade, because a parent
 * reading this wants to know how close a short day came - and a row of four
 * different blues does not say that. Grey still means untouched either way, so
 * the gaps the calendar exists to show are still the loudest thing in it.
 */
function TargetCell({
  day,
  target,
  total,
  offsetMinutes,
}: {
  day: CalendarDay;
  target: DailyTarget;
  total: DayTotal;
  offsetMinutes: number;
}) {
  const { state, fraction } = targetCell(total, target);
  const date = dayLabel.format(new Date(day.start + offsetMinutes * 60_000));
  const practised =
    target.kind === 'minutes'
      ? `${Math.floor(total.timeMs / 60_000)} of ${target.value} min`
      : `${total.questions} of ${target.value} questions`;

  return (
    <span
      className="relative flex items-center justify-center overflow-hidden rounded-[3px]"
      style={{
        height: CELL_HEIGHT.target,
        backgroundColor: state === 'met' ? 'var(--color-right)' : 'var(--color-line)',
      }}
      title={`${date} - ${state === 'none' ? 'no practice' : practised}`}
    >
      {state === 'partial' ? (
        <span
          className="absolute inset-y-0 left-0 bg-(--color-brand)"
          style={{ width: `${Math.max(MIN_VISIBLE, fraction) * 100}%` }}
        />
      ) : null}

      {state === 'met' ? (
        <svg viewBox="0 0 24 24" aria-hidden className="relative h-3 w-3 text-white">
          <path
            d="M5 13l4 4L19 7"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}
