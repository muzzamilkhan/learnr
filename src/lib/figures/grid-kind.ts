import { type Scope, type Value } from '../expr';
import type { Rng } from '../rng';
import { clamp, numberValue, readField, truthy } from './fields';
import {
  CHAR_SHARE,
  DRAWN_SPAN,
  INK_SHARE,
  LABEL_DAYLIGHT,
  MIN_MARK_GAP_PX,
  PITCH_SHARE,
  REPORT_BOX_PX,
} from './labels';
import type { FigureKindModule } from './registry';
import { FIGURE_BOX, type Expr, type FigureSpec, type Mark, type Point } from './types';

/**
 * The `grid` kind: a ruled lattice with its columns and rows named down two
 * sides and one point marked on it. It is two questions wearing one picture -
 * "which square is the treasure in?" (the Stage 2 grid map, `B3`) and "what
 * are the coordinates of this point?" (the Stage 3 first-quadrant plane,
 * `2,3`) - and `onLines` is which of the two is being drawn: `false` marks a
 * *cell*, `true` marks an *intersection*.
 *
 * First quadrant only. NSW places negative coordinates at Stage 4, and the
 * number pad has no minus key to answer one with, so a negative `at` is
 * reported and clamped rather than drawn.
 *
 * ---
 *
 * ## `axisLabels` does not vary the picture - it varies the spelling of the answer
 *
 * This is `array`'s `orientation` again, and it is worse in one way. A
 * transposed array changes which *number* the answer is; leaving `axisLabels`
 * open changes the **notation the answer is written in**. Column 2 is drawn
 * `2` on a numbered grid and `B` on a lettered one, so a template that
 * committed to `B3` is illustrated by a grid saying `2,3` on about half of all
 * draws - a right answer marked wrong, or a picture the child cannot read the
 * answer off, depending which way round it falls.
 *
 * **The 50-seed anchoring check cannot find it**, for `array`'s structural
 * reason: it groups draws by the answer and flags an answer whose every figure
 * was byte-identical. The notation jitter makes those figures *differ*, which
 * is exactly what the check is looking for, so a template broken this way
 * looks healthier to it than one that is fine. `answerIssues` below is how
 * this kind says so itself - and read its own doc for what it can and cannot
 * detect, because a clean `validateTemplate` is not a guarantee here.
 *
 * **The jitter is kept rather than removed**, because it is one of only two
 * levers this kind has and it is the one that survives a pinned extent. What
 * changes is that pinning `axisLabels` is *mandatory* for any question whose
 * answer names a cell, and `answerIssues` says so whenever it can see it.
 *
 * ## `onLines` is defaulted, not jittered, and that is the difference
 *
 * `onLines` decides the same sort of thing - whether the answer means a cell
 * or a point - and it would be the identical defect if it jittered. It does
 * not: absent means `false`, on every seed, so no template's answer can flip
 * between draws. A default is a pin.
 *
 * What it does not buy is a template that *meant* the coordinate reading and
 * forgot to say so: that draws the map reading on every seed instead of half
 * of them. Deterministically wrong is easier to see than intermittently wrong,
 * and it is the same exposure `solid`'s `view` has - a prompt saying "this
 * net" over a jittered view - which nothing in `lib` can check, because
 * nothing here reads the prompt. `answerIssues` cannot close it either: a
 * numbered cell reference and a coordinate pair are both written `2,3`, so the
 * two readings are genuinely indistinguishable from the answer alone.
 *
 * ## What varies
 *
 * 1. **The extent**, when `columns` or `rows` are left open - the headline
 *    lever, and safe *by construction*: the extent is only free when the
 *    author did not name it, and a field the template never named is one no
 *    answer can depend on. `B3` is `B3` on a four-wide grid and on a
 *    six-wide one, and the mark sits in a visibly different part of the
 *    picture each time. (Exactly `number-line`'s argument for its range.)
 * 2. **The notation**, when `axisLabels` is left open - above.
 *
 * **And nothing else. There is deliberately no cell-aspect wobble.** `array`
 * has one, and pays for it: because the wobble keeps every draw
 * byte-*different* while looking identical to a child, a fully pinned array
 * slips past the generic anchoring check and has to be refused by a rule of
 * its own. The cells here are square on every seed, so a template that pins
 * the extent *and* the notation draws one byte-identical picture and
 * `validateTemplate` refuses it for free - the same way it already refuses a
 * regular polygon with a pinned rotation. That is a better place for the rule
 * to live than in this file, and it is why square cells are load-bearing
 * rather than merely correct (a coordinate plane with unequal axes is wrong
 * anyway).
 *
 * The practical consequence, worth knowing before authoring: **pin the
 * notation and leave the extent open.** Pinning both is refused.
 *
 * ## And mark a point with room to spare - the corner leaves no lever either
 *
 * Leaving the extent open is only half a lever, because how much it can vary
 * depends on **where the mark is**. `extentCandidates` keeps the grids big
 * enough to hold the point and legible enough to read, and a point at the
 * density corner leaves exactly one of them - so the figure is byte-identical
 * again, for a reason that has nothing to do with what the template pinned.
 * Measured, with the notation pinned as it must be, over twenty seeds:
 *
 * | the mark at | distinct pictures |
 * | --- | --- |
 * | cell (2,3) | 10 |
 * | cell (5,4) or (4,5) | 2 |
 * | **cell (5,5)** | **1** |
 * | point (2,3) on the lines | 8 |
 * | **point (5,4) on the lines** | **1** |
 *
 * So the content rule is **"a map up to 5 by 5 and a plane up to 4 by 4, *and*
 * a point with room to spare"**, not the size alone. The corner is caught -
 * the generic anchoring check sees one picture and refuses it - but its
 * message says "always drew the same picture ... unpin figure.rotation", which
 * names a field this kind does not have and says nothing about `figure.at`.
 * An author meeting that error is looking at the wrong end of their template,
 * which is why the rule is written here and on `at` in `types.ts` rather than
 * left to be inferred from the density limit.
 *
 * ## The frame is pinned by the labels, so nothing clips
 *
 * The layout is normalised so the drawing's larger side is exactly 1, which is
 * the precondition `labels.ts`' shares are stated against: the fit's scale is
 * then exactly `DRAWN_SPAN` and a report-scale character is `CHAR_SHARE` of
 * this file's own units.
 *
 * The bottom rule and the left rule are drawn out to the *ink* edges of the
 * labels rather than stopping at the grid's corner - the overhang
 * `number-line` gives its line past its end ticks, and the technique
 * `pictograph` found. So the leftmost bound of the drawing is a line's end and
 * the leftmost ink is a row label's, and the two are **the same quantity**:
 * containment is an identity, not a solved inequality, and `CHAR_SHARE`
 * cancels off both sides. It costs nothing that was not going to be drawn,
 * since a grid draws those two rules regardless, and on a coordinate plane an
 * axis reaching a little past the origin is what one looks like anyway.
 *
 * Two places the identity is an *argument* rather than an equation, both about
 * the far side of the drawing and both true only of what `issues` accepts:
 * with the mark in a cell, the last column label's ink lies inside the grid's
 * right edge because the accepted column pitch is at least a label's width
 * plus daylight, and the top row label's ink lies inside the top edge because
 * the accepted row pitch is `PITCH_SHARE`, which is `INK_SHARE` and a bit. A
 * spec `issues` refuses can clip there; that is `build` clamping rather than
 * refusing, and validation is what makes it safe.
 *
 * ## The three questions a derived label owes, and a fourth
 *
 * Every name on either axis is *computed*, so all three of `labels.ts`'
 * questions are live:
 *
 * 1. **Is it the label that gets drawn?** Every measurement below folds over
 *    `columnTexts`/`rowTexts` - the strings - and never over the counts they
 *    came from. A name of two characters (`10`, `AA`) is twice the width of a
 *    name of one, and the count it came from says neither.
 * 2. **Does all of it fit?** `widestNeighbours` asks *every adjacent pair*
 *    rather than the widest label or the last one, because the two names that
 *    crowd each other need not be the two longest.
 * 3. **Is it still distinct from its neighbour?** Here, uniquely among the
 *    label kinds, this one is answered **by construction**: consecutive
 *    integers never print the same string, and `columnLabel` is one to one.
 *    That is asserted rather than assumed - the sweep reads the drawn texts
 *    back and insists no axis repeats itself.
 *
 * **Every one of those is defending the refusal arm, not the shipped one, and
 * that is worth saying plainly.** The density limit stops a labelled grid at
 * five columns, and `0`-`5`, `1`-`5` and `A`-`E` are all one character - so
 * **every figure that validates carries single-character names**, the sweep
 * never exercises a two-character one, and `widestNeighbours`' per-pair
 * arithmetic and the alphabet wrap below both cost nothing at the sizes
 * content actually uses. They are here because `build` is total and must draw
 * the grid an author got wrong before `issues` has told them so, and because
 * the limit that keeps names to one character is itself derived - retune the
 * report row and the second character arrives without anybody deciding to
 * allow it. A reader should not take the machinery as evidence that the
 * variety exists today.
 *
 * And the fourth, which is question 3 in the costume only this kind wears:
 * **A to Z runs out.** `columnLabel` wraps to `AA`, `AB`, ... rather than
 * stopping or blanking, so a 27th column is still named, and named by
 * something no other column is called. Nothing that validates can reach it -
 * the density limit below caps a labelled grid at a handful of columns, an
 * order of magnitude short of 26 - so the wrap is there to keep `build` total
 * and honest, not because content will meet it. It is written as a wrap rather
 * than a refusal precisely because a refusal in `build` is not available: this
 * function has to return *a* name for column 27 whatever anyone thinks of the
 * grid, and a blank or a second `A` would be two columns a child cannot tell
 * apart, which is the failure the whole third question exists to prevent.
 */

