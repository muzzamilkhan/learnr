# LearnR

A learning web app for children. Next.js (App Router) on Vercel, Google sign-in,
designed for a standard iPad. Maths and English are the two subjects that ship.

One Next.js application: the engine, the content, the UI, the routes and the
data layer in one tree - see **Where everything lives** below. It was two
applications and a shared package for a few days, and **What the collapse cost
and kept**, near the foot of this file, is what that left behind.

## Commands

```bash
npm run dev           # dev server
npm test              # vitest, both projects - the `db` one needs Docker
npm run test:unit     # the fast half: the engine, the content, the components
npm run test:db       # the data layer, against a real Postgres
npm run test:watch    # vitest, watch
npm run typecheck     # tsc --noEmit
npm run build         # production build
npm run db:generate   # prisma generate
npm run db:migrate    # prisma migrate dev - writing a migration, locally
npm run db:deploy     # applying them, which is what a release runs
```

**`npm test` is two vitest projects and only one of them needs Docker.** `unit`
is node-only and parallel - the engine, the content and the components. `db` is
everything under `src/server/`, which runs against a real Postgres in
Testcontainers. `npm run test:unit` is the one to reach for while working on
anything pure; folding the two into a single run would make every unit test wait
on a container, which is most of what makes this repo quick to work on.

**A push to `master` deploys** (`.github/workflows/deploy.yml`), behind the suite
and the typecheck. `vercel.json` sets `git.deploymentEnabled: false`, so Vercel
builds nothing off a push to any branch - which leaves this workflow the only
thing that can move production and nothing on the other side of it to race.

**There are no preview deployments, and that is a trade rather than an
oversight.** They were briefly re-enabled per-branch during the collapse and
turned off again, because a preview runs against the *production* database and
so reads and writes real children's records. Handing a family's data to every
branch build costs more than losing previews. Naming branches in `vercel.json`
brings them back, but point them at a Neon branch first - which is what the Neon
CLI under **Setup** is there for. It runs `vercel build
--prod` on the runner and uploads the output with `--prebuilt`, so the artifact
that ships is the one the suite ran beside and a red test means nothing was
built at all.

**The gate matters more than the automation.** `next build` does not run
`src/content/catalog.test.ts`, and that test is what proves all 553 shipped
templates still validate, still fit `MAX_PROMPT_CHARS`, and still never anchor a
figure to an answer. Nothing else catches a broken template before it ships.

**The workflow needs three repository secrets** - `VERCEL_TOKEN`,
`VERCEL_ORG_ID` and `VERCEL_PROJECT_ID`. The two ids are not secret but sit in
the gitignored `.vercel/project.json` and stay out of the tree with it.

Deploying by hand still works, and is what to reach for when the deploy is the
only thing you want: `vercel build --prod && vercel deploy --prebuilt --prod`.

Run `npm test` and `npm run typecheck` before pushing.

## Where everything lives

One Next.js application at the repository root. The engine and the content are
pure, the impure half is a directory, and every read and write reaches Neon in
process.

```
src/app/             routes, and api/v1/ route handlers for the six play writes
src/lib/, src/content/   the pure engine, and nothing impure in either
src/server/          the Prisma client, the data layer, and the composed reads
src/browser-api.ts   what the browser posts while a child is playing
src/components/      UI
prisma/              the schema and its migrations
vercel.json          master is off Vercel's git integration; the workflow ships it
```

**`src/server` owns the database, and `src/lib` stays exactly the pure engine.**
The five modules holding the Prisma queries - `db`, `records`, `accounts`,
`sharing` and `speed-records` - lived *inside* `src/lib` once, in the directory
whose whole rule is that everything in it is pure. They sit in `src/server/`
instead, so that rule is true without exception, and `src/lib/purity.test.ts` is
what keeps it true: it walks `src/lib` and `src/content` and fails on any import
of React, `next`, `@prisma/client` or `src/server`.

**`server-only` sits on `src/server/db.ts` and nowhere else in the directory.**
Every data module imports `prisma` from there, so one line poisons the whole
directory for a client bundle: a `'use client'` file that reaches a data module -
directly, or through any component that imports one - fails `next build` with the
import chain named, rather than shipping a Prisma client and a `DATABASE_URL` to
a browser. `src/components/speed-scores.tsx` imports a data module directly,
which is exactly the shape the guard exists to catch. vitest aliases the package
to an empty stub, because `server-only`'s entry point throws outside the
`react-server` condition and both projects import these modules in plain node -
the alias is the test runner's alone, so the guard is live where it matters.

**The data layer's tests run against a real Postgres in Testcontainers rather
than a mock.** Three concurrency guards - `SELECT ... FOR UPDATE` on `TopicSkill`
and on `roundsBanked`, and the compare-and-set on `targetDay` - mean nothing
against a fake client, and they are the parts most worth proving.

**Two files there are composition rather than queries, and that is deliberate.**
`src/server/reports.ts` builds a child's whole history for the parent's report
out of five reads and the ownership check in front of them, and
`src/server/play-state.ts` answers the two playing screens in one shape. Both
were route handlers; the reads inside them are still issued in parallel for the
reason they were parallel there - asked a function at a time they are a waterfall
in front of the first question a child sees. In process they are cheaper. They
are still round trips to Neon.

### Deployed

| | Where | Region |
| --- | --- | --- |
| Web app | `learnr.muzza.tech`, Vercel | `syd1` |
| Database | Neon | `ap-southeast-2` |

**Both are in Sydney, and that is the whole reason for the hosting choice.** A
query from Sydney round-trips in about 3ms; a parent's report makes roughly five
reads, so a database in the US would cost a second a page.

**Reads are function calls; the writes a child makes while playing are not.** A
page render calls `src/server/` directly and there is no HTTP on a read at all.
What still crosses a wire is what the *browser* writes (`src/browser-api.ts`):
opening a sitting, recording an answer, banking a round's stars, banking the
day's goal, closing the sitting, and submitting a speed run. All of it is
*recording* - none of it decides what the child sees next - which is the property
that makes leaving it in the browser's hands safe.

**Those are route handlers under `/api/v1`, not server actions, and it is the
most valuable thing the split turned up.** Next serialises server-action requests
from one client, so the calls a single answer makes queue behind each other while
every one of them reports a healthy server-side duration - a wait that exists
only in the browser and appears in no log. That was true of the monolith all
along and was invisible only because each call was fast. Same origin, so there is
no CORS, no preflight to pay for on every recorded answer, and no `Domain` on the
session cookie.

**Each handler resolves the session once and gates there** (`requireUser` and
`requireParent`, `src/server/session.ts`). It does not open with `auth()` and then
check again: that double lookup was measured at 717ms on a cold Prisma client
against about 5ms warm, and was paid up to twice per answer. One service means
one lookup is both necessary and sufficient.

**The caller's session cookie is what authorises a request.** A token is a
`Session` row whoever wrote it - Auth.js writes one when a parent signs in with
Google, `redeemLoginCode` writes one when a child spends their code - so who a
request is for is decided in one place and the two paths cannot be told apart.
There is no API key and no service account: a handler a child may not reach
answers 403 to the child.

**Null still means "could not read", never "nothing there."** That distinction is
load-bearing on half these screens - `[]` from `readObservations` renders as
"your child has never practised" - so a failed read comes back as null, and a
read meaning "nothing there" returns `[]`. `family: null` on the speed records is
the third state that needed saying out loud: nobody to rank, which is neither.

**Who is asking has four answers, not two** (`viewerKind`, `src/lib/viewer.ts`).
A null account means *signed out* or *the read failed*, and every screen used to
read both as "not a parent". That is not safe in one process either, because
**Neon is a network hop**: a read can fail while the app renders perfectly well,
and a grown-up would land on the child's home screen, level picker and all. So
`readViewer` returns a `kind`, and the three screens that gate on a role branch
on it:

- `/` says **"Can't load your account"** rather than picking a branch. Nothing on
  that screen can be answered without the account, so there is nothing to
  degrade to.
- `readParent` returns `viewable: null` instead of redirecting, which every
  parent screen already draws as "couldn't load your children". Keeping the URL
  is the point: a reload after the blip retries the screen they were on.
- `/speed` stops redirecting a reader it cannot identify to the *child's* speed
  section.

**The play screen is the deliberate exception and still plays.** An unweighted
first question beats no question, nothing is recorded, and the child never learns
there was an outage. `unclaimed` is a fourth answer for its own reason: `/`
claims the role and every other screen bounces there, so the bounce heals rather
than loops - which only works while it is distinguishable from `parent`.

**Auth.js reads the same schema as everything else.** `PrismaAdapter` takes the
one client from `src/server/db.ts`; there is no second schema and no subset
model. The cost is worth naming rather than discovering: the adapter selects
whole `User` rows on every authenticated request, and `User` has eighteen columns
against the five the old subset declared - two schemas for one table is the worse
trade. `claimParentRole` is written three times - in `src/server/db.ts` for the
sign-in event, in `src/server/accounts.ts` for the healing case on `/`, and
inline inside `acceptShareInvite`'s transaction. All three are the same
compare-and-set on `role IS NULL`, which is what makes duplicating it safe.

### Repository visibility

**`learnr` is public.** Nothing sensitive is committed: `.env` has never been in
history, and `.env.example` carries empty placeholders. Secrets live in Vercel
and in local gitignored `.env` files.

## Architecture

**All logic lives in `src/lib` as pure functions.** Nothing in there touches React,
the network, the clock or the database - callers pass in `now` and an RNG. This is
the rule that keeps the app testable; don't break it for convenience.

**It is true without exception, and `src/lib/purity.test.ts` is what holds it
there** - nothing in `src/lib` or `src/content` imports React, `next`,
`@prisma/client` or `src/server`. The impure half of the app is a directory
rather than a list of files to look past.

```
src/lib/expr/        safe expression language (tokenize → parse → evaluate)
src/lib/figures/     the questions that are a picture: twelve kinds, a registry
src/lib/templates/   question templates: types, generation, validation
src/lib/session/     session state machine and grading
src/lib/analytics/   the learner profile, and the report written from it
src/lib/reinforcement/ which question to ask next
src/lib/rewards/     stars for a round, the day streak, and the daily target
src/lib/speech/      turning a question into words worth hearing
src/lib/curriculum.ts school years, NSW stages, labels and ordering
src/lib/day.ts       which local day a moment falls in
src/lib/rng.ts       seeded PRNG
src/lib/dto.ts       the shapes the data layer and the components share
src/lib/viewer.ts    what a signed-in-but-unreadable account means, and the rest
src/content/         the shipped course content, a year a file + catalog lookups
src/server/          the Prisma client, the data layer, and the composed reads
src/browser-api.ts   the six writes the browser makes while a child plays
src/components/      UI
src/app/             routes, the six route handlers, and server actions
```

- `src/lib/expr` is a small Pratt-parsed expression language. Templates are
  authored **outside the app by AI** and are therefore untrusted - `eval` is not an
  option. Variable and function lookups use `Object.hasOwn` on null-prototype
  tables so `constructor`/`__proto__` can't resolve.
- Randomness is always injected (`Rng`), never called directly in engine code, so
  tests are deterministic and any session can be replayed from its seed.
- Session state is immutable: `submitAnswer` returns a new state.
- Browser shims live beside the components, never in `src/lib`, because they touch
  APIs that can't be pure: `sounds.ts`, `speech.ts`, `clock.ts`, `photo-crop.tsx`.

## Levels and topics

**Levels are Australian school years**: `'K'` then `'1'` to `'6'`, as strings -
primary school is the whole scope. Never an integer: `'K'` has to sort first, and
strings keep the door open for years beyond single digits. Use `compareYearLevels`
to sort, `yearLabel` to display ("Kindergarten", "Year 3"), and `parseYearLevel` at
every boundary (URLs, imported files) - it normalises `'k'` and `'03'` and returns
null for anything else.

**A topic is what a question practises** ("counting numbers", "even and odd").

**A subject exists because content cites it**, the same way the curriculum is
derived rather than declared - `availableSubjects()` in `catalog.ts` is the list,
ordered by `compareSubjects` so maths leads. It is what a parent's choice of
subjects for a child is checked against and what every screen offering subjects
lists, so a third subject shipping reaches all of them at once.

**Levels and topics are many-to-many, and neither owns the other.** The pairing
lives on the template - one year, one topic - so the curriculum is *derived from
content*, not declared. Adding a Year 4 division template is all it takes to put
division into Year 4. Walk it from either end: `topicsForLevel(subject, level)` and
`levelsForTopic(subject, topic)`. Don't add a level→topics table; it would go stale
against the templates that are the actual source of truth.

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

- **Every numeric field is an expression string**, not a number, so `max: 'x - 1'`
  works and bounds can depend on variables bound earlier.
- **`vars` is ordered.** A variable may only reference ones declared before it.
- **Constraints are arbitrary boolean expressions**, satisfied by rejection
  sampling (200 attempts, then a descriptive throw).
- **`{...}` holes in `prompt`/`hint` take any expression**, e.g. `{x + 1}`.
- Variable kinds: `int`, `number`, `pick` (list, optionally weighted), `expr`.
- Optional `choices` makes it multiple choice, with authored `distractors` and a
  `jitter` fallback. **At most 4 options** (`MAX_CHOICES`) - more stops being
  thumb-sized on an iPad.
- **`answerType` is inferred from what `answer` evaluates to**: boolean →
  `boolean`, number → `number`, else `text`. Declare it only for `choice`, or for a
  numeric answer you want typed as text.
- A boolean answer makes it true/false whatever the template says, and `choices`
  alongside one are meaningless. `validateTemplate` rejects that pairing.
- **Authoring mistakes are reported by `validateTemplate`, never thrown by
  `generateQuestion`.** Generation runs mid-session with a child waiting, so it
  degrades instead: a disagreeing `answerType` is overridden, choices on a
  true/false template are dropped, extra options are clamped. That is exactly why
  content must be validated before it ships.

Expression language: `+ - * / % ^`, comparisons, `&& || !`, ternary, string
literals, and `abs min max floor ceil round trunc sign sqrt pow mod gcd lcm isInt
isEven isOdd`.

Template ids follow `subject.level.topic.variant`.

### The anchoring rule for option sets

**A multiple-choice question can answer itself, and that is the figure anchoring
rule's sibling.** A figure that never varies teaches recognition of the picture; an
option set that never varies teaches recognition of the *button*. Both let the
child get it right, the profile call the topic secure, and the maths go unlearned.
Both are caught the same way: draw the template many times and look at what stayed
the same. `validateTemplate` draws a `choices` template `CHOICE_DRAWS` (40) times
and refuses three shapes:

1. an answer that always holds the same **rank** among numerically sorted options;
2. an answer always drawn from a **different list** than its distractors (a closed
   set where the odd one out is pickable without doing the arithmetic);
