# The NSW syllabus, and the gaps it exposes

LearnR's maths content is written against ACARA v9 and cites the content
description each template practises. NSW schools do not teach ACARA directly -
they teach the *NSW Mathematics K-10 Syllabus (2022)*, mandatory K-2 from 2023
and 3-6 from 2024. This work cross-references the shipped content to that
syllabus, and fills the gaps that doing so makes impossible to ignore.

## Why

Nothing we ship is wrong under NSW. The syllabus is built from the same national
ground. But it carves the subject up differently, and the carve-up is the point:

**Three strands, not six.** Number and algebra · Measurement and space ·
Statistics and probability. ACARA's Number/Algebra, Measurement/Space and
Statistics/Probability are each fused.

**Stages, not years.** Early Stage 1 = K, Stage 1 = Years 1-2, Stage 2 = Years
3-4, Stage 3 = Years 5-6.

**Focus areas carry the outcomes**, coded per stage - `MAE-RWN-01`,
`MA1-CSQ-01`, `MA2-MR-02`, `MA3-RQF-01` - with `MAO-WM-01` (Working
mathematically) attached to every one.

Counted by focus area, NSW splits roughly **40% Number and algebra / 40%
Measurement and space / 20% Statistics and probability**. Early Stage 1 is 3/4/1
focus areas, Stage 1 is 3/4/2, Stages 2 and 3 are 4/4/2 each.

We ship 200 templates split **74.5% / 22% / 3.5%**.

That single comparison is the whole reason for this work. NSW asks for almost
nothing our engine cannot generate. It asks for a different *distribution* of
it, and the distribution we have is the one an app that could only render a
sentence was able to write. Seven templates of Statistics and Probability across
seven years is not a judgement about what matters; it is the shape of the old
constraint, left in the content after the constraint itself was removed by the
question-diagrams work.

## What NSW takes away

One thing, and it is kept deliberately.

**Integers are Stage 4 - Year 7.** NSW places them at `MA4-INT-C-01`; Stage 3
lets a negative *result* from a subtraction and never orders or operates on
them. ACARA puts them at Year 6 (`AC9M6N01`), which is why
`maths.6.integers.temperature`, `.subtract` and `.compare` exist.

They stay, tagged against ACARA and not against NSW, and the curriculum page
renders the disagreement rather than hiding it. A family outside NSW should not
lose content ACARA does place in Year 6, and a NSW family is better served by a
page that says where the two sources part company than by one that quietly
picks a winner. This is also what makes the two-source claim checkable instead
of decorative: if every template cited both codes, the citation would be proving
nothing.

## Copyright: the two sources are not alike

ACARA's material is licensed **CC BY 4.0**. That is why `/curriculum` can quote
a content description verbatim - *"explain and use the properties of odd and
even numbers"* - under the attribution block it already carries.

NESA's is **Crown copyright, with no Creative Commons licence**. NESA grants a
restricted, non-transferable permission to teachers in NSW government and
registered non-government schools and to parents of home-schooled children, for
non-commercial educational use, and explicitly excludes "private/home tutoring
companies, professional learning service providers, publishers, and other
organisations".

**So the NSW half of the page cites and never reproduces.** An outcome code and
a focus area name are references - short identifiers and titles, not the
syllabus. An outcome *statement* is a sentence NESA wrote, and none appears
anywhere in this repo or on the page. The rule is worth writing down because the
failure mode is so easy: the natural way to make the NSW section look like the
ACARA section is to paste an outcome statement beside each code, and that is
exactly the one thing it may not do.

The two attribution blocks therefore differ in kind, and the page says why.

## The model

### NSW codes are a second family in `tags`

```ts
tags: ['AC9M4N02', 'MA2-MR-01']
```

`curriculumCodes` already filters `tags` through a single regex. That regex
becomes a table of syllabus sources, and the function groups by source as well
as by year. Nothing else changes: `QuestionTemplate` keeps its shape, the
`QuestionSpec`/`QuestionTemplate` split is untouched, and a speed run spec
carries no curriculum anything, as before.

A structured `curriculum: { acara: [], nsw: [] }` field was considered and
rejected. It rewrites 200 templates to buy type-safety over a regex a test
already enforces, and it models the integers case worse, not better: "cites one
source and not the other" is natively *a tag that is not there*, and an empty
array in a required field is a thing an author has to remember to write.

