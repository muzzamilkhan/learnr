# Parent Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/progress` screen where a parent picks one of their children from a dropdown and sees how that child is going — usage, per-topic performance, and where to help.

**Architecture:** All arithmetic goes into `src/lib/analytics/report.ts` as pure functions taking `now` from the caller, tested with vitest. `src/lib/records.ts` gains one new Prisma read and one contract change. The screen is a server component that guards, reads, and hands serialised data to presentation components; only the child dropdown and the Recharts bar chart are client islands.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Prisma 7, vitest, recharts 3.10.1 (new).

**Spec:** `docs/superpowers/specs/2026-08-17-parent-analytics-design.md`

## Global Constraints

- **All logic lives in `src/lib` as pure functions.** Nothing in `src/lib/analytics` may touch React, the network, the clock or the database. `now` and any offset are passed in.
- **Year levels are strings**, `'K'` then `'1'`–`'6'`. Never integers. Sort with `compareYearLevels`, display with `yearLabel`, parse at every boundary with `parseYearLevel`.
- **Colours are CSS variables** from `src/app/globals.css`, used in Tailwind as `text-(--color-ink)` and in SVG as `fill="var(--color-right)"`. Never hardcode a hex value. Available: `--color-ink`, `--color-ink-soft`, `--color-paper`, `--color-card`, `--color-brand`, `--color-brand-soft`, `--color-right`, `--color-right-soft`, `--color-wrong`, `--color-wrong-soft`, `--color-line`, `--color-star`, `--color-star-soft`, `--color-flame`, `--color-flame-soft`. There is no dark mode.
- **Tests are lib tests only.** Every test in this repo lives beside a `src/lib` or `src/content` module. Do not add component tests, a test renderer, or a browser harness.
- **Never name a prop `children`** for a list of child profiles — that name belongs to React. Use `profiles`.
- **This feature writes nothing.** No mutations, no server actions, no schema change, no migration.
- Run `npm test` and `npm run typecheck` before any commit that touches TypeScript.

## Timezone: whose days are these?

The spec says day bucketing takes a caller-supplied `offsetMinutes`. It does not say where the server gets one — and the server cannot know the parent's browser timezone.

**Resolution: use the offset the child last answered at.** Every `Attempt` already stores `offsetMinutes` (the UTC offset the answer was given at) and `readObservations` already selects it. The report is about the child's days, so the child's own offset is the right one — more correct than the parent's browser, since a parent travelling should not shift their child's practice calendar. Task 1 adds `latestOffsetMinutes` for this, defaulting to `0` when there is no history.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/analytics/report.ts` (modify) | + `latestOffsetMinutes`, `periods`, `headline`, `strengths`, `coverage` |
| `src/lib/analytics/report.test.ts` (modify) | Tests for all five |
| `src/lib/records.ts` (modify) | `readObservations` returns `| null`; new `readSittings` |
| `src/components/practice-calendar.tsx` (create) | Server-rendered SVG day grid |
| `src/components/topic-bars.tsx` (create) | Client island, Recharts stacked bars |
| `src/components/child-picker.tsx` (create) | Client island, dropdown pushing `?child=` |
| `src/components/progress-usage.tsx` (create) | Stat tiles + calendar + bars |
| `src/components/progress-topics.tsx` (create) | Needs a hand / doing well / review due / coverage / sittings |
| `src/components/progress-report.tsx` (create) | Header, subject tabs, empty & error states; composes the two halves |
| `src/app/progress/page.tsx` (create) | Guard, reads, wiring |
| `src/components/parent-dashboard.tsx` (modify) | Progress link on each child card |
| `src/components/profile-menu.tsx` (modify) | Stars/streak become optional |
| `src/app/page.tsx` (modify) | Skip stars/streak reads for a parent |
| `CLAUDE.md` (modify) | Document the screen |

---

### Task 1: Windows and headline figures

**Files:**
- Modify: `src/lib/analytics/report.ts`
- Test: `src/lib/analytics/report.test.ts`

**Interfaces:**
- Consumes: `Observation` from `./profile`, `summarise` and `localDay` (already in scope or importable).
- Produces:
  - `latestOffsetMinutes(observations: readonly Observation[]): number`
  - `periods(observations: readonly Observation[], options: PeriodOptions): Periods` where `Periods = { current: Observation[]; previous: Observation[] }` and `PeriodOptions = { now: number; days?: number; offsetMinutes?: number }`
  - `headline(observations: readonly Observation[], options: PeriodOptions): Headline` where `Headline = { minutes: number; questions: number; accuracy: number | null; minutesDelta: number; questionsDelta: number; accuracyDelta: number | null }`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/analytics/report.test.ts`. The file already defines `DAY`, `NOW`, `answers`, `rights` and `wrongs` at the top — reuse them, do not redefine them. Add `latestOffsetMinutes`, `periods` and `headline` to the existing `import { ... } from './report';` block at the top of the file.

```ts
describe('latestOffsetMinutes', () => {
  it('is zero when there is no history to read one from', () => {
    expect(latestOffsetMinutes([])).toBe(0);
  });

  it('takes the offset of the most recent answer, not the first', () => {
    const history = [
      { topic: 'addition', level: 'K' as YearLevel, correct: true, timeTakenMs: 5000, answeredAt: NOW - DAY, offsetMinutes: 60 },
      { topic: 'addition', level: 'K' as YearLevel, correct: true, timeTakenMs: 5000, answeredAt: NOW - 2 * DAY, offsetMinutes: 600 },
    ];

    expect(latestOffsetMinutes(history)).toBe(60);
  });

  it('reads a missing offset as UTC', () => {
    expect(latestOffsetMinutes(answers('addition', rights(2)))).toBe(0);
  });
});

describe('periods', () => {
  it('splits a history into this window and the one before it', () => {
    const history = [
      ...answers('addition', rights(3), { endedAt: NOW - DAY }),
      ...answers('addition', rights(2), { endedAt: NOW - 9 * DAY }),
      ...answers('addition', rights(4), { endedAt: NOW - 30 * DAY }),
    ];

    const { current, previous } = periods(history, { now: NOW, days: 7 });

    expect(current).toHaveLength(3);
    expect(previous).toHaveLength(2);
  });

  it('counts today and excludes the day the window opened on', () => {
    // days: 7 means today and the six before it — day -6 is in, day -7 is not.
    const history = [
      ...answers('addition', rights(1), { endedAt: NOW }),
      ...answers('addition', rights(1), { endedAt: NOW - 6 * DAY }),
      ...answers('addition', rights(1), { endedAt: NOW - 7 * DAY }),
    ];

    const { current, previous } = periods(history, { now: NOW, days: 7 });

    expect(current).toHaveLength(2);
    expect(previous).toHaveLength(1);
  });

  it('buckets against the offset it is given, not the server', () => {
    // 22:00 UTC is already the next day in Sydney (+600), so with that offset
    // this answer falls a day later than it does in UTC.
    const late = [
      {
        topic: 'addition',
        level: 'K' as YearLevel,
        correct: true,
        timeTakenMs: 5000,
        answeredAt: Date.UTC(2026, 7, 5, 22, 0),
      },
    ];

    expect(periods(late, { now: NOW, days: 7, offsetMinutes: 0 }).current).toHaveLength(0);
    expect(periods(late, { now: NOW, days: 7, offsetMinutes: 600 }).current).toHaveLength(1);
  });
});

describe('headline', () => {
  const history = [
    ...answers('addition', [...rights(6), ...wrongs(2)], { endedAt: NOW - DAY, timeTakenMs: 30_000 }),
    ...answers('addition', [...rights(2), ...wrongs(2)], { endedAt: NOW - 9 * DAY, timeTakenMs: 30_000 }),
  ];

  it('reports the window and how it compares with the one before', () => {
    expect(headline(history, { now: NOW, days: 7 })).toMatchObject({
      minutes: 4, // 8 answers x 30s
      questions: 8,
      accuracy: 0.75,
      minutesDelta: 2, // against 4 answers x 30s = 2 minutes
      questionsDelta: 4,
    });
  });

  it('measures the accuracy delta in points on the same scale', () => {
    const { accuracyDelta } = headline(history, { now: NOW, days: 7 });

    expect(accuracyDelta).toBeCloseTo(0.25); // 0.75 this window against 0.5 last
  });

  it('has no accuracy to report when nothing was answered this window', () => {
    const stale = answers('addition', rights(4), { endedAt: NOW - 30 * DAY });

    expect(headline(stale, { now: NOW, days: 7 })).toMatchObject({
      questions: 0,
      accuracy: null,
      accuracyDelta: null,
    });
  });

  it('will not compare against a window the child did not practise in', () => {
    const fresh = answers('addition', rights(4), { endedAt: NOW - DAY });

    expect(headline(fresh, { now: NOW, days: 7 })).toMatchObject({
      questions: 4,
      accuracy: 1,
      questionsDelta: 4,
      accuracyDelta: null,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/analytics/report.test.ts`