type GridSpec = Extract<FigureSpec, { kind: 'grid' }>;

type LabelMode = 'numbers' | 'letters' | 'none';

const LABEL_MODES: readonly LabelMode[] = ['numbers', 'letters', 'none'];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Comparing frame-unit lengths that came out of floating-point arithmetic. */
const EPSILON = 1e-9;

/** A grid needs at least this many of each, or it has no cells to tell apart. */
export const MIN_GRID_DIMENSION = 2;

/** Daylight between the grid's edge and the ink of the names beside it. */
const LABEL_GAP = 0.02;

/**
 * How close two of this grid's lines may be drawn, as a share of the drawn
 * span. `MIN_MARK_GAP_PX` is the shared half - two stroke widths in a report
 * row's real pixels, so a whole stroke of daylight stands between them - and
 * turning it into a share of this kind's frame is this kind's own arithmetic,
 * exactly as `number-line`'s `MIN_TICK_GAP` does.
 *
 * A grid is the sharpest case there is for measuring against the report row
 * rather than the play screen: the child counts squares across and up to say
 * where the mark is, and a thumbnail where the lines have merged into a grey
 * block is a picture that cannot answer its own question - and `CLAUDE.md`
 * keeps the stored figure precisely so a parent is looking at the picture
 * their child looked at.
 */