3. the general case - **the option set predicting the answer**, where every
   distinct set of buttons always came with the same answer. This is the one that
   reaches word options, and it is guarded by `OPTION_SET_REPEATS` (2) so a
   template whose options move nearly every draw isn't refused for not repeating
   itself.

A sweep of content written before the check found **14 templates with a fixed
answer rank and one option-set leak**; thirteen of fifteen needed reworking. The
other two are "which is largest?", where the rank *is* the question, and declare
`rankIsTheQuestion`. A third joined them when the prediction check reached word
options: `maths.4.decimals.larger`, `maths.4.angles.larger-angle` and
`maths.5.decimals.largest`. Its sibling `propertyIsTheQuestion` covers "which of
these is even?", where an odd distractor can never be an even answer - no shipped
template needs it yet. Two flags rather than one blanket "trust me": each
suppresses the check it names, and either also suppresses the prediction check.

**On a figure question the first two checks usually stand down, so measurement is
most of the net.** Nothing exempts a figure structurally - it is the *options* that
decide, and a shape name or grid reference is not a number. 43 of the 44 shipped
figure+`choices` templates word their options; the forty-fourth
(`maths.5.angles.estimate-degrees`, offering 30/60/90/120) is rank-checked and
passes on the merits. The closed-set check stops reading disjointness as structure
above `CLOSED_SET_MAX` (8) distinct answers, and a 3x3 grid reaches nine. **Eight
leaks were found by measuring** - keying each draw by its prompt and sorted option
set, learning the modal answer on one sample and scoring it on a held-out one
against the blind baseline - at rates up to 100%, none findable by the checks that
existed then. A green suite still says little about a new `choice` template
carrying a figure: the prediction check only speaks where the option set repeats,
and a leak that narrows the answer to two of four buttons passes cleanly. **Measure
it.**

### Validation and limits

**Always run new templates through `validateTemplate` before importing them.** It
catches unbound variables, out-of-order references, malformed expressions, bad
levels and unsatisfiable constraints, then proves the template can generate.
`src/content/catalog.test.ts` validates everything shipped and checks an id shaped
`subject.level.topic.variant`, a curriculum citation in `tags`, at least 20
templates per year, and no typed answer the number pad cannot enter. A template
carrying a `figure` is drawn fifty times and made to prove it never draws one
answer the same way twice.

**A rendered prompt may be no longer than `MAX_PROMPT_CHARS` (105)**
(`src/lib/templates/limits.ts`). This is the only lever on how big every question
on the play screen is drawn: the screen sets one size for all of them and that size
is the worst case's, so a template past the cap makes every *other* question
smaller. 105 is measured - over 300 draws of each of the 553 shipped templates the
longest prompt is 100 chars, median 46, shortest 14 - with five characters of slack
so a growing digit inside a template doesn't redden the suite. `catalog.test.ts`
draws every template fifty times against it (fifty rather than the usual
twenty-five because this is a maximum over a distribution).

**It was 140, and the 35 characters came off the content rather than off the cap** -
twenty-three templates reworded, mostly chance and measurement word problems that
named a quantity twice. **That pass is done, and stopping where it did was the
point.** A fixed box takes area proportional to the character count times the
square of the size, so the size a fit lands on goes as `1/sqrt(cap)`: 140 to 105
bought about 15% bigger type, and grinding on to 95 would buy 5% more for twice
the rewriting and real damage to the prose. The median prompt is 46 characters and
was never the problem. `limits.ts` carries the full derivation - **read it before
reopening this**, because the tail is the whole of the gain and it has been taken.

### Shape of the content

Maths ships K-6 as **398 templates, one file per school year** under
`src/content/maths/` (`k.ts`-`6.ts`, concatenated in school order by `index.ts`).
The split is filing rather than structure: `mathsTemplates` is the same array in
the same order, and `catalog.ts` never learned there is more than one file. What it
buys is that a year is the unit a content change touches. English follows the
identical shape under `src/content/english/` and adds **155 templates**.

**Maths sits at NSW's own strand split, 40 / 40 / 20**, and that is a property
worth not losing. Counted by focus area the syllabus is roughly 40% Number and
algebra, 40% Measurement and space, 20% Statistics and probability; the content
is 39.7 / 40.2 / 20.1, and **every year is at that split individually** rather
than only the corpus. It was 74.5 / 22 / 3.5 before the diagrams work - the
shape of an app that could only render a sentence, left in the content after
the constraint was lifted - then 44.9 / 38.9 / 16.2, and the second content
pass the NSW design deferred closed the rest. Adding a run of Number templates
to one year is what would quietly undo it, so measure the split rather than the
total when a year grows.

Every template cites the content it practises in `tags` - `AC9M4N02`, `MA2-AR-01`.

**The TypeScript literals are the content**, and `catalog.ts` composes
`allTemplates` out of them - maths K-6 then English K-6, the order it has always
had. They were serialized into JSON packs for a while, so that a client which
could not import TypeScript could fetch them over the wire; there is no such
client, and a pack was a second copy of the content whose only remaining job was
to be kept in step with the first. One copy cannot drift, which deletes the
failure mode rather than testing for it.

### Answer types

| `answerType` | how it is answered | what it can express |
| --- | --- | --- |
| `number` | number pad, then Check | digits and one decimal point - **no minus key** |
| `text` | on-screen A-Z pad, then Check | letters only, no spaces or digits, ≤ 16 chars |
| `boolean` | two buttons, True / False | one tap answers |
| `choice` | 2-4 buttons | one tap; anything the other types cannot express |

A negative answer has to be multiple choice (no minus key) - that is why the Year 6
integer questions are `choice`. Keep distractors plausible.

**`text` is a last resort, and never below Year 4 - in maths.** A word answer makes
the child spell before they can answer, which tests literacy rather than maths.
Word answers in K-3 maths are `choice` instead, and `catalog.test.ts` enforces it.
Any answer drawn from a small closed set ("metres or centimetres?") is `choice` at
any level. **English inverts this rule** - see below.

**`QuestionSpec` and `QuestionTemplate` are a deliberate split**
(`src/lib/templates/types.ts`). A spec is everything it takes to make a question; a
template is a spec placed in a course, adding an id, subject, topic and school
year. A speed run question has no curriculum topic and no school year, and giving
it a nominal one would be a lie told in the type system. `specsFor` in
`src/lib/speedrun/modes.ts` returns bare `QuestionSpec`s and reuses `generate`.

## English content

Maths taught a single number in a hundred sentences; English mostly teaches from a
*closed vocabulary* - homophone families, synonym pairs, a few dozen irregular
plurals - which forced its own rules.

**A closed word bank is exactly what the two anchoring checks stand down for.** The
rank check reads numeric options; `weight`/`wait` is not a number. The closed-set
check stops above `CLOSED_SET_MAX`, and a bank of six families sits right at that
edge. So English content leans on one fix throughout (see the homophones note in
`src/content/english/4.ts`): **offer the whole family across more than one
sentence**, so the same buttons arrive with a different correct answer depending on
the sentence, and no set is ever a fixed answer to memorise.

**That reasoning was still not enough**, which is why
`src/content/english/leaks.test.ts` exists. It draws thousands of questions per
`choices` template, learns the modal answer per option set on half the draws,
and scores that rule against the other half - the same measurement figures
content gets, because a closed vocabulary and a jittered figure fail the same
way. It found real leaks the structural checks could not: an index reused
between target and distractor measured at up to +18 points over blind guessing
on held-out draws. It is scoped to `subject === 'english'` and to templates that
actually generate `choices` on a probe draw, and it keys on the option set
alone, deliberately excluding the prompt - so a question that hands over its
answer in its own words is invisible to it. Read its doc comment before assuming
it covers everything.

**The typed-answer rule is inverted, not relaxed.** Spelling correctly *is* the
skill `EN1-SPELL-01` names, so a typed answer measures the right thing from Year 1
on. Kindergarten alone keeps the maths-shaped ban - hunting letters on a QWERTY pad
tests pad navigation rather than phonics. Past Kindergarten it is a **band**:
`catalog.test.ts` caps typed answers at **40%** of a year's templates (a typed
answer costs ~3x a tapped one, and a mostly-typed year starves the selector of
observations) and floors them at **15% spread across at least two topics** (a year
whose only typing sits in one topic lets a child secure in that topic go a year
without typing). Both are measured on the *generated* `answerType`, not the
declared one.

## Two syllabus families

Content is written against **four curriculum documents**: ACARA's *Mathematics:
Scope and sequence F-10 (v9.0)*, the NSW Mathematics K-10 Syllabus (2022), ACARA's
*English* v9.0, and the NSW English K-10 Syllabus (2022). `SYLLABUSES` in
`src/content/catalog.ts` names all four, scoped by `subject` so a maths code and an
English code are never checked against the wrong pair; `syllabusOf` tells a tag's
family apart by shape. NSW is there because NSW schools teach the NSW syllabus: a
parent reading `/curriculum` should find their child's **stage**, the word their
school actually uses.

**A stage is derived and never stored** (`stageForLevel`): Early Stage 1 is
Kindergarten, Stage 1 is Years 1-2, Stage 2 Years 3-4, Stage 3 Years 5-6. A stage
spans two years, so the mapping is total this way and lossy the other - and a stage
written onto a template would be a second truth free to disagree with the level
beside it. It is why one Stage 2 code honestly sits on a Year 3 template *and* a
Year 4 one, and why the check below is against a template's stage, never its year.
`STAGE_BY_LEVEL` is the one place the mapping is written; `levelsForStage` inverts
it rather than restating it.

**The two halves look different because the copyright is different.** ACARA's
material is CC BY 4.0, so a content description is quoted in full on
`/curriculum`. NESA's is Crown copyright, so an NSW outcome is **cited and never
reproduced** - no outcome statement, and no gloss of one, in a `tags` array, a code
comment or the page. Breaching this is a licensing problem rather than a bug. It
had to be swept for twice, because comments had drifted into restating what an
outcome *covers*. **Say where a syllabus puts something; do not say what it says.**

**There are no Part A / Part B tags.** NESA says outright that "Part A does not
equate to Year 3 only" - which part of a stage a concept is taught in is a
teacher's programming decision. Tagging it would put a guess into the one field
that exists to be checkable.

**And no topic was renamed into NSW's vocabulary.** NSW would fold `money` into
additive relations and place value, and `algebra` into additive and multiplicative
relations; both are naming rather than coverage. `topic` is *stored*, on
`Attempt` and `TopicSkill`; a rename orphans every child's history and breaks
`buildProfile`'s obligation to reproduce the stored row. A second vocabulary rides
in the tag.

**Four rules are enforced over every shipped template:**

- **Every template cites at least one syllabus.** Either satisfies it alone,
  because the two disagree about which year some content belongs to.
- **An NSW code may only come from the stage its template's year falls in.** The
  characteristic bug of a second citation family, invisible by inspection.
- **An NSW code has to be one the syllabus actually has**, checked against the 73
  codes transcribed into `catalog.test.ts` from
  `docs/superpowers/notes/nsw-outcome-codes.md`. The only one of the four checking
  a citation for *truth*, and it exists because the other three pass on a typo:
  `MA3-RFQ-01` for `MA3-RQF-01` is code-shaped, cites a syllabus and reports the
  right stage. Transcribed rather than parsed, because a regex that stops matching
  yields an empty list and an empty membership list waves every code through. It
  fails safe only against omissions - a wrong entry stays green forever, and the
  manual two-way diff against the notes file is the only guard.
- **Every tag is a recognised code**, not merely free of whitespace.
  `curriculumCodes` silently *drops* an unrecognised tag, so a broken code reached
  the page as a missing citation rather than a visible error. This commits the repo
  to every tag being a curriculum code - a `needs-review` note is not free to add.

**Where the two syllabuses disagree the template cites one, and the divergence is
named by a test.** Six templates cite NSW alone (clock faces and halves of a shape
come earlier there); ten cite ACARA alone (three because NSW places integers at
Stage 4, seven where the honest stage code does not reach the content). Both lists
are asserted as **set equalities**, not memberships: with "cites at least one"
satisfied by either, a citation quietly dropped from any other template would pass
green. `DIVERGENCE_NOTES` carries the sentence explaining each and lives beside the
derivation rather than in the page, since a note in `page.tsx` cannot carry a test.

## Question diagrams

Some questions are a picture. "What shape is this?" has no hole to fill - the
figure *is* the question and the prompt is only its caption. `src/lib/figures/` is
the pure half, geometry judged by tests rather than by eye;
`src/components/diagram.tsx` is a dumb renderer: marks to SVG, no geometry and no
decisions, which is what lets the play screen and a report row draw the same figure
at very different sizes.

It exists because of a gap in what a sentence can ask. Before this, Number, Algebra
and Measurement were near complete while Space carried **one** ACARA description
each in K, 1, 2, 4 and 6 and **none** in Years 3 and 5. Space and Statistics are
the strands where the question is a picture.

**No single diagram may become the anchor for an answer.** This is the rule the
whole design is shaped around. If every obtuse angle is drawn the same way, a child
learns to recognise that picture - and the analytics call the topic secure. A wrong
answer is visible; a mislearned one is not.

So a figure is never an asset chosen by the answer. It is **generated**, from the
same bound scope and injected `Rng` the question uses, and it **varies by default**:
a template pins the property the question is about and says nothing about rotation,
size or proportion, which the builder jitters. Omitting an optional parameter asks
for variation; supplying one pins it. Pinning is the exception because forgetting
is the failure mode.

**And because forgetting is invisible, the rule is enforced.** `validateTemplate`
draws a figure template `FIGURE_DRAWS` (50) times on different seeds, groups the
resolved figures by the answer each accompanied, and fails any answer that always
produced the same picture. `catalog.test.ts` runs it over everything shipped.
Coordinates are rounded at build time (`FIGURE_PRECISION`), which keeps stored JSON
small and - the reason that matters - makes two figures comparable as strings.

**Those fifty draws are shared across all of a template's answers, so the check
gets stricter as the answers multiply.** Four answers get a dozen drawings each,
nine get five or six - but **the refusals come from the tail**, where an answer
turns up two or three times and two identical pictures are the whole of the
evidence. For an answer whose only lever is a small discrete set, the chance an
answer's *n* drawings all land on one of *e* extents is `e^(1-n)`; over the
distribution of counts that is roughly one refusal in six for nine answers over six
extents, and essentially never for four. Evaluated at the mean instead it reads one
in two thousand - the low-count tail is the whole of the risk and averages hide it.
Seeds are keyed off the template id, so a refusal is the same on every run and
every machine. The fix is not to narrow the question but to widen what varies, or
to offer the same few answers on every draw and let the picture grow around them.

