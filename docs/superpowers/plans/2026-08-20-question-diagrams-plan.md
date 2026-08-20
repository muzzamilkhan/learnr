# Plan: question diagrams

Spec: `docs/superpowers/specs/2026-08-20-question-diagrams-design.md` (read it).

## Global Constraints

- **`src/lib` is pure.** No React, no network, no clock, no database. `now` and
  the RNG are passed in. Do not break this for convenience.
- **TDD, lean tests.** Test behaviour through the public function, never
  internals. `npm test` (vitest, node-only - there are no component tests) and
  `npm run typecheck` must pass before any commit.
- Randomness is always the injected `Rng` (`src/lib/rng.ts`), never
  `Math.random`, so every draw replays from a seed.
- Generation never throws on an authoring mistake: it degrades. Validation is
  where mistakes are reported. This is why the figure builder clamps.
- Follow the surrounding code's comment density and voice. This codebase
  comments *why*, at length, and reads as prose. Match it.
- Existing content and behaviour must not regress: every currently passing test
  stays passing.
- Work on `master`. Commit each task.

## Task 1: the figure library

Create `src/lib/figures/` - pure geometry, no React.

`types.ts`:
- `export type Expr = string` with a comment saying it mirrors
  `templates/types.ts` deliberately: figures sit *below* templates and must not
  import upward from them.
- `export type Point = readonly [number, number]`
- `export type Mark` - a discriminated union of exactly four members:
  - `{ kind: 'path'; points: readonly Point[]; closed: boolean; fill: boolean; dashed: boolean }`
  - `{ kind: 'arc'; at: Point; radius: number; from: number; to: number }` (degrees, anticlockwise-positive, 0 = east)
  - `{ kind: 'dot'; at: Point }`
  - `{ kind: 'label'; at: Point; text: string }`
- `export interface Figure { width: number; height: number; marks: readonly Mark[] }`
- `export type FigureSpec` - a discriminated union on `kind`:
  - `{ kind: 'polygon'; shape: Expr; rotation?: Expr; mirror?: Expr; rightAngles?: Expr }`
  - `{ kind: 'angle'; degrees: Expr; rotation?: Expr; armLength?: Expr; arc?: Expr }`
- `export const FIGURE_KINDS = ['polygon', 'angle'] as const`
- `export const POLYGON_SHAPES = ['equilateral', 'isosceles', 'scalene', 'right-triangle', 'square', 'rectangle', 'rhombus', 'parallelogram', 'trapezium', 'kite', 'pentagon', 'hexagon', 'heptagon', 'octagon'] as const`
- `export const FIGURE_BOX = 100` - the resolved box is `FIGURE_BOX` square.
- `export const FIGURE_PRECISION = 2` - coordinates are rounded to this many
  decimal places at build time, so the JSON stays small and two figures compare
  as strings.

`polygon.ts`:
- `unitPolygon(shape, rng): Point[]` - the named shape's vertices, centred on
  the origin, **jittered**: proportions vary within what keeps the name true. A
  rectangle varies its aspect ratio but stays a rectangle; an isosceles triangle
  varies its apex height and base width but keeps exactly two sides equal; a
  scalene triangle varies all three and must keep all three sides *unequal* and
  the shape non-degenerate; a kite keeps one axis of symmetry; `rhombus`,
  `parallelogram` and `trapezium` likewise vary within their definition.
  Regular polygons (`equilateral`, `square`, `pentagon`..`octagon`) vary only in
  size and rotation, since their proportions are fixed by the name.
- `symmetryAxes(shape): number[]` - the angles, in degrees in the shape's own
  unrotated frame, of every line of symmetry. Pure, no rng. `scalene` and
  `parallelogram` return `[]`.
- Both exported for tests. `symmetryAxes` is what lets `mirror: 'true'` draw a
  real axis and `mirror: 'false'` draw a plausible wrong one.

`angle.ts`:
- `angleMarks(degrees, rotation, armLength, arc): Mark[]` - a vertex with two
  arms `armLength` long, the second `degrees` round from the first, the whole
  thing turned by `rotation`, plus an `arc` mark between the arms when asked.
  Arms may differ in length from one another - that is part of the variation, so
  the arm lengths are two jittered values, not one.
  **Never draw a right-angle square**: it would give away every "what kind of
  angle is this?" answer.

