import { localDay } from '../day';

/**
 * The daily target: the one thing in LearnR that asks a child to commit to
 * something. A parent sets it, optionally, as either a number of questions or a
 * number of minutes a day, and hitting it is worth more stars than anything else
 * in the app.
 *
 * It is a floor and never a cap. Nothing here stops a child carrying on past
 * their target, nothing takes anything away for missing one, and a missed day
 * produces no value at all - the only thing this module ever says is that a day
 * was met.
 *
 * Pure, like everything in `lib`: `now` and the child's UTC offset come in from
 * the caller, so the play screen, a server recount and a test all agree on which
 * answers were given today.
 */

export type TargetKind = 'questions' | 'minutes';

export interface DailyTarget {
  kind: TargetKind;
  value: number;
}

/** Stars for hitting the target, once a day.
 *
 * Flat rather than scaled to the size of the target: scaling it would make a
 * child's star total a measure of how much their parent asked of them, and hand
 * a parent a dial on their child's rewards. Ten is worth three or four clean
 * rounds - clearly the day's biggest award, without making a round worth
 * nothing.
 */
export const TARGET_STARS = 10;

/**
 * What a parent may choose. The floors matter more than the ceilings: a target
 * set for a six-year-old has to be able to be an easy one, or the first thing
 * this feature does is have a child fail at something their parent chose. Ten
 * questions is exactly one round, and five minutes is a real sitting at that
 * age. The ceilings are what stop a well-meaning parent setting a bar nobody
 * clears on a school night.
 */
export const TARGET_LIMITS: Record<TargetKind, { min: number; max: number; step: number }> = {
  questions: { min: 10, max: 60, step: 5 },
  minutes: { min: 5, max: 30, step: 5 },
};

const MINUTE_MS = 60_000;

const isTargetKind = (value: unknown): value is TargetKind =>
  value === 'questions' || value === 'minutes';

/**
 * The boundary normaliser, like `parseYearLevel`: a target arriving from a form,
 * a server action or a database row is only a target if it comes back from here.
 * Everything off the step or outside the bounds is refused in this one place, so
 * no caller has to know what the bounds are.
 */
export function parseTarget(kind: unknown, value: unknown): DailyTarget | null {
  if (!isTargetKind(kind)) return null;

  const number = typeof value === 'string' ? Number(value) : value;
  if (typeof number !== 'number' || !Number.isInteger(number)) return null;

  const { min, max, step } = TARGET_LIMITS[kind];
  if (number < min || number > max || (number - min) % step !== 0) return null;

  return { kind, value: number };
}

/** Every value a parent may choose for one kind - the dropdown's options. */
export function targetOptions(kind: TargetKind): number[] {
  const { min, max, step } = TARGET_LIMITS[kind];
  const options: number[] = [];
  for (let value = min; value <= max; value += step) options.push(value);
  return options;
}

/** One answer, as much of it as a target cares about. */
export interface TargetAnswer {
  answeredAt: number;
  /** Already capped at `MAX_TIME_MS` when it was recorded. */
  timeTakenMs: number;
}

/** What one day came to, in both units, so either kind of target can read it. */
export interface DayTotal {
  questions: number;
  timeMs: number;
}

/** The target in the unit the day is counted in. */
export const targetUnits = (target: DailyTarget): number =>
  target.kind === 'minutes' ? target.value * MINUTE_MS : target.value;

/** The day's total in the unit that target is counted in. */
export const totalFor = (total: DayTotal, kind: TargetKind): number =>
  kind === 'minutes' ? total.timeMs : total.questions;

/**
 * What has been done today, out of a run of answers that may span several days.
 *
 * A minute here is summed `timeTakenMs`, which the session engine has already
 * capped per answer - the same number the parent's report calls "time on
 * questions". An iPad put down and picked up after dinner therefore cannot earn
 * minutes, and the target and the report can never disagree about how long a
 * child practised.
 */
export function dayTotal(
  answers: readonly TargetAnswer[],
  { now, offsetMinutes = 0 }: { now: number; offsetMinutes?: number },
): DayTotal {
  const today = localDay(now, offsetMinutes);

  return answers.reduce<DayTotal>(
    (total, answer) =>
      localDay(answer.answeredAt, offsetMinutes) === today
        ? { questions: total.questions + 1, timeMs: total.timeMs + answer.timeTakenMs }
        : total,
    { questions: 0, timeMs: 0 },
  );
}

export interface TargetProgress {
  /** Questions answered, or milliseconds practised - `target`'s unit. */
  done: number;
  target: number;
  /** `done / target`, clamped to one. The bar is a picture of this. */
  fraction: number;
  complete: boolean;
}

export function targetProgress(target: DailyTarget, total: DayTotal): TargetProgress {
  const done = totalFor(total, target.kind);
  const units = targetUnits(target);

  return {
    done,
    target: units,
    fraction: Math.min(1, done / units),
    complete: done >= units,
  };
}

export type TargetCellState = 'none' | 'partial' | 'met';

/**
 * One day of the parent's practice calendar, measured against the target.
 *
 * A day with no questions at all is `none` whichever kind of target is set - it
 * is the absence the calendar exists to show, and dressing it up as 0% of
 * something would lose that.
 */
export function targetCell(
  total: DayTotal,
  target: DailyTarget,
): { state: TargetCellState; fraction: number } {
  if (total.questions === 0) return { state: 'none', fraction: 0 };

  const { fraction, complete } = targetProgress(target, total);
  return { state: complete ? 'met' : 'partial', fraction };
}