**Pinning `rotation: '0'` on a regular polygon fails validation, deliberately and
with no escape hatch.** Such a shape has no free proportion left, so a pinned
rotation is one fixed picture. An opt-out flag was left out on purpose: the author
who reaches for it is precisely the author about to make this mistake. Pinning
stays available wherever something else still varies - a scalene triangle's
proportions, an angle's two arms.

**Two kinds fight that rule, and between them they are the two patterns to reach
for.** **`clock` cannot vary its answer** - three o'clock is three o'clock, and a
dial turned slightly is a different time - so the variation moves onto the
presentation: whether numerals are drawn, whether the minute track is, and each
hand's length **as a share of the dial**. That last survives a template pinning the
other two, and it must be a proportion rather than a size because `fit` is uniform
and centring. Any kind whose answer fully determines its geometry has to find its
variation somewhere else. **`solid` has the opposite problem**: a cube has
**eleven** nets, so the failure available is picking a favourite. `CUBE_NETS` is
all eleven, laid one of the eight ways round a square and then turned, so nothing
about a cube's net is pinnable at all.

**What a kind can be asked to draw is measured, not assumed**, and lives in
`docs/superpowers/notes/figure-content-notes.md`, beside
`figure-kind-author-notes.md` for adding a kind. Every limit there was found by
drawing the thing and reading the refusal: a labelled coordinate plane may be wider
than tall (5x4 draws, 4x5 is refused), and a bar graph's room for a category name
shrinks when the *value axis* reaches two digits.

**`FigureSpec` and `Figure` are the split `QuestionSpec` and a generated question
already make**: a `FigureSpec` is expressions over the bound scope, a `Figure` is a
serialisable drawing in a 0-100 box made of four `Mark` kinds: `path` (points,
closed, filled, dashed), `arc`, `dot` and `label`. Four, and a renderer must handle
every one - anything `diagram.tsx` has to know how to draw is a decision that has
escaped `lib`. A right-angle tick is a three-point open `path` and a mirror line is
a dashed one for that reason. `arc` carries both coordinate frames at once - its
`at` is screen coordinates, y down, where `fit` left it, while `from`/`to` are the
maths frame, anticlockwise from east - which is why `arcPath` is exported and
tested.

**`buildFigure` is total and clamps; `figureIssues` reports.** The same division
`generateQuestion` and `validateTemplate` make: an unknown shape name or a
400-degree angle degrades into something drawable rather than throwing in front of
a waiting child. `figureIssues` takes the spec and the scope and no `Rng` - it
judges the authored spec, not a drawing - and validation is its only caller.

**`parseFigure` is the boundary**, beside `parseYearLevel`, `parseTarget` and
`parsePhoto`. A figure is stored on `Attempt` and read back later. One bad mark
fails the whole figure rather than being dropped: a figure is read together, and
silently losing the tick that said a corner was square would draw a picture
`buildFigure` never produced. `MAX_MARKS` caps the count for the reason
`MAX_PHOTO_BYTES` does.

**There are twelve kinds** (`FIGURE_KINDS`), each a module behind a registry:
`polygon`, `angle`, `bar`, `pictograph`, `spinner`, `solid`, `number-line`,
`clock`, `array`, `fraction-shape`, `grid`, `timeline`. The twelfth is the
Stage 3 Data display that is about **events** rather than about data somebody
collected: a rule with a year at each end, unlabelled ticks between them, and a
lettered dot per event, so a gap is counted along the scale rather than read off
two numbers. It cost `Figure`, `Mark`, `fit`, `parseFigure` and the anchoring
check nothing, which is the test the first pass set for adding one. A `FigureKindModule` (`registry.ts`)
puts a kind's drawing and its validation in one file and reduces adding one to a
file and a line. Two details are load bearing: the lookup is a `Map` and not a
record literal because it is keyed by a string off untrusted content (the
null-prototype reason again); and a module's `fields` table is a record whose
mapped type strips the spec's `?` markers, so a parameter added to a kind and
forgotten there is a type error.

The shape vocabulary is closed (`POLYGON_SHAPES`: triangles, quadrilaterals,
pentagon through octagon). A count of sides could not tell a rhombus from a kite,
and a randomly wobbled quadrilateral has no axis of symmetry at all. A polygon
takes `shape`, `rotation`, `mirror` and `rightAngles`; an angle takes `degrees`,
`rotation`, `armLength` and `arc`. `mirror` is a **boolean** - whether the dashed
line is a genuine axis - and which axis, or which plausible wrong line, is the
builder's to vary. An angle's two arms are unequal by default, because equal arms
are an anchor and children read longer arms as a bigger angle (a misconception
ACARA names). There is never a right-angle square: a box in the corner answers
"what kind of angle is this?" before the child has looked.

Two content rules learned the hard way. **A `mirror` that evaluates falsy is
reported on a shape whose symmetry axes sit closer than `WRONG_MIRROR_CLEARANCE`
(15 degrees) apart.** A regular polygon's axes are `180/n` apart, so the best a
wrong line can manage is `90/n`; a heptagon's lands a few degrees off a real one,
which is a picture that does not contain the answer. Written as an angle rather
than a list of shapes, so a kind added later is judged by its own geometry. And
**the answer-type rules apply unchanged**: shape names are `choice` below Year 4.

**A figure question reads its prompt aloud and stops.** The picture cannot be
described without giving the answer away - "a shape with three sides" *is* the
answer.

**The figure takes a tap, and it opens over the whole screen**
(`src/components/figure-zoom.tsx`, with a magnifier glyph saying so). A figure must
not be a second thing to decode, and a tap that only makes the same picture bigger
decodes nothing. **It has to cover the screen, because the question area is bound
by height, not width** - on a landscape iPad that area is ~270px tall whether the
picture has 60% of the width or all of it. The only room left is the pad's, so a
child cannot answer while it is open, and closing is one tap anywhere. **The prompt
rides along**, small along the top, because the questions this exists for are the
ones where the picture carries the data. The overlay draws at `ZOOM_LABEL_SIZE`,
smaller than either size a figure was already drawn at, which needed no change to
any kind: `labels.ts` makes a kind leave room for the *larger* of the sizes it will
be drawn at.

**It is a tap and a tab stop, and so is the prompt's tap-to-repeat beside it** -
the two moved together, because they are the same control worded twice and a tab
stop on one alone leaves the screen inconsistent in the opposite direction. Both
take Enter and Space, and the prompt's stop appears and goes with narration, since
a stop that does nothing is worse than no stop. The figure was the only
interactive thing on the play screen a keyboard could not reach: every answer is
given on the pad, and the door, the speaker and the hint are `<button>`s.
`aria-modal` on the overlay is a promise the rest of the page is inert, so it is
kept - focus moves to the dialog itself on open (it carries the `aria-label`, so
focusing it is what announces the overlay), Tab cycles the stops inside it and is
prevented even when there are none, and focus returns to the figure on close.
Restoring happens on unmount rather than in `onClose`, because the way this
usually closes is the child answering, which `advance` handles without going
near `onClose`. `focus-trap.ts` is the arithmetic half, tested beside the
component the way `diagram.ts`'s `arcPath` is; the DOM half is the one call site.
Nothing here declares a focus style - the app has never had one, and the browser
ring is what every other control uses.

**The figure sits beside the question rather than above it**, from `sm` up: a row,
prompt left and figure right, split 40/60 in the figure's favour. **A portrait
phone keeps the column, because there a row would make the figure smaller** - side
by side ~195px against ~280px stacked. The gain is real on a landscape iPad (150px
→ 270px) and a portrait iPad (330px → 384px). The 40/60 shares are `sm:`-prefixed
for the same reason: below that line the wrapper is a column, where those shares
would divide *height* and hand the figure 60% where stacking gives it ~74%.

**A landscape phone draws no figure at all, and never did.** At 390px tall the
header, the pad's 12rem floor, the hint row and the answer display exceed the
height available, so the flexible middle column resolves to nothing and the
figure's `min(64px,100%)` floor resolves with it. That floor is written
`min(64px,100%)` rather than `64px` precisely so a figure disappears where there is
no room instead of painting over the header. The cost is real: on that one viewport
a figure question cannot be answered.

**The first pass deferred a list, and said each would be a new kind and no engine
change - which is the test of whether the design was right.** The list was bar and
picture graphs, clock faces, number lines, arrays, fractions of a shape, grids and
coordinates, and nets. **All ship, and the prediction held.** `FigureSpec` gained
variants and `FIGURE_KINDS` gained names, but `Figure`, `Mark`, `fit`,
`parseFigure`, `MAX_MARKS`, the anchoring check and the answer-type rules are what
they were. The one structural change is the registry, a consequence of the *count*.

`label` was in `Mark` before anything emitted one. **That is the one place the bill
came due.** Five kinds emit a label now, and it cost `Diagram` a second prop: SVG
2's `vector-effect: non-scaling-size` is unimplemented everywhere, so unlike
`strokeWidth` a label's size cannot be pinned to real pixels and each caller
estimates its own box (`labelSize`, ~7 on the play screen and 16 in a report row).
It also cost the kinds `labels.ts`, the shared arithmetic for what a label takes
from the geometry around it. Even so the four `Mark` kinds are still four.

## Sessions

A session never ends. The child picks subject + year and answers until they stop;
templates are drawn from that year's pool across all its topics, with the
reinforcement selector deciding which. **The header counts nothing**: no clock and
no tally, only the way out (a door icon) and the profile menu. Both were things a
child would watch instead of the question. A daily target, if set, adds a bar with
no numbers on it.

Every answer is recorded (`Attempt`: template, topic, level, time taken,
correct/incorrect, the response as typed, the UTC offset, and - where there was one
- the figure the child looked at) and folded into that child's `TopicSkill`.
Attempts are the history; the skill row is that history rolled forward, a cache and
never a second truth - so `buildProfile` over the attempts has to reproduce it.

**The figure is stored resolved, not as the template's parameters**, for the reason
`prompt` is stored as text: a template edited next month must not change what a
parent is shown about last week. Figures make that argument twice, being jittered.
Read back through `parseFigure`; an ordinary question leaves the column unset.

Keeping the cache true costs a **row lock**: `updateTopicSkill` reads with `SELECT
... FOR UPDATE` inside a transaction, so answers landing at once queue and each
folds onto the one before. Two tabs will do it, and so will one child answering
faster than the round trip. The lock is there rather than a merge in SQL so
`nextSkill` stays the only place the arithmetic is written. The row cannot be
locked before it exists, so the first answer on a topic can collide on insert -
hence the retry, and one time round is enough.

**Time taken is capped** (`MAX_TIME_MS`) before it is recorded. An abandoned
question is not a measurement, and the total is per topic and never trimmed.

Recording is best-effort and must never block or interrupt play: the writes go
through `src/browser-api.ts`, which swallows every failure. `learningSessionId`
round-trips through the client, so every write verifies the session belongs to
the signed-in user first.

## Reinforcement and analytics

Two libraries over one model. `src/lib/analytics/profile.ts` folds attempts into a
`LearnerProfile` - per topic and level: attempts, correct, a recency-weighted
`strength`, the current `streak`, the separate days it has been got right on
(`correctDays`) and when it was last answered.
`src/lib/reinforcement/select.ts` reads that profile to pick the next template;
`src/lib/analytics/report.ts` reads the same history to say where a child needs
help. Neither owns the other, and both are pure.

The profile is built by folding one answer at a time (`nextSkill`), so the same
arithmetic serves the stored row and the in-session profile. That is why a topic
falling apart in the first ten questions is mixed in more heavily by the twentieth.

**Status is what everything keys off** (`skillStatus`), and it refuses to guess:
under `MIN_OBSERVATIONS` answers a topic is `new`, never a weakness. Then
`struggling` (strength under 0.6), `developing`, `secure` and `review-due`.

**The two bars are not the same height, deliberately.** Calling a topic hard costs
a few extra questions on something the child can do, so `MIN_OBSERVATIONS` is
enough. Calling a topic *known* is the expensive mistake - it drops the topic to a
fraction of the questions and puts it away for days - so it needs a strong run
*and* `SECURE_OBSERVATIONS` answers *and* right answers on `SECURE_DAYS` separate
days. A run inside one sitting is one memory answering several times; the answer
that survives a night's sleep is the only thing allowed to count as mastery.

The review gap grows with `correctDays`, not with the streak: a couple of days for
something just learned, a month for something known five times over. A streak can
reach any length in ten minutes.

Days are the child's, not the server's: each attempt carries the UTC offset it was
given at. `correctDays` only ever counts a day later than the last counted, so
answers arriving out of order undercount - mastery is delayed, never faked.

Selection rules, in order - none of them ever rules a template out entirely:

- **No pattern, no steering.** Until one topic has `MIN_OBSERVATIONS` answers the
  weights are flat and questions are drawn at random.
- **Weight by status**, so hard topics come up more and mastered ones get out of
  the way without disappearing.
- **Weight the topic, not the template.** A topic's weight is divided across its
  templates, because template count is a fact about how much content got written
  and must never decide how much practice a child gets. Years ship with between one
  and five templates a topic.
- **Hold weak topics to a share of the session** (`MIN_FOCUS_SHARE` to
  `MAX_FOCUS_SHARE`). A fifth is enough to improve; past a bit under half it stops
  being practice and starts being picked on. The floor is skipped when the only
  topic needing work is the one just asked.
- **Cool down what was just asked.**

`weightTemplates` is exported because it *is* the policy. Tests assert shares over
a few hundred seeded draws rather than exact sequences.

**Selection is driven by correctness alone - time taken is reported, never acted
on.** Slow is also distracted, or asking a parent, and one number cannot tell those
apart. If that changes, the honest version is to gate *mastery* on fluency - a slow
correct answer still counts as correct but does not advance a topic towards
`secure` - never to weight a topic up for slowness.

The analytics side is a library only: `topicReports`, `problemTopics`,
`dueForReview`, `progressOverTime` and `summarise`. Buckets take a UTC offset from
the caller.

## UI

Standard iPad, landscape and portrait. Minimal and calm rather than playful -
simple enough for a child to pick up with no explanation.

- **Level is the home screen's top-level choice**: one dropdown labelled "Level",
  then the subjects offering that level below it, each card carrying a coloured
  glyph tile, the subject, its year, and its topics as **chips** (`MAX_CHIPS`, then
  "+n more"). Switching level swaps the cards in place - no navigation. The choice
  is remembered on `User.selectedLevel`; signed out or without a database it opens
  on Kindergarten. `resolveInitialLevel` falls back when a stored level has lost
  its content.
- **The play screen must fit the viewport with no scrolling.** `h-[100dvh]` with
  `overflow-hidden`; the answer pad is fixed-height and the question area flexes.
  Check both orientations and a phone as well as an iPad after changing it.
