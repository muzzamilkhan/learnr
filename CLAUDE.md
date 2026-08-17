# LearnR

A learning web app for children. Next.js (App Router) on Vercel, Google sign-in,
designed for a standard iPad. Maths is the only subject so far.

## Commands

```bash
npm run dev         # dev server
npm test            # vitest, run once
npm run test:watch  # vitest, watch
npm run typecheck   # tsc --noEmit
npm run build       # production build
npm run db:migrate  # prisma migrate dev
npm run db:deploy   # prisma migrate deploy, skipped without a database
npm run db:studio   # browse the data
```

`npm run build` runs `db:deploy` first, so a deploy applies its own migrations.
Without `DATABASE_URL` (or with the placeholder from `.env.example`) that step
prints a line and succeeds — a build must not be the one thing insisting on
Postgres when the app itself plays fine without it.

Run `npm test` and `npm run typecheck` before pushing.

## Architecture

**All logic lives in `src/lib` as pure functions.** Nothing in there touches React,
the network, the clock or the database — callers pass in `now` and an RNG. This is
the rule that keeps the app testable; don't break it for convenience.

```
src/lib/expr/        safe expression language (tokenize → parse → evaluate)
src/lib/templates/   question templates: types, generation, validation
src/lib/session/     session state machine and grading
src/lib/analytics/   the learner profile, and the report written from it
src/lib/reinforcement/ which question to ask next
src/lib/rewards/     stars for a round, and the day streak
src/lib/curriculum.ts school years, labels and ordering
src/lib/day.ts       which local day a moment falls in
src/lib/rng.ts       seeded PRNG
src/content/         the shipped course content + catalog lookups
src/components/      UI
src/app/             routes and server actions
```

- `src/lib/expr` is a small Pratt-parsed expression language. It exists because
  templates are authored **outside the app by AI** and are therefore untrusted —
  `eval` is not an option. Variable and function lookups use `Object.hasOwn` on
  null-prototype tables so `constructor`/`__proto__` can't resolve to anything.
- Randomness is always injected (`Rng`), never called directly in engine code, so
  every test is deterministic and any session can be replayed from its seed.
- Session state is immutable: `submitAnswer` returns a new state.

## Levels and topics

**Levels are Australian school years**: `'K'` then `'1'` to `'6'`, as strings —
primary school is the whole scope. Never an integer: `'K'` has to sort first, and
strings keep the door open for years beyond single digits if the scope ever
widens. Use `compareYearLevels` to sort, `yearLabel` to display
("Kindergarten", "Year 3"), and `parseYearLevel` at every boundary (URLs,
imported files) — it normalises `'k'` and `'03'` and returns null for anything
else.

**A topic is what a question practises** ("counting numbers", "even and odd").

**Levels and topics are many-to-many, and neither owns the other.** A year offers
several topics; a topic recurs across years, harder each time. Counting numbers
runs from Kindergarten into Year 1; even and odd from Kindergarten into Year 2.
The pairing lives on the template — one year, one topic — so the curriculum is
*derived from content*, not declared. Adding a Year 4 division template is all it
takes to put division into Year 4.

Walk it from either end: `topicsForLevel(subject, level)` and
`levelsForTopic(subject, topic)`. Don't add a level→topics table; it would go
stale against the templates that are the actual source of truth.

## Question templates

A template is data. The engine binds variables, checks constraints, then renders.

```ts
{
  id: 'maths.1.subtraction.difference',
  subject: 'maths', topic: 'subtraction', level: '1',
  prompt: 'What is the difference between {x} and {y}?',
  vars: [
    { name: 'x', kind: 'int', min: '5', max: '20' },
    { name: 'y', kind: 'int', min: '1', max: '19' },
  ],
  constraints: ['x > y'],
  answer: 'x - y',
  hint: 'Count back from {x} until you reach {y}.',
}
```

Design rules that keep this flexible:

- **Every numeric field is an expression string**, not a number. So `max: 'x - 1'`
  works, and bounds can depend on variables bound earlier in the list.
- **`vars` is ordered.** A variable may only reference ones declared before it.
- **Constraints are arbitrary boolean expressions** over the bound variables,
  satisfied by rejection sampling (200 attempts, then a descriptive throw).
