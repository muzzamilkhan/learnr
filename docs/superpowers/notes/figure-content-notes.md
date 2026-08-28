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

**Keep a figure question's prompt short, and do not spend it offering the options.** `CLAUDE.md`
is explicit that the figure outranks the prompt on the play screen: the figure claims the
vertical room first and the prompt fits into what is left. Offering both options in the prompt
("…the big part or the small part?") suppresses narration's spoken option list — but the
buttons carry those words anyway, and narration reads *them* instead, so the child hears the
same two words either way and the question above the picture is half the length. One Year 3
spinner prompt went **132 characters to 70** on exactly this, losing nothing — both counts
measured, after the first draft of this paragraph carried two eyeballed ones that were each off
by one. Offer options in the prompt when a *sentence* question needs them; on a figure
question, let the buttons do it.

**The same rule binds the `hint`, and it is easier to break there.** A hint is read aloud when
narration is on, to the child least able to reconcile it with the picture. `bar`'s `style` left
open draws its `dot` form about half the time, so a hint saying "the shortest **column**" names
something that is not on screen in half of all draws. Either pin the style, or word the hint
for whatever the kind may draw — "the shortest one", "read both numbers off the graph".

**And know what `dot` actually draws before you write against it:** it is **one point marker
per category, placed at the value's height** — a dot *chart*, not a stacked frequency dot plot
with one dot per item. Nothing counts the markers, so a question asking a child to count dots
has no picture to count on half its draws. Read `bar-kind.ts`'s `styleMarks` — but note the
module's own prose calls this style "a dot plot" in a few places, which is the loose usage this
paragraph exists to disown. **Trust the code over the word, in either file.**

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
- **That refusal is textual, and a constant written through a variable walks straight past
  it.** `{ rows: 'r', columns: 'c', orientation: "'rows'" }` with `r` and `c` declared as
  `expr` constants is the identical anchored picture — one drawing per answer, every draw —
  and it validates completely clean. The kind decides "fixed by the template" with `isClosed`
  on the expression text because it sees one draw at a time and cannot know that `r` bound the
  same number on all fifty of them; there is no cheap fix, which is why this is written down
  rather than caught. Nothing shipped does it. **If a dimension goes through a variable, make
  sure the variable varies — and if it is really a constant, write it in the figure**, where
  the check can read it.

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
  different tick values, decided by the answer.

  **So pinning the span is not enough to make a hint about tick size true, and this bullet
  used to say it was.** The division is chosen from where the *answer* lands, not from the
  span, so a fully pinned `0–1` line still draws halves for an answer of `0.5` and fifths for
  `0.2`, and "each small tick is one tenth" is false on both. What makes it true is
  **constraining the answer's offset as well**: `k ∈ {1, 3, 7, 9}` lands on nothing coarser
  than a tenth, which is why `maths.4.decimals.number-line-tenths` draws `w + k/10` for those
  four `k` only, and `maths.3.counting-numbers.number-line` does the identical thing one place
  to the left. Two pins, not one — and measure it: over all forty reachable answers and sixty
  seeds each, every tick gap on the Year 4 line came out at exactly a tenth of the span, and
  no other value appeared anywhere.
- **A decimals question must pin `from` and `to`.** Reading a tenth needs a one-unit-wide
  line, and exactly one round one contains any given tenth — so 40 of 90 one-decimal values
  have a single available range and would draw the same picture every time.
