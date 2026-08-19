# Speed run

## Overview

A **speed run** is 90 seconds of arithmetic against the clock. The player picks
an operation and a variation of it - the 7 times table, hard subtraction - and
answers as many as they can before the bar runs out. The score is how many they
got right, and the only thing kept is their best for that mode.

It is the first thing in LearnR that is a *game* rather than a lesson, and the
distinction is the whole design. Everything else in the app is careful: the
selector mixes hard topics in deliberately, a session never ends, the header
counts nothing, and nothing is ever taken away. A speed run inverts all of it -
there is a clock, there is a score, and there is a number to beat. That is safe
to do here precisely because it is **sealed off from the learning record**: a
speed run writes no `Attempt`, touches no `TopicSkill`, moves no star, extends
no streak and counts toward no daily target. Nothing a child does in a speed run
changes what they are asked next in an ordinary session.

That seal is not squeamishness, it is correctness. An `Attempt` carries a
curriculum topic and an Australian school year, and a speed run has neither.
Writing 40 rows of `topic: 'multiplication', level: '3'` in 90 seconds would put
a topic that is not in the curriculum into the selector that decides what a
child is asked next, and would swamp the recency-weighted `strength` of
everything genuinely being learned. The honest thing for a speed run to record
is a speed run's score, and nothing else.

**A parent plays too.** They are an ordinary `User` row, so they get the same
screens and their own records. Their records are private - nothing crosses
between accounts.

Out of scope for this pass: a family leaderboard, sharing or comparing records
between accounts, a history of every run (only the best per mode is kept),
run lengths other than 90 seconds, difficulty bands for the times tables,
subjects other than maths, and any speed run appearing in the parent's existing
analytics.

## The modes, and why they are a closed list

Twenty-seven modes, enumerated in code and never constructed at runtime:

| Operation | Variations | Keys | Count |
| --- | --- | --- | --- |
| Addition | easy, moderate, hard | `add.easy` | 3 |
| Subtraction | easy, moderate, hard | `subtract.easy` | 3 |
| Division | easy, moderate, hard | `divide.easy` | 3 |
| Multiplication | each table 2-12, plus `2-5`, `6-9`, `10-12`, `all` | `multiply.7`, `multiply.2-5` | 15 |
| Mixed | easy, moderate, hard | `mixed.easy` | 3 |

**The list is closed because a record is only worth beating if the mode is worth
naming.** A free "from" and "to" range across the tables would give about sixty
modes, most of which differ from a neighbour by one table: "best in 4-7" and
"best in 4-8" would be two near-identical numbers, each set once and never
approached again, and the records page would be a list nobody reads. Four named
bundles are enough range to be useful and few enough that each one accumulates
a record with some history behind it.

**Multiplication is the one operation with no difficulty axis**, because the
times tables *are* how multiplication is practised and drilled. Asking a child
for "hard multiplication" when they came to practise their sevens would be
answering a question nobody asked.

**Mixed draws from all four operations at one difficulty**, which means
multiplication needs bands after all - but only inside mixed, where there is no
table to choose: easy is the 2, 5 and 10 tables, moderate is 2-10, hard is 2-12.

`parseMode` is the boundary normaliser, exactly like `parseYearLevel`: it turns
a key from a URL into a `Mode` or into null, in one place, so no caller has to
know what the twenty-seven are.

## Difficulty bands

Every answer is a non-negative whole number, because the number pad has no minus
key and no fraction. That is a hard constraint on the content, not a preference:
subtraction never goes negative, and division always comes out exact.

**Addition**

| | left | right | extra |
| --- | --- | --- | --- |
| easy | 1-10 | 1-10 | |
| moderate | 10-99 | 1-20 | |
| hard | 10-99 | 10-99 | must carry |

**Subtraction** - the right operand never exceeds the left.

| | left | right | extra |
| --- | --- | --- | --- |
| easy | 2-20 | 1 to the left operand | |
| moderate | 20-99 | 1-20 | |
| hard | 30-99 | 10-99 | must borrow |

**Division** - built as `quotient x divisor`, so it is exact by construction
rather than by rejecting the draws that are not.

| | divisor | quotient |
| --- | --- | --- |
| easy | 2, 5, 10 | 1-10 |
| moderate | 2-10 | 1-10 |
| hard | 2-12 | 2-12 |

**Multiplication** - one factor from the chosen table or tables, the other 1-12.

