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
prints a line and succeeds - a build must not be the one thing insisting on
Postgres when the app itself plays fine without it.

Run `npm test` and `npm run typecheck` before pushing.

## Architecture

**All logic lives in `src/lib` as pure functions.** Nothing in there touches React,
the network, the clock or the database - callers pass in `now` and an RNG. This is
the rule that keeps the app testable; don't break it for convenience.

```
src/lib/expr/        safe expression language (tokenize → parse → evaluate)
src/lib/figures/     the questions that are a picture: eleven kinds, a registry
src/lib/templates/   question templates: types, generation, validation
src/lib/session/     session state machine and grading
src/lib/analytics/   the learner profile, and the report written from it
src/lib/reinforcement/ which question to ask next
src/lib/rewards/     stars for a round, the day streak, and the daily target
src/lib/speech/      turning a question into words worth hearing
src/lib/curriculum.ts school years, NSW stages, labels and ordering
src/lib/day.ts       which local day a moment falls in
src/lib/rng.ts       seeded PRNG
src/content/         the shipped course content, a year a file + catalog lookups
src/components/      UI
src/app/             routes and server actions
```

- `src/lib/expr` is a small Pratt-parsed expression language. It exists because
  templates are authored **outside the app by AI** and are therefore untrusted -
  `eval` is not an option. Variable and function lookups use `Object.hasOwn` on
  null-prototype tables so `constructor`/`__proto__` can't resolve to anything.
- Randomness is always injected (`Rng`), never called directly in engine code, so
  every test is deterministic and any session can be replayed from its seed.
- Session state is immutable: `submitAnswer` returns a new state.

## Levels and topics

**Levels are Australian school years**: `'K'` then `'1'` to `'6'`, as strings -
primary school is the whole scope. Never an integer: `'K'` has to sort first, and
strings keep the door open for years beyond single digits if the scope ever
widens. Use `compareYearLevels` to sort, `yearLabel` to display
("Kindergarten", "Year 3"), and `parseYearLevel` at every boundary (URLs,
imported files) - it normalises `'k'` and `'03'` and returns null for anything
else.

**A topic is what a question practises** ("counting numbers", "even and odd").

**Levels and topics are many-to-many, and neither owns the other.** A year offers
several topics; a topic recurs across years, harder each time. Counting numbers
runs from Kindergarten into Year 1; even and odd from Kindergarten into Year 2.
The pairing lives on the template - one year, one topic - so the curriculum is
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
  `distractors` and a `jitter` fallback. **At most 4 options** (`MAX_CHOICES`) -
  more than that stops being thumb-sized on an iPad.
- **`answerType` is inferred from what `answer` evaluates to** and rarely needs
  declaring: a boolean gives `boolean` (true/false), a number gives `number`,
  anything else gives `text`. Declare it only for `choice`, or for a numeric
  answer you want typed as text.
- A boolean answer makes it a true/false question whatever the template says, and
  `choices` alongside one are meaningless - the play screen draws its own two
  buttons. `validateTemplate` rejects that pairing.
- **Authoring mistakes are reported by `validateTemplate`, never thrown by
  `generateQuestion`.** Generation runs mid-session with a child waiting, so it
  degrades instead: a disagreeing `answerType` is overridden, choices on a
  true/false template are dropped, and more than `MAX_CHOICES` options are
  clamped. That is exactly why content must be validated before it ships.

**A multiple-choice question can answer itself, and that is the anchoring rule's
sibling.** A figure that never varies teaches a child to recognise the picture;
an option set that never varies teaches them to recognise the *button*. Both are
the same failure - the child gets it right, the profile calls the topic secure,
and the thing that was learned was not the maths - so both are caught the same
way, by drawing the template many times and looking at what stayed the same.
`validateTemplate` draws a `choices` template `CHOICE_DRAWS` (40) times and
refuses three shapes: an answer that always holds the same **rank** among the
numerically sorted options, an answer always drawn from a different list
than its distractors (a closed set - three colours, two units - where the odd
one out is pickable without doing the arithmetic), and the general case both of
those are special cases of - **the option set predicting the answer**, where
every distinct set of buttons always came with the same answer. The third check
is the one that reaches word options, which is where the first two stand down,
and it is guarded by `OPTION_SET_REPEATS` (2): a template whose options move
nearly every draw shows one answer per set because no set is ever seen twice,
and refusing that would be refusing a template for not repeating itself. A sweep of the content
written before the check existed found **14 templates with a fixed answer rank
and one option-set leak**. Thirteen of the fifteen needed reworking; the other
two were "which is largest?", where the rank *is* the question, and they declare
`rankIsTheQuestion` to say so. A third joined them later, when the
prediction check reached word options the rank check cannot see: the three
declarations are `maths.4.decimals.larger`, `maths.4.angles.larger-angle` -
whose two options are the two words its own prompt reads out - and
`maths.5.decimals.largest`. Its sibling `propertyIsTheQuestion` covers the
other shape - "which of these is even?", where an odd distractor can never be an
even answer, so drawing the distractors from the answer's own values is
arithmetically impossible - and no shipped template needs it yet. Two flags
rather than one blanket "trust me": each suppresses the check it names, and
either also suppresses the prediction check, since both of them assert that the
option set is what the question is about. Two checks apiece, then, and still
nothing blanket - and both visible in review, because an undeclared fixed rank
is a question a child can beat.

**On a figure question the first two checks usually stand down, so measurement
is still most of the net.** Neither exempts a figure structurally - the rank check
runs on any `choices` template whose options are all numeric, figure or not.
It is the *options* that decide, and a shape name or a grid reference is not a
number, so one wordy draw takes the rank check off the table: 43 of the 44
shipped templates carrying both a figure and `choices` word their options. The
forty-fourth is the demonstration rather than the exception -
`maths.5.angles.estimate-degrees` offers 30, 60, 90 and 120, so it is
rank-checked like anything else and passes on the merits, its answer sitting on
each of the four ranks about a quarter of the time. The closed-set check then
stops reading disjointness as structure above `CLOSED_SET_MAX` (8) distinct
answers, and a three-by-three grid reaches nine.
Every leak found while writing this branch's figure content was found by
*measuring* - keying each draw by its prompt and sorted option set, learning
the modal answer on one sample and scoring it on a held-out one against the
blind baseline. **Eight were found that way over this phase**, at rates up to
100%, and not one of them could have been found by the two checks that existed
then - the prediction check was written afterwards, from the five one-to-one
leaks measured at the end of the branch, and it refuses all five. A green suite still says
little about a new `choice` template that carries a figure: the prediction
check only speaks where the option set repeats, and a leak that keeps the
answer to two buttons out of four passes it cleanly. Measure it.

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
`subject.level.topic.variant`, a curriculum citation in `tags`, at
least 20 templates per year, and no typed answer the number pad cannot enter. A
template carrying a `figure` is also drawn fifty times and made to prove it never
draws one answer the same way twice - see **Question diagrams** below.

Content ships for K-6 as **350 templates, one file per school year** under
`src/content/maths/` - `k.ts` through `6.ts`, concatenated in school order by
`index.ts`. It was a single 3,500-line `maths.ts` until half again as many
questions were about to be written into it, and the split is filing rather than
structure: `mathsTemplates` is the same array in the same order it always was,
and `catalog.ts` never learned there is more than one file. What it buys is that
a year is the unit a content change touches, so two years being written no
longer means one file being edited twice.

Every template cites the content it practises in `tags` - `AC9M4N02`,
`MA2-AR-01` - so the curriculum link is checkable rather than claimed. There are
**two** syllabuses behind those codes, which is the next section.

All four answer types render, so any of them is safe to author. **Pick the type
the pad can express**:

| `answerType` | how it is answered | what it can express |
| --- | --- | --- |
| `number` | number pad, then Check | digits and one decimal point - **no minus key** |
| `text` | on-screen A-Z pad, then Check | letters only, no spaces or digits, ≤ 16 chars |
| `boolean` | two buttons, True / False | one tap answers |
| `choice` | 2-4 buttons | one tap answers; anything the other types cannot express |

A negative answer has to be multiple choice, because the pad has no minus key -
that is why the Year 6 integer questions are `choice`. A distractor a child would
find nonsensical is still bad content, so keep them plausible.

**`text` is a last resort, and never below Year 4.** A word answer makes the child
spell before they can answer, which tests literacy rather than maths - a
Kindergartener knows a triangle long before they can spell it. Word answers in K-3
are `choice` instead, and `catalog.test.ts` enforces that. Any answer drawn from a
small closed set ("red or blue?", "metres or centimetres?") is a `choice` question
at any level; a two-option `choices` with both literals as distractors is the
usual shape.

**`QuestionSpec` and `QuestionTemplate` are a deliberate split**
(`src/lib/templates/types.ts`). A spec is everything it takes to make a
question - the prompt, the vars, the constraints, the answer - and a template is
a spec placed in a course, adding an id, a subject, a topic and a school year.
The split exists because a speed run question (see **Speed run**) has no
curriculum topic and no school year to declare; giving it a nominal one would be
a lie told in the type system, in the one place a level is guaranteed to be a
real Australian school year. `specsFor` in `src/lib/speedrun/modes.ts` returns
bare `QuestionSpec`s for exactly this reason, and reuses `generate` unchanged.

## Two syllabuses

Content is written against **two** curriculum documents at once: ACARA's
*Mathematics: Scope and sequence F-10 (v9.0)* and the **NSW Mathematics K-10
Syllabus (2022)**. `SYLLABUSES` in `src/content/catalog.ts` names both, and
`syllabusOf` tells a tag's family apart by its shape. NSW is there because NSW
schools teach the NSW syllabus and not ACARA directly: a parent reading
`/curriculum` should be able to find their child's **stage**, which is the word
their child's school actually uses.

**A stage is derived and never stored** (`stageForLevel`): Early Stage 1 is
Kindergarten, Stage 1 is Years 1-2, Stage 2 is Years 3-4, Stage 3 is Years 5-6.
A stage spans two years where a level is one, so the mapping is total in this
direction and lossy in the other - and a stage written onto a template would be
a second truth free to disagree with the level beside it, the same objection
`TopicSkill` answers by being a cache rather than a second history. It is also
why one Stage 2 code honestly sits on a Year 3 template *and* a Year 4 one, and
why the check below is against a template's stage and never its year. The one
place the mapping is written down is `STAGE_BY_LEVEL`; `levelsForStage` inverts
it rather than restating it, because Stage 2 being Years 3 and 4 rather than
Year 2 is a thing this app has already got wrong more than once.

**The two halves of this feature look different because the copyright is
different.** ACARA's material is CC BY 4.0, so a content description is quoted
in full on `/curriculum`. NESA's is Crown copyright, so an NSW outcome is
**cited and never reproduced** - no outcome statement, and no gloss of one,
goes into a `tags` array, a code comment or the page. That is the one rule here
whose breach would be a licensing problem rather than a bug, which is exactly
why it is not left to be judged one comment at a time. It had to be swept for
twice: comments in four content files and in `catalog.test.ts` had drifted into
restating what an outcome *covers* rather than where the syllabus *places* it,
and each of them read as an obviously harmless line on its own. Say where a
syllabus puts something; do not say what it says.

**There are no Part A / Part B tags.** NESA says outright that "Part A does not
equate to Year 3 only" - which part of a stage a concept is taught in is a
teacher's programming decision, not a property of the content. Tagging it would
put a guess into the one field that exists to be checkable, which is the lie in
the type system the `QuestionSpec`/`QuestionTemplate` split already refuses to
tell.

**And no topic was renamed into NSW's vocabulary.** NSW would fold `money` into
additive relations and place value, and `algebra` into additive and
multiplicative relations; both are naming rather than coverage, and `topic` is
*stored*, on `Attempt` and on `TopicSkill`. A rename orphans every child's
history and breaks `buildProfile`'s obligation to reproduce the stored row from
the attempts. A second vocabulary rides in the tag, which is where a second
vocabulary belongs.

**Four rules are enforced over every shipped template**, and the order they were
added in is the argument for the last two:

- **Every template cites at least one syllabus.** Either satisfies it alone,
  because the two disagree about which year some content belongs to. An uncited
  question is a claim about the curriculum that nothing can check.
- **An NSW code may only come from the stage its template's year falls in.**
  The characteristic bug of a second citation family, and invisible by
  inspection across a whole catalogue: a Stage 2 code on a Year 5 template
  reads as perfectly plausible and is simply wrong.
- **An NSW code has to be one the syllabus actually has**, checked against the
  73 codes transcribed into `catalog.test.ts` from
  `docs/superpowers/notes/nsw-outcome-codes.md`. This is the only one of the
  four that checks a citation for *truth* rather than for shape, **and it
  exists because all three of the others pass on a typo**: `MA3-RFQ-01` for
  `MA3-RQF-01` is code-shaped, cites a syllabus, and reports the right stage,
  and the curriculum page would then invite a parent to look up an outcome that
  does not exist. Transcribed rather than parsed out of the notes file because a
  regex that stops matching yields an *empty* list, and an empty membership list
  waves every code through - a green test is the one failure mode this net must
  not have. It fails safe only against omissions, so a wrong entry stays green
  forever and the manual two-way diff against the notes file is the only guard
  there is.
- **Every tag is a recognised code**, not merely free of whitespace. A
  whitespace test refuses prose and waves through both a hyphen-joined
  `interprets-data-displays` and a shape-broken `MA3-DATA-1` - and
  `curriculumCodes` silently *drops* a tag it does not recognise, so a broken
  code reached the curriculum page as a missing citation rather than a visible
  error, which nobody would ever have noticed. It commits the repo to every tag
  being a curriculum code, so a `needs-review` note is no longer free to add.