- **`{...}` holes in `prompt`/`hint` take any expression**, e.g. `{x + 1}`.
- Variable kinds: `int`, `number` (decimals), `pick` (from a list, optionally
  weighted), `expr` (derived, never random).
- Optional `choices` turns a template into multiple choice, with authored
  `distractors` and a `jitter` fallback. **At most 4 options** (`MAX_CHOICES`) —
  more than that stops being thumb-sized on an iPad.
- **`answerType` is inferred from what `answer` evaluates to** and rarely needs
  declaring: a boolean gives `boolean` (true/false), a number gives `number`,
  anything else gives `text`. Declare it only for `choice`, or for a numeric
  answer you want typed as text.
- A boolean answer makes it a true/false question whatever the template says, and
  `choices` alongside one are meaningless — the play screen draws its own two
  buttons. `validateTemplate` rejects that pairing.
- **Authoring mistakes are reported by `validateTemplate`, never thrown by
  `generateQuestion`.** Generation runs mid-session with a child waiting, so it
  degrades instead: a disagreeing `answerType` is overridden, choices on a
  true/false template are dropped, and more than `MAX_CHOICES` options are
  clamped. That is exactly why content must be validated before it ships.

Expression language: `+ - * / % ^`, comparisons, `&& || !`, ternary, string
literals, and `abs min max floor ceil round trunc sign sqrt pow mod gcd lcm isInt
isEven isOdd`.

Template ids follow `subject.level.topic.variant`, e.g.
`maths.2.even-and-odd.next-odd`.

**Always run new templates through `validateTemplate` before importing them.** It
catches unbound variables, out-of-order references, malformed expressions, levels
that aren't school years, and unsatisfiable constraints, then proves the template
can actually generate. `src/content/catalog.test.ts` validates everything shipped
and checks the rest of what makes content usable: an id shaped
`subject.level.topic.variant`, a curriculum content description in `tags`, at
least 20 templates per year, and no typed answer the number pad cannot enter.

Content ships for K–6, 200 templates, written against ACARA's *Mathematics: Scope
and sequence F–10 (v9.0)*. Every template cites the content description it
practises (e.g. `AC9M4N02`) in `tags`, so the curriculum link is checkable rather
than claimed.

All four answer types render, so any of them is safe to author. **Pick the type
the pad can express**:

| `answerType` | how it is answered | what it can express |
| --- | --- | --- |
| `number` | number pad, then Check | digits and one decimal point — **no minus key** |
| `text` | on-screen A–Z pad, then Check | letters only, no spaces or digits, ≤ 16 chars |
| `boolean` | two buttons, True / False | one tap answers |
| `choice` | 2–4 buttons | one tap answers; anything the other types cannot express |

A negative answer has to be multiple choice, because the pad has no minus key —
that is why the Year 6 integer questions are `choice`. A distractor a child would
find nonsensical is still bad content, so keep them plausible.

**`text` is a last resort, and never below Year 4.** A word answer makes the child
spell before they can answer, which tests literacy rather than maths — a
Kindergartener knows a triangle long before they can spell it. Word answers in K–3
are `choice` instead, and `catalog.test.ts` enforces that. Any answer drawn from a
small closed set ("red or blue?", "metres or centimetres?") is a `choice` question
at any level; a two-option `choices` with both literals as distractors is the
usual shape.

## Sessions

A session never ends. The child picks subject + year and answers until they stop;
templates are drawn from the pool for that year, across all of its topics, with
the reinforcement selector deciding which. **The header counts nothing**: no
clock and no right-so-far tally, only the way out (a door icon, drawn for the
same reason the Check key is a tick) and the profile menu. Both were things
a child would watch instead of the question, and neither is theirs to worry
about — the round's stars are the only reckoning, and they come between
questions.

Every answer is recorded (`Attempt`: template, topic, level, time taken,
correct/incorrect, the response as typed, and the UTC offset it was given at) and
folded into that child's `TopicSkill` for the topic. Attempts are the history; the
skill row is that history rolled forward, and a cache of it — never a second
truth, so `buildProfile` over the attempts has to reproduce the row.

