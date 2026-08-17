# Parent analytics

## Overview

`src/lib/analytics` has been written and tested since the reinforcement work,
and nothing renders it. This is the screen it was written for: a parent picks
one of their children from a dropdown and sees how that child is going.

The page answers two questions a parent actually has — **are they using it?**
and **where do they need help?** — and it is built to refuse to answer either
one when the evidence isn't there. A topic with three answers behind it is
`new`, not a weakness, and the screen says so in words rather than drawing a
chart over it.

Out of scope for this pass: comparing children to each other, printable or
exported reports, time-of-day or session-length analysis, and any notification
or email. Nothing here writes.

## Route and access

New route `/progress?child=<id>&subject=maths`, a server component with
`export const dynamic = 'force-dynamic'` for the same reason `/` has it — the
content is per-parent and must never be prerendered and shared.

The guard runs in one order, and authorisation falls out of it rather than
being a separate check alongside it:

1. No session → `redirect('/')`.
2. `readAccount(userId)` → `role !== 'parent'` → `redirect('/')`. A child must
   not reach this screen, and neither must an account that hasn't chosen a role.
3. `listChildren(parentId)` returns both the dropdown's options **and** the set
   of ids this parent may look at. The `child` parameter is resolved against
   that list; anything not in it falls back to the first child.

Step 3 is the whole of the ownership check, deliberately. The child id arrives
from the browser, so it is matched against a query already scoped by
`parentId` — the same reason `accounts.ts` puts `parentId` in every `where`
rather than checking ownership separately and then querying by id. There is no
second place for the two to drift apart.

A parent with no children yet gets a plain pointer back to the dashboard, not
an empty report.

Entry is a **Progress** button on each `ChildCard` in `ParentDashboard`,
linking to `/progress?child=<id>`. The dropdown on the page is for switching
between children once you are there; it pushes `?child=` through the router so
a refresh keeps the child you were looking at.

## Subjects

`Observation` gains no `subject` field. `readObservations(userId, subject)`
already scopes to one subject, and topics only mean anything within one — a
history per subject is the honest grain, and it costs nothing because the page
reads only the selected subject.

`listSubjects()` supplies the tab row and `?subject=` selects, defaulting to
the first. With one subject shipped the row renders as a heading rather than a
single pointless tab.

## Reads

### `readObservations` — one contract change

`records.ts` reads are best-effort: they swallow the error and return `[]`.
That is right for play, where a failed read costs a little steering and the
child answers on regardless. It is wrong here. An empty array renders as *"your
child has never practised"*, which is a lie when the database merely hiccuped
— and it is exactly the failure `accounts.ts` already refuses to make, on the
grounds that a silently failed removal is a parent lied to.

So:

```ts
export async function readObservations(
  userId: string,
  subject: string,
  limit = HISTORY_LIMIT,
): Promise<Observation[] | null>
```

`null` **only** on a caught error. No database configured stays `[]` — nothing
has been recorded, which is true and is not a failure. The function has no
callers today, so the change costs nothing.

### `readSittings` — new

```ts
export interface Sitting {
  id: string;
  startedAt: number;
  level: YearLevel;
  attempts: number;
  correct: number;
  /** Summed capped time on this sitting's questions. */
  timeMs: number;
}

export async function readSittings(
  userId: string,
  subject: string,
  limit = 8,
): Promise<Sitting[] | null>
```

`LearningSession` rows for that child and subject, newest first, with their
attempts selected and reduced to the three totals. The existing
`@@index([userId, subject, level])` drives it, and a limit of 8 keeps the
attempt fan-out small.

`LearningSession.level` is a `String` in the schema, so it goes through
`parseYearLevel` and a row that fails it is dropped — the same treatment
`readObservations` already gives an unparseable level.

Sessions with zero attempts are dropped. A sitting nobody answered a question
in is not a sitting, and listing it would make a child look busier than they
were — which is the one thing this section exists to get right.

Same `null`-on-error contract as above.

## New pure functions — `src/lib/analytics/report.ts`

All four are pure, take `now` from the caller, and are unit tested. They sit in
`report.ts` beside `problemTopics` and `dueForReview`, which they mirror.

Days are bucketed against a **caller-supplied** `offsetMinutes`, matching
`summarise` and `progressOverTime` rather than `nextSkill`'s per-observation
offset. The parent is reading this from their own device, and the report's
existing convention is the one to follow.

### `periods`