Replacing the ACARA codes with NSW ones was rejected outright. It throws away
the CC BY attribution the page carries, and cannot express the integers case at
all.

### Stage is derived, never declared

New in `src/lib/curriculum.ts`, beside `yearLabel` and `compareYearLevels`:

```ts
export const STAGES = ['ES1', 'S1', 'S2', 'S3'] as const;
export type Stage = (typeof STAGES)[number];

stageForLevel('K')        // 'ES1'
stageForLevel('1' | '2')  // 'S1'
stageForLevel('3' | '4')  // 'S2'
stageForLevel('5' | '6')  // 'S3'
stageLabel('ES1')         // 'Early Stage 1'
```

Level to stage is a total function, so a stage is never stored and can never
drift from the level it belongs to - the same reason `topicsForLevel` is derived
from the templates rather than declared beside them.

`catalog.test.ts` then enforces what actually keeps the NSW tags honest: an
`MA2-` code may appear only on a Year 3 or Year 4 template, `MAE-` only on
Kindergarten, and so on. Miscitation is this feature's characteristic bug and it
is invisible by inspection across 329 templates.

### No Part A / Part B

NESA is explicit that "Part A does not equate to Year 3 only" - which part of a
stage a concept is taught in is a teacher's programming decision, not a property
of the content. Tagging it would be the same lie in the type system that the
`QuestionSpec`/`QuestionTemplate` split exists to refuse, in the one place a
citation is supposed to be checkable.

### No topic renames

NSW would fold `money` into additive relations and place value, and `algebra`
into additive and multiplicative relations. Both are naming, not coverage - and
`topic` is **stored**, on `Attempt` and on `TopicSkill`. Renaming a topic orphans
every child's history and breaks `buildProfile`'s obligation to reproduce the
stored row from the attempts. The NSW vocabulary rides in the tag, which is
where a second vocabulary belongs.

## Nine figure kinds

The question-diagrams design deferred exactly this list, and said of it: "Each is
a new figure kind and no engine change, which is the test of whether this design
is right." This work is that test.

Every kind obeys the anchoring rule unchanged - a figure is built from the bound
scope and the injected `Rng`, varies by default, and `validateTemplate` draws it
`FIGURE_DRAWS` times and fails any answer that always produced the same picture.

| kind | pinned by the template | jittered by the builder | fills |
| --- | --- | --- | --- |
| `bar` | the values | category count, scale, order, `style` | Data, every stage |
| `pictograph` | the counts | key value, icon, row layout | Data, S1-S3 |
| `spinner` | the sector split | arrangement, rotation, sector count | Chance, S1-S3 |
| `solid` | which solid | `view`, which net, viewing angle | 3D structure, ES1-S3 |
| `number-line` | the marked value | range, spacing, tick density | place value, fractions, decimals |
| `clock` | the time | numerals on/off, ticks, hand lengths, radius | Non-spatial measure |
| `array` | rows × columns | orientation, dot size, spacing | Multiplicative relations |
| `fraction-shape` | the fraction | shape, partition direction, rotation | Quantity fractions |
| `grid` | the marked point | extent, origin, axis labels | Geometric measure |

Two kinds fight the anchoring rule and are worth stating.

**`clock`.** Three o'clock is three o'clock: the hands *are* the answer and
cannot vary. So the face does - numerals drawn or not, tick style, hand length,
radius. Still unmistakably a clock, and still enough that a child cannot learn
the picture instead of the time. Any kind whose answer fully determines its
geometry has to find its variation somewhere else, and this is the pattern for
doing so.

**`solid`.** A cube has eleven nets. "Which solid does this net fold into?"
answered `cube` must not always show the cross, so the jitter chooses among the
nets. `view` is omitted where an object and a net read the same question and
pinned where the question is about the net itself - the existing rule that
omitting a parameter is what asks for jitter.

`bar` takes an optional `style` of `column`, `dot` or `line`. Omitted it jitters
between `column` and `dot`, which are both categorical and read alike; `line` is
pinned deliberately, for the Stage 3 line graphs, because a line graph is a
continuous reading and not a drawing choice.

### `label` marks go live

`src/components/diagram.tsx` already renders `kind: 'label'`, and carries a note
that nothing emits one yet and that "whoever adds the first label-emitting
figure kind should give `LABEL_SIZE` the same treatment" as the stroke widths -
scale-aware, so a label is the same size on the play screen and in the parent's
report, where the same figure is redrawn much smaller. `bar`, `number-line` and
`grid` all need labels. That note belongs to this work.