- **Height, not width, is what the play screen is short of.** The pad takes 40% of
  the height it is given, phone or tablet. What differs is the floor and ceiling on
  that 40%, and those ask for **height as well as width**: `sm:` is a width
  breakpoint standing in for "tablet", and a landscape phone breaks the proxy - it
  is wide and short at once, so it took the tablet's 16rem floor on the device with
  the least height. The larger bounds sit behind
  `[@media(min-width:640px)_and_(min-height:501px)]`. The speed run's pad carries
  the identical query, because the two screens must not disagree about "tablet".
- **One short-viewport line, and a second should not be invented.**
  `max-height:500px` means "landscape phone", and there is one use left: the pad's
  bounds take that boundary from the other side as `min-height:501px`. Written as a
  literal class name, since Tailwind reads class names as literals and a composed
  one compiles to nothing. Reach for it before adding a number beside it.
- **The question is one size, and the box is what is measured** (`Prompt`). The
  room depends on the device, the orientation, whether a target bar is showing and
  whether there is a figure, so the box is measured and the largest whole pixel
  size that still fits is searched for, re-run by a `ResizeObserver`. **What it is
  searched against is `PROMPT_SENTINEL`, not the prompt in hand**: the sentinel is
  `MAX_PROMPT_CHARS` long, so the size found is the worst case's and every question
  in the same box is set at it. The fitter used to measure the question itself,
  which made the type jump from ~96px to ~33px between questions - a fact about how
  many words the author used, not about the maths. Declaring a `clamp()` instead is
  refused because a declared size has to survive the worst combination on every
  device, so every device pays for the worst one. The fit test is "the sentinel
  fits **and** the prompt fits" - the sentinel binds, and the second half is
  insurance against unusually wide glyphs. `Prompt` takes no `key` off the question
  number; the effect keeps `prompt` in its dependency list, which is the only thing
  left that reruns the fit when the question does.
  Measured on a landscape iPad: no figure lands between 29px and 43px, with a
  figure between 15px and 16px - a range because the pad's shape decides what is
  left over. So a question is one size for every question of the same *shape*, and
  independence from length holds exactly.
  `--prompt-max` is the ceiling and where the two scales live: a phone keeps the
  `vh` ceiling, and from `sm` up it is twice that. It is registered with
  `@property` as a `<length>` in `globals.css` - an unregistered custom property
  computes to the word `clamp(...)` rather than a number. `PROMPT_CLASS` is what
  the server renders, so a prompt arrives about the right size, and it is what a
  browser without JavaScript keeps. A viewport too short to leave any room
  collapses the box to nothing and the fit stands aside: the question overflowing
  is bad, the question hidden is worse.
- **Every answer is given on-screen, never with the iPad keyboard.** `answerMode`
  in `src/lib/session/answers.ts` picks the pad (`NumberPad`, `LetterPad`,
  `ChoicePad`); all three occupy the same fixed slot.
- Tapped answers commit on the first touch, with no Check button. Typed answers
  keep a Check key drawn as a tick (`CheckIcon`) rather than the word, so a child
  who cannot read still knows it. The speed run is the exception and has none.
- After a wrong tap, the right option turns green and the child's turns red.
- **A right answer moves on by itself after a moment; a wrong one waits.** The pad
  gives way to a Continue button and the right answer stays until tapped. Tapped
  questions keep their pad while waiting - the buttons are what shows which option
  was right - and Continue sits beneath.
- **A template's `hint` sits behind a lightbulb** under the question, so help is
  asked for rather than pushed. Tapping swaps the bulb for the hint; it resets each
  question and goes once answered. Templates without a hint leave the row empty, so
  the question doesn't jump.
- **A fraction is drawn with a bar, not a slash.** `1/2` is what the expression
  language produces, not what a child is taught, and every shipped fraction is a
  proper fraction read as one thing - a slash looks like division, which is written
  `÷`. `src/lib/fractions.ts` decides which slashes are fractions
  (`splitFractions`, with the gap marker counting as a numerator so `?/12` draws as
  `?` over `12`) and `src/components/maths-text.tsx` draws them and decides
  nothing. `MathsText` is sized entirely in `em`, so it grows with whatever the
  fitter chose; the vinculum is `border-current`. Used on the prompt, the hint, the
  choice buttons and the feedback line. **The parent's report is deliberately left
  as text** - its rows are single-line and elided, and a stacked fraction is ~1.6
  line-heights tall. Nothing stored, graded or spoken changes.
- **The rewards are a break and a badge, never a running score.** The stars fill
  the screen between rounds and the streak flashes once a day; neither sits on the
  play screen. No per-question timer, and nothing a wrong answer takes away.
- Colours are CSS variables in `globals.css`, used as `text-(--color-ink)`.
- **The logo's palette is scoped to the two screens someone is *choosing* on.**
  `--color-grape`, `--color-berry`, `--color-leaf`, `--color-sun` are sampled from
  `public/logo.PNG` and used only by the landing page and the child's home screen.
  `--color-brand` is unchanged, so the play screen and the report are untouched.
  Both screens open on a soft gradient band (grape → paper → brand) with a blurred
  warm disc behind it; that band is the decoration and everything below is flat.
- **There are no native `<select>`s.** A `<select>`'s popup is drawn by the OS, so
  it is the one control the theme cannot reach. `src/components/select.tsx` is a
  button plus a listbox, in `lg` for the child's screens and `sm`/`md` for a
  parent's. The trigger is sized to its **widest** option - every label renders into
  one grid cell with all but the chosen hidden - so picking "Year 3" after
  "Kindergarten" doesn't shift what sits beside it. It closes on an outside
  pointerdown or Escape, never on blur: a tap on an option moves focus off the
  button first.
- **`src/components/clock.ts` is a browser shim** for the same reason as
  `sounds.ts` and `speech.ts`: it reads `Date.now()` and the device's own offset.
  The profile menu's run of days, the home screen's goal panel and the play
  screen's goal bar all read it through `useSyncExternalStore` rather than
  rendering at UTC and correcting a frame later. One `subscribeToTheClock` for all
  three.
- **Three sounds, and only on the play screen**: right, wrong, and a fanfare with
  the stars. `src/components/sounds.ts` is the shim. Playing is best-effort: a
  silent switch or autoplay refusal rejects `play()`, caught and dropped. One
  element per sound, rewound rather than stacked - the newest answer is the one
  worth hearing. Preloaded on mount, since iOS gates *playback* on a gesture but
  not loading.
- **The fanfare is the same for one star as for three.** Finishing the round is
  what it marks.
- `public/sounds/*.m4a` - mono AAC at 48 kb/s, silence trimmed and peaks levelled.
  ~5-13 KB each. AAC in `.m4a` rather than Opus because iPad Safari is the target.

## Narration

A child who cannot read cannot use the app: every question is a sentence. A speaker
button beside the door makes the question one of the things that needs no reading.

**The switch is on the child's screen, not the parent's.** The person who needs
narration cannot read a settings screen, and iOS will not speak without a gesture,
so the tap that turns it on has to be the thing that lets it talk. The preference
is `localStorage`, read through `useSyncExternalStore` - only the browser knows it,
so the server renders silence. A shared family iPad is the cost, and it is one tap
either way.

**Tapping the question repeats it**, and only while narration is on. A child who
missed it reaches for the words themselves; a child who can read never finds a
button where the question is. A revealed hint is read as it appears - asking for it
is a gesture that may speak - and answering stops the voice mid-sentence.

**Speaking a question is not reading its characters.** Prompts are generated, and
once the holes are filled they hold `+ − × ÷ = / % ° $`, abbreviated units, and a
bare `?` standing for a gap. Handed over as-is, "What is 7 − 3?" is spoken "What is
7 3?", worse than silence. `src/lib/speech/narration.ts` is the translation and is
pure: `spokenText` for symbols, `questionNarration` for a whole question. A `?` is
the gap when nothing wordlike precedes it and punctuation when something does.

**That fraction rule lives in `src/lib/fractions.ts` and narration imports it.**
The spoken form and the drawn form must not be able to disagree about which slashes
are fractions. `catalog.test.ts` renders every prompt, hint, answer and choice
across every shipped template and counts a slash outside a fraction as a failure.

**Word options are read out; numbers are not.** A word answer below Year 4 is
`choice` precisely because the child cannot spell it, so three unread buttons leave
it unanswerable. Numerals are read long before words. Options the prompt has
already *offered* are left alone - "Which ribbon is longer, red or blue?" needs no
"Is it red or blue?" after it. Offering is what counts, not merely saying the
words: "What comes next? red, orange, purple, red, orange, purple, red, ?" contains
all three options and offers none. The word that tells the two apart is "or",
between two options and inside one sentence; both must hold to skip the reading.

`src/components/speech.ts` is the browser shim. Speaking is best-effort, a new
utterance cancels the one before, and an en-AU voice is preferred where available.
It is also the seam - swapping in a cloud voice is a change to `speak` and nothing
above it.

## The logo

`public/logo.PNG` is the artwork as delivered. Everything else is cut from it and
committed beside it, so the derived files are what the app loads and the original
stays the thing to re-cut from:

