# Writing content against the figure kinds

**Read this before authoring any template that carries a `figure`.** It is what the eleven
kinds turned out to permit, measured rather than assumed, and every limit below was derived
from the report row and paid for by a review round. A template that ignores one of them does
not draw badly — it fails validation, or worse, it validates and teaches the wrong thing.

Its companion is `figure-kind-author-notes.md`, which is for someone *writing a kind*. This
file is for someone *writing questions*.

---

## The one rule behind most of the others

**A figure is built once and drawn at two sizes.** `buildFigure`'s signature carries no scale,
so the same figure serves the play screen and a 64px square in the parent's report at a 1.5px
stroke. The smaller surface governs: a picture legible only on the play screen is illegible in
every report row, and the report is where a parent looks to see the question their child got
wrong. Every density limit below is that rule with the arithmetic done.

**A prompt may only name what the figure actually draws.** `Mark.fill` is a boolean, so a
figure has exactly **two** appearances — one brand tint, or nothing. A kind that emits no
`label` marks carries no text at all. So a spinner question says **"the shaded part"**, never
"the red part"; fill names in a spec are grouping keys that never reach the screen. Where a
question needs three or more distinguishable regions, it needs a kind that emits `label`s.

**The same rule binds the `hint`, and it is easier to break there.** A hint is read aloud when
narration is on, to the child least able to reconcile it with the picture. `bar`'s `style` left
open draws its `dot` form about half the time, so a hint saying "the shortest **column**" names
something that is not on screen in half of all draws. Either pin the style, or word the hint
for whatever the kind may draw — "the shortest one", "read both numbers off the graph".

**And know what `dot` actually draws before you write against it:** it is **one point marker
per category, placed at the value's height** — a dot *chart*, not a stacked frequency dot plot
with one dot per item. Nothing counts the markers, so a question asking a child to count dots
has no picture to count on half its draws. Read `bar-kind.ts` rather than inferring the shape
from the word.

---

## Per-kind limits

### `clock`
- **`minute` must be a multiple of 5.** Sixty minute ticks measure 2.95px pitch in a report
  row against a derived floor of 3.0px, so the face cannot carry them.
- **You cannot ask a child to read the time to the minute** (3:37) from an analogue face.
  O'clock, half past, quarter past and to, and five-minute reading are all fine — that is the
  whole of Early Stage 1 and Stage 1 and most of Stage 2. A to-the-minute question must take
  another form: a digital time as a `choice`, or elapsed-minutes arithmetic.
- The face carries **12, 3, 6 and 9 only**. Twelve numerals are geometrically unsatisfiable at
  this size, not merely tight.
- A time is answered `3:30`, which the number pad cannot type — so **`choice`**, or split into
  a number of minutes.

### `array`
- **At most 7 rows and 7 columns**, at least 2. The higher times tables cannot be drawn as an
  array.
- **Pin `orientation` whenever the answer means "how many rows" or "how many columns."** The
  jitter transposes, which changes that answer — and the anchoring check cannot catch it.
  `answerIssues` catches the common spelling (the answer written as exactly the row or column
  expression) and is a **heuristic**, not a guarantee: an answer reached through an
  intermediate variable, or written `r + 0`, passes unnoticed. The obligation is about what
  the answer *asks*, not how it is spelled.
- A fully pinned array — both dimensions literal, orientation pinned — is refused: it has no
  free proportion left, the same reason a regular polygon may not pin its rotation.

### `number-line`
- **A line carries 3–5 labelled numbers, and how many depends on how wide they are.** `0–10`
  labelled at every integer is not drawable; it renders as 0, 5, 10 with minor ticks between.
  Large numbers cost more room: `from: 800, to: 900, step: 50` is refused — "3 numbers as wide
  as 800 cannot be spread along the line" — while the same range at `step: 100` is clean, and
  so is `0–100` at `step: 50`. As with `bar`, **build the figure and read the issues** rather
  than counting to five.