Expected: FAIL — `latestOffsetMinutes is not a function` (and the same for `periods`, `headline`).

- [ ] **Step 3: Implement**

Add to `src/lib/analytics/report.ts`. Add `localDay` to the existing import from `./profile` (it is re-exported there for exactly this reason). Place these after `summarise`.

```ts
/**
 * The offset the child last answered at. Their days are what this report is
 * about, and the server has no timezone of its own — nor does it know the
 * parent's, who may well be reading this from another one. Every attempt
 * already carries the offset it was given at, so the most recent one is the
 * best answer available and needs no extra read.
 */
export function latestOffsetMinutes(observations: readonly Observation[]): number {
  let at = -Infinity;
  let offset = 0;

  for (const observation of observations) {
    if (observation.answeredAt >= at) {
      at = observation.answeredAt;
      offset = observation.offsetMinutes ?? 0;
    }
  }

  return offset;
}

export interface PeriodOptions {
  now: number;
  /** Local days per window, counting the one `now` falls in. */
  days?: number;
  /** Minutes east of UTC, e.g. 600 for Sydney in winter. */
  offsetMinutes?: number;
}

export interface Periods {
  current: Observation[];
  previous: Observation[];
}

/**
 * The last `days` days, and the `days` before those, so a figure can be shown
 * against the one it is meant to be read against. A bare "142 questions" says
 * nothing; "up from 98" is the whole point.
 *
 * Rolling rather than calendar-aligned on purpose: a Monday-aligned week reads
 * "0 questions this week" every Monday morning, which is exactly when a parent
 * is most likely to look.
 */
export function periods(
  observations: readonly Observation[],
  { now, days = 7, offsetMinutes = 0 }: PeriodOptions,
): Periods {
  const today = localDay(now, offsetMinutes);
  const opened = today - days + 1;
  const previouslyOpened = opened - days;

  const current: Observation[] = [];
  const previous: Observation[] = [];

  for (const observation of observations) {
    const day = localDay(observation.answeredAt, offsetMinutes);
    if (day >= opened && day <= today) current.push(observation);
    else if (day >= previouslyOpened && day < opened) previous.push(observation);
  }

  return { current, previous };
}

export interface Headline {
  /** Time on questions, rounded. Capped per answer by the session engine before it was stored. */
  minutes: number;
  questions: number;
  /** 0..1, or null when nothing was answered in the window. */
  accuracy: number | null;
  minutesDelta: number;
  questionsDelta: number;
  /** Points on the same 0..1 scale, or null when there is nothing to compare against. */
  accuracyDelta: number | null;
}

/**
 * The three figures at the top of the parents' screen. Arithmetic, so it lives
 * here and is tested, rather than being worked out inside a component where
 * nothing would ever check it.
 */
export function headline(observations: readonly Observation[], options: PeriodOptions): Headline {
  const { now, offsetMinutes = 0 } = options;
  const { current, previous } = periods(observations, options);

  const thisWindow = summarise(current, { now, offsetMinutes });
  const lastWindow = summarise(previous, { now, offsetMinutes });

  const minutes = Math.round(thisWindow.totalTimeMs / 60_000);

  return {
    minutes,
    questions: thisWindow.attempts,
    accuracy: thisWindow.attempts === 0 ? null : thisWindow.accuracy,
    minutesDelta: minutes - Math.round(lastWindow.totalTimeMs / 60_000),
    questionsDelta: thisWindow.attempts - lastWindow.attempts,
    // "Down 76 points" against a week the child did not practise is not a fact.
    accuracyDelta:
      thisWindow.attempts === 0 || lastWindow.attempts === 0
        ? null
        : thisWindow.accuracy - lastWindow.accuracy,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/analytics/report.test.ts && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/report.ts src/lib/analytics/report.test.ts
git commit -m "Add practice windows and the parents' headline figures"
```

---

### Task 2: Strengths and year coverage

**Files:**
- Modify: `src/lib/analytics/report.ts`
- Test: `src/lib/analytics/report.test.ts`

**Interfaces:**
- Consumes: `TopicReport` and `topicReports` from Task 1's file; `YearLevel` and `compareYearLevels` from `../curriculum` (`compareYearLevels` is already imported there).
- Produces:
  - `strengths(reports: readonly TopicReport[], limit?: number): TopicReport[]`
  - `coverage(reports: readonly TopicReport[], offered: readonly string[], level: YearLevel): Coverage` where `Coverage = { offered: number; practised: number; untouched: string[] }`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/analytics/report.test.ts`, adding `strengths` and `coverage` to the existing import block. Reuse the file's existing `answers`, `rights`, `wrongs` and `known` helpers — `known(topic, days)` produces four right answers on each of `days` separate days, which is what makes a topic `secure`.

```ts
describe('strengths', () => {
  it('lists what the child has, best evidence first', () => {
    const history = [...known('addition', 4), ...known('shapes', 2), ...answers('counting', wrongs(6))];
    const reports = topicReports(history, NOW);

    expect(strengths(reports).map((report) => report.topic)).toEqual(['addition', 'shapes']);
  });

  it('leaves a topic that is due for review to dueForReview', () => {
    // Known, then left alone long enough that it is worth confirming again.
    const stale = topicReports(known('addition', 2).map((o) => ({ ...o, answeredAt: o.answeredAt - 20 * DAY })), NOW);

    expect(stale[0].status).toBe('review-due');
    expect(strengths(stale)).toEqual([]);
    expect(dueForReview(stale)).toHaveLength(1);
  });

  it('says nothing when nothing is proven yet', () => {
    expect(strengths(topicReports(answers('counting', rights(2)), NOW))).toEqual([]);
  });
});