`build.ts`:
- `buildFigure(spec: FigureSpec, scope: Scope, rng: Rng): Figure` - evaluates
  every expression against `scope` (use `evaluate` from `src/lib/expr`), fills
  each omitted optional from `rng`, builds the marks, scales and centres them
  into the `FIGURE_BOX` square, rounds every coordinate to `FIGURE_PRECISION`.
  **It never throws.** An unknown shape name falls back to `'triangle'`-ish
  (`equilateral`); `degrees` is clamped into `[1, 359]`; a missing/NaN value
  falls back to a jittered default.
  Defaults when the optional expression is absent: `rotation` jitters over the
  full 0-359; `armLength` jitters within a sensible band; `arc` is `true`;
  `mirror` draws no line at all; `rightAngles` is `false`.
  `mirror` evaluating truthy draws a dashed `path` through the centre along a
  randomly chosen member of `symmetryAxes(shape)`; falsy-but-present draws a
  dashed line that is deliberately *not* an axis (and, for a shape with axes, is
  not within a small tolerance of one). A shape with no axes asked for a true
  mirror is a clamp: draw a non-axis, and report it from `figureIssues`.
- `figureIssues(spec: FigureSpec, scope: Scope): string[]` - the authoring-time
  companion, called only by validation. Returns a human-readable string for each
  thing `buildFigure` would clamp or fall back on: unknown kind, unknown shape
  name, `degrees` outside `[1, 359]`, a `mirror: true` on a shape with no axes,
  an expression that does not evaluate to the right type. Empty array when clean.

Tests (`build.test.ts`, `polygon.test.ts`, `angle.test.ts`) - behaviour only:
- every name in `POLYGON_SHAPES` builds a figure with a plausible vertex count
- an isosceles triangle really has exactly two equal sides, a scalene none
  equal, a rectangle four right angles - across many seeds, not one
- `symmetryAxes` agrees with the geometry: reflecting `unitPolygon` in a
  returned axis maps the vertex set onto itself (within tolerance), and
  reflecting in a non-returned angle does not
- two different seeds give two different figures for the same scope
- the same seed gives the same figure
- every coordinate is finite and inside the box
- `buildFigure` never throws: unknown shape name, `degrees: '400'`,
  `degrees: 'nonsense'` (unbound var is a throw from `evaluate` - catch it),
  `mirror: 'true'` on a scalene
- `figureIssues` reports each of those and is empty for a clean spec

## Task 2: wire figures into templates

- `src/lib/templates/types.ts`: `QuestionSpec` gains `figure?: FigureSpec`
  (imported from `../figures/types`), documented beside `choices`.
  `GeneratedQuestion` gains `figure?: Figure`. `Question` inherits it.
- `src/lib/templates/generate.ts`: after the scope binds and the answer
  evaluates, `figure: spec.figure ? buildFigure(spec.figure, scope, rng) : undefined`.
  Nothing here throws - the builder is total by construction.
- `src/lib/templates/validate.ts`: `validateSpec` gains three checks, in this
  order, all reported as errors and never thrown:
  1. `figure.kind` is in `FIGURE_KINDS`, and every parameter is a non-empty
     expression string that parses and reads only variables bound before it
     (reuse the existing `checkExpr` and the `bound` set - figures are checked
     after all vars are bound, so the whole scope is in scope).
  2. The figure builds and `figureIssues` is empty; each issue becomes an error.
  3. **The anchoring check.** Export `const FIGURE_DRAWS = 50`. Generate the
     spec `FIGURE_DRAWS` times on distinct seeds, group the resolved figures by
     `String(answer)`, and for every answer seen more than once, error if all of
     its figures serialise identically. Message must name the answer, e.g.
     `figure: every "obtuse" draws the same picture - vary it, or the diagram
     becomes the answer`.
     Skip the check for a spec with no `figure`.
- Tests in `validate.test.ts`: a good figure template validates; an unknown
  kind, an unbound variable in a figure parameter, and a clamped parameter each
  error; a template that pins `rotation: '0'` on a single-shape spec is caught
  by the anchoring check; the same template without the pin passes.
- Tests in `generate.test.ts`: a spec with a figure produces one; without,
  `figure` is `undefined`; the same seed reproduces the same figure.

## Task 3: drawing the figure