- **A hundredth needs a pinned tenth-wide window, and with the range left open it is refused.**
  The only values under 1 the builder finds a tick for on its own are the nine tenths and
  `0.25`/`0.75` — measured over all 99 hundredths; everything else comes back "no line the
  builder can draw around 0.35 has a tick under it". What does work is pinning the window:
  `from: 2.3, to: 2.4, step: 0.1` labels only the two ends and draws hundredths as minor ticks.

  **That was refused on 54 of the 100 tenth-wide windows until Year 5's round, and the cause was
  floating point rather than legibility.** `issues` compared `(end - start) / step >= 1` with no
  tolerance, and `0.6 - 0.5` is `0.09999999999999998`, so `0.5–0.6` was reported as "a step of
  0.1 is longer than the line" while `2.3–2.4` was clean — the two separated by nothing but
  where their ends happened to round. `number-line-kind.ts` now compares against
  `1 - LATTICE_TOLERANCE`, the same slack `dividesEvenly` three functions above has always
  given a step, and all 100 windows draw. `number-line-kind.test.ts` sweeps them.

  **Year 6 shipped one, and the two pins hold as written.** `maths.6.measurement.number-line-centimetres`
  reads a hundredth off a pinned tenth-wide metre window and answers in centimetres, with the
  offset held to `k ∈ {1, 3, 7, 9}`. Measured over all 160 reachable answers at forty seeds
  each: every window came out divided into exactly ten, and no other division appeared
  anywhere. The window moving with the content — a different metre and a different tenth every
  draw — is what supplies the variation the pin takes away.

  Two things still hold when you author one. The **division follows the answer**, as the bullet
  above says, so constrain the answer's offset (`k ∈ {1, 3, 7, 9}` hundredths) or the ticks are
  worth a twentieth on some draws and a fiftieth on others. And a pinned window is **one
  picture per answer** apart from the tick and arrow jitter, so the window has to move with the
  content — which is why Year 5 asked for a **percentage off a pinned `0–1` line** instead of
  hundredths: a percentage has to be measured against a whole, and a whole that moved would
  change what the question meant.
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

- **On a coordinate plane the band is `cols 3..5 × rows 3..4`, and the limit is not square.**
  "Coordinate plane ≤ 4×4" above is the safe reading and it understates what draws: measured
  with `onLines: 'true'` and the point anywhere in 1..4, **5×3 and 5×4 are clean while 3×5, 4×5,
  5×5 and 6×3 are refused** — a labelled plane can be wider than it is tall. That is six extents
  rather than four, and a plane needs every one of them, because `axisLabels` cannot jitter here
  at all (a lettered axis has no number to give a coordinate) so **the extent is the only lever
  the kind has left**.

- **Count the extents against the number of answers, because the anchoring check makes fifty
  draws in total and not fifty per answer.** With nine answers and six extents an answer turns
  up five or six times on average — and often two or three, which then have a real chance of
  landing on one extent together. `validateTemplate` reads two identical pictures as an anchored
  figure, correctly: two identical pictures is all the evidence there is. Year 5's first
  coordinate template drew the dot anywhere in a 3×3 and was **refused outright** on the answer
  `(1,3)` — and drawing that same version 3000 times shows every one of its nine answers *does*
  reach all six extents, so nothing was anchored in fact. The seeds simply did not show it.

  Measured refusal rates over 300 distinct template ids, six extents throughout:

  | answers | 4 | 6 | 7 | 9 | 12 |
  | --- | --- | --- | --- | --- | --- |
  | refused | 0/300 | 2/300 | 7/300 | ~30/300 | ~94/300 |

  Read those as a **range rather than as point estimates**: 2 and 7 events out of 300 is
  **0.7% to 2.3%**, and 300 ids buy no more precision than that on an event this rare. So six
  or seven answers costs somewhere in **0.7–2.3%**, nine answers about **one id in ten** — not
  one in six, as an earlier draft of this bullet guessed — and four answers nothing that
  turned up at all. **Size the answer set against those figures, not against caution.**

  And note what the risk actually is: `FIGURE_DRAWS` seeds are keyed off the template's own id,
  so the check is **deterministic per template**. A 0.7–2.3% rate is a 0.7–2.3% chance the
  author has to adjust something once, at authoring time — not a chance a child ever sees a bad
  question. Once it is green it is green for ever. Year 5's `position.coordinates` offers six
  points for that reason; four was thin content bought against a risk that is not borne by
  anyone downstream.

- **`A1` to `C3` sort, and a directional prompt can pin that order.** The bullet above is what
  produces a two-by-two block of options round the marked square — and if the prompt then names
  a direction, "take the later letter when it says right, the larger number when it says up"
  reads the answer straight off the buttons. `maths.4.position.grid-diagonal` shipped exactly
  that and measured **4000 of 4000 correct with the picture ignored**, against a 25% blind
  baseline.

  **Neither enforced check can see it**, and the reason is worth knowing before you rely on a
  green validate: the rank check requires `everyOptionNumeric` and `B3` is a string, while the
  option-set check stands down above `CLOSED_SET_MAX` (8) distinct answers, which the nine
  squares of a 3×3 clear by one.

  The fix is not a third letter or a third number on the buttons — the answer is still the
  extreme on both axes. **Stop the option block being the block the marked square corners.**
  What Year 4 does is fix the four options at the middle four squares (B2, B3, C2, C3) and let
  the *dot* move instead, one step back from the answer, so which of the four is one step away
  is a fact about the picture alone. Measured after: **27.0%**, against a 27.0% null control
  (see below) and a 25% blind baseline.

