import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { clamp, jitter, numberValue, readField } from './fields';
import { DRAWN_SPAN, MIN_MARK_GAP_PX, REPORT_BOX_PX, REPORT_STROKE_PX } from './labels';
import type { FigureKindModule } from './registry';
import { FIGURE_BOX, FIGURE_PADDING, type FigureSpec, type Mark, type Point } from './types';

/**
 * The `fraction-shape` kind: an area model, `denominator` equal parts of a
 * shape with `numerator` of them shaded. It is the picture NSW's fractions
 * strand is taught from before a fraction is ever a number on its own - "what
 * fraction is shaded?" has no sentence to ask it in, only a shape to look at.
 *
 * ---
 *
 * ## The one rule this kind exists to keep
 *
 * `2/4` and `1/2` are different questions, and this kind must draw them as
 * different pictures. A fraction template that quietly reduced `2/4` to `1/2`
 * before drawing it would be teaching the opposite of what an area model is
 * *for* - four parts with two shaded is the picture that shows a half two
 * different ways, and simplifying it away destroys the one thing worth asking.
 * So `build` never reduces: it always draws exactly `denominator` parts and
 * shades exactly `numerator` of them, whatever their greatest common factor is.
 *
 * ---
 *
 * ## Three shapes, and what each can and cannot divide
 *
 * - **`circle`** - a disc cut into `denominator` equal sectors, exactly the
 *   geometry `spinner-kind.ts` already proved out. It can represent *any*
 *   denominator up to `MAX_CIRCLE_PARTS`, derived below the same way spinner's
 *   `MIN_SECTOR_DEGREES` is: a sector under three report-row stroke widths
 *   reads as a hairline rather than a wedge.
 * - **`strip`** - a single bar cut into `denominator` equal vertical segments.
 *   Any denominator divides a line evenly; what limits it is the same report
 *   row, now measured in real pixels of width rather than degrees of arc -
 *   `MAX_LINEAR_PARTS` below.
 * - **`rectangle`** - a grid of `rows` by `columns` cells, `rows * columns =
 *   denominator`, both at least 2. **Not every denominator has one of these.**
 *   A prime denominator has no factor pair at all, and a very lopsided one
 *   (`2 * 19`) has a pair only past the width a report row can keep as
 *   separate columns. `gridFactorPairs` is the whole of that test, and it is
 *   the sense in which `shape`'s own doc says "divide evenly" - circle and
 *   strip divide *every* denominator, evenly, and only legibility ever refuses
 *   them; rectangle's refusal can be structural before legibility is even
 *   asked.
 *
 * `shapeSupports` is the single predicate the rest of this file trusts: when
 * `shape` is omitted, the jitter draws only from what it accepts for the
 * denominator in hand, and `issues` refuses a pinned `shape` that it rejects.
 *
 * ---
 *
 * ## Equal parts are exactly equal, by construction
 *
 * Every shape here divides its span with a *single* expression - `360 /
 * denominator` for a sector, `1 / denominator` for a strip segment, `1 /
 * Math.max(rows, columns)` for a grid cell - evaluated once and reused for
 * every part. That is what makes "are the parts equal?" true by construction
 * rather than by measurement: there is no per-part arithmetic that could drift,
 * because there is no per-part arithmetic at all. `fraction-shape-kind.test.ts`
 * reads the drawn breakpoints back and asserts they are evenly spaced - proving
 * the geometry rather than trusting the formula, `solid`'s "verify the
 * construction, not count its parts" lesson.
 *
 * ---
 *
 * ## What varies, with every field a template can pin actually pinned
 *
 * `numerator`, `denominator` and (when a template writes one) `shape` are the
 * question and never move. What is left to vary, so the anchoring check in
 * `validateTemplate` has something to find even on a fully-pinned template:
 *
 * - **`offset`** - which physical part is shaded first. The shaded parts are
 *   always a contiguous run of `numerator` slots out of `denominator`, and
 *   `offset` is where that run starts - drawn fresh on every build, with no
 *   field that can pin it. It is the one lever every shape has in common and
 *   the only one left once `shape` and `rotation` are both pinned. It is a
 *   *real* difference a child can see: which physical wedge, segment or cell
 *   is shaded moves, not merely a number in the JSON that never reaches the
 *   screen (the trap `solid`'s `flip` fell into - see the notes' lesson 3).
 *   It contributes nothing when `numerator` is 0 or `denominator` (nothing, or
 *   everything, is shaded either way) - see "What does not vary" below.
 * - **`rotation`, for a circle only.** A disc spun about its own centre keeps
 *   the same bounding circle whatever the angle, exactly as `spinner-kind.ts`
 *   argues at length - so a circle's rotation is a free, continuous lever with
 *   no cost to legibility.
 * - **Which factor pair, for a rectangle only.** A denominator with more than
 *   one valid `rows`-by-`columns` split (12 is `3x4`, `4x3`, `2x6` and `6x2`)
 *   draws a different-shaped grid on a different seed, drawn from
 *   `gridFactorPairs` with no field that can pin it - the identical treatment
 *   `offset` gets, and for the identical reason: nothing in the spec exposes
 *   `rows` or `columns` for a template to answer about (more on this under
 *   "The `answerIssues` question" below), so there is nothing to contradict by
 *   varying it.
 *
 * ## What does not vary, and why a rectangle or a strip does not spin
 *
 * **A rectangle or a strip is never rotated.** `rotation` is still read and
 * type-checked for both (an author's typo is still worth a report), but it has
 * no effect on either shape's drawing - the identical divergence `solid-kind.ts`
 * documents for its own `rotation`, which "does not fix the orientation" for a
 * solid the way it does for a polygon, "deliberate" every time.
 *
 * The reason is `fit`'s bounding box. A circle's bounding square is its own
 * diameter whatever angle it is drawn at, which is exactly what makes a
 * spinner's rotation free. A rectangle's is not: turned to 45 degrees, a unit
 * square's axis-aligned bounding box is its *diagonal*, `sqrt(2)` times wider
 * than the square itself - `fit` would then scale the whole drawing down to fit
 * that wider box, and every partition line would lose almost 30% of the report
 * pixels `MAX_LINEAR_PARTS` was measured against. Held to a strict guarantee
 * that survives every angle, `MAX_LINEAR_PARTS` would have to be derived
 * against that worst case instead of the axis-aligned one, more than halving
 * it. Rather than pay every rectangle and strip that legibility tax for a
 * lever they do not need - `offset`, and for a rectangle the factor-pair
 * choice, are both real and both free - rotation is simply not consulted for
 * either shape, and the report-scale limits below are the axis-aligned ones.
 *
 * ---
 *
 * ## The report-scale limits, derived rather than chosen
 *
 * A figure is built once and rendered small in a parent's report as well as
 * large on the play screen (`labels.ts`), so the smaller surface governs, the
 * same lesson `spinner` and `array` already paid for.
 *
 * **`MAX_CIRCLE_PARTS` is `spinner`'s own derivation, unchanged**: a sector
 * has to span at least three report-row stroke widths to read as a wedge
 * rather than a hairline (`MIN_SECTOR_DEGREES` in `spinner-kind.ts`), which
 * gives 39 equal sectors as the most a report row can keep apart. It is
 * re-derived here rather than imported, because importing a private constant
 * out of a sibling kind's file is exactly the coupling `labels.ts` exists to
 * avoid - the two kinds happen to draw the same shape, and their shared
 * arithmetic belongs in a shared file, not in one kind reaching into another's.
 *
 * **`MAX_LINEAR_PARTS` is the strip-and-grid analogue**, in real pixels rather
 * than degrees. `REPORT_PX_PER_UNIT` is how many report-row pixels one drawing
 * unit is worth once `fit` has scaled it - `DRAWN_SPAN` real units become
 * `REPORT_BOX_PX` pixels across the whole `FIGURE_BOX`, so the ratio between
 * them is constant regardless of what is drawn. A strip is laid out at exactly
 * `width = 1`, its larger side, so `REPORT_PX_PER_UNIT` is directly how wide it
 * draws in the report row. Each segment then needs `MIN_SEGMENT_PX` - one
 * stroke for the line dividing it from its neighbour, plus `MIN_MARK_GAP_PX`
 * of clear daylight either side of that line, so two segments read as two
 * regions rather than one region with a hairline drawn through it (the same
 * "two clear strokes of daylight" reasoning `spinner`'s own minimum sector
 * gives, restated in a straight line instead of an arc). A grid's cells are
 * square, so the identical pixel budget applies to whichever side - `rows` or
 * `columns` - is longer; `gridFactorPairs` filters on exactly that.
 *
 * Measured: `MAX_CIRCLE_PARTS` comes out at **39**, `MAX_LINEAR_PARTS` at
 * **12** - a strip or a grid holds far fewer parts than a circle, because a
 * disc's sectors get *more* boundary to work with as they get thinner (a
 * bigger radius reaches further out) where a strip's segments do not. Twelve
 * happens to be a friendly ceiling for content besides - NSW's fractions work
 * rarely reaches past twelfths in primary school.
 *
 * ---
 *
 * ## The `answerIssues` question
 *
 * `array-kind.ts`'s `orientation` earns `answerIssues` because it changes
 * *which* dimension an answer of `figure.rows` or `figure.columns` names - the
 * spec exposes `rows` and `columns` as fields a template's `answer` expression
 * can read directly, and transposing them silently swaps what a bound answer
 * means. Nothing here is exposed the same way: `rows` and `columns` are a
 * rectangle's own internal arithmetic, chosen by `gridFactorPairs` and never
 * placed in the spec at all, so no `answer` expression can name one of them to
 * begin with - there is no field for a jitter to contradict.
 *
 * The only quantity a `fraction-shape` question can sensibly be answered
 * about is the fraction itself, `numerator` over `denominator`, and every
 * lever this kind has - `shape`, `offset`, the factor pair, a circle's
 * `rotation` - changes *how* that fraction is drawn and never *what* it is:
 * `numerator` parts are shaded out of `denominator`, always, whichever shape,
 * whichever slots, whichever way round the grid runs. So this kind declares no
 * `answerIssues`, on the same footing as the eight kinds before `array` that
 * did not need one - not because the question was skipped, but because it was
 * asked and nothing here can move the answer.
 */