**Hard has to mean hard.** `add.hard` requires a carry
(`mod(x, 10) + mod(y, 10) > 9`) and `subtract.hard` requires a borrow
(`mod(x, 10) < mod(y, 10)`). Without those constraints, "two-digit plus
two-digit" draws `20 + 30` about as often as `37 + 58`, and hard would be
moderate with more digits. The constraint language already has `mod`, and the
generator already satisfies constraints by rejection sampling, so this costs a
string.

## Generating a question that belongs to nobody

A speed run's questions are ordinary generated questions - the same expression
language, the same rejection sampling, the same grading, the same number pad.
Reusing all of that is most of why this feature is small.

There is one obstacle. `QuestionTemplate` requires `topic` and
`level: YearLevel`, and `generateQuestion` copies both onto the `Question` it
returns. A speed run has neither, and giving each mode a nominal school year
would be a lie told in the type system - the one place in this codebase where a
level is guaranteed to be a real Australian school year.

So **`generateQuestion` splits into a core that makes a question and a wrapper
that says who it is for**:

```ts
/** Everything it takes to make a question. */
export interface QuestionSpec {
  prompt: string;
  vars: readonly VarSpec[];
  constraints?: readonly Expr[];
  answer: Expr;
  answerType?: AnswerType;
  choices?: ChoiceSpec;
  hint?: string;
}

/** A spec expanded, with nothing about who was asked. */
export interface GeneratedQuestion {
  prompt: string;
  answer: string | number | boolean;
  answerType: AnswerType;
  choices?: (string | number)[];
  hint?: string;
  vars: Record<string, string | number | boolean>;
}

export function generate(spec: QuestionSpec, rng: Rng): GeneratedQuestion;

/** A spec plus who it is for. Every existing caller is untouched. */
export interface QuestionTemplate extends QuestionSpec {
  id: string;
  subject: string;
  topic: string;
  level: YearLevel;
  tags?: readonly string[];
}

export function generateQuestion(t: QuestionTemplate, rng: Rng): Question {
  return {
    templateId: t.id,
    subject: t.subject,
    topic: t.topic,
    level: t.level,
    ...generate(t, rng),
  };
}
```

`validateTemplate` splits the same way, into a `validateSpec` over the parts a
speed mode has and a `validateTemplate` that adds the id, subject, topic and
level checks on top. The payoff is that **the twenty-seven modes are validated
by the same code that guards the shipped curriculum content** - unbound
variables, out-of-order references, malformed expressions and unsatisfiable
constraints are all caught by the thing that already catches them.

`Question` keeps its current shape and every existing caller keeps working. This
is a refactor with no behaviour change on the curriculum path, and it is the
only change this feature makes to code that already exists.

## The library - `src/lib/speedrun/`

Pure like the rest of `lib`: no clock, no database, no React. `now` and the RNG
are passed in.

### `modes.ts` - what can be run

```ts
export type Difficulty = 'easy' | 'moderate' | 'hard';
export type TableChoice = number | '2-5' | '6-9' | '10-12' | 'all';

export type Mode =
  | { op: 'add' | 'subtract' | 'divide' | 'mixed'; difficulty: Difficulty }
  | { op: 'multiply'; tables: TableChoice };

export type Operation = Mode['op'];

/** All 27, in the order they are offered. */
export const MODES: readonly Mode[];

export function modeKey(mode: Mode): string;          // "multiply.7"
export function parseMode(key: string): Mode | null;  // the boundary
export function parseOperation(op: string): Operation | null;
export function modesFor(op: Operation): readonly Mode[];

export function modeLabel(mode: Mode): string;        // "7 times table"
export function operationLabel(op: Operation): string;// "Multiplication"
export function operationGlyph(op: Operation): string;// "x"

/** One spec for most modes; four for a mixed one. */
export function specsFor(mode: Mode): readonly QuestionSpec[];
```

`specsFor` returning a *list* is what makes mixed fall out of the same
mechanism as everything else rather than needing a second path: the run draws a
spec uniformly and then generates from it, and a list of one is the ordinary
case.

### `run.ts` - the run itself