Keeping that true costs a **row lock**: `updateTopicSkill` reads with
`SELECT ... FOR UPDATE` inside a transaction, so answers landing at once queue up
and each folds onto the one before. Two tabs will do it, and so will one child
answering faster than the round trip. The lock is there rather than a merge in SQL
so `nextSkill` stays the only place the arithmetic is written down. The row cannot
be locked before it exists, so the first answer on a topic can still collide on
insert — hence the retry, and one time round is enough.

**Time taken is capped** (`MAX_TIME_MS`) before it is recorded. An abandoned
question — the iPad put down and picked up after dinner — is not a measurement,
and the total is per topic and never trimmed, so one of them would otherwise sit
in that topic's average for good. That average is what a parent is shown.

Recording is best-effort and must never block or interrupt play: writes go through
server actions that swallow failures. `learningSessionId` round-trips through the
client, so every write verifies the session belongs to the signed-in user first.

## Reinforcement and analytics

Two libraries over one model. `src/lib/analytics/profile.ts` folds attempts into a
`LearnerProfile` — per topic and level: attempts, correct, a recency-weighted
`strength`, the current `streak`, the separate days it has been got right on
(`correctDays`) and when it was last answered.
`src/lib/reinforcement/select.ts` reads that profile to pick the next template;
`src/lib/analytics/report.ts` reads the same history to say where a child needs
help. Neither owns the other, and both are pure — `now` and the RNG are passed in.

The profile is built by folding, one answer at a time (`nextSkill`), so the same
arithmetic serves the stored `TopicSkill` row and the in-session profile that
updates as the child plays. That is why a topic falling apart in the first ten
questions is being mixed in more heavily by the twentieth.

**Status is what everything keys off** (`skillStatus`), and it refuses to guess:
under `MIN_OBSERVATIONS` answers a topic is `new`, never a weakness. Then
`struggling` (strength under 0.6), `developing`, `secure` and `review-due` —
secure, but left alone long enough to be worth confirming.

**The two bars are not the same height, deliberately.** Calling a topic hard costs
a few extra questions on something the child can do, so `MIN_OBSERVATIONS` is
enough for it. Calling a topic *known* is the expensive mistake — it drops the
topic to a fraction of the questions and puts it away for days — so it needs a
strong run *and* `SECURE_OBSERVATIONS` answers *and* right answers on
`SECURE_DAYS` separate days. A run inside one sitting is one memory answering
several times; the answer that survives a night's sleep is the one that means
something, and it is the only thing allowed to count as mastery.

The review gap then grows with `correctDays`, not with the streak: a couple of
days for something just learned, a month for something known five times over. A
streak can reach any length in ten minutes, so intervals key off the number of
times a child has *come back* and still known it. Coming back *after* it has
started to fade is the point.

Days are the child's, not the server's: each attempt carries the UTC offset it was
given at, so an evening's practice in Sydney counts as that evening. `correctDays`
only ever counts a day later than the last one counted, so answers arriving out of
order undercount rather than inflate — mastery is delayed, never faked.

Selection rules, in order — all three matter, and none of them ever rules a
template out entirely:

- **No pattern, no steering.** Until one topic has `MIN_OBSERVATIONS` answers the
  weights are flat and questions are drawn at random, exactly as before.
- **Weight by status**, so hard topics come up more and mastered ones get out of
  the way without disappearing — a child should still get things right.
- **Weight the topic, not the template.** A topic's weight is divided across
  however many templates it has, because template count is a fact about how much
  content got written and must never decide how much practice a child gets. Years
  ship with between one and five templates a topic; without this a struggling
  topic with one template came up less often than an unproven topic with four.
- **Hold weak topics to a share of the session** (`MIN_FOCUS_SHARE` to
  `MAX_FOCUS_SHARE`). Prioritised, not swarmed: a fifth of the questions is enough
  to improve, and past a bit under half it stops being practice and starts being
  picked on. The floor is skipped when the only topic needing work is the one just
  asked.
- **Cool down what was just asked**, so the mix is spread through the session
  rather than clumped.