type FractionShapeSpec = Extract<FigureSpec, { kind: 'fraction-shape' }>;

/** The closed vocabulary of shapes, in the order `shapeSupports` is asked about them. */
export const FRACTION_SHAPES = ['circle', 'rectangle', 'strip'] as const;
export type FractionShapeName = (typeof FRACTION_SHAPES)[number];

/** A fraction of one part is nothing to divide; two is the fewest that makes a question. */
export const MIN_DENOMINATOR = 2;

/** Where an unreadable `denominator` lands - drawable by every shape. */
const FALLBACK_DENOMINATOR = 4;

/** Where an unreadable `numerator` lands - shaded, so the picture is not a blank shape. */
const FALLBACK_NUMERATOR = 1;

/**
 * A safety ceiling far past anything `issues` accepts (`MAX_CIRCLE_PARTS`,
 * 39), for `build`'s "never throw" contract on a hand-authored
 * `denominator: '10000'`. At 60 parts the worst shape draws an outline, up to
 * 60 partition lines and up to 60 filled parts - 121 marks, comfortably under
 * `MAX_MARKS` (200), the identical margin `spinner`'s `MAX_DRAWN_SECTORS`
 * keeps over its own accepted limit.
 */
const HARD_MAX_DENOMINATOR = 60;

/**
 * How many points a whole turn of the circle's rim is sampled at - a multiple
 * of four, and from a fixed zero rather than from any jittered angle, so the
 * bounding box is the disc's own square whatever `rotation` is. See
 * `spinner-kind.ts`'s identical `RIM_POINTS` for the full argument.
 */
