# LearnR

A maths and English practice app for children, built for a standard iPad.

**A parent sets the year; the child just plays.** A parent signs in with Google,
adds each child with the school year they are in, and hands them a 4-character
code to type. The child picks a subject and answers questions until they decide
to stop - the session never ends on its own, and the header counts nothing. There
is no timer on a question and no score to protect; a wrong answer shows the right
one and waits.

Leaving the year to the child was considered and rejected. Given the choice a
child picks the year that feels easiest, and the questions that don't feel easy
are the point - so the level is the parent's to set, and a managed child gets no
dropdown and can't reach another year by typing a URL.

Questions are generated, not stored. Each one comes from a **template** that
declares its variables and an expression for the answer, so a single template
produces an endless supply of questions at the same difficulty. 505 templates
ship - 350 maths and 155 English - covering Kindergarten to Year 6, written
against both the Australian Curriculum and the NSW syllabus.

Signed out, `/` is a landing page: what the app is, what it covers - read from
the shipped templates, so it cannot drift - and the two ways in side by side in
the top bar, Google for a grown-up and the code box for a child.

## Getting started

```bash
npm install             # always from the root - see below
cp .env.example .env    # see Configuration below
npm run dev             # the web app, http://localhost:3000

# in a second terminal, for anything that reads or writes data:
cp apps/api/.env.example apps/api/.env
npm run dev --workspace apps/api   # http://localhost:3001
```

**`npm install` is always run from the root.** This is an npm workspace and the
root install is what links `@learnr/core` into both applications; installing
inside `apps/api` cannot see it.

**The app plays without any configuration.** Sign-in and progress recording are
skipped when their environment variables are absent (`isAuthConfigured`,
`isDatabaseConfigured`), so the question engine and the play screen work on a
fresh clone with no API running at all. The placeholder connection string in
`.env.example` counts as absent, so copying the file as-is is enough to start.

### Configuration

The web app's `.env`:

| Variable | What it is |
| --- | --- |
| `LEARNR_API_URL` | Where the API is. Defaults to `http://localhost:3001`, so a local pair needs no entry. |
| `DATABASE_URL` | Neon Postgres, via the Vercel Marketplace. **For Auth.js alone** - everything else goes through the API. |
| `AUTH_SECRET` | Generate with `npx auth secret`. |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud console, with redirect URI `http://localhost:3000/api/auth/callback/google`. |

The API's own `apps/api/.env` needs `DATABASE_URL` and `PORT` and nothing else:
Auth.js runs in the web app, and the API reads the very `Session` rows it writes,
so one sign-in serves both halves and there is no API key to manage.

## Commands

The web app, at the repository root:

```bash
npm run dev            # dev server
npm test               # vitest, run once
npm run test:watch     # vitest, watch
npm run typecheck      # tsc --noEmit
npm run build          # production build
npm run content:build  # regenerate src/content/packs/ from the templates
npm run db:generate    # prisma generate, for Auth.js alone
```

The API is a workspace and does not answer to those:

```bash
npm run dev --workspace apps/api        # http://localhost:3001
npm test --workspace apps/api           # needs Docker - Testcontainers Postgres
npm run typecheck --workspace apps/api
npm run contract --workspace apps/api   # regenerate contract/openapi.yaml
```

**There is no `db:migrate` at the root.** `apps/api` owns the schema and the
migrations, and runs `db:deploy` as its release command, so a release carries its
own schema changes.

### Deploying

A push to `master` runs `.github/workflows/deploy.yml`: both test suites and both
typechecks, then the API to Fly, then the web app to Vercel. **The API goes
first** - its release applies migrations, and the web app calls it server-side on
every render, so an endpoint has to exist before the page that calls it.

Which halves a push moves is `scripts/changed-apps.ts`'s answer, and it has
tests. The shared engine moves both, because it ships inside the Next bundle and
inside the API image alike, and a path matching no rule moves both too - a wasted
deploy is cheaper than a change that silently did not ship.

## How it works

One repository, three pieces: the Next.js web app at the root, a Fastify REST API
in `apps/api`, and the pure engine both consume as `@learnr/core`. Next.js App
Router, React 19, Tailwind 4, Auth.js with Google sign-in. The web app is on
Vercel, the API on Fly, the database is Neon Postgres - all three in Sydney,
because the API makes several sequential reads per page and an ocean between them
would cost a second.