**Where the two syllabuses disagree the template cites one of them, and the
divergence is named by a test.** Six templates cite NSW alone, because NSW
teaches reading a clock face and halves of a shape earlier than ACARA writes
them down; ten cite ACARA alone, three of them because NSW places integers at
Stage 4 and seven across four other topics where the honest stage code does not
reach the content. Both lists are asserted as **set equalities** and not as
memberships, because the useful half is the other end: with "cites at least one
syllabus" satisfied by either, a citation quietly dropped from any *other*
template would pass green. Closed from both ends, a divergence cannot appear or
disappear without somebody deciding it should. `DIVERGENCE_NOTES` carries the
sentence explaining each one and lives beside the derivation rather than in the
page, since a note in `page.tsx` cannot carry a test - and this whole
cross-reference exists to replace trusted citations with enforced ones.

## Question diagrams

Some questions are a picture rather than a sentence. "What shape is this?" has no
hole to fill - the figure *is* the question and the prompt is only its caption.
`src/lib/figures/` is the pure half, geometry judged by tests rather than by eye
for the reason `photo/crop.ts` and `chart/axis-labels.ts` are already there, and
`src/components/diagram.tsx` is a dumb renderer: marks to SVG, no geometry and no
decisions, which is what lets the play screen and a row in the parent's report
draw the same figure five times apart in size.

It exists because of a gap in what a sentence can ask. Counting the ACARA content
descriptions cited in the maths content before any of this was written,
Number, Algebra and Measurement were close to complete while Space carried
**one** description each in K, 1, 2, 4 and 6 and **none at all** in Year 3 or
Year 5. That was not an accident about which topics somebody got round to: Space
and Statistics are the strands where the question is a picture, and an app that
can only render a sentence cannot ask them.

**No single diagram may become the anchor for an answer.** This is the rule the
whole design is shaped around, and everything below is a consequence of it. If
every obtuse angle is drawn the same way, a child learns to recognise that
picture rather than an obtuse angle - and the app would be teaching the wrong
thing while its analytics called the topic secure. That is the worst failure
available here: a wrong answer is visible and a mislearned one is not, and the
selector would be putting the topic away as mastered on the strength of it.

So a figure is never an asset chosen by the answer. It is **generated**, from the
same bound scope and the same injected `Rng` the question already uses, and it
**varies by default**: a template pins the property the question is about and
says nothing about rotation, size or proportion, which the builder jitters for
itself. Omitting an optional parameter is what asks for variation; supplying one
pins it. An author who wants an upright figure writes `rotation: '0'` on purpose,
and pinning is the exception rather than the default because forgetting is the
failure mode.

**And because forgetting is invisible - an anchored figure looks perfectly
correct - the rule is enforced rather than intended.** `validateTemplate` draws a
figure template `FIGURE_DRAWS` (50) times on different seeds, groups the resolved
figures by the answer each one accompanied, and fails any answer that always
produced the same picture. `catalog.test.ts` runs it over everything shipped, so
an anchored diagram cannot reach a child without a test going red first.
Coordinates are rounded at build time (`FIGURE_PRECISION`), which keeps the JSON
stored beside an attempt small and - the reason that actually matters - makes two
figures comparable as strings, which is the only thing that lets "drawn
identically again" be detected at all.

**Those fifty draws are shared across all of a template's answers, so the check
gets stricter as the answers multiply** - which is the opposite of what anyone
assumes and is worth knowing before authoring a wide question. A template with
four answers gets a dozen drawings each and one with nine gets five or six -
but **the refusals do not come from that average, they come from its tail**,
where an answer happens to turn up only two or three times in the fifty and two
identical pictures is the whole of the evidence the check needs. For an answer
whose only lever is a small discrete set - a coordinate plane, where the dot
and the grid's extent decide the picture between them - the chance an answer's
*n* drawings all land on one of *e* extents is `e^(1-n)`, and taken **over the
distribution of counts** that comes to roughly one refusal in six for nine
answers over six extents, and essentially never for four. Evaluate the same
formula at the mean instead and it reads about one in two thousand, which is
exactly the mistake to avoid: the low-count tail is the whole of the risk, and
averages hide it. The seeds are keyed off the template's own id, so that
refusal is the same on every run and every machine: the risk of a wide answer
set is a cost the author meets once, at validation, and never something a child
sees. The fix is not to narrow the question but to widen what varies, or to
offer the same few answers on every draw and let the picture grow around them.

**Pinning `rotation: '0'` on a regular polygon therefore fails validation,
deliberately and with no escape hatch.** Such a shape has no free proportion
left, so a pinned rotation is one fixed picture and the check rejects it. That is
the check working, not a limitation to route around: a regular hexagon drawn the
same way every time is an anchor for "hexagon", however deliberately it was
pinned. An opt-out flag was the obvious kindness and was left out on purpose,
because the author who reaches for it is precisely the author about to make this
mistake, and a comment on the flag would then be the only thing between a child
and a memorised picture. Pinning stays available wherever something else still
varies - a scalene triangle's proportions, an angle's two arms - which is the
whole of the rule.

**Two kinds fight that rule, and between them they are the two patterns to
reach for.** Ordinarily a kind varies the thing being drawn: a spinner turns,
a number line reframes its range. **`clock` cannot.** Three o'clock is three
o'clock - the hands *are* the answer and may not move, and a dial turned even
slightly is not a picture of the same time drawn differently, it is a different
time. So the variation moves off the answer and onto the presentation around
it: whether the numerals are drawn, whether the minute track is, and how long
each hand is as a share of the dial. That last one is the one that survives a
template pinning the other two, and it has to be a *proportion* rather than a
size, because `fit` is uniform and centring, so a bigger dial is the same
drawing. Any kind whose answer fully determines its geometry has to find its
variation somewhere else, and this is how. **`solid` has the opposite
problem**: a cube has **eleven** nets, so "which solid does this net fold into?"
answered `cube` has many correct pictures and the failure available is picking a
favourite - show the cross fifty times and a child learns the cross. `CUBE_NETS`
is all eleven, laid one of the eight ways round a square and then turned, so
nothing about a cube's net is pinnable at all, which is what makes the rule hold
even for the author who pins the rotation.

**What a kind can actually be asked to draw is measured, not assumed**, and
lives in `docs/superpowers/notes/figure-content-notes.md` beside
`figure-kind-author-notes.md` for adding a kind. Every limit in there was found
by drawing the thing and reading the refusal, and none of it is derivable from
the types: a labelled coordinate plane may be wider than it is tall (5x4 draws,
4x5 is refused), and a bar graph's room for a category name shrinks when the
*value axis* reaches two digits, so "Ball" fits until the values reach 10.

**`FigureSpec` and `Figure` are the split `QuestionSpec` and a generated question
already make**: what an author writes, and what the engine resolved it into. A
`FigureSpec` is expressions - every parameter is an expression string over the
bound scope, exactly as `min`/`max` already are - and a `Figure` is a
serialisable drawing in a 0-100 box made of four `Mark` kinds: `path` (points,
closed, filled, dashed), `arc`, `dot` and `label`. Four, and a renderer must
handle every one of them, which is the reason there are so few: anything
`diagram.tsx` has to know how to draw is a decision that has escaped `lib`. A
right-angle tick is a three-point open `path` and a mirror line is a dashed one
for that reason rather than for economy. `arc` is the one mark carrying both
coordinate frames at once - its `at` is in screen coordinates, y down, where
`fit` left it, while `from`/`to` never left the maths frame the figure was
authored in, anticlockwise from east - which is why `arcPath` is exported and
tested rather than read carefully by the next person.

**`buildFigure` is total and clamps; `figureIssues` reports.** The same division
`generateQuestion` and `validateTemplate` already make, for the same reason:
generation runs mid-session with a child waiting, so an unknown shape name or a
400-degree angle degrades into something drawable rather than throwing a stack
trace into the middle of a question, exactly as `MAX_CHOICES` clamps a fifth
option away. `figureIssues` takes the spec and the scope and no `Rng` at all - it
judges the authored spec, not one of the drawings that spec can produce - and
validation is its only caller, which is what makes the quiet clamping safe: the
mistake is caught, just not in front of the child.

**`parseFigure` is the boundary**, beside `parseYearLevel`, `parseTarget` and
`parsePhoto`. A figure is stored on `Attempt` and read back later, so an old row
predates the column, a newer build may have reshaped `Mark`, and a hand-rolled
write can put anything at all in a `Json?` column. One bad mark fails the whole
figure rather than being dropped: a figure is a single composition read together,
and silently losing the tick that said a corner was square would draw a picture
`buildFigure` never produced, with nothing on screen to say a stroke went
missing. `MAX_MARKS` caps the count for the reason `MAX_PHOTO_BYTES` caps a
photograph - real content is two orders of magnitude short of it, and a crafted
payload is not.

**There are eleven kinds** (`FIGURE_KINDS`), and each is a module behind a
registry: `polygon` and `angle` came first, then `bar`, `pictograph`, `spinner`,
`solid`, `number-line`, `clock`, `array`, `fraction-shape` and `grid`.
`buildFigure` used to be a ternary over the kind with `figureIssues` branching
beside it, which is fine for two and is a queue for eleven - every new kind an
edit to the same two functions, with a kind's drawing and its validation written
a hundred lines apart and nothing but discipline keeping them describing the
same fields. A `FigureKindModule` (`registry.ts`) puts a kind's two halves in
one file and reduces adding one to a file and a line. Two details are load
bearing rather than tidy: the lookup is a `Map` and not a record literal because
it is keyed by a string off untrusted content, the same reason `src/lib/expr`
reads its variables off null-prototype tables; and a module's `fields` table is
a record whose mapped type strips the spec's `?` markers, so a parameter added
to a kind and forgotten there is a type error, where a list would simply have
left it unvalidated for good.

The shape vocabulary is closed (`POLYGON_SHAPES`: the triangles, the
quadrilaterals, and pentagon through octagon). A count of sides would be less
to author with and not enough to author *from* - it cannot tell a rhombus from
a kite, and a randomly wobbled quadrilateral has no axis of symmetry at all, so
the true/false symmetry question would have no true case to draw. A polygon
takes `shape`, `rotation`, `mirror` and `rightAngles`; an angle takes
`degrees`, `rotation`, `armLength` and `arc`. `mirror` is a **boolean** -
whether the dashed line is a genuine axis - and which true axis, or which
plausible wrong line, is the builder's to vary; the template's own variable is
what the answer reads. An angle's two arms are unequal by default, both because
equal arms are an anchor and because children read longer arms as a bigger
angle, a misconception ACARA names outright. There is never a right-angle
square: a box in the corner answers "what kind of angle is this?" before the
child has looked at it, the same reason the play screen's header counts
nothing.

Two content rules, both learned the hard way. **A `mirror` that evaluates falsy
is reported on a shape whose symmetry axes sit closer than
`WRONG_MIRROR_CLEARANCE` (15 degrees) apart.** The wrong line is drawn as far
from every axis as the shape allows, and how far that is falls as the axes
multiply - a regular polygon's are `180/n` apart, so the best any line can manage
is `90/n`. A heptagon's "deliberately wrong" mirror therefore lands a few degrees
off a real one, which is not a child failing to see symmetry but a picture that
does not contain the answer, and it would be marked wrong either way. The bound
is written as an angle rather than as a list of shapes, so a kind added later is
judged by its own geometry instead of by whether somebody remembered to add it to
a list. And **the existing answer-type rules apply unchanged**: no word answer
below Year 4, so shape names are `choice` there. That nothing had to be relaxed
to fit figures in is the best evidence available that the
`QuestionSpec`/`QuestionTemplate` split was already in the right place - a figure
is a property of the spec, beside `choices`, so a speed run inherits the
capability and never uses it, exactly as it inherits `hint`.

**A figure question reads its prompt aloud and stops.** The picture is the part
you look at and it cannot be described without giving the answer away - "a shape
with three sides" *is* the answer. A pre-literate child can still answer, since
seeing a triangle needs no reading, and the figure is not a second control: it
takes no tap, and tapping the question still repeats the words.

**The figure outranks the prompt on the play screen.** Ordinarily the prompt is
measured and fitted into the room between header and pad; with a figure, the
figure claims that room first and the prompt fits into what is left, because when
there is a picture the picture is the question. The existing `ResizeObserver`
re-runs when its box changes, so the prompt shrinks correctly with no new
machinery. The exception is the viewport that has already run out of height - a
landscape phone, where a figure stacked above a prompt leaves both unusable - and
there the two sit side by side, under the `max-height:500px` query that **UI**
below names as one of the app's two.

**The first pass deferred a list, and said of it that each would be a new figure
kind and no engine change - which is the test of whether any of the above was
right.** The list was bar and picture graphs (the Statistics hole), analogue
clock faces, number lines, arrays, fractions of a shape, grids and coordinates,
and nets. **All of them now ship, and the prediction held.** `FigureSpec` gained
variants and `FIGURE_KINDS` gained names, but `Figure`, `Mark`, `fit`,
`parseFigure`, `MAX_MARKS`, the anchoring check and the answer-type rules are
what they were. The one structural change is the registry, and that was a
consequence of the *count* rather than of any kind - eleven branches in two
functions, not a capability the design turned out to be missing.

`label` was in `Mark` before anything emitted one, on the argument that those
kinds are unreadable without it and a renderer is cheaper to write once than to
extend. **That is the one place the bill came due.** Five kinds emit a label
now, and it cost `Diagram` a second prop: SVG 2 defines
`vector-effect: non-scaling-size`, which would do for `font-size` what
`non-scaling-stroke` does for a line, but no shipping engine implements it - so
unlike `strokeWidth` a label's size cannot be pinned to real pixels and each
caller estimates its own box (`labelSize`, roughly 7 on the play screen and 16
in a report row). It also costs the kinds `labels.ts`, the shared arithmetic for
what a label takes from the geometry around it - and a figure is built once for
both call sites, so a kind that places labels by geometry has to leave room for
the *larger* of the two or its ticks collide in the report. Even so, the four
`Mark` kinds are still four, which is the claim that was actually at risk: every
one of the nine kinds draws itself out of paths, arcs, dots and labels, so no
new decision escaped into `diagram.tsx`.