```ts
export interface Periods {
  current: Observation[];
  previous: Observation[];
}

export function periods(
  observations: readonly Observation[],
  { now, days = 7, offsetMinutes = 0 }: { now: number; days?: number; offsetMinutes?: number },
): Periods
```

Two adjacent windows of local days, so a delta is one call. `current` is the
last `days` local days including today; `previous` is the `days` before that.

A **rolling** window, not a calendar week. A Monday-aligned week reads "0
questions this week" every Monday morning, which is the moment a parent is
most likely to look.

### `headline`

```ts
export interface Headline {
  minutes: number;
  questions: number;
  /** 0..1, or null when nothing was answered in the window. */
  accuracy: number | null;
  minutesDelta: number;
  questionsDelta: number;
  /** In accuracy points on the same 0..1 scale, or null when the previous window was empty. */
  accuracyDelta: number | null;
}

export function headline(
  observations: readonly Observation[],
  options: { now: number; days?: number; offsetMinutes?: number },
): Headline
```

The three widgets and their deltas, computed from `periods` and `summarise`.
It lives in lib rather than in the component because it is arithmetic, and
arithmetic in this codebase is tested.

`accuracyDelta` is `null` when the previous window had no answers. "Down 76
points" against a week the child didn't practise is not a fact, and the tile
shows nothing rather than a number it can't support.

`minutes` is `totalTimeMs` rounded to whole minutes.

### `strengths`

```ts
export function strengths(reports: readonly TopicReport[], limit = 3): TopicReport[]
```

The mirror of `problemTopics`: status `secure` only, ordered by `correctDays`
descending, then `strength`, then `attempts`, then level and topic.

`review-due` is deliberately excluded even though those topics are also
mastered — `dueForReview` already lists them, and a topic appearing in two
sections reads as a bug.

### `coverage`

```ts
export interface Coverage {
  offered: number;
  practised: number;
  untouched: string[];
}

export function coverage(
  reports: readonly TopicReport[],
  offered: readonly string[],
  level: YearLevel,
): Coverage
```

Filters `reports` to `level` internally rather than trusting the caller to do
it — reports span every year a child has practised, and `offered` comes from
`topicsForLevel(subject, level)` for exactly one.

Practised means `attempts > 0`. This is a question about what has been *tried*,
not what has been learned; the status sections answer the other one.

`level` is the child's `selectedLevel`, already returned by `listChildren`, so
this costs no extra read. It is nullable on `ChildProfile` — a child whose
parent has not set a year has no denominator, and the coverage line is omitted
rather than guessed at from their attempts.

## Existing functions, used as they are

- `summarise` — inside `headline`, once per window.
- `progressOverTime({ unit: 'day', count: 56 })` — the practice calendar,
  empty buckets included. The "21 of 56 days" count beside it is the buckets
  with `attempts > 0`; the empty ones are the gaps, which are half of what the
  calendar is being read for.
- `topicReports` — re-sorted by `attempts` descending for the bar chart.
- `problemTopics`, `dueForReview` — the two list sections, unchanged.

## The screen

```
Alex's progress          [🦊 Alex ▾]        ← Dashboard
Maths

┌ Time on questions ┐ ┌ Questions ┐ ┌ Correct ┐
│ 38 min            │ │ 142       │ │ 76%     │
│ ↑ 12 on last week │ │ ↑ 44      │ │ ↓ 3 pts │
└───────────────────┘ └───────────┘ └─────────┘
Questions are picked to stretch — around three in four right means it's working.

Practice · last 8 weeks                    21 of 56 days
▪▪▫▪▪▫▫  ▪▫▫▪▪▪▫  ▫▫▫▫▫▫▫  ▪▪▪▫▪▫▫ ...

Topics                    [stacked bars — total height, correct filled]

Needs a hand
  Fractions · Year 4 · 48% of 23 · slipping · last Tuesday
    e.g. "What is one quarter of 20?"

Doing well
  Counting numbers · Year 3 · known on 5 separate days

Coming up for review
  Even and odd · Year 2 · due in 2 days

Year 4 · 9 of 14 topics practised
  Not yet tried: angles, chance, …

Recent sittings
  Sat 16 Aug · Year 4 · 22 questions · 82% · 9 min
```

### Three things the wording has to get right

**"Time on questions", not "minutes spent".** The number is summed
`timeTakenMs`, which the session engine has already capped at `MAX_TIME_MS` so
an iPad left on the sofa isn't counted as practice. That cap is the reason the
figure is trustworthy and also the reason it undercounts — it excludes reward
breaks and the pause before a question is read. The label says what is actually
measured.