const MIN_LINE_PITCH = (MIN_MARK_GAP_PX / REPORT_BOX_PX) * (FIGURE_BOX / DRAWN_SPAN);

/**
 * The widest grid the builder will ever *choose* for itself. Derived, not
 * picked: an unlabelled grid's cell is `1 / max(columns, rows)`, so this is
 * the largest side whose lines still clear `MIN_LINE_PITCH`, and no label
 * arrangement can beat it because labels only ever take room away. A labelled
 * grid stops far below it, which is what `isLegible` works out per figure.
 */
const MAX_CANDIDATE_DIMENSION = Math.floor(1 / MIN_LINE_PITCH);

/**
 * A hard ceiling on what is *drawn* for a pinned `columns` or `rows`, for
 * `build`'s never-throw contract rather than for anything `issues` would pass.
 * Forty by forty is 82 rules, 82 labels and the mark - 165, inside `MAX_MARKS`
 * (200), so even the worst case can still be read back out of an `Attempt`.
 * **Both halves of the storage-cap exception `labels.ts` names are kept**:
 * this slice is unreachable by anything that validates, since the density
 * limit reported below caps a labelled grid at a handful of columns.
 */
const MAX_DRAWN_DIMENSION = 40;

/** A positive cell for a spec whose labels have eaten the whole frame. Refused, but drawable. */
const MIN_DRAWN_CELL = 1e-3;

/** Where an `at` nobody could read lands - still a grid, just not the asked one. */
const FALLBACK_AT: Point = [1, 1];

/**
 * The name of a column, 1-based: `A` to `Z`, then `AA`, `AB`, ... - one to one
 * over every index of 1 or more, so no column is ever unnamed and no two
 * columns share a name. See the module comment for why the wrap is a
 * deliberate choice and why no content can reach it.
 *
 * An index below 1 lands on `A`, which is `build` being total rather than a
 * meaning: a grid map has no column 0 and `issues` says so.
 */