`weightTemplates` is exported because it *is* the policy — read it in a test, or
to explain a choice later. Tests assert shares over a few hundred seeded draws
rather than exact sequences; the RNG is deterministic, so they don't flake.

**Selection is driven by correctness alone — time taken is reported, never acted
on.** It is tempting signal: fast and right is fluency, slow and right is working
it out. But slow is also distracted, or asking a parent, and one number cannot
tell those apart. Marking a child down for being slow is exactly the punitive
thing this app does not do. If that changes, the honest version is to gate
*mastery* on fluency — a slow correct answer still counts as correct but does not
advance a topic towards `secure` — never to weight a topic up for slowness.

The analytics side is a library only: `topicReports`, `problemTopics`,
`dueForReview`, `progressOverTime` and `summarise`. `/progress` is the screen that
consumes them — see **Parent analytics** below. Buckets take a UTC offset from the
caller so a Sydney evening's practice doesn't land on the next day.

## UI

Standard iPad, landscape and portrait. Minimal and calm rather than playful —
simple enough for a child to pick up with no explanation.

- **Level is the home screen's top-level choice**: one dropdown labelled "Level",
  then the subjects offering that level below it, each card listing its topics as
  text. Switching level swaps the cards in place — no navigation. The choice is
  remembered on `User.selectedLevel` and the screen reopens on it; signed out or
  without a database there is nowhere to keep it, so it opens on Kindergarten.
  `resolveInitialLevel` falls back when a stored level has lost its content.
- **The play screen must fit the viewport with no scrolling.** It's `h-[100dvh]`
  with `overflow-hidden`; the answer pad is fixed-height and the question area
  flexes. Check both orientations after changing that layout, and check a phone
  as well as an iPad — a phone is where it runs out of height first.
- **Height, not width, is what the play screen is short of.** The pad takes about
  40% of a phone and 43% of an iPad, and the question is sized in `vh` rather than
  by breakpoint, stepping down again for a long prompt (`promptSize`). Sizing the
  question by width alone let a wordy Year 6 prompt push up under the header.
- **Every answer is given on-screen, never with the iPad keyboard** — it keeps the
  question visible and the targets large and fixed. `answerMode` in
  `src/lib/session/answers.ts` decides which pad a question gets (`NumberPad`,
  `LetterPad` or `ChoicePad`); all three occupy the same fixed slot.
- Tapped answers (choice, true/false) commit on the first touch, with no Check
  button — there is nothing for a child to review. Typed answers keep a Check
  key, drawn as a tick (`CheckIcon`) rather than the word, so a child who cannot
  read yet still knows it.
- After a wrong tap, the right option turns green and the child's turns red, so
  they always see which one was right.
- **A right answer moves on by itself after a moment; a wrong one waits.** The
  pad gives way to a Continue button and the right answer stays on screen until
  the child taps it, so nothing is missed by being slow to read. Tapped
  questions keep their pad while waiting — the buttons are what shows which
  option was right — and Continue sits beneath them.
- **A template's `hint` sits behind a lightbulb** under the question, so help is
  asked for rather than pushed — a child who doesn't want the method isn't given
  it. Tapping swaps the bulb for the hint; it resets with each question, and goes
  once the question is answered. Templates without a hint just leave the row
  empty, which keeps the question from jumping.
- **The rewards are a break and a badge, never a running score.** The stars fill
  the screen for a few seconds between rounds and the streak flashes once a day;
  neither sits on the play screen where a child could watch it and worry. There
  is no per-question timer and nothing a wrong answer takes away.
- Colours are CSS variables in `globals.css`, used as `text-(--color-ink)`.
- **There are no native `<select>`s.** A `<select>`'s popup is drawn by the OS —
  system font, system blue, its own rounding — so it is the one control the theme
  cannot reach, and on an iPad it lands a grey widget in the middle of a screen
  built from `--color-*`. `src/components/select.tsx` is a button plus a listbox
  with the same look as everything beside it, and options sized for a thumb.
  It comes in `lg` for the child's screens and `sm`/`md` for a parent's, matching
  the two scales above. The trigger is sized to its **widest** option rather than
  its current one — every label renders into one grid cell with all but the chosen
  one hidden — so picking "Year 3" after "Kindergarten" doesn't shrink the control
  and shift what sits beside it. It closes on an outside pointerdown or Escape,
  never on blur: a tap on an option moves focus off the button first, and closing
  there would remove the option before the tap could land on it.