const RIM_POINTS = 72;

/**
 * How tall a strip is drawn, as a share of its own width (1). Presentation
 * only: `MAX_LINEAR_PARTS` is derived purely from the width, which is the
 * span `fit` scales against, so this number does not move the legibility
 * limit whatever it is set to - a taller or shorter bar reads equally well.
 */
const STRIP_HEIGHT = 0.4;

/**
 * Report-row pixels per drawing unit, once `fit` has scaled a frame whose
 * larger side is exactly 1 - every shape here is laid out that way. Constant
 * regardless of what is drawn, which is what lets `MAX_LINEAR_PARTS` be
 * derived once and reused for both the strip and the grid.
 */
const REPORT_PX_PER_UNIT = DRAWN_SPAN * (REPORT_BOX_PX / FIGURE_BOX);

/**
 * A segment needs this much daylight to read as its own region rather than a
 * hairline: the dividing line's own stroke, plus a clear stroke either side of
 * it - `spinner`'s "two clear strokes of daylight" reasoning, restated for a
 * straight edge instead of an arc.
 */
const MIN_SEGMENT_PX = REPORT_STROKE_PX + MIN_MARK_GAP_PX;

/**
 * The most equal parts a strip or a grid's longer side may hold before a
 * report row draws them as one grey band. See the module comment's "report
 * scale limits" section for the derivation; measured at **12**.
 */
