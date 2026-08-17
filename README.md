# LearnR

A maths practice app for children, built for a standard iPad.

A child picks a subject and their school year, and answers questions until they
decide to stop. There is no score to chase, no streak to break and no timer per
question — a wrong answer shows the right one and moves on. The session runs on a
count-up clock and ends when the child closes it.

Questions are generated, not stored. Each one comes from a **template** that
declares its variables and an expression for the answer, so a single template
produces an endless supply of questions at the same difficulty. 200 templates
ship, covering Kindergarten to Year 6 of the Australian Curriculum.

## Getting started

```bash
npm install
cp .env.example .env    # see Configuration below
npm run dev
```

Then open <http://localhost:3000>.

**The app plays without any configuration.** Sign-in and progress recording are
skipped when their environment variables are absent (`isAuthConfigured`,
`isDatabaseConfigured`), so the question engine and the play screen work on a
fresh clone. The placeholder connection string in `.env.example` counts as
absent, so copying the file as-is is enough to start.

### Configuration

| Variable | What it is |
| --- | --- |
| `DATABASE_URL` | Neon Postgres, via the Vercel Marketplace. Enables progress recording. |
| `AUTH_SECRET` | Generate with `npx auth secret`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud console, with redirect URI `http://localhost:3000/api/auth/callback/google`. |

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

`npm run build` applies pending migrations first, so a deploy carries its own
schema changes. Without a database configured that step does nothing and
succeeds.

## How it works

Next.js App Router, React 19, Tailwind 4, Prisma 7 against Neon Postgres, Auth.js
with Google sign-in. Deployed on Vercel.

**All the logic lives in `src/lib` as pure functions.** Nothing in there touches
React, the network, the clock or the database — callers pass in `now` and a seeded
RNG. That is what makes the engine testable and lets any session be replayed from
its seed.

```
src/lib/expr/        safe expression language (tokenize -> parse -> evaluate)
src/lib/templates/   question templates: types, generation, validation
src/lib/session/     session state machine, grading, answer input rules
src/lib/analytics/   the learner profile, and the report written from it
src/lib/reinforcement/ which question to ask next
src/lib/curriculum.ts school years, labels and ordering
src/content/         the shipped course content and catalog lookups
src/components/      UI
src/app/             routes and server actions
```

### Templates

A template is data. The engine binds its variables, checks the constraints, then
renders the prompt.

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
  tags: ['AC9M1N04'],
}
```

Every numeric field is an expression string rather than a number, so bounds can
depend on variables bound earlier (`max: 'x - 1'`), constraints are arbitrary
boolean expressions, and `{...}` holes take any expression.

Templates are authored **outside the app, by AI**, which makes them untrusted
input — so `eval` is not an option. `src/lib/expr` is a small Pratt-parsed
expression language written for that reason; variable and function lookups use
`Object.hasOwn` against null-prototype tables, so `constructor` and `__proto__`
resolve to nothing. Run anything new through `validateTemplate` before importing
it: it catches unbound variables, out-of-order references, malformed expressions
and unsatisfiable constraints, then proves the template can actually generate.

### Levels and topics

Levels are Australian school years — `'K'`, then `'1'` to `'6'`. Primary school
is the whole scope. They are always strings, so `'K'` sorts first.

Levels and topics are many-to-many and neither owns the other. A year offers
several topics; a topic recurs across years, harder each time. The pairing lives
on the template, so the curriculum is *derived from* the content rather than
declared alongside it — adding a Year 4 division template is all it takes to put
division into Year 4.

### Answering

Every answer is given on screen. The iPad's own keyboard never opens, which keeps
the question visible and the targets large and fixed.

| Answer type | Input | What it can express |
| --- | --- | --- |
| `number` | number pad | digits and one decimal point — no minus key |
| `text` | on-screen A–Z pad | letters only, up to 16 |
| `boolean` | True / False | one tap answers |
| `choice` | 2–4 buttons | one tap answers; anything the others cannot express |

Every answer is recorded as an `Attempt` — which template, how long it took, and
the response as typed — and folded into the child's skill for that topic.
Recording is best-effort and never blocks play.

### Which question comes next

Questions used to be drawn at random. They still are, until the answers say
something: once a topic has been answered enough times to judge, the selector
weights the pool towards what the child is finding hard.

The model is one `LearnerProfile` — per topic and year: how many answers, how many
right, a recency-weighted `strength`, the current run, and when it was last seen.
It is folded forward one answer at a time, so it updates *during* a session as
well as between them, and the same arithmetic backs the stored row and the played
one.

Three rules keep a lean from becoming a drill:

- **A weak topic is held to a share of the session** — roughly a fifth to a bit
  under half. Enough to improve; not so much that a child who is stuck on counting
  spends an afternoon counting.
- **A topic just asked is cooled down**, so the extra practice is spread through
  the session rather than clumped into a run.
- **Nothing is ever ruled out.** Mastered topics still come up — a child should
  spend some of their time getting things right.

Once a topic is secure it goes quiet, then comes back: a couple of days later for
something just learned, up to a month for something known several times over. The
gap is the point — recall that has had time to fade is the recall worth
practising.

`src/lib/analytics` reads the same history from the other end: which topics need
help, which way each is trending, and practice over time. It is a library only for
now; the screen that shows a parent any of it is still to be designed.

## Curriculum source

The maths questions in LearnR are written against the **Australian Curriculum
Version 9.0 — Mathematics (Foundation to Year 10)**, published by the Australian
Curriculum, Assessment and Reporting Authority (ACARA).

The specific document the Kindergarten to Year 6 content was written from is
ACARA's [Mathematics: Scope and sequence F–10 (v9.0)](https://www.australiancurriculum.edu.au/content/dam/en/curriculum/ac-version-9/downloads/mathematics/mathematics-scope-and-sequence-f-10-v9.docx),
downloaded from the [Australian Curriculum website](https://www.australiancurriculum.edu.au).

Every question template in `src/content/maths.ts` records the content
description it practises in its `tags`, so any question can be traced back to the
curriculum. The codes read as `AC9M` + year + strand + number — for example
`AC9M4N02`, Year 4 Number: *"explain and use the properties of odd and even
numbers"*. Foundation is `F` (Kindergarten in this app), and the strands are `N`
number, `A` algebra, `M` measurement, `SP` space, `ST` statistics and `P`
probability. `src/content/catalog.test.ts` checks that no template ships without
a code.

The app carries this in-product too: **/curriculum**, linked from the home
screen, states the source and attribution and lists every code the shipped
content cites, year by year — read from the templates, so the page cannot drift
from what a child is actually asked.

### Attribution

> © Australian Curriculum, Assessment and Reporting Authority (ACARA) 2010 to
> present, unless otherwise indicated. This material was downloaded from the
> [Australian Curriculum website](http://www.australiancurriculum.edu.au)
> (accessed 17 August 2026) and was modified. The material is licensed under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The material was modified in the sense that LearnR writes its own practice
questions against the content descriptions; it does not reproduce ACARA's
material verbatim.

### Disclaimer

> ACARA does not endorse any product that uses the Australian Curriculum or make
> any representations as to the quality of such products. Any product that uses
> material published on the Australian Curriculum website should not be taken to
> be affiliated with ACARA or have the sponsorship or approval of ACARA. It is up
> to each person to make their own assessment of the product, taking into account
> matters including the degree to which the materials align with the content
> descriptions and achievement standards.

## Status

Not a stable release. Maths is the only subject. Parent login and controls are a
future feature — session settings are kept configurable, but nothing is built for
them yet, and the analytics library has no screen in front of it.