## Sessions

A session never ends. The child picks subject + year and answers until they stop;
templates are drawn from the pool for that year, across all of its topics, with
the reinforcement selector deciding which. **The header counts nothing**: no
clock and no right-so-far tally, only the way out (a door icon, drawn for the
same reason the Check key is a tick) and the profile menu. Both were things
a child would watch instead of the question, and neither is theirs to worry
about - the round's stars are the only reckoning, and they come between
questions. A daily target, if a parent has set one, adds a bar with no numbers
on it; see **Daily targets** below for why it carries none.

Every answer is recorded (`Attempt`: template, topic, level, time taken,
correct/incorrect, the response as typed, the UTC offset it was given at, and -
for a question that had one - the figure the child looked at) and folded into
that child's `TopicSkill` for the topic. Attempts are the history; the skill row
is that history rolled forward, and a cache of it - never a second truth, so
`buildProfile` over the attempts has to reproduce the row.

**The figure is stored resolved, not as the template's parameters**, for the
reason `prompt` is stored as text rather than re-rendered: a template edited next
month must not change what a parent is shown about last week. Figures make that
argument twice over, since they are jittered - even an untouched template redraws
a different picture on a different seed, so the parameters would name a shape and
still not be the picture. It is read back through `parseFigure`, and only a
figure question pays for the column: an ordinary one leaves it unset rather than
writing `null`, which is already what every attempt from before the column means.

Keeping that true costs a **row lock**: `updateTopicSkill` reads with
`SELECT ... FOR UPDATE` inside a transaction, so answers landing at once queue up
and each folds onto the one before. Two tabs will do it, and so will one child
answering faster than the round trip. The lock is there rather than a merge in SQL
so `nextSkill` stays the only place the arithmetic is written down. The row cannot
be locked before it exists, so the first answer on a topic can still collide on
insert - hence the retry, and one time round is enough.

**Time taken is capped** (`MAX_TIME_MS`) before it is recorded. An abandoned
question - the iPad put down and picked up after dinner - is not a measurement,
and the total is per topic and never trimmed, so one of them would otherwise sit
in that topic's average for good. That average is what a parent is shown.

Recording is best-effort and must never block or interrupt play: writes go through
server actions that swallow failures. `learningSessionId` round-trips through the
client, so every write verifies the session belongs to the signed-in user first.

## Reinforcement and analytics

Two libraries over one model. `src/lib/analytics/profile.ts` folds attempts into a
`LearnerProfile` - per topic and level: attempts, correct, a recency-weighted
`strength`, the current `streak`, the separate days it has been got right on
(`correctDays`) and when it was last answered.
`src/lib/reinforcement/select.ts` reads that profile to pick the next template;
`src/lib/analytics/report.ts` reads the same history to say where a child needs
help. Neither owns the other, and both are pure - `now` and the RNG are passed in.

The profile is built by folding, one answer at a time (`nextSkill`), so the same
arithmetic serves the stored `TopicSkill` row and the in-session profile that
updates as the child plays. That is why a topic falling apart in the first ten
questions is being mixed in more heavily by the twentieth.

**Status is what everything keys off** (`skillStatus`), and it refuses to guess:
under `MIN_OBSERVATIONS` answers a topic is `new`, never a weakness. Then
`struggling` (strength under 0.6), `developing`, `secure` and `review-due` -
secure, but left alone long enough to be worth confirming.

**The two bars are not the same height, deliberately.** Calling a topic hard costs
a few extra questions on something the child can do, so `MIN_OBSERVATIONS` is
enough for it. Calling a topic *known* is the expensive mistake - it drops the
topic to a fraction of the questions and puts it away for days - so it needs a
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
order undercount rather than inflate - mastery is delayed, never faked.

Selection rules, in order - all three matter, and none of them ever rules a
template out entirely:

- **No pattern, no steering.** Until one topic has `MIN_OBSERVATIONS` answers the
  weights are flat and questions are drawn at random, exactly as before.
- **Weight by status**, so hard topics come up more and mastered ones get out of
  the way without disappearing - a child should still get things right.
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

`weightTemplates` is exported because it *is* the policy - read it in a test, or
to explain a choice later. Tests assert shares over a few hundred seeded draws
rather than exact sequences; the RNG is deterministic, so they don't flake.

**Selection is driven by correctness alone - time taken is reported, never acted
on.** It is tempting signal: fast and right is fluency, slow and right is working
it out. But slow is also distracted, or asking a parent, and one number cannot
tell those apart. Marking a child down for being slow is exactly the punitive
thing this app does not do. If that changes, the honest version is to gate
*mastery* on fluency - a slow correct answer still counts as correct but does not
advance a topic towards `secure` - never to weight a topic up for slowness.

The analytics side is a library only: `topicReports`, `problemTopics`,
`dueForReview`, `progressOverTime` and `summarise`. `/progress` is the screen that
consumes them - see **Parent analytics** below. Buckets take a UTC offset from the
caller so a Sydney evening's practice doesn't land on the next day.

## UI

Standard iPad, landscape and portrait. Minimal and calm rather than playful -
simple enough for a child to pick up with no explanation.

- **Level is the home screen's top-level choice**: one dropdown labelled "Level",
  then the subjects offering that level below it, each card carrying a coloured
  glyph tile, the subject, its year, and its topics as **chips** (`MAX_CHIPS`,
  then "+n more"). The topics used to be one run-on line of dots, which was the
  only thing on the card saying what is inside and the least readable thing on
  the screen. Switching level swaps the cards in place - no navigation. The choice is
  remembered on `User.selectedLevel` and the screen reopens on it; signed out or
  without a database there is nowhere to keep it, so it opens on Kindergarten.
  `resolveInitialLevel` falls back when a stored level has lost its content.
- **The play screen must fit the viewport with no scrolling.** It's `h-[100dvh]`
  with `overflow-hidden`; the answer pad is fixed-height and the question area
  flexes. Check both orientations after changing that layout, and check a phone
  as well as an iPad - a phone is where it runs out of height first.
- **Height, not width, is what the play screen is short of.** The pad takes 40%
  of the height it is given, phone or tablet, and what is left over is the
  question's. What differs is the floor and ceiling on that 40%, and those now
  ask for **height as well as width**. `sm:` is a width breakpoint standing in
  for "tablet", and a landscape phone breaks the proxy rather than the reasoning:
  it is wide - often past the 640px line - and short at the same time, so it took
  the tablet's 16rem floor, built for a device with height to spare, on exactly
  the device with the least of it, and left the question no room at all. The
  larger bounds sit behind `[@media(min-width:640px)_and_(min-height:501px)]`
  instead, so a landscape phone keeps the phone-sized clamp however wide it is
  and every tablet clears both halves and is untouched. The speed run's pad
  carries the identical query, because the two screens must not disagree about
  what "tablet" means.
- **One short-viewport line, and a second should not be invented.**
  `max-height:500px` means "landscape phone" - it turns a figure and its prompt
  into a row, and it is the same boundary the pad's bounds above take from the
  other side, as `min-height:501px`. There used to be a `max-height:600px`
  beside it hiding the speed run result's right / missed / answered tally, and
  it went with the tally rather than being found a second job. Written out as a
  literal class name rather than kept in a variable, since Tailwind reads class
  names as literals and a composed one compiles to nothing. Reach for it before
  adding a number beside it.
- **The question is measured and fitted, not declared** (`Prompt`). The room it
  has depends on the device, the orientation, whether a target bar is showing and
  how long the prompt is, so the box is measured and the largest whole pixel size
  that still fits is searched for - re-run by a `ResizeObserver` when the box
  changes. A declared size can only be the one that survives the worst case,
  which is what left a short question small in the middle of a large screen.
  `--prompt-max` is the ceiling, and it is where the two scales live: a phone
  keeps the `vh` ceiling it always had, and from `sm` up it is twice that, since
  a tablet or a laptop has the height to spend. It is registered with `@property`
  as a `<length>` in `globals.css` - an unregistered custom property computes to
  the word `clamp(...)` rather than a number, and the search needs a number.
  `promptSize` is still what the server renders, so a prompt arrives about the
  right size rather than snapping into place, and it is what a browser without
  JavaScript keeps. A viewport too short to leave the question any room at all -
  a phone held sideways - collapses the box to nothing, and there the fit stands
  aside and lets the declared size overrun, exactly as it did before: the
  question overflowing is bad, and the question hidden is worse.
- **Every answer is given on-screen, never with the iPad keyboard** - it keeps the
  question visible and the targets large and fixed. `answerMode` in
  `src/lib/session/answers.ts` decides which pad a question gets (`NumberPad`,
  `LetterPad` or `ChoicePad`); all three occupy the same fixed slot.
- Tapped answers (choice, true/false) commit on the first touch, with no Check
  button - there is nothing for a child to review. Typed answers keep a Check
  key, drawn as a tick (`CheckIcon`) rather than the word, so a child who cannot
  read yet still knows it. The speed run is the exception and has none: there a
  typed answer commits the instant it matches, so a tick could only ever be
  pressed on an entry the pad has already refused.
- After a wrong tap, the right option turns green and the child's turns red, so
  they always see which one was right.
- **A right answer moves on by itself after a moment; a wrong one waits.** The
  pad gives way to a Continue button and the right answer stays on screen until
  the child taps it, so nothing is missed by being slow to read. Tapped
  questions keep their pad while waiting - the buttons are what shows which
  option was right - and Continue sits beneath them.
- **A template's `hint` sits behind a lightbulb** under the question, so help is
  asked for rather than pushed - a child who doesn't want the method isn't given
  it. Tapping swaps the bulb for the hint; it resets with each question, and goes
  once the question is answered. Templates without a hint just leave the row
  empty, which keeps the question from jumping.
- **The rewards are a break and a badge, never a running score.** The stars fill
  the screen for a few seconds between rounds and the streak flashes once a day;
  neither sits on the play screen where a child could watch it and worry. There
  is no per-question timer and nothing a wrong answer takes away.
- Colours are CSS variables in `globals.css`, used as `text-(--color-ink)`.
- **The logo's palette is scoped to the two screens someone is *choosing* on.**
  `--color-grape`, `--color-berry`, `--color-leaf` and `--color-sun` are sampled
  from `public/logo.PNG`, and only the landing page and the child's home screen
  use them: a loud, warm mark sitting at the top of a cool blue page of boxes read
  as two different products. `--color-brand` is deliberately unchanged, so the
  play screen and the parent's report are untouched - a child answering a question
  does not need more colour, and a parent reading a report needs less. Both
  screens open on a soft gradient band (grape → paper → brand) with a blurred warm
  disc behind it; that band is the decoration, and everything below it stays flat.
- **There are no native `<select>`s.** A `<select>`'s popup is drawn by the OS -
  system font, system blue, its own rounding - so it is the one control the theme
  cannot reach, and on an iPad it lands a grey widget in the middle of a screen
  built from `--color-*`. `src/components/select.tsx` is a button plus a listbox
  with the same look as everything beside it, and options sized for a thumb.
  It comes in `lg` for the child's screens and `sm`/`md` for a parent's, matching
  the two scales above. The trigger is sized to its **widest** option rather than
  its current one - every label renders into one grid cell with all but the chosen
  one hidden - so picking "Year 3" after "Kindergarten" doesn't shrink the control
  and shift what sits beside it. It closes on an outside pointerdown or Escape,
  never on blur: a tap on an option moves focus off the button first, and closing
  there would remove the option before the tap could land on it.
- **`src/components/clock.ts` is the third browser shim**, beside `sounds.ts`
  and `speech.ts` and there for the same reason: it reads `Date.now()` and the
  device's own offset, so it could never live in `src/lib`, where every day
  question takes both as arguments. Which day a moment falls in is a question
  only the device can answer, so the profile menu's run of days, the home
  screen's goal panel and the play screen's goal bar all read it through
  `useSyncExternalStore` rather than rendering a number at UTC and correcting it
  a frame later. One `subscribeToTheClock` for all three - it was copied into
  each of them, comment and all.
- **Three sounds, and only on the play screen**: right, wrong, and a fanfare with
  the stars. `src/components/sounds.ts` is the shim - it lives beside the
  components, not in `src/lib`, because it touches `Audio` and could never be
  pure. Playing is best-effort like recording an answer: a silent switch or an
  autoplay refusal rejects the `play()` promise, and that is caught and dropped
  rather than thrown into the middle of a question. One element per sound,
  rewound rather than stacked - a child can answer faster than a clip finishes,
  and the newest answer is the one worth hearing. The files are preloaded when
  the screen mounts, since iOS gates *playback* on a gesture but not loading.
- **The fanfare is the same for one star as for three.** Finishing the round is
  what it marks; a thinner sound for a hard round would undo what the star floor
  is for.
- `public/sounds/*.m4a` - mono AAC at 48 kb/s, silence trimmed and peaks levelled
  so the three sit at the same loudness. About 5-13 KB each, from 300 KB+
  originals. AAC in `.m4a` rather than Opus because iPad Safari is the target and
  it plays this everywhere, with no fallback source to maintain.

## Narration

A child who cannot read yet cannot use the app at all: every question is a
sentence, and the door, the lightbulb and the tick were the only things on the
play screen that needed no reading. A speaker button beside the door makes the
question one of them.

**The switch is on the child's screen, not the parent's.** A column beside the
daily target would be the tidy home for it, and it is the wrong one twice over:
the person who needs narration is the one who cannot read a settings screen, and
iOS will not speak without a gesture, so the tap that turns it on has to be the
thing that lets it talk at all. The preference is `localStorage`, read through
`useSyncExternalStore` like the streak and the day's total - only the browser
knows it, so the server renders silence rather than guessing. A shared family
iPad is the cost, and it is one tap either way.