- **Three sounds, and only on the play screen**: right, wrong, and a fanfare with
  the stars. `src/components/sounds.ts` is the shim — it lives beside the
  components, not in `src/lib`, because it touches `Audio` and could never be
  pure. Playing is best-effort like recording an answer: a silent switch or an
  autoplay refusal rejects the `play()` promise, and that is caught and dropped
  rather than thrown into the middle of a question. One element per sound,
  rewound rather than stacked — a child can answer faster than a clip finishes,
  and the newest answer is the one worth hearing. The files are preloaded when
  the screen mounts, since iOS gates *playback* on a gesture but not loading.
- **The fanfare is the same for one star as for three.** Finishing the round is
  what it marks; a thinner sound for a hard round would undo what the star floor
  is for.
- `public/sounds/*.m4a` — mono AAC at 48 kb/s, silence trimmed and peaks levelled
  so the three sit at the same loudness. About 5–13 KB each, from 300 KB+
  originals. AAC in `.m4a` rather than Opus because iPad Safari is the target and
  it plays this everywhere, with no fallback source to maintain.

## The logo

`public/logo.PNG` is the artwork as delivered — the badge, the wordmark and the
tagline, drawn on a white page. Everything else is cut from it and committed
beside it, so the derived files are the ones the app loads and the original stays
the thing to re-cut from:

- `public/logo-mark.png` — the badge alone, for headers.
- `public/logo-lockup.png` — the whole thing, for the landing hero.
- `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`,
  `src/app/opengraph-image.png` — Next wires these up by filename, so the only
  thing `layout.tsx` adds is a `metadataBase` for their absolute URLs.

**The white page is flood-filled to transparency from the edges inwards**, not
keyed off luminance: the white *inside* the mark — the book's pages, the pencil's
eyes, the sparkles — has to survive, and only a fill that starts at the border
leaves it alone. Without it the mark would sit on `--color-paper` as a faintly
paler square, `#ffffff` against `#f7f9fc`. The apple icon is the one that keeps
an opaque background, because iOS composites its own rounded mask over a square
and a transparent one comes out black.

**The mark alone is what goes in a header**, since the word "LearnR" is already
there in type beside it; the lockup carries its own wordmark and tagline, so it
is only used where nothing else is saying what this is.

**Not on the play screen.** That screen is one question at arm's length with
nothing else to look at, and a logo in the corner is exactly the sort of thing a
child watches instead of the question — the same reason the header counts no time
and no score.

## Rewards

`src/lib/rewards` — pure, like the rest of `lib`, and read by nothing that
decides what to ask next. Reinforcement is driven by the profile alone; stars and
streaks would make it reward-seeking rather than teaching.

**Stars come every `ROUND_SIZE` (10) questions**: 3 for a clean round, 2 for some
right, 1 for a round with none. The floor is the point — sitting through ten hard
questions is the behaviour worth rewarding, so a bad round still earns something,
and 3 stays worth aiming at. `RoundReward` covers the screen for a few seconds,
dismissable by a tap, and the next question's clock restarts when it goes so the
break never lands in that question's recorded time.

Stars are cached on `LearningSession.stars` and totalled with one `SUM`, but they
are still derived: `starsEarned` over a sitting's answers reproduces the column.
The server **recounts from the stored answers** — the client says only *that* a
round closed — and it **sets rather than increments**, so a repeated call is
harmless and a dropped one repairs itself at the next round. It is banked after
the tenth answer's write resolves; racing it would find nine answers and award
nothing.

**The play streak counts days, not hours.** `User.playStreak` and
`User.playStreakDay` — a day number, not a timestamp, because a day here is the
child's (`src/lib/day.ts`) and a timestamp would need the offset re-applied at
every read. A missed day restarts at 1, not 0: the child is answering right now.
The write is a compare-and-set on the stored day, so two answers landing together
advance it once. `currentStreak` decides whether a stored run is still alive —
yesterday still counts, the day before does not — and it is computed in the
browser via `useSyncExternalStore`, since only the child's device knows what day
it is where they are.