- `public/logo-mark.png` - the badge alone, for headers. `scripts/logo-mark.sh`.
- `public/logo-lockup.png` - the whole thing, for the landing hero.
- `public/app-icon-1024.png` - the iOS App Store icon. `scripts/app-icon.sh`.
- `src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `opengraph-image.png` - Next
  wires these up by filename, so `layout.tsx` adds only a `metadataBase`.
  `icon.png` comes out of `scripts/logo-mark.sh`; the other three are still
  hand-cuts with no script, which is what let the defect below go unnoticed.

**The white page is flood-filled to transparency from the edges inwards**, not
keyed off luminance: the white *inside* the mark - the book's pages, the pencil's
eyes, the sparkles - has to survive. Without it the mark would sit on
`--color-paper` as a faintly paler square. The apple icon keeps an opaque
background, because iOS composites its own mask and a transparent one comes out
black.

**That survival rule was broken in `public/logo-mark.png` itself, and the fix is
`scripts/logo-mark.sh`.** The flood ate the book's right-hand leaf - about 9,900
pixels, including part of the dark wedge inside the open book. The two whites
*touch*, at the book's outer tips where a page edge meets the page behind it, so
a fill loose enough to clear the background runs straight into the pages; measured
on the master, it holds to 3% fuzz and is gone by 4%. **It was visible on
`--color-paper` too**, not merely latent on a coloured ground: the missing wedge is
dark, so the header mark had a notch out of its book the whole time.

**The repair is a union, not a re-cut**, and that distinction is the reason it was
safe to make. The mark's silhouette and a clean cut from the master agree to within
**108 pixels**, so a new outline buys nothing - but the mark's edge pixels carry
their own antialiasing against the page they were lifted off, and a fresh binary cut
would swap that for a hard edge on every header in the app. So the alpha is the union
of what the mark had and what a clean cut keeps: the boundary is untouched and only
the hole is filled. The master is taken across a 1px ring around the wound as well,
since the pixels bordering it are the flood's own contaminated antialiasing. The
script is idempotent, which is asserted by running it twice - without the binary
selection it re-blends the edge a little more each run.

**`src/app/apple-icon.png` and `favicon.ico` still carry the same defect, and are
deliberately left.** At 180px and below it is not distinguishable, and neither file's
framing is recoverable from the repo - `apple-icon.png` is the mark at 152 centred on
paper, which reproduces to only ~18% RMSE, so re-cutting blind would change them more
than the bug does. `src/app/icon.png` *is* regenerated, because at 192 the hole shows
and its recipe was confirmed: the mark at 180, centred, to within ~1% RMSE.

**So the App Store icon is cut from the master, not from the mark**, and separates
the two whites by *connectivity at a tight threshold* rather than by fuzz. It is
also the sharper source - the badge spans 544px inside the 1254px artwork, making
1024 a 1.88x upscale against the mark's 2.0x on top of its own downscale. There is
no vector master and no layered source; `public/logo.PNG` is the whole of it.

**The icon bleeds the blob's own field to the full square**, because the badge
carries a rounded silhouette of its own and Apple's mask would round it a second
time, leaving a ring of background between the two. The field is *interpolated
from colours sampled around the blob's perimeter* rather than filled flat: the
blob is gently shaded and its edge is a hard cut, so a flat fill leaves a visible
arc exactly where the two meet. `scripts/app-icon.sh` carries the rest of the
reasoning, including why the last erode exists. Apple **rejects an icon carrying
an alpha channel**, so the file is PNG colour type 2 and the script ends by saying
so.

**The mark alone is what goes in a header**, since "LearnR" is already there in
type. **Not on the play screen** - a logo in the corner is exactly the sort of
thing a child watches instead of the question.

## Rewards

`src/lib/rewards` - pure, and read by nothing that decides what to ask next. Stars
and streaks would make reinforcement reward-seeking rather than teaching.

**Stars come every `ROUND_SIZE` (10) questions**: 3 for a clean round, 2 for some
right, 1 for a round with none. The floor is the point - sitting through ten hard
questions is the behaviour worth rewarding. `RoundReward` covers the screen for a
few seconds, dismissable by a tap, and the next question's clock restarts when it
goes.

**`User.stars` is banked rather than derived.** It used to be
`SUM(LearningSession.stars)`, which was self-correcting and had to go the moment
the daily target arrived: a target is mutable, and a recount of a past day against
today's setting would take stars off a child who had earned them. So the total is
**incremented** and never recomputed. Nothing recounts, so the play screen's
optimistic `+3` is the only correction there is - which is why both it and the
server value a round with the same `closedRound` over the same answers.

What replaced the recount's idempotence is a guard on every increment. A round's
stars are banked against `LearningSession.roundsBanked`, read under `SELECT ... FOR
UPDATE` and moved up in the same transaction, so a repeat, a retry or two tabs each
pay for a round exactly once. The day's target uses a compare-and-set on
`User.targetDay`. The server **decides** what is owed by reading the stored
answers; the client only says *that* a round closed, and the banking happens after
the tenth answer's write resolves.

The cost is real: a dropped award no longer heals itself. A total can fail to grow,
but it can never shrink - the right way round for the only number a child watches.

**The play streak counts days, not hours.** `User.playStreak` and
`User.playStreakDay` - a day number, not a timestamp, because a day here is the
child's (`src/lib/day.ts`). A missed day restarts at 1, not 0: the child is
answering right now. The write is a compare-and-set on the stored day.
`currentStreak` decides whether a stored run is still alive - yesterday counts, the
day before does not - and is computed in the browser via `useSyncExternalStore`. An
hours rule was rejected: after school one day and before school the next is twenty
hours apart and would break a streak the child kept perfectly well.

**Both totals ride on the profile menu** - days, then stars, then the avatar, the
same control on the home and play screens. Days sit left of the stars: the run is
the thing that lapses. Behind the tap there is only the name and the way out.

**Everything the playing screens read off the child's row is one query**
(`readPlayerState`): level, streak, stars and target all live on `User`, and both
`/` and `/play` want all four. Asked for a function at a time that was four round
trips - a waterfall in front of the first question. The single-column readers that
remain have callers that want one thing: `readSelectedLevel` for `/play`'s
redirect, and `readPlayStreak` inside the streak fold.

Both totals are drawn through `formatCount` (`src/lib/format.ts`), which pins
`en-AU` rather than reading the browser's locale - they are rendered on the server
and corrected on the client, and a disagreeing locale is a hydration mismatch.

Neither is a score. A lapsed run renders as nothing rather than a zero - a 0 beside
a flame reads as a telling-off. The play screen flashes the streak once
(`StreakFlash`) on the answer that extends it.

## Daily targets

`src/lib/rewards/target.ts` - optional, one per child, set by their parent. It is
the one thing that asks a child to commit to something, so it is a floor and never
a cap: nothing stops them carrying on, nothing is taken away for missing it, and a
missed day produces no value at all.

**Questions or minutes a day, and not per subject** - twenty questions is twenty
whichever screen they were on, so every read behind a target is cross-subject where
`readObservations` is scoped. `TARGET_LIMITS`: questions 10-60, minutes 5-30, in
fives. The floors matter more than the ceilings - ten questions is exactly one
round - because the first thing this must not do is have a child fail at something
their parent chose. `parseTarget` is the boundary normaliser, like `parseYearLevel`.

**A minute is summed `timeTakenMs`** - already capped at `MAX_TIME_MS` - never wall
clock. It is the same number the report calls "time on questions", so an iPad left
on the sofa cannot earn minutes and the two can never disagree.

**Hitting it is worth `TARGET_STARS` (10), flat rather than scaled.** Scaling would
make a star total a measure of how much a parent asked, and hand a parent a dial on
their child's rewards. Ten is worth three or four clean rounds.

The award is one compare-and-set on `User.targetDay`. `awardDailyTarget` recounts
the day server-side before it writes; the client is trusted for the offset, not the
total.

**Which answers are "today" is decided on the child's device.** The server ships
`TARGET_WINDOW_MS` (two days) of answers and the client folds them with `dayTotal`
through `useSyncExternalStore`.

**The play screen's bar carries no numbers.** A minutes bar creeps during a
question, capped at `MAX_TIME_MS`, so what is shown can never run ahead of what
will be recorded. **The play bar goes once the goal is met and the home screen's
stays**: on the play screen a bar that no longer moves is only something to look at
instead of the question, while the home screen is where a child takes stock.

**The two celebrations queue, round first and day second** (`RoundReward`, then
`TargetReward`), because one answer can finish both and one tap cannot dismiss two
screens. `TargetReward` shares the round's shape and fanfare deliberately.

**The parent's practice calendar judges past days against the *current* target**,
since past targets are not stored. The note under it names the goal it is judging
by. `readRecentAnswers` returns `null` on a failed read and the calendar drops the
goal with it - four weeks drawn as four weeks of missed days is exactly the lie the
null convention prevents. On the play path the same read is best-effort (`?? []`).

**The offset is bounded at the action, not trusted** (`parseOffsetMinutes`). The
day it produces is *stored* - on `User.targetDay` and `User.playStreakDay` - behind
guards that compare against the day being written, so one absurd value would sit in
the future and quietly refuse every real day after it. A refused offset declines
the award; a recorded answer falls back to UTC rather than being thrown away,
because history is worth more than a perfect day boundary.

## Speed run

Ninety seconds, one mode, how many you can get right. It is a game rather than a
lesson - the first thing with a clock, a score and a number to beat, all three of
which the rest of LearnR deliberately withholds. That is safe only because it is
walled off from everything those rules protect.

**There is no wrong answer in a speed run.** A run moves on a correct answer and
nothing else: the entry is judged as it is typed (`judgeEntry`), and digits that
can no longer become the answer flash the box red and clear it, leaving the same
question up. Nothing is recorded about the attempt, so the score and the number of
questions answered are one number rather than two. That rule took the Check key,
Enter, the misses read back on the result, the right/missed/answered tally, the
`of 20` and the `answered` column on both `SpeedRecord` and `SpeedAttempt` with it.
It is the only place in the app where getting something wrong costs nothing but
seconds - which is why the *lesson* still marks answers and this does not.

**Sealed off because an `Attempt` carries a curriculum topic and a school year, and
a speed run has neither.** `add.hard` is a drill, not a question ACARA describes.
Recording it anyway would put a topic outside the curriculum into
`weightTemplates`, and forty answers in ninety seconds would swamp the
recency-weighted `strength` of every topic genuinely being learned. A speed run
writes no `Attempt`, no `TopicSkill`, no star and no streak, and earns no
daily-target credit - the only row it writes is `SpeedRecord` (and `SpeedAttempt`).

### Modes

**Twenty-six modes, and the list is closed.** A free "from"/"to" range across the
tables would give ~sixty, most differing from a neighbour by one table. A record is
only worth beating if the mode is worth naming, so `modes.ts` enumerates them by
hand: three difficulties each for addition, subtraction, division and mixed, plus
the ten single tables and four named bundles for multiplication.

**Nothing drills the ten times table**, in a mode of its own or in a bundle.
Multiplying by ten is a place-value rule rather than a fact to recall. That is
`SINGLE_TABLES` beside `TABLES`: the tables offered as a mode, and every table there
is. The top bundle is `11-12` rather than `10-12` for the same reason. Ten stays in
**`all`**, which would be lying otherwise, and in what a **mixed** run draws from.
Any `multiply.10` already banked simply stops appearing - every reader of a stored
key runs it through `parseMode` and skips a null.

**A single table is labelled the way it is said: "7x", not "7 times table."**
Fourteen labels differing in one character are the slowest thing to scan and the
widest to draw; the short form lets the picker lay singles out five to a row. A
bundle keeps the notation at both ends - "2x to 5x" - and `all` stays "All tables".
**`recordBanners` keeps the prose form** ("a personal best in the 7 times table"),
which is the `operationLabel`/`operationNoun` split: a chip is a control and a
banner is a sentence.

**An operation is labelled with the verb, not the noun**: "Add", "Subtract",
"Multiply", "Divide". `operationNoun` keeps the other form for prose -
`recordBanners` says "a speed run personal best in easy addition". It says **"a
speed run personal best"** because that banner is the only thing on a parent's
report not about practice, and no longer says "in 90 seconds" since every run is.
Two tables side by side in `modes.ts` rather than one derived from the other.

**Multiplication has no difficulty axis, because the times tables are how
multiplication is drilled.** Mixed still needs multiplication bands;
`MIXED_TABLES` gives it 2, 5 and 10 at easy, 2-10 at moderate, the full set at hard.

**Every answer is a non-negative integer, because the number pad has no minus key.**
Subtraction never goes negative - each difficulty's `y` is bounded by `x`, an
ordered var referencing one already drawn - and division is exact by construction
(`x: d * q`) rather than drawn and then checked. **Hard means hard, not just bigger
digits**: `add.hard` is constrained to carry and `subtract.hard` to borrow, because
without that constraint two-digit sums draw 20 + 30 about as often as 37 + 58.

### Choosing a run

**The cards, the cabinet and the leaderboard are one screen**, and the scores are
the top of it. **Every screen that offers a run shows them**: the child's home
screen under "Speed run", and a parent's `/speed`.

**Which tab a screen opens on follows who is reading it.** A child opens on their
own records; a parent opens on the **leaderboard** - how everyone in the house is
going is the question they arrived with, the same judgement that sends `/` to the
report. It is one answer (`CHILD_DEFAULT_TAB`, `PARENT_DEFAULT_TAB`) driving three
things that must agree - which tab is leftmost (`tabOrder`), which one the bare URL
means (`scoreTabHref`) and what a mistyped `?tab=` falls back to (`parseScoreTab`).

**There is no `/speed` page for a child** - a child asking for it is redirected.
The child's speed screen *is* their home screen. `CHILD_SPEED_HREF` (`/#speed-run`)
is the way back from a run without a page to keep in step; the anchor and the id it
lands on live together in `tabs.ts`, and `CHILD_SPEED_HREF` is built by calling
`scoreTabHref` rather than written out.

**`SpeedCards` has no links under it** - every caller draws `SpeedScores` directly
above the cards. `SpeedScores` is the shared half: the tabs, the two reads and the
signed-out and no-household sentences.

**The two walls are `?tab=` on one page, not a route each** (`parseScoreTab`,
`scoreTabHref` in `src/lib/speedrun/tabs.ts`). Still one URL per tab, both halves
server-rendered, and the page *knows* which tab it is showing, so `ScoreTabs` is a
plain server component. `parseScoreTab` **falls back rather than refusing**, unlike
`parseMode` and `parseYearLevel`: it only picks which panel is drawn, so a mistyped
tab opens the screen's own default rather than 404ing a working screen. It falls
back to that rather than a fixed favourite so a junk tab and a bare URL land
together. It is called inside `SpeedScores` rather than by each page.

**The scores sit above the cards** because what a player opens the screen for is
how they are doing. The parent's copy is two `Well`s, "Scores" and "Start a run".

**On the home screen the tabs carry an anchor** (`scoreTabHref`'s `hash`,
`#speed-run`), because the speed section is below practice there. It is a parameter
rather than always-on: on `/speed` the tabs are already at the top.

**`tabPath` and `runPath` are two questions, not one.** A tab is a URL on the
screen the scores are *on*; a run lives under `/speed/...` however that screen was
reached. One `basePath` doing both built `//multiply` on the home screen, which a
browser reads as a host called `multiply`.

**Every card carries a Try button, and it goes straight into the run.** One
`SpeedTryLink` serves both walls, since the cabinet's card and the leaderboard's
card are deliberately the same object.

**Choosing a run is one screen, and the mode is the route.** The operation card
**opens in place** (`SpeedCards`) and its modes are the buttons that start the run,
so it is two taps and the second one *is* the run. The old second screen at
`/speed/<op>` is gone rather than hidden, and it took `SpeedRun`'s `'choosing'`
phase, its `Chooser`, its `scale` and its `op` prop with it: `SpeedRun` takes a
`Mode`, and its first paint - the server's included - is the count-in. It still
starts the run in a mount effect rather than a lazy initialiser, because starting
one reads the clock and makes a seed.

**So `/speed/multiply.7` is a route and `/speed/multiply` is not.** A route that
only works with a query is a route lying about what it is. The mode segment makes
`parseMode` the whole of the validation, where the old pair needed that *plus* a
check that path and query agreed.

**The picker is a `<details>`, not client state**: the modes render with the page,
the disclosure is the whole interaction, and `SpeedCards` stays a server component
a browser running no JavaScript can open. All twenty-six modes are in the HTML. The
cards became a **stack** rather than a two-column grid when they gained something
to open. **Opening one closes the others, and that is `name` on the `<details>`** -
the platform's own accordion, so this still needs no client component. An engine
too old to know the attribute leaves them independently openable, which is a screen
that works rather than a broken one.

**Multiply gets two grids, because it has two kinds of chip.** "7x" and "11x to
12x" want different widths. The ten singles get a dense run of small square
targets, **five to a row from `sm` up at either scale** so the two rows match, and
the four bundles the ordinary wide row beneath: four rows where there were seven.
`isSingleTable` lives in `modes.ts`, not the component.

**A child's phone gets two columns everywhere it can, and the difficulties get
one.** Three chips into two columns is 2+1, and "Moderate" is the widest label in
the picker. So difficulties stack, and the multiply card runs two across on a
phone. That costs the open Multiply card real height and buys a target a thumb hits
without aiming. From `sm` up: five tables to a row, four bundles, three
difficulties.

**A chip is coloured by how hard it is, green through to purple**, one ramp for all
twenty-six (`modeHardness`). **The times tables ramp across it too**, which is the
answer to what colour multiplication should be: they have a difficulty order of
their own. A single table takes its place from its **position** in `SINGLE_TABLES`
rather than its value, so the missing ten leaves no gap; a bundle takes the mean of
its tables, putting **`all` in the middle** - a run of everything is the mixed run,
not the hardest. The three colours per chip are **mixed rather than picked from a
table**, unlike `OPERATION_ACCENT`: an accent is one of five names and a ramp is a
continuum. `color-mix` **in `oklch`** here where the calendar uses `srgb`, because
sRGB runs green to purple through a muddy grey. The text is darkened off the ramp
rather than being the ramp colour (`--color-leaf` on a near-white wash is under
3:1). `--tone`, `--tone-soft` and `--tone-ink` are registered with `@property`, so
an engine without `color-mix` draws the ordinary card colours instead of drawing
them wrong. Nothing but the colour reads `modeHardness`.

### Running and results

**The timer is one CSS transition, and only the pulse comes from React.** The bar's
width is set once, as a transition running down to zero; a bar re-rendered from
state ten times a second would repaint the whole screen to say what a transition
says for free. `pulseFor` steps the animation faster at 30, 15 and 5 seconds left.

**The next question sits above the current one, dimmed, and it is real state, not a
render trick.** Reading ahead is most of what makes a fast run fast, so `RunState`
carries a lookahead of one: the question drawn as "next" *is* the one that becomes
"current". An answer commits the instant what is typed matches the expected answer
as an exact string - so `07` for 7 is a leading zero the answer does not begin
with, and it is dead on the keystroke. A dead entry clears itself immediately: at
this speed a stuck entry costs more than the mistake, and it is paid most by the
child mistyping most. Nothing is shown about what the answer should have been.

**The speed run's pad has no tick, no decimal point and no Delete** (`NumberPad`
takes all three as options; the play screen passes all three). Every answer is a
whole number by construction, so a `.` is a key that can only kill what it lands
in, next to the `0` it would be mistaken for. Delete goes because a dead entry
already clears itself, so a backspace has only a digit thought better of left to
undo. A physical Backspace still works.

**What that buys is the fourth column for `0`, full height** - the Check key's own
slot in an ordinary key's clothes, and the pad keeps four columns. About a third of
answers contain a nought and on the bottom row it was the one digit a thumb had to
travel for. Styled like every other digit, because it *is* a digit.

**The way out of a result is the door, top-left, exactly where the play screen puts
it.** **Going again is a glyph too** - a loop, what repeat looks like on every
remote a child has used. Both keep their words in `aria-label` and `title`. What is
left is a big coloured loop with "See records" under it, and **neither is drawn as
a box**: two filled buttons made a toolbar of a screen with one number on it. "See
records" lands where the door does, so `SpeedRun` takes no `recordsHref`.