export const MAX_LINEAR_PARTS = Math.floor(REPORT_PX_PER_UNIT / MIN_SEGMENT_PX);

/** How much of the turn a report-row stroke is worth, at the fitted disc's own radius. */
const FITTED_RADIUS = (FIGURE_BOX - 2 * FIGURE_PADDING) / 2;
const DEGREES_PER_RIM_PX = 360 / (2 * Math.PI * (FITTED_RADIUS / FIGURE_BOX) * REPORT_BOX_PX);
const MIN_SECTOR_DEGREES = DEGREES_PER_RIM_PX * REPORT_STROKE_PX * 3;

/**
 * The most equal sectors a circle may hold before one drops under three
 * report-row stroke widths - `spinner-kind.ts`'s own derivation, re-run here
 * rather than imported (see the module comment). Measured at **39**.
 */
export const MAX_CIRCLE_PARTS = Math.floor(360 / MIN_SECTOR_DEGREES);

/**
 * Every `rows`-by-`columns` split of `denominator` a grid could legibly draw:
 * both sides at least 2 (one row of dots is not a grid), neither side over
 * `MAX_LINEAR_PARTS`. Exported so `figure.shape: 'rectangle'`'s own limit can
 * be tested directly rather than only through a built figure - the same
 * reason `array-kind.ts` exports `reportDotPitchPx`.
 *
 * Both orientations of an asymmetric split appear as separate entries -
 * `rows` runs from 2 to `denominator / 2` inclusive, so `(2, 6)` and `(6, 2)`
 * both turn up for a denominator of 12 - which is what lets "which way round
 * the grid runs" be a real lever in `build` below.
 */
export function gridFactorPairs(denominator: number): [number, number][] {
  const pairs: [number, number][] = [];
  for (let rows = 2; rows <= Math.floor(denominator / 2); rows++) {
    if (denominator % rows !== 0) continue;
    const columns = denominator / rows;
    if (columns < 2) continue;
    if (Math.max(rows, columns) > MAX_LINEAR_PARTS) continue;
    pairs.push([rows, columns]);
  }
  return pairs;
}

/** Whether this shape can draw `denominator` equal parts at all, let alone legibly. */
function shapeSupports(shape: FractionShapeName, denominator: number): boolean {
  if (shape === 'circle') return denominator <= MAX_CIRCLE_PARTS;
  if (shape === 'strip') return denominator <= MAX_LINEAR_PARTS;
  return gridFactorPairs(denominator).length > 0;
}