**Accuracy is not a grade.** The selector deliberately mixes hard topics in, so
a healthy child sits in the seventies, and a dip in the number is often the
selector doing its job. One line under the tiles says so. Without it a parent
reads 76% as a C.

**Every problem topic carries an example question.** Pulled from the catalog
for that topic and level and generated with a `Rng` seeded from the template id
— pure, stable across refreshes, cheap. It turns "fractions are hard" into
something a parent can sit down and do. Wrapped in a `try`/`catch` that omits
the example on failure: a report page must not 500 over a nicety.

## Components

- `src/app/progress/page.tsx` — guard, reads, and nothing else.
- `src/components/progress-report.tsx` — server component, the sections above.
- `src/components/child-picker.tsx` — `'use client'`, pushes `?child=`.
- `src/components/topic-bars.tsx` — `'use client'`, Recharts.
- `src/components/practice-calendar.tsx` — server-rendered grid of `<rect>`s.

The calendar is hand-rolled on purpose: no charting library ships one worth
depending on, it is a grid of squares, and rendering it on the server keeps it
out of the client bundle entirely.

### Recharts

`recharts@3.10.1`, React 19 peer-clean. New runtime dependency, the first UI
one in the project.

- Client-only, so `topic-bars.tsx` is a `'use client'` island fed serialised
  data from the server component.
- **Fixed-height container.** `ResponsiveContainer` renders nothing until
  mount; without a declared height the whole page jumps on hydration.
- Colours are passed as `fill="var(--color-right)"` and
  `fill="var(--color-line)"` — SVG `fill` accepts `var()`, so the chart uses
  the app's variables directly rather than Recharts' defaults.
- The unfilled portion is **line grey, not `--color-wrong`.** Height is
  questions and the fill is correct answers; the remainder is "the rest of the
  questions", not a column of failures. A page of red bars is a different
  message from the one this screen is for.
- Stacking needs `wrong` as its own key: each datum is
  `{ key, label, correct, wrong }` with `wrong = attempts - correct`.
- Data is keyed by topic **and** level, since a child who has moved up a year
  can have the same topic twice. The label is the topic alone, with the year
  appended only when the child has practised that topic at more than one.
- Top 8 topics by attempts. Beyond that the labels stop being readable on an
  iPad, and the tail is what the coverage line is for.

## Empty and honest states

The page must never present a diagnosis it does not have:

- No children → point back to the dashboard.
- Child has never played → say so in words. No empty charts.
- Everything under `MIN_OBSERVATIONS` → the tiles and calendar still render,
  because usage is knowable from a single answer, but *Needs a hand* and
  *Doing well* say "not enough answers yet to say" rather than inventing a
  list from two data points.
- A read returned `null` → "Couldn't load progress just now." Distinct from
  the never-played state, which is the point of the contract change.

## Testing

Follows the codebase split exactly. Every test in this repo is a lib test, and
that does not change here.

Unit tests in `src/lib/analytics/report.test.ts`:

- `periods` — window boundaries by local day, the offset applied, an
  observation on the boundary landing in exactly one window.
- `headline` — the three figures and their deltas; `accuracy` null on an empty
  window; `accuracyDelta` null when the previous window was empty; minutes
  rounding.
- `strengths` — `secure` only, `review-due` excluded, ordered by `correctDays`.
- `coverage` — filtered to the level, `untouched` correct, a topic with one
  attempt counted as practised.

`readObservations` and `readSittings` touch Prisma and are not unit tested,
consistent with the rest of `records.ts`. Components are not tested,
consistent with every component already in the repo — which is why `headline`
exists as a lib function rather than as arithmetic inside a tile.

Run `npm test` and `npm run typecheck` before pushing, per the working
agreements.

## Non-goals (explicit)

- Comparing one child against another, or against any cohort.
- Printable, exportable or emailed reports.
- Time-of-day, session-length or pace analysis. Time taken is reported here and
  still never acted on — the reinforcement selector does not read this page's
  numbers, and adding a "too slow" signal is the punitive thing this app
  doesn't do.
- Any write. The screen reads and renders; nothing on it changes a child's
  level, content or history.
- A child-facing version of any of it. The rewards screen is what a child sees,
  and a running accuracy percentage is precisely what the rewards design keeps
  off their screen.