**Tapping the question repeats it**, and only while narration is on. A child who
missed it reaches for the words themselves, which needs no icon and no
explaining, and a child who can read never finds a button where the question is.
A revealed hint is read as it appears - asking for it is a tap, so it is also a
gesture that may speak - and answering stops the voice mid-sentence, since the
question is over and a voice under the right-or-wrong sound is two things at
once.

**Speaking a question is not reading its characters.** Prompts are generated, so
there is nothing to record, and once the holes are filled they still hold
`+ − × ÷ = / % ° $`, abbreviated units, and a bare `?` standing for the gap in
"12, 13, ?, 15". Handed over as they are, "What is 7 − 3?" is spoken "What is
7 3?", which is worse than silence. `src/lib/speech/narration.ts` is the
translation and is pure like the rest of `lib`: `spokenText` for the symbols,
`questionNarration` for a whole question. A `?` is the gap when nothing wordlike
precedes it and the sentence's own punctuation when something does - which is
what tells the two apart in "What goes in the box? 4 + ? = 9". Every `/` in the
shipped content is a fraction, because division is written `÷`.

**Word options are read out; numbers are not.** A word answer below Year 4 is a
`choice` question precisely because the child cannot spell it, so three unread
buttons would leave that question as unanswerable as it was. Numerals are read
long before words and four of them said back is noise. Options the prompt has
already *offered* are left alone - "Which ribbon is longer, red or blue?" does
not need "Is it red or blue?" after it. Offering them is what counts, not merely
saying the words: "What comes next? red, orange, purple, red, orange, purple,
red, ?" contains all three of its options and offers none of them, and taking
that as already said left a Kindergartener with three unread buttons. The word
that tells the two apart is "or", between two of the options and inside one
sentence, so both have to hold before the reading is skipped.

`src/components/speech.ts` is the browser shim, beside `sounds.ts` and for the
same reason: it touches `speechSynthesis`, so it could never be pure. Speaking is
best-effort, a new utterance cancels the one before it, and an en-AU voice is
preferred where the device has one. It is also the seam - the alternative was a
cloud voice, which buys consistency for an API key, a cache keyed by prompt and a
round trip in front of a waiting child. Swapping one in is a change to `speak`
and nothing above it.

## The logo

`public/logo.PNG` is the artwork as delivered - the badge, the wordmark and the
tagline, drawn on a white page. Everything else is cut from it and committed
beside it, so the derived files are the ones the app loads and the original stays
the thing to re-cut from:

- `public/logo-mark.png` - the badge alone, for headers.
- `public/logo-lockup.png` - the whole thing, for the landing hero.
- `src/app/icon.png`, `src/app/apple-icon.png`, `src/app/favicon.ico`,
  `src/app/opengraph-image.png` - Next wires these up by filename, so the only
  thing `layout.tsx` adds is a `metadataBase` for their absolute URLs.

**The white page is flood-filled to transparency from the edges inwards**, not
keyed off luminance: the white *inside* the mark - the book's pages, the pencil's
eyes, the sparkles - has to survive, and only a fill that starts at the border
leaves it alone. Without it the mark would sit on `--color-paper` as a faintly
paler square, `#ffffff` against `#f7f9fc`. The apple icon is the one that keeps
an opaque background, because iOS composites its own rounded mask over a square
and a transparent one comes out black.

**The mark alone is what goes in a header**, since the word "LearnR" is already
there in type beside it; the lockup carries its own wordmark and tagline, so it
is only used where nothing else is saying what this is.

**Not on the play screen.** That screen is one question at arm's length with
nothing else to look at, and a logo in the corner is exactly the sort of thing a
child watches instead of the question - the same reason the header counts no time
and no score.

## Rewards

`src/lib/rewards` - pure, like the rest of `lib`, and read by nothing that
decides what to ask next. Reinforcement is driven by the profile alone; stars and
streaks would make it reward-seeking rather than teaching.

**Stars come every `ROUND_SIZE` (10) questions**: 3 for a clean round, 2 for some
right, 1 for a round with none. The floor is the point - sitting through ten hard
questions is the behaviour worth rewarding, so a bad round still earns something,
and 3 stays worth aiming at. `RoundReward` covers the screen for a few seconds,
dismissable by a tap, and the next question's clock restarts when it goes so the
break never lands in that question's recorded time.

**`User.stars` is the app's one star total, and it is banked rather than
derived.** It used to be `SUM(LearningSession.stars)`, recounted from the stored
answers every time - which was self-correcting, and had to go the moment the
daily target arrived: a target is mutable, and a recount of a past day against
today's setting would take stars off a child who had earned them. So the total
is **incremented** by what is newly owed and never recomputed.

Nothing recounts a star total now, so the play screen's optimistic `+3` is the
only correction there is - which is why both it and the server value a round
with the same `closedRound` over the same answers.

What replaced the recount's idempotence is a guard on every increment. A round's
stars are banked against `LearningSession.roundsBanked`, read under `SELECT ...
FOR UPDATE` and moved up in the same transaction, so a repeated call, a retry or
two tabs answering at once each pay for a round exactly once - the same row lock
`updateTopicSkill` takes, for the same reason. The day's target uses a
compare-and-set on `User.targetDay`. The server still **decides** what is owed by
reading the stored answers; the client only says *that* a round closed, and the
banking happens after the tenth answer's write resolves, since racing it would
find nine answers and award nothing.

The cost is stated plainly because it is real: a dropped award no longer heals
itself. A total can fail to grow, but it can never shrink - which is the right
way round for the only number a child watches.

**The play streak counts days, not hours.** `User.playStreak` and
`User.playStreakDay` - a day number, not a timestamp, because a day here is the
child's (`src/lib/day.ts`) and a timestamp would need the offset re-applied at
every read. A missed day restarts at 1, not 0: the child is answering right now.
The write is a compare-and-set on the stored day, so two answers landing together
advance it once. `currentStreak` decides whether a stored run is still alive -
yesterday still counts, the day before does not - and it is computed in the
browser via `useSyncExternalStore`, since only the child's device knows what day
it is where they are.

An hours rule was considered and rejected: practice after school one day and
before school the next is twenty hours apart and would break a streak the child
kept perfectly well.

**Both totals ride on the profile menu** - the run of days, then the stars, then
the avatar, the same control on the home screen and the play screen so a child
never looks in two places for the two numbers. Days sit left of the stars: the
run is the thing that lapses if they stop. Behind the tap there is only the name
and the way out.

**Everything the playing screens read off the child's row is one query**
(`readPlayerState`): the level they last chose, the run of days, the star total
and the daily target all live on `User`, and both `/` and `/play` want all four
before they can render. Asked for a function at a time that was four round trips
to one row, with the target's two arriving *after* a `Promise.all` they had no
reason to wait behind - a waterfall in front of the first question a child sees.
The single-column readers that remain have callers that genuinely want one thing:
`readSelectedLevel` for the redirect that runs before anything else on `/play`,
and `readPlayStreak` inside the streak fold.

Both are drawn through `formatCount` (`src/lib/format.ts`), which pins `en-AU`
rather than reading the browser's locale - the totals are rendered on the server
and corrected on the client, and a locale that disagrees across that boundary is
a hydration mismatch. A star total has no ceiling, and "1,204" is a number to be
pleased about where "1204" is one to decipher.

Neither is a score. The star total only ever goes up - a whole round or a whole
day at a time - and nothing a wrong answer does takes anything off either of
them. A lapsed run
renders as nothing rather than a zero - a 0 beside a flame reads as a
telling-off, and the child is here to start a new one. The play screen still
flashes the streak once (`StreakFlash`) on the answer that extends it.

## Daily targets

`src/lib/rewards/target.ts` - optional, one per child, set by their parent. It is
the one thing in the app that asks a child to commit to something, so it is a
floor and never a cap: nothing stops them carrying on past it, nothing is taken
away for missing it, and a missed day produces no value at all. The only thing
the module ever says is that a day was met.

**Questions or minutes a day, and not per subject** - a child who answers twenty
questions has answered twenty whichever screen they were on, so every read behind
a target is cross-subject where `readObservations` is scoped. `TARGET_LIMITS`:
questions 10-60, minutes 5-30, in fives. The floors matter more than the
ceilings - ten questions is exactly one round and five minutes is a real sitting
at six, because the first thing this feature must not do is have a child fail at
something their parent chose. The ceilings stop a well-meaning parent setting a
bar nobody clears on a school night. `parseTarget` is the boundary normaliser,
like `parseYearLevel`: a target off the step or outside the bounds is refused in
that one place, so no caller has to know the bounds.

**A minute is summed `timeTakenMs`** - already capped at `MAX_TIME_MS` per
answer - and never wall clock. It is the same number the parent's report calls
"time on questions", so an iPad left on the sofa cannot earn minutes and the
target and the report can never disagree about how long a child practised.

**Hitting it is worth `TARGET_STARS` (10), flat rather than scaled** to the size
of the target. Scaling would make a child's star total a measure of how much
their parent asked of them, and hand a parent a dial on their child's rewards.
Ten is worth three or four clean rounds - clearly the day's biggest award,
without making a round worth nothing.

The award is one compare-and-set on `User.targetDay`, the shape the play streak
already uses, so a repeated or raced call pays out once. `awardDailyTarget`
recounts the day server-side before it writes; the client is trusted for the
offset, not for the total.

**Which answers are "today" is decided on the child's device**, because only it
knows the offset. The server ships `TARGET_WINDOW_MS` (two days) of answers and
the client folds them with `dayTotal` through `useSyncExternalStore` - the same
reason `currentStreak` is computed in the browser, and the server snapshot says
nothing rather than a number computed at UTC.

**The play screen's bar carries no numbers**, for the same reason the header
counts nothing. A minutes bar creeps during a question, capped at `MAX_TIME_MS`,
so what is shown can never run ahead of what will be recorded. **The play bar
goes once the goal is met and the home screen's stays**: on the play screen a bar
that no longer moves is only something to look at instead of the question, while
the home screen is where a child takes stock, and it is the one place that lasts
- the celebration itself is over in four seconds.

**The two celebrations queue, round first and day second** (`RoundReward`, then
`TargetReward`), because one answer can finish both and one tap cannot dismiss
two screens. `TargetReward` shares the round's shape and its fanfare
deliberately: a child has learned what that screen and that sound mean, and this
is the same kind of event, only bigger.

**The parent's practice calendar judges past days against the *current* target**,
since past targets are not stored. The note under it names the goal it is
judging by, so a fortnight that changes colour after the goal is raised has the
number that changed it written underneath. `readRecentAnswers` returns `null` on
a failed read, like `readObservations` and `readSittings`, and the calendar drops
the goal along with it - four weeks drawn as four weeks of missed days is exactly
the lie that convention exists to prevent, so the note says it could not check
rather than saying nothing. On the play path the same read is best-effort
(`?? []`): an empty bar is only an empty bar.

**The offset is bounded at the action, not trusted** (`parseOffsetMinutes`). It
is the browser's word, and the day it produces is *stored* - on `User.targetDay`
and `User.playStreakDay` - behind guards that compare against the day being
written. One absurd value written once would sit in the future and quietly
refuse every real day after it, which is a child's stars gone with nothing on
screen to say why. A refused offset declines the award; a recorded answer falls
back to UTC rather than being thrown away, because history is worth more than a
perfect day boundary.

## Speed run

Ninety seconds, one mode, how many you can get right. It is a game rather than
a lesson - the first thing in the app with a clock, a score and a number to
beat, all three of which the rest of LearnR deliberately withholds: the play
screen's header counts nothing and a session keeps no running score, on
purpose. A speed run breaks both rules, and that is safe to do only because it
is walled off from everything those rules protect.

**There is no wrong answer in a speed run.** A run moves on a correct answer and
on nothing else: the entry is judged as it is typed (`judgeEntry`), and digits
that can no longer become the answer flash the box red and clear it, leaving the
same question up to be typed again. Nothing is recorded about the attempt and
the run does not advance, so the score and the number of questions answered are
one number rather than two.

That one rule took several things with it, and each of them existed only to
describe a wrong answer: the Check key, Enter, the misses read back on the
result screen, the right / missed / answered tally under the score, the `of 20`
beside a score in the cabinet and the report's table, and the `answered` column
on both `SpeedRecord` and `SpeedAttempt`. What is left is the thing the screen
was always for. It is also the only place in the app where getting something
wrong costs nothing at all but the seconds - which is the honest shape of a
game against a clock, and is why the *lesson* still marks answers and this does
not.

**Sealed off because an `Attempt` carries a curriculum topic and an Australian
school year, and a speed run has neither.** `add.hard` is a drill, not a
question ACARA describes, and it belongs to no level. Recording it as an
`Attempt` anyway would put a topic outside the curriculum into
`weightTemplates`, the selector that decides what a child is asked next, and
forty answers in ninety seconds would swamp the recency-weighted `strength` of
every topic genuinely being learned faster than a session could produce them. A
speed run writes no `Attempt`, no `TopicSkill`, no star and no streak, and earns
no daily-target credit - the only row it ever writes is `SpeedRecord`.

**Twenty-six modes, and the list is closed.** A free "from" and "to" range
across the times tables would give something closer to sixty, most differing
from a neighbour by one table: two near-identical numbers, each set once and
never approached again. A record is only worth beating if the mode is worth
naming, so `modes.ts` enumerates the twenty-six by hand rather than building
them from a range: three difficulties each for addition, subtraction, division
and mixed, the ten single tables plus four named bundles for multiplication.
Fewer modes than a free range would give, and every one of them accumulates a
record with some history behind it rather than being set once and forgotten.

**Nothing drills the ten times table**, in a mode of its own or in a bundle.
Multiplying by ten is a place-value rule rather than a fact to recall - write
the digit, write a nought - so a run of it measures how fast a child can type,
and a mode is a thing to come back to and beat. That is `SINGLE_TABLES` beside
`TABLES` in `modes.ts`: the tables offered as a mode of their own, and every
table there is. The top bundle is `11-12` rather than `10-12` for the same
reason at a third the strength - three tables' worth of ninety seconds with one
of them free is a third of the run measuring nothing. Ten stays in **`all`**,
which means all of them and would be lying otherwise, and in what a **mixed**
run draws from, where the easy question among the hard ones is the point. Any
`multiply.10` or `multiply.10-12` already banked simply stops appearing - every
reader of a stored key runs it through `parseMode` and skips what comes back
null, which is the whole of what retiring a mode costs.