An hours rule was considered and rejected: practice after school one day and
before school the next is twenty hours apart and would break a streak the child
kept perfectly well.

**Both totals ride on the profile menu** — the run of days, then the stars, then
the avatar, the same control on the home screen and the play screen so a child
never looks in two places for the two numbers. Days sit left of the stars: the
run is the thing that lapses if they stop. Behind the tap there is only the name
and the way out.

Both are drawn through `formatCount` (`src/lib/format.ts`), which pins `en-AU`
rather than reading the browser's locale — the totals are rendered on the server
and corrected on the client, and a locale that disagrees across that boundary is
a hydration mismatch. A star total has no ceiling, and "1,204" is a number to be
pleased about where "1204" is one to decipher.

Neither is a score. The star total only ever goes up, a whole round at a time,
and nothing a wrong answer does takes anything off either of them. A lapsed run
renders as nothing rather than a zero — a 0 beside a flame reads as a
telling-off, and the child is here to start a new one. The play screen still
flashes the streak once (`StreakFlash`) on the answer that extends it.

## Accounts

There are two kinds of account, chosen once and then permanent. On first sign-in
a user picks **parent** or **child** (`User.role`, null until they choose). The
choice is a compare-and-set on `role IS NULL`, so it cannot be replayed into a
change; every account that predates the column meets the chooser on its next
sign-in, which is why the migration deliberately backfills nothing. A person is a
better source for this than a heuristic over their data.

A **parent does not play**, so they get neither the level picker nor a subject
card. They get two screens instead, and **the report is the one they land on**:
setting a profile up happens once, reading how a child is going happens every
week, so `/` **redirects a parent to `/progress`** rather than rebuilding the
report there. Only a parent with no children yet gets a screen at `/`: a sentence
and an "Add a child" button pointing at the other screen. A failed read is not
"no children" and is not redirected — it says so and stays put.

`/children` is that other screen: a card per child with name, avatar and level,
plus add, edit, remove and the login code. It does not link to the report: the
nav above it already goes there and the report picks its own child, so a second
way in was a button per card saying what one dropdown already says. Both screens sit in
`ParentShell`, which carries the title, the two-item nav between them, the
profile menu and the curriculum link — the last of which follows every signed-in
branch, a parent's included, because it is the one thing they would actually want
to read. That link is a panel rather than a footnote: a line of small print under
a page of boxed sections is the shape of something nobody is meant to click.

**The shell is a layout, not something each page draws.** Both screens live in
the `src/app/(parent)` route group and `layout.tsx` renders `ParentShell` around
them, so hopping between the report and the profiles replaces only what differs:
the logo, the profile menu and the nav stay mounted rather than being torn down
and rebuilt, which is what made the hop flicker. A layout is never told which
page it is wrapping, so the two things that vary — the title and which nav item
is current — read the URL from the client (`ParentHeading`, `ParentNav`), and
`resolveChild` picks the child the `?child=` parameter names so the heading and
the report can't disagree about who is on screen. The layout is a frame and not
a gate: it does not re-run on a client-side hop, so `readParent` — which is
where the sign-in and parent-role checks live — is called by the pages too, and
`cache`d so the two calls in one request are one query.

**Edit and remove are glyphs on the child card; the code button keeps its
words.** The first two are on every card, say the same thing on every card, and
were pushing the one a parent actually came for onto a second row on a narrow
screen. The label they lose moves to `aria-label` and `title` — it is off the
screen, not off the page — and the buttons stay the same height as the ones
beside them so the row still lines up. Remove is a bin rather than a cross: a
cross on a card reads as "close this", and dismissing the row is the one thing
that button must not be mistaken for.

**Removing a child is confirmed in the card, never with `confirm()`.** The
browser dialog is unstyled, unreadable on an iPad, and — being synchronous — the
one thing on that screen that can freeze it. It also cannot say what is being
lost, which is the only reason to ask: the row cascades, so the confirmation
names the child and says the answers, progress and login code go with them.