**The result screen wears the colour of the operation just run.**
`OPERATION_ACCENT` is one table shared by the cards, the cabinet and the result.
Its `wash`, `text` and `solid` classes are written out in full per operation
because Tailwind reads class names as literals. A beaten best overrides the lot
with the star tokens: the rarest state has to be the one a player already
recognises. Under the score there is nothing. The two blocks arrive on a staggered
`reward-in`, and the score centres itself in the viewport.

**And the result says when a run moved the player on the family board.** It is the
one leaderboard fact that is *news*, so it sits on the result and nowhere else.
`standingChange` (`src/lib/speedrun/leaderboard.ts`) hands back null when **nobody
else runs that mode** - a board of one is not a leaderboard - and when **the place
did not change**, which is most runs. A place can only improve from your own run,
so a standing repeated every time would be furniture. Arriving counts as a move,
with `previousPlace` null, and reads "You're 3rd in the family" where a climb reads
"Up to 2nd". Ties share a place (`placesFor`'s rule). The rank is computed from the
*rivals'* bests alone and read **after** the write. Best-effort and quiet: a
household that cannot be read costs the line, not the result. `readStanding`
resolves the family through `householdId` and `householdMemberIds`, lifted out of
`readFamilyRecords` rather than written twice.

**A first run is not a record.** Recording one would make a personal best mean
somebody *improved*, and would let a child working through the modes fire
twenty-six notifications at their parent in an afternoon. The result screen says
"that's your score to beat" instead, and has a fourth case for a run never banked
at all (signed out, no database, failed write), where it claims no best rather than
pretending the run was a first one. `seen` is `false` if and only if a run is
reported as a record, on the write and the read alike.

**A run that got nothing right is never submitted.** Banking a nought would store a
best the first real attempt then "beats". Since a run only moves on a right answer,
a score of nought and a run nobody touched are the same thing.

**A record needs no row lock**, unlike `roundsBanked` or `targetDay`. A speed
record is a maximum, and a maximum is idempotent: `best: { lt: run.correct }` in
the update's `WHERE` is the whole guard. The one place that needs care is the
*insert* - two concurrent first-ever runs can both read no row. Same race as
`TopicSkill`, handled the same way: catch the unique violation and retry once.

### Records, cabinet and leaderboard

**The cabinet lists what has been run, and nothing else.** Twenty-six rows of
dashes made a to-do list of a trophy case. A player with no runs gets one sentence;
the prompt to go and play is the five cards above.

**The cabinet is the leaderboard's card, with a table where the podium goes.** Same
coloured title bar, foil sheen, fixed portrait frame and `OPERATION_ACCENT` - the
two screens answer neighbouring questions (how the house is going, how *I* am
going). A podium is the wrong picture for one player, so the picture is that
player's `HISTORY_RUNS` (5) best runs at the mode, highest first, **the top one
bold and starred**. Only one row is ever starred, even when a later run matched it:
the star marks the run that *set* the best, which `achievedAt` names. Cards are
ordered freshest first on the runs *shown*.

**`SpeedAttempt` is that history, and `SpeedRecord` stays the maximum.** Every
finished run is written down whether it beat anything or not - the run that failed
to beat the best is exactly the kind that says whether the best was a fluke. The
two writes go together in `submitSpeedRun` and are independent: the record decides
what the result says, the attempt is best-effort. It needs no lock and no guard -
an insert is neither a maximum nor a counter, so a retry writes a second row, which
is the honest reading of two runs anyway. `readSpeedAttempts` slices the top five
per mode with a `ROW_NUMBER()` window, the shape `readAnsweredQuestions` uses and
for its reason. `runHistory` (`src/lib/speedrun/history.ts`) is the pure half.

Every record set before the table existed is backfilled as **one** run each,
carrying the record's own `achievedAt` - one run is all that can honestly be
recovered.

**A run is stamped with the server's clock when it is submitted.**
`SpeedAttempt.playedAt`, and the `SpeedRecord.achievedAt` a beaten best takes
from it, both come from the moment `POST /api/v1/speed/runs` lands - a second or
two after the run ended. A client-supplied `playedAt` existed for an offline
queue flushing runs hours after they were played; the browser submits the instant
a run ends, so the field and the `parsePlayedAt` that bounded it are both gone.
The column keeps its `@default(now())`, so none of this needed a migration.

**The id is still minted once per run, on the client**, and it is the whole of
the guard on the insert: a unique violation on it means the run is already stored
rather than that anything went wrong. Two runs that scored the same are still two
runs - only a repeat of the same id collapses.

**A parent's report gets a table instead of the cards** (`SpeedTable`, in the
`Speed runs` well on `/progress`). The cards are collectibles built for the player;
a parent skimming is reading down a column, so the same data is one row a mode: the
best, the **latest** run, and the change between that run and the one before.
**The latest run is the number in the middle, and the best is only the standing
figure** - a best cannot fall, so a table of bests reads the same whether a child
improved, plateaued or stopped a fortnight ago. The change is a percentage of the
previous run except where that run scored nought, where the count gained is the
only honest thing. A first run gets an em dash rather than a zero. Rows are ordered
by when a mode was last played, freshest first.

`speedSummaries` (`src/lib/speedrun/summary.ts`) is the pure half and
`readSpeedSummaries` the read. It takes the latest two runs per mode **and** the
best, with two `ROW_NUMBER()` windows over the same rows: one ranks by score so the
best survives however old it is, one by recency so the pair the change is measured
from always does. The best is the maximum over what came back, so the table can
never claim a best none of its own rows could have set.

**The family leaderboard ranks the household, per mode, first to third.** A
household is `User.parentId` read from both ends, which `householdId`
(`src/lib/children.ts`) resolves for whoever is looking - `parentId` alone, so
there is no second column to drift. A **parent is on the board**, since they play
too. A child on their own Google account and a parent with no children have no
household at all, and get a sentence rather than a board of one.

**A viewer a child was shared with widens the board, on both sides.**
`readFamilyRecords` (`src/server/speed-records.ts`) reads the household, then every
`ChildShare` touching it in either direction, and `extendHouseholdWithShares`
(`src/lib/children.ts`, pure and tested) adds only the viewer and the specific
child a grant names, never the rest of either side. A sibling nobody shared stays
off both boards.

`familyStandings` (`src/lib/speedrun/leaderboard.ts`) is the ranking, pure and
tested, and needs no schema: a leaderboard is `SpeedRecord` rows sorted. **A tie
shares a place and skips the next** - 1st, 1st, 3rd - because in a family of three
a tie is common and breaking it hands someone a second place they did not lose;
within one, whoever got there first is listed first. The cut is at three *places*,
not three rows. Only modes somebody has run appear, ordered **freshest first** by
the newest `achievedAt` among a card's *places*, so a fourth-place run does not
reorder the board. Equally fresh modes keep `MODES` order.

**A mode is a collectible card, and its result is a podium.** A coloured title bar
carrying the whole name - "Add - Easy", "Multiply - 7x" - and the podium beneath.
The frame is tall and portrait because a podium needs height more than width. First
sits at the top with a crown above the circle, second below to the left, third
lower to the right, so no two sit on one line. Each place is a face with its score
beneath: **both the crown and the score are captions to the face, and neither may
cover it** - the board shows faces instead of names precisely so a pre-literate
child can find themselves.

**A place nobody holds is drawn as a hole punched through the card**, not left out:
a recessed circle with a dashed rim says the place exists and nobody is in it,
where a card missing a third of its picture reads as one that has not loaded.

**The card carries a foil sheen**: white at low opacity over the operation's wash,
a soft light from the top-left and one diagonal band, plus a hairline along the top
of the title bar. One gradient shared by every card rather than a per-accent one,
and it sits *under* the podium - a gloss across a child's face would be decoration
spoiling the one thing the card is read for.

The podium is laid out by *place* rather than list position, so a shared first puts
both faces on the top step. Six cards across on a desktop, five on a landscape
tablet, four portrait, two on a phone, and **every card a fixed height**: a grid
row stretching its cards to whichever wrapped its label makes the next row a
different size. `OPERATION_ACCENT` gained a `line` alongside `border`, since
`border` was only ever a hover.

### Density and routes

**A parent's speed screens run at the parent's density, but the run itself does
not.** `SpeedCards` takes the same `scale` prop `SpeedRecordsCabinet` has and
carries it down to the mode chips: at `'parent'` they are `text-base`/`text-sm`,
single-width borders and `rounded-xl`. `SpeedRun` takes no `scale` at all - the
ninety seconds are identical for everyone, since a question readable at a glance
and a pad hit without looking are not things an adult wants smaller. The line is
between choosing and playing, not between who is playing.

**Going back is not going home**, so `SpeedRun` takes both. The door inside a run
lands on the screen the run was started from - `/#speed-run` for a child, `/speed`
for a parent - because what someone is usually undoing is "I picked Multiply". The
result screen's own door still goes to the top of home.

**A parent plays too, privately.** `/speed/[mode]` renders the same component the
child gets, and a parent's runs bank to their own `SpeedRecord` rows.
`SpeedBanner` reports someone else's achievement and never your own:
`readUnseenRecords` is scoped to a parent's *children*.

**`/speed` and `/speed/[mode]` are one pair of routes serving whoever is signed in,
branching on the reader rather than on the URL.** These used to nest under
`/progress/speed`, on the argument that a route group adds no path segment so a
bare `(parent)/speed` would sit a hyphen away from the child's `/speed/...`. What
retires that is that there is no second path left to confuse: the two routes were
never two screens - `/progress/speed` rendered the same `SpeedScores` and
`SpeedCards`, and `/progress/speed/[mode]` the same `SpeedRun` with two different
hrefs. So `readViewer` (`src/app/(parent)/parent.ts`) reads the role without
deciding anything on it - `readParent` beside it is a *gate* and redirects, the
wrong shape for a screen serving two kinds of reader - and each route branches
once. **A child is redirected rather than served**, to `CHILD_SPEED_HREF`; a
signed-out visitor goes the same way. `PARENT_SPEED_HREF` is the one place the
parent's path is named.

The `/speed` page draws `ParentShell` itself rather than inheriting it, since it
sits outside the `(parent)` route group. `ParentNav` reads the URL, so "Speed run"
highlights from here as it did from under `/progress`. What the move buys
`useParentScreen` is the end of an ordering constraint: `/progress/speed` and
`/progress` both matched a speed URL, so the specific one had to be tested first.
The three prefixes are disjoint now. The cost is one account read on the child's
run path.

## Accounts

There are two kinds of account, `parent` and `child` (`User.role`), and **a Google
sign-in can only ever produce a parent**. A child is a profile their parent made -
no email, no `Account` row - and a login code is their only way in, so signing in
with Google *is* saying you are a grown-up.

It used to be a choice, and what retired it is that the second card produced an
account nobody managed. A self-declared child had `parentId` null, and `parentId`
is the whole of what fixes a level - so `/play`'s redirect of a mismatched
`?level=` did not apply, and the year a parent set was bypassable.

**The compare-and-set outlived the chooser it was written for.**
`claimParentRole` is still `UPDATE ... WHERE role IS NULL`, so a role already set
is never overwritten - a managed child cannot be promoted by any path, and
`sharing.ts` writes the identical statement inside its acceptance transaction.

**It is claimed on the sign-in event, and healed on `/`.** `events.signIn` in
`auth.ts` is the door every Google account comes through, including accounts that
predate the column. A session does not expire, though, so an account still holding
one from before that event would never pass through it - which is why `/` claims
the role too when it finds a signed-in account without one. Every other parent
screen redirects a null role to `/`, so that bounce heals rather than loops.

A **parent does not play**, so they get neither the level picker nor a subject
card. They get two screens, and **the report is the one they land on**: `/`
**redirects a parent to `/progress`**. Only a parent with no children yet gets a
screen at `/`: a sentence and an "Add a child" button. A failed read is not "no
children" and is not redirected.

`/children` is the other screen: a card per child with name, avatar and level, plus
add, edit, remove and the login code. It does not link to the report - the nav
above already goes there and the report picks its own child. Both screens sit in
`ParentShell`, which carries the title, the nav, the profile menu and the
curriculum link - the last follows every signed-in branch, and is a panel rather
than a footnote, since a line of small print is the shape of something nobody is
meant to click.

**The shell is a layout, not something each page draws.** Both screens live in
`src/app/(parent)` and `layout.tsx` renders `ParentShell` around them, so hopping
between them replaces only what differs. A layout is never told which page it is
wrapping, so the title and the current nav item read the URL from the client
(`ParentHeading`, `ParentNav`), and `resolveChild` picks the child `?child=` names
so the heading and the report can't disagree. The layout is a frame and not a gate:
it does not re-run on a client-side hop, so `readParent` - where the sign-in and
parent-role checks live - is called by the pages too, and `cache`d.

**The child card's buttons are all glyphs.** Every card says the same thing with
them, so the words were only taking up width. The code button keeps three states
and gets a picture for each: a **key** when there is no live code, and an **eye** -
struck through once on screen - for revealing and hiding. Two pictures, because
issuing and revealing are not the same act. Labels move to `aria-label` and
`title`. Remove is a bin rather than a cross: a cross on a card reads as "close
this".

**Removing a child is confirmed in the card, never with `confirm()`.** The browser
dialog is unstyled, unreadable on an iPad and synchronous, and it cannot say what
is being lost - which is the only reason to ask. The confirmation names the child
and says the answers, progress and login code go with them.

**A parent's screens say the level short**: `shortYearLabel`, so Kindergarten reads
"Year K" beside every other "Year n". The child's own screens keep `yearLabel`.

**Parent screens are not built to the child's scale.** `ParentShell` and everything
under it run denser: `text-sm`/`text-base` body, single-width borders,
`rounded-xl`, `px-3 py-1.5` buttons. The one exception is the login code itself,
read off this screen by eye and typed into another device.

A **managed child** is a `User` row with `parentId` set, no email and no `Account`
row. Because it is an ordinary user row, `LearningSession`, `Attempt`,
`TopicSkill`, `records.ts` and the play actions work on it unchanged. `parentId` is
the only flag that matters downstream: it is what fixes the level *and* the
subjects. A managed child gets `SubjectCards` for their `selectedLevel` with no
dropdown, and `/play` **redirects** a mismatched `level` parameter back to theirs.

**Which subjects a child practises is their parent's too** (`User.subjects`), set
in the same form as the level and enforced the same way - the home screen draws
only those cards, and `/play` refuses any other subject rather than trusting a
hidden card to be the whole of it. **At least one, and that is decided at the
boundary**: `parseSubjects` (`src/lib/subjects.ts`, beside `parseYearLevel` and
`parseTarget`) drops anything the catalog has no content for and returns null when
nothing is left, so an empty choice fails the whole save the way an unparseable
level already does. Which subjects exist is derived from the shipped templates, so
`availableSubjects()` is passed in rather than declared in `src/lib` - the same
shape as `resolveInitialLevel` taking its levels.

