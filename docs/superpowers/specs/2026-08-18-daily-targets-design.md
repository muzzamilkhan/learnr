# Daily practice targets

## Overview

A parent may set one **daily target** on a child: either a number of questions
or a number of minutes, per day, across every subject. It is optional, and a
child with no target sees nothing new anywhere in the app.

This is the first thing in LearnR that asks a child to commit to something.
Everything up to now has been deliberately open-ended - a session never ends,
the header counts nothing, and the only reckoning is the stars between rounds.
A target changes that narrative on purpose: there is now a thing to finish
today, a bar that fills while they do it, and a reward for getting there.

What does not change is the tone. The target is a floor to reach, never a cap -
nothing stops a child carrying on past it, and nothing is taken away for
missing it. A missed target is silent: no red, no nagging, no "you failed
yesterday" on the home screen. The only thing that ever happens is the day it
is *met*.

Out of scope for this pass: weekly or per-subject targets, targets a child sets
themselves, notifying a parent that a target was hit, a history of past targets,
and any streak of days on target.

## The numbers, and why they are these numbers

| | min | max | step |
| --- | --- | --- | --- |
| questions | 10 | 60 | 5 |
| minutes | 5 | 30 | 5 |

Ten questions is exactly one round, so the smallest question target is the
smallest unit of practice the app already has a reward for; sixty is six
rounds, a long but real sitting. Five minutes is a genuine target for a
Kindergartener and thirty is a long sitting for a primary child.

**The floors are the deliberate part.** A parent setting a target for a
six-year-old needs to be able to set an easy one, or the feature's first act is
a child failing at something their parent chose for them. The ceilings are
what stop a well-meaning parent setting a bar nobody could clear on a school
night. Neither bound is enforced anywhere near play - going past the target is
always fine.

**Hitting the target is worth `TARGET_STARS` = 10.** That is worth three or
four clean rounds: unmistakably the day's biggest single award, while leaving
the round stars still worth earning. A flat number rather than one scaled to
the target's size, because scaling it would make a child's star total a
measure of how much their parent asked for, and would hand a parent a dial on
their child's rewards.

## The library - `src/lib/rewards/target.ts`

A third file beside `stars.ts` and `streak.ts`, under the same rules as the
rest of `lib`: pure, no clock, no database, `now` and the UTC offset passed in.

```ts
export type TargetKind = 'questions' | 'minutes';

export interface DailyTarget {
  kind: TargetKind;
  value: number;
}

export const TARGET_LIMITS: Record<TargetKind, { min: number; max: number; step: number }>;
export const TARGET_STARS = 10;

/** The boundary normaliser, like `parseYearLevel`: null for anything not a target. */
export function parseTarget(kind: unknown, value: unknown): DailyTarget | null;

/** Every value a parent may choose for one kind, for the dropdown. */
export function targetOptions(kind: TargetKind): number[];

export interface TargetProgress {
  /** Questions answered, or milliseconds practised, today. */
  done: number;
  /** The target in the same unit as `done` - minutes are converted to ms here. */
  target: number;
  /** `done / target`, clamped to 1. What the bar is a picture of. */
  fraction: number;
  complete: boolean;
}

export function targetProgress(
  target: DailyTarget,
  answers: readonly TargetAnswer[],
  options: { now: number; offsetMinutes?: number },
): TargetProgress;
```

`TargetAnswer` is `{ answeredAt: number; timeTakenMs: number }` - the two
fields of an `Attempt` this needs, so both `readObservations` rows and the
in-session attempts satisfy it without a conversion.

`targetProgress` filters to the answers falling on the same `localDay` as
`now`, then counts them or sums their `timeTakenMs`. **A minute here is the
same minute the parent's report already calls "time on questions"**: summed
`timeTakenMs`, already capped at `MAX_TIME_MS` per answer by the session
engine. An iPad put down and picked up after dinner cannot earn a minute, and
the target agrees with the report rather than being a second idea of how long
a child practised.

`parseTarget` rejects a value outside its kind's bounds or off its step, so a
value that arrives from a form or a URL is normalised in exactly one place.

## Schema

Three columns on `User` for the target itself:

```prisma
/// The daily target a parent set: "questions" or "minutes", and how many. Both
/// null when there is no target, which is the state every child starts in.
targetKind  String?
targetValue Int?

/// The last local day the target's stars were banked, as a day number rather
/// than a timestamp - the same reason `playStreakDay` is one. Null until the
/// child first hits a target. This is the compare-and-set that makes the award
/// happen once a day however many times it is asked for.
targetDay   Int?
```