**Parent screens are not built to the child's scale.** The play and level screens
are sized for a six-year-old holding an iPad at arm's length; a parent is reading
a report on a laptop, and blowing that up only means more scrolling and less on
screen. So `ParentShell` and everything under it run denser: `text-sm`/`text-base`
body, single-width borders, `rounded-xl`, `px-3 py-1.5` buttons. The one
exception is the login code itself, which is still drawn large — it is read off
this screen by eye and typed into another device.

A **managed child** is a `User` row with `parentId` set, no email and no
`Account` row — nothing OAuth about it. Because it is an ordinary user row,
`LearningSession`, `Attempt`, `TopicSkill`, `records.ts` and the play actions all
work on it unchanged. `parentId` is the only flag that matters downstream: it is
what fixes the level. A managed child gets `SubjectCards` for their
`selectedLevel` with no dropdown, and `/play` **redirects** a mismatched `level`
parameter back to theirs — hiding the dropdown while leaving a typed URL open
would not be enforcing anything.

A child who signs in with their own Google account (`role: 'child'`,
`parentId: null`) behaves exactly as before, dropdown and all.

**Signed out, both ways in live in the landing page's top bar as peers** — a
grown-up signs in with Google, a child types their code, and neither is the
fallback for the other. On a phone there is no room to say that side by side:
four characters read off another screen have a floor on how small they get, so
below `sm` the pair goes behind one "Get started" button and opens as a panel
underneath, where each gets a full row and a line of copy saying whose it is.
`GetStarted` renders them **once** and re-lays them out in CSS — `sm:contents`
dissolves the wrapper at the wider size — rather than shipping a phone copy and
a desktop copy of the code box, which is how the two would drift apart.

**Login codes.** A parent generates a 4-character code
(`src/lib/login-code.ts`) that a child types on the sign-in screen. The charset
excludes `0/O` and `1/I/L` — a code is read off one screen and typed into
another, so the pairs that get confused in that handoff are not in the alphabet.
Randomness is injected, as everywhere in `src/lib`, but the caller must pass
`crypto.randomInt` and **not** the seeded `Rng`: replayability is exactly the
property a login code must not have.

**The short-lived thing is the code, not the login.** A code lasts an hour and is
spent at redemption — `UPDATE ... RETURNING` clears it and identifies its owner in
one statement, so two taps arriving together cannot both get a session, and
issuing a new code invalidates the old one by overwriting it. The session it
creates then does not expire on a schedule. Those are two halves of one decision:
the window protects the handoff from parent to child, and once the child is in
they stay in. Being locked out of a maths app mid-term and having to find a parent
to get back in is the friction this feature exists to remove. `Session.expires` is
not nullable, so "does not expire" is spelled as a date far enough out never to
arrive.

**Showing a code and issuing one are different actions**, and the child card
keeps them apart. One button carries three states: "Get code" when there is no
live code, "Show code" when there is one (revealing what is already stored — a
child may be halfway through typing it, and re-issuing here would break the code
in their hand), and "Hide code" once it is on screen. Regenerating is its own
button under the revealed code. That code is centred in its panel with a copy
button right beside the digits, since copying is the other way it reaches the
child's device — read aloud across a room, or pasted into a message. The copy
turns into a tick for a moment: a clipboard write is otherwise invisible, and a
button that looks unchanged gets tapped twice. The write is best-effort like
playing a sound — an insecure context rejects it, and a code still sitting on
screen to be typed is not worth throwing over.

`isCodeLive` is the pure test that picks between the first two states, and the
hour is counted down in an effect rather than at render — reading the clock
while rendering is not something a component gets to do.

Redemption is **not** a NextAuth provider. Auth.js refuses to combine a
Credentials provider with database sessions (`UnsupportedStrategy`), and moving
the app to JWT sessions to get around that would cost server-side session state
for nothing. Instead `redeemLoginCode` writes the same `Session` row the Prisma
adapter would and the action sets the same cookie — `auth()` cannot tell the two
paths apart. That only works if both agree on the cookie, so `auth.ts` pins
`SESSION_COOKIE_NAME`/`SESSION_COOKIE_OPTIONS` explicitly rather than leaving
Auth.js to switch the `__Secure-` prefix implicitly, and exports them.