### `fraction-shape`
- **A circle takes up to 39 parts; a strip or rectangle up to 12.**
- **A rectangle needs a factor pair with both sides at least 2, so a prime denominator can
  never draw as one.** Thirds, fifths and sevenths have no grid — `gridFactorPairs(3)` and
  `gridFactorPairs(5)` are empty — and a pinned `'rectangle'` at a prime is *reported*
  ("3 is prime, or too oblong to lay out as a grid"). Left to jitter it resolves to a circle or
  a strip silently, which is fine to draw and easy to describe wrongly: a comment or prompt
  claiming all three shapes are available at a prime is false. Thirds and fifths are exactly
  what Years 4 to 6 reach for, so this binds more the further up you go.
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
- **The lengths of a solid's edges are deliberately not askable** (`solid-kind.ts:85-88`): an
  oblique projection foreshortens depth by a convention rather than by measurement, so a
  question comparing a solid's depth with its width is reading the convention. **A question
  about square faces is a question about lengths**, so it lives or dies by the one exception
  below.
- **The exception runs one way only: a cuboid is guaranteed not to look like a cube, and
  nothing is guaranteed to look like a square.** `MIN_CUBOID_RATIO` (1.39) holds a cuboid's
  three edges visibly unequal, and a cube's are always equal — measured over 300 draws, a
  cube's front face has a side ratio of 1.00 every time and a cuboid's squarest face 1.39–3.33,
  median 1.97. So "does this have a square face?" over **cube and cuboid** is sound, and
  `maths.5.shapes.square-face` is exactly that pair.

  It is sound over **no other solid**. A square pyramid's base really is a square, so the
  answer says true — and the base draws as a parallelogram whose sides measure **1.82–3.23
  apart, median 2.29**, which is *less* square-looking than the cuboid's rectangles. A hint
  saying "a rectangle is only a square when all four sides are the same length" then instructs
  precisely the reading that marks the pyramid wrong. That template shipped with the pyramid in
  its pick and had to have it taken out. **Any solid whose square face is not the face you look
  straight at is the same trap — and so is any face whose proportion the kind does not
  guarantee.** A triangular prism was dropped from that same pick for a weaker reason — keeping
  the answer at 50/50 — and turns out to have been exposed too, on both views. Its net's length
  is `PRISM_LENGTH` (`solid-kind.ts:437`), a real measurement laid flat on the page ranging over
  **0.8–1.9 with no `MIN_CUBOID_RATIO`-style floor under it**, so a rectangular face may draw
  square; and on the object view the length is `depthOf`, the oblique convention the first
  bullet says is not a measurement at all. **`MIN_CUBOID_RATIO` is the only guarantee of this
  kind in the file** — `PYRAMID_HEIGHT`, `PRISM_APEX`, `PRISM_LENGTH`, `CYLINDER_HEIGHT`,
  `CONE_HEIGHT` and `RIM_SQUASH` are plain jitter ranges. Read the kind for a guarantee before
  asking a question that turns on a proportion, and expect not to find one.
- The guarantee is about the drawing, not about the *net*: Years 3 and 4 both left the cuboid
  out of their net questions on the grounds that telling a cuboid's net from a cube's in a
  parent's report row is a question about proportion rather than about shape, and Year 5 did not
  overturn that.
- **Counting off the object is harder than counting off the net**, which is a real difficulty
  step rather than a restatement: a net lays every face out flat, while an object hides three
  edges and one corner behind it and draws them dashed. Year 4 counts a net's edges and
  corners; Year 5 counts the same two off the object.
- **A question about what kind of thing the solid is escapes the length trap entirely**, which
  is the room Year 6 found in it: whether a solid is a prism, and what shape a slice parallel
  to its ends comes out, are both answered off the faces rather than off any proportion. The
  cuboid may go back into a net question asked that way — Years 3 and 4 kept it out because
  telling a cuboid's net from a cube's is a question about proportion, and here both answer the
  same. Leave the **cylinder** out of a prism question in either direction: it has two matching
  ends and a curved side, so it is an argument about whether a prism must be a polyhedron
  rather than a question about the drawing.
- Solid names are word answers, so **`choice` below Year 4**.