```ts
/** Fixed, global, and never changes - a record is only comparable against itself. */
export const SPEED_RUN_MS = 90_000;
/** Long enough to read the first question before the clock starts. */
export const COUNTDOWN_MS = 3_000;

export interface SpeedAnswer {
  prompt: string;
  expected: string;
  response: string;
  correct: boolean;
}

export interface RunState {
  mode: Mode;
  specs: readonly QuestionSpec[];
  seed: string;
  draw: number;
  startedAt: number;
  current: GeneratedQuestion;
  /** The one shown dimmed above. Held in state because the screen shows it. */
  next: GeneratedQuestion;
  answers: readonly SpeedAnswer[];
  correct: number;
}

export function startRun(c: { mode: Mode; seed: string; startedAt: number }): RunState;
export function answerRun(state: RunState, response: string, now: number): RunState;
export function remainingMs(state: RunState, now: number): number;
export function isOver(state: RunState, now: number): boolean;
export function runResult(state: RunState): RunResult; // { correct, answered, missed }
```

Immutable like `submitAnswer`: answering returns a new state. Each draw is
seeded from `(seed, draw)` exactly as `session.ts` does it, so the state stays
serialisable and a run is replayable from its seed.

Two details that are the state machine's job and not the screen's:

- **`answerRun` refuses an answer once the clock is out.** A keystroke landing in
  the same tick as the timer's expiry must not inflate the score, and the guard
  belongs where the arithmetic is rather than in a race between two effects.
- **A redraw avoids the two prompts already on screen.** `multiply.7` has twelve
  possible questions, so repeats within a run are inevitable and fine - but the
  same question twice in a row, or the dimmed one above being identical to the
  one below it, reads as broken. A bounded number of redraws, then take what
  comes: a mode with few questions must never hang looking for a fresh one.

### `records.ts` - the comparison

`isRecord(previousBest: number | null, score: number): boolean` - true only when
there is a previous best and the score beats it. **A first run is not a record.**
That is a deliberate choice: it makes a personal best mean somebody improved,
and it stops a child exploring the chooser from firing twenty-seven
notifications at their parent in an afternoon.

## What is stored

One new table, and no changes to any existing one.

```prisma
/// The best a player has done at one speed-run mode. Only the best is kept -
/// a run that does not beat it leaves no trace, so there is no history of every
/// run and no graph of improvement. That is the cost of one row per mode, and
/// it is stated here rather than discovered later.
model SpeedRecord {
  id         String   @id @default(cuid())
  userId     String
  /// The mode's canonical key, e.g. "multiply.7". Parsed by `parseMode`.
  mode       String
  /// Most correct answers in a single run of this mode.
  best       Int
  /// How many were attempted in the run that set it - context for the best,
  /// never a second score.
  answered   Int
  achievedAt DateTime @default(now())
  /// Whether the player's parent has seen the banner for this record. True on
  /// creation, because a first run is not a record and announces nothing; set
  /// false only when a previous best is genuinely beaten.
  seen       Boolean  @default(true)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, mode])
  /// The two reads: one player's whole cabinet, and a parent's unseen records
  /// across their children.
  @@index([userId])
}
```

**This is the one award in the app that needs no row lock**, and the contrast is
worth writing down. `User.stars` is incremented, so a repeated or raced call
would pay twice - hence `LearningSession.roundsBanked` read under
`SELECT ... FOR UPDATE`, and the compare-and-set on `User.targetDay`. A record
is a **maximum**, and a maximum is idempotent: two runs landing at once produce
the same row whichever order they arrive in, and a retry of the same run changes
nothing. So the write is an upsert followed by a conditional
`UPDATE ... WHERE best < :score`, and there is nothing to serialise.

### `src/lib/speed-records.ts`

The Prisma side, beside `records.ts` and `accounts.ts` rather than inside
`src/lib/speedrun/`, which stays pure. `records.ts` is already 800 lines and
this belongs to a different question.

```ts
export interface SpeedBest {
  mode: string;
  best: number;
  answered: number;
  achievedAt: Date;
}

/** Every mode this player has run. Null means the read failed. */
export function readSpeedRecords(userId: string): Promise<SpeedBest[] | null>;

export interface SpeedOutcome {
  previousBest: number | null;
  best: number;
  isRecord: boolean;
}

/** Submit a finished run. Null means the write failed. */
export function submitSpeedRun(
  userId: string,
  mode: Mode,
  run: { correct: number; answered: number; now: number },
): Promise<SpeedOutcome | null>;

/** A parent's children's unseen records, newest first. Null means the read failed. */
export function readUnseenRecords(parentId: string): Promise<ChildRecord[] | null>;

/** Dismiss the banner: marks every unseen record for one child seen. */
export function dismissSpeedRecords(parentId: string, childId: string): Promise<boolean>;
```

**Null means "could not read", never "nothing there"** - the distinction
`readObservations` and `readSittings` already draw, and for the same reason: a
failed read rendered as an empty cabinet tells a child they have never played.

