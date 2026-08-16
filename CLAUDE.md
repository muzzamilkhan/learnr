# Learnr

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
npm run db:studio   # browse the data
```

Run `npm test` and `npm run typecheck` before pushing.

## Architecture

**All logic lives in `src/lib` as pure functions.** Nothing in there touches React,
the network, the clock or the database — callers pass in `now` and an RNG. This is
the rule that keeps the app testable; don't break it for convenience.

```
src/lib/expr/        safe expression language (tokenize → parse → evaluate)
src/lib/templates/   question templates: types, generation, validation
src/lib/session/     session state machine and grading
src/lib/curriculum.ts school years, labels and ordering
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
templates are drawn at random from the pool for that year, across all of its
topics. The header shows a count-up timer only — no limits or targets yet.

Every answer is recorded (`Attempt`: template, topic, level, time taken,
correct/incorrect, the response as typed). **Nothing reads these rows yet.** They
exist so a later pass can prioritise weak areas. Don't build scoring or adaptive
question selection on them until that's the actual task.

Recording is best-effort and must never block or interrupt play: writes go through
server actions that swallow failures. `learningSessionId` round-trips through the
client, so every write verifies the session belongs to the signed-in user first.

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
  flexes. Check both orientations after changing that layout.
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
- Colours are CSS variables in `globals.css`, used as `text-(--color-ink)`.
- Nothing is punitive; there are no streaks, scores or timers-per-question.

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
- Parent login and controls are a **future** feature. Keep session settings
  configurable, but do not build for it yet.