**All the logic lives in `src/lib` as pure functions.** Nothing in there touches
React, the network, the clock or the database - callers pass in `now` and a seeded
RNG. That is what makes the engine testable and lets any session be replayed from
its seed. It holds without exception: the two impure files the web app has left,
`src/api.ts` and `src/auth-db.ts`, sit outside `src/lib` rather than being
excused from the rule, and a guard test fails the build if an engine file reaches
for the web app's `@/` alias.

```
src/lib/expr/        safe expression language (tokenize -> parse -> evaluate)
src/lib/figures/     the questions that are a picture: eleven kinds, a registry
src/lib/templates/   question templates: types, generation, validation
src/lib/session/     session state machine, grading, answer input rules
src/lib/analytics/   the learner profile, and the report written from it
src/lib/reinforcement/ which question to ask next
src/lib/rewards/     stars for a round, the day streak, the daily target
src/lib/speech/      turning a question into words worth hearing
src/lib/speedrun/    the ninety-second game: modes, records, leaderboard
src/lib/curriculum.ts school years, NSW stages, labels and ordering
src/lib/login-code.ts the 4-character code a child signs in with
src/lib/day.ts       which local day a moment falls in
src/lib/rng.ts       seeded PRNG
src/content/         the shipped course content, a year a file
src/content/packs/   the generated JSON packs - the artifact that ships
src/components/      UI
src/app/             routes and server actions
packages/core/       @learnr/core: the engine above, shared with the API
apps/api/            the Fastify REST API - owns the schema and the migrations
```

**The web app calls the API for everything but signing in.** `src/api.ts` is the
one typed client. The caller's session cookie is what authorises a request,
forwarded as-is, so who a request is for is decided in one place - and an
endpoint a child may not reach answers 403 to the child rather than trusting the
web app to have asked nicely.

**Null means "could not read", never "nothing there."** That distinction is
load-bearing on half these screens, because `[]` from a read of a child's answers
renders as "your child has never practised". A 503, a 4xx and a dead connection
all come back as null; an endpoint meaning "nothing there" says `[]` with a 200.

**The play screen keeps playing when the API doesn't.** An unweighted first
question beats no question, nothing is recorded, and the child never learns there
was an outage. Every screen that needs to know who is asking degrades instead of
guessing - a grown-up is never dropped onto the child's home screen because a
read failed.

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
input - so `eval` is not an option. `src/lib/expr` is a small Pratt-parsed
expression language written for that reason; variable and function lookups use
`Object.hasOwn` against null-prototype tables, so `constructor` and `__proto__`
resolve to nothing. Run anything new through `validateTemplate` before importing
it: it catches unbound variables, out-of-order references, malformed expressions
and unsatisfiable constraints, then proves the template can actually generate.

**The templates ship as generated JSON and the TypeScript is what authors edit.**
`npm run content:build` writes `src/content/packs/`, and a test regenerates them
in memory and compares byte for byte - so editing a year file without rebuilding
is a red suite rather than a stale pack. The packs are also what a client that
cannot import TypeScript fetches, over `/content/manifest`.

### Levels and topics

Levels are Australian school years - `'K'`, then `'1'` to `'6'`. Primary school
is the whole scope. They are always strings, so `'K'` sorts first.

Levels and topics are many-to-many and neither owns the other. A year offers
several topics; a topic recurs across years, harder each time. The pairing lives
on the template, so the curriculum is *derived from* the content rather than
declared alongside it - adding a Year 4 division template is all it takes to put
division into Year 4.

### Questions that are a picture

"What shape is this?" has no hole to fill: the figure *is* the question and the
prompt is only its caption. Eleven kinds of figure ship - polygons, angles, bar
and picture graphs, spinners, solids, number lines, clocks, arrays, fractions of
a shape and grids - each generated from the same bound scope and injected RNG the
question uses.

**No single diagram may become the anchor for an answer.** If every obtuse angle
is drawn the same way, a child learns to recognise the picture and the analytics
call the topic secure. A wrong answer is visible; a mislearned one is not. So a
figure varies by default - a template pins the property the question is about and
says nothing about rotation, size or proportion - and validation draws each
figure template fifty times and refuses any answer that always produced the same
picture. Multiple-choice option sets are held to the sibling rule, and both are
measured rather than assumed.

### Answering

