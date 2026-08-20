# Notes for a figure-kind author

Everything below was paid for by `bar` (Task 6), which took five fix rounds. You are
expected to get it right in one. Read `src/lib/figures/bar-kind.ts` and
`src/lib/figures/labels.ts` as the worked example — they are the template.

## 1. The registry contract

- Your module lives at `src/lib/figures/<kind>-kind.ts` and is annotated
  **`FigureKindModule<'<kind>'>`** — never the wide `AnyFigureKindModule`. TypeScript
  method parameters are bivariant, so the wide type would let a module be filed under a
  `kind` that disagrees with the spec its `build` reads.
- Four members: `kind`, `fields`, `build`, `issues`.
- **`fields` is a mapped-type record and every parameter must appear in it.** A parameter
  in the `FigureSpec` union but missing from `fields` is a compile error — deliberately,
  because otherwise it would silently never be validated.
- Append one entry to `FIGURE_KINDS` and the union in `types.ts`, and one line to the
  registration list at the bottom of `registry.ts`.
- `build` returns marks in the **maths frame (y up)**. `fit` in `build.ts` flips and
  normalises. Do not flip y yourself.
- **`issues` must never throw.** Generation runs mid-session with a child waiting, so an
  authoring mistake is *reported*. Everything is untrusted: expressions may be absent,
  unevaluable, or the wrong type.

## 2. Where the shared things live

- `FIGURE_PADDING`, `FIGURE_BOX`, `FIGURE_PRECISION`, `MAX_MARKS` — **`types.ts`**, the one
  file that imports nothing.
  **`FIGURE_PADDING` is deliberately not in `build.ts`.** Putting it there closes the cycle
  `build → registry → <kind>-kind → labels → build`, and under Vite that reads `undefined`
  rather than throwing — every derived share becomes `NaN`, `fit` finds no finite bounds,
  and figures come back **empty with nothing thrown**. This was measured, not guessed.
- `REPORT_LABEL_SIZE`, `PLAY_LABEL_SIZE`, `CHAR_RATIO`, `INK_RATIO`, `LINE_CLEARANCE`,
  `DRAWN_SPAN`, `CHAR_SHARE`, `INK_SHARE`, `PITCH_SHARE`, `reportLabelWidth()` — **`labels.ts`**,
  which imports only `./types` so no kind can cycle through it. Read its numbered lessons.

## 2b. The figure must not contradict the answer

Anchoring says vary the picture. The template has *already committed to an answer* before you
draw anything. Where the answer is a property of the picture, those two pull against each other
and you must resolve it deliberately.

`spinner` is the sharp case: "which colour is the arrow most likely to land on?" is answered
`red` only because red's sector is the biggest, so any jitter that reshuffles which sector is
largest makes the template's stated answer **wrong**. A figure that contradicts its own question
is worse than one that anchors — anchoring teaches the wrong thing, contradiction marks a right
answer wrong.

The test to apply: **enumerate every quantity a question of this kind could ask about**, then
prove each is invariant under every jitter you allow. For `spinner` that list was most likely,
least likely, equally likely, the share of the disc in one appearance, and whether two
appearances are equal. What survived was rotation (an isometry, so everything is preserved by
construction) and permuting `(size, appearance)` **pairs moved together** — which preserves the
multiset of sizes *and* the total turn per appearance. Separating the pair would not.

If only one lever survives, say so and prove that lever alone defeats anchoring.

## 2c. There are only two appearances — and `label` is the escape hatch, not a `Mark` change