## The content

129 new templates, 200 to 329. What each group is for, and which strand it lands
in under NSW's three:

| group | new | strand | years |
| --- | --- | --- | --- |
| Data | 28 | S&P | K-6 |
| Chance | 20 | S&P | 1-6 |
| Solids and nets | 21 | M&S | K-6 |
| Analogue clock | 14 | M&S | K-6 |
| Grids and coordinates | 12 | M&S | 1-6 |
| Mass | 9 | M&S | K-6 |
| Volume and capacity | 8 | M&S | 3-6 |
| Number lines | 7 | N&A | K-6 |
| Fractions of a shape | 6 | N&A | 1-5 |
| Arrays | 4 | N&A | 1-4 |

Which moves the split from **74.5 / 22 / 3.5** to **50 / 33 / 17**, against
NSW's own rough 40 / 40 / 20.

That is a large step and not the whole distance, and the spec says so rather
than rounding it up. Closing the rest means writing Measurement and space and
Statistics and probability at a density we have never written them at - the nine
kinds make it cheap, so it is a second content pass and not a second design.

The 17 Number and algebra additions are not there for coverage; Number is the
one strand we have never been short of. They are there because NSW's number
strand is *visual* - number lines, arrays, area models for fractions - and a
number line question is a different question from the sentence that was the only
way to ask it before. They cost us ratio and earn it back in kind.

Three years gain a topic they did not have: Year 3 and Year 5 gain `shapes`,
which the diagrams design named as the years with no Space content cited at all,
and Year 1 gains `fractions`.

Every new template obeys the existing answer-type rules with no exception. No
word answer below Year 4, so solid names and angle names are `choice` there; no
typed answer the number pad cannot enter.

## The curriculum page

Two sources rather than one.

The header section gains the NSW syllabus beside ACARA, with the stage mapping
spelled out (Early Stage 1 = Kindergarten, and so on) so a NSW parent can place
their child, and a note that stages span two years while LearnR's levels are
single years - which is why a Stage 2 code sits on both Year 3 and Year 4
templates.

The per-year list shows both codes on each template's line. **Where a template
cites one source and not the other, the page says which and why** - the three
integer templates render an ACARA code, an em dash, and a line naming Stage 4 as
where NSW places that content. This is the only part of the page that could not
be derived from the content, so it is derived as far as it can be: the em dash
is the absence of a tag, and only the explanatory sentence is written by hand.

Attribution becomes two blocks that differ in kind, with a sentence saying why:
ACARA's existing CC BY notice, unchanged; and a NESA notice stating Crown
copyright, linking the syllabus, and stating that LearnR cites outcome codes and
writes its own questions, and reproduces no NSW syllabus material.

## Testing

- `stageForLevel` and `stageLabel` get their own tests in
  `src/lib/curriculum.test.ts`, beside `parseYearLevel`'s.
- `catalog.test.ts` gains: every template cites at least one syllabus source; an
  NSW code's stage matches its template's level; and an assertion naming the
  three integer templates **by id** as the deliberate ACARA-only exception, so
  that removing the asterisk later has to be a decision somebody makes rather
  than a test quietly going green.
- Each figure kind gets a test file beside `polygon.test.ts` and `angle.test.ts`,
  testing the geometry it is responsible for and the parameters it jitters.
- Anchoring needs no new test: `validateTemplate` already draws every shipped
  figure template `FIGURE_DRAWS` times and `catalog.test.ts` already runs it over
  everything. A new kind that produces one fixed picture per answer fails on the
  day it ships.
- `curriculumCodes` gains tests for grouping by source and for a template citing
  one source only.

## Deliberately not in this pass

**Working mathematically.** `MAO-WM-01` - communicating, understanding and
fluency, reasoning, problem solving - hangs off every NSW outcome. A generated
single-answer question can evidence *understanding and fluency* and none of the
other three. Nothing in this design changes that, and the page must not imply
otherwise: the claim is that questions are written against the syllabus's focus
areas, not that the app covers the syllabus.

**The remaining distance to 40/40/20**, as above: a second content pass over the
kinds this one builds.

**Timelines**, which Stage 3 Data asks for and which is a tenth figure kind
rather than a use of any of these nine.
