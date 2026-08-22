# Question diagrams

A question the child has to *look* at. "What shape is this?" is not a sentence
with a hole in it - the picture is the question, and the prompt is its caption.

## Why

Counting ACARA v9 content descriptions actually cited in `src/content/maths.ts`,
Number, Algebra and Measurement are close to complete. The Space strand ships
**one** description in each of K, 1, 2, 4 and 6, and **none at all in Year 3 or
Year 5**; Statistics ships four in total across seven years; Probability two.

That is not a coincidence about which topics got written. It is the same gap
this feature is about: Space and Statistics are the strands where the question
is a picture, and an app that can only render a sentence cannot ask them.

## The anchoring rule

The requirement that shapes the whole design: **no single diagram may become the
anchor for an answer.** If every obtuse angle is drawn the same way, a child
learns to recognise that picture, not to recognise an obtuse angle - and the app
would be teaching the wrong thing while its analytics called the topic secure.

So a figure is never an asset chosen by the answer. It is generated, from the
same bound scope and the same injected `Rng` the question already uses, and it
**varies by default**: the template pins the property the question is about and
says nothing about rotation, size or proportion, which the builder jitters
itself. An author who wants an upright figure writes `rotation: '0'` on purpose.

Pinning is the exception because forgetting is the failure mode, and it is
available only where something else still varies: a regular polygon has no free
proportion, so pinning its rotation makes one fixed picture and the anchoring
check below rejects it. That is the check working rather than a limitation to
route around - a regular hexagon drawn the same way every time is an anchor for
"hexagon", however deliberately it was pinned.

And because
forgetting is invisible - an anchored figure looks perfectly correct - the rule
is enforced rather than intended: `validateTemplate` draws a figure template
`FIGURE_DRAWS` times on different seeds, groups the resolved figures by the
answer they accompanied, and fails any answer that always produced the same
picture. `catalog.test.ts` runs it over everything shipped.

## Where the pieces live

`src/lib/figures/` is pure, like the rest of `lib`: geometry judged by tests
rather than by eye, for the reason `photo/crop.ts` and `chart/axis-labels.ts`
are already there.

- `types.ts` - `FigureSpec` (authored) and `Figure` (resolved)
- `build.ts` - `buildFigure(spec, scope, rng)` and `figureIssues(spec, scope)`
- `polygon.ts`, `angle.ts` - the two kinds and their jitter

`src/components/diagram.tsx` is a dumb renderer: marks to SVG, no geometry, no
decisions, scaling to whatever box it is given - which is what lets the play
screen and the parent's report share it.

## The authored spec

`figure` is optional on **`QuestionSpec`**, beside `choices` - a property of the
question, not of a template placed in a course. A speed run inherits the
capability and never uses it, exactly as it inherits `hint`.

```ts
type FigureSpec =
  | { kind: 'polygon'; shape: Expr; rotation?: Expr; mirror?: Expr; rightAngles?: Expr }
  | { kind: 'angle';   degrees: Expr; rotation?: Expr; armLength?: Expr; arc?: Expr }
```

Every parameter is an expression over the bound scope, as `min`/`max` already
are. Omitting an optional parameter is what asks for jitter; supplying one pins
it.

`shape` evaluates to a name from a closed vocabulary: `equilateral`,
`isosceles`, `scalene`, `right-triangle`, `square`, `rectangle`, `rhombus`,
`parallelogram`, `trapezium`, `kite`, `pentagon`, `hexagon`, `heptagon`,
`octagon`. A count of sides is not enough to author with: it cannot tell a
rhombus from a kite, and a randomly wobbled quadrilateral has no lines of
symmetry, so the true/false symmetry question would have no true case.

`mirror` evaluates to a **boolean**: whether the dashed line drawn across the
shape should be a genuine axis of symmetry. Which true axis, or which plausible
wrong line, is the builder's to vary - the same division of labour as
everywhere else here. The template's own variable is what the answer reads.

## Building

`buildFigure` returns a **resolved figure**: a serialisable drawing in a 0-100
box, made of four primitives - `path` (points, closed, filled, dashed), `arc`,
`dot`, `label`. A right-angle tick is a three-point open `path`; a mirror line
is a dashed one. Coordinates are rounded at build time, which keeps the stored
JSON small and makes two figures comparable as strings - which is what the
anchoring check needs.

**The builder never throws; it clamps.** Generation runs mid-session with a
child waiting, so an unknown shape name or a 400-degree angle degrades to
something drawable, exactly as `MAX_CHOICES` clamps rather than rejects.
Reporting it is `figureIssues`' job, called only by validation.

## Narration

> **Superseded in part by
> `docs/superpowers/specs/2026-08-22-question-viewport-design.md`.** The figure
> is tappable now - it opens full-screen with the prompt along the top - so the
> last sentence of this section no longer holds. Everything else here does.

A figure question reads its prompt aloud and stops. The picture is the part you
look at, and it cannot be described without giving the answer away - "a shape
with three sides" *is* the answer. A pre-literate child can still answer, since
seeing a triangle needs no reading, and the figure is not tappable: tapping the
question still repeats the words.

## Recording

`Attempt` gains `figure Json?`, written beside `prompt` by the same server
action, so the parent's "Needs a hand" rows can redraw what the child saw. It
stores the **resolved** figure rather than the template's parameters, for the
reason `prompt` is stored as text rather than re-rendered: a template edited
next month must not change what a parent is shown about last week.

`parseFigure` is the boundary on the way back out, beside `parseYearLevel`,
`parseTarget` and `parsePhoto` - a malformed or superseded row draws nothing
rather than throwing inside a report. Only figure questions pay for the column.

## Layout

> **Superseded by
> `docs/superpowers/specs/2026-08-22-question-viewport-design.md`.** The prompt
> is a fixed size now, so the figure no longer claims the room first: from `sm`
> up the two sit in a 40/60 row on every device, and the short-viewport query
> this section describes is gone.

**The figure outranks the prompt.** Today the prompt is measured and fitted into
the room between header and pad; with a figure, the figure claims that room
first and the prompt fits into the remainder, because when there is a picture
the picture is the question. The existing `ResizeObserver` re-runs when its box
changes, so the prompt shrinks correctly with no new machinery.

The exception is the viewport that already runs out of height: a **landscape
phone**, where a figure stacked above a prompt leaves both unusable. There the
two sit side by side, under a short-viewport media query.

## Content in this pass

Two figure kinds, and the templates they unlock - naming a shape from the
picture and counting its sides and corners (K-2), naming quadrilaterals and
triangles by their properties (3-5), "is the dashed line a line of symmetry?"
as true/false and "how many lines of symmetry?" as a number (3-4), classifying
angles and comparing them against a right angle (3-6).

Every one obeys the existing answer-type rules unchanged - no word answer below
Year 4, so shape names are `choice` there - which is a good sign the
`QuestionSpec`/`QuestionTemplate` split was already in the right place.

## Deliberately not in this pass

Each is a new figure kind and no engine change, which is the test of whether
this design is right: bar and picture graphs (the Statistics hole), analogue
clock faces, number lines, arrays, fractions of a shape, grids and coordinates,
and nets.