export function columnLabel(index: number): string {
  let remaining = Math.max(1, Math.floor(index));
  let text = '';
  while (remaining > 0) {
    text = ALPHABET[(remaining - 1) % 26] + text;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return text;
}

/**
 * Centre-to-centre spacing, in a report row's real pixels, for a cell of this
 * many frame units. Exported so the boundaries in `grid-kind.test.ts` are
 * re-derived rather than copied - the spirit of `sectorAngles` and
 * `reportDotPitchPx`.
 */
export function reportPitchPx(cell: number): number {
  return cell * DRAWN_SPAN * (REPORT_BOX_PX / FIGURE_BOX);
}

/** The point, or nothing. Strict: a hole in "2," is a typo, not a coordinate of 0. */
function parseAt(text: string): Point | null {
  const pieces = text.split(',').map((piece) => piece.trim());
  if (pieces.length !== 2 || pieces.some((piece) => piece === '')) return null;
  const [x, y] = pieces.map(Number);
  return Number.isFinite(x) && Number.isFinite(y) ? [x, y] : null;
}

/** The smallest column or row number there is: a cell grid starts at 1, a plane at 0. */
const axisFloor = (onLines: boolean): number => (onLines ? 0 : 1);

/**
 * A whole point inside the first quadrant. Rounding and clamping rather than
 * refusing, because `build` owes a child a drawing; every one of these
 * adjustments is reported by `issues`.
 */
function drawablePoint(point: Point | null, onLines: boolean): Point {
  if (!point) return FALLBACK_AT;
  const floor = axisFloor(onLines);
  return [Math.max(Math.round(point[0]), floor), Math.max(Math.round(point[1]), floor)];
}

/**
 * The one reading of `onLines`, shared by `build` and `issues` so the two
 * cannot judge different pictures - `number-line`'s `minorsAllowedBy` and its
 * reason. Absent is `false`: this field is defaulted, never jittered.
 */
function onLinesOf(expr: Expr | undefined, scope: Scope): boolean {
  return truthy(readField(expr, scope));
}

/**
 * The notations this grid could be drawn in. A readable `axisLabels` pins it;
 * anything else asks for the jitter - and on a coordinate plane the jitter has
 * only one face, since a lettered axis cannot say a coordinate. That makes
 * this the one optional field whose absence is not a free coin toss, exactly
 * as `number-line`'s `minorTicks` is.
 */
function labelModesFor(spec: GridSpec, scope: Scope, onLines: boolean): LabelMode[] {
  const asked = readField(spec.axisLabels, scope);
  if (typeof asked === 'string' && (LABEL_MODES as readonly string[]).includes(asked)) {
    return [asked as LabelMode];
  }
  return onLines ? ['numbers'] : ['numbers', 'letters'];
}

/** The numbers written along an axis: 1..n between the lines, 0..n on them. */
function axisValues(count: number, onLines: boolean): number[] {
  return onLines
    ? Array.from({ length: count + 1 }, (_, index) => index)
    : Array.from({ length: count }, (_, index) => index + 1);
}

/** How far along the axis the k-th of those sits, in frame units. */
const alongAxis = (index: number, onLines: boolean, cell: number): number =>
  onLines ? index * cell : (index + 0.5) * cell;

const widestText = (texts: readonly string[]): number =>
  texts.reduce((widest, text) => Math.max(widest, text.length), 0);

/**
 * The room two neighbouring names need between their centres. Asked of every
 * adjacent *pair* rather than of the widest name, because the two that crowd
 * each other are not always the two longest - `labels.ts`' second question,
 * and `number-line`'s `labelsFit` answering it the same way.
 */
function widestNeighbours(texts: readonly string[]): number {
  let widest = 0;
  for (let index = 0; index + 1 < texts.length; index++) {
    const pair = (texts[index].length + texts[index + 1].length) / 2 + LABEL_DAYLIGHT;
    widest = Math.max(widest, pair * CHAR_SHARE);
  }
  return widest;
}

/**
 * A grid resolved into frame units, with its larger side exactly 1 - the
 * normalisation `labels.ts`' shares are stated against.
 *
 * `left` and `bottom` are where the two extended rules end, which for every
 * grid `issues` accepts is exactly where the label ink ends - the containment
 * identity the module comment sets out, along with the two places on the far
 * side where it is an argument rather than an equation. `rightOverhang` and
 * `topOverhang` are that far side, and are zero unless a label sits *on* the
 * last line, which only the coordinate reading does.
 */
interface GridLayout {
  columns: number;
  rows: number;
  labels: LabelMode;
  onLines: boolean;
  cell: number;
  columnTexts: readonly string[];
  rowTexts: readonly string[];
  left: number;
  bottom: number;
  rightOverhang: number;
  topOverhang: number;
}

function layoutFor(
  columns: number,
  rows: number,
  labels: LabelMode,
  onLines: boolean,
): GridLayout {
  const lettered = labels === 'letters';
  const columnTexts =
    labels === 'none'
      ? []
      : axisValues(columns, onLines).map((value) =>
          // On a plane the letters start at the origin line, so `A` is 0 and
          // no two lines share a name. Refused content, kept distinct anyway.
          lettered ? columnLabel(onLines ? value + 1 : value) : String(value),
        );
  // Rows carry numbers in both notations: "B3" is the map convention, and a
  // lettered *row* would leave a cell with two letters and no number.
  const rowTexts = labels === 'none' ? [] : axisValues(rows, onLines).map(String);

  const labelled = labels !== 'none';
  const rowInk = widestText(rowTexts) * CHAR_SHARE;
  const firstColumnInk = (columnTexts[0]?.length ?? 0) * CHAR_SHARE;
  const lastColumnInk = (columnTexts[columnTexts.length - 1]?.length ?? 0) * CHAR_SHARE;

  const left = labelled ? Math.min(-(LABEL_GAP + rowInk), onLines ? -firstColumnInk / 2 : 0) : 0;
  const bottom = labelled ? -(LABEL_GAP + INK_SHARE) : 0;
  const rightOverhang = labelled && onLines ? lastColumnInk / 2 : 0;
  const topOverhang = labelled && onLines ? INK_SHARE / 2 : 0;

  // The larger side comes out exactly 1, which is what makes the fit's scale
  // exactly `DRAWN_SPAN` and `labels.ts`' shares directly comparable with the
  // geometry here. The one exception is the frame the labels have eaten
  // entirely, where the clamp below keeps the cell positive and the side is
  // no longer 1 - a grid `issues` refuses, drawn only because `build` owes a
  // child something rather than a blank square.
  const cell = Math.max(
    Math.min((1 - (rightOverhang - left)) / columns, (1 - (topOverhang - bottom)) / rows),
    MIN_DRAWN_CELL,
  );

  return {
    columns,
    rows,
    labels,
    onLines,
    cell,
    columnTexts,
    rowTexts,
    left,
    bottom,
    rightOverhang,
    topOverhang,
  };
}

/**
 * The smallest cell this grid can be drawn at and still be read in a parent's
 * 64px report row, and which of its parts is asking for it. A *per-figure
 * budget* rather than a constant, in section 6's terms: how many columns a
 * template asked for is data, so the limit is computed from the layout that
 * figure will actually get and reported with its number.
 */
function neededCell(layout: GridLayout): { cell: number; cause: string } {
  let cell = MIN_LINE_PITCH;
  let cause = 'two grid lines';

  if (layout.labels !== 'none') {
    if (PITCH_SHARE > cell) {
      cell = PITCH_SHARE;
      cause = 'two numbers stacked up the side';
    }
    const along = widestNeighbours(layout.columnTexts);
    if (along > cell) {
      cell = along;
      cause = 'two names along the bottom';
    }
  }

  return { cell, cause };
}

const isLegible = (layout: GridLayout): boolean =>
  layout.cell + EPSILON >= neededCell(layout).cell;

/** A pinned dimension as it will really be drawn, or nothing where the builder is choosing. */
function pinnedDimension(asked: number | undefined): number | undefined {
  return asked === undefined ? undefined : clamp(Math.round(asked), 1, MAX_DRAWN_DIMENSION);
}

/**
 * The extents the builder picks between: every grid wide and tall enough to
 * hold the point that still reads in a report row. A dimension the author
 * pinned is the only candidate for that dimension - it is their grid - and it
 * is still filtered, so a pinned extent nobody could read leaves this empty
 * and is reported.
 */
function extentCandidates(
  point: Point,
  asked: { columns?: number; rows?: number },
  labels: LabelMode,
  onLines: boolean,
): [number, number][] {
  const spread = (pinned: number | undefined, least: number): number[] => {
    if (pinned !== undefined) return [pinned];
    const out: number[] = [];
    for (let value = least; value <= MAX_CANDIDATE_DIMENSION; value++) out.push(value);
    return out;
  };

  const columnsList = spread(pinnedDimension(asked.columns), leastFor(point[0]));
  const rowsList = spread(pinnedDimension(asked.rows), leastFor(point[1]));

  const pairs: [number, number][] = [];
  for (const columns of columnsList) {
    for (const rows of rowsList) {
      if (isLegible(layoutFor(columns, rows, labels, onLines))) pairs.push([columns, rows]);
    }
  }
  return pairs;
}

/** The smallest grid that could hold a point this far along one axis. */
const leastFor = (coordinate: number): number => Math.max(MIN_GRID_DIMENSION, coordinate);

/**
 * The grid drawn when nothing legible holds the point: the smallest one that
 * holds it at all, or exactly what the author pinned.
 *
 * **Honouring an illegible pinned extent is deliberate**, and the opposite of
 * `number-line`'s treatment of a pinned step. A step is how a line is
 * *labelled*, which the builder may choose differently; the extent is what the
 * grid *is*, and a prompt saying "this 8 by 8 grid" over a 5 by 5 one is a
 * figure contradicting its own question, which `spinner` established is worse
 * than one that is merely cramped. `issues` reports it either way, so nothing
 * drawn this way can ship.
 */
function fallbackExtent(point: Point, asked: { columns?: number; rows?: number }): [number, number] {
  // The point's own reach is capped at `MAX_DRAWN_DIMENSION` here for
  // `build`'s sake alone: a hand-authored `at: '1000000000,1'` would otherwise
  // ask for a billion rules and hang the very screen this function exists to
  // keep drawing. `issues` never gets this far with such a point - it reports
  // one past `MAX_CANDIDATE_DIMENSION` and stops - so the cap can never make a
  // reported grid disagree with the number in its own message.
  return [
    pinnedDimension(asked.columns) ?? Math.min(leastFor(point[0]), MAX_DRAWN_DIMENSION),
    pinnedDimension(asked.rows) ?? Math.min(leastFor(point[1]), MAX_DRAWN_DIMENSION),
  ];
}

function extentsToDraw(
  point: Point,
  asked: { columns?: number; rows?: number },
  labels: LabelMode,
  onLines: boolean,
): [number, number][] {
  const candidates = extentCandidates(point, asked, labels, onLines);
  return candidates.length > 0 ? candidates : [fallbackExtent(point, asked)];
}

function rule(from: Point, to: Point): Mark {
  return { kind: 'path', points: [from, to], closed: false, fill: false, dashed: false };
}

/**
 * The drawing, in index order throughout - the two extended rules, then the
 * verticals left to right, the horizontals bottom to top, the names along each
 * axis in the order they are read, and the mark last. Nothing here iterates a
 * `Set` or a `Map`: an order that depends on insertion is variation the JSON
 * sees and a child does not, which is how a picture can pass the anchoring
 * check while anchoring.
 */
function gridMarks(layout: GridLayout, point: Point): Mark[] {
  const { columns, rows, cell, left, bottom, rightOverhang, topOverhang, onLines } = layout;
  const width = columns * cell;
  const height = rows * cell;
  const marks: Mark[] = [];

  // The bottom and left edges, run out to where the label ink ends - the
  // overhang that makes containment an identity. With no labels both are zero
  // and these are the plain edges of the grid.
  marks.push(rule([left, 0], [width + rightOverhang, 0]));
  marks.push(rule([0, bottom], [0, height + topOverhang]));

  for (let column = 1; column <= columns; column++) {
    marks.push(rule([column * cell, 0], [column * cell, height]));
  }
  for (let row = 1; row <= rows; row++) {
    marks.push(rule([0, row * cell], [width, row * cell]));
  }

  const rowLabelX = -(LABEL_GAP + (widestText(layout.rowTexts) * CHAR_SHARE) / 2);
  const columnLabelY = bottom + INK_SHARE / 2;

  layout.columnTexts.forEach((text, index) => {
    marks.push({ kind: 'label', at: [alongAxis(index, onLines, cell), columnLabelY], text });
  });
  layout.rowTexts.forEach((text, index) => {
    marks.push({ kind: 'label', at: [rowLabelX, alongAxis(index, onLines, cell)], text });
  });

  // Clamped into the grid, not refused: a point outside it is reported, and
  // here it only has to be drawable.
  const floor = axisFloor(onLines);
  const column = clamp(point[0], floor, columns);
  const row = clamp(point[1], floor, rows);
  marks.push({
    kind: 'dot',
    at: onLines
      ? [column * cell, row * cell]
      : [(column - 0.5) * cell, (row - 0.5) * cell],
  });

  return marks;
}

/**
 * An expression's value where the template alone fixes it - `readField` against
 * an **empty scope**, so anything reading a bound variable comes back as
 * nothing. It is `array-kind.ts`'s `isClosed` in the form `answerIssues` needs:
 * deliberately syntactic rather than a range analysis, so it never claims to
 * know something a bound variable could move. `array` had to write its own
 * because it wants a boolean; this wants the value, which is exactly what
 * `readField` already returns, so it is that call and not a second copy of it.
 */
const closedValue = (expr: Expr | undefined): Value | undefined => readField(expr, {});

/**
 * Which notation a piece of text is a cell reference in, or nothing at all if
 * it is not one. `B3` is a lettered reference, `2,3` and `(2,3)` are a pair of
 * numbers; a bare number, a word and anything else are neither.
 */
function referenceNotation(text: string): 'letters' | 'numbers' | null {
  const trimmed = text.trim();
  if (/^[A-Za-z]+\s*\d+$/.test(trimmed)) return 'letters';
  if (/^\d+\s*,\s*\d+$/.test(trimmed) || /^\(\s*\d+\s*,\s*\d+\s*\)$/.test(trimmed)) {
    return 'numbers';
  }
  return null;
}

export const gridModule: FigureKindModule<'grid'> = {
  kind: 'grid',

  // Only the marked point is required - it is the answer, and the one thing
  // the builder cannot invent. Omitting `columns` and `rows` is what asks for
  // the extent to jitter; omitting `axisLabels` is what asks for the notation
  // to, which is the pin the module comment says is mandatory for a question
  // whose answer names a cell. `onLines` is defaulted rather than jittered.
  fields: {
    at: 'required',
    columns: 'optional',
    rows: 'optional',
    axisLabels: 'optional',
    onLines: 'optional',
  },

  build(spec: GridSpec, scope: Scope, rng: Rng): Mark[] {
    const onLines = onLinesOf(spec.onLines, scope);
    const read = readField(spec.at, scope);
    const point = drawablePoint(typeof read === 'string' ? parseAt(read) : null, onLines);
    const asked = {
      columns: numberValue(readField(spec.columns, scope)),
      rows: numberValue(readField(spec.rows, scope)),
    };

    // **Two draws, always, whichever fields a template pinned.** `generate`
    // threads one `Rng` through `buildFigure` into `buildChoices`, so a figure
    // whose appetite depended on what was pinned would reshuffle the
    // distractors of the very question it illustrates. A pick from a
    // single-item list is still a pick.
    const labels = rng.pick(labelModesFor(spec, scope, onLines));
    const [columns, rows] = rng.pick(extentsToDraw(point, asked, labels, onLines));

    return gridMarks(layoutFor(columns, rows, labels, onLines), point);
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const rawAt = read(spec.at, 'figure.at', 'string', true);
    const askedColumns = read(spec.columns, 'figure.columns', 'number');
    const askedRows = read(spec.rows, 'figure.rows', 'number');
    // Read for its own sake, to report a value that is not a truth value or
    // not a notation; what each *means* to the geometry is read below through
    // the same two functions `build` calls.
    const rawLabels = read(spec.axisLabels, 'figure.axisLabels', 'string');
    read(spec.onLines, 'figure.onLines', 'boolean');

    const onLines = onLinesOf(spec.onLines, scope);

    if (typeof rawLabels === 'string' && !(LABEL_MODES as readonly string[]).includes(rawLabels)) {
      issues.push(
        `figure.axisLabels: ${JSON.stringify(rawLabels)} is not 'numbers', 'letters' or 'none'`,
      );
    } else if (rawLabels === 'letters' && onLines) {
      issues.push(
        "figure.axisLabels: 'letters' cannot name a point on the lines, which figure.onLines" +
          ' asks for - a coordinate is a pair of numbers, and a lettered axis has no number' +
          ' to give it',
      );
    }

    // A grid so big that no arrangement of it could be read is named with the
    // author's own number, here, rather than being folded into the density
    // message below - that message describes the grid `build` would really
    // draw, which is capped, and quoting a capped number back at somebody who
    // asked for a thousand columns would be telling them about a grid they
    // did not write.
    let beyondDrawing = false;

    for (const [value, label] of [
      [askedColumns, 'columns'],
      [askedRows, 'rows'],
    ] as const) {
      if (typeof value !== 'number') continue;
      if (!Number.isInteger(value)) {
        issues.push(`figure.${label}: ${value} is not a whole number of ${label}`);
      } else if (value < MIN_GRID_DIMENSION) {
        issues.push(
          `figure.${label}: ${value} is under the ${MIN_GRID_DIMENSION} a grid needs to have` +
            ' cells a child can tell apart',
        );
      } else if (value > MAX_CANDIDATE_DIMENSION) {
        beyondDrawing = true;
        issues.push(
          `figure.${label}: ${value} is past the ${MAX_CANDIDATE_DIMENSION} lines a parent's` +
            ` ${REPORT_BOX_PX}px report row can keep ${MIN_MARK_GAP_PX}px apart, so the grid` +
            ' would be a grey block there however it is labelled',
        );
      }
    }

    const point = typeof rawAt === 'string' ? parseAt(rawAt) : null;
    if (typeof rawAt === 'string' && !point) {
      issues.push(`figure.at: ${JSON.stringify(rawAt)} is not a point written "x,y"`);
    }
    // Everything below is about where the mark lands, which needs a point.
    if (!point) return issues;

    const [x, y] = point;
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      issues.push(
        `figure.at: ${JSON.stringify(rawAt)} is not a whole` +
          ` ${onLines ? 'point on the lines' : 'cell'} - a grid has nowhere between them to mark`,
      );
      return issues;
    }
    if (x < 0 || y < 0) {
      issues.push(
        `figure.at: ${JSON.stringify(rawAt)} is outside the first quadrant, which is the whole` +
          ' of what this kind draws - and the number pad has no minus key to answer one with',
      );
      return issues;
    }
    const floor = axisFloor(onLines);
    if (x < floor || y < floor) {
      const which = x < floor ? `column ${x}` : `row ${y}`;
      issues.push(
        `figure.at: ${which} is not a cell - a grid map counts its columns and rows from 1,` +
          ' and only figure.onLines makes 0 a place to stand',
      );
      return issues;
    }

    // A point so far out that the grid holding it could never be read - the
    // sibling of `number-line`'s "too big a number to draw a line around", and
    // the fault behind it is the point rather than an extent nobody wrote.
    if (x > MAX_CANDIDATE_DIMENSION || y > MAX_CANDIDATE_DIMENSION) {
      issues.push(
        `figure.at: ${JSON.stringify(rawAt)} needs a grid at least ${x} by ${y}, past the` +
          ` ${MAX_CANDIDATE_DIMENSION} lines a parent's ${REPORT_BOX_PX}px report row can keep` +
          ' apart - mark a point nearer the corner',
      );
      return issues;
    }

    const pinnedColumns = typeof askedColumns === 'number' ? pinnedDimension(askedColumns) : undefined;
    const pinnedRows = typeof askedRows === 'number' ? pinnedDimension(askedRows) : undefined;
    if (pinnedColumns !== undefined && x > pinnedColumns) {
      issues.push(`figure.at: column ${x} is outside a grid ${pinnedColumns} columns wide`);
    }
    if (pinnedRows !== undefined && y > pinnedRows) {
      issues.push(`figure.at: row ${y} is outside a grid ${pinnedRows} rows high`);
    }

    const asked = { columns: pinnedColumns, rows: pinnedRows };

    // **One fault, one message**, keyed on a tag rather than on a phrase from
    // the prose: two candidate notations can both be too dense for the same
    // reason, and the wording is the half that gets reworded.
    const reported = new Set<string>();
    for (const labels of beyondDrawing ? [] : labelModesFor(spec, scope, onLines)) {
      if (extentCandidates(point, asked, labels, onLines).length > 0) continue;
      if (reported.has('density')) continue;
      reported.add('density');

      const [columns, rows] = fallbackExtent(point, asked);
      const layout = layoutFor(columns, rows, labels, onLines);
      const needed = neededCell(layout);
      const forced =
        (pinnedColumns === undefined && x > MIN_GRID_DIMENSION) ||
        (pinnedRows === undefined && y > MIN_GRID_DIMENSION);

      issues.push(
        `a grid ${columns} by ${rows}` +
          `${labels === 'none' ? ' with no labels' : ` labelled in ${labels}`} leaves` +
          ` ${reportPitchPx(layout.cell).toFixed(1)}px between its lines in a parent's` +
          ` ${REPORT_BOX_PX}px report row, under the ${reportPitchPx(needed.cell).toFixed(1)}px` +
          ` it takes to read ${needed.cause} apart - draw fewer columns or rows` +
          (forced ? ' (figure.at is what makes the grid at least this big)' : '') +
          (labels === 'none' ? '' : ", or figure.axisLabels: 'none' to drop the names"),
      );
    }

    return issues;
  },

  /**
   * What the answer says about the notation the grid will be drawn in - the
   * seam `array-kind.ts` opened, for the reason the module comment gives: the
   * 50-seed anchoring check cannot see a jitter that changes how the answer is
   * *spelled*, because such a jitter makes the figures differ, which is
   * exactly what that check reads as healthy.
   *
   * **What it detects:** an answer the template alone fixes to a string that
   * reads as a cell reference - `'B3'`, `'2,3'`, `'(2,3)'`, and anything the
   * expression language folds into one with no scope, like `'B' + 3`. Against
   * that it reports three things: a notation left open, so the grid spells the
   * answer the other way about half the time; a notation pinned to the other
   * one, which is wrong on every draw; and `'none'`, where there is nothing on
   * the picture to read a reference off at all.
   *
   * **What it cannot detect, and this is not a short list.** An answer reached
   * through a bound variable, a `pick`, or arithmetic over them is unreadable
   * here - `answer: 'reference'` says nothing to a static check, and the
   * module contract gives a kind no way to prove two arbitrary expressions
   * mean the same text. A reference written some other way ("row 3, column
   * 2") is not matched. And **nothing here can tell the two readings of `2,3`
   * apart** - a numbered cell reference and a coordinate pair are the same
   * string - so a template that meant the coordinate plane and left `onLines`
   * absent is invisible to this and draws the map reading on every seed.
   *
   * It is a **heuristic in both directions**: an answer that reads like a
   * reference by coincidence is reported too, as `array`'s is, and the message
   * says only what was detected rather than asserting what the author meant.
   * Every one of them unblocks the same way - pinning `figure.axisLabels`
   * never hurts a template that did not need it - so the remedy is sound even
   * where the diagnosis is not. **A clean `validateTemplate` means the common
   * mistake was not detected, not that the template is safe.**
   */
  answerIssues(spec, answer) {
    const answered = closedValue(answer);
    if (typeof answered !== 'string') return [];
    const notation = referenceNotation(answered);
    if (!notation) return [];

    const written = JSON.stringify(answered);
    const named = notation === 'letters' ? 'a lettered cell reference' : 'a pair of numbers';

    // Only a provably true `onLines` rules the letters out; a value a bound
    // variable could move is treated as either, which is the conservative
    // half of the two mistakes available here.
    const linesOnly = truthy(closedValue(spec.onLines));

    const pinned = closedValue(spec.axisLabels);
    const drawn =
      typeof pinned === 'string' && (LABEL_MODES as readonly string[]).includes(pinned)
        ? (pinned as LabelMode)
        : undefined;

    if (drawn === 'none') {
      return [
        `answer reads ${written}, ${named}, and figure.axisLabels: 'none' draws no labels for` +
          ' a child to read one off - name the axes, or ask something the bare grid can answer.',
      ];
    }
    if (drawn !== undefined) {
      return drawn === notation
        ? []
        : [
            `answer reads ${written}, ${named}, which a grid labelled in ${drawn} never draws -` +
              ` pin figure.axisLabels to '${notation}', or write the answer the way the grid` +
              ' spells it.',
          ];
    }
    if (linesOnly) {
      return notation === 'numbers'
        ? []
        : [
            `answer reads ${written}, ${named}, which a coordinate plane never draws - with` +
              ' figure.onLines the axes carry numbers, so a point on them is named by a pair.',
          ];
    }

    return [
      `answer reads ${written}, ${named}, and figure.axisLabels is left to jitter between` +
        ' numbers and letters - the grid spells that column the other way on about half of all' +
        ` draws, so the answer disagrees with the picture. Pin figure.axisLabels to` +
        ` '${notation}' (which is safe whether or not this match is coincidental - see` +
        ' grid-kind.ts for what this check cannot see).',
    ];
  },
};