describe('coverage', () => {
  const offered = ['addition', 'counting', 'shapes', 'subtraction'];

  it('counts what has been tried against what the year offers', () => {
    const reports = topicReports(
      [...answers('addition', rights(3), { level: '1' }), ...answers('shapes', wrongs(1), { level: '1' })],
      NOW,
    );

    expect(coverage(reports, offered, '1')).toEqual({
      offered: 4,
      practised: 2,
      untouched: ['counting', 'subtraction'],
    });
  });

  it('counts a single attempt as tried — this is not a question about mastery', () => {
    const reports = topicReports(answers('counting', wrongs(1), { level: '1' }), NOW);

    expect(coverage(reports, offered, '1').practised).toBe(1);
  });

  it('ignores practice at another year level', () => {
    const reports = topicReports(answers('addition', rights(3), { level: 'K' }), NOW);

    expect(coverage(reports, offered, '1')).toMatchObject({ practised: 0, offered: 4 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/analytics/report.test.ts`
Expected: FAIL — `strengths is not a function`.

- [ ] **Step 3: Implement**

Add to `src/lib/analytics/report.ts`, directly after `dueForReview`.

```ts
/**
 * The mirror of `problemTopics`: what to say well done about. Ordered by
 * `correctDays`, because that is the evidence that means something — four right
 * in a row is one memory answering four times, the same topic known again a week
 * later is not.
 *
 * `review-due` is left out even though those topics are mastered too.
 * `dueForReview` already lists them, and a topic appearing in two sections of
 * the same screen reads as a bug.
 */
export function strengths(reports: readonly TopicReport[], limit = 3): TopicReport[] {
  return reports
    .filter((report) => report.status === 'secure')
    .sort(
      (a, b) =>
        b.correctDays - a.correctDays ||
        b.strength - a.strength ||
        b.attempts - a.attempts ||
        compareYearLevels(a.level, b.level) ||
        a.topic.localeCompare(b.topic),
    )
    .slice(0, limit);
}

export interface Coverage {
  offered: number;
  practised: number;
  untouched: string[];
}

/**
 * How much of the year has been touched at all. A different question from the
 * status sections: this one is about breadth, and a child circling the same
 * three topics is worth knowing about even when they are doing well at them.
 *
 * Takes the level rather than trusting the caller to filter, because `reports`
 * spans every year the child has practised and `offered` covers exactly one.
 */
export function coverage(
  reports: readonly TopicReport[],
  offered: readonly string[],
  level: YearLevel,
): Coverage {
  const tried = new Set(
    reports.filter((report) => report.level === level && report.attempts > 0).map((report) => report.topic),
  );

  return {
    offered: offered.length,
    // Counted over `offered` rather than over `tried`, so a topic the child has
    // practised that this year no longer offers cannot push the figure past the total.
    practised: offered.filter((topic) => tried.has(topic)).length,
    untouched: offered.filter((topic) => !tried.has(topic)),
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/report.ts src/lib/analytics/report.test.ts
git commit -m "Report a child's strengths and how much of the year they have tried"
```

---

### Task 3: The reads

**Files:**
- Modify: `src/lib/records.ts` (`readObservations` at ~line 376; add `readSittings` after it)

**Interfaces:**
- Consumes: `prisma` from `./db`, `parseYearLevel`/`YearLevel` from `./curriculum`, `Observation` from `./analytics/profile` — all already imported in the file.
- Produces:
  - `readObservations(userId: string, subject: string, limit?: number): Promise<Observation[] | null>` (**changed** return type)
  - `readSittings(userId: string, subject: string, limit?: number): Promise<Sitting[] | null>` where `Sitting = { id: string; startedAt: number; level: YearLevel; attempts: number; correct: number; timeMs: number }`

There are no unit tests in this task. Everything in `records.ts` touches Prisma and none of it is unit tested — that is the established convention in this repo, and `npm run typecheck` is the gate. Do not add a Prisma mock.

- [ ] **Step 1: Change the `readObservations` contract**

In `src/lib/records.ts`, change the signature and the catch. `readObservations` has no callers today, so nothing else needs updating.

Replace the doc comment and signature:

```ts
/**
 * The attempts behind the parents' report, oldest first. Read as raw history
 * rather than as skill rows because the report has to show change over time,
 * which a folded-up profile has already thrown away.
 *
 * Unlike the rest of this file it is **not** best-effort. Everything else here
 * serves a child mid-question, where a swallowed failure costs a little history
 * and the child plays on. Here an empty array renders as "your child has never
 * practised", which is a lie when the database merely hiccuped and is exactly
 * the failure `accounts.ts` refuses to make. So `null` means *could not read*
 * and `[]` means *nothing recorded*, and the screen says something different
 * for each.
 */
export async function readObservations(
  userId: string,
  subject: string,
  limit = HISTORY_LIMIT,
): Promise<Observation[] | null> {
```

Leave `if (!prisma) return [];` as it is — no database configured is not a failure, it is genuinely nothing recorded.

Change only the catch at the end of the function:

```ts
  } catch (error) {
    console.error('Failed to read practice history', error);
    return null;
  }
```

- [ ] **Step 2: Add `readSittings`**

Insert immediately after `readObservations`, before `recordSessionEnd`.

```ts
/** How many sittings the report lists. Enough to show a pattern, few enough to read. */
const SITTING_LIMIT = 8;

/** One sitting as the parents' report lists it. */
export interface Sitting {
  id: string;
  startedAt: number;
  level: YearLevel;
  attempts: number;
  correct: number;
  /** Summed time on this sitting's questions, each already capped when it was recorded. */
  timeMs: number;
}

/**
 * The child's last few sittings. A weekly total cannot tell five real sessions
 * apart from five ninety-second visits, and that difference is most of what a
 * parent is looking for.
 *
 * `null` on failure, for the same reason `readObservations` does it.
 */
export async function readSittings(
  userId: string,
  subject: string,
  limit = SITTING_LIMIT,
): Promise<Sitting[] | null> {
  if (!prisma) return [];
  try {
    const rows = await prisma.learningSession.findMany({
      where: { userId, subject },
      orderBy: { startedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        startedAt: true,
        level: true,
        attempts: { select: { correct: true, timeTakenMs: true } },
      },
    });

    return rows
      .map((row) => {
        const level = parseYearLevel(row.level);
        // A sitting nobody answered a question in is not a sitting, and listing
        // it would make a child look busier than they were. Dropped after the
        // take rather than before, so this can return fewer than `limit`.
        if (!level || row.attempts.length === 0) return undefined;

        return {
          id: row.id,
          startedAt: row.startedAt.getTime(),
          level,
          attempts: row.attempts.length,
          correct: row.attempts.filter((attempt) => attempt.correct).length,
          timeMs: row.attempts.reduce((total, attempt) => total + attempt.timeTakenMs, 0),
        };
      })
      .filter((sitting) => sitting !== undefined);
  } catch (error) {
    console.error('Failed to read sittings', error);
    return null;
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test`
Expected: no type errors, all existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/lib/records.ts
git commit -m "Read a child's history and sittings for the parents' report"
```

---

### Task 4: Practice calendar

**Files:**
- Create: `src/components/practice-calendar.tsx`

**Interfaces:**
- Consumes: `ProgressBucket` from `@/lib/analytics/report` — `{ start: number; unit: 'day' | 'week'; attempts: number; correct: number; accuracy: number | null }`.
- Produces: `PracticeCalendar({ buckets, offsetMinutes }: { buckets: ProgressBucket[]; offsetMinutes: number })`, and `practisedDays(buckets: readonly ProgressBucket[]): number`.

This is a **server component** — no `'use client'`. It renders plain SVG, so it costs nothing in the client bundle.

- [ ] **Step 1: Write the component**

```tsx
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
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/practice-calendar.tsx
git commit -m "Draw eight weeks of practice as a grid of days"
```

---

### Task 5: Topic bars

**Files:**
- Modify: `package.json` (add `recharts`)
- Create: `src/components/topic-bars.tsx`

**Interfaces:**
- Produces: `TopicBars({ data }: { data: TopicBar[] })` and `export interface TopicBar { label: string; correct: number; wrong: number }`. Labels arrive already distinct — Task 7 appends the year when a topic recurs across levels — so there is no separate key field.

- [ ] **Step 1: Install Recharts**

```bash
npm install recharts@3.10.1
```

Expected: installs clean. React 19 is inside its peer range (`^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0`), so no `--legacy-peer-deps` is needed. If it is required, stop and report rather than forcing it.

- [ ] **Step 2: Write the component**

```tsx
'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * How much of each topic has been answered, and how much of that was right.
 * Height is questions and the filled part is correct answers.
 *
 * The unfilled part is line grey rather than `--color-wrong` on purpose: it is
 * "the rest of the questions", not a column of failures. A parent's screen full
 * of red bars is a different message from the one this app is trying to send,
 * and the topics actually worth worrying about are named underneath.
 */

export interface TopicBar {
  /**
   * The topic, with its year appended when the child has practised that topic at
   * more than one — the same topic recurs across years, so it is the caller's job
   * to hand these over already distinct.
   */
  label: string;
  correct: number;
  wrong: number;
}

/**
 * Declared rather than left to the container: ResponsiveContainer renders
 * nothing until it mounts, and without a height the whole page jumps when it does.
 */
const HEIGHT = 260;

/** Two lines at most, broken on a word. Longer than this and iPad labels collide. */
function wrap(text: string, max = 12): string[] {
  const words = text.split(' ');
  const lines: string[] = [''];

  for (const word of words) {
    const line = lines.length - 1;
    if (lines[line] === '') lines[line] = word;
    else if (lines[line].length + word.length + 1 <= max) lines[line] += ` ${word}`;
    else if (lines.length < 2) lines.push(word);
    else lines[line] += ` ${word}`;
  }

  return lines;
}

function TopicTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  return (
    <g transform={`translate(${x},${y + 12})`}>
      {wrap(String(payload?.value ?? '')).map((line, index) => (
        <text
          key={line + index}
          textAnchor="middle"
          fill="var(--color-ink-soft)"
          fontSize={12}
          y={index * 14}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

interface TooltipDatum {
  dataKey?: string | number;
  value?: number;
}

function BarTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipDatum[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const correct = payload.find((item) => item.dataKey === 'correct')?.value ?? 0;
  const wrong = payload.find((item) => item.dataKey === 'wrong')?.value ?? 0;
  const total = correct + wrong;

  return (
    <div className="rounded-xl border-2 border-(--color-line) bg-(--color-card) px-4 py-3 shadow-lg">
      <p className="text-lg font-semibold">{label}</p>
      <p className="text-base text-(--color-ink-soft)">
        {correct} of {total} right
        {total > 0 ? ` · ${Math.round((correct / total) * 100)}%` : ''}
      </p>
    </div>
  );
}

export function TopicBars({ data }: { data: TopicBar[] }) {
  return (
    <div style={{ height: HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-line)" />
          <XAxis
            dataKey="label"
            interval={0}
            height={44}
            tickLine={false}
            axisLine={{ stroke: 'var(--color-line)' }}
            tick={<TopicTick />}
          />
          <YAxis
            allowDecimals={false}
            width={36}
            tickLine={false}
            axisLine={false}
            tick={{ fill: 'var(--color-ink-soft)', fontSize: 12 }}
          />
          <Tooltip content={<BarTooltip />} cursor={{ fill: 'var(--color-brand-soft)', opacity: 0.5 }} />
          <Bar dataKey="correct" stackId="questions" fill="var(--color-right)" />
          <Bar dataKey="wrong" stackId="questions" fill="var(--color-line)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Verify it compiles and builds**

Run: `npm run typecheck && npm run build`
Expected: no type errors; the build succeeds. If the build fails with an ESM/`require` error from inside `recharts`, add `transpilePackages: ['recharts']` to `nextConfig` in `next.config.ts` and rebuild. Do not change anything else in that file.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/topic-bars.tsx next.config.ts
git commit -m "Chart questions per topic, filled by how many were right"
```

---

### Task 6: Child picker

**Files:**
- Create: `src/components/child-picker.tsx`

**Interfaces:**
- Produces: `ChildPicker({ profiles, selected, subject }: { profiles: { id: string; name: string }[]; selected: string; subject: string })`.

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useRouter } from 'next/navigation';

/**
 * Which child this screen is about. The choice goes in the URL rather than in
 * component state so a refresh keeps it — a parent who reloads should still be
 * looking at the same child.
 *
 * Not named `children`: that belongs to React, and a list of child profiles
 * under it reads as nested JSX to everything that looks at the file.
 */
export function ChildPicker({
  profiles,
  selected,
  subject,
}: {
  profiles: { id: string; name: string }[];
  selected: string;
  subject: string;
}) {
  const router = useRouter();

  if (profiles.length < 2) return null;

  return (
    <label className="flex items-center gap-3">
      <span className="sr-only">Child</span>
      <select
        value={selected}
        onChange={(event) =>
          router.replace(`/progress?child=${event.target.value}&subject=${subject}`)
        }
        className="no-select rounded-2xl border-2 border-(--color-line) bg-(--color-card) px-5 py-3 text-xl font-medium"
      >
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/child-picker.tsx
git commit -m "Switch the progress screen between children"
```

---

### Task 7: Usage half of the report

**Files:**
- Create: `src/components/progress-usage.tsx`

**Interfaces:**
- Consumes: `headline`, `progressOverTime`, `topicReports` from `@/lib/analytics/report`; `Observation` from `@/lib/analytics/profile`; `PracticeCalendar` and `practisedDays` from `./practice-calendar`; `TopicBars` and `TopicBar` from `./topic-bars`; `yearLabel` from `@/lib/curriculum`.
- Produces: `ProgressUsage({ observations, now, offsetMinutes }: { observations: Observation[]; now: number; offsetMinutes: number })`.

- [ ] **Step 1: Write the component**

Server component — no `'use client'`. It renders `<TopicBars>`, which is the client island.

```tsx
import { headline, progressOverTime, topicReports } from '@/lib/analytics/report';
import type { Observation } from '@/lib/analytics/profile';
import { yearLabel } from '@/lib/curriculum';
import { PracticeCalendar, practisedDays } from './practice-calendar';
import { TopicBars, type TopicBar } from './topic-bars';

/** Eight weeks. Long enough for a habit to show, short enough for the squares to stay big. */
const CALENDAR_DAYS = 56;

/** Beyond this the labels stop being readable on an iPad; the coverage line covers the tail. */
const MAX_BARS = 8;

/**
 * The "are they using it?" half of the parents' screen: three figures against
 * last week, eight weeks of days, and how much of each topic has been answered.
 */
export function ProgressUsage({
  observations,
  now,
  offsetMinutes,
}: {
  observations: Observation[];
  now: number;
  offsetMinutes: number;
}) {
  const figures = headline(observations, { now, offsetMinutes });
  const buckets = progressOverTime(observations, {
    now,
    unit: 'day',
    count: CALENDAR_DAYS,
    offsetMinutes,
  });

  const reports = topicReports(observations, now);
  // The same topic can appear at two years once a child moves up, so the year is
  // shown only when it is actually needed to tell two bars apart.
  const repeated = new Set(
    reports
      .map((report) => report.topic)
      .filter((topic, index, all) => all.indexOf(topic) !== index),
  );

  const bars: TopicBar[] = [...reports]
    .sort((a, b) => b.attempts - a.attempts || a.topic.localeCompare(b.topic))
    .slice(0, MAX_BARS)
    .map((report) => ({
      label: repeated.has(report.topic)
        ? `${report.topic} (${yearLabel(report.level)})`
        : report.topic,
      correct: report.correct,
      wrong: report.attempts - report.correct,
    }));

  return (
    <section className="space-y-10">
      <div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Tile
            label="Time on questions"
            value={`${figures.minutes} min`}
            delta={figures.minutesDelta}
            unit="min"
          />
          <Tile label="Questions" value={String(figures.questions)} delta={figures.questionsDelta} />
          <Tile
            label="Correct"
            value={figures.accuracy === null ? '—' : `${Math.round(figures.accuracy * 100)}%`}
            delta={figures.accuracyDelta === null ? null : Math.round(figures.accuracyDelta * 100)}
            unit="pts"
          />
        </div>
        {/* Without this a parent reads 76% as a C. The selector mixes hard topics
            in deliberately, so a healthy child sits in the seventies. */}
        <p className="mt-3 text-base text-(--color-ink-soft)">
          Over the last 7 days, against the 7 before. Questions are picked to stretch — around
          three in four right means it&rsquo;s working.
        </p>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between gap-4">
          <h2 className="text-2xl font-semibold">Practice</h2>
          <p className="text-lg text-(--color-ink-soft)">
            {practisedDays(buckets)} of the last {CALENDAR_DAYS} days
          </p>
        </div>
        <PracticeCalendar buckets={buckets} offsetMinutes={offsetMinutes} />
      </div>

      {bars.length > 0 ? (
        <div>
          <h2 className="mb-1 text-2xl font-semibold">Topics</h2>
          <p className="mb-3 text-base text-(--color-ink-soft)">
            How many questions each topic has had, and how many were right.
          </p>
          <TopicBars data={bars} />
        </div>
      ) : null}
    </section>
  );
}

function Tile({
  label,
  value,
  delta,
  unit,
}: {
  label: string;
  value: string;
  delta: number | null;
  unit?: string;
}) {
  return (
    <div className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-6">
      <p className="text-lg text-(--color-ink-soft)">{label}</p>
      <p className="mt-1 text-4xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-base text-(--color-ink-soft)">
        {delta === null || delta === 0 ? (
          delta === 0 ? 'Same as last week' : 'No comparison yet'
        ) : (
          <>
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}
            {unit ? ` ${unit}` : ''} on last week
          </>
        )}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/progress-usage.tsx
git commit -m "Show a child's practice figures, days and topic totals"
```

---

### Task 8: Topics half of the report

**Files:**
- Create: `src/components/progress-topics.tsx`

**Interfaces:**
- Consumes: `topicReports`, `problemTopics`, `dueForReview`, `strengths`, `coverage`, `TopicReport` from `@/lib/analytics/report`; `Observation` from `@/lib/analytics/profile`; `Sitting` from `@/lib/records`; `topicsForLevel`, `templatesFor` from `@/content/catalog`; `generateQuestion` from `@/lib/templates/generate`; `createRng` from `@/lib/rng`; `yearLabel`, `YearLevel` from `@/lib/curriculum`; `MIN_OBSERVATIONS` from `@/lib/analytics/profile`.
- Produces: `ProgressTopics({ observations, sittings, subject, level, now }: { observations: Observation[]; sittings: Sitting[]; subject: string; level: YearLevel | null; now: number })`.

- [ ] **Step 1: Write the component**

Server component — no `'use client'`.

```tsx
import { templatesFor, topicsForLevel } from '@/content/catalog';
import { MIN_OBSERVATIONS, type Observation } from '@/lib/analytics/profile';
import {
  coverage,
  dueForReview,
  problemTopics,
  strengths,
  topicReports,
  type TopicReport,
} from '@/lib/analytics/report';
import { yearLabel, type YearLevel } from '@/lib/curriculum';
import type { Sitting } from '@/lib/records';
import { createRng } from '@/lib/rng';
import { generateQuestion } from '@/lib/templates/generate';

/**
 * The "where do they need help?" half. Every list here refuses to guess: under
 * `MIN_OBSERVATIONS` answers a topic is `new`, never a weakness, so a child who
 * has just started gets an honest "not enough answers yet" rather than a
 * diagnosis built from two data points.
 */

const DATE = new Intl.DateTimeFormat('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * One real question from this topic, so "fractions are hard" becomes something a
 * parent can sit down and do. Seeded from the template id, so it is the same
 * question on every refresh rather than a new one each time the page loads.
 *
 * A report page must not fall over for a nicety, so a template that cannot
 * generate simply contributes no example.
 */
function exampleQuestion(subject: string, topic: string, level: YearLevel): string | null {
  const template = templatesFor(subject, level).find((candidate) => candidate.topic === topic);
  if (!template) return null;

  try {
    return generateQuestion(template, createRng(template.id)).prompt;
  } catch {
    return null;
  }
}

export function ProgressTopics({
  observations,
  sittings,
  subject,
  level,
  now,
}: {
  observations: Observation[];
  sittings: Sitting[];
  subject: string;
  level: YearLevel | null;
  now: number;
}) {
  const reports = topicReports(observations, now);
  const problems = problemTopics(reports);
  const doingWell = strengths(reports);
  const due = dueForReview(reports);
  const judged = reports.some((report) => report.attempts >= MIN_OBSERVATIONS);
  const breadth = level ? coverage(reports, topicsForLevel(subject, level), level) : null;

  return (
    <section className="space-y-10">
      <div>
        <h2 className="mb-3 text-2xl font-semibold">Needs a hand</h2>
        {!judged ? (
          <Unproven />
        ) : problems.length === 0 ? (
          <p className="text-lg text-(--color-ink-soft)">
            Nothing is going badly at the moment.
          </p>
        ) : (
          <ul className="space-y-3">
            {problems.map((report) => (
              <li
                key={`${report.level}|${report.topic}`}
                className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-5"
              >
                <TopicLine report={report} now={now} />
                {(() => {
                  const example = exampleQuestion(subject, report.topic, report.level);
                  return example ? (
                    <p className="mt-3 rounded-2xl bg-(--color-brand-soft) px-4 py-3 text-lg">
                      Try together: {example}
                    </p>
                  ) : null;
                })()}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-2xl font-semibold">Doing well</h2>
        {!judged ? (
          <Unproven />
        ) : doingWell.length === 0 ? (
          <p className="text-lg text-(--color-ink-soft)">
            Nothing has been known on enough separate days to call it learned yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {doingWell.map((report) => (
              <li key={`${report.level}|${report.topic}`} className="text-lg">
                <span className="font-semibold capitalize">{report.topic}</span>
                <span className="text-(--color-ink-soft)">
                  {' '}
                  · {yearLabel(report.level)} · known on {report.correctDays} separate day
                  {report.correctDays === 1 ? '' : 's'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {due.length > 0 ? (
        <div>
          <h2 className="mb-1 text-2xl font-semibold">Coming up for review</h2>
          <p className="mb-3 text-base text-(--color-ink-soft)">
            Known, and left alone long enough to be worth confirming. LearnR will bring these
            back on its own.
          </p>
          <ul className="space-y-2">
            {due.map((report) => (
              <li key={`${report.level}|${report.topic}`} className="text-lg">
                <span className="font-semibold capitalize">{report.topic}</span>
                <span className="text-(--color-ink-soft)"> · {yearLabel(report.level)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {breadth && level && breadth.offered > 0 ? (
        <div>
          <h2 className="mb-1 text-2xl font-semibold">
            {yearLabel(level)} · {breadth.practised} of {breadth.offered} topics practised
          </h2>
          {breadth.untouched.length > 0 ? (
            <p className="text-lg text-(--color-ink-soft)">
              Not yet tried: {breadth.untouched.join(', ')}.
            </p>
          ) : (
            <p className="text-lg text-(--color-ink-soft)">Every topic this year offers.</p>
          )}
        </div>
      ) : null}

      {sittings.length > 0 ? (
        <div>
          <h2 className="mb-3 text-2xl font-semibold">Recent sittings</h2>
          <ul className="space-y-2">
            {sittings.map((sitting) => (
              <li key={sitting.id} className="text-lg tabular-nums">
                <span className="font-medium">{DATE.format(new Date(sitting.startedAt))}</span>
                <span className="text-(--color-ink-soft)">
                  {' '}
                  · {yearLabel(sitting.level)} · {sitting.attempts} question
                  {sitting.attempts === 1 ? '' : 's'} ·{' '}
                  {Math.round((sitting.correct / sitting.attempts) * 100)}% ·{' '}
                  {Math.max(1, Math.round(sitting.timeMs / 60_000))} min
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

/** Said in words rather than drawn as an empty list. Not knowing is a real answer. */
function Unproven() {
  return (
    <p className="text-lg text-(--color-ink-soft)">
      Not enough answers yet to say. LearnR waits for {MIN_OBSERVATIONS} answers on a topic
      before it calls anything easy or hard.
    </p>
  );
}

function TopicLine({ report, now }: { report: TopicReport; now: number }) {
  const days = Math.round((now - report.lastAnsweredAt) / 86_400_000);

  return (
    <p className="text-lg">
      <span className="text-xl font-semibold capitalize">{report.topic}</span>
      <span className="text-(--color-ink-soft)">
        {' '}
        · {yearLabel(report.level)} · {Math.round(report.accuracy * 100)}% of {report.attempts}
        {report.trend === 'improving' ? ' · improving' : null}
        {report.trend === 'slipping' ? ' · slipping' : null}
        {' · last practised '}
        {days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}
      </span>
    </p>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run typecheck`
Expected: no errors. If `generateQuestion`'s return type does not expose `.prompt`, read `src/lib/templates/generate.ts` and use the correct property — do not cast to `any`.

- [ ] **Step 3: Commit**

```bash
git add src/components/progress-topics.tsx
git commit -m "List where a child needs help, what they know, and what they have tried"
```

---

### Task 9: The report shell and the route

**Files:**
- Create: `src/components/progress-report.tsx`
- Create: `src/app/progress/page.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–8, plus `auth`/`isAuthConfigured` from `@/auth`, `listChildren`/`readAccount` from `@/lib/accounts`, `readObservations`/`readSittings` from `@/lib/records`, `listSubjects` from `@/content/catalog`, `parseYearLevel` from `@/lib/curriculum`, `latestOffsetMinutes` from `@/lib/analytics/report`.
- Produces: the `/progress` route.

- [ ] **Step 1: Write the report shell**

`src/components/progress-report.tsx` — a server component.

```tsx
import Link from 'next/link';
import type { Observation } from '@/lib/analytics/profile';
import { latestOffsetMinutes } from '@/lib/analytics/report';
import { parseYearLevel } from '@/lib/curriculum';
import type { Sitting } from '@/lib/records';
import { AvatarIcon } from './avatar-icon';
import { ChildPicker } from './child-picker';
import { ProgressTopics } from './progress-topics';
import { ProgressUsage } from './progress-usage';
import type { Avatar } from '@/lib/avatars';

export interface ProgressChild {
  id: string;
  name: string;
  avatar: Avatar;
  level: string | null;
}

/**
 * The frame around both halves of the report, and the place that decides there
 * is nothing to report. A failed read and a child who has never played are
 * different things and must not look the same — one is our problem, the other
 * is just true.
 */
export function ProgressReport({
  child,
  profiles,
  subjects,
  subject,
  observations,
  sittings,
  now,
}: {
  child: ProgressChild;
  profiles: { id: string; name: string }[];
  subjects: string[];
  subject: string;
  observations: Observation[] | null;
  sittings: Sitting[] | null;
  now: number;
}) {
  const offsetMinutes = latestOffsetMinutes(observations ?? []);
  const level = parseYearLevel(child.level);

  return (
    <>
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-(--color-brand-soft) text-(--color-brand)">
            <AvatarIcon avatar={child.avatar} className="h-10 w-10" />
          </span>
          <h1 className="text-4xl font-bold tracking-tight">{child.name}&rsquo;s progress</h1>
        </div>
        <div className="flex items-center gap-4">
          <ChildPicker profiles={profiles} selected={child.id} subject={subject} />
          <Link href="/" className="text-lg text-(--color-brand) underline">
            Dashboard
          </Link>
        </div>
      </header>

      {/* One subject reads as a heading; a second one turns the row into tabs. */}
      {subjects.length > 1 ? (
        <nav className="mb-8 flex gap-2">
          {subjects.map((option) => (
            <Link
              key={option}
              href={`/progress?child=${child.id}&subject=${option}`}
              className={`no-select rounded-2xl px-5 py-3 text-xl font-semibold capitalize transition ${
                option === subject
                  ? 'bg-(--color-brand) text-white'
                  : 'border-2 border-(--color-line) hover:border-(--color-brand)'
              }`}
            >
              {option}
            </Link>
          ))}
        </nav>
      ) : (
        <p className="mb-8 text-2xl font-semibold capitalize text-(--color-ink-soft)">{subject}</p>
      )}

      {observations === null || sittings === null ? (
        <p className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-6 text-xl text-(--color-ink-soft)">
          Couldn&rsquo;t load progress just now. Try again in a moment.
        </p>
      ) : observations.length === 0 ? (
        <p className="rounded-3xl border-2 border-(--color-line) bg-(--color-card) p-6 text-xl text-(--color-ink-soft)">
          {child.name} hasn&rsquo;t answered any {subject} questions yet. Once they have, this is
          where you&rsquo;ll see how it&rsquo;s going.
        </p>
      ) : (
        <div className="space-y-12">
          <ProgressUsage observations={observations} now={now} offsetMinutes={offsetMinutes} />
          <ProgressTopics
            observations={observations}
            sittings={sittings}
            subject={subject}
            level={level}
            now={now}
          />
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Write the route**

`src/app/progress/page.tsx`.

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth, isAuthConfigured } from '@/auth';
import { listSubjects } from '@/content/catalog';
import { ProgressReport } from '@/components/progress-report';
import { listChildren, readAccount } from '@/lib/accounts';
import { readObservations, readSittings } from '@/lib/records';

// Per-parent and per-child, so it must never be prerendered and shared.
export const dynamic = 'force-dynamic';

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string; subject?: string }>;
}) {
  const { child: childParam, subject: subjectParam } = await searchParams;

  const session = isAuthConfigured ? await auth() : null;
  const userId = session?.user?.id;
  if (!userId) redirect('/');

  // A child must not reach this screen, and neither must an account that has
  // not said what kind it is yet.
  const account = await readAccount(userId);
  if (account?.role !== 'parent') redirect('/');

  const profiles = await listChildren(userId);
  if (profiles.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl px-8 py-12">
        <h1 className="text-4xl font-bold tracking-tight">No children yet</h1>
        <p className="mt-3 text-xl text-(--color-ink-soft)">
          Add a profile on the dashboard, and their progress will show up here once they start
          practising.
        </p>
        <Link href="/" className="mt-6 inline-block text-lg text-(--color-brand) underline">
          Back to the dashboard
        </Link>
      </main>
    );
  }

  // The child id arrives from the browser, so it is resolved against a list
  // already scoped by parentId rather than checked separately and then trusted.
  // There is no second place for the two to drift apart.
  const child = profiles.find((candidate) => candidate.id === childParam) ?? profiles[0];

  const subjects = listSubjects().map((summary) => summary.subject);
  const subject = subjects.find((option) => option === subjectParam) ?? subjects[0] ?? 'maths';

  const [observations, sittings] = await Promise.all([
    readObservations(child.id, subject),
    readSittings(child.id, subject),
  ]);

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-8 py-12">
      <ProgressReport
        child={{ id: child.id, name: child.name, avatar: child.avatar, level: child.level }}
        profiles={profiles.map(({ id, name }) => ({ id, name }))}
        subjects={subjects}
        subject={subject}
        observations={observations}
        sittings={sittings}
        now={Date.now()}
      />
    </main>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run typecheck && npm test && npm run build`
Expected: no type errors, all tests pass, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/progress-report.tsx src/app/progress/page.tsx
git commit -m "Add the parent progress screen"
```

---

### Task 10: What the parent sees elsewhere

**Files:**
- Modify: `src/components/parent-dashboard.tsx` (the button row in `ChildCard`, ~line 128)
- Modify: `src/components/profile-menu.tsx` (`Props`, ~line 25)
- Modify: `src/app/page.tsx` (the `Promise.all` read block, ~line 62)

Two changes, both about a parent seeing only what means something to them: a way into the new screen, and no stars or streak in their own profile menu. A parent does not play, so a run of days and a pile of stars on their account are counting nothing.

- [ ] **Step 1: Link to progress from each child card**

In `src/components/parent-dashboard.tsx`, add `import Link from 'next/link';` at the top of the imports. Then in `ChildCard`, add a Progress link as the **first** item in the `<div className="flex gap-3">` button row, before the existing "Get code" button:

```tsx
          <Link
            href={`/progress?child=${child.id}`}
            className="no-select rounded-2xl border-2 border-(--color-line) px-5 py-3 text-xl font-semibold transition hover:border-(--color-brand)"
          >
            Progress
          </Link>
```

- [ ] **Step 2: Make the stars and streak optional in the profile menu**

In `src/components/profile-menu.tsx`, change the `Props` interface:

```ts
interface Props {
  name: string | null;
  image: string | null;
  /**
   * As stored, and null for a parent — they don't play, so a run of days and a
   * pile of stars on their account are counting nothing. Whether a run is still
   * live depends on the child's clock, not the server's.
   */
  streak: PlayStreak | null;
  stars: number | null;
  /** The sign-out form, built on the server so it stays a server action. */
  children: ReactNode;
}
```

The `useSyncExternalStore` call must stay unconditional — hooks cannot be skipped — so give it a fallback and gate only the rendering. Change the hook to:

```ts
  const days = useSyncExternalStore(
    subscribeToTheClock,
    () => (streak ? currentStreak(streak, Date.now(), -new Date().getTimezoneOffset()) : 0),
    () => streak?.days ?? 0,
  );
```

Wrap the flame `<span>` inside the button so it renders only when there is a streak — replace the whole `<span className="flex items-center gap-1 text-lg font-bold text-(--color-flame) tabular-nums" ...>...</span>` block with:

```tsx
        {streak ? (
          <span
            className="flex items-center gap-1 text-lg font-bold text-(--color-flame) tabular-nums"
            title={`${days} day${days === 1 ? '' : 's'} in a row`}
          >
            <FlameIcon className="h-5 w-5" />
            {days}
          </span>
        ) : null}
```

Then change the button's className so it stays balanced with nothing on the left — replace `py-1.5 pr-1.5 pl-3` with:

```
py-1.5 pr-1.5 ${streak ? 'pl-3' : 'pl-1.5'}
```

(the className becomes a template literal). Finally, wrap the stars `<p>` in the open menu:

```tsx
          {stars === null ? null : (
            <p className="flex items-center gap-2 px-3 py-2 text-xl font-semibold">
              <StarIcon filled className="h-6 w-6 text-(--color-star)" />
              <span className="tabular-nums">{stars}</span>
              <span className="font-normal text-(--color-ink-soft)">
                star{stars === 1 ? '' : 's'}
              </span>
            </p>
          )}
```

- [ ] **Step 3: Stop reading stars and streak for a parent**

In `src/app/page.tsx`, the account and the other three reads currently share one `Promise.all`. Split them, so a parent's page does two fewer queries rather than reading numbers it will not show. Replace:

```ts
  const userId = session?.user?.id;
  const [account, stored, streak, stars] = userId
    ? await Promise.all([
        readAccount(userId),
        readSelectedLevel(userId),
        readPlayStreak(userId),
        readStarTotal(userId),
      ])
    : [null, null, noStreak(), 0];

  const initialLevel = resolveInitialLevel(stored, levels);
  const isParent = account?.role === 'parent';
```

with:

```ts
  const userId = session?.user?.id;
  const account = userId ? await readAccount(userId) : null;
  const isParent = account?.role === 'parent';

  // A parent doesn't play, so there is no level to reopen on, no run of days and
  // no stars — reading them would only put numbers on their screen that are
  // counting nothing.
  const [stored, streak, stars] = userId && !isParent
    ? await Promise.all([readSelectedLevel(userId), readPlayStreak(userId), readStarTotal(userId)])
    : [null, null, null];

  const initialLevel = resolveInitialLevel(stored, levels);
```

`noStreak` is now unused in this file — remove it from the `import { noStreak } from '@/lib/rewards/streak';` line, deleting the import entirely if nothing else in the file uses it. The existing `<ProfileMenu ... streak={streak} stars={stars} />` call needs no change now that both props accept null.

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint && npm test && npm run build`
Expected: no type errors, no lint errors (an unused `noStreak` import would fail here), all tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/parent-dashboard.tsx src/components/profile-menu.tsx src/app/page.tsx
git commit -m "Link a parent to each child's progress, and drop the rewards they don't earn"
```

---

### Task 11: Document it

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the stale claim in "Reinforcement and analytics"**

The last paragraph of that section currently ends with "**There is no parent-facing screen yet** — that is a separate piece of design work, and these functions exist to be consumed by it when it happens." That is no longer true. Replace that sentence with:

```markdown
`/progress` is the screen that consumes them — see **Parent analytics** below.
Buckets take a UTC offset from the caller so a Sydney evening's practice doesn't
land on the next day.
```

(and delete the now-duplicated trailing "Buckets take a UTC offset..." sentence if it is left stranded).

- [ ] **Step 2: Add a section after "Accounts"**

```markdown
## Parent analytics

`/progress?child=<id>&subject=maths` — a parent picks a child and sees how they
are going. It reads and renders; nothing on it writes.

**The child id is never trusted.** `listChildren(parentId)` returns both the
dropdown's options and the set of ids this parent may look at, and the parameter
is resolved against that list. There is no separate ownership check to drift out
of step with the query — the same reason `accounts.ts` puts `parentId` in every
`where`.

**Whose days these are is the child's question, not the parent's.** The server
has no timezone and does not know the browser's, so the offset comes from
`latestOffsetMinutes` — the offset the child last answered at, which every
`Attempt` already stores. A parent reading this from another timezone still sees
their child's evenings as evenings.

**`readObservations` and `readSittings` are not best-effort**, unlike everything
else in `records.ts`. A swallowed failure there costs a little history while a
child plays on; here an empty array would render as "your child has never
practised", which is a lie when the database hiccuped. `null` means *could not
read* and `[]` means *nothing recorded*, and the screen says something different
for each.

**The screen refuses to diagnose what it doesn't know.** Under
`MIN_OBSERVATIONS` answers, "Needs a hand" and "Doing well" say so in words
rather than listing something built from two data points. A child who has never
played gets a sentence, not empty charts.

`headline` holds the arithmetic behind the three tiles — a rolling 7 days
against the 7 before, because a Monday-aligned week reads "0 questions" every
Monday morning. It lives in `lib` and is tested, like everything else that
counts. `strengths` mirrors `problemTopics`, ordered by `correctDays` because
that is the evidence that means something; it excludes `review-due` so no topic
appears in two sections at once.

Two framing decisions the copy depends on. The tile says **"time on questions"**,
not "minutes spent": it is summed `timeTakenMs`, already capped per answer, so
it can't be inflated by an iPad left on the sofa — and it undercounts, which the
label has to be honest about. And a line under the tiles explains that **around
three in four right is the system working**; the selector mixes hard topics in
deliberately, and without that line a parent reads 76% as a C.

`recharts` draws the topic bars and is the project's only UI dependency. Height
is questions and the fill is correct answers; the remainder is line grey rather
than `--color-wrong`, because it is "the rest of the questions" and not a column
of failures. The practice calendar is hand-rolled SVG and server-rendered — no
library ships one worth the bytes.

**A parent's profile menu has no stars and no streak.** They don't play, so both
would be counting nothing; `page.tsx` skips those two reads entirely for a
parent rather than reading numbers it won't show.
```

- [ ] **Step 3: Update the architecture tree**

In the `src/lib` tree near the top of "Architecture", no change is needed — `src/lib/analytics/` is already listed. Leave it.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run typecheck && npm run build`
Expected: all pass.

```bash
git add CLAUDE.md
git commit -m "Document the parent analytics screen"
```

---

## Self-Review

**Spec coverage:** Route and access → Task 9. Subjects → Task 9 (tabs) + Task 7/8. `readObservations` contract + `readSittings` → Task 3. `periods`, `headline` → Task 1. `strengths`, `coverage` → Task 2. Existing functions reused → Tasks 7, 8. Screen layout → Tasks 7, 8, 9. "Time on questions" wording → Task 7. Accuracy framing line → Task 7. Example question → Task 8. Components list → Tasks 4–9. Recharts notes (fixed height, CSS vars, grey remainder, topic+level keying, top 8) → Tasks 5, 7. Empty and honest states → Tasks 8, 9. Testing → Tasks 1, 2. Non-goals → nothing implements them, correctly.

Two additions beyond the spec, both flagged above: `latestOffsetMinutes` (the spec did not say where the offset comes from) and Task 10's parent profile-menu change (requested separately).

**Type consistency:** `Observation`, `TopicReport`, `ProgressBucket`, `Sitting`, `TopicBar`, `Periods`, `Headline`, `Coverage`, `ProgressChild` — each defined once and referenced by the same name throughout. `readObservations`/`readSittings` return `T[] | null` in Task 3 and are handled as nullable in Task 9. `practisedDays` is exported from Task 4 and consumed in Task 7. `latestOffsetMinutes` is produced in Task 1 and consumed in Task 9.
