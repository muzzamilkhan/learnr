# Daily Practice Targets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a parent set an optional daily target on a child - a number of questions or a number of minutes - shown as a progress bar on the play and home screens, worth 10 stars the day it is met, and reflected in the parent's practice calendar.

**Architecture:** All the arithmetic goes in one new pure module, `src/lib/rewards/target.ts`, beside `stars.ts` and `streak.ts` - no clock, no database, `now` and the UTC offset passed in. Stars stop being a recounted cache and become one incremented `User.stars`, with a guard per event so each award still fires exactly once. The award is a single compare-and-set on a day number, exactly like the play streak. Because only the child's device knows what day it is where they are, the server ships the child's last 48 hours of answers to the client and the client picks out "today" with its own offset - the same reason `currentStreak` is computed in the browser.

**Tech Stack:** Next.js App Router (server components + server actions), Prisma 7 with hand-written SQL migrations, Tailwind v4 with CSS variables, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-18-daily-targets-design.md`

## Global Constraints

- **`src/lib` is pure.** Nothing in there touches React, the network, the clock or the database. Callers pass in `now` and an RNG. Do not break this for convenience.
- **Levels are strings** (`'K'`, `'1'`..`'6'`), never integers. Not relevant to this feature, but do not "fix" any level handling you pass through.
- **Play-path writes are best-effort.** Everything in `records.ts` called while a child is answering swallows its failures and never blocks or interrupts play. Everything in `accounts.ts` does the opposite - it reports whether it worked.
- **Days are the child's, never the server's.** Every day question goes through `localDay(at, offsetMinutes)` in `src/lib/day.ts`.
- **`User.stars` is only ever incremented**, never recomputed. Every increment sits behind a guard that makes the event fire once: `LearningSession.roundsBanked` under a row lock for a round, `User.targetDay` compare-and-set for a day's target.
- **`TARGET_STARS` is 10.** Question targets run 10-60 in steps of 5; minute targets run 5-30 in steps of 5.
- **A minute is summed capped `timeTakenMs`**, the same number the parent's report calls "time on questions". Never wall-clock time.
- **Prose style in comments:** explain *why*, in full sentences, matching the surrounding files. Use `-` and never an em dash. Australian spelling.
- **Parent screens run dense** (`text-sm`/`text-base`, `rounded-xl`, `px-3 py-1.5` buttons); child screens run large. Do not mix the two scales.
- Run `npm test`, `npm run typecheck` and `npm run lint` before every commit. Lint is not
  optional here: `react-hooks/purity` forbids a bare `Date.now()` in a component body (use a
  `requestNow`-style request boundary, as `src/app/(parent)/progress/now.ts` and
  `src/app/play/now.ts` do) and `react-hooks/set-state-in-effect` forbids settling a
  clock-dependent value with `setState` in an effect (use `useSyncExternalStore`, as
  `ProfileMenu` does for the play streak). One pre-existing error in
  `src/components/parent-dashboard.tsx` predates this branch and is not yours to fix.

---

### Task 1: The target library

**Files:**
- Create: `src/lib/rewards/target.ts`
- Test: `src/lib/rewards/target.test.ts`

**Interfaces:**
- Consumes: `localDay` from `src/lib/day.ts`; `MAX_TIME_MS` from `src/lib/session/session.ts` (for a test only).
- Produces: everything later tasks import -

```ts
export type TargetKind = 'questions' | 'minutes';
export interface DailyTarget { kind: TargetKind; value: number }
export interface TargetAnswer { answeredAt: number; timeTakenMs: number }
export interface DayTotal { questions: number; timeMs: number }
export interface TargetProgress { done: number; target: number; fraction: number; complete: boolean }
export const TARGET_STARS: 10;
export const TARGET_LIMITS: Record<TargetKind, { min: number; max: number; step: number }>;
export function parseTarget(kind: unknown, value: unknown): DailyTarget | null;
export function targetOptions(kind: TargetKind): number[];
export function targetUnits(target: DailyTarget): number;
export function totalFor(total: DayTotal, kind: TargetKind): number;
export function dayTotal(answers: readonly TargetAnswer[], options: { now: number; offsetMinutes?: number }): DayTotal;
export function targetProgress(target: DailyTarget, total: DayTotal): TargetProgress;
export type TargetCellState = 'none' | 'partial' | 'met';
export function targetCell(total: DayTotal, target: DailyTarget): { state: TargetCellState; fraction: number };
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/rewards/target.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_TIME_MS } from '../session/session';
import {
  TARGET_LIMITS,
  TARGET_STARS,
  dayTotal,
  parseTarget,
  targetCell,
  targetOptions,
  targetProgress,
  targetUnits,
  totalFor,
} from './target';

const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;
/** Midday on day `n` of the epoch, so no test sits on a boundary by accident. */
const at = (day: number, hour = 12) => day * DAY + hour * 60 * 60 * 1000;
const answer = (day: number, hour = 12, timeTakenMs = 30_000) => ({
  answeredAt: at(day, hour),
  timeTakenMs,
});

describe('parseTarget', () => {
  it('accepts a value on the step, inside its bounds', () => {
    expect(parseTarget('questions', 20)).toEqual({ kind: 'questions', value: 20 });
    expect(parseTarget('minutes', 5)).toEqual({ kind: 'minutes', value: 5 });
  });

  it('accepts a numeric string, which is what a form sends', () => {
    expect(parseTarget('minutes', '15')).toEqual({ kind: 'minutes', value: 15 });
  });

  it('refuses a kind that is not a target', () => {
    expect(parseTarget('none', 20)).toBeNull();
    expect(parseTarget(null, 20)).toBeNull();
    expect(parseTarget('hours', 3)).toBeNull();
  });

  it('refuses a value outside the bounds a parent may set', () => {
    expect(parseTarget('questions', 5)).toBeNull();
    expect(parseTarget('questions', 65)).toBeNull();
    expect(parseTarget('minutes', 0)).toBeNull();
    expect(parseTarget('minutes', 35)).toBeNull();
  });

  it('refuses a value between the steps, so one place normalises them', () => {
    expect(parseTarget('questions', 22)).toBeNull();
    expect(parseTarget('minutes', 7)).toBeNull();
  });

  it('refuses anything that is not a whole number', () => {
    expect(parseTarget('minutes', 12.5)).toBeNull();
    expect(parseTarget('minutes', 'soon')).toBeNull();
    expect(parseTarget('minutes', NaN)).toBeNull();
    expect(parseTarget('minutes', null)).toBeNull();
  });
});

describe('targetOptions', () => {
  it('runs from the floor to the ceiling on the step', () => {
    expect(targetOptions('minutes')).toEqual([5, 10, 15, 20, 25, 30]);
    expect(targetOptions('questions')).toEqual([10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60]);
  });

  it('offers only values parseTarget will take back', () => {
    for (const kind of ['questions', 'minutes'] as const) {
      for (const value of targetOptions(kind)) {
        expect(parseTarget(kind, value)).toEqual({ kind, value });
      }
    }
  });
});

describe('dayTotal', () => {
  it('counts only the answers given on the same day as now', () => {
    const answers = [answer(99), answer(100, 9), answer(100, 20), answer(101)];
    expect(dayTotal(answers, { now: at(100) })).toEqual({ questions: 2, timeMs: 60_000 });
  });

  it('is empty when nothing was answered today', () => {
    expect(dayTotal([answer(99)], { now: at(100) })).toEqual({ questions: 0, timeMs: 0 });
    expect(dayTotal([], { now: at(100) })).toEqual({ questions: 0, timeMs: 0 });
  });

  it('uses the child s local day, not the server s', () => {
    // 8pm UTC on day 100 is 6am on day 101 in Sydney, so a Sydney evening's
    // practice belongs to that evening and not to the next morning.
    const sydney = 10 * 60;
    const evening = [answer(100, 20), answer(100, 21)];
    expect(dayTotal(evening, { now: at(100, 21), offsetMinutes: sydney })).toEqual({
      questions: 2,
      timeMs: 60_000,
    });
    expect(dayTotal(evening, { now: at(100, 21) })).toEqual({ questions: 2, timeMs: 60_000 });
    // The next UTC morning is the same Sydney day, so those answers still count.
    expect(dayTotal(evening, { now: at(101, 8), offsetMinutes: sydney }).questions).toBe(2);
    expect(dayTotal(evening, { now: at(101, 8) }).questions).toBe(0);
  });
});