**A refused subject goes home; a wrong level is corrected.** The two redirects
differ because the URLs are asking for different things: a mismatched level still
names a lesson this child is allowed, so correcting it lands them where they were
going, while a subject they were not given names one they are not - and silently
starting a different lesson is worse than showing them the cards that are theirs.

**An array column rather than a join table**, for `ShareInvite.childIds`' reason:
a handful of short strings, written whole on every save and read whole beside the
rest of the profile. It rides on the row `readPlayerState` already reads, so
gating the play screen costs no query. Its `@default(["maths"])` **is** the
backfill - every row predating the column came out maths-only, which is the honest
reading of an app that shipped maths first and added English later: nobody's
parent had been asked yet, so nobody was silently opted in. A new profile starts
on maths alone for the same reason, so an old profile and a new one mean the same
thing.

**An empty list reads as every subject, not as none** (`subjectsAllowed`). A child
cannot be saved without one, so an empty list is a row disagreeing with itself,
and the answer to that is the screen they had before this feature rather than a
home screen with no cards on it - the trade the play screen already makes when a
profile read fails. A refused save is the parent's to see; a child stuck at a
blank screen has nobody to tell.

**The parent's report is not gated on it.** `/progress` lists every subject with
content whatever the child is currently offered: taking English away stops new
English questions, and a report that hid the English already done would read as
though it never happened. Nothing on that screen is a way to practise, so there is
nothing there to gate. **The speed run is untouched** for the reason it is walled
off everywhere else - a run has no curriculum subject and writes no `Attempt`.

**A child with no parent is a shape the app no longer creates.** The level dropdown
is still what `/` draws for a `child` row without a `parentId`, but nothing can
mint one any more.

**Signed out, both ways in live in the landing page's top bar as peers** - a
grown-up signs in with Google, a child types their code. On a phone there is no
room to say that side by side, so below `sm` the pair goes behind one "Get started"
button and opens as a panel where each gets a full row and a line of copy.
`GetStarted` renders them **once** and re-lays them out in CSS (`sm:contents`
dissolves the wrapper) rather than shipping two copies of the code box.

**The landing page says what this is and who it helps, not how it is built.** How
the selector weights a topic, that questions are generated - all true, none of them
what a parent deciding in thirty seconds is asking. So the page is a hero, a panel
each for *what your child gets* and *what you get*, three numbered steps, and the
coverage. The single exception is the curriculum, the one claim a parent can
actually check - rendered straight from the shipped templates (`subjectOverview`),
so the page cannot promise more than the questions deliver.

**Login codes.** A parent generates a 4-character code (`src/lib/login-code.ts`)
that a child types on the sign-in screen. The charset excludes `0/O` and `1/I/L` -
a code is read off one screen and typed into another. Randomness is injected, but
the caller must pass `crypto.randomInt` and **not** the seeded `Rng`: replayability
is exactly the property a login code must not have.

**The short-lived thing is the code, not the login.** A code lasts an hour and is
spent at redemption - `UPDATE ... RETURNING` clears it and identifies its owner in
one statement, so two taps cannot both get a session, and issuing a new code
invalidates the old by overwriting it. The session it creates does not expire on a
schedule. Two halves of one decision: the window protects the handoff, and once the
child is in they stay in. `Session.expires` is not nullable, so "does not expire"
is a date far enough out never to arrive.

**Guessing a code is throttled, per browser.** The charset is 31 characters and
the code is 4, which is 923,521 codes; `redeemLoginCode` matches **any** live
code rather than one child's, so a guesser is attacking the pool of every code
out at that moment; and a hit buys a session that never expires. The window and
single-use redemption were always the argument for why four characters was safe,
and an unbounded number of guesses is what would have retired it.

`src/lib/throttle.ts` is the pure half - a fixed window of failures per caller,
`now` injected - and `redeemLoginCodeAction` is its one caller:
`REDEEM_FAILURE_LIMIT` (10) failures per browser per 15 minutes, keyed off the
address the request arrives from. It is **best-effort**: a Vercel Function's
memory is per-instance and a cold start forgets, so it raises the cost of
guessing by a large factor without being a wall. A shared store is what would
make it one, and it is not worth a dependency at this size.
(`REDEEM_BACKSTOP_LIMIT` is the API's own backstop, left in `login-code.ts` with
nothing reading it.)

**Only failures count and a success clears the caller**, so a child mistyping and
then getting it right spends nothing, and a guesser has no success to clear with.
**A global ceiling across all callers was rejected**: it hands an attacker a way
to lock every child in the service out of signing in, which is worse than the
guessing it prevents. Lengthening the code is the other lever and is a product
decision - four characters is short enough for a child to carry across the room.

**Showing a code and issuing one are different actions.** One button carries three
states: "Get code", "Show code" (revealing what is already stored - a child may be
halfway through typing it), and "Hide code". Regenerating is its own button under
the revealed code. The code is centred with a copy button beside the digits, since
copying is the other way it reaches the child's device. The copy turns into a tick
for a moment: a clipboard write is otherwise invisible. The write is best-effort.

`isCodeLive` is the pure test picking between the first two states, and the hour is
counted down in an effect rather than at render.

Redemption is **not** a NextAuth provider. Auth.js refuses to combine a Credentials
provider with database sessions (`UnsupportedStrategy`), and moving to JWT sessions
would cost server-side session state for nothing. Instead `redeemLoginCode` writes
the same `Session` row the Prisma adapter would and the action sets the same
cookie - `auth()` cannot tell the two paths apart. That only works if both agree on
the cookie, so `auth.ts` pins `SESSION_COOKIE_NAME`/`SESSION_COOKIE_OPTIONS`
explicitly rather than leaving Auth.js to switch the `__Secure-` prefix implicitly.

**`/signin` is where a sign-in goes when it does not work, and it is not
optional.** `auth.ts` names it as `pages.signIn`, and Auth.js resolves *every*
`SignInError` against that setting - `AccessDenied`, `OAuthCallbackError`,
`OAuthAccountNotLinked` and `MissingCSRF` - so it is not a screen anybody navigates
to on purpose. It shipped missing for a while, which made declining on Google's own
consent screen land on a 404. `GET /api/auth/signin` redirects here too, with a
`?callbackUrl=`. Deleting the `pages.signIn` line instead would let Auth.js render
its own unstyled page, which is the objection this app makes to a native `<select>`
only louder. It carries **both ways in as peers**, and holds harder here: somebody
bounced out of a sign-in is exactly who might have tried the wrong one. A signed-in
visitor is redirected home.

`src/lib/signin.ts` is the pure half: two boundary normalisers. `authErrorMessage`
turns an `?error=` code into a sentence about the account rather than the protocol,
and **falls back rather than refusing** (`parseScoreTab`'s reason): Auth.js may add
error types in a minor release. Only the codes a single Google provider can produce
are named. `parseCallbackUrl` refuses anything but a path inside this app, since it
decides where a freshly signed-in session is pointed. `//host` and `/\host` are
refused by name, because a slash a backslash disagree about is where an open
redirect lives.

**Spending a code has three answers, not two** (`RedeemStatus`). `redeemLoginCode`
returned `null` for four different things - no database, a code that would not
normalise, no live code matching, and a transaction that threw - and the screen
said *that code doesn't work, ask your grown-up for a new one* to all of them.
Told to a child whose code is good and whose database was merely waking up, that
is a lie that sends them to a grown-up to fix something that is not broken; Neon
comes out of autosuspend while already accepting connections, which is the same
cold start `scripts/migrate.mjs` retries P1002 for. So `unavailable` is its own
answer and says so without blaming the code. It is the null convention arriving
where getting it wrong locks a child out rather than drawing an empty chart.
**Only a `rejected` counts toward the lockout** (`isGuess`): an unreachable
database is not somebody trying codes, and counting it would let an outage spend
a child's ten attempts and then lock them out for fifteen minutes - the throttle
punishing the one person it exists to protect.

`src/server/accounts.ts` holds the Prisma side, following `records.ts`: every child
mutation scopes its `where` by `parentId` as well as `id`, because the child id
round-trips through the browser. Unlike `records.ts` these are **not**
best-effort - a silently failed login is a child locked out and a silently failed
removal is a parent lied to.

## Profile pictures

A parent can give a child a photograph, and **the preset animal is what shows when
they have not**. The eight animals in `src/lib/avatars.ts` are still the fallback
everywhere - a photo is an addition to that list, not a replacement.

**Nothing is uploaded.** `src/components/photo-crop.tsx` decodes the chosen picture
with `createImageBitmap`, draws the circle's square into a 256px canvas and encodes
WebP, so what reaches a server action is ~20KB whatever the camera produced. That
is why there is no size limit and no MIME allow-list on the way in: the test of a
picture is that the browser could decode it. It is a browser shim for the usual
reason - `File`, `createImageBitmap` and `<canvas>`.

**The geometry is pure and tested** (`src/lib/photo/crop.ts`): `coverScale` is the
zoom floor at which the picture covers the window, so a crop with an empty crescent
cannot be produced; `clampOffset` is what a drag may not do; `sourceRect` is the
square handed to `drawImage`. There are no component tests to catch it later -
vitest is node-only.

**`parsePhoto` is the boundary**: only a `data:image/webp;base64,` string under
`MAX_PHOTO_BYTES` is ever stored. A photo arrives through the browser, so a remote
URL accepted here would make every screen that draws this child fetch something
somebody else chose. The byte cap is defence against a hand-rolled call.

**`ChildPhoto` is a table, not a column on `User`.** The Auth.js adapter selects
whole user rows on every authenticated request, and a photo has no business riding
along with a session lookup; the row is joined only where a face is drawn. It
cascades with the child, so the removal copy's promise stays true.

**`ProfileFace` is the one place the fallback order lives**: photo → the Google
picture a grown-up has → the preset animal → the initial → a silhouette. Six
screens draw a face. Threading it through the profile menu fixed a bug it walked
past: a managed child has no Google `image`, and that menu had never looked at
their `avatar`.

**The leaderboard shows faces and no names.** Everywhere else a face sits beside a
name; there it replaces one - the board is the screen a pre-literate child reads
for themselves. The name moves to the face's `alt` and `title`. There is no "you"
chip either: the viewer's own face is the one they know by sight. A grown-up with
no Google picture is a lettered circle among photographs; that is the honest cost.

## Sharing a child

A second grown-up - a separated parent, a grandparent, a tutor - can be given a
child's report and nothing else. `src/server/sharing.ts` is the Prisma side, beside
`accounts.ts`; `src/lib/share-link.ts` is the pure half, beside `login-code.ts`.

**Read-only is a property of the schema, not a check anyone has to remember.**
Ownership is still `User.parentId` alone, and every mutation in `accounts.ts`
already scopes its `where` by it - so there is no query in the app that edits a
child and can be reached through a share. Adding viewers therefore changed none of
them. A permission column consulted by each caller would have been the same feature
with a place to forget, and this is the one part of the app where forgetting means
showing one family another family's child.

**A `ChildShare` row carries no `ownerId`.** Who owns the child is `User.parentId`,
and a copy here would be a second truth. A revoke scopes itself through the child
(`child: { parentId }`), which cannot drift from ownership because it *is*
ownership.

**The link is short-lived and single-use; what it buys is not.** `ShareInvite`
lasts `INVITE_TTL_MS` (7 days, not the code's hour - an adult opens a message after
the weekend) and is spent at acceptance; the `ChildShare` it leaves stands until
revoked. Acceptance is one `UPDATE ... RETURNING` on the token *and* a null
`acceptedAt`, like `redeemLoginCode`. The token is 32 characters of a 62-character
alphabet rather than four of a reduced one, because nobody reads it aloud - and
`crypto.randomInt`, never the seeded `Rng`.

**Accepting again by the same person is not a failure.** Signing in *is* the
acceptance - Google's round trip returns to `/share/<token>?go=1` and the page
takes the invite on arrival - so a reload must not read as a dead link.
`acceptShareInvite` returns success for the viewer who already holds it, which is
what makes the auto-accept safe.

**`ShareInvite.childIds` is an array, not a join table**, because it records what
was *offered* rather than what is granted: written once, read once, and every id in
it is checked against the issuer's current children at acceptance. A child removed
in between is simply not granted. The page behind the link runs the same filter.

**A new account arriving through a link is a parent like any other Google sign-in** -
the same compare-and-set on `role IS NULL`, written out inline because it has to
run inside the acceptance transaction. A viewer is an ordinary parent account: they
can add children of their own. A signed-in *child* account is refused at the page.

`readViewableChildren` is what every parent screen resolves `?child=` against - own
children first, then shared - so a child not in it is not reachable by typing its
id. Shared children come back with `access: 'viewer'`, no login code (never
selected, rather than selected and blanked) and the name of the parent who shared.

## Parent analytics

`/progress?child=<id>&subject=maths` - a parent picks a child and sees how they are
going. It reads and renders; nothing on it writes. It is also **where a parent
lands**.

**The child id is never trusted.** `listChildren(parentId)` returns both the
dropdown's options and the set of ids this parent may look at, and the parameter is
resolved against that list. There is no separate ownership check to drift.

**Whose days these are is the child's question, not the parent's.** The offset
comes from `latestOffsetMinutes` - the offset the child last answered at, which
every `Attempt` already stores. A parent reading from another timezone still sees
their child's evenings as evenings.

**`readObservations` and `readSittings` are not best-effort**, unlike everything
else in `records.ts`. Here an empty array would render as "your child has never
practised", which is a lie when the database hiccuped. `null` means *could not
read* and `[]` means *nothing recorded*, and the screen says something different
for each.

**The screen refuses to diagnose what it doesn't know.** Under `MIN_OBSERVATIONS`
answers, "Needs a hand" and "Doing well" say so in words. A child who has never
played gets a sentence, not empty charts.

**"Needs a hand" unfolds the questions themselves.** A percentage says a topic is
hard and only the questions say *how* it is going wrong, so each struggling topic
carries a disclosure with its last `EXAMPLE_ANSWERS` (3) answers - the prompt as
the child saw it, the diagram beside it where there was one, what they answered,
and what it should have been - one row each, elided rather than wrapped. The
diagram is the **stored** figure redrawn small (`Diagram` at report density), never
a fresh draw off today's template: a jittered figure drawn again is a different
picture, and a parent asking how a question went wrong has to be looking at the one
their child was. It is a plain `<details>`, so nothing here needs a client
component. Folded rather than shown, because the weekly skim is the common read.

`readAnsweredQuestions` fetches the last three for **every** topic rather than
being told which are struggling: which those are is `topicReports`' answer, over
history the read knows nothing about. One query with a `ROW_NUMBER()` window does
the per-topic slicing in the database - taking the last few hundred attempts and
hoping would quietly show nothing for a topic last got wrong a while ago, which is
exactly the topic a parent came to look at. `null` on failure like its neighbours.

`headline` holds the arithmetic behind the three tiles - a rolling 7 days against
the 7 before, because a Monday-aligned week reads "0 questions" every Monday
morning. The `now` it runs on is read once, at the request boundary -
`requestNow()` in `src/app/now.ts`, one of these for the whole app, rather than a
bare `Date.now()` in the component, which `react-hooks/purity` flags as impure.
`strengths` mirrors `problemTopics`, ordered by `correctDays`; it excludes
`review-due` so no topic appears in two sections at once.

Two framing decisions the copy depends on. The tile says **"time on questions"**,
not "minutes spent": it is summed `timeTakenMs`, already capped, so it can't be
inflated by an iPad on the sofa - and it undercounts, which the label has to be
honest about. And a line under the tiles explains that **around three in four right
is the system working**; without it a parent reads 76% as a C.

`recharts` draws the topic bars and is the project's only UI dependency. Height is
questions and the fill is correct answers; the remainder is line grey rather than
`--color-wrong`, because it is "the rest of the questions" and not a column of
failures. **Its labels lie flat where there is room and tilt to `LABEL_ANGLE` (45
degrees) where there isn't.** From `md` up they lie down, and what limits them
there is the bar's own width, measured with a `ResizeObserver` rather than declared.
When even that leaves nothing legible (`MIN_CHARS`) they tilt. Anything longer than
its budget is elided either way, and the tooltip names the topic in full.

**They used to turn fully on their side, and the tilt is the trade that replaced
it.** Vertical labels cannot collide and need no width, which is why they fit a
phone - but reading one means turning the phone. The geometry is
`src/lib/chart/axis-labels.ts`, pure and tested. A label is anchored at its **end**,
under the bar it names, since which bar a name belongs to is the one thing a tilted
axis can get wrong. The tilt costs two things vertical got free, both measured:

- **Horizontal room.** A label leans up and to the left and an SVG clips at its own
  edge, so the chart takes a **gutter** on its left, capped at `MAX_GUTTER_SHARE`
  so the bars never become slivers. **What that gutter is worth is decided by
  position, not length**: only bars near the left edge can run out of chart, and a
  long name over the sixth bar has five bars to lean across. So each label is asked
  what *it* needs from where *it* sits and the gutter is the largest answer - for a
  typical run of topic names, nothing. Sizing it off the longest name wherever it
  sat spent a quarter of a phone's panel on room the labels did not want. Eliding
  follows position for the same reason.
- **Clearance from the label next door.** Tilted labels are parallel strips
  separated by the band *across* the tilt, and length cannot help, so the type size
  comes down as far as `MIN_FONT`.

**The angle is set against the gutter too**, since those pull opposite ways - a
flatter label is the easier read and reaches further sideways. 30 degrees asked for
half again what 45 does, and 45 costs about four characters of the longest topic
name. `CHART_INSETS` is shared with the component rather than written twice.

**"Recent sittings" counts sittings, not rows.** The play screen opens a
`LearningSession` on every mount, so a child who taps into a lesson and straight
back out leaves a row nobody answered a question in - and in live data those
outnumber the real ones. `readSittings` drops them **in the query**
(`attempts: { some: {} }`) rather than after the take, which it did once: a
parent asking for the last eight sittings was shown five, and the substantial
ones fell off the bottom to make room for nothing. The one drop left after the
take is a level the catalog no longer has, which only `parseYearLevel` can
judge, so the read can still return fewer than its limit.

**A sitting's length is said in seconds under a minute** (`formatDuration`,
`src/lib/format.ts`). It was minutes floored at one, which drew a twelve-second
visit and a fifty-second one identically as "1 min" and a screenful of them as
an afternoon's work. The number is summed `timeTakenMs` - the same "time on
questions" the tile above is careful to undersell - so seconds are truncated
rather than rounded and every boundary errs towards the smaller claim. The floor
of one second is the exception and a different statement: a recorded answer took
*some* time.