**A single table is labelled the way it is said: "7x", not "7 times table".**
Fourteen chips reading "n times table" are fourteen labels differing in one
character, which is the slowest thing to scan and the widest thing to draw, and
the short form is what lets the picker lay the singles out five to a row instead
of two. A bundle keeps the same notation at both ends - "2x to 5x", "11x to
12x" - so it reads as a run of the chips above it rather than as a different
kind of thing named a different way; `all` is the one that cannot be written
that way and stays "All tables". **`recordBanners` keeps the prose form
regardless** ("a personal best in the 7 times table", "in tables 11-12"), which
is the `operationLabel`/`operationNoun` split again: a chip is a control and a
banner is a sentence.

**An operation is labelled with the verb, not the noun**: "Add", "Subtract",
"Multiply", "Divide". A card, a heading and a button all name something to *do*,
the short word is the one a child reads without decoding four syllables, and
five cards labelled with it are the same width as each other where
"Multiplication" beside "Add" is not. `operationNoun` keeps the other form for
the one place that needs prose - `recordBanners` says "a speed run personal best
in easy addition", and "in easy add" is not English. It says **"a speed run
personal best"** rather than a bare one because that banner is the only thing on
a parent's report not about practice, and it no longer says "in 90 seconds":
every run is ninety seconds, so the phrase padded the score without telling a
parent anything they could not assume. Two tables side by side in
`modes.ts` rather than one derived from the other, because no rule turns
"Divide" into "division" that isn't this table written twice.

**Going back is not going home**, so `SpeedRun` takes both. The door inside a
run lands on the screen the run was started from -
`/#speed-run` for a child, `/speed` for a parent - because what someone
is usually undoing is "I picked Multiply", not "I opened this app". For a child
those are now the same page and not the same place on it: the door aims at the
speed section, where the cards and the scores are, and the result screen's own
door still goes to the top of home. "See records" goes where the back arrow
does, since the scores are the top of that section - which is why `SpeedRun`
takes no `recordsHref` of its own any more.

**A parent's speed screens run at the parent's density, but the run itself
does not.** `SpeedCards` takes the same `scale` prop `SpeedRecordsCabinet`
already had, and carries it down to the mode chips inside a card: at `'parent'`
they are `text-base`/`text-sm`, single-width borders and `rounded-xl`, like
everything else under `ParentShell`, because a parent picking a run is doing it
inside a report drawn at that size. `SpeedRun` takes no `scale` at all any more
and never did anything else with it - the ninety seconds are identical for
everyone, since a question readable at a glance and a pad hit without looking
are not things an adult wants smaller either, and so is the result screen. The
line is between choosing and playing, not between who is playing, and now that
choosing happens entirely on the cards the run has nothing on either side of
that line to size.

**The result screen wears the colour of the operation just run.**
`OPERATION_ACCENT` is one table shared by the cards, the cabinet and the result,
so finishing a Multiply run looks like the Multiply card that started it rather
than like the one blue number every mode used to share. Its `wash`, `text` and
`solid` classes are written out in full per operation because Tailwind reads
class names as literals - `bg-(--color-${op}-soft)` compiles to nothing. A
beaten best overrides the lot with the star tokens: the rarest state has to be
the one a player already recognises from the round rewards and the streak, not
just another operation's colour. Under the score there is
nothing: the tally that used to sit there was right / missed / answered, three
tiles that are now the same number three times, and the misses below it are a
list that can no longer have anything in it. The two blocks that remain arrive
on a staggered `reward-in` so the screen assembles rather than appearing whole,
and the score centres itself in the viewport rather than sitting under a panel
that is no longer there.

**The cards, the cabinet and the leaderboard are one screen**, and the scores
are the top of it. **Every screen that offers a run shows them**: the child's
home screen under "Speed run", and a parent's `/speed`.

**Which tab a screen opens on follows who is reading it.** A child opens on
their own records - they came to see what they scored, and the family board is
the context for it. A parent opens on the **leaderboard**: their own personal
bests are the least of what this screen has to tell them, and how everyone in
the house is going is the question they arrived with, the same judgement that
sends `/` to the report rather than to `/children`. It is one answer
(`CHILD_DEFAULT_TAB`, `PARENT_DEFAULT_TAB`) driving three things that must
agree - which tab is leftmost (`tabOrder`), which one the bare URL means
(`scoreTabHref`) and what a mistyped `?tab=` falls back to (`parseScoreTab`) -
so all three take it rather than each knowing a favourite of its own. A tab bar
whose left tab is not the panel under it is not a state that exists, and a
default tab that no URL names is a panel nothing can link back to.

**There is no `/speed` page for a child**, though `/speed` is now a page - a
parent's, see the routes below, and a child asking for it is redirected to the
section named here. The child's speed run screen *is* their home
screen - the scores and the five cards sit under "Speed run" below practice -
and a second screen showing the same two things existed only to be the way back
from a run. `CHILD_SPEED_HREF` (`/#speed-run`) does that without a page to keep
in step: the anchor and the id it lands on live together in `tabs.ts`, because
two copies of that string going out of step is a link that scrolls nowhere and
says nothing about it. `CHILD_SPEED_HREF` is itself built by calling
`scoreTabHref` rather than written out, so it cannot drift from the tab bar's
own idea of where the child's default tab lives.

It was three screens - the cards, and the two walls behind links underneath
them - which meant the only way to compare a card with itself was out and back
in, and the links were an invitation to leave a screen to look at cards about
the modes it was already offering. **`SpeedCards` has no links under it any
more**, and not a flag to turn them off either: every caller draws
`SpeedScores` directly above the cards, so there was no screen left for a true
value to serve. `SpeedScores` is the shared half - the tabs, the two reads and
the signed-out and no-household sentences - because three screens rendering the
same thing from three copies is three chances to drift.

**The two walls are `?tab=` on that one page, not a route each**
(`parseScoreTab`, `scoreTabHref` in `src/lib/speedrun/tabs.ts`). It is still
one URL per tab - a bookmark, a back button and a link from the home screen all
work - and both halves are still server-rendered, but the page now *knows*
which tab it is showing, so `ScoreTabs` is a plain server component instead of
the `usePathname` client one two routes forced. `parseScoreTab` **falls back
rather than refusing**, unlike `parseMode` and `parseYearLevel` beside it: those
normalise stored keys and real content, where this only picks which of two
panels is drawn, so a mistyped tab opens the screen's own default rather than
404ing a screen that works perfectly. It falls back to *that* rather than to a
fixed favourite so a junk tab and a bare URL land on the same panel instead of
on two. It is called inside `SpeedScores` rather than by each page, unlike
`?child=` and the rest: that component is the only thing that reads `?tab=`,
and a page naming its default *and* normalising against it would be naming one
fact twice.

**The scores sit above the cards** because what a player opens the screen for,
after their first run, is how they are doing - and the cards are five, so
reaching them costs a short scroll rather than a screen. The parent's copy is
two `Well`s, "Scores" and "Start a run", because that is how every other parent
screen separates two questions - and the board there lost the line explaining
that a parent's own runs are on it, since their face on the podium says it
better.

**On the home screen the tabs carry an anchor** (`scoreTabHref`'s `hash`,
`#speed-run`). The speed section is below practice there, so a tab switch is a
navigation that would otherwise land a child at the top of the screen, several
scrolls from the wall they were reading. It is the one screen that needs it, and
the reason it is a parameter rather than always-on: on `/speed` the
tabs are already at the top, and a fragment there would be a jump to where the
page already is.

**`tabPath` and `runPath` are two questions, not one.** A tab is a URL on the
screen the scores are *on*, and a run lives under `/speed/...` however that
screen was reached - the same string for a parent and not for a child, whose
scores are on `/` and whose runs are not. One `basePath` doing both jobs built
`//multiply` for every Try button on the home screen, which a browser reads as a
host called `multiply` rather than a path.

**Every card carries a Try button, and it goes straight into the run.** A card
names a mode and shows what has been scored at it, and until it had a button,
doing something about that meant backing out, opening the operation and finding
the same mode again to answer the question the card had just asked. One
`SpeedTryLink` serves both walls of cards, since the cabinet's card and the
leaderboard's card are deliberately the same object.

**Choosing a run is one screen, and the mode is the route.** It used to be two:
five operation cards here, and a second screen at `/speed/<op>` whose whole job
was to ask which variation, with a Start button under it confirming what two
taps had already said - three taps and a page load in front of ninety seconds.
The operation card now **opens in place** (`SpeedCards`) and its modes are the
buttons that start the run, so it is two taps and the second one *is* the run.

That second screen is gone rather than hidden, and it took `SpeedRun`'s
`'choosing'` phase, its `Chooser`, its `scale` and its `op` prop with it:
`SpeedRun` takes a `Mode` now, not a starting point it might change, and its
first paint - the server's included - is the count-in. It still starts the run
in a mount effect rather than a lazy initialiser, because starting one reads the
clock and makes a seed and a render may do neither.

**So `/speed/multiply.7` is a route and `/speed/multiply` is not.** The old
shape was the operation in the path with the mode as an optional `?mode=` on
top, and it was right while `/speed/multiply` was a screen somebody chose on.
It isn't one any more, and a route that only works with a query is a route
lying about what it is. The mode segment also makes `parseMode` the whole of
the validation, where the pair needed that *plus* a check that the path and the
query agreed about the operation - a mismatch only a hand-typed URL could
produce, and one that had to be handled anyway. Ordinary cards and Try buttons
build the same URL, so there is one way to name a run rather than two.

**The picker is a `<details>`, not client state**, exactly as the report's
"Needs a hand" rows are: the modes render with the page, the disclosure is the
whole interaction, and `SpeedCards` stays a server component that a browser
running no JavaScript can still open. All twenty-six modes are in the HTML. The
cards became a **stack** rather than a two-column grid when they gained
something to open: a card that opens has to open the full width or its modes are
chips in a column, and a grid with one cell three times the height of its
neighbour is a hole in a row.

**Opening one closes the others, and that is `name` on the `<details>`** rather
than an `onToggle` and a piece of state - the five share a name, which is the
platform's own accordion and the whole reason this still needs no client
component. An engine too old to know the attribute leaves them independently
openable, which is a screen that works rather than a broken one. Exclusive
because the open card is four rows tall at its worst, and two of those at once
is a section a child scrolls past rather than reads.

**Multiply gets two grids, because it has two kinds of chip.** A single table
reads "7x" and a bundle reads "11x to 12x", and a grid wide enough for the
second wastes most of a row on the first - which is what made fourteen multiply
modes seven rows of mostly white space. The ten singles get a dense run of small
square targets, **five to a row from `sm` up at either scale** so the two rows
are the same length as each other, and the four bundles the ordinary wide row
beneath them: four rows where there were seven. `isSingleTable` is what splits
them and it lives in `modes.ts`, not in the component - what counts as a single
table is that module's business. Every other operation has no singles at all and
draws one grid.

**A child's phone gets two columns everywhere it can, and the difficulties get
one.** Three chips into two columns is 2+1, the ragged half-row a grid of four
does not have, and "Moderate" is the widest label in the picker - at half a
phone's width it is already close to wrapping and at a third it certainly would.
So the difficulties stack, and the multiply card runs two across for its tables
as well as its bundles rather than the four the short labels would fit. That
costs the open Multiply card real height on a phone - five rows of tables where
there were three - and buys a target a thumb hits without aiming, on the device
where aiming is hardest. Scrolling a phone is cheap and a missed tap in a picker
is not. From `sm` up the width is there and every grid takes it: five tables to
a row, four bundles, three difficulties.

**A chip is coloured by how hard it is, green through to purple**, and that is
one ramp for all twenty-six (`modeHardness`). Easy, moderate and hard are the
ends and the middle of it. **The times tables ramp across it too, which is the
answer to what colour multiplication should be**: they have a difficulty order
of their own - a child who has 2x has not got 12x - so the thing worth saying
about a table is the thing the difficulties are already saying, and the
operation's own accent is on the card around them either way. A single table
takes its place from its **position** in `SINGLE_TABLES` rather than from its
value, so the missing ten leaves no gap between nine and eleven; a bundle takes
the mean of the tables it draws from, which puts `2-5` near the green end,
`11-12` near the purple one and **`all` in the middle** - a run of everything is
not the hardest run, it is the mixed one.

The three colours per chip are **mixed rather than picked from a table**, unlike
`OPERATION_ACCENT`, and for the opposite reason: an accent is one of five names
and a ramp is a continuum, so ten tables would need ten tokens differing from
their neighbour by a shade. `color-mix` is already how the practice calendar
shades a day - **in `oklch` here** where the calendar uses `srgb`, because these
two ends are far apart in hue and sRGB runs green to purple through a muddy
grey where oklch runs it through the teals and blues actually between them. The
text is darkened off the ramp rather than being the ramp colour, since a chip
label is small and `--color-leaf` on a near-white wash is under three to one.
`--tone`, `--tone-soft` and `--tone-ink` are registered with `@property` in
`globals.css` for the reason `--prompt-max` is: an unregistered property holding
a value the browser cannot parse takes the whole declaration down with it, so an
engine without `color-mix` draws the ordinary card colours instead of drawing
them wrong. Nothing but the colour reads `modeHardness` - it is not a difficulty
the selector acts on, and it never reaches an `Attempt`.