`readUnseenRecords` and `dismissSpeedRecords` scope their `where` by `parentId`
as well as the child id, following `accounts.ts`, because the child id
round-trips through the browser.

`submitSpeedRun` returns its outcome rather than swallowing failure, because the
result screen has to know what to show - and on null it shows the score with no
comparison beside it rather than claiming a best that was never written.

## Screens

### The home screen grows two headings

A child's home screen currently runs the level picker straight into the subject
cards. It gains two headed sections:

- **Practice** - the level picker and subject cards, exactly as they are now.
- **Speed run** - five cards, one per operation (`+ - x / mixed`), each linking
  to its chooser, and a link to the records page.

The speed-run section sits **outside** the level picker rather than inside it,
because a speed run has no school year - putting it under the level dropdown
would imply the level applies to it, and it does not.

### `/speed/[op]` - choose, then run

One route with four client phases, so starting again is instant and never a
navigation:

1. **Chooser** - the variations for that operation as chips, each carrying its
   own best underneath, and a Start button. Server-rendered bests passed in as
   props.
2. **Countdown** - 3-2-1 over the first question, which is already on screen
   behind it. Without a run-up the first seconds of every run are spent
   orienting, which makes the score partly a measure of reaction time.
3. **Run** - below.
4. **Result** - below.

`/speed/records` is a static segment and wins over `/speed/[op]` in Next's
routing, and `parseOperation('records')` returns null besides, so the two cannot
collide.

### The run screen

Stripped further than the play screen. The only things on it are **the way out
and the timer**: no profile menu (a run moves neither total), no hint, no
narration, no target bar, no logo.

```
  ################............     the timer, draining, no numbers

            8 x 4                  next, dimmed and smaller
            7 x 4                  current, full size
          +---------+
          |   2 8   |              what has been typed
          +---------+
       +---+---+---+
       | 1 | 2 | 3 |               the number pad, Check drawn as a tick
       +---+---+---+
```

**The next question sits above the current one, dimmed**, so a child can read
ahead - which is most of what makes a fast run fast. On submit it slides down
into place and a new dimmed one appears above it. This is why `RunState` carries
a lookahead of one rather than the screen faking it.

**The timer is the progress bar going the other way**: draining, no numbers, and
pulsing harder as it empties. Mechanically it is **one CSS width transition set
once at run start** (`width: 0` over `SPEED_RUN_MS`, linear) with the pulse class
stepped from a one-second tick at 30s, 15s and 5s remaining. That matters: a bar
driven by React state at ten frames a second would re-render the whole screen
under a child answering as fast as they can, to say something a CSS transition
says for free. The gradient is sized to the whole track rather than to the fill,
the technique `TargetBar` already uses, so the colour means the same thing at
every length - green when there is time, red when there is not.

`SpeedTimer` is its own component rather than a flag on `TargetBar`: one
component with two personalities is worse than two components that share a
technique. If the shared part turns out to be more than a few lines once it is
written, it becomes a `Bar` primitive both render - a judgement better made with
the code in front of you than in a spec.

**Answering commits the moment the entry matches**, with the tick still there for
a wrong or abandoned answer. The auto-submit is an exact *string* match, and the
tick grades numerically - so a child who types `07` for 7 is not auto-advanced
but is still marked right when they check. That difference is exactly why the
tick stays rather than being replaced by the auto-submit.

**A wrong answer flashes the box red, plays the wrong sound, and moves straight
on.** Nothing is shown about what it should have been: ninety seconds is not
teaching time, and a correction nobody has time to read is only a delay - paid
most often by the child getting the most wrong. The misses are kept in browser
state and shown on the result screen, which is where there is time.

Right and wrong sounds play per answer, the same two the play screen uses. The
shim rewinds rather than stacks, so twenty-five of them in ninety seconds never
overlap, and with the red flash being the only other feedback the sound is doing
real work.

A physical keyboard works throughout, as it does on the play screen - a parent
running this on a laptop is a keyboard player, and so is an older child.

Leaving mid-run records nothing. There is no confirmation: a modal over a
running clock is worse than the mis-tap it prevents, and the door sits in the
corner furthest from the pad.

### The result screen

Full-screen (`fixed inset-0`), so it escapes whatever frame it was started from.

- **The score, large**, and beside it the best. A run that beats a previous best
  gets the loud treatment - the fanfare and the full-cover celebration that
  `RoundReward` established, because a player already knows what that screen and
  that sound mean and this is the same kind of event, only bigger.