- **A small tick is worth whatever the coarsest legible division makes it, not what you
  assumed.** The kind filters its candidate divisions for legibility, then for whether the
  arrow lands on one, and takes the **coarsest** that survives. So on a 100-wide line an answer
  at 20 gets ticks worth 20, while an answer at 10 gets ticks worth 10 — the same span, two
  different tick values, decided by the answer. If a prompt or hint says what a small tick is
  worth, pin the span so it is true on every draw.
- **A decimals question must pin `from` and `to`.** Reading a tenth needs a one-unit-wide
  line, and exactly one round one contains any given tenth — so 40 of 90 one-decimal values
  have a single available range and would draw the same picture every time.
- **A K–2 counting question should pin `step` — and `step` cannot be pinned alone.** Left open,
  a whole number in 0–9 is sometimes drawn on a line reading `3 | 3.5 | 4`, which is legitimate
  and wrong for the year. But pinning `step` by itself fails validation, because `issues` asks
  the pinned step about *every* candidate range and reports each one it cannot divide — and the
  candidate list includes one-unit-wide spans a step of 2 can never divide. **Pin `from`, `to`
  and `step` together**; with both ends given there is exactly one candidate range, so the
  conflict disappears.

  **Then vary something yourself, because nothing will make you.** A fully pinned line is *not*
  one picture — `build` jitters tick and arrow lengths continuously on every draw, so it
  produces hundreds of distinct figures and passes the anchoring check without difficulty. A
  child can see that jitter, but it says nothing about the answer: the arrow stands in the same
  place on the same line every time, so the *question* is anchored even though the *figure* is
  not. Move the variation into the content — a different stretch of the line, a different
  starting number — rather than waiting for a validation failure that will never arrive.

### `grid`
- **Grid map ≤ 5×5. Coordinate plane ≤ 4×4. Unlabelled ≤ 18.** Labels bind before lines, and
  the names along the bottom bind before the stacked ones. **Do not plan on a 0–10 axis.**
- **Mark a point with room to spare.** The real rule is "≤5×5, *and* not at the corner". A
  point at the density corner leaves exactly one legible extent, so the figure is identical on
  every seed and the template is refused by the generic anchoring check — whose message says
  "always drew the same picture" and names no field, so the error points nowhere near `at`.
  A map answering cell (5,5) has only the 5×5 grid; a plane at (5,4) only the 5×4.
- **Pin `axisLabels` whenever the answer names a cell or a coordinate.** The jitter swaps
  between numbers and letters, which changes the notation the answer is written in — `B3` on
  one seed, `2,3` on the next. `answerIssues` reports four cases but cannot tell a numbered
  cell reference from a coordinate pair, so it says nothing about a forgotten `onLines`.
- `onLines: 'false'` is the grid map — the point is *in* B3, the Stage 2 reading.
  `onLines: 'true'` is the coordinate plane — the point is *at* (2,3), Stage 3. First quadrant
  only; the pad has no minus key.
- **A multiple-choice grid must pin the extent to a bound variable — not to a literal, and not
  left open.** Left open, the builder chooses the extent and the template cannot write
  distractors against a number it never sees; pinned to a literal, the figure is byte-identical
  on every seed (there is no cell-aspect wobble) and the anchoring check refuses it. Pin it to a
  variable drawn from a **band**, and then: **every square an option can name must exist in the
  smallest member of that band**, or a child rules a distractor out for being off the grid
  without ever looking at the dot.

  The lettered band is **3..5** — every extent from 3×3 to 5×5 draws clean and only a 6 is
  refused. Do not start at 4: holding the marked square inside a 3-wide floor buys nine distinct
  pictures per answer where a 4..5 band buys four, and the cost is a smaller set of reachable
  answers, which is the cheaper thing to give up.

### `fraction-shape`
- **A circle takes up to 39 parts; a strip or rectangle up to 12.**
- **Never simplify.** 2/4 and 1/2 are different questions and draw differently. Four parts
  with two shaded is the whole point of showing it equals a half.
- **`rotation` only turns a circle.** A strip and a rectangle ignore it.
- A fraction answered as a fraction is untypeable on the number pad — **`choice`**.

### `solid`
- **A sphere has no net.** `view: 'net'` on a sphere is an authoring error. If a template
  picks across solids *and* pins `view: 'net'`, leave the sphere out of the list.