**The way out of a result is the door, top-left, exactly where the play
screen puts it.** It was a third button in the row under the score, which made
three equal boxes of two ways *on* and one way *out* and gave "Go home" the
same weight as the button the screen exists for. **Going again is a glyph too**
- a loop, which is what repeat looks like on every remote a child has already
used - so the button they press most needs no reading, the argument the door,
the tick and the lightbulb are all built on. Both keep their words in
`aria-label` and `title`: off the screen, not off the page. What is left in the
row is a big coloured loop with "See records" under it, and **neither is drawn
as a box**: two filled buttons side by side made a toolbar of a screen with one
number on it, and put the loudest thing on it under the score rather than the
score itself. What is left is one thing to do and one thing to read - the glyph
large enough to say it is the thing to press, since nothing is drawn round it,
and the link plain underlined text. "See records" lands where the door does - the screen the run was started from, whose top half is the
scores - so `SpeedRun` no longer takes a `recordsHref` of its own: there is
nothing left for a second URL to be, and one that could drift is worse than
none.

**And the result says when a run moved the player on the family board.** It is
the one leaderboard fact that is *news* rather than something to go and look
at - the run just happened - so it sits on the result and nowhere else.
`standingChange` (`src/lib/speedrun/leaderboard.ts`, pure and tested beside
`familyStandings`) decides whether there is anything to say and hands back null
otherwise: **null when nobody else runs that mode**, because a board of one is
not a leaderboard and being 1st on it is a prize for turning up - the same
judgement the leaderboard page makes before it draws anything - and **null when
the place did not change**, which is most runs. A place can only ever improve
from your own run, so a standing repeated after every one of them would be
furniture; a standing that appears only when it moved is worth reading. Arriving
on the board counts as a move, with `previousPlace` null to say so, and reads
"You're 3rd in the family" where a climb reads "Up to 2nd". Ties share a place,
`placesFor`'s rule, so matching the leader is joint first.

The rank is computed from the *rivals'* bests alone - the player's own two
scores are already in hand as `previousBest` and `best` - and read **after** the
write, since a place among what is stored is not a place among what the run
arrived with. It is best-effort and quiet like everything else on this path: a
household that cannot be read costs the line, not the result. `readStanding`
resolves the family through `householdId` and `householdMemberIds`, which was
lifted out of `readFamilyRecords` rather than written twice - two copies of "who
counts as this family" is the second truth `ChildShare` carrying no `ownerId`
exists to avoid.

**The cabinet lists what has been run, and nothing else.** A mode never played
has no record to show, and twenty-six rows of dashes made a to-do list of a
trophy case - the four scores actually set were the smallest thing on a screen
mostly composed of what had not happened. A player with no runs at all gets one
sentence. What is missing is not the prompt to go and play: the five cards above
are, and they are always all five.

**The cabinet is the leaderboard's card, with a table where the podium goes.**
Same coloured title bar carrying the whole mode name, same foil sheen, same
fixed portrait frame, same `OPERATION_ACCENT` - the two screens answer
neighbouring questions (how the house is going, how *I* am going) and should be
the same object with a different picture on the front. A podium is the wrong
picture for one player: it would be one face with two holes punched beside it.
So the picture is that player's `HISTORY_RUNS` (5) best runs at the mode,
highest first, **the top one bold and starred**. It is the number that is
really the record - the one `SpeedRecord` keeps, the leaderboard ranks and the
banner announces - and the four beneath it are what say whether it was a fluke
or a floor. Only one row is ever starred, even when a later run matched it: the
star marks the run that *set* the best, which is the run `achievedAt` names.
Cards are ordered freshest first on the runs *shown*, the leaderboard's rule
for the leaderboard's reason - a sixth-best run this afternoon changes nothing
on the card and must not reorder the board.

**`SpeedAttempt` is that history, and `SpeedRecord` stays the maximum.** A table
of five cannot be built from one row per mode, so every finished run is now
written down whether it beat anything or not - the run that failed to beat the
best is exactly the kind that says whether the best was a fluke. The two writes
go together in `submitSpeedRun` and are independent: the record decides what the
result screen says, the attempt is best-effort like `records.ts`, and a lost
attempt costs a line of history rather than a game. It needs no lock and no
guard at all, unlike either of its neighbours - an insert is neither a maximum
nor a counter, so a retry writes a second row instead of paying twice, which is
the honest reading of two runs anyway. `readSpeedAttempts` slices the top five
per mode with a `ROW_NUMBER()` window, the shape `readAnsweredQuestions` uses
and for its reason: taking the last few hundred runs and hoping would show
nothing for the mode somebody came to look at. `runHistory`
(`src/lib/speedrun/history.ts`) is the pure half, beside `leaderboard.ts`,
because which of two tied runs is starred is not a thing to judge by eye in a
component.

**A parent's report gets a table instead of the cards** (`SpeedTable`, in the
`Speed runs` well on `/progress`). The cards are collectibles - a coloured
frame, a foil sheen, a starred best - and they are built for the player, who
reads a wall of them by colour the way they read a wall of cards. A parent
skimming a weekly report is reading down a column instead, so the same data is
one row a mode: the best, the **latest** run, and the change between that run
and the one before it. Each is one number - a run's score is now also its count
of questions, so there is no "8 of 20" left to disambiguate a bare 8 with. The
child's own trophy screen and the parent's own runs at
`/speed` both keep the cabinet - the cards are the right shape
for the question those screens answer.

**The latest run is the number in the middle, and the best is only the standing
figure.** A best cannot fall, so a table of bests is a high-water mark that
reads the same whether a child improved, plateaued or stopped playing a
fortnight ago - it cannot answer the question the report exists for. The change
beside it is what a parent is actually reading the row for, and it is a
percentage of the previous run except where that run scored nought, where a
percentage is a division by zero and the count gained is the only honest thing
to put there. A first run has nothing to compare against and gets an em dash
rather than a zero, since no change and no previous run are different things.
Rows are ordered by when a mode was last played, freshest first - the
leaderboard's rule and the cabinet's, for their reason.

`speedSummaries` (`src/lib/speedrun/summary.ts`) is the pure half, beside
`history.ts`, and `readSpeedSummaries` is the read. It takes the latest two runs
per mode **and** the best, with two `ROW_NUMBER()` windows over the same rows:
one ranks by score so the best survives however old it is, one by recency so the
pair the change is measured from always does. The best is then the maximum over
what came back rather than a number read from somewhere else, so the table can
never claim a best that none of its own rows could have set.

Every record set before the table existed is backfilled as **one** run each,
carrying the record's own `achievedAt` - one run is all that can honestly be
recovered, since the best was the only run ever written down. Without it a
player who had records saw blank cards while the leaderboard, still reading
`SpeedRecord`, showed those same scores back to them.

**The family leaderboard ranks the household, per mode, first to third.**
the leaderboard tab, beside the cabinet on every screen that offers a run - the
child's home screen and `/speed`. A household is `User.parentId` read
from both ends - a parent and the children they manage - which `householdId`
(`src/lib/children.ts`) resolves for whoever is looking; it is `parentId` alone
for the reason ownership always is, so there is no second column to drift out of
step. A **parent is on the board**, since they play too and a board that quietly
left them out would not be the one their children are reading. A child on their
own Google account and a parent with no children have no household at all, and
get a sentence rather than a board of one.

**A viewer a child was shared with widens the board, on both sides.** A
separated parent, or any other second grown-up given a share, is on that
child's leaderboard, and the child's household sees them back - the whole
point of sharing a child with a co-parent is that they *are* raising the same
child, not reading about them from outside. What crosses is narrower than the
household itself: `readFamilyRecords` (`src/lib/speed-records.ts`) reads the
household as before, then reads every `ChildShare` touching it in either
direction - one where this household is the owner sharing a child out, one
where it is the viewer a child was shared in to - and
`extendHouseholdWithShares` (`src/lib/children.ts`, pure and tested) adds only
the viewer and the specific child a grant names, never the rest of either
side. A sibling nobody shared stays off both boards, the same privacy the
report itself already gives a share.

`familyStandings` (`src/lib/speedrun/leaderboard.ts`) is the ranking, pure and
tested like `banner.ts` beside it, and it needs no schema: a leaderboard is
`SpeedRecord` rows sorted, on the same maximum the cabinet stars.
**A tie shares a place and skips the next** - 1st, 1st, 3rd - because in a
family of three a tie is common and breaking it on a technicality hands someone
a second place they did not lose; within one, whoever got there first is listed
first, which is the only thing that honestly separates them. The cut is at three
*places*, not three rows, so a three-way tie for first shows all three names.
Only modes somebody has run appear - the cabinet's rule above, for the
cabinet's reason - and they are ordered **freshest first**: the newest
`achievedAt` among a card's *places*, so a fourth-place run, which changes
nothing anybody can see, does not reorder the board. Twenty-six cards is more
than anyone reads top to bottom, and the ones worth reading are the ones that
just moved. Equally fresh modes keep `MODES` order between them.

**A mode is a collectible card, and its result is a podium.** One card per
mode, twenty-six of them: a coloured title bar carrying the whole name -
"Add - Easy", "Multiply - 7x" - and the podium as the picture
beneath it. A child reads a wall of them the way they read a wall of cards, by
colour and by who is on the front. The mode used to be a subtitle under the bar,
which split one name across two zones and spent a line of the card's height
saying the second half of it. The frame is tall and portrait because a podium needs height more than
width, and a card wider than it is tall is a row wearing a border.

First sits at the top with a crown above the circle, second below it to the
left, third lower again to the right, so no two of the three sit on one line.
Each place is a face with its score beneath it: **both the crown and the score
are captions to the face, and neither may cover it** - the board shows faces
instead of names precisely so a pre-literate child can find themselves, and
covering the picture would cost it the one thing it is read for. It replaced
five operation sections of stacked rows, where first, second and third were
three lines of the same size told apart by a badge; position says who won
before anything is decoded. The operation headings went with the sections
because the card's own title bar carries them.

**A place nobody holds is drawn as a hole punched through the card**, not left
out. The podium is the card's picture, and a card missing a third of it reads as
one that has not loaded; a recessed circle with a dashed rim says what a gap
says - the place exists and nobody is in it - which is the honest state of a
mode only one person in the house has run.

**The card carries a foil sheen**: white at low opacity over the operation's
wash, a soft light from the top-left and one diagonal band across it, plus a
hairline along the top of the title bar. It is written as one gradient shared by
every card rather than a per-accent one, so there is nothing to keep in step
with `OPERATION_ACCENT`, and it sits *under* the podium - a gloss across a
child's face would be decoration spoiling the one thing the card is read for.

The podium is laid out by *place* rather than by list position, so a shared
first puts both faces on the top step rather than demoting one of them to the
left. **A card wears its operation's colour** - `OPERATION_ACCENT`'s solid in
the title bar, its wash behind the podium and its border around the lot -
because twenty-six identical white boxes are told apart only by reading their
titles, and Multiply here is the same pink as the card that starts the run.
That accent gained a `line` alongside `border`, since `border` was only ever a
hover. Six across on a desktop, five on a tablet held sideways, four on one
held upright, two on a phone, and **every
card a fixed height**: a grid row stretching its cards to whichever of them
wrapped its mode label is what makes the next row a different size. The podium
centres itself in whatever the title leaves, so a mode with one place and a mode
with three are the same card.

**Multiplication has no difficulty axis, because the times tables are how
multiplication is drilled.** "Hard multiplication" answers a question nobody
asked when a child came to practise their sevens - the table stands in for a
difficulty of its own. Mixed still needs multiplication bands, because a mixed
run has no table to choose and multiplication is one of its four operations
regardless; `MIXED_TABLES` gives it 2, 5 and 10 at easy, the whole of 2-10 at
moderate, and the full set at hard.

**Every answer is a non-negative integer, because the number pad has no minus
key.** Subtraction never goes negative - each difficulty's `y` is bounded by
`x`, an ordered var referencing one already drawn - and division is exact by
construction: built as a divisor times a quotient (`x: d * q`) rather than
drawn and then checked, so there is nothing for rejection sampling to reject.
**Hard means hard, not just bigger digits**: `add.hard` is constrained to carry
and `subtract.hard` to borrow, because two-digit-plus-two-digit without that
constraint draws 20 + 30 about as often as 37 + 58, and a "hard" that draws its
easy cases just as often is moderate wearing a bigger font.

**A record needs no row lock, unlike `roundsBanked` or `targetDay`.**
`User.stars` is *incremented*, so a repeated call would pay a child twice if
nothing stopped it - that is what the round-star lock exists for. A speed
record is a maximum, and a maximum is idempotent: `best: { lt: run.correct }`
in the update's `WHERE` clause is the whole guard, and a repeat, a retry or two
runs landing at once all agree on the same outcome with no transaction needed.
The one place that still needs care is the *insert* - the row cannot be locked
before it exists, so two concurrent first-ever runs on the same mode can both
read no row and both try to create one. That is the identical race
`updateTopicSkill` hits on `TopicSkill`, handled the same way: catch the unique
violation and retry the guarded update once. One time round is enough.

**A first run is not a record.** Recording one as a record would make a
personal best mean somebody *improved*, which a first run has not done, and it
would let a child working through the modes fire twenty-six notifications at
their parent in an afternoon. The result screen has a third thing to say rather
than two - "that's your score to beat", where a fanfare would be invented - and
a fourth for when the run was never banked at all: signed out, no database, or
a write that failed, in which case the screen claims no best rather than
pretending the run was a first one. `seen` is `false` if and only if a run is
reported as a record, on the write and the read alike, so the same event can
never tell the child "new best" and leave the parent's banner silent, or the
reverse.

**A run that got nothing right is never submitted.** Banking a nought would
store a best the child's first real attempt then "beats" - laundering a first
run into a celebrated record through a run that never actually happened. The
guard used to be on the number of answers rather than the score, so that nought
out of eight - a real run with a real baseline - was still banked. There is no
such run any more: a run only moves on a right answer, so a score of nought and
a run nobody touched are the same thing, and nought is the one score with
nothing to say.