`Mark`'s `fill` is a **boolean**: `diagram.tsx` renders it as `mark.fill ? 'var(--color-brand-soft)'
: 'none'`. So a figure has exactly two appearances, and any kind wanting to distinguish three
regions by shading alone cannot. `spinner` reports that as an authoring mistake rather than
drawing two groups identically.

**If you need to tell more regions apart, use a `label` mark.** It is already in the vocabulary,
already rendered, and already emitted by `bar` and `pictograph` — a per-region letter
distinguishes arbitrarily many and lets the prompt name them honestly. That is a change to your
kind alone.

**Do not propose turning `Mark.fill` into an enum.** It is a breaking change to the vocabulary,
to the renderer, and to every shipped kind, to buy something `label` already provides. `spinner`'s
author reached for that option without noticing the cheap one; do not inherit the conclusion.

**Consequence for content:** a kind that emits no `label` marks carries **no text at all**, so
`fills: "'red,blue,red'"` are grouping keys that never reach the screen. A prompt may not say
"red" even about a two-appearance figure — it has to say "the shaded part".

## 3. The anchoring rule, and the trap in it

`validateTemplate` draws a figure template 50 times on different seeds, groups the resolved
figures by the answer they accompanied, and **fails any answer that always produced the same
picture**. If every "7" is drawn identically, a child learns the picture rather than the maths
and the analytics call the topic secure.

So a figure **varies by default**: omitting an optional parameter asks for jitter, supplying
one pins it deliberately.

**The trap:** `fit` is uniform and centring, so **a jitter that only changes overall SIZE is
not variation at all** — it normalises away and the anchoring check fails it. Vary
**proportions**. `bar` varies the plot's width share, which survives both a pinned `style`
and a pinned `scale`.

Your test must assert variation directly, **with every pinnable parameter pinned**. A kind
that varies only when nothing is pinned has a latent anchoring failure.

**If your answer fully determines the geometry, vary the presentation instead.** Three
o'clock is three o'clock — the hands are the answer and must not move, so the *face* varies
(numerals or not, tick style, hand length, radius). A cube has eleven nets, so *which net*
varies.

## 4. Labels: two scales, and `fit` bounds by anchor, not ink

The same figure draws large on the play screen and in a **64px thumbnail** in the parent's
report, where a label is **~2.3x wider in user units**. `fit` bounds a drawing by label
**anchor points**, not by ink, and **SVG clips at its own edge** — so a label at the extreme
edge is sliced in every report row, and *no test that does not measure ink will see it*.

Useful normalisation: lay out in a frame of **height exactly 1 and width ≤ 1**. The span is
then 1, the fit scale is `DRAWN_SPAN`, and a report label is a constant `REPORT_LABEL_SIZE /
DRAWN_SPAN` share you can measure against.

### Prefer: pin the frame with marks nothing varies

**This is the better technique and you should reach for it first.** `pictograph` (Task 7) found
it after `bar` spent five rounds on the alternative.

Draw a frame mark — a rule, a baseline, an axis — that reaches **exactly as far as the widest
label's ink**, and make its extent depend only on things that do not jitter. Then the ink edge
and the fitted bound are *the same quantity*, so clipping is impossible **by construction**
rather than by a solved inequality. `CHAR_RATIO` appears on both sides and cancels.

Concretely, in `pictograph`: the gutter is `LABEL_GAP + chars * CHAR_SHARE`, and the ink it has
to contain is `chars * CHAR_SHARE` — the same units. So containment is an identity *plus*
`LABEL_GAP`. `CHAR_RATIO` sits on both sides: move it and both sides move together. `bar`'s
solve is an inequality between two independently derived quantities, so moving a constant flips
it.

Measured, over the accepted sweep: `pictograph`'s worst horizontal ink margin is **exactly
6.00** — the whole of `FIGURE_PADDING` unspent. That margin is **not leftover slack**; it is
`FIGURE_PADDING` never being asked to pay for horizontal ink at all. `bar`'s equivalent runs on
**0.01 units**.

It buys a second thing you need anyway: the frame becomes **deterministic**, identical on every
seed. So `issues` can recompute it with no `Rng` and cannot disagree with `build` — and your
size jitter cannot be normalised away by the centring fit, which is the section 3 trap.

**Two preconditions. Check both before relying on it:**

1. **The pinned side must be the span.** `CHAR_SHARE` assumes the fit scale is exactly
   `DRAWN_SPAN`, which holds only when the frame's larger side is exactly 1. If your kind lets
   height exceed width, the scale shrinks, the fixed-size labels do not, and the identity breaks.
2. **It needs a mark you were going to draw anyway.** `Mark` has no invisible bounding
   primitive, so a kind with no natural frame — a clock face, a net, a polygon — would have to
   add a stray line to buy the guarantee. Do not. For those kinds, `bar`'s ink-budget solve
   below is the right fallback.
3. **A SAMPLED frame mark needs BOTH a fixed sample phase AND a vertex on every extreme of the
   bound.** (Found by `spinner`, whose frame is a circle approximated by points. Both halves
   were measured; neither is theoretical, and satisfying preconditions 1 and 2 does not give you
   this one for free.)

   **(a) Fixed phase.** If the sample phase turns with your jitter, the sampled polygon's
   extremes wobble and the fit scale becomes a function of the jitter — measured at 44.000 →
   44.042 across seven phases, six distinct fits. Sample from a fixed zero, independent of
   whatever rotates inside.

   **(b) A vertex on every extreme.** This half is easy to miss, because at a fixed phase an
   even sample count already gives an exact x-span, so the scale *looks* safe when measured in
   isolation. But the sampled frame's box is then strictly *inside* the true curve's, and any
   other mark that reaches the true curve pushes the bound back out — letting the jitter into
   the fit after all. Measured on a circle: 70, 71 and 74 rim points each give 3 distinct fits
   across 7 rotations; 72 and 76 give exactly 1.

### Fallback: solve the ink budget (`bar`)

Where there is no natural frame, size the drawing so the widest label's ink lands inside the
box, as `bar`'s `plotShape` does. It works, but the guarantee is an inequality with almost no
slack — 0.24 units at best, **0.01** at worst — and any change to `CHAR_RATIO`,
`FIGURE_PADDING` or `FIGURE_PRECISION` flips it, with the sweep as the only alarm.

**A label on your bottom bound leaves 0.24 units either way** (`INK_SHARE`/2 = 5.76 against
`FIGURE_PADDING` = 6). That residual is inherited by every kind and is not solved by frame
pinning.

**Past ~9 characters a report-scale label is wider than the whole box.** The budget is
unsatisfiable, not tight, and no arrangement contains it. Refuse it, and sweep the refused cases
you can still hold so the boundary is written down rather than discovered.

This applies to **every mark with extent, not only text**. `bar`'s one mark that lands exactly
on the fitted bound survives because `FIGURE_PADDING` happens to pay for it, not because the
kind budgeted anything. A heavier mark on your own bound has no such luck.

## 5. A DERIVED label must be asked three questions

This is the most expensive lesson here: three of `bar`'s five fix rounds were **the same bug
at three depths**, and each looked complete until measured. If your kind draws labels it
*computes* — a number line's ticks, a clock's hour marks, a grid's coordinates — ask all three
up front:

1. **Is it the label that gets DRAWN?** Not the input it was derived from. Rounding,
   formatting and unit suffixes all change the character count between the two.
2. **Does ALL of it fit?** Not just the top, or one representative. `bar` folded over the axis
   *top* and missed rungs that printed wider — including via `String` itself, which switches to
   exponential at 1e21, so a top printing `1e+21` in five characters sat above a rung printing
   twenty-one.
3. **Is it still DISTINCT from its neighbour?** Rounding can make two different values print the
   same text. An axis reading `0 | 0.001 | 0.001 | 0.002` fits perfectly and is unreadable.

**Questions 1 and 2 are found by sweeping ink. Question 3 is invisible to any amount of it** —
measured: 63 shapes drew a repeated-label axis while *zero* clipped. It needs its own check.

**A derived NON-text quantity gets the same three questions.** `pictograph`'s icon count is
`ceil(count / key)`, and the row a child reads is the icons, not the number — so with `key: 5`,
counts of 7 and 10 both draw two icons: two different data, one picture. That is question 3 in
another costume, and it is worse than an unreadable axis, because it gives a one-answer question
a picture supporting two. It reports rather than rounds.

**If your kind derives labels, write a sweep test** — vary every dimension across seeds, and
for every shape `issues` ACCEPTS, assert nothing clips and no two labels are identical. Include
awkward values deliberately (an exponential crossover, a fractional pinned step) and comment
them as load-bearing, or a copier will tidy them into round numbers — which is exactly how
`bar`'s first sweep passed while two families clipped.

**Then check what your sweep ACCEPTS, not just that it is green.** `pictograph`'s first sweep
passed while accepting 280 of 5,600 shapes, every one of them single-row — green, and testing
almost nothing. Count the acceptances and print their distribution across each dimension. If a
dimension you commented as load-bearing contributes zero acceptances, it is exercising only the
refusal arm and your comment is false.

**Assert `figureIssues(spec) === []` on every corner before measuring its ink.** The tighter
limit is often not the constant you derived, and a corner that is actually refused proves
nothing about clipping.

**One fault, one message**, even when folding over candidate values — and **key the dedup on a
tag, never on a substring of the prose**. The prose is the half that gets reworded, so a
phrase-matching dedup still compiles, still passes, and silently stops deduping the moment
somebody improves the sentence. `pictograph` shipped exactly that bug and it went unnoticed
because the branch was unreachable; the next kind's may not be.

## 6. Limits: derived constant, or per-figure budget?

- A limit the geometry can honour **by choosing differently** (how many axis rungs to draw) is
  a **derived constant** at *report* scale.
- A limit settled by **the data** (how many categories the template asked for) is a
  **per-figure budget** computed from the layout that figure will actually get, at its
  narrowest, and **reported** with its number.

Do not invent a taste-chosen constant and dress it as derived — that was `bar`'s
`MAX_LABEL_CHARS = 6`, optimistic by ~2x at every count above one, and the one constant in the
file that was wrong.

**Report, never silently clamp.** Silently truncating draws a picture the template never
described. The single exception is a storage cap (`MAX_MARKS`), and only where the slice is
unreachable in practice because a limit `issues` already reports sits far below it — say so at
both halves if you take it.

## 7. The Rng

`generate` threads **one** `Rng` through `tryBind` → `buildFigure` → `buildChoices`. So a
figure that draws a *variable* number of values from it reshuffles the distractors of the very
question it illustrates, and adding a pin to a template would silently change that template's
own choices. Prefer **constant consumption** — the same number of draws whichever path is
taken — and say so where you do it.

## 8. Scope

- **Author no question templates.** Content is Phase 3, by year, in `src/content/maths/`.
- Do not edit existing tests. If you want to, you changed behaviour — report it instead.
- Gates: `npm test`, `npm run typecheck`, `npm run lint`.