/** A whole, drawable count of parts. Anything else lands on `FALLBACK_DENOMINATOR`. */
function drawableDenominator(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value) || value < MIN_DENOMINATOR) {
    return FALLBACK_DENOMINATOR;
  }
  return clamp(Math.round(value), MIN_DENOMINATOR, HARD_MAX_DENOMINATOR);
}

/** A whole count of shaded parts, no more than the shape has. */
function drawableNumerator(value: number | undefined, denominator: number): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return Math.min(FALLBACK_NUMERATOR, denominator);
  }
  return clamp(Math.round(value), 0, denominator);
}

/**
 * A shape a jitter or a broken pin landed on, resolved into one this
 * denominator can actually be drawn on. Tried in a fixed order - circle,
 * then strip, then rectangle - so the substitution is a deterministic
 * function of `(requested, denominator)` and costs no extra draw off the
 * `Rng` (see `build`'s "constant consumption" note).
 *
 * The final, unconditional `'rectangle'` is not itself re-checked, and that
 * is deliberate rather than an oversight: `issues` only ever accepts an
 * omitted `shape` when *at least one* of the three supports the denominator
 * (see `figureIssues`' own "no shape can draw legibly" check below), so for
 * any validated template that reaches this line - `requested` was not
 * `'rectangle'`, and neither circle nor strip could take it - rectangle is
 * the one the validation already promised would work, by elimination. The
 * only way this line is reached with rectangle *also* unsupported is content
 * that never validated in the first place (a denominator past
 * `MAX_CIRCLE_PARTS` with no factor pair either, or `requested` itself
 * `'rectangle'` and already unsupported at the first check above) -
 * `rectangleMarks`'s own synthetic 1-row fallback is what keeps that
 * unreachable-but-possible case drawable rather than thrown.
 */
function resolvedShape(requested: FractionShapeName, denominator: number): FractionShapeName {
  if (shapeSupports(requested, denominator)) return requested;
  if (shapeSupports('circle', denominator)) return 'circle';
  if (shapeSupports('strip', denominator)) return 'strip';
  return 'rectangle';
}

/**
 * Which physical parts are shaded: a contiguous run of `numerator` slots out
 * of `denominator`, starting at `offset` and wrapping round. Contiguous
 * because that is how an area model is drawn in every NSW classroom resource
 * this content is written against - a scattered, non-adjacent set of shaded
 * cells answers the same fraction but is not the picture a child has been
 * shown - and a wrap because `offset` has to be free to name any of the
 * `denominator` slots, including ones near the end of the run.
 */
function shadedSlots(denominator: number, numerator: number, offset: number): Set<number> {
  const shaded = new Set<number>();
  for (let step = 0; step < numerator; step++) shaded.add((offset + step) % denominator);
  return shaded;
}

function closedPath(points: readonly Point[], fill: boolean, dashed = false): Mark {
  return { kind: 'path', points, closed: true, fill, dashed };
}

function openPath(points: readonly Point[]): Mark {
  return { kind: 'path', points, closed: false, fill: false, dashed: false };
}

function rectangleCorners(x0: number, y0: number, x1: number, y1: number): Point[] {
  return [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ];
}

/**
 * A disc cut into `denominator` equal sectors, `spinner`'s own geometry with
 * every sector the same size. `step` - `360 / denominator` - is computed once
 * and reused for every sector's start angle, which is the whole of "equal
 * parts are exactly equal" for this shape: there is one division, not
 * `denominator` of them, so there is nothing for per-sector arithmetic to
 * disagree about.
 */
function circleMarks(denominator: number, shaded: ReadonlySet<number>, rotation: number): Mark[] {
  const step = 360 / denominator;
  const onRim = (degrees: number): Point => {
    const radians = (degrees * Math.PI) / 180;
    return [Math.cos(radians), Math.sin(radians)];
  };

  const marks: Mark[] = [];

  for (let sector = 0; sector < denominator; sector++) {
    if (!shaded.has(sector)) continue;
    const from = rotation + sector * step;
    const samples = Math.max(1, Math.ceil(step / (360 / RIM_POINTS)));
    const points: Point[] = [[0, 0]];
    for (let index = 0; index <= samples; index++) points.push(onRim(from + (step * index) / samples));
    marks.push(closedPath(points, true));
  }

  marks.push(
    closedPath(
      Array.from({ length: RIM_POINTS }, (_, index) => onRim((index * 360) / RIM_POINTS)),
      false,
    ),
  );

  for (let sector = 0; sector < denominator; sector++) {
    marks.push(openPath([[0, 0], onRim(rotation + sector * step)]));
  }

  return marks;
}