- `src/components/figure.tsx`: `Figure` component taking `{ figure, className }`.
  Maps marks to SVG: `path` to `<polygon>`/`<polyline>`, `arc` to a `<path>`
  arc, `dot` to `<circle>`, `label` to `<text>`. Strokes `--color-ink`, fills
  `--color-brand-soft`, dashed strokes for `dashed` marks. `viewBox` from the
  figure's own width/height, `preserveAspectRatio="xMidYMid meet"`, sized by its
  container so one component serves both scales. Stroke width must not scale
  with the box - use `vectorEffect="non-scaling-stroke"` or an explicit width in
  viewBox units chosen to read at both sizes. Give the `<svg>` `role="img"` and
  an `aria-label` of "Diagram for this question" - it deliberately does not
  describe the picture, per the spec's narration section.
- `src/components/play-session.tsx`: when `question.figure` is present, render
  the figure inside the flexible area above `Prompt`. The figure takes the room
  first (`flex-1 min-h-0`, with a sensible max) and `Prompt` fits the remainder;
  the existing `ResizeObserver` handles the resize with no change needed.
  On a **short viewport** (a landscape phone) the figure and the prompt sit side
  by side instead of stacked - one flex-direction change under a media query.
  Do not add a logo, a count, or anything else to this screen.
  The figure is not tappable and narration is untouched.
- Manual check (no component tests exist - vitest is node-only): note in the
  report that portrait and landscape, phone and iPad, all need eyeballing.

## Task 4: recording the figure

- `prisma/schema.prisma`: `Attempt` gains `figure Json?`, commented in the
  file's voice - the resolved figure as the child saw it, not the template's
  parameters. Generate the migration (`npm run db:migrate` needs a database; if
  none is configured, hand-write the migration SQL under `prisma/migrations/`
  in the same shape as the existing ones and say so in the report).
- A `parseFigure(input: unknown): Figure | null` boundary - put it beside the
  other boundary normalisers and follow `parsePhoto`'s shape. It returns `null`
  for anything that is not a well-formed `Figure`, so an old or malformed row
  draws nothing rather than throwing inside a report.
- The play-path server action that records an attempt writes the figure beside
  the prompt; recording stays best-effort and must never block or interrupt play.
- `readAnsweredQuestions` (`src/lib/records.ts`) selects and returns it, through
  `parseFigure`.
- The parent's "Needs a hand" disclosure rows draw the figure small beside the
  prompt, at parent density (`ParentShell` scale: `text-sm`, single-width
  borders, `rounded-xl`). Rows without one are unchanged.
- Tests for `parseFigure` covering null, junk, a good figure, and a figure with
  a bad mark.

## Task 5: the content

Add templates to `src/content/maths.ts` using the two figure kinds, keeping the
file's existing structure, ordering and comment voice.

Cover, roughly twenty templates:
- **K-2**: name the shape from the picture (`choice` - never `text` below Year
  4), count its sides, count its corners.
- **3-5**: name a quadrilateral from its picture; name a triangle by its sides
  (equilateral / isosceles / scalene) - `choice`.
- **3-4**: "Is the dashed line a line of symmetry?" (`boolean` - one tap, no
  spelling); "How many lines of symmetry does this shape have?" (`number`).
- **3-6**: classify an angle (acute / right / obtuse, adding reflex by Year 6) -
  `choice`; is this angle bigger or smaller than a right angle - `choice`.

Rules that already bind and must keep binding (`src/content/catalog.test.ts`
enforces most of them): id shaped `subject.level.topic.variant`; a curriculum
content description in `tags`; no `text` answer below Year 4; no typed answer
the number pad cannot enter (no negatives); at least 20 templates per year.

**ACARA tags: verify, do not recall.** Look up the real Australian Curriculum
v9.0 Mathematics content description codes for the Space strand at each year
before writing them into `tags` (the file already cites `AC9MFSP01`,
`AC9M1SP01`, `AC9M2SP01`, `AC9M4SP03`, `AC9M6SP02`). List every code you
introduce in your report, and say plainly which ones you could not verify
rather than guessing - a wrong code is a false claim on the landing page, which
renders the curriculum straight from these templates.

Every new template must pass `validateTemplate`, including the anchoring check
from Task 2. `npm test` and `npm run typecheck` green.