And a fourth that this feature makes the app's only star total:

```prisma
/// Every star this child has. Only ever incremented, and never recounted - see
/// below for why the sum it replaces could not survive this feature.
stars Int @default(0)
```

The migration backfills the target columns with nothing: no target is the correct
state for every existing child, and a target is a thing a parent chooses. `stars`
is backfilled from the existing history.

## Stars become one incremented column

Before this feature, a child's star total was `SUM(LearningSession.stars)`, and
that column was a **cache**: `awardRoundStars` re-read the sitting's answers, ran
`starsEarned` over them and *set* it. Being a set rather than an increment is
what made it safe to fire best-effort - a repeated call was harmless, and a
dropped one repaired itself at the next round.

That works because a round's worth can be re-derived from the answers forever.
**A target's cannot**, because the target itself is mutable. A child hits a
10-question target on Monday; on Tuesday their parent raises it to 40. Recounting
Monday against the stored target would find it unmet and take ten stars off a
child who earned them - a total that goes down, for something they did not do.
Storing the day's target on every attempt to make that recount honest would put a
parent's setting into the history of every answer, for one number.

So the total stops being derived, for both sources at once rather than growing a
second mechanism beside the first. **`User.stars` is incremented on the event and
never recomputed.** What replaces the recount's safety is a guard per event, so
each award can still only fire once:

- **A round** is guarded by `LearningSession.roundsBanked` - how many closed
  rounds of that sitting have been paid for. Banking is a read of that counter
  under `SELECT ... FOR UPDATE`, then an increment of `User.stars` by the worth of
  the rounds past it, in one transaction. It is the same row lock
  `updateTopicSkill` already takes, for the same reason: two answers landing at
  once must queue rather than both read the same counter.
- **A day's target** is guarded by `User.targetDay`, in one compare-and-set
  statement. The second write matches no row and pays nothing.

The answers are still read when banking a round - a round's worth is 3, 2 or 1
depending on how it went, and the client must not be the one saying which. But
they are read to value *the new rounds only*; the total is never rebuilt from
them. `LearningSession.stars` goes, replaced by `roundsBanked`.

**What this costs**, stated plainly: a dropped award no longer heals itself. Under
the old scheme a failed write was recovered by the next round's recount; now ten
questions' stars are simply gone. That is the price of a total that a changed
target cannot retroactively reduce, and it is paid in the direction that matters
- a child never loses stars they were shown, they only ever miss stars they were
never shown.

The migration backfills `User.stars` by **recounting every sitting's answers**,
not by summing the old column - so any award dropped before this migration is
paid at last, and the numbers only go up.

## Awarding

A new best-effort server action on the play path, fired after the answer's
write resolves, exactly like `awardRoundAction`. `awardDailyTarget` in
`records.ts`:

1. Verify the session belongs to the signed-in user (`ownsSession`), as every
   play write does.
2. Read the child's `targetKind`/`targetValue`. No target, nothing to do.
3. Recount **today's answers across all of that child's sessions** - the target
   is not subject-specific and a child may switch subject or level mid-day, so
   the recount is per user and per day, not per session.
4. If `targetProgress(...).complete`:

```
updateMany
  where { id: userId, OR: [{ targetDay: null }, { targetDay: { lt: today } }] }
  data  { targetDay: today, stars: { increment: TARGET_STARS } }
```

The `where` on `targetDay` is the whole of the guard, in one statement, in the
shape the play streak already uses. Two tabs answering at once, a retried
call, or a client firing it on every answer of the evening all award exactly
once - the second write matches no row. The action returns whether it awarded
and the child's new star total, so the client knows whether to celebrate.

The offset comes from the client, the same way it arrives on every attempt: the
server has no timezone, and a day here is the child's.

Like the rest of `records.ts` on the play path this swallows failures. A missed
award costs ten stars and repairs itself on the next answer of the day, which
is a far better failure than an interrupted question.

## Play screen

The bar sits **top centre**, above the question, roughly half the width: a
rounded track with a fill running a gradient from a warm red at the left to
green at the right, and a slow sparkle sweeping across it. No numbers on it - it is a picture of how far along today is, not a counter, which
is what keeps it on the right side of the rule that the play screen's header
counts nothing.

The fill's width animates with a long transition so it glides rather than
jumps:

- **questions**: steps forward on each answered question.
- **minutes**: creeps forward *during* the current question, toward
  `done + min(elapsed, MAX_TIME_MS)`. It is capped at the same five-minute
  ceiling the recorded answer will be capped at, so the movement shown can
  never overrun the truth, and it settles onto the real recorded total when the
  answer lands.