**The timer is one CSS transition, and only the pulse comes from React.** The
bar's width is set once, at the start of the run, as a transition running down
to zero over the time left; a bar re-rendered from state ten times a second
under a child answering as fast as they can would repaint the whole screen to
say what a transition says for free. React still owns the beat - `pulseFor`
steps the animation faster at 30, 15 and 5 seconds left, because that changes
three times in ninety seconds and not thirty.

**The next question sits above the current one, dimmed, and it is real state,
not a render trick.** Reading ahead is most of what makes a fast run fast, so
`RunState` carries a lookahead of one: the question drawn as "next" is the very
question that becomes "current" the moment this one is answered, not a preview
redrawn to match. An answer commits the instant what is typed matches the
expected answer as an exact string, and there is no Check key to grade it any
other way - so `07` for 7 is not a right answer waiting to be checked, it is a
leading zero the answer does not begin with, and it is dead on the keystroke.
A dead entry clears itself immediately rather than waiting for a backspace:
at this speed a stuck entry costs more than the mistake did, and it is paid
most by the child mistyping most. Nothing is shown about what the answer should
have been, on the screen or afterwards - ninety seconds is not teaching time,
and the question is still up to be got right.

**The speed run's pad has no tick, no decimal point and no Delete**
(`NumberPad` takes all three as options; the play screen passes all three).
There is nothing to check, and every answer here is a whole number by
construction, so a `.` would not be a key that does nothing - with the entry
judged as it is typed it is a key that can only ever kill what it lands in,
sitting next to the `0` it would be mistaken for. Delete goes for the same kind
of reason: a dead entry already clears itself on the keystroke that killed it,
so all a backspace has left to undo is a digit typed and thought better of,
which costs less to finish and let the pad refuse than to reach across the pad
for. A physical Backspace still works, because a keyboard player reaches for
nothing.

**What that buys is the fourth column for `0`, full height** - the Check key's
own slot, in an ordinary key's clothes, and the pad keeps its four columns
rather than narrowing to three. A speed run is scored on how fast a whole
number can be typed and about a third of the answers contain a nought; on the
bottom row it was the one digit a thumb had to travel for, which is a child's
own complaint about the pad. Given the tall column it is the biggest target
there and the only one that can be hit without aiming. Styled like every other
digit and not like the tick, because it *is* a digit - a brand-filled column
says "this key ends something", which is the one thing `0` does not do.

**A parent plays too, privately.** `/speed/[mode]` renders the same
component the child gets, and a parent's own runs bank to their own
`SpeedRecord` rows the same way. `SpeedBanner` reports someone else's
achievement and never your own: `readUnseenRecords` is scoped to a parent's
*children*, so a parent beating their own best produces no row in their own
banner - there is nothing the banner needs to do to keep that true.

**`/speed` and `/speed/[mode]` are one pair of routes serving whoever is signed
in, branching on the reader rather than on the URL.** A parent's speed screens
used to nest under the report at `/progress/speed` and `/progress/speed/[mode]`,
on a real argument: a route group adds no path segment, so a bare
`(parent)/speed` would have sat exactly beside the child's `/speed/...` - two
top-level URLs a hyphen apart, told apart only by spelling, and a redirect or a
copied `href` that got the two backwards produces no build error and no test
failure. Nesting distinguished by depth instead, which cannot be muddled the
same way.

**What retires that argument is that there is no second path left to confuse.**
The two routes were never two screens: `/progress/speed` rendered the same
`SpeedScores` and `SpeedCards` the child's home screen does, and
`/progress/speed/[mode]` rendered the same `SpeedRun` with two different hrefs
on it - which is what the whole second route amounted to, since the ninety
seconds are identical for everyone and `SpeedRun` takes no scale. A parent and a
child asking for `/speed` are asking the same question, and the difference
between the answers is a frame and a density, not an address. So `readViewer`
(`src/app/(parent)/parent.ts`) reads the role without deciding anything on it -
`readParent` beside it is a *gate* and redirects, which is the wrong shape for a
screen that serves two kinds of reader - and each route branches once.

**A child is redirected rather than served.** Their speed screen is still their
home screen, so `/speed` sends them to `CHILD_SPEED_HREF`; drawing the section a
second time at its own URL would be the duplication that deleting `/speed` fixed
the first time. A signed-out visitor goes the same way, landing on the page that
offers them a way in. `PARENT_SPEED_HREF` is the one place the parent's path is
named, beside `CHILD_SPEED_HREF` and for its reason.

The `/speed` page draws `ParentShell` itself rather than inheriting it, since it
sits outside the `(parent)` route group - it has to, that group adding no path
segment and `/speed` being the path. `ParentNav` reads the URL for which item is
current, so the nav highlights "Speed run" from here exactly as it did from under
`/progress`. What the move *buys* `useParentScreen` is the end of an ordering
constraint: `/progress/speed` and `/progress` both matched a speed URL, so the
specific one had to be tested first or every speed screen highlighted
"Progress". The three prefixes are disjoint now and no line depends on sitting
above another. The cost is one account read on the child's run path, which
previously needed only the session.

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
"no children" and is not redirected - it says so and stays put.

`/children` is that other screen: a card per child with name, avatar and level,
plus add, edit, remove and the login code. It does not link to the report: the
nav above it already goes there and the report picks its own child, so a second
way in was a button per card saying what one dropdown already says. Both screens sit in
`ParentShell`, which carries the title, the two-item nav between them, the
profile menu and the curriculum link - the last of which follows every signed-in
branch, a parent's included, because it is the one thing they would actually want
to read. That link is a panel rather than a footnote: a line of small print under
a page of boxed sections is the shape of something nobody is meant to click.

**The shell is a layout, not something each page draws.** Both screens live in
the `src/app/(parent)` route group and `layout.tsx` renders `ParentShell` around
them, so hopping between the report and the profiles replaces only what differs:
the logo, the profile menu and the nav stay mounted rather than being torn down
and rebuilt, which is what made the hop flicker. A layout is never told which
page it is wrapping, so the two things that vary - the title and which nav item
is current - read the URL from the client (`ParentHeading`, `ParentNav`), and
`resolveChild` picks the child the `?child=` parameter names so the heading and
the report can't disagree about who is on screen. The layout is a frame and not
a gate: it does not re-run on a client-side hop, so `readParent` - which is
where the sign-in and parent-role checks live - is called by the pages too, and
`cache`d so the two calls in one request are one query.

**The child card's buttons are all glyphs.** Every card carries the same three
and every card says the same thing with them, so the words were only ever taking
up width - and on a narrow screen they pushed the row onto a second line. The
code button keeps its three states and gets a picture for each: a **key** when
there is no live code, because that state is the one that changes something, and
an **eye** - struck through once the code is on screen - for revealing and
hiding what is already stored. Two pictures rather than one, because issuing and
revealing are not the same act. The label they lose moves to `aria-label` and `title` - it is off the
screen, not off the page - and the buttons stay the same height as the ones
beside them so the row still lines up. Remove is a bin rather than a cross: a
cross on a card reads as "close this", and dismissing the row is the one thing
that button must not be mistaken for.

**Removing a child is confirmed in the card, never with `confirm()`.** The
browser dialog is unstyled, unreadable on an iPad, and - being synchronous - the
one thing on that screen that can freeze it. It also cannot say what is being
lost, which is the only reason to ask: the row cascades, so the confirmation
names the child and says the answers, progress and login code go with them.

**A parent's screens say the level short**: `shortYearLabel`, so Kindergarten
reads "Year K" beside every other "Year n". A row of short facts wrapping for
the youngest child and nobody else is the thing to avoid, and it keeps a level
dropdown from being sized by its one long option. The child's own screens keep
`yearLabel` - there is room there, and it is their year being named.

**Parent screens are not built to the child's scale.** The play and level screens
are sized for a six-year-old holding an iPad at arm's length; a parent is reading
a report on a laptop, and blowing that up only means more scrolling and less on
screen. So `ParentShell` and everything under it run denser: `text-sm`/`text-base`
body, single-width borders, `rounded-xl`, `px-3 py-1.5` buttons. The one
exception is the login code itself, which is still drawn large - it is read off
this screen by eye and typed into another device.

A **managed child** is a `User` row with `parentId` set, no email and no
`Account` row - nothing OAuth about it. Because it is an ordinary user row,
`LearningSession`, `Attempt`, `TopicSkill`, `records.ts` and the play actions all
work on it unchanged. `parentId` is the only flag that matters downstream: it is
what fixes the level. A managed child gets `SubjectCards` for their
`selectedLevel` with no dropdown, and `/play` **redirects** a mismatched `level`
parameter back to theirs - hiding the dropdown while leaving a typed URL open
would not be enforcing anything.

A child who signs in with their own Google account (`role: 'child'`,
`parentId: null`) behaves exactly as before, dropdown and all.

**Signed out, both ways in live in the landing page's top bar as peers** - a
grown-up signs in with Google, a child types their code, and neither is the
fallback for the other. On a phone there is no room to say that side by side:
four characters read off another screen have a floor on how small they get, so
below `sm` the pair goes behind one "Get started" button and opens as a panel
underneath, where each gets a full row and a line of copy saying whose it is.
`GetStarted` renders them **once** and re-lays them out in CSS - `sm:contents`
dissolves the wrapper at the wider size - rather than shipping a phone copy and
a desktop copy of the code box, which is how the two would drift apart.

**The landing page says what this is and who it helps, not how it is built.** How
the selector weights a topic, that questions are generated rather than stored, how
long a code lives - all true, all the author's preoccupations, none of them what a
parent deciding in thirty seconds is asking. They want to know whether their child
will use it and whether they will learn anything, so the page is a hero, a panel
each for *what your child gets* and *what you get*, three numbered steps, and the
coverage. The single exception is the curriculum, which stays because it is the
one claim on the page a parent can actually check - and it is rendered straight
from the shipped templates (`subjectOverview`), so the page cannot promise more
than the questions deliver. The one call to action is a parent's; a child's way
in is the code box in the bar, and it stays there.

**Login codes.** A parent generates a 4-character code
(`src/lib/login-code.ts`) that a child types on the sign-in screen. The charset
excludes `0/O` and `1/I/L` - a code is read off one screen and typed into
another, so the pairs that get confused in that handoff are not in the alphabet.
Randomness is injected, as everywhere in `src/lib`, but the caller must pass
`crypto.randomInt` and **not** the seeded `Rng`: replayability is exactly the
property a login code must not have.

**The short-lived thing is the code, not the login.** A code lasts an hour and is
spent at redemption - `UPDATE ... RETURNING` clears it and identifies its owner in
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
live code, "Show code" when there is one (revealing what is already stored - a
child may be halfway through typing it, and re-issuing here would break the code
in their hand), and "Hide code" once it is on screen. Regenerating is its own
button under the revealed code. That code is centred in its panel with a copy
button right beside the digits, since copying is the other way it reaches the
child's device - read aloud across a room, or pasted into a message. The copy
turns into a tick for a moment: a clipboard write is otherwise invisible, and a
button that looks unchanged gets tapped twice. The write is best-effort like
playing a sound - an insecure context rejects it, and a code still sitting on
screen to be typed is not worth throwing over.

`isCodeLive` is the pure test that picks between the first two states, and the
hour is counted down in an effect rather than at render - reading the clock
while rendering is not something a component gets to do.

Redemption is **not** a NextAuth provider. Auth.js refuses to combine a
Credentials provider with database sessions (`UnsupportedStrategy`), and moving
the app to JWT sessions to get around that would cost server-side session state
for nothing. Instead `redeemLoginCode` writes the same `Session` row the Prisma
adapter would and the action sets the same cookie - `auth()` cannot tell the two
paths apart. That only works if both agree on the cookie, so `auth.ts` pins
`SESSION_COOKIE_NAME`/`SESSION_COOKIE_OPTIONS` explicitly rather than leaving
Auth.js to switch the `__Secure-` prefix implicitly, and exports them.

**`/signin` is where a sign-in goes when it does not work, and it is not
optional.** `auth.ts` names it as `pages.signIn`, and Auth.js resolves *every*
`SignInError` against that setting - `AccessDenied`, `OAuthCallbackError`,
`OAuthAccountNotLinked` and `MissingCSRF` all carry `kind = 'signIn'` - so it is
not a screen anybody navigates to on purpose. It shipped missing for a while,
which made the ordinary act of tapping "Sign in with Google" and then declining
on Google's own consent screen land on a 404, indistinguishable from the app
being broken. `GET /api/auth/signin` redirects here too, with a `?callbackUrl=`.

Deleting the `pages.signIn` line instead - one line rather than a page - would
have let Auth.js render its own, and that is the wrong way round: the built-in
page is unstyled and unbranded, which is the objection this app already makes to
a native `<select>`, only louder, since this is a whole screen and the first one
a failed sign-in shows. It carries **both ways in as peers**, the landing page's
rule, and it holds harder here: somebody bounced out of a sign-in is exactly who
might have been trying the wrong one of the two. A signed-in visitor is
redirected home rather than offered a second sign-in.

`src/lib/signin.ts` is the pure half, tested, and it is two boundary normalisers
beside `parseYearLevel` and the rest. `authErrorMessage` turns an `?error=` code
into a sentence about the account rather than the protocol - "OAuthAccountNotLinked"
is true and useless to a parent - and **falls back rather than refusing**, for
`parseScoreTab`'s reason: Auth.js may add error types in a minor release, and a
page rendering nothing for one it has not heard of leaves somebody with no
account of why they are on it. Only the codes a single Google provider can
actually produce are named; a list obliged to be complete is a list that goes
stale against a dependency. `parseCallbackUrl` refuses anything but a path
inside this app, since it decides where a freshly signed-in session is pointed:
an absolute URL there would hand somebody's new session to a site somebody else
chose, the argument `parsePhoto` makes about a remote image. `//host` and `/\host`
are refused by name, because a slash a backslash disagree about is exactly where
an open redirect lives.