describe('targetProgress', () => {
  it('counts questions towards a questions target', () => {
    const progress = targetProgress({ kind: 'questions', value: 20 }, { questions: 5, timeMs: 0 });
    expect(progress).toEqual({ done: 5, target: 20, fraction: 0.25, complete: false });
  });

  it('sums milliseconds towards a minutes target', () => {
    const progress = targetProgress({ kind: 'minutes', value: 10 }, { questions: 8, timeMs: 5 * MINUTE });
    expect(progress).toEqual({ done: 5 * MINUTE, target: 10 * MINUTE, fraction: 0.5, complete: false });
  });

  it('completes on exactly the answer that reaches the target', () => {
    const target = { kind: 'questions', value: 10 } as const;
    expect(targetProgress(target, { questions: 9, timeMs: 0 }).complete).toBe(false);
    expect(targetProgress(target, { questions: 10, timeMs: 0 }).complete).toBe(true);
  });

  it('clamps the fraction at one, because the bar never shows more than full', () => {
    const progress = targetProgress({ kind: 'questions', value: 10 }, { questions: 40, timeMs: 0 });
    expect(progress.fraction).toBe(1);
    expect(progress.done).toBe(40);
    expect(progress.complete).toBe(true);
  });

  it('is nothing at all before the first answer', () => {
    expect(targetProgress({ kind: 'minutes', value: 5 }, { questions: 0, timeMs: 0 })).toEqual({
      done: 0,
      target: 5 * MINUTE,
      fraction: 0,
      complete: false,
    });
  });
});

/**
 * The cap is the session engine's, and it is the reason a minutes target cannot
 * be finished by walking away: an abandoned question is not a measurement, so it
 * contributes its capped time and no more.
 */
describe('targetProgress with an abandoned question', () => {
  it('cannot be finished by one question left open all afternoon', () => {
    const abandoned = dayTotal([{ answeredAt: at(100), timeTakenMs: MAX_TIME_MS }], { now: at(100) });
    const progress = targetProgress({ kind: 'minutes', value: 30 }, abandoned);
    expect(progress.done).toBe(MAX_TIME_MS);
    expect(progress.complete).toBe(false);
  });
});

describe('targetCell', () => {
  const target = { kind: 'questions', value: 20 } as const;

  it('is nothing when the day was not practised at all', () => {
    expect(targetCell({ questions: 0, timeMs: 0 }, target)).toEqual({ state: 'none', fraction: 0 });
  });

  it('is part done when the day fell short', () => {
    expect(targetCell({ questions: 10, timeMs: 0 }, target)).toEqual({ state: 'partial', fraction: 0.5 });
  });

  it('is met on the target and past it', () => {
    expect(targetCell({ questions: 20, timeMs: 0 }, target)).toEqual({ state: 'met', fraction: 1 });
    expect(targetCell({ questions: 60, timeMs: 0 }, target)).toEqual({ state: 'met', fraction: 1 });
  });

  it('is part done for a minutes target that was practised but not met', () => {
    const minutes = { kind: 'minutes', value: 10 } as const;
    expect(targetCell({ questions: 3, timeMs: 2 * MINUTE }, minutes)).toEqual({
      state: 'partial',
      fraction: 0.2,
    });
  });
});