**Which child and which subject live in the URL, and everything that moves a
parent carries them** (`progressHref`, `src/lib/parent-links.ts`). Both pickers
wrote `/progress` into the link whatever screen they were drawn on, so changing
the child on the lab bench navigated back to the report; they write the pathname
they are on now, and the nav's two report links carry the pair across. A path
that is not a progress screen falls back to the report, since these parameters
mean nothing to a screen that does not read them.

**`/progress/lab` is a bench for analytics not on the report yet, reached from a
"Beta" badge on the report.** It was linked from nowhere and reachable only by
typing the URL; the word does that job now. **The badge is not a fourth nav
tab**, which it was for a day: four equal tabs say four equal screens, and what
is on the bench changes and some of it will be deleted. It sits with the pickers
because it is a control, and the nav still lights "Progress" up for the bench -
a screen reached from the report is not a fourth place to be. **The heading
takes the word and names the child underneath**, where the report does the
opposite: `${name}'s progress` on both screens left nothing on screen saying
which one you were on, and what a parent needs to know here - that this is still
being judged - is a poor fit for the half of a heading that truncates on a
phone. `/progress/lab` is the one path inside another's, so `useParentScreen`
has to ask about it before `/progress` - the ordering constraint the speed
screens' move out of `/progress` retired, back for this one pair.

The practice calendar is hand-rolled SVG and server-rendered. It draws **four
Monday-to-Sunday weeks** (`calendarWeeks`), not runs of seven ending today: real
weeks are what lets it carry weekday labels. The tail of the current week is
`future` and gets **no square at all** - a Friday nobody has reached and a Friday
nobody used must not look the same, and it is why the count reads "of the last 24
days" rather than 28. It is a CSS grid of seven `1fr` columns rather than an SVG,
because the width is whatever the column gives it and the height is a fixed 14px;
one viewBox cannot scale to that without stretching the corner radii.

**Each section is a `Well`** - one bordered panel per question a parent is asking.
Run together as bare headings they read as one long page; boxed, the boundaries are
visible in a skim. The three headline tiles are already boxed, with the "three in
four" line as their caption. Inside a well, lists are `divide-y` rows rather than
cards - a card in a well reads as double-boxed.

**Subject is a dropdown, not tabs** (`SubjectPicker`, alongside `ChildPicker` and
URL-backed the same way). Written while maths was the only subject, on the argument
that a row of one tab is a label pretending to be a control - and it reads the same
now English has made it a real choice.

**A parent's profile menu has no stars and no streak.** They don't play, so
`page.tsx` skips those two reads entirely rather than reading numbers it won't show.

## What the collapse cost and kept

For a few days this repository was two applications - this one and a Fastify API
on Fly - with the engine shared between them as `@learnr/core`, an OpenAPI
contract, a golden corpus of digests, and a Swift port of the engine in a private
iOS repository held against it. All of that is gone.
`docs/superpowers/specs/2026-08-29-api-collapse-design.md` is why it was undone
and what it took; read it before re-deriving any of the below.

**What the split turned up, and this keeps:**

- **The play path writes from the browser** rather than through a server action,
  because Next serialises server-action requests from one client (#17). They are
  route handlers under `/api/v1` now, same origin.
- **One session lookup per write** (#18). The old shape resolved the cookie in a
  server action and then again in the API - 717ms on a cold Prisma client, paid
  up to twice per answer.
- **`worthBanking`** (#19): the day's goal is banked from the answer that crosses
  the line onwards, not after every answer. The repair survives, and nineteen
  writes per twenty-question target do not.
- **`src/lib` is exactly the pure engine.** The five Prisma modules used to live
  inside it; they came back to `src/server/` rather than to where they were.
  `src/lib/purity.test.ts` replaced `packages/core/test/exports.test.ts`, whose
  `@/`-import rule went with the package boundary but whose purity rule did not.
- **The seventy expression traps**, now a plain unit test at
  `src/lib/expr/traps.test.ts`. Everywhere else the engine is the oracle and a
  fixture proved *agreement*; that file **asserts** values a human wrote down -
  `round(-2.5)` is `-2`, `-2 ^ 2` is `-4`, `mod(-7, 3)` is `2` where `-7 % 3` is
  `-1`, `"a" + 1 + 2` is `"a12"` where `1 + 2 + "a"` is `"3a"` - which is why it
  outlived the corpus it was generated beside. Harvesting cannot reach these: the
  shipped templates use `^` not once, and never `ceil`, `trunc`, `sign`, `sqrt`
  or `isInt`. When it and the engine disagree, decide which is wrong.

**What went, and what going cost:**

- **The golden corpus** (`fixtures/`). Its job was to hold a Swift port against a
  TypeScript oracle, and with one engine there is no second implementation to
  disagree. `src/content/catalog.test.ts` already draws every one of the 553
  shipped templates fifty times, validates each, and proves a figure template
  never draws one answer the same way twice.
- **The contract, the typed client and the response schemas**, including the
  `Mirrored` key-set check that held them to the DTOs. Nothing serialises through
  a schema any more - a route handler returns JSON and a page render returns a
  value in process - so the hazard those guarded, a field left out of a response
  schema vanishing silently, cannot happen. The *request* schemas moved across
  and are in `src/app/api/v1/schemas.ts`: a normaliser answers "is this a legal
  value of this domain type" and a schema answers "is this object the shape I was
  promised", and a handler taking untrusted JSON needs both.
- **The content packs**, and with them `npm run content:build` and the byte-for-
  byte drift test that existed because a pack could go stale.
- **The timing instrumentation** (#20), built to diagnose a ~530ms Vercel-to-Fly
  floor that died with Fly. The lesson it leaves is that a server log cannot see
  a queue in the browser, and the device this is felt on is an iPad with no
  console to open - so if the play path feels slow again, the instrumentation to
  reach for is browser-side.
- **The `@/`-import ban in the engine, and four constraints beside it**, all of
  which existed only because the engine was published through a committed
  symlink. The alias works everywhere again.

**There are still no preview deployments**, which was the price of gating an ungated
Vercel build behind the tests.

**Deliberately not done**: batching recorded attempts (#21), because the streak
flash and the round's stars read the response and every number that justified it
was taken across a hop that no longer exists; and the remaining read waterfall
(#16), where `auth()` and the account read are genuinely dependent and three of
the four round trips stopped being round trips. Re-measure before deciding
either.

## Setup

Copy `.env.example` to `.env` and fill in:

- `DATABASE_URL` - Neon Postgres via the Vercel Marketplace, and the one
  connection the app has.
  **It ends `sslmode=verify-full`, and that is the current behaviour written
  down rather than a tightening.** `pg-connection-string` treats `prefer`,
  `require` and `verify-ca` as aliases for `verify-full` already and warns that
  it does; what changes at pg v9 is that they stop being aliases and take
  libpq's weaker semantics instead. So a URL saying `require` is one that
  silently loosens on a major version bump, and one saying `verify-full` keeps
  verifying. `PrismaPg` parses the string through that library.
- `AUTH_SECRET` - `npx auth secret`
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` - Google Cloud console, redirect URI
  `http://localhost:3000/api/auth/callback/google`

Without these the app still runs and plays - auth and recording are skipped
(`isAuthConfigured`, `isDatabaseConfigured`) so the engines and UI stay workable.
The placeholder in `.env.example` counts as no database, so copying the file as
it stands is enough to start. The same holds when the database is simply
unreachable: the first question is drawn unweighted and nothing is recorded, but
the screen opens.

Prisma 7: the connection URL lives in `prisma.config.ts`, not the schema, and the
client is generated to `src/generated/prisma` (gitignored) and constructed with
the `@prisma/adapter-pg` driver adapter. That config names the migrations path
too - `npm run db:migrate` writes one locally and `npm run db:deploy` applies
them, so a release carries its own schema changes. Nothing in the tree invokes
it: that wiring is the Vercel project's own build command, which `vercel pull`
brings down onto the runner. `scripts/migrate.mjs` sits behind `db:deploy`
rather than `prisma migrate deploy` directly, for one retry: Neon accepts a
connection while its compute is still coming out of autosuspend, and Prisma then
times out taking the migration advisory lock against a fixed 10s it gives no way
to raise (P1002). That is a
cold database rather than a broken migration, and the answer is to knock again -
only that error is retried. Two production builds died this way before the retry
existed. Without a database it does nothing and succeeds, because a deploy must
not be the one thing that insists on Postgres.

**The Neon CLI is a devDependency, so branching the database is `npx neonctl`.**
It is a tool and not a dependency of the app: nothing in `src/` or in the deploy
workflow reaches for it, and it is pinned in `package.json` only so everyone
runs the same one. It authenticates with `NEON_API_KEY` - made in the Neon
console, which `vercel integration open neon` reaches by SSO - and it does
**not** read `.env`, so the variable has to be exported into the command's own
environment. `neonctl link` writes the org and project ids to `.neon`,
gitignored beside `.vercel/project.json` for the same reason and for the same
reason not written down here:

```bash
set -a; . ./.env; set +a                      # neonctl reads the environment, not .env
npx neonctl link --project-id <id> -y --no-env-pull   # once, per checkout
npx neonctl branches create --name <name>     # a branch off production
npx neonctl connection-string <name>          # the DATABASE_URL for it
npx neonctl branches delete <name>            # when it is done with
```

**`--no-env-pull` on that link is the flag worth knowing.** `neonctl link`
pulls the linked branch's `DATABASE_URL` into a local `.env` *by default*, which
on this repo means overwriting a working local file with production's pooled
connection - `.env` here is hand-written and holds four other credentials. It
is only `link` that does this; `branches create` writes nothing.

**And the project sits under an org, which is what an empty list means.** The
key authenticates a personal Neon account, and the Marketplace put the project
in a Vercel-created org that account is a member of - so `neonctl projects list`
answers "you don't have any projects yet" until `--org-id` names it, which reads
exactly like a bad key. After the link the org id is in `.neon` and nothing
needs the flag again. `neonctl orgs list` is where to find it.

A branch is a copy-on-write fork of production's data, which is the thing that
makes it worth having and also the thing to be careful with: it carries real
children's records. It is what preview deployments would have to point at
before **There are no preview deployments** above could be revisited.

**The `db` test project needs Docker**, and it does *not* read `.env`: the
Testcontainers Postgres is started in a vitest `globalSetup` which sets
`DATABASE_URL` before any test module is imported. It has to be that early,
because the data modules build their client from the variable at import time - a
per-file `beforeAll` leaves `prisma` null and every function returning null
against a database that is running perfectly well. `npm run db:deploy` and
`prisma migrate dev` **do** read it, so they reach whatever it names.

## Working agreements

- TDD, lean tests. Test behaviour through the public function, not internals.
- Work on `master` and push when a piece of work is done. Not a stable release yet.