`src/lib/accounts.ts` holds the Prisma side, following `records.ts`: every child
mutation scopes its `where` by `parentId` as well as `id`, because the child id
round-trips through the browser. Unlike `records.ts` these are **not**
best-effort — a silently failed answer costs history and the child plays on, but
a silently failed login is a child locked out and a silently failed removal is a
parent lied to, so the mutations report whether they worked.

## Parent analytics

`/progress?child=<id>&subject=maths` — a parent picks a child and sees how they
are going. It reads and renders; nothing on it writes. It is also **where a
parent lands**, since `/` redirects them here as soon as they have one child —
see **Accounts** above.

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
counts, and the `now` it runs on is read once, at the request boundary —
`requestNow()` in `src/app/progress/now.ts`, rather than a bare `Date.now()` in
the component, which `react-hooks/purity` flags as impure. `strengths` mirrors
`problemTopics`, ordered by `correctDays` because that is the evidence that means
something; it excludes `review-due` so no topic appears in two sections at once.

Two framing decisions the copy depends on. The tile says **"time on questions"**,
not "minutes spent": it is summed `timeTakenMs`, already capped per answer, so
it can't be inflated by an iPad left on the sofa — and it undercounts, which the
label has to be honest about. And a line under the tiles explains that **around
three in four right is the system working**; the selector mixes hard topics in
deliberately, and without that line a parent reads 76% as a C.

`recharts` draws the topic bars and is the project's only UI dependency. Height
is questions and the fill is correct answers; the remainder is line grey rather
than `--color-wrong`, because it is "the rest of the questions" and not a column
of failures. **Its labels are turned on their side**: a topic name is several
words and a year's worth of topics puts a dozen bars across a panel, so flat
labels collided however they were wrapped. Vertical they cannot collide at all,
and what limits them is the height reserved below the axis — one number, the
same for every bar, with anything longer elided (the tooltip still names the
topic in full). The practice calendar is hand-rolled SVG and server-rendered — no
library ships one worth the bytes. It draws **four Monday-to-Sunday weeks**
(`calendarWeeks`), not runs of seven ending today: real weeks are what lets it
carry weekday labels, since a column that is Monday one week and Thursday the
next is not a column. The tail of the current week is `future` and gets **no
square at all** — a Friday nobody has reached and a Friday nobody used must not
look the same, and it is why the count reads "of the last 24 days" rather than
28. It is a CSS grid of seven `1fr` columns rather than an SVG, because the two
axes want different things: the width is whatever the column gives it, the
height is a fixed 14px. One viewBox cannot scale to that without stretching the
corner radii with it.

**Each section of the report is a `Well`** — one bordered panel per question a
parent is asking. Run together as bare headings they read as one long page to
parse; boxed, the boundaries are visible in a skim, which is how a weekly read
actually happens. The three headline tiles are already boxed and stay as they
are, with the "three in four" line as their caption. Inside a well, lists are
`divide-y` rows rather than cards — a card in a well reads as double-boxed.

**Subject is a dropdown, not tabs** (`SubjectPicker`, alongside `ChildPicker`
and URL-backed the same way), and it renders even though maths is the only
subject. A row of one tab is a label pretending to be a control; a dropdown with
one option is honestly a dropdown, and reads the same the day a second subject
ships.

**A parent's profile menu has no stars and no streak.** They don't play, so both
would be counting nothing; `page.tsx` skips those two reads entirely for a
parent rather than reading numbers it won't show.

## Setup

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` — Neon Postgres via the Vercel Marketplace
- `AUTH_SECRET` — `npx auth secret`
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — Google Cloud console, with redirect
  URI `http://localhost:3000/api/auth/callback/google`

Without these the app still runs and plays — auth and recording are skipped
(`isAuthConfigured`, `isDatabaseConfigured`) so the engines and UI stay workable.

Prisma 7: the connection URL lives in `prisma.config.ts`, not the schema, and the
client is generated to `src/generated/prisma` (gitignored) and constructed with the
`@prisma/adapter-pg` driver adapter.

## Working agreements

- TDD, lean tests. Test behaviour through the public function, not internals.
- Work on `master` and push when a piece of work is done. Not a stable release yet.