describe('the numbers the feature is built on', () => {
  it('awards ten stars, worth more than any single round', () => {
    expect(TARGET_STARS).toBe(10);
  });

  it('lets a parent set an easy first target, and stops them setting an impossible one', () => {
    expect(TARGET_LIMITS.questions).toEqual({ min: 10, max: 60, step: 5 });
    expect(TARGET_LIMITS.minutes).toEqual({ min: 5, max: 30, step: 5 });
  });

  it('measures a target in the unit the day is counted in', () => {
    expect(targetUnits({ kind: 'questions', value: 20 })).toBe(20);
    expect(targetUnits({ kind: 'minutes', value: 20 })).toBe(20 * MINUTE);
    expect(totalFor({ questions: 4, timeMs: 90_000 }, 'questions')).toBe(4);
    expect(totalFor({ questions: 4, timeMs: 90_000 }, 'minutes')).toBe(90_000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/rewards/target.test.ts`
Expected: FAIL - `Failed to resolve import "./target"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/rewards/target.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/rewards/target.test.ts && npm run typecheck`
Expected: PASS, all tests green, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rewards/target.ts src/lib/rewards/target.test.ts
git commit -m "Add the daily target's arithmetic"
```

---

### Task 2: Schema, migration and the parent's write path

**Files:**
- Modify: `prisma/schema.prisma` (the `User` model)
- Create: `prisma/migrations/20260818090000_daily_targets/migration.sql`
- Modify: `src/lib/accounts.ts` (`ChildProfile`, `listChildren`, `ChildInput`, `createChild`, `updateChild`)
- Modify: `src/app/actions.ts` (`parseChildInput`, `createChildAction`, `updateChildAction`)

**Interfaces:**
- Consumes: `parseTarget`, `DailyTarget` from Task 1.
- Produces:
  - `ChildProfile` gains `target: DailyTarget | null`.
  - `ChildInput` gains `target: DailyTarget | null`.
  - `createChildAction(name, avatar, level, targetKind, targetValue)` and `updateChildAction(childId, name, avatar, level, targetKind, targetValue)` - the two new parameters are `string` and `string`, straight off the form, with `targetKind: 'none'` meaning no target.

- [ ] **Step 1: Add the columns to the schema**

In `prisma/schema.prisma`, inside `model User`, after the `playStreak`/`playStreakDay` block:

```prisma
  /// The daily target a parent set on this child: "questions" or "minutes", and
  /// how many. Both null when there is no target, which is where every child
  /// starts - a target is optional and is a thing a parent chooses.
  targetKind  String?
  targetValue Int?

  /// The last local day the target's stars were banked, as a day number rather
  /// than a timestamp - a day here is the child's, and a timestamp would need
  /// the offset re-applied at every read. Null until they first hit a target.
  /// This column is the compare-and-set that makes the award happen once a day
  /// however many times it is asked for.
  targetDay Int?

  /// Every star this child has, from finished rounds and from days they hit
  /// their target. Only ever incremented, never recounted: a target is mutable,
  /// so recounting a past day against today's setting would take stars off a
  /// child who earned them. What replaces the old recount's safety is a guard
  /// per event - `LearningSession.roundsBanked` for a round, `targetDay` above
  /// for a day - so an award can still only ever be paid once.
  stars Int @default(0)
```

Leave `LearningSession` alone in this task. Its `stars` column is still read by
`records.ts`, so swapping it out here would leave the tree failing `typecheck`
between two commits - it goes in Task 3 with the code that reads it.

- [ ] **Step 2: Hand-write the migration**

Create `prisma/migrations/20260818090000_daily_targets/migration.sql`:

```sql
-- The optional daily target a parent sets on a child, and the column that will
-- become the app's only star total. Nothing is backfilled into the target
-- columns: no target is the correct state for every child that already exists,
-- and a target is a decision a parent makes rather than one that can be guessed
-- from their child's history. `stars` is filled by the next migration, which is
-- where the total it replaces is retired.

ALTER TABLE "User" ADD COLUMN     "targetKind" TEXT,
                  ADD COLUMN     "targetValue" INTEGER,
                  ADD COLUMN     "targetDay" INTEGER,
                  ADD COLUMN     "stars" INTEGER NOT NULL DEFAULT 0;
```

- [ ] **Step 3: Apply it and regenerate the client**

Run: `npm run db:deploy && npx prisma generate`
Expected: the migration applies (or prints its skip line if there is no database), and the client regenerates into `src/generated/prisma`.

If there is no `DATABASE_URL`, `npx prisma generate` alone is enough to make the rest of this task typecheck.

- [ ] **Step 4: Carry the target through `accounts.ts`**

In `src/lib/accounts.ts`, add the import:

```ts
import { parseTarget, type DailyTarget } from '@/lib/rewards/target';
```

Add the field to `ChildProfile`, after `level`:

```ts
  /** The daily target the parent set, or null for the child who has none. */
  target: DailyTarget | null;
```

In `listChildren`, add `targetKind: true, targetValue: true` to the `select`, and to the mapped object:

```ts
      target: parseTarget(row.targetKind, row.targetValue),
```

A row that somehow holds a value the bounds no longer allow comes back as no target rather than as a target nobody can reach - the same way `toSkill` drops a level that is no longer a school year.

Add the field to `ChildInput`:

```ts
export interface ChildInput {
  name: string;
  avatar: Avatar;
  level: YearLevel;
  /** Null clears the target, which is what "No goal" on the form means. */
  target: DailyTarget | null;
}
```

In `createChild`'s `data`, and in `updateChild`'s `data`, add:

```ts
        targetKind: input.target?.kind ?? null,
        targetValue: input.target?.value ?? null,
```

`targetDay` and `stars` are deliberately untouched by an edit: changing a target must not take back stars already earned, and must not let today's award be claimed twice by lowering the bar.

- [ ] **Step 5: Carry it through the server actions**

In `src/app/actions.ts`, import `parseTarget`:

```ts
import { parseTarget } from '@/lib/rewards/target';
```

Replace `parseChildInput` and the two actions that call it:

```ts
/** A child's details as the dashboard form submits them, before they are trusted. */
function parseChildInput(
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
): ChildInput | null {
  const trimmed = name.trim();
  const parsedAvatar = parseAvatar(avatar);
  const parsedLevel = parseYearLevel(level);
  if (!trimmed || trimmed.length > 40 || !parsedAvatar || !parsedLevel) return null;

  // "No goal" is a choice a parent makes, so it is a valid input that clears the
  // target - and a target that fails to parse is refused outright rather than
  // quietly saved as no target, which would tell a parent they set one.
  const target = targetKind === 'none' ? null : parseTarget(targetKind, targetValue);
  if (targetKind !== 'none' && target === null) return null;

  return { name: trimmed, avatar: parsedAvatar, level: parsedLevel, target };
}

export async function createChildAction(
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level, targetKind, targetValue);
  if (!parentId || !input) return false;

  const created = await createChild(parentId, input);
  revalidatePath('/');
  return created !== null;
}

export async function updateChildAction(
  childId: string,
  name: string,
  avatar: string,
  level: string,
  targetKind: string,
  targetValue: string,
): Promise<boolean> {
  const parentId = await requireParentId();
  const input = parseChildInput(name, avatar, level, targetKind, targetValue);
  if (!parentId || !input) return false;

  const updated = await updateChild(parentId, childId, input);
  revalidatePath('/');
  return updated;
}
```

- [ ] **Step 5b: Keep the existing callers compiling**

`npm run typecheck` will now fail in `src/components/parent-dashboard.tsx`, which calls both actions with the old arity. Pass `'none'` and `''` at both call sites for now - Task 4 replaces them with the form's real values:

```ts
        ? await updateChildAction(initial.id, name, avatar, level, 'none', '')
        : await createChildAction(name, avatar, level, 'none', '');
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm test && npm run lint`
Expected: no type errors, all existing tests pass.

- [ ] **Step 7: Commit**

```bash
git add prisma src/lib/accounts.ts src/app/actions.ts src/components/parent-dashboard.tsx
git commit -m "Store the daily target a parent sets on a child"
```

---

### Task 3: One star column, two guards, and the target's award

**Files:**
- Modify: `prisma/schema.prisma` (the `LearningSession` model)
- Create: `prisma/migrations/20260818090100_stars_on_the_user/migration.sql`
- Modify: `src/lib/records.ts`
- Modify: `src/app/play/actions.ts`

**Interfaces:**
- Consumes: `parseTarget`, `dayTotal`, `targetProgress`, `TargetAnswer`, `TARGET_STARS`, `DailyTarget` from Task 1.
- Produces:

```ts
// records.ts
export interface TargetSettings { target: DailyTarget | null; targetDay: number | null }
export async function readTargetSettings(userId: string): Promise<TargetSettings>;
export async function readRecentAnswers(userId: string, sinceMs: number): Promise<TargetAnswer[]>;
export async function awardDailyTarget(
  userId: string,
  learningSessionId: string,
  at: { now: number; offsetMinutes: number },
): Promise<{ awarded: boolean; stars: number } | null>;
// `awardRoundStars(userId, learningSessionId)` keeps its signature and its
// `Promise<number | null>` return - the child's new total, or null if nothing
// was banked. Only its mechanism changes.

// play/actions.ts
export async function awardTargetAction(
  learningSessionId: string,
  offsetMinutes: number,
): Promise<{ awarded: boolean; stars: number } | null>;
```

- [ ] **Step 0: Retire `LearningSession.stars` for `roundsBanked`**

This is one task with the code below because the column and its only readers
have to move together - dropping it in an earlier commit would leave the tree
failing `typecheck`.

In `prisma/schema.prisma`, on `model LearningSession`, delete the `stars` column
and its doc comment and put this in its place:

```prisma
  /// How many closed rounds of this sitting have been paid for. The guard that
  /// lets `User.stars` be incremented rather than recounted: banking reads this
  /// under a row lock, pays for the rounds past it, and moves it up. It is a
  /// count of events, not a cache of anything.
  roundsBanked Int @default(0)
```

Create `prisma/migrations/20260818090100_stars_on_the_user/migration.sql`:

```sql
-- Stars move from a sum over sittings, recounted from the answers, to one
-- incremented total on the child.
--
-- The sum had to go because a daily target is mutable. A child who hits a
-- 10-question target on Monday and has it raised to 40 on Tuesday would fail a
-- recount of Monday, and lose stars they had already been shown. So the total is
-- banked as it is earned, and each award is guarded instead of being made
-- repeatable: "roundsBanked" for a round of ten, "targetDay" for a day's target.

ALTER TABLE "LearningSession" ADD COLUMN "roundsBanked" INTEGER NOT NULL DEFAULT 0;

-- Every closed round of every sitting, valued the way `starsEarned` values one:
-- 3 for a clean round, 1 for a round with nothing right, 2 for anything between.
-- A part-finished round at the end of a sitting is worth nothing, which is why
-- the ordering matters - rounds chunk from the *first* answer.
WITH numbered AS (
  SELECT
    a."learningSessionId",
    ls."userId",
    a."correct",
    (row_number() OVER (PARTITION BY a."learningSessionId" ORDER BY a."answeredAt", a."id") - 1) / 10 AS round
  FROM "Attempt" a
  JOIN "LearningSession" ls ON ls."id" = a."learningSessionId"
),
scored AS (
  SELECT "userId", "learningSessionId", round, COUNT(*) FILTER (WHERE "correct") AS correct
  FROM numbered
  GROUP BY "userId", "learningSessionId", round
  HAVING COUNT(*) = 10
),
per_session AS (
  SELECT "learningSessionId", COUNT(*) AS rounds
  FROM scored
  GROUP BY "learningSessionId"
),
per_user AS (
  SELECT "userId",
         SUM(CASE WHEN correct = 10 THEN 3 WHEN correct > 0 THEN 2 ELSE 1 END) AS stars
  FROM scored
  GROUP BY "userId"
)
UPDATE "LearningSession" ls
SET "roundsBanked" = per_session.rounds
FROM per_session
WHERE ls."id" = per_session."learningSessionId";

-- The child's total is recounted from the answers one last time rather than
-- summed from the old column, so any award that was dropped before today is paid
-- at last. This migration can only move a total up.
WITH numbered AS (
  SELECT
    a."learningSessionId",
    ls."userId",
    a."correct",
    (row_number() OVER (PARTITION BY a."learningSessionId" ORDER BY a."answeredAt", a."id") - 1) / 10 AS round
  FROM "Attempt" a
  JOIN "LearningSession" ls ON ls."id" = a."learningSessionId"
),
scored AS (
  SELECT "userId", "learningSessionId", round, COUNT(*) FILTER (WHERE "correct") AS correct
  FROM numbered
  GROUP BY "userId", "learningSessionId", round
  HAVING COUNT(*) = 10
),
per_user AS (
  SELECT "userId",
         SUM(CASE WHEN correct = 10 THEN 3 WHEN correct > 0 THEN 2 ELSE 1 END) AS stars
  FROM scored
  GROUP BY "userId"
)
UPDATE "User" u
SET "stars" = per_user.stars
FROM per_user
WHERE u."id" = per_user."userId";

-- The sum this replaces. Its data has been carried onto "User"."stars" above.
ALTER TABLE "LearningSession" DROP COLUMN "stars";
```

Then run `npm run db:deploy && npx prisma generate` (or `npx prisma generate`
alone if there is no `DATABASE_URL`).

- [ ] **Step 1: Make the star total one column read**

In `src/lib/records.ts`, replace the body of `readStarTotal`:

```ts
/**
 * Every star the child has. One column now rather than a sum over their
 * sittings: the total is banked as it is earned and never recounted, because a
 * target is mutable and a recount of a past day against today's target would
 * take stars off a child who earned them. See the daily targets spec.
 */
export async function readStarTotal(userId: string): Promise<number> {
  if (!prisma) return 0;
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { stars: true } });
    return user?.stars ?? 0;
  } catch (error) {
    console.error('Failed to read star total', error);
    return 0;
  }
}
```

- [ ] **Step 1b: Bank a round by incrementing, behind a row lock**

Replace `awardRoundStars` in `src/lib/records.ts`. It keeps its name, its
signature and its best-effort manner; what changes is that it pays for the
rounds nobody has paid for yet instead of setting a recounted cache.

```ts
/**
 * Bank the stars for the rounds of a sitting that have not been paid for yet.
 *
 * The worth of a round is still read off the stored answers rather than taken
 * from the client - 3, 2 or 1 depending on how it went, and the browser must not
 * be the one saying which. What is *not* recounted is the total: `User.stars` is
 * incremented by the new rounds only, because a total that can be recomputed is
 * a total a changed daily target could retroactively reduce.
 *
 * `roundsBanked` is what makes that safe. It is read under `SELECT ... FOR
 * UPDATE` and moved up in the same transaction, so a repeated call, a retry, or
 * two tabs answering at once all pay for each round exactly once - the second
 * one through the lock finds the counter already past the round it came to bank.
 * It is the same row lock `updateTopicSkill` takes, for the same reason.
 *
 * Returns the child's new total, or null if nothing was banked.
 */
export async function awardRoundStars(
  userId: string,
  learningSessionId: string,
): Promise<number | null> {
  if (!prisma) return null;
  const db = prisma;
  try {
    if (!(await ownsSession(userId, learningSessionId))) return null;

    const answers = await db.attempt.findMany({
      where: { learningSessionId },
      // The same order the round chunking assumes: as they were answered, with
      // the id settling a tie so two calls cannot chunk the sitting differently.
      orderBy: [{ answeredAt: 'asc' }, { id: 'asc' }],
      select: { correct: true },
    });
    const closed = rounds(answers.map((answer) => answer.correct));

    return await db.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<{ roundsBanked: number }[]>`
        SELECT "roundsBanked"
        FROM "LearningSession"
        WHERE "id" = ${learningSessionId}
        FOR UPDATE
      `;

      const banked = locked[0]?.roundsBanked;
      if (banked === undefined || closed.length <= banked) return null;

      const gained = closed
        .slice(banked)
        .reduce((total, round) => total + round.stars, 0);

      await tx.learningSession.update({
        where: { id: learningSessionId },
        data: { roundsBanked: closed.length },
      });
      const user = await tx.user.update({
        where: { id: userId },
        data: { stars: { increment: gained } },
        select: { stars: true },
      });

      return user.stars;
    });
  } catch (error) {
    console.error('Failed to award stars', error);
    return null;
  }
}
```

Change the `starsEarned` import from `@/lib/rewards/stars` to `rounds` - the
total is no longer computed anywhere on the server. If `starsEarned` now has no
importer outside its own tests, leave it exported: it is the definition of what a
run of answers is worth and the tests read it as such.

- [ ] **Step 2: Add the two reads and the award**

Add to `src/lib/records.ts`, after `readStarTotal`, with the imports at the top of the file:

```ts
import {
  TARGET_STARS,
  dayTotal,
  parseTarget,
  targetProgress,
  type DailyTarget,
  type TargetAnswer,
} from '@/lib/rewards/target';
import { localDay } from '@/lib/day';
```

(If `localDay` is already imported there, leave the existing import alone.)

```ts
/** A child's target, and the last day its stars were banked. */
export interface TargetSettings {
  target: DailyTarget | null;
  targetDay: number | null;
}

const noTarget = (): TargetSettings => ({ target: null, targetDay: null });

export async function readTargetSettings(userId: string): Promise<TargetSettings> {
  if (!prisma) return noTarget();
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { targetKind: true, targetValue: true, targetDay: true },
    });
    if (!user) return noTarget();
    return { target: parseTarget(user.targetKind, user.targetValue), targetDay: user.targetDay };
  } catch (error) {
    console.error('Failed to read daily target', error);
    return noTarget();
  }
}

/**
 * A child's answers since a moment, across every subject and sitting.
 *
 * Deliberately not scoped to a subject the way `readObservations` is: a target
 * is the child's whole day, and a child who does twenty questions of maths has
 * done twenty questions whichever screen they were on.
 *
 * It returns the answers rather than a total because the server does not know
 * what day it is where the child is. The device does, so the fold into "today"
 * happens there - the same reason `currentStreak` is computed in the browser.
 */
export async function readRecentAnswers(userId: string, sinceMs: number): Promise<TargetAnswer[]> {
  if (!prisma) return [];
  try {
    const rows = await prisma.attempt.findMany({
      where: { learningSession: { userId }, answeredAt: { gte: new Date(sinceMs) } },
      orderBy: { answeredAt: 'asc' },
      select: { answeredAt: true, timeTakenMs: true },
    });
    return rows.map((row) => ({
      answeredAt: row.answeredAt.getTime(),
      timeTakenMs: row.timeTakenMs,
    }));
  } catch (error) {
    console.error('Failed to read recent answers', error);
    return [];
  }
}

/**
 * Two days of answers is all a target ever needs, whichever side of midnight the
 * child's own clock is on. Exported because the screens that render a target
 * read the same window, and two of them disagreeing about it would show a bar
 * that disagreed with the award.
 */
export const TARGET_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Bank the day's target stars, if today's answers have reached the target.
 *
 * The recount is per child and per day rather than per sitting: a target is not
 * subject-specific, and a child may well switch subject or level part way
 * through an evening.
 *
 * The `where` on `targetDay` is the whole of the guard, in one statement, in the
 * shape the play streak already uses. Two tabs answering at once, a retried call
 * and a client that fires this on every answer of the evening all award exactly
 * once - the second write matches no row and reports nothing awarded.
 *
 * Best-effort like every other write on the play path: a missed award costs ten
 * stars and repairs itself on the child's next answer of the day, which is a far
 * better failure than an interrupted question.
 */
export async function awardDailyTarget(
  userId: string,
  learningSessionId: string,
  { now, offsetMinutes }: { now: number; offsetMinutes: number },
): Promise<{ awarded: boolean; stars: number } | null> {
  if (!prisma) return null;
  try {
    if (!(await ownsSession(userId, learningSessionId))) return null;

    const { target } = await readTargetSettings(userId);
    if (!target) return null;

    const answers = await readRecentAnswers(userId, now - TARGET_WINDOW_MS);
    if (!targetProgress(target, dayTotal(answers, { now, offsetMinutes })).complete) {
      return { awarded: false, stars: await readStarTotal(userId) };
    }

    const today = localDay(now, offsetMinutes);
    const written = await prisma.user.updateMany({
      where: { id: userId, OR: [{ targetDay: null }, { targetDay: { lt: today } }] },
      data: { targetDay: today, stars: { increment: TARGET_STARS } },
    });

    return { awarded: written.count > 0, stars: await readStarTotal(userId) };
  } catch (error) {
    console.error('Failed to award daily target', error);
    return null;
  }
}
```

- [ ] **Step 3: Add the server action**

In `src/app/play/actions.ts`, add `awardDailyTarget` to the `@/lib/records` import and append:

```ts
/**
 * Bank the day's target, if it has been reached. The server recounts today's
 * answers itself, so this says only *that* an answer landed - never how far
 * along the day is. The offset comes from the client because the server has no
 * timezone, exactly as it does for every recorded answer.
 */
export async function awardTargetAction(
  learningSessionId: string,
  offsetMinutes: number,
): Promise<{ awarded: boolean; stars: number } | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return awardDailyTarget(session.user.id, learningSessionId, { now: Date.now(), offsetMinutes });
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test && npm run lint`
Expected: no type errors, all existing tests pass.

Then, with a database, check the guard by hand - it is the whole reason an
increment is safe here. `npm run dev`, play ten questions, and confirm the star
total went up by the round's worth exactly once. Then call the round action twice
in a row for the same sitting (two tabs on the play screen will do it, or a
second `awardRoundAction` from the browser console) and confirm the total does
not move the second time.

- [ ] **Step 5: Commit**

```bash
git add src/lib/records.ts src/app/play/actions.ts
git commit -m "Bank stars by incrementing one total, guarded per event"
```

---

### Task 4: The parent sets the target

**Files:**
- Modify: `src/components/parent-dashboard.tsx` (`ChildRow`, `ChildCard`, `ChildForm`)
- Modify: `src/app/(parent)/children/page.tsx`

**Interfaces:**
- Consumes: `targetOptions`, `DailyTarget`, `TargetKind` from Task 1; `ChildProfile.target` from Task 2; `createChildAction`/`updateChildAction`'s new parameters from Task 2.
- Produces: `ChildRow` gains `target: DailyTarget | null`.

- [ ] **Step 1: Carry the target to the client**

In `src/app/(parent)/children/page.tsx`, add `target: child.target,` to the mapped `rows`.

In `src/components/parent-dashboard.tsx`, import and extend the row:

```ts
import { targetOptions, type DailyTarget, type TargetKind } from '@/lib/rewards/target';
```

```ts
export interface ChildRow {
  id: string;
  name: string;
  avatar: Avatar;
  level: string | null;
  target: DailyTarget | null;
  code: string | null;
  codeExpiresAt: string | null;
}
```

- [ ] **Step 2: Say the goal on the card**

Add above `ChildCard`:

```ts
/**
 * A target in a parent's words. Short, because it sits in a row of short facts
 * beside the level - the same reason that row says "Year K" rather than
 * "Kindergarten".
 */
export const targetLabel = (target: DailyTarget): string =>
  `${target.value} ${target.kind === 'minutes' ? 'min' : 'questions'} a day`;
```

In `ChildCard`, replace the level line with the level and the goal:

```tsx
          <p className="text-sm text-(--color-ink-soft)">
            {child.level ? shortYearLabel(child.level as YearLevel) : 'No level set'}
            {/* Only ever an addition. A card reading "No daily goal" would put an
                absence on every card of every parent who never wanted one. */}
            {child.target ? ` · Goal: ${targetLabel(child.target)}` : ''}
          </p>
```

- [ ] **Step 3: Add the goal row to the form**

In `ChildForm`, add the two pieces of state beside `level`:

```ts
  // "none" is a real choice here rather than an absence, so the dropdown has
  // something to show for the child who has no goal.
  const [targetKind, setTargetKind] = useState<TargetKind | 'none'>(initial?.target?.kind ?? 'none');
  const [targetValue, setTargetValue] = useState<string>(
    String(initial?.target?.value ?? targetOptions(initial?.target?.kind ?? 'questions')[0]),
  );
```

When the kind changes the value has to move with it - twenty questions and twenty minutes are not the same range:

```ts
  const changeKind = (next: string) => {
    const kind = next as TargetKind | 'none';
    setTargetKind(kind);
    if (kind !== 'none') setTargetValue(String(targetOptions(kind)[0]));
  };
```

Update the submit call:

```ts
      const saved = initial
        ? await updateChildAction(initial.id, name, avatar, level, targetKind, targetValue)
        : await createChildAction(name, avatar, level, targetKind, targetValue);
```

Add the row after the name/level row and before the `Picture` fieldset:

```tsx
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="child-target-kind" className="mb-1 block text-sm font-semibold">
            Daily goal
          </label>
          <Select
            id="child-target-kind"
            size="md"
            value={targetKind}
            options={[
              { value: 'none', label: 'No goal' },
              { value: 'questions', label: 'Questions' },
              { value: 'minutes', label: 'Minutes' },
            ]}
            onChange={changeKind}
          />
        </div>

        {targetKind !== 'none' ? (
          <div>
            <label htmlFor="child-target-value" className="mb-1 block text-sm font-semibold">
              How many
            </label>
            <Select
              id="child-target-value"
              size="md"
              value={targetValue}
              options={targetOptions(targetKind).map((option) => ({
                value: String(option),
                label: String(option),
              }))}
              onChange={setTargetValue}
            />
          </div>
        ) : null}
      </div>

      {/* The one thing a parent needs told, and the reason the ceilings are where
          they are: a goal is a floor to reach, never a limit to stop at. */}
      <p className="text-sm text-(--color-ink-soft)">
        Optional. Reaching it is worth 10 stars, and nothing stops them carrying on past it.
      </p>
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: clean. Then `npm run dev`, sign in as a parent, and check on `/children`: adding a child with a goal, editing one to change the kind (the value list must change with it), editing one to "No goal", and that the card line appears and disappears with it.

- [ ] **Step 5: Commit**

```bash
git add src/components/parent-dashboard.tsx "src/app/(parent)/children/page.tsx"
git commit -m "Let a parent set a daily goal on a child"
```

---

### Task 5: The bar

**Files:**
- Create: `src/components/target-bar.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `<TargetBar fraction={number} className?={string} />` - a presentational bar and nothing else. It reads no clock and holds no state, so both screens can drive it from whatever they know.

- [ ] **Step 1: Add the sparkle keyframe**

In `src/app/globals.css`, beside the other keyframes:

```css
/*
  The sweep across the target bar's fill. Slow, and low contrast: it has to be
  visible from a child's arm's length without becoming the thing on screen worth
  watching - the play screen's rule is that nothing there competes with the
  question.
*/
@keyframes target-sparkle {
  from {
    background-position: -150% 0;
  }
  to {
    background-position: 250% 0;
  }
}
```

- [ ] **Step 2: Write the component**

Create `src/components/target-bar.tsx`:

```tsx
/**
 * The daily target, drawn as one bar.
 *
 * It carries no numbers on purpose. A count in the corner of the play screen is
 * exactly what the header was stripped of - a thing a child watches instead of
 * the question - and a picture of how far along the day is says the same thing
 * without ever being read. The home screen puts the words beside it, where there
 * is room and nothing to be distracted from.
 *
 * Red to green from left to right, so the bar says how the day is going by
 * colour as well as by length: the first question of the day is at the warm end
 * and the last one is at the green end, and getting there is the whole point.
 */

/**
 * A sliver of fill for a day barely started. A bar drawn at 2% is one pixel and
 * reads as nothing done - which is a lie to a child who has just answered.
 */
const MIN_VISIBLE = 0.04;

export function TargetBar({ fraction, className = '' }: { fraction: number; className?: string }) {
  const filled = Math.min(1, Math.max(0, fraction));
  const width = filled === 0 ? 0 : Math.max(MIN_VISIBLE, filled);

  return (
    <div
      role="progressbar"
      aria-label="Today's goal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(filled * 100)}
      className={`h-2.5 overflow-hidden rounded-full bg-(--color-line) sm:h-3 ${className}`}
    >
      <div
        // A long transition, so the fill glides rather than jumps. It is the same
        // duration whether the bar moved by one question or by a minute's creep,
        // which is what makes the two look like one continuous thing.
        className="h-full rounded-full transition-[width] duration-1000 ease-out"
        style={{
          width: `${width * 100}%`,
          backgroundImage:
            'linear-gradient(90deg, var(--color-wrong), var(--color-star), var(--color-right))',
          // The gradient is sized to the whole track, not to the fill, so a
          // half-full bar is the left half of the run and not a squashed copy of
          // all of it - the colour has to mean the same thing at every length.
          backgroundSize: `${width === 0 ? 100 : 100 / width}% 100%`,
        }}
      >
        <span
          aria-hidden
          className="block h-full w-full animate-[target-sparkle_2.8s_linear_infinite]"
          style={{
            backgroundImage:
              'linear-gradient(100deg, transparent 35%, rgb(255 255 255 / 0.55) 50%, transparent 65%)',
            backgroundSize: '200% 100%',
            backgroundRepeat: 'no-repeat',
          }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/target-bar.tsx src/app/globals.css
git commit -m "Draw the daily target as one bar"
```

---

### Task 6: The bar on the play screen

**Files:**
- Modify: `src/app/play/page.tsx`
- Modify: `src/components/play-session.tsx`

**Interfaces:**
- Consumes: `TargetBar` (Task 5); `readTargetSettings`, `readRecentAnswers` (Task 3); `dayTotal`, `targetProgress`, `targetUnits`, `totalFor`, `TargetAnswer`, `DailyTarget` (Task 1); `MAX_TIME_MS` from `src/lib/session/session.ts`.
- Produces: `PlaySession` gains one prop, used again by Task 7 -

```ts
  target: {
    target: DailyTarget;
    /** The child's answers over the last two days, in date order. */
    answers: TargetAnswer[];
    /** The last local day the award was banked, so the client can tell if today is done. */
    awardedDay: number | null;
  } | null;
```

- [ ] **Step 1: Read the target on the server**

In `src/app/play/page.tsx`, import:

```ts
import { TARGET_WINDOW_MS, readRecentAnswers, readTargetSettings } from '@/lib/records';
```

(add them to the existing `@/lib/records` import), and after the profile reads:

```ts
  // The server does not know what day it is where the child is, so it hands over
  // a window of answers and the device decides which of them are today's.
  const settings = userId ? await readTargetSettings(userId) : null;
  const targetAnswers =
    settings?.target && userId ? await readRecentAnswers(userId, Date.now() - TARGET_WINDOW_MS) : [];
```

and pass it down:

```tsx
      target={
        settings?.target
          ? { target: settings.target, answers: targetAnswers, awardedDay: settings.targetDay }
          : null
      }
```

- [ ] **Step 2: Take the prop and work out today**

In `src/components/play-session.tsx`, add the imports:

```ts
import { MAX_TIME_MS } from '@/lib/session/session';
import {
  dayTotal,
  targetUnits,
  totalFor,
  type DailyTarget,
  type TargetAnswer,
} from '@/lib/rewards/target';
import { TargetBar } from './target-bar';
```

(`MAX_TIME_MS` joins the existing `@/lib/session/session` import.)

Add to `Props`:

```ts
  /**
   * The daily target, if the child's parent set one. Null for a child with no
   * target and for one signed in with their own account, and the screen then
   * looks exactly as it did before this feature.
   */
  target: {
    target: DailyTarget;
    answers: TargetAnswer[];
    awardedDay: number | null;
  } | null;
```

Add `target` to the destructured parameters.

Inside the component, after the `stars` state:

```ts
  /**
   * How much of today's target is done, in the target's own unit. Null until the
   * effect below works it out: which answers count as "today" depends on the
   * offset of the device this is running on, and that is not known while
   * rendering on the server - the same reason the streak is settled in the
   * browser. The bar simply does not exist until it is.
   */
  const [targetDone, setTargetDone] = useState<number | null>(null);
  /** Set once today's target is done, which is what takes the bar off this screen. */
  const [targetFinished, setTargetFinished] = useState(false);
```

Then the effect that settles both, once, on mount:

```ts
  // Today is the child's day, so it is worked out here rather than on the
  // server: the offset is the device's, and only the device has it.
  useEffect(() => {
    if (!target) return;
    const now = Date.now();
    const offsetMinutes = -new Date(now).getTimezoneOffset();
    setTargetDone(totalFor(dayTotal(target.answers, { now, offsetMinutes }), target.target.kind));
    // A child who hit their goal this morning and came back after school has
    // nothing left to fill, and a bar sitting full all evening is a thing to
    // look at that says nothing.
    setTargetFinished(target.awardedDay === localDay(now, offsetMinutes));
  }, [target]);
```

- [ ] **Step 3: Fold each answer into it**

In `submit`, immediately after `const next = submitAnswer(...)`, add:

```ts
      // The target's own view of the answer. Questions step by one; minutes take
      // the time the answer was actually recorded with, cap and all, so the bar
      // and the parent's report can never disagree.
      if (target) {
        const attempt = next.attempts[next.attempts.length - 1];
        setTargetDone((done) =>
          done === null
            ? done
            : done + (target.target.kind === 'questions' ? 1 : attempt.timeTakenMs),
        );
      }
```

- [ ] **Step 4: Make a minutes bar creep during the question**

After the effect from Step 2:

```ts
  /**
   * A minutes bar has to move while the child is thinking, or it would sit still
   * through the one thing it is measuring. So it shows the time this question has
   * taken so far - capped at exactly the cap the answer will be recorded with, so
   * what is shown can never run ahead of what is counted. It settles onto the
   * real total when the answer lands.
   */
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!target || target.target.kind !== 'minutes' || feedback !== null) {
      setElapsed(0);
      return;
    }
    const tick = () =>
      setElapsed(Math.min(MAX_TIME_MS, Math.max(0, Date.now() - session.questionShownAt)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target, feedback, session.questionShownAt]);

  const targetFraction =
    target === null || targetDone === null
      ? 0
      : Math.min(1, (targetDone + elapsed) / targetUnits(target.target));
```

- [ ] **Step 5: Put it on the screen**

In the JSX, between the `<header>` and the question `<div>`:

```tsx
      {/* Top centre, above the question and below nothing. The only thing on this
          screen that keeps a running count of anything, and it does it as a
          picture rather than a number for exactly the reason the header does
          not: a figure is something to watch instead of the question. It goes
          entirely once the day's goal has been celebrated. */}
      {target !== null && targetDone !== null && !targetFinished ? (
        <div className="flex shrink-0 justify-center pt-2 sm:pt-3">
          <TargetBar fraction={targetFraction} className="w-2/3 max-w-sm" />
        </div>
      ) : null}
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: clean.

Then `npm run dev`. As a parent, set a child a goal of 10 questions; sign in as that child and play. Check: the bar appears above the question, steps forward on each answer, and both orientations of an iPad and a narrow phone still fit with no scrolling (the play screen is `h-[100dvh]` with `overflow-hidden` - this is the one change in this plan that can break that). Then set a 5-minute goal and check the bar creeps while a question sits unanswered and stops the moment it is answered.

- [ ] **Step 7: Commit**

```bash
git add src/app/play/page.tsx src/components/play-session.tsx
git commit -m "Show the day's goal filling on the play screen"
```

---

### Task 7: The celebration

**Files:**
- Create: `src/components/target-reward.tsx`
- Modify: `src/components/play-session.tsx`

**Interfaces:**
- Consumes: `TARGET_STARS`, `targetProgress`, `targetUnits` (Task 1); `awardTargetAction` (Task 3); `targetDone`/`targetFinished` state (Task 6); `StarIcon`, `playSound`.
- Produces: `<TargetReward target={DailyTarget} onDone={() => void} />`.

- [ ] **Step 1: Write the celebration**

Create `src/components/target-reward.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { TARGET_STARS, type DailyTarget } from '@/lib/rewards/target';
import { StarIcon } from './star-icon';
import { playSound } from './sounds';

/**
 * The day's goal, reached. Ten stars is the largest single award in the app, so
 * it gets a screen of its own rather than a line on somebody else's.
 *
 * It shares the round celebration's shape and its fanfare deliberately - a child
 * has learned what that screen and that sound mean, and this is the same kind of
 * event, only bigger. What differs is what it says: the round says how the last
 * ten questions went, and this says the day is done.
 *
 * Like the round's stars it never traps anybody: a tap goes on, and it leaves by
 * itself if they just watch it.
 */

/** A beat longer than a round's stars - there is a sentence more to read. */
const SHOWN_MS = 4000;

export function TargetReward({ target, onDone }: { target: DailyTarget; onDone: () => void }) {
  useEffect(() => {
    playSound('tada');
  }, []);

  useEffect(() => {
    const timer = setTimeout(onDone, SHOWN_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Continue"
      onClick={onDone}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onDone();
      }}
      className="no-select fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 bg-(--color-paper)/95 px-8 backdrop-blur-sm sm:gap-8"
    >
      <div
        className="flex items-center gap-3 text-(--color-star)"
        aria-label={`${TARGET_STARS} stars`}
      >
        <StarIcon filled className="h-24 w-24 animate-[star-land_450ms_ease-out_both] sm:h-32 sm:w-32" />
        <span className="animate-[reward-in_400ms_ease-out_both] text-6xl font-bold tabular-nums [animation-delay:250ms] sm:text-7xl">
          +{TARGET_STARS}
        </span>
      </div>

      <div className="animate-[reward-in_400ms_ease-out_both] space-y-2 text-center [animation-delay:700ms]">
        <p className="text-4xl font-bold sm:text-5xl">Goal reached!</p>
        <p className="text-xl text-(--color-ink-soft) sm:text-2xl">
          {target.kind === 'minutes'
            ? `${target.value} minutes of practice today`
            : `${target.value} questions today`}
        </p>
      </div>

      {/* Never "you can stop now". The goal is a floor, and carrying on past it
          is the thing this app would rather they did. */}
      <p className="text-lg text-(--color-ink-soft)/70 sm:text-xl">Tap to keep going</p>
    </div>
  );
}
```

- [ ] **Step 2: Wire the award into the answer path**

In `src/components/play-session.tsx`, add to the imports:

```ts
import { awardTargetAction } from '@/app/play/actions';
import { TargetReward } from './target-reward';
import { TARGET_STARS } from '@/lib/rewards/target';
```

(`awardTargetAction` joins the existing `@/app/play/actions` import; `TARGET_STARS` joins the `@/lib/rewards/target` one.)

Add the state beside `reward`:

```ts
  /** The day's goal, while its stars are on screen. Queued behind a round's. */
  const [targetReward, setTargetReward] = useState<DailyTarget | null>(null);
```

Inside `submit`, in the `recordAttemptAction(...).then(...)` callback, after the `awardRoundAction` line:

```ts
          // The day's goal, asked for after the answer is written for the same
          // reason the round's stars are: the server recounts from the stored
          // answers, and a recount that raced this answer would find one fewer
          // and award nothing. Asking on every answer is safe and is what makes
          // a dropped call repair itself - the compare-and-set on the day means
          // only one of them can ever pay out.
          if (target && !targetFinished) {
            awardTargetAction(id, offsetMinutes).then((result) => {
              if (!result?.awarded) return;
              setTargetReward(target.target);
              setStars((total) => total + TARGET_STARS);
            });
          }
```

Add `target` and `targetFinished` to `submit`'s dependency array.

- [ ] **Step 3: Queue it behind the round's stars and take the bar away**

Add the dismissal beside `dismissReward`:

```ts
  /**
   * Same as dismissing a round's stars: the next question has been waiting
   * behind this screen rather than in front of the child, so its clock starts
   * again here and the break never lands inside that question's recorded time.
   */
  const dismissTargetReward = useCallback(() => {
    setTargetReward(null);
    setTargetFinished(true);
    setSession((state) => ({ ...state, questionShownAt: Date.now() }));
  }, []);
```

In the keyboard handler, extend the guard that swallows keys while a reward is up:

```ts
      // The stars are over everything else, so nothing behind them may be answered.
      if (reward || targetReward) {
        if (key === 'Enter' || key === ' ') {
          event.preventDefault();
          if (reward) dismissReward();
          else dismissTargetReward();
        }
        return;
      }
```

and add `targetReward` and `dismissTargetReward` to that effect's dependency array.

Render it last, only once the round's stars are gone - which is the whole of the queue:

```tsx
      {reward !== null && <RoundReward round={reward} onDone={dismissReward} />}
      {/* Queued rather than stacked: an answer can close a round and finish the
          day at once, and two full-screen celebrations at the same moment would
          share one tap between them. The round goes first because it is about
          the ten questions just answered; the day is the bigger thing and comes
          last. */}
      {reward === null && targetReward !== null && (
        <TargetReward target={targetReward} onDone={dismissTargetReward} />
      )}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: clean.

Then `npm run dev` and check three things by hand, as a child with a goal of 10 questions - which is deliberately the same as `ROUND_SIZE`, so the tenth answer fires both:

1. The tenth answer shows the round's three stars, then the goal's screen when that is dismissed (and again if left to time out).
2. Once the goal screen is gone, the bar is gone too, and stays gone through further questions.
3. Answering on past the goal awards nothing more - the star total in the profile menu rises by 10 exactly once. Reload and confirm the server agrees.

- [ ] **Step 5: Commit**

```bash
git add src/components/target-reward.tsx src/components/play-session.tsx
git commit -m "Celebrate the day's goal, after the round's stars"
```

---

### Task 8: The goal on the child's home screen

**Files:**
- Create: `src/components/daily-goal.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `TargetBar` (Task 5); `readTargetSettings`, `readRecentAnswers` (Task 3); `dayTotal`, `targetProgress`, `totalFor` (Task 1).
- Produces: `<DailyGoal target={DailyTarget} answers={TargetAnswer[]} awardedDay={number | null} />`.

- [ ] **Step 1: Write the line**

Create `src/components/daily-goal.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { localDay } from '@/lib/day';
import {
  dayTotal,
  targetProgress,
  type DailyTarget,
  type TargetAnswer,
} from '@/lib/rewards/target';
import { TargetBar } from './target-bar';

/**
 * Today's goal, on the screen a child checks before they start - which is
 * exactly when "how far off am I" is the question they have.
 *
 * There is room for words here, unlike the play screen, so the bar gets a line
 * saying what the goal is and how much of it is done.
 *
 * It stays once the goal is met, where the play screen's bar goes - the two are
 * protecting different things. On the play screen a bar that no longer moves is
 * only something to look at instead of the question; here a child arriving to
 * find the day already done is worth seeing, and this is the one place that
 * lasts, since the celebration itself is over in four seconds.
 *
 * Which answers count as today depends on the offset of this device, which the
 * server does not have - so the fold happens here, on mount, the same way the
 * play streak is settled in the browser.
 */
export function DailyGoal({
  target,
  answers,
  awardedDay,
}: {
  target: DailyTarget;
  answers: TargetAnswer[];
  awardedDay: number | null;
}) {
  const [today, setToday] = useState<{ done: number; fraction: number; complete: boolean } | null>(
    null,
  );

  useEffect(() => {
    const now = Date.now();
    const offsetMinutes = -new Date(now).getTimezoneOffset();
    const progress = targetProgress(target, dayTotal(answers, { now, offsetMinutes }));
    setToday({
      done: progress.done,
      fraction: progress.fraction,
      complete: progress.complete || awardedDay === localDay(now, offsetMinutes),
    });
  }, [target, answers, awardedDay]);

  // Nothing at all until the device has said what day it is - a bar that renders
  // empty and then jumps is worse than one that arrives a frame late.
  if (today === null) return null;

  const done =
    target.kind === 'minutes'
      ? `${Math.floor(today.done / 60_000)} of ${target.value} min`
      : `${today.done} of ${target.value}`;

  return (
    <div
      className={`mb-8 rounded-2xl border-2 px-5 py-4 ${
        today.complete
          ? 'border-(--color-right) bg-(--color-right-soft)'
          : 'border-(--color-line) bg-(--color-card)'
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-xl font-semibold">
          {today.complete ? (
            <span className="text-(--color-right)">Goal reached!</span>
          ) : (
            <>
              Today&rsquo;s goal: {target.value}{' '}
              {target.kind === 'minutes' ? 'minutes' : 'questions'}
            </>
          )}
        </p>
        {/* The count stays after the goal is met, and keeps going up: carrying on
            past the goal is the thing this app would rather they did, so the
            screen has to have somewhere to show that they did. */}
        <p className="text-lg tabular-nums text-(--color-ink-soft)">{done}</p>
      </div>
      <TargetBar fraction={today.fraction} className="mt-3" />
    </div>
  );
}
```

- [ ] **Step 2: Read it on the home screen**

In `src/app/page.tsx`, add `TARGET_WINDOW_MS`, `readRecentAnswers` and `readTargetSettings` to the `@/lib/records` import and `import { DailyGoal } from '@/components/daily-goal';`.

Beside the existing streak and star reads (the branch guarded by `userId && !isParent`), read the target as well:

```ts
  // A parent has no goal of their own, so this is read on the same branch that
  // skips their streak and stars.
  const settings = userId && !isParent ? await readTargetSettings(userId) : null;
  const targetAnswers =
    settings?.target && userId ? await readRecentAnswers(userId, Date.now() - TARGET_WINDOW_MS) : [];
```

Render it in the child's branch, immediately after the closing `</header>` of the welcome band and before the level picker / subject cards:

```tsx
      {settings?.target ? (
        <DailyGoal
          target={settings.target}
          answers={targetAnswers}
          awardedDay={settings.targetDay}
        />
      ) : null}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test && npm run lint && npm run build`
Expected: clean.

Then `npm run dev`: as a child with a goal, the line sits under the band and above the cards and reads the same count the play screen's bar shows. After hitting the goal it stays, turns green and reads "Goal reached!" with a full bar - and answering on past the goal keeps pushing the count up while the bar stays full. A child with no goal sees no change at all.

- [ ] **Step 4: Commit**

```bash
git add src/components/daily-goal.tsx src/app/page.tsx
git commit -m "Say the day's goal on the child's home screen"
```

---

### Task 9: The target in the practice calendar

**Files:**
- Modify: `src/lib/analytics/report.ts` (add `dailyTotals`)
- Modify: `src/lib/analytics/report.test.ts`
- Modify: `src/components/practice-calendar.tsx`
- Modify: `src/components/progress-usage.tsx`
- Modify: `src/components/progress-report.tsx`
- Modify: `src/app/(parent)/progress/page.tsx`

**Interfaces:**
- Consumes: `targetCell`, `DayTotal`, `TargetAnswer`, `DailyTarget` (Task 1); `readRecentAnswers`, `ChildProfile.target` (Tasks 2-3).
- Produces:

```ts
// report.ts
export function dailyTotals(
  answers: readonly TargetAnswer[],
  options: { offsetMinutes?: number },
): Map<number, DayTotal>;   // keyed by the same day-bucket start `calendarWeeks` uses
```
  `PracticeCalendar` gains `target?: DailyTarget | null` and `totals?: Map<number, DayTotal>`.

- [ ] **Step 1: Write the failing test for `dailyTotals`**

Add to `src/lib/analytics/report.test.ts` (and add `dailyTotals` to the import from `./report`):

```ts
describe('dailyTotals', () => {
  const DAY = 24 * 60 * 60 * 1000;
  const at = (day: number, hour = 12) => day * DAY + hour * 60 * 60 * 1000;

  it('keys each day by the same bucket the calendar draws', () => {
    const totals = dailyTotals(
      [
        { answeredAt: at(100, 9), timeTakenMs: 20_000 },
        { answeredAt: at(100, 20), timeTakenMs: 40_000 },
        { answeredAt: at(101), timeTakenMs: 10_000 },
      ],
      {},
    );

    expect(totals.get(100 * DAY)).toEqual({ questions: 2, timeMs: 60_000 });
    expect(totals.get(101 * DAY)).toEqual({ questions: 1, timeMs: 10_000 });
    expect(totals.get(99 * DAY)).toBeUndefined();
  });

  it('buckets by the child s day, not the server s', () => {
    // 8pm UTC is 6am the next day in Sydney, so this answer belongs to day 101.
    const sydney = 10 * 60;
    const totals = dailyTotals([{ answeredAt: at(100, 20), timeTakenMs: 5_000 }], {
      offsetMinutes: sydney,
    });

    expect(totals.get(101 * DAY)).toEqual({ questions: 1, timeMs: 5_000 });
    expect(totals.get(100 * DAY)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/lib/analytics/report.test.ts`
Expected: FAIL - `dailyTotals is not a function`.

- [ ] **Step 3: Implement `dailyTotals`**

In `src/lib/analytics/report.ts`, import the types and add the function beside `calendarWeeks`:

```ts
import type { DayTotal, TargetAnswer } from '../rewards/target';
```

(relative, like every other import in that file - the `@/` alias is used from
`src/app` and `src/components`, not from inside `src/lib`.)

```ts
/**
 * Every day's answers, in both units, keyed by the same day bucket
 * `calendarWeeks` builds its grid from - so a cell can be measured against a
 * daily target without the two disagreeing about where a day starts.
 *
 * It takes bare answers rather than `Observation`s because a target is not
 * subject-specific: the calendar is measuring the child's whole day, while the
 * rest of this screen is scoped to one subject.
 */
export function dailyTotals(
  answers: readonly TargetAnswer[],
  { offsetMinutes = 0 }: { offsetMinutes?: number },
): Map<number, DayTotal> {
  const offsetMs = offsetMinutes * 60_000;
  const totals = new Map<number, DayTotal>();

  for (const answer of answers) {
    const key = bucketStart(answer.answeredAt, 'day', offsetMs);
    const total = totals.get(key) ?? { questions: 0, timeMs: 0 };
    totals.set(key, {
      questions: total.questions + 1,
      timeMs: total.timeMs + answer.timeTakenMs,
    });
  }

  return totals;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/lib/analytics/report.test.ts`
Expected: PASS.

- [ ] **Step 5: Draw the target in the calendar**

In `src/components/practice-calendar.tsx`, add the imports:

```ts
import { targetCell, type DailyTarget, type DayTotal } from '@/lib/rewards/target';
```

Extend the component's props and cell drawing. Replace the exported component with:

```tsx
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
  /** Every day's answers across all subjects, keyed by day bucket. */
  totals?: Map<number, DayTotal>;
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
        ) : target ? (
          <TargetCell
            key={day.start}
            day={day}
            target={target}
            total={totals?.get(day.start) ?? { questions: 0, timeMs: 0 }}
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
```

- [ ] **Step 6: Pass the target down the report**

In `src/app/(parent)/progress/page.tsx`, read four weeks of the child's answers across every subject alongside the existing reads:

```ts
  // Four weeks and a margin, across every subject: the calendar measures the
  // child's whole day against their goal, while everything else on this screen
  // is scoped to the subject being looked at.
  const CALENDAR_WINDOW_MS = 29 * 24 * 60 * 60 * 1000;

  const [observations, sittings, targetAnswers] = await Promise.all([
    readObservations(child.id, subject),
    readSittings(child.id, subject),
    readRecentAnswers(child.id, requestNow() - CALENDAR_WINDOW_MS),
  ]);
```

(add `readRecentAnswers` to the `@/lib/records` import) and pass to `ProgressReport`:

```tsx
      target={child.target}
      targetAnswers={targetAnswers}
```

In `src/components/progress-report.tsx`, take the two new props (`target: DailyTarget | null` and `targetAnswers: TargetAnswer[]`) and pass them straight through to `ProgressUsage`.

In `src/components/progress-usage.tsx`, take them too, compute the totals and hand them to the calendar:

```ts
import { calendarWeeks, dailyTotals, headline, topicReports } from '@/lib/analytics/report';
import type { DailyTarget, TargetAnswer } from '@/lib/rewards/target';
```

```ts
  const totals = dailyTotals(targetAnswers, { offsetMinutes });
```

```tsx
      <Well
        title="Practice"
        aside={`${practisedDays(weeks)} of the last ${elapsedDays(weeks)} days`}
        // Past days are measured against the goal as it stands now - a goal that
        // has been changed was not stored per day, and saying so is what keeps
        // a re-judged fortnight from being a surprise.
        note={
          target
            ? `Green days met their goal of ${target.value} ${
                target.kind === 'minutes' ? 'minutes' : 'questions'
              } a day. Part-filled days came close.`
            : undefined
        }
      >
        <PracticeCalendar
          weeks={weeks}
          offsetMinutes={offsetMinutes}
          target={target}
          totals={totals}
        />
      </Well>
```

(If `Well`'s `note` prop is named differently, use the name it actually has - check `src/components/well.tsx`.)

- [ ] **Step 7: Verify**

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Expected: clean.

Then `npm run dev` and look at `/progress` for a child with a goal: met days green with a tick, part days filled proportionally, untouched days grey, and days beyond today still blank. Remove the goal and confirm the grid returns to the four-step blue shading exactly as before.

- [ ] **Step 8: Commit**

```bash
git add src/lib/analytics/report.ts src/lib/analytics/report.test.ts src/components/practice-calendar.tsx src/components/progress-usage.tsx src/components/progress-report.tsx "src/app/(parent)/progress/page.tsx"
git commit -m "Measure the practice calendar against the child's goal"
```

---

### Task 10: Document it

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Write the section**

Add a `## Daily targets` section to `CLAUDE.md`, after `## Rewards`, covering, in the file's existing voice:

- **Revise the existing `## Rewards` section as well**, which currently says stars are derived, that `starsEarned` over a sitting's answers reproduces `LearningSession.stars`, and that the server sets rather than increments. None of that is true after this work. Replace it with the incremented `User.stars` and its two guards, and keep the reasoning for why the change was made.
- A parent may set one optional target per child - questions or minutes a day, not per subject. Questions 10-60, minutes 5-30, in fives; the floors are so a young child's first target can be an easy one, the ceilings so a parent cannot set a bar nobody clears.
- A minute is summed capped `timeTakenMs`, the same number the report calls "time on questions" - never wall clock.
- Hitting it is worth `TARGET_STARS` (10), flat rather than scaled, so a child's star total never becomes a measure of what their parent asked for.
- `User.stars` is the app's only star total, and it is a banked fact rather than a cache. It replaced `SUM(LearningSession.stars)` because the old sum was recounted from the answers, and a target is mutable - recounting a past day against today's setting would take stars off a child who earned them.
- Every increment sits behind a guard, which is what replaced the recount's idempotence: `LearningSession.roundsBanked` read under `SELECT ... FOR UPDATE` for a round, `User.targetDay` compare-and-set for a day's target. The cost, stated in the spec, is that a dropped award no longer heals itself - a total can only fail to grow, never shrink.
- The award is one compare-and-set on `targetDay`, the shape the play streak uses, so a repeated or raced call pays out once.
- Which answers are "today" is decided on the child's device, because only it knows the offset - the server ships two days of answers and the client folds them, the same reason `currentStreak` is computed in the browser.
- The play screen's bar carries no numbers, for the same reason the header counts nothing, and a minutes bar creeps during a question capped at `MAX_TIME_MS` so what is shown can never run ahead of what is recorded.
- The play bar goes once the goal is met and the home screen's stays, because the play screen is one question at arm's length where a bar that no longer moves is only a distraction, while the home screen is where a child takes stock and the celebration itself lasts four seconds.
- The two celebrations queue - round first, day second - because one answer can finish both and one tap cannot dismiss two screens.
- The calendar judges past days against the *current* target, since past targets are not stored, and the note under it says so.

- [ ] **Step 2: Commit and push**

```bash
git add CLAUDE.md
git commit -m "Write down how the daily target works"
git push
```

---

## Self-Review

**Spec coverage.** Numbers and rationale → Task 1. Library → Task 1. Schema, the migration's recount-and-backfill, and the move to one incremented `User.stars` → Task 2 (columns, migration) and Task 3 (both guards). Awarding → Task 3. Play screen bar, including the minutes creep and the `MAX_TIME_MS` cap → Task 6. Celebration and queueing → Task 7. Home screen → Task 8. Parent's screens → Task 4. Practice calendar → Task 9. Testing → Task 1 and Task 9 Step 1. Documentation → Task 10.

**Known follow-on, deliberately not in scope:** `readObservations` stays subject-scoped, and only the calendar reads across subjects. That is the honest grain for topic analysis and the correct grain for a target, and the spec's "targets are not subject specific" is satisfied by the cross-subject read in Tasks 3 and 9.

**Type consistency.** `DailyTarget`, `TargetAnswer`, `DayTotal` and `TargetProgress` are defined once in Task 1 and imported everywhere after. `targetDone` is in the target's own unit throughout the play screen. `dailyTotals` and `calendarWeeks` key on the same `bucketStart` day, which is what lets Task 9's cells line up with its grid.