Every answer is given on screen. The iPad's own keyboard never opens, which keeps
the question visible and the targets large and fixed.

| Answer type | Input | What it can express |
| --- | --- | --- |
| `number` | number pad | digits and one decimal point - no minus key |
| `text` | on-screen A-Z pad | letters only, up to 16 |
| `boolean` | True / False | one tap answers |
| `choice` | 2-4 buttons | one tap answers; anything the others cannot express |

**A word answer is a last resort in maths and the skill itself in English.** In
maths below Year 4 a word answer is multiple choice instead, because spelling
first tests literacy rather than maths. Spelling correctly is exactly what the
English outcomes name, so from Year 1 English types its answers - between 15% and
40% of a year's templates, floors and ceilings both enforced.

**A child who cannot read can still use the app.** A speaker button beside the
door reads the question aloud, tapping the question repeats it, and a revealed
hint is read as it appears. Speaking a question is not reading its characters:
prompts hold `+ − × ÷ = / % ° $`, abbreviated units and a bare `?` standing for a
gap, so there is a pure translation layer between the text and the voice. Handed
over as-is, "What is 7 − 3?" is spoken "What is 7 3?", which is worse than
silence.

Every answer is recorded as an `Attempt` - which template, how long it took, the
response as typed, and the figure the child was looking at where there was one -
and folded into the child's skill for that topic. Recording is best-effort and
never blocks play.

### Which question comes next

Questions used to be drawn at random. They still are, until the answers say
something: once a topic has been answered enough times to judge, the selector
weights the pool towards what the child is finding hard.

The model is one `LearnerProfile` - per topic and year: how many answers, how many
right, a recency-weighted `strength`, the current run, the separate days it has
been got right on, and when it was last seen. It is folded forward one answer at a
time, so it updates *during* a session as well as between them, and the same
arithmetic backs the stored row and the played one.

Three rules keep a lean from becoming a drill:

- **A weak topic is held to a share of the session** - roughly a fifth to a bit
  under half. Enough to improve; not so much that a child who is stuck on counting
  spends an afternoon counting.
- **A topic just asked is cooled down**, so the extra practice is spread through
  the session rather than clumped into a run.
- **Nothing is ever ruled out.** Mastered topics still come up - a child should
  spend some of their time getting things right.

**Calling a topic known is the expensive mistake**, so the two bars are not the
same height: a topic is called hard on a handful of answers, but called secure
only on a strong run *and* enough answers *and* right answers on separate days.
A run inside one sitting is one memory answering several times; the answer that
survives a night's sleep is the only thing allowed to count as mastery.

Once a topic is secure it goes quiet, then comes back: a couple of days later for
something just learned, up to a month for something known several times over. The
gap is the point - recall that has had time to fade is the recall worth
practising.

`src/lib/analytics` reads the same history from the other end: which topics need
help, which way each is trending, and practice over time. **/progress** is the
screen in front of it - a parent picks a child and a subject and gets three
headline tiles, the topics needing a hand, the ones going well, a bar per topic
and a four-week practice calendar. Each struggling topic unfolds the child's last
few answers, the diagram beside them where there was one, so a parent sees *how*
it is going wrong rather than only that it is. Under `MIN_OBSERVATIONS` answers it
says so in words rather than diagnosing from two data points, and a failed read
says "could not read" rather than rendering as "never practised".

Whose days these are is the child's question, not the parent's: the server has no
timezone, so the offset comes from the one the child last answered at, which every
attempt already stores. A parent reading the report from another timezone still
sees their child's evenings as evenings.

### Rewards

Stars come every ten questions - 3 for a clean round, 2 for some right, 1 for a
round with none. The floor is the point: sitting through ten hard questions is the
behaviour worth rewarding. A **play streak** counts days rather than hours, so
practice after school one day and before school the next keeps a run that twenty
hours would have broken. Both ride on the profile menu, and neither is a score -
nothing a wrong answer does takes anything off either.

A parent can set a **daily target**, in questions or minutes. It is a floor and
never a cap: nothing stops a child carrying on, nothing is taken away for missing
it, and a missed day produces no value at all. Hitting it is worth a flat ten
stars rather than a scaled amount, so a star total never becomes a measure of how
much a parent asked for.

Rewards are read by nothing that decides what to ask next. Reinforcement runs off
the profile alone; wiring stars into it would make the app reward-seeking rather
than teaching.