- Cuboid nets cover the 1-4-1 family only.
- **The object view and the net view draw prisms of different lengths.** Never ask a child to
  compare a prism's length across the two views.
- Solid names are word answers, so **`choice` below Year 4**.

### `spinner`
- Emits **no** `label` marks, so it carries no text whatsoever. "The shaded part", never a
  colour.

### `bar` / `pictograph`
- Both draw derived labels and both refuse an axis whose rungs read the same. A label that does
  not fit is reported, not truncated.
- **`bar`'s category-name budget depends on the value axis as well as the category count.**
  `categoryBudget` is fed the width of the widest *rung* label, so a graph whose axis reaches
  10 has a two-character rung and gets less room for its names than one that stops at 5:

  | categories | 1-char axis | 2-char axis |
  | --- | --- | --- |
  | 3 | 4 characters | 3 characters |
  | 4 | 3 characters | fewer still |

  "Banana" is refused at three categories; so is "Ball" once the axis reaches 10. Pick short
  nouns — "Cat", "Dog", "Bus", "Red" — or cut a category. Only a graph whose values stay under
  10 gets the roomier column.

  **"The axis" means every axis the kind might choose, not the one you pinned.** The budget is
  fed the widest rung label across *all* candidate scales, and a pinned `scale` the data
  overflows is discarded rather than honoured. So `Car,Bus,Bike` over `1,2,6` is refused —
  "Bike needs 4 characters where 3 categories leave room for 3" — even though every rung of the
  axis you had in mind is one digit: reaching 6 makes the kind fall back to a scale of 5, whose
  axis prints `10`. Over `1,2,5` the same graph is clean, and `2,4,6` is clean too, so it is
  not the size of the maximum on its own.

  The table is therefore an upper bound rather than a promise. **Build the figure and read the
  issues** before settling on a category name, rather than counting characters against it.

- **A `bar` figure needs its maximum constrained above the scale.** An axis of a single step
  is refused ("nothing between the bottom and the top to read a value against"), so three
  values each drawn `1..5` at `scale: '1'` are all 1 about once in 125 draws — and
  `figureIssues` is sampled over 50 seeds, so a template like that **validates by luck rather
  than by construction** and ships. Constrain the maximum (`min: '2'` on one value, or a
  constraint over the three) rather than trusting the sample.

- **A `pictograph`'s row length is capped by its row-label width, not by its key:**

  | label characters | 0 | 1–2 | 3 | 4 | 5–6 | 7 |
  | --- | --- | --- | --- | --- | --- | --- |
  | icons in a row | 6 | 5 | 4 | 3 | 2 | 1 |

  At `key: '1'` that cap **is** the largest count you may graph, so short row labels are what
  buy a longer row. Raising the key buys length too, and **when you may reach for that is a
  curriculum question, not a drawing one.** Both syllabuses introduce many-to-one scales later
  than you might expect — NSW glosses them at Stage 3 — so a graph where one icon stands for
  two is ahead of where either places the convention before Year 3. A Year 2 use is defensible
  when the key is stated in the prompt *and* the point of the question is counting in twos,
  which is core content that year; below that, keep `key: '1'` and let the table bound you.
  **Say so in the prompt whenever one icon stands for more than one thing**, whatever the year.

---

## Answer types, unchanged by any of this

| `answerType` | how it is answered | what it can express |
| --- | --- | --- |
| `number` | number pad, then Check | digits and one decimal point — **no minus key** |
| `text` | on-screen A–Z pad | letters only, no spaces or digits, ≤ 16 chars |
| `boolean` | True / False | one tap |
| `choice` | 2–4 buttons | one tap; anything the others cannot express |

- **`text` is a last resort and never below Year 4.** A word answer makes a child spell before
  they can answer, which tests literacy rather than maths. Shape names, solid names and angle
  names are `choice` in K–3.
- Anything drawn from a small closed set is a `choice` at **any** level.
- A negative answer must be `choice`.
- At most 4 options (`MAX_CHOICES`).

## Multiple choice must not answer itself

Both leaks below are enforced by `validateTemplate`, and both were found in shipped content.