- **A first run on a mode is not a record**, by the decision above, so it says
  *"23 right - that's your score to beat"*. Honest rather than flat: there is
  genuinely nothing to have beaten, and inventing a celebration for it is what
  would make every later one worth less.
- **The ones they missed** - prompt, what they answered, what it was. The
  teaching the run itself had no time for.
- **See records / Try again / Go home.** Try again restarts in place. Go home
  goes to `/` for a child and `/progress` for a parent, so the destination is a
  prop rather than a hardcoded route.

### `/speed/records` - the cabinet

Every mode grouped by operation, with the best and the date it was set. Modes
never run are shown greyed with a dash, so there is visibly something to go
after rather than a short list of what has already been done.

### The parent's report

`/progress` gains two things:

- **A dismissible banner** at the top when a child has an unseen record:
  *"Shanaaya scored her personal best in the 4 times table: 20 questions in 90
  seconds!"* Dismissing marks every unseen record for that child seen, so one
  tap clears one child rather than one achievement.
- **A `Speed runs` well** listing that child's best per mode - the same panel
  treatment every other section of the report gets, so the numbers survive the
  dismissal.

**A banner reports someone else's achievement, never your own.** A parent who
sets their own record gets no banner - they were there. `seen` only ever gates
records belonging to that parent's children.

## The parent plays too

A parent is an ordinary `User` row, so `SpeedRecord` works for them with no
change at all - the same way `LearningSession` and `Attempt` work on a managed
child. Their records are private: nothing reads across accounts.

Their way in is a **third item in `ParentShell`'s nav**, beside Progress and
Children. The shell already carries the nav, so this is one entry.

**Scale splits for two screens only.** The chooser and the records page take a
`scale` prop - the precedent is `select.tsx`, which comes in `lg` for a child's
screens and `sm`/`md` for a parent's. So there are two thin route trees:

```
src/app/speed/[op]/page.tsx              child
src/app/speed/records/page.tsx           child
src/app/(parent)/speed/[op]/page.tsx     parent - shell comes from the layout
src/app/(parent)/speed/records/page.tsx  parent
src/app/speed/actions.ts                 shared server actions
```

The parent's pages live inside the `(parent)` route group so `ParentShell` stays
a layout rather than something a page draws by hand. Both trees render the same
components at different scales.

**The run screen itself is one screen for everybody.** A ninety-second timed
game is not a report, and there is no version of it that should be denser
because an adult is playing. It renders `fixed inset-0`, escaping the parent
frame the way `RoundReward` already escapes the play screen, so one component
serves both.

## Signed out, and without a database

A run plays normally and records nothing, which is how the rest of the app
behaves without `DATABASE_URL`. The chooser shows no bests, the result screen
shows the score with nothing beside it, and the records page says there is
nowhere to keep them. Nothing is broken and nothing lies.

## Testing

Everything above the database is pure and gets tests.

**`modes.test.ts`**
- Every one of the 27 modes has a key that `parseMode` round-trips, and
  `parseMode` returns null for junk, for a table outside 2-12, and for a
  difficulty on multiplication.
- Every mode's specs pass `validateSpec` and generate a question - the same
  proof `catalog.test.ts` requires of shipped content.
- 200 seeded draws per mode assert the band actually holds: no negative
  subtraction anywhere, division exact in every draw, every multiplication draw
  has a factor inside the chosen table set, `add.hard` always carries,
  `subtract.hard` always borrows, and every answer is a non-negative integer the
  number pad can enter.
- A mixed mode draws all four operations across enough draws.

**`run.test.ts`**
- The lookahead: `current` and `next` are both populated from the start, and
  answering promotes `next` and draws a new one.
- Scoring counts right answers and keeps the misses with what was expected.
- `answerRun` past `SPEED_RUN_MS` does not change the score.
- A mode with few distinct questions (`multiply.2`) never hangs and never puts
  the same prompt in both slots.
- The run is deterministic from its seed.

**`records.test.ts`** - `isRecord` for a first run, a beat, a tie and a worse
run.

**Component tests** follow the existing convention for the pieces with logic in
them: the timer's pulse thresholds and the result screen's three states (first
run, beaten, not beaten).

The database writes in `speed-records.ts` are untested by the convention
`records.ts` already sets - which is exactly why all of the arithmetic lives in
`speedrun/` and none of it in a query.

Then `npm test` and `npm run typecheck`, as always before pushing.