### `spinner`
- Emits **no** `label` marks, so it carries no text whatsoever. "The shaded part", never a
  colour.
- **Putting every sector in one fill group is a usable move, not a degenerate one.** The whole
  disc comes out shaded and the radial lines between the sectors are still drawn, so the parts
  are still there to be seen — which is what a question about the *sizes* of the parts wants,
  since the shading then carries no information at all on any draw.
  `maths.5.chance.spinner-equally-likely` does this: it draws *n* sectors either all equal or
  with one worth double, so the sector **count** is the same whatever the answer and only the
  sizes help. Measured 50.9/49.1 true-false over 4000 draws, one distinct prompt.

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

  **The table is pessimistic at four categories, and the number in the refusal message is not
  the budget a shorter name would have been judged against.** `categoryBudget` is fed the
  widest *category* label as well as the widest rung, because a wider name narrows the plot it
  is then measured inside — so a label over budget shrinks the budget it failed. Measured:
  `Mon,Tue,Wed,Thu` over values reaching 50 at `scale: '10'` — four categories against a
  two-character axis — draws **clean**, where the table above reads as fewer than three
  characters; the same four names lengthened to `Mona,Tues,Weds,Thur` are refused with "4
  categories leave room for 2". Read that 2 as what a four-character name earns, not as the
  budget. Three-character names at four categories are fine at a ten-scale axis.

- **An axis carries at most `MAX_STEPS` (5) labelled rungs**, and a pinned `scale` that needs
  more is refused outright: `60,20,70,40` at `scale: '10'` reports "10 leaves 7 steps on the
  axis, more than the 5 whose labels stay clear of one another". So a ten-scale graph tops out
  at 50, which is what bounds the *values* rather than the names. It is the ceiling to the
  floor the bullet below describes, and both bind at once.

  **"The axis" means every axis the kind might choose, not the one you pinned.** The budget is
  fed the widest rung label across *all* candidate scales, and a pinned `scale` the data
  overflows is discarded rather than honoured. So `Car,Bus,Bike` over `1,2,6` is refused —
  "Bike needs 4 characters where 3 categories leave room for 3" — even though every rung of the
  axis you had in mind is one digit: reaching 6 makes the kind fall back to a scale of 5, whose
  axis prints `10`. Over `1,2,5` the same graph is clean, and `2,4,6` is clean too, so it is
  not the size of the maximum on its own.

  The table is therefore an upper bound rather than a promise. **Build the figure and read the
  issues** before settling on a category name, rather than counting characters against it.