`src/lib/accounts.ts` holds the Prisma side, following `records.ts`: every child
mutation scopes its `where` by `parentId` as well as `id`, because the child id
round-trips through the browser. Unlike `records.ts` these are **not**
best-effort - a silently failed answer costs history and the child plays on, but
a silently failed login is a child locked out and a silently failed removal is a
parent lied to, so the mutations report whether they worked.

## Profile pictures

A parent can give a child a photograph, and **the preset animal is what shows
when they have not**. The eight animals in `src/lib/avatars.ts` are still the
fallback everywhere and still the whole story for a family that never uploads
anything - a photo is an addition to that list, not a replacement for it.

**Nothing is uploaded.** `src/components/photo-crop.tsx` decodes whatever
picture was chosen with `createImageBitmap`, draws the circle's square into a
256px canvas and encodes WebP, so what reaches a server action is about 20KB
whatever the camera produced. That is why there is no size limit and no MIME
allow-list on the way in: the test of a picture is that the browser could decode
it, and a 12MP HEIC and a 200px PNG cost the database exactly the same. It is
the fourth browser shim, beside `sounds.ts`, `speech.ts` and `clock.ts`, and for
the same reason - `File`, `createImageBitmap` and `<canvas>` could never live in
`src/lib`.

**The geometry is pure and tested** (`src/lib/photo/crop.ts`): `coverScale` is
the zoom floor at which the picture covers the window, so a crop with an empty
crescent in it cannot be produced; `clampOffset` is what a drag may not do; and
`sourceRect` is the square handed to `drawImage`. Judging that by eye in a
component is exactly what the `lib` rule exists to prevent, and there are no
component tests here to catch it later - vitest is node-only.

**`parsePhoto` is the boundary**, beside `parseYearLevel`, `parseTarget` and
`parseAvatar`: only a `data:image/webp;base64,` string under `MAX_PHOTO_BYTES`
is ever stored. A photo arrives through a server action, which is to say through
the browser, so a remote URL accepted here would be a way to make every screen
that draws this child fetch something somebody else chose. The byte cap is
defence against a hand-rolled call, not against a parent's camera roll.

**`ChildPhoto` is a table, not a column on `User`.** The Auth.js adapter selects
whole user rows on every authenticated request, and a photo has no business
riding along with a session lookup; the row is joined only where a face is
actually drawn. It cascades with the child, so the removal copy's promise that
the answers, the progress and the code go with them stays true of their picture
too.

**`ProfileFace` is the one place the fallback order lives**: photo → the Google
picture a grown-up has → the preset animal → the initial → a silhouette. Six
screens draw a face, and the order got copied the moment it was written twice.
Threading it through the profile menu fixed a bug it walked past: a managed
child has no Google `image`, and that menu had never looked at their `avatar` at
all, so a child saw their initial on the one screen that is theirs.

**The leaderboard shows faces and no names.** Everywhere else a face sits beside
a name; there it replaces one. The board is the screen a pre-literate child
reads for themselves, which is the reason the avatars exist in the first place,
and a photograph is found faster than a name by someone who is not reading
either. The name moves to the face's `alt` and `title`, so a hover and a screen
reader still have it. There is no "you" chip either: on a card of three faces
the viewer's own is the one they already know by sight, and a label naming it
was a word on a screen built to need none. A grown-up in the household with no Google picture is a
lettered circle among photographs; that is the honest cost of the trade and not
worth an upload path of its own yet.

## Sharing a child

A second grown-up - a separated parent, a grandparent, a tutor - can be given a
child's report and nothing else. `src/lib/sharing.ts` is the Prisma side, beside
`accounts.ts` and following its rules; `src/lib/share-link.ts` is the pure half,
beside `login-code.ts` and for the same reasons.

**Read-only is a property of the schema, not a check anyone has to remember.**
Ownership is still `User.parentId` alone, and every mutation in `accounts.ts`
already scopes its `where` by it - so there is no query in the app that edits a
child and can be reached through a share. Adding viewers therefore changed none
of them. A permission column consulted by each caller would have been the same
feature with a place to forget, and this is the one part of the app where
forgetting means showing one family another family's child.

**A `ChildShare` row carries no `ownerId`.** Who owns the child is
`User.parentId`, and a copy here would be a second truth to keep in step - the
same objection as `TopicSkill` being a cache rather than a second history. A
revoke scopes itself through the child (`child: { parentId }`), which cannot
drift from ownership because it *is* ownership.

**The link is short-lived and single-use; what it buys is not.** Exactly the
split a child's login code makes: `ShareInvite` lasts `INVITE_TTL_MS` (7 days,
not the code's hour - an adult opens a message after the weekend) and is spent at
acceptance, and the `ChildShare` it leaves stands until the owner revokes it.
Acceptance is one `UPDATE ... RETURNING` on the token *and* a null `acceptedAt`,
like `redeemLoginCode`, so two taps cannot both get in. The token is 32
characters of a 62-character alphabet rather than four of a reduced one, because
nobody reads it aloud - and `crypto.randomInt`, never the seeded `Rng`, for the
reason a login code says.

**Accepting again by the same person is not a failure.** Signing in is the
acceptance - Google's round trip returns to `/share/<token>?go=1` and the page
takes the invite on arrival - so a reload must not read as a dead link while the
grants are sitting there. `acceptShareInvite` returns success for the viewer who
already holds it, which is what makes the auto-accept safe.

**`ShareInvite.childIds` is an array, not a join table**, because it records what
was *offered* rather than what is granted: it is written once and read once, and
every id in it is checked against the issuer's current children at acceptance. A
child removed in between is simply not granted. The page behind the link runs the
same filter, so it cannot promise what the acceptance would then not give.

**A new account arriving through a link never meets the role chooser** - it is a
compare-and-set to `parent` on `role IS NULL`, because following the link already
answered that question. A viewer is an ordinary parent account: they can add
children of their own, and being shared someone else's is a grant beside that,
not a lesser kind of account. A signed-in *child* account is refused at the page
rather than allowed to collect other families' children.

`readViewableChildren` is what every parent screen resolves `?child=` against -
own children first, then shared - so a child that is not in it is not reachable
by typing its id, and there is no second ownership check to drift out of step.
Shared children come back with `access: 'viewer'`, no login code (never
selected, rather than selected and blanked) and the name of the parent who
shared them.

## Parent analytics

`/progress?child=<id>&subject=maths` - a parent picks a child and sees how they
are going. It reads and renders; nothing on it writes. It is also **where a
parent lands**, since `/` redirects them here as soon as they have one child -
see **Accounts** above.

**The child id is never trusted.** `listChildren(parentId)` returns both the
dropdown's options and the set of ids this parent may look at, and the parameter
is resolved against that list. There is no separate ownership check to drift out
of step with the query - the same reason `accounts.ts` puts `parentId` in every
`where`.

**Whose days these are is the child's question, not the parent's.** The server
has no timezone and does not know the browser's, so the offset comes from
`latestOffsetMinutes` - the offset the child last answered at, which every
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

**"Needs a hand" unfolds the questions themselves.** A percentage says a topic
is hard and only the questions say *how* it is going wrong, so each struggling
topic carries a disclosure with its last `EXAMPLE_ANSWERS` (3) answers - the
prompt as the child saw it, the diagram beside it where the question had one,
what they answered, and what it should have been - one row each, elided rather
than wrapped so the column can be read down. The diagram is the **stored** figure
redrawn small (`Diagram` again, at report density), never a fresh draw off
today's template: a jittered figure drawn again is a different picture, and a
parent asking how a question went wrong has to be looking at the one their child
was looking at. Three
is enough to see a pattern and few enough to unfold without a page of history.
It is a plain `<details>`: the rows are rendered with the page and the
disclosure is the whole interaction, so nothing here needs a client component.
Folded rather than shown, because the weekly skim is the common read and this is
what a parent opens when they are about to sit down with the child.

`readAnsweredQuestions` is the read, and it fetches the last three for **every**
topic rather than being told which topics are struggling: which those are is
`topicReports`' answer, over history the read knows nothing about. One query
with a `ROW_NUMBER()` window does the per-topic slicing in the database - the
alternative, taking the last few hundred attempts and hoping, would quietly show
nothing for a topic last got wrong a while ago, which is exactly the topic a
parent came to look at. `null` on failure like its neighbours, and the panel
says it could not fetch them rather than drawing a topic as having no history.

`headline` holds the arithmetic behind the three tiles - a rolling 7 days
against the 7 before, because a Monday-aligned week reads "0 questions" every
Monday morning. It lives in `lib` and is tested, like everything else that
counts, and the `now` it runs on is read once, at the request boundary -
`requestNow()` in `src/app/now.ts` - one of these for the whole app, rather than
a bare `Date.now()` in the component, which `react-hooks/purity` flags as impure.
`strengths` mirrors `problemTopics`, ordered by `correctDays` because that is
the evidence that means something; it excludes `review-due` so no topic appears in two sections at once.

Two framing decisions the copy depends on. The tile says **"time on questions"**,
not "minutes spent": it is summed `timeTakenMs`, already capped per answer, so
it can't be inflated by an iPad left on the sofa - and it undercounts, which the
label has to be honest about. And a line under the tiles explains that **around
three in four right is the system working**; the selector mixes hard topics in
deliberately, and without that line a parent reads 76% as a C.

`recharts` draws the topic bars and is the project's only UI dependency. Height
is questions and the fill is correct answers; the remainder is line grey rather
than `--color-wrong`, because it is "the rest of the questions" and not a column
of failures. **Its labels lie flat where there is room and tilt to
`LABEL_ANGLE` (45 degrees) where there isn't**: a topic name is several words
and a year's worth of topics puts a dozen bars across a panel, so on a phone
flat labels collided however they were wrapped. Flat is the better read where
it fits, so from `md` up they lie down, and what limits them there is the bar's
own width, measured with a `ResizeObserver` rather than declared - a label is
only ever as wide as the band it sits under. When even that leaves nothing
legible (`MIN_CHARS`) they tilt. Anything longer than its budget is elided
either way, and the tooltip still names the topic in full.

**They used to turn fully on their side, and the tilt is the trade that
replaced it.** Vertical labels cannot collide whatever the bar width and need no
width at all, which is exactly why they fit a phone - but reading one means
turning the phone, and a label nobody reads is not doing its job. The geometry
of the tilt is `src/lib/chart/axis-labels.ts`, pure and tested for the reason
`photo/crop.ts` gives: it is geometry, and a phone is both the case that goes
wrong and the hardest thing to keep checking by hand. A label is anchored at its
**end**, under the bar it names, since which bar a name belongs to is the one
thing a tilted axis can get wrong. The tilt then costs two things vertical got
for free, and both are measured rather than hoped for. **Horizontal room**: a
label leans up and to the left, an SVG clips at its own edge, and what runs off
is simply gone - so the chart takes a **gutter** on its left, capped at
`MAX_GUTTER_SHARE` of the width so the bars never become slivers. **What that
gutter is worth is decided by position, not by length**: only the bars near the
left edge can run out of chart, and a long name over the sixth bar has five
bars' width of its own to lean across and wants nothing from the gutter at all.
So each label is asked what *it* needs from where *it* sits and the gutter is
the largest of those answers, which for a typical run of topic names is nothing.
Sizing it off the longest name wherever that name sat spent a quarter of a
phone's panel on room the labels did not want, and read as a hole punched in the
corner of the panel. Eliding follows position for the same reason: a single
budget would have to be the leftmost bar's, and trimming a name that has the
whole plot to lean across, because a different name on the far side is cramped,
is that same mistake pointed the other way. **The angle is set against the
gutter too**, since those also pull opposite ways - a flatter label is the
easier read and reaches further sideways, so it wants more room to lean into.
30 degrees asked for half again what 45 does, and 45 costs about four characters
of the longest topic name.
**Clearance from the label next door**: tilted labels are parallel strips
separated by the band *across* the tilt rather than the bar width, and length
cannot help since two strips are the same distance apart however long they are -
so the type size comes down as far as `MIN_FONT`, which buys back characters as
well as daylight. `CHART_INSETS` is shared with the component rather than
written twice, because two copies of the value axis' width is how a label starts
being clipped by a margin nobody told the geometry about. The practice calendar is hand-rolled SVG and server-rendered - no
library ships one worth the bytes. It draws **four Monday-to-Sunday weeks**
(`calendarWeeks`), not runs of seven ending today: real weeks are what lets it
carry weekday labels, since a column that is Monday one week and Thursday the
next is not a column. The tail of the current week is `future` and gets **no
square at all** - a Friday nobody has reached and a Friday nobody used must not
look the same, and it is why the count reads "of the last 24 days" rather than
28. It is a CSS grid of seven `1fr` columns rather than an SVG, because the two
axes want different things: the width is whatever the column gives it, the
height is a fixed 14px. One viewBox cannot scale to that without stretching the
corner radii with it.

**Each section of the report is a `Well`** - one bordered panel per question a
parent is asking. Run together as bare headings they read as one long page to
parse; boxed, the boundaries are visible in a skim, which is how a weekly read
actually happens. The three headline tiles are already boxed and stay as they
are, with the "three in four" line as their caption. Inside a well, lists are
`divide-y` rows rather than cards - a card in a well reads as double-boxed.

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

- `DATABASE_URL` - Neon Postgres via the Vercel Marketplace
- `AUTH_SECRET` - `npx auth secret`
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` - Google Cloud console, with redirect
  URI `http://localhost:3000/api/auth/callback/google`

Without these the app still runs and plays - auth and recording are skipped
(`isAuthConfigured`, `isDatabaseConfigured`) so the engines and UI stay workable.

Prisma 7: the connection URL lives in `prisma.config.ts`, not the schema, and the
client is generated to `src/generated/prisma` (gitignored) and constructed with the
`@prisma/adapter-pg` driver adapter.

## Working agreements

- TDD, lean tests. Test behaviour through the public function, not internals.
- Work on `master` and push when a piece of work is done. Not a stable release yet.