### Speed run

Ninety seconds, one operation, how many you can get right - the first thing in
LearnR with a clock, a score and a number to beat, all three of which the lesson
deliberately withholds. **There is no wrong answer in a speed run**: it moves on a
correct answer and nothing else, and an entry that can no longer become the answer
flashes and clears, leaving the same question up.

It is walled off from everything the rest of the app protects. An `Attempt`
carries a curriculum topic and a school year and a speed run has neither, so a run
writes no attempt, no skill, no star and no streak, and earns no daily-target
credit. Twenty-six modes, enumerated by hand rather than generated from a range,
because a record is only worth beating if the mode is worth naming. Records, a
trophy cabinet of best runs and a family leaderboard sit above the cards; the
leaderboard shows faces and no names, because it is the screen a pre-literate
child reads to find themselves.

### Accounts

There are two kinds of account, and **a Google sign-in can only ever produce a
parent**. A child is a profile their parent made - no email, no OAuth account -
and a login code is their only way in, so signing in with Google *is* saying you
are a grown-up. A parent doesn't play: `/` redirects them to `/progress`, and
`/children` is where they add, edit and remove children and issue login codes.

A **managed child** is an ordinary `User` row with `parentId` set, so sessions,
attempts and skills all work on it unchanged. The code a parent generates lasts an
hour and is spent at redemption, but the session it creates does not expire on a
schedule: the window protects the handoff from parent to child, and once the child
is in they stay in.

A second grown-up - a separated parent, a grandparent, a tutor - can be given a
child's report and nothing else. **Read-only is a property of the schema rather
than a check anyone has to remember**: ownership is `parentId` alone and every
mutation already scopes its query by it, so there is no query in the app that
edits a child and can be reached through a share.

## Curriculum sources

Content is written against **four documents**: ACARA's *Mathematics: Scope and
sequence F-10 (v9.0)* and its *English* v9.0 counterpart, the **NSW Mathematics
K-10 Syllabus (2022)** and the **NSW English K-10 Syllabus (2022)**. NSW is there
because NSW schools teach the NSW syllabus, and a parent reading **/curriculum**
should find their child's **stage** - the word their school actually uses.

Every template records what it practises in its `tags`, so any question can be
traced back. An ACARA code reads as `AC9M` or `AC9E` + year + strand + number -
for example `AC9M4N02`, Year 4 Number: *"explain and use the properties of odd and
even numbers"*. A NSW code reads as `MA2-AR-01` or `EN1-SPELL-01`, naming an
outcome within a stage. Four rules are enforced over everything shipped: every
template cites at least one syllabus, a NSW code may only come from the stage its
template's year falls in, a NSW code has to be one the syllabus actually has, and
every tag has to be a recognised code rather than merely a tidy string.

**The two halves are treated differently because the copyright is.** ACARA's
material is CC BY 4.0, so a content description is quoted in full on
**/curriculum**. NESA's is Crown copyright, so a NSW outcome is **cited and never
reproduced** - no outcome statement, and no gloss of one, in a `tags` array, a
code comment or the page. Say where a syllabus puts something; do not say what it
says.

### Attribution

> © Australian Curriculum, Assessment and Reporting Authority (ACARA) 2010 to
> present, unless otherwise indicated. This material was downloaded from the
> [Australian Curriculum website](http://www.australiancurriculum.edu.au)
> (accessed 17 August 2026) and was modified. The material is licensed under
> [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The material was modified in the sense that LearnR writes its own practice
questions against the content descriptions; it does not reproduce ACARA's
material verbatim.

NSW syllabus outcomes are © NSW Education Standards Authority (NESA) and are
referenced here by code only.

### Disclaimer

> ACARA does not endorse any product that uses the Australian Curriculum or make
> any representations as to the quality of such products. Any product that uses
> material published on the Australian Curriculum website should not be taken to
> be affiliated with ACARA or have the sponsorship or approval of ACARA. It is up
> to each person to make their own assessment of the product, taking into account
> matters including the degree to which the materials align with the content
> descriptions and achievement standards.

## Status

Not a stable release. Maths and English both ship, K to Year 6. A native iOS
client for children is under way in a separate repository: it consumes the API's
`contract/openapi.yaml` and a Swift port of the engine, because play has to work
offline, which means questions are generated on the device. The TypeScript engine
is the oracle the port is verified against.