/**
 * A bar cut into `denominator` equal vertical segments. `1 / denominator` is
 * computed once and reused for every breakpoint, the identical "one division"
 * argument `circleMarks` makes.
 */
function stripMarks(denominator: number, shaded: ReadonlySet<number>): Mark[] {
  const width = 1 / denominator;
  const marks: Mark[] = [];

  for (let segment = 0; segment < denominator; segment++) {
    if (!shaded.has(segment)) continue;
    const x0 = segment * width;
    marks.push(closedPath(rectangleCorners(x0, 0, x0 + width, STRIP_HEIGHT), true));
  }

  marks.push(closedPath(rectangleCorners(0, 0, 1, STRIP_HEIGHT), false));

  for (let segment = 1; segment < denominator; segment++) {
    const x = segment * width;
    marks.push(openPath([[x, 0], [x, STRIP_HEIGHT]]));
  }

  return marks;
}

/**
 * A `rows` by `columns` grid of equal square cells. `1 / Math.max(rows,
 * columns)` is computed once and reused for every cell's width and height -
 * "one division", again - which is also what pins the frame's larger side to
 * exactly 1, as `figure-kind-author-notes.md` section 4 asks for.
 */
function rectangleMarks(
  rows: number,
  columns: number,
  shaded: ReadonlySet<number>,
): Mark[] {
  const cell = 1 / Math.max(rows, columns);
  const width = columns * cell;
  const height = rows * cell;
  const marks: Mark[] = [];

  for (const index of shaded) {
    const row = Math.floor(index / columns);
    const column = index % columns;
    const x0 = column * cell;
    const y0 = row * cell;
    marks.push(closedPath(rectangleCorners(x0, y0, x0 + cell, y0 + cell), true));
  }

  marks.push(closedPath(rectangleCorners(0, 0, width, height), false));

  for (let column = 1; column < columns; column++) {
    const x = column * cell;
    marks.push(openPath([[x, 0], [x, height]]));
  }
  for (let row = 1; row < rows; row++) {
    const y = row * cell;
    marks.push(openPath([[0, y], [width, y]]));
  }

  return marks;
}