- **Rank leak** — sort the options numerically and the answer lands at the same rank every
  draw, so "never the biggest, never the smallest" beats the question. Usually caused by
  distractors built as scalings of the answer.
- **Option-set leak** — the answer is always drawn from a distinguishable subset, so the
  option set announces it. Worse under narration, which reads word options aloud.

Declare `rankIsTheQuestion: true` or `propertyIsTheQuestion: true` **only** where finding the
extreme, or telling that property apart, genuinely *is* the question. They are separate flags
and each suppresses only its own check.

## A false claim must be a claim the question could truthfully have made

A true/false question that shows a picture and asserts a number — "this shape has 7 flat
faces" — leaks if the **claim** narrows the answer without the picture. Two rules, and the
second is the one that gets missed:

**The false claim must land inside the set of answers the template can actually produce.** Four
solids with 5 or 6 faces, and a claim built as `faces ± 1`, put 4 and 7 on the screen — numbers
that could *only ever* be false. "False for 4 and 7, true for 5 and 6" scored **74%** with the
picture ignored. A two-valued answer set has no room for a plus-or-minus one at all: the false
claim has to be *the other value*.

**And it must be keyed on whatever determines the answer, not on the answer's own value** —
because those values are rarely spread evenly, and a mapping keyed on a lopsided value inherits
the lopsidedness. Eight shapes, four of them quadrilaterals: a claim of 4 stays true more often
than not *whatever* offset produces it, and every mapping keyed on the side **count** leaves
that skew somewhere — the best still scored 56%. Keying on the **shape** sends the four
quadrilaterals to four different false claims in the proportions the shape list itself
produces, and all of 3, 4, 5 and 6 come out exactly half true.

Measure `P(true | claim)` for every value the claim can take. Landing inside the answer set is
necessary; an even split is what tells you it is sufficient.

## A true/false question is not balanced because you asked for balance

**Spelling "right half the time" as a constraint does not give you half.** Rejection sampling
draws the whole scope and throws the binding away when a constraint fails, so a constraint that
is easier to satisfy one way than the other skews what survives. Two Year 1 templates written
that way measured **78/22** and **74/26** before being rewritten. A child who learns that "true"
is the safer guess has learned something, and it is not maths.

Derive the flag instead of constraining it — pick an offset, or a signed amount, and let the
answer fall out of it. The same two templates then measured **51/49**. **Measure the split
rather than assuming it**, exactly as you measure a multiple-choice question's rank spread.

**Reach every rank you can.** The check refuses only a *constant* rank, which is weaker than
"the rank carries no information". Twelve templates reworked earlier land on two of four ranks
and are accepted for a reason that does not apply to new work: **new templates must not
inherit that.** Author option sets where the answer can land anywhere.

## Citations

- Every template cites at least one syllabus code in `tags`; Phase 3 adds an **NSW** code
  beside every existing ACARA one.
- **Stage mapping:** `K` → `MAE-`, `1`/`2` → `MA1-`, `3`/`4` → `MA2-`, `5`/`6` → `MA3-`.
- **Copy no NESA outcome text into this repo.** Outcome codes and focus-area names only —
  NESA material is Crown copyright with no Creative Commons licence. ACARA text stays
  quotable; it is CC BY 4.0.
- If no NSW outcome genuinely covers a template, **leave it ACARA-only and say so in the
  commit message.** A wrong citation is worse than a missing one, because the curriculum page
  presents it as checkable.
- The Year 6 integer templates are the one deliberate exception: they keep `AC9M6N01` and take
  no NSW code, because NSW places integers at Stage 4.

## Mechanics worth not rediscovering

- Ids are `subject.level.topic.variant`, lowercase kebab variant.
- `vars` is ordered; a variable may only reference ones declared before it.
- Every numeric field is an **expression string**, so `max: 'x - 1'` works.
- Constraints are satisfied by rejection sampling — 200 attempts, then a descriptive throw.
- **Run every new template through `validateTemplate` before importing it.**
  `catalog.test.ts` additionally requires at least 20 templates per year, a curriculum content
  description in `tags`, and no typed answer the number pad cannot enter.
- Topics are never renamed: `topic` is stored on `Attempt` and `TopicSkill`, so a rename
  orphans every child's history.