- **`bar`'s third style is `line`, and nothing used it before Year 5.** It joins the readings
  up instead of drawing a column or a dot, which is the display a change-over-time question
  wants (`AC9M5ST02`, `MA3-DATA-02`). Four three-character day names over values that are
  multiples of ten at `scale: '10'` draw clean; the same four names at `scale: '1'` over values
  reaching 9 are refused, for the axis-rung reason above. Pin `style` whenever the hint says
  "the line" — left open the kind draws a column or a dot instead, exactly as for `dot`.

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

  **`halves` buys half an icon, and only at an even key.** With it a row may end on a half, so
  a key of 10 can say 25 as two icons and a half — which is what makes a many-to-one scale
  usable rather than a scale that can only graph its own multiples. What the kind still refuses
  is a count the key cannot say *even in halves*: at `key: '5'` a count of 12 is reported ("it
  is drawn as 2.5 icons, a picture reading 12.5"). So the counts must be multiples of half the
  key — and at an odd key, or at `key: '5'`, the only integer multiples of 2.5 are the multiples
  of 5, so halves buy nothing there at all. `maths.5.data.picture-key-halves` uses `key: '10'`
  with counts drawn as a number of half-icons.

  At `key: '1'` that cap **is** the largest count you may graph, so short row labels are what
  buy a longer row. Raising the key buys length too, and **when you may reach for that is a
  curriculum question, not a drawing one.** Both syllabuses introduce many-to-one scales later
  than you might expect — NSW places them at Stage 3 — so a graph where one icon stands for
  two is ahead of where either places the convention before Year 3. A Year 2 use is defensible
  when the key is stated in the prompt *and* the point of the question is counting in twos,
  which is core content that year; below that, keep `key: '1'` and let the table bound you.
  **Say so in the prompt whenever one icon stands for more than one thing**, whatever the year.

  **Year 3 keeps `key: '1'`, and the reasoning generalises upward.** A many-to-one graph at
  Stage 2 would need an `MA2-DATA-*` citation for a convention NSW places a stage above it, and
  the curriculum page presents citations as checkable. So **a many-to-one graph below Stage 3
  is ACARA-only, or it is `key: '1'`** — unless you can make the specific argument Year 2 made,
  which is the only shipped exception: `maths.2.data.picture-key-two` carries `key: '2'` beside
  an `MA1-DATA-02` citation, on the grounds that counting in twos is core Stage 1 content *and*
  the key is stated in the prompt. That is a carve-out earned by an argument, not a general
  licence, and Year 3 declined to take it. **Do not add a third case without making the
  equivalent argument out loud**; a Year 4 template that already carries a many-to-one key and
  no such argument belongs in the ACARA-only case.

  **At Stage 3 the argument stops being needed.** A Year 5 or Year 6 picture graph whose key
  says ten carries `MA3-DATA-01` like any other citation — Year 5's two picture graphs do, and
  Year 6's total question does. Everything else about a key still holds: the prompt says what one
  picture stands for, because the graph's own key draws an icon and a number and cannot say two
  *what*.

### `timeline`
- **Two or three events on a line of four-digit years, and that is the whole budget.** Four
  events need three-digit years, five need one-digit ones, and six never draw at all. The
  limit is the **letters**, not the ticks: two of them need about three ticks' worth of line
  to stand apart at report scale, where two ticks need one. Measured across every combination
  of count, spacing and division — `4-digit 4 events: NONE`, at every spacing tried.
- **The line runs 3 to 10 divisions, and no further.** Below three there is nothing between
  the ends to count; past ten a report row cannot tell the ticks apart, so a century at a
  division of five is refused where the same century at twenty is clean. The number is the
  same at every division, because what is being divided is the *line*, not the years.
- **Two events must sit at least two divisions apart**, which is the same limit read the other
  way. On a pinned line with them one division in from each end, the intervals that draw are
  3 to 10; hold them two divisions apart and it is 3 to 7.
- **The division is chosen from the gaps between the events, so equally spaced events can
  refuse a line their neighbours accept.** The builder only offers divisions that put a tick
  under every event, which means divisors of the gaps. Three events **25 apart** is refused —
  a division of 25 puts them one apart and a division of 5 needs twelve divisions — while the
  same three events 10, 20 or 50 apart all draw. If a timeline is refused and the years look
  reasonable, this is nearly always why: **give the gaps a coarser common divisor.**
- **An event's label is at most three characters, and it is a key rather than a name.** A word
  beside a dot collides with its neighbour and pushes the rule's own bound, so `figure.labels`
  reports anything longer and the prompt refers to the letters: "how many years between A and
  B?". Omit `labels` and the events are lettered A, B, C **in the order the template gave
  them**, which is the order to write the years in when the question is "which came first?" —
  a template that lists them in date order has answered that question in its own alphabet.
- **Pin `from`, `to` and `step` together, or leave all three open.** Open, the builder picks
  the stretch and the division and a different pair on every seed, which is the anchoring
  answer. Pinned, the drawing still varies — the tick lengths and the letter gap jitter, and
  50 seeds gave 50 distinct figures either way — but the *question* is anchored, exactly as a
  fully pinned `number-line` is. **Move the variation into the content**: a different century
  every draw is what the two shipped templates do.
- **A pinned end may sit on an event, and should not.** The builder always overshoots by at
  least one division so an end label is never under a dot; pinning `from` to the first event's
  own year gives that up and hands the child the answer to "what year was A?" in the axis.

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

All three leaks below are enforced by `validateTemplate`, and all three were found in shipped
content.

- **Rank leak** — sort the options numerically and the answer lands at the same rank every
  draw, so "never the biggest, never the smallest" beats the question. Usually caused by
  distractors built as scalings of the answer.
- **Option-set leak** — the answer is always drawn from a distinguishable subset, so the
  option set announces it. Worse under narration, which reads word options aloud.
- **Prediction leak** — every distinct option set always came with the same answer, so
  knowing the four buttons is knowing which one is right. The general case the other two are
  special cases of, and the one that reaches *word* options, where the rank check cannot go.
  It speaks only where the sets repeat (`OPTION_SET_REPEATS`): a template whose options move
  nearly every draw shows one answer per set for want of ever seeing a set twice, which is
  not a leak. Usually caused by distractors stepped a fixed distance from the answer around a
  closed list — so vary *which* value is left out, not just which are shown.

  **Read that bound the other way round, because it is where the next leak will be.** A
  template that predicts its answer *perfectly* and has many option sets passes this check
  cleanly — the guard cannot tell it from the honest case, and by design does not try.
  `maths.4.decimals.hundredths` was exactly that: distractors `n / 10`, `n` and `(n + k) / 100`
  put `n / 100`, `n / 10` and `n` on screen together, a run of three each ten times the last
  centred on the answer, invertible by one prompt-free sentence — *pick the hundredth that is a
  tenth of another option* — and it measured **100.0% against a 25.0% baseline over 162 distinct
  option sets**. Nothing in the suite said a word. **Distractors that are all functions of the
  answer leak whether or not the sets repeat**; the check catches the small-set half of that
  family, and measurement is the only thing that catches the rest.

Declare `rankIsTheQuestion: true` or `propertyIsTheQuestion: true` **only** where finding the
extreme, or telling that property apart, genuinely *is* the question. They are separate flags,
each suppresses its own check, and either suppresses the prediction check as well — both of
them say the option set is what the question is about.

**There is a fourth leak and nothing fully enforces it: an ordered option label that is not a
number.** `B3`, `4:05`, "unlikely / even chance / likely / certain" all sort, and a prompt that
names a direction, a quantity or a place along that order picks the answer out of the buttons
with the picture unread. The rank check cannot help — it requires `everyOptionNumeric` — and
the option-set check stands down above eight distinct answers, so a question with nine falls
between the two. `maths.4.position.grid-diagonal` shipped that way and measured 100%; see the
`grid` bullet above for the shape of it and for the fix. The prediction check now covers the
half of this where the option set repeats often enough to be judged — but a leak that varies
its buttons freely, or that narrows four to two rather than to one, still passes everything.

**And the ordering the prompt names need not be the option labels' own.** Year 6's clock
questions give a duration in the prompt and offer four times — two hours crossed with two
minute readings, the arrangement Years 3 and 5 both use because one hand read alone narrows
four to two and never to one. That was still a leak, because the *wrong hour was the rollover
mistake*: offering `h` and `h + 1` and letting the roll decide which is right makes the answer
the later hour exactly when the minutes went past the twelve — and the answer's own minute
says when that was, since `(mi + g) mod 12` falls below `g` if and only if it rolled. Two of
the four options are therefore inconsistent with any minute on the buttons, and the question
is a coin toss with the clock unread. Measured **34.1% held-out against a 25% blind baseline**
over 10,000 draws a half. The fix is one line: draw the other hour **either side at random**
rather than deriving it from the roll, which leaves it an hour out — the rollover mistake half
the time — and stops it saying which way. Measured after: **17.2%**.

The general shape is worth naming, because it is the third leak wearing a fourth disguise:
**a distractor derived from the very quantity the prompt states is a distractor the prompt can
identify.** Ask what a solver could rule out knowing only the prompt's numbers and the option
labels, and check that the answer is not what survives.

**So measure with the option labels in the key, not the prompt alone.** The measure is
**(prompt × sorted option set) → that key's commonest answer, over at least 4000 draws**. A
prompt-only version cannot see this class of leak at all, and it degenerates on a template
with one constant prompt, where it reduces to the modal-answer rate and is guaranteed to look
clean.

Two numbers make the result readable, and without them a good template and a bad one look
alike:

- **A null control.** Taking a max over buckets is biased upward, badly so when the buckets are
  small. Re-run the same key structure with the answer drawn from the template's own answer
  distribution *independently of the key*; that is what "no leak" reads for this shape. Year 4's
  sixteen figure templates all land within 0.5 points of their own null.
- **Distinct answers per key.** As it approaches 1 the key is an answer sheet and the statistic
  means nothing: `maths.4.time.after-minutes` scores 96.3% keyed with 3805 keys over 4000
  draws, and its null control scores 95.2% — an artefact of one draw per key, not a finding.

### Use a held-out split, and the nulls stop being load-bearing

The statistic above is **in-sample**: the modal answer is read off the same draws it is scored
on, so it is biased upward by exactly the amount the buckets are small, and on a template with
thousands of keys it is unreadable. `maths.5.time.clock-24-hour` scores **69.0%** in-sample
against a 25% blind baseline and looks like the worst leak on the branch. It has no leak at
all — and the plainest evidence of that is that **the same in-sample statistic on the same
template falls to 54.4% simply by drawing 10,000 times instead of 4,000**. A number that moves
with the sample size is measuring the sample, not the question.

**So split the draws.** Learn each key's modal answer on one half — 10,000 draws — and score on
a second, independently seeded 10,000. A key the held-out half has never seen scores nothing,
which is the honest outcome for a strategy that has no answer for it. The bias goes, and the
number is directly comparable with the **blind baseline** with no null control in between.

Both columns below are **one run of one template at 10,000 draws a half**, which is worth
insisting on: pairing an in-sample number from before a fix with a held-out one from after it
is two statistics wearing one row.

| template | in-sample | held-out | blind | keys | answers per key | reading |
| --- | --- | --- | --- | --- | --- | --- |
| `maths.5.time.clock-24-hour` | 54.4% | **23.4%** | 25.0% | 2922 | 2.31 | below a guess; the gap was all bias |
| `maths.5.position.coordinates` | 26.2% | **25.0%** | 25.0% | 3 | 4.00 | at the floor |
| `maths.5.shapes.square-face` | 50.3% | **50.1%** | 50.1% | 1 | 2.00 | at the floor |
| `maths.5.data.picture-key-difference` | 35.5% | **33.1%** | 21.6% | 18 | 3.00 | above the floor, and see below |

**Two of the five leaks found on this branch lived in populations where the in-sample number
was unreadable**, so this is not a refinement — it is the measure. Keep reporting **answers per
key** beside it, because it says whether a key is an answer sheet, and keep the blind baseline,
because that is what the number is read against.

**The blind baseline is `1/options` for a tapped question and the *modal answer rate* for a
typed one** — always give the commonest answer, key unread. It is **not** `1/distinct answers`:
answers are rarely uniform, so that understates the floor and makes a clean template look like
a leak. `picture-key-difference` reads 12.5% by the wrong rule and 21.6% by the right one.

### The held-out number is deflated by key sparsity, and is not a safety margin

Scoring an unseen key as nothing is what removes the bias, and it has a price: **on a template
whose key count approaches the draw count, most scored draws land on a key the learn half never
saw, and every one of those scores zero however leaky the question is.** So a held-out figure
*below* the blind baseline is the ordinary reading for such a template and says nothing about
safety — reading the gap as a margin is reading the collision rate.

Year 6's `maths.6.time.clock-arrival` is the sharpest case on the branch. It has **5,931 keys
over 10,000 draws**, so only **68.0%** of scored draws have a key the learn half saw. Both
columns from one run of 10,000 draws a half:

| version | held-out | seen-key coverage | seen-keys-only | blind |
| --- | --- | --- | --- | --- |
| the wrong hour derived from the rollover | 34.1% | 67.7% | **50.4%** | 25.0% |
| the wrong hour drawn either side | 17.2% | 68.0% | **25.3%** | 25.0% |

The 17.2% is `0.680 × 25.3`, which is what a **leak-free** template with that sparsity must
read; it is not 8 points of headroom. And the 34.1% is `0.677 × 50.4` — the seen-keys-only
column is the one that says outright that the rollover rule was keeping the answer half the
time, which is the ceiling that rule gives. The statistic had lost a third of its power, and
the deflation was hiding the size of a real leak rather than inventing one.

So on any template with more than a few hundred keys, **report the seen-key coverage or the
seen-keys-only figure beside the held-out one**, and read the comparison against the blind
baseline off the seen-keys column. This is the same effect the `clock-24-hour` row above
records as "the gap was all bias" (23.4% against 25.0%) — that row is a leak-free template
being deflated in exactly this way, and naming the mechanism is what makes the two rows
readable as the same thing.

A **null control** is still worth running where the split is not available or where you want a
second opinion, and there are two of them. The **global** null draws the answer from the
template's whole answer distribution independently of the key, which is what the bullet above
describes; the **within-key** null draws it uniformly from that draw's own **options**. Use the
within-key one on a tapped question, where the global one assumes answers the key never offered
and reads clean templates as leaks. Do **not** build a within-key null out of "the answers
actually seen at that key": on a key with one or two draws that pool *is* the observed answer,
so the null converges on the statistic it is meant to check, and that is precisely the
population it was reached for.

### One floor that is real, structural, and the price of a correct prompt

`maths.5.data.picture-key-difference` scores **33.1% held-out against a 21.6% blind baseline**,
and it is not a leak to fix. A many-to-one picture graph's prompt **must** say what one picture
stands for — the graph's key draws an icon and a number and cannot say two *what* — so a child
who reads the prompt knows the answer is a multiple of *k*, which narrows eight answers to
three. **1/3 is the true floor**, the measured 33.1% sits on it, and 3.00 answers per key
confirms nothing beyond that narrowing leaks. Report it as a price rather than hunting it: the
alternative is a prompt that does not say what the picture means.

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

**And a graph's readings are not independent of the gaps between them.** Year 5's rule — draw
the difference first and build the two rows from it, or the small gaps come up far the
commonest — has a second form that only shows up when the *answer is a position*. Year 6 asks
which of three segments of a line graph rises the most. With the four readings drawn
independently the three answers came out **31.4 / 36.6 / 32.0** over 10,000 draws: a big
middle step needs a low second day and a high third, and both of those hold the steps either
side of it down, so the middle segment wins more often than the two on the ends.

Drawing the three **steps** instead makes them interchangeable, and a constraint symmetric in
them prefers no position. **What usually breaks that is the range**, and it is worth knowing
why: a walk that runs off the top of a five-rung axis is thrown away, and which walks run off
depends on the order the steps come in, so the rejection puts the skew straight back. Year 6's
answer is to hold the steps to `-1..2`, where every triple the constraints accept makes a walk
four rungs tall or less — enumerated over all 64 triples, not sampled — so no triple is ever
rejected for its order, and the line is then slid up by an offset drawn from whatever room is
left. Measured after: **33.5 / 33.8 / 32.7**.

**Reach every rank you can.** The check refuses only a *constant* rank, which is weaker than
"the rank carries no information". Twelve templates reworked earlier land on two of four ranks
and are accepted for a reason that does not apply to new work: **new templates must not
inherit that.** Author option sets where the answer can land anywhere.

## When a year may restate its neighbour's question

`CLAUDE.md` says a topic recurs across years **harder each time**. Usually that settles it. But
the two syllabuses do not step in the same place, so a year sometimes has to ask a question its
neighbour already asked — Year 2's grid reference cites ACARA alone because NSW files grid maps
a stage later, and Year 3 is where both agree.

That is a real reason and it is allowed. Two conditions:

- **The citation must be what makes it a different question.** If the only change is the year
  number in the id, the restatement is not earning its place.
- **Say so in the file, at the copy.** Name the template being restated and why the year needs
  its own. An undeclared duplicate reads as an oversight to the next person, and the kind's own
  limits are often what forced it — `grid` caps at 5×5, so there is very nearly one
  grid-reference question it permits at all.

Prefer a genuinely harder sibling beside the restatement, so the year is more than a repeat.

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
- **Both exception lists are now closed from both ends in `catalog.test.ts`**, and the
  ACARA-only one is the newer half. There are **ten** templates carrying no NSW citation, each
  named with the decision that put it there: Year 1's repeating pattern (NSW names repeating
  patterns at Early Stage 1 and no Stage 1 focus area covers them), Year 2's two grid
  references (NSW files grid maps at Stage 2, which is Years 3 and 4), Year 4's two many-to-one
  graphs, Year 5's two rotational-symmetry questions, and Year 6's three integer questions.
  **Leaving a new template ACARA-only is now a test failure**, not a quiet omission — so it has
  to be argued into that list rather than fall into it.

## Mechanics worth not rediscovering

- Ids are `subject.level.topic.variant`, lowercase kebab variant.
- `vars` is ordered; a variable may only reference ones declared before it.
- Every numeric field is an **expression string**, so `max: 'x - 1'` works.
- Constraints are satisfied by rejection sampling — 200 attempts, then a descriptive throw.
- **Every variable is bound before any constraint is checked**, so an `int` whose `min` can
  exceed its `max` on a binding the constraints would have thrown away still **throws**
  ("Variable off has an empty range [0, -1]") rather than being resampled. Clamp the bound —
  `max(0, ...)` — and say in a comment why the clamp can never bind on a surviving draw.
- **Run every new template through `validateTemplate` before importing it.**
  `catalog.test.ts` additionally requires at least 20 templates per year, a curriculum content
  description in `tags`, and no typed answer the number pad cannot enter.
- Topics are never renamed: `topic` is stored on `Attempt` and `TopicSkill`, so a rename
  orphans every child's history.