export const fractionShapeModule: FigureKindModule<'fraction-shape'> = {
  kind: 'fraction-shape',

  // Both counts are required - a fraction is not a fraction without them.
  // Omitting `shape` is what asks for the jitter over what the denominator can
  // legibly be drawn as; omitting `rotation` spins a circle and does nothing
  // for the other two (see the module comment).
  fields: {
    numerator: 'required',
    denominator: 'required',
    shape: 'optional',
    rotation: 'optional',
  },

  build(spec: FractionShapeSpec, scope: Scope, rng: Rng): Mark[] {
    const denominator = drawableDenominator(numberValue(readField(spec.denominator, scope)));
    const numerator = drawableNumerator(numberValue(readField(spec.numerator, scope)), denominator);

    // Every one of these four is drawn whether or not the field it might feed
    // is pinned, so a figure's appetite off the question's shared `Rng` never
    // depends on what a template chose to fix - `spinner`'s `rotation` and
    // `array`'s `orientation`/aspect pair are the identical pattern.
    const spunShape = rng.pick(FRACTION_SHAPES);
    const spunRotation = jitter(rng, 0, 360);
    const offset = rng.int(0, denominator - 1);
    const pairs = gridFactorPairs(denominator);
    const [rows, columns] = rng.pick(pairs.length > 0 ? pairs : [[1, denominator] as [number, number]]);

    const readShape = readField(spec.shape, scope);
    const requestedShape =
      typeof readShape === 'string' && (FRACTION_SHAPES as readonly string[]).includes(readShape)
        ? (readShape as FractionShapeName)
        : spunShape;
    const shape = resolvedShape(requestedShape, denominator);

    const rotation = numberValue(readField(spec.rotation, scope)) ?? spunRotation;
    const shaded = shadedSlots(denominator, numerator, offset);

    if (shape === 'circle') return circleMarks(denominator, shaded, rotation);
    if (shape === 'strip') return stripMarks(denominator, shaded);
    return rectangleMarks(rows, columns, shaded);
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const denominatorRaw = read(spec.denominator, 'figure.denominator', 'number', true);
    const numeratorRaw = read(spec.numerator, 'figure.numerator', 'number', true);
    const shapeRaw = read(spec.shape, 'figure.shape', 'string');
    read(spec.rotation, 'figure.rotation', 'number');

    let denominator: number | null = null;
    if (typeof denominatorRaw === 'number') {
      if (!Number.isInteger(denominatorRaw)) {
        issues.push(`figure.denominator: ${denominatorRaw} is not a whole number of parts`);
      } else if (denominatorRaw < MIN_DENOMINATOR) {
        issues.push(
          `figure.denominator: ${denominatorRaw} is under ${MIN_DENOMINATOR} - a fraction needs` +
            ` at least ${MIN_DENOMINATOR} parts to divide the shape into`,
        );
      } else {
        denominator = denominatorRaw;
      }
    }

    if (typeof numeratorRaw === 'number') {
      if (!Number.isInteger(numeratorRaw)) {
        issues.push(`figure.numerator: ${numeratorRaw} is not a whole number of parts`);
      } else if (numeratorRaw < 0) {
        issues.push(
          `figure.numerator: ${numeratorRaw} is below zero, and no part of the shape can be` +
            ' shaded a negative number of times',
        );
      } else if (denominator !== null && numeratorRaw > denominator) {
        issues.push(
          `figure.numerator: ${numeratorRaw} is more parts than the ${denominator} the shape` +
            ' is divided into',
        );
      }
    }

    let shape: FractionShapeName | null = null;
    if (typeof shapeRaw === 'string') {
      if (!(FRACTION_SHAPES as readonly string[]).includes(shapeRaw)) {
        issues.push(
          `figure.shape: ${JSON.stringify(shapeRaw)} is not one of ${FRACTION_SHAPES.join(', ')}`,
        );
      } else {
        shape = shapeRaw as FractionShapeName;
      }
    }

    if (denominator !== null) {
      if (shape) {
        if (!shapeSupports(shape, denominator)) {
          issues.push(shapeCapMessage(shape, denominator));
        }
      } else if (!FRACTION_SHAPES.some((candidate) => shapeSupports(candidate, denominator!))) {
        issues.push(
          `figure.denominator: ${denominator} parts is more than any shape can draw legibly -` +
            ` a circle keeps sectors apart up to ${MAX_CIRCLE_PARTS}, a strip up to` +
            ` ${MAX_LINEAR_PARTS}, and a rectangle needs a rows-by-columns split with neither` +
            ` side over ${MAX_LINEAR_PARTS}`,
        );
      }
    }

    return issues;
  },
};

function shapeCapMessage(shape: FractionShapeName, denominator: number): string {
  if (shape === 'circle') {
    return (
      `figure.shape: 'circle' cut into ${denominator} parts is over the ${MAX_CIRCLE_PARTS} a` +
      ' report row can keep apart as separate sectors'
    );
  }
  if (shape === 'strip') {
    return (
      `figure.shape: 'strip' cut into ${denominator} parts is over the ${MAX_LINEAR_PARTS} a` +
      ' report row can keep apart as separate segments'
    );
  }
  return (
    `figure.shape: 'rectangle' has no rows-by-columns split of ${denominator} with both sides` +
    ` at least 2 and neither over ${MAX_LINEAR_PARTS} - ${denominator} is prime, or too oblong` +
    ' to lay out as a grid'
  );
}
