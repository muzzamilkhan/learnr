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
src/lib/expr/       safe expression language (tokenize → parse → evaluate)
src/lib/templates/  question templates: types, generation, validation
src/lib/session/    session state machine and grading
src/lib/rng.ts      seeded PRNG
src/content/        the shipped course content + catalog lookups
src/components/     UI
src/app/            routes and server actions
```

- `src/lib/expr` is a small Pratt-parsed expression language. It exists because
  templates are authored **outside the app by AI** and are therefore untrusted —
  `eval` is not an option. Variable and function lookups use `Object.hasOwn` on
  null-prototype tables so `constructor`/`__proto__` can't resolve to anything.
- Randomness is always injected (`Rng`), never called directly in engine code, so
  every test is deterministic and any session can be replayed from its seed.
- Session state is immutable: `submitAnswer` returns a new state.

## Question templates

A template is data. The engine binds variables, checks constraints, then renders.

```ts
{
  id: 'maths.subtraction.difference',
  subject: 'maths', category: 'subtraction', level: 3,
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
  `distractors` and a `jitter` fallback.

Expression language: `+ - * / % ^`, comparisons, `&& || !`, ternary, string
literals, and `abs min max floor ceil round trunc sign sqrt pow mod gcd lcm isInt
isEven isOdd`.

**Always run new templates through `validateTemplate` before importing them.** It
catches unbound variables, out-of-order references, malformed expressions and
unsatisfiable constraints, and then proves the template can actually generate. The
test in `src/content/catalog.test.ts` validates everything shipped and asserts no
question ever asks a child for a negative or fractional answer.

## Sessions

A session never ends. The child picks subject + level and answers until they stop;
templates are drawn at random from the pool for that level. The header shows a
count-up timer only — no limits or targets yet.

Every answer is recorded (`Attempt`: template, category, level, time taken,
correct/incorrect, the response as typed). **Nothing reads these rows yet.** They
exist so a later pass can prioritise weak areas. Don't build scoring or adaptive
question selection on them until that's the actual task.

Recording is best-effort and must never block or interrupt play: writes go through
server actions that swallow failures. `learningSessionId` round-trips through the
client, so every write verifies the session belongs to the signed-in user first.

## UI

Standard iPad, landscape and portrait. Minimal and calm rather than playful —
simple enough for a child to pick up with no explanation.

- **The play screen must fit the viewport with no scrolling.** It's `h-[100dvh]`
  with `overflow-hidden`; the number pad is fixed-height and the question area
  flexes. Check both orientations after changing that layout.
- Answers use the on-screen number pad, not the iPad keyboard — it keeps the
  question visible and the targets large and fixed.
- Colours are CSS variables in `globals.css`, used as `text-(--color-ink)`.
- Wrong answers show the correct one and move on. Nothing is punitive; there are
  no streaks, scores or timers-per-question.

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