Both clamp at the target - the bar never shows more than full.

`PlaySession` takes a `target` prop from the server page: the target itself,
today's progress at the time the screen loaded, and whether today's award has
already been banked. A child who hit their target this morning and comes back
after school **sees no bar** - the day is done, and an already-full bar is a
thing to look at that says nothing.

### The celebration

`TargetReward`: a full-screen moment in `RoundReward`'s shape but with its own
copy - the target reached, and the ten stars - dismissable by a tap and by a
timeout, reusing the same fanfare. Ten stars is the largest single award in the
app and gets a screen of its own.

When an answer closes a round *and* completes the target, the two celebrations
**queue**: the round's stars first, then the target's when they are dismissed.
They cannot overlap, nothing is dismissed by a tap meant for the other, and the
next question's clock restarts only once both are gone - so neither break ever
lands inside a question's recorded time.

Once the target celebration is dismissed, the bar is hidden for the rest of the
day.

## Child's home screen

A line under the header band, above the subject cards: **"Today's goal: 20
questions"** with **"12 done"** and the same gradient bar. It is what a child
checks before they start, which is exactly when "how far off am I" is the
question.

**Unlike the play bar, it stays once the target is met** - full, ticked, and
reading "Goal reached" for the rest of the day. The two screens differ because
what they are protecting differs: the play screen is one question at arm's
length, and a bar there that no longer moves is only something to look at
instead of the question. The home screen is where a child arrives and takes
stock, and arriving to find the day already done is worth seeing - it is also
the only place that achievement persists, since the celebration is over in four
seconds.

Only a managed child ever sees it. A child signed in with their own Google
account has no parent to set a target, gets no target columns set, and so gets
nothing here - the same way they keep the level dropdown a managed child does
not get.

## Parent's screens

The target is set where the level is set: on the child, in `/children`.

The add and edit forms gain a **Daily goal** row - two `Select`s at the
parent's `sm`/`md` scale. The first is the kind (**No goal** / **Questions** /
**Minutes**), and choosing "No goal" hides the second and clears both columns.
The second is the value, its options straight from `targetOptions(kind)`, so
the steps and bounds are the library's and not the form's.

The child card gains one short line among the facts it already carries:
"Goal: 20 questions a day", or nothing at all when there is none - a card
saying "No daily goal" would put an absence on every card of every parent who
never wanted the feature.

`createChild` and `updateChild` in `accounts.ts` carry the two fields, scoped
by `parentId` in the `where` like every other child mutation, and report
whether they worked - these are not best-effort.

## Practice calendar

The calendar currently answers "are they using it". With a target it answers
"are they hitting it", which is a different question and needs a different
cell.

`CalendarDay` gains `done` alongside `attempts` - questions answered and
milliseconds practised for that day, so the cell can be measured against
either kind of target. `calendarWeeks` fills it from the same walk it already
does.

With a target set:

- **met**: the cell is green, with a tick inside it.
- **partly done**: the cell is filled left-to-right by the day's fraction of
  the target - a half-done day is left half blue, right half line grey.
- **nothing**: line grey, as now.

The cells grow from 14px to about 20px in target mode, because a tick inside
14px is a smudge. Without a target nothing about the calendar changes: the
four-step blue shading stays, since a day cannot be partly toward a target that
does not exist.

Historical days are measured against the child's **current** target - past
targets are not stored, by the decision above. So the caption says exactly
that: "against their goal of 20 questions a day". A parent who raises the
target sees the last four weeks re-judged, and the caption is what makes that
honest rather than surprising.

## Testing

Everything above the database is pure and gets tests, in `target.test.ts`:

- `parseTarget` at every boundary - below min, above max, off the step, wrong
  kind, non-numeric - and the values that survive it.
- `targetProgress` for both kinds: the count, the millisecond sum, the
  clamp at 1, and `complete` on exactly the answer that reaches the target.
- The day boundary under a UTC offset - an evening's answers in Sydney count
  toward that evening's target and not the next day's.
- That a capped answer contributes `MAX_TIME_MS` and no more, so an abandoned
  question cannot finish a minutes target.

The calendar's cell classification is a pure function over `CalendarDay` and
the target, tested beside the other calendar helpers.

The award itself is a compare-and-set in `records.ts`, which is untested by
that file's existing convention - which is exactly why all of its arithmetic
lives in `target.ts` and none of it in the query.
