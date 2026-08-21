import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { clamp, jitter, numberValue, readField } from './fields';
import { DRAWN_SPAN, MIN_MARK_GAP_PX, REPORT_BOX_PX, REPORT_STROKE_PX } from './labels';
import type { FigureKindModule } from './registry';
import { FIGURE_BOX, type FigureSpec, type Mark } from './types';

/**
 * The `array` kind: a grid of dots, `rows` by `columns` - the picture equal
 * groups and multiplication are actually taught from. "How many dots in 3
 * rows of 4?" is not a sentence with anything to jitter; the array *is* the
 * question, and the sentence is its caption.
 *
 * ---
 *
 * ## `orientation` does not vary the answer - it decides which answer
 *
 * Every kind before this one had a jitter that left every possible question
 * about it still true: a rotated hexagon is still a hexagon, a clock's face
 * changes and it still says half past three. **This kind's main jitter does
 * not have that property.** Transposing a 3-row, 4-column array into 4 rows
 * of 3 is a different picture answering a different "how many rows?" - 3 on
 * one draw, 4 on the next - even though "how many dots altogether?" is
 * unmoved either way.
 *
 * So `orientation` omitted is only safe for a question the transpose leaves
 * true, and the module contract gives a kind no way to *know* which question
 * its own template is asking - `issues(spec, scope, read)` never sees
 * `answer`. What is checkable is narrower and lives one level up, in
 * `validate.ts`: whether the answer expression is written as exactly
 * `figure.rows` or exactly `figure.columns` while `orientation` is absent and
 * the two differ. That is a syntactic check, not a semantic one - an answer
 * routed through an intermediate variable (`answer: 'total / columns'` when
 * `rows` and `total / columns` happen to be the same number) will not be
 * caught by it, the same limitation `checkExpr`'s unbound-variable check
 * already lives with elsewhere in this folder. It is still worth having: the
 * natural way to write "how many rows?" is `answer: 'rows'` beside
 * `figure: { rows: 'rows', ... }`, and that is exactly the case it catches,
 * for free, on every validate, with no drawing and no seeds spent.
 *
 * **The 50-seed anchoring check above it in `validate.ts` cannot see this
 * bug at all**, and it is worth writing down why, because the failure mode is
 * not "the check misses it sometimes" - it is structural. That check groups
 * draws by `JSON.stringify(question.answer)` and flags an answer whose every
 * figure serialised identically. But `rows` and `columns` are ordinary bound
 * variables: across fifty seeds the *value* 3 recurs only when a fresh draw
 * happens to bind `rows` to 3 again, and by then `columns` has almost always
 * changed too - so the figure for that recurring "3" differs anyway, for a
 * reason that has nothing to do with whether the orientation matched the
 * answer. A template that draws the wrong orientation on every second seed
 * looks, to that check, exactly like one drawing healthy variation. It is a
 * worse failure than anchoring for the reason the task brief names: an
 * anchored figure teaches the wrong picture, but this teaches the right
 * picture and the wrong answer, right about half the time, with nothing on
 * screen or in a green test suite to say so.
 *
 * ## The lever that is left when `orientation` is pinned
 *
 * A template that pins `rows`, `columns` *and* `orientation` has used up
 * every field this kind exposes - there is no fourth to vary, unlike
 * `polygon`'s or `spinner`'s `rotation`, which is deliberately not part of
 * this spec (see `types.ts`): a grid's rows and columns are read by their
 * being horizontal and vertical, and a jittered whole-figure rotation would
 * cost that reading for the sake of a lever this kind does not need. Instead
 * every draw jitters the **aspect** of one grid cell - the vertical spacing
 * between rows against the fixed horizontal spacing between columns, drawn
 * whether or not anything else is pinned, with no field that can turn it off.
 * That is a *proportion*, not a *size* (section 3's trap in
 * `figure-kind-author-notes.md`): `fit` normalises away a drawing that is
 * merely bigger, but a taller-vs-wider cell survives it, so a fully pinned
 * 4-row, 4-column array still draws a different picture on every seed.
 *
 * It also settles the square case the task brief calls out by name: with
 * `rows === columns`, transposing is a **visual no-op** - the point set of a
 * square grid is exactly its own transpose - so `orientation` contributes
 * nothing to defeat there whatever it is set to. The cell aspect does not
 * care whether the grid is square; it still varies every draw.
 *
 * **`rows` and `columns` must both be at least 2** for that lever to have
 * anything to act on: a single row (or single column) has no vertical (or
 * horizontal) gap for an aspect to stretch or squash, so a pinned 1-by-n
 * array would be the one case even the aspect jitter cannot vary. That is
 * also the pedagogical reason to draw the line there - a 1-by-n row of dots
 * is a count, not the rows-and-columns picture an array question is about -
 * so `issues` reports anything under `MIN_ARRAY_DIMENSION` rather than the
 * kind quietly accepting a shape its own anchoring defence cannot cover.
 *
 * ## Report-row spacing
 *
 * A figure is built once and has to read in a parent's 64px report row at a
 * `REPORT_STROKE_PX` stroke, the same constraint `spinner`'s thinnest sector
 * and `clock`'s minute track are measured against (see `labels.ts`). A `dot`
 * mark renders `strokeWidth * 3` real pixels across
 * (`src/components/diagram.tsx`), so two dots need `DOT_DIAMETER_PX` between
 * their centres just to touch, plus `MIN_MARK_GAP_PX` of daylight to read as
 * two dots rather than one smear - `REQUIRED_PITCH_PX` below.
 *
 * `reportDotPitchPx` gives the spacing along the axis the cell-aspect jitter
 * leaves alone; multiplying by `ASPECT_MIN` gives the spacing on the worst
 * seed, on the axis the jitter can squash. `MAX_ARRAY_DIMENSION` is the
 * largest side either dimension may reach and still clear
 * `REQUIRED_PITCH_PX` there - measured (not guessed) at 7, with the tightest
 * arrangement, a 2-by-7 grid on the most-squashed seed, landing at 8.45px
 * against a required 7.5px. Past it this is a *data* limit, not a drawing
 * choice (`labels.ts` section 3), so it is **reported**, never silently
 * shrunk: a 12-by-12 array quietly drawn at legible density would be a
 * different multiplication fact than the one the template asked for.
 */

type ArraySpec = Extract<FigureSpec, { kind: 'array' }>;

/** An array needs at least this many of each dimension - see the module comment. */
export const MIN_ARRAY_DIMENSION = 2;

/**
 * How far the cell-aspect jitter may stretch or squash a row's height against
 * a column's width. Wide enough that two draws differ well past
 * `FIGURE_PRECISION`'s rounding; narrow enough that every array still reads
 * as a grid of squarish cells rather than a strip of dominoes.
 *
 * Exported, with `MAX_ARRAY_DIMENSION`'s derivation, so `array-kind.test.ts`
 * re-runs the same worst-case squash rather than keeping its own copy of the
 * number - two copies is how the `MAX_ARRAY_DIMENSION` boundary test could
 * quietly stop testing the boundary the day this one was retuned.
 */
export const ASPECT_MIN = 0.9;
const ASPECT_MAX = 1 / ASPECT_MIN;

/** A `dot` mark's real-pixel width in a report row - see `diagram.tsx`'s `dotDiameter`. */
const DOT_DIAMETER_PX = REPORT_STROKE_PX * 3;

/** Centre-to-centre, dots touch; this much clear daylight is what makes them two dots. */
const REQUIRED_PITCH_PX = DOT_DIAMETER_PX + MIN_MARK_GAP_PX;

/**
 * Centre-to-centre spacing, in a report row's real pixels, along the axis
 * whose count reaches `dimension` and whose spacing the cell-aspect jitter
 * does not touch. Exported so `MAX_ARRAY_DIMENSION` is an argument that can
 * be re-run, in the spirit of `sectorAngles` and `reportMarkPitchPx`.
 */
export function reportDotPitchPx(dimension: number): number {
  return (DRAWN_SPAN / (dimension - 1)) * (REPORT_BOX_PX / FIGURE_BOX);
}

/**
 * The longest side either `rows` or `columns` may reach. Derived by asking
 * `reportDotPitchPx` directly rather than picked: 7 clears
 * `REQUIRED_PITCH_PX` even multiplied by the worst-case squash `ASPECT_MIN`
 * (8.45px against 7.5px required), 8 does not (7.24px). `array-kind.test.ts`
 * re-runs both sides of that boundary rather than trusting this comment.
 */
export const MAX_ARRAY_DIMENSION = 7;

/** Where an unreadable `rows` or `columns` lands - a small, valid, drawable array. */
const FALLBACK_DIMENSION = 3;

/**
 * A safety ceiling well past `MAX_ARRAY_DIMENSION`, for `build`'s "never
 * throw" contract on a hand-authored `rows: '1000'` rather than for anything
 * `issues` would ever pass - `14 * 14 = 196` keeps even the worst case under
 * `MAX_MARKS` (200), and content that validates never gets within half of
 * `MAX_ARRAY_DIMENSION` of this, the same margin `spinner`'s
 * `MAX_DRAWN_SECTORS` keeps over its own accepted limit.
 */
const HARD_MAX_DIMENSION = 14;

/**
 * A whole, drawable count. Missing, non-finite or non-positive all land on
 * `FALLBACK_DIMENSION` rather than on 0 or a negative clamp - a grid with a
 * zero-length side draws no dots at all, which is a worse "something
 * drawable" than the one other kinds settle for (`spinner`'s parts adding to
 * nothing fall back to `FALLBACK_SECTORS` for the identical reason). The
 * mistake is still reported by `issues`; this only decides what a child sees
 * while it is.
 */
function drawableDimension(value: number | undefined): number {
  if (value === undefined || value < 1) return FALLBACK_DIMENSION;
  return clamp(Math.round(value), 1, HARD_MAX_DIMENSION);
}

export const arrayModule: FigureKindModule<'array'> = {
  kind: 'array',

  // Both dimensions are required - an array with only one of them has
  // nothing to draw. Omitting `orientation` is what asks for the transpose
  // jitter; see the module comment for why pinning it is sometimes mandatory
  // in a way this table cannot express.
  fields: {
    rows: 'required',
    columns: 'required',
    orientation: 'optional',
  },

  build(spec: ArraySpec, scope: Scope, rng: Rng): Mark[] {
    const rows = drawableDimension(numberValue(readField(spec.rows, scope)));
    const columns = drawableDimension(numberValue(readField(spec.columns, scope)));

    // Both drawn unconditionally, whatever the spec pins - the same reason
    // `spinner` always spends a draw on `rotation`: a figure whose Rng
    // appetite depended on which fields were pinned would reshuffle the
    // question's own choices differently template to template.
    const spunOrientation: 'rows' | 'columns' = rng.next() < 0.5 ? 'rows' : 'columns';
    const aspect = jitter(rng, ASPECT_MIN, ASPECT_MAX);

    const readOrientation = readField(spec.orientation, scope);
    const orientation =
      readOrientation === 'rows' || readOrientation === 'columns' ? readOrientation : spunOrientation;

    // 'columns' is the transpose: what was asked for as `columns` is drawn as
    // the row count, and vice versa.
    const drawnRows = orientation === 'columns' ? columns : rows;
    const drawnColumns = orientation === 'columns' ? rows : columns;

    const marks: Mark[] = [];
    for (let row = 0; row < drawnRows; row++) {
      for (let col = 0; col < drawnColumns; col++) {
        // x is the unsquashed axis (pitch 1); y carries the aspect jitter.
        marks.push({ kind: 'dot', at: [col, row * aspect] });
      }
    }
    return marks;
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const rows = read(spec.rows, 'figure.rows', 'number', true);
    const columns = read(spec.columns, 'figure.columns', 'number', true);
    const orientation = read(spec.orientation, 'figure.orientation', 'string');

    if (typeof orientation === 'string' && orientation !== 'rows' && orientation !== 'columns') {
      issues.push(
        `figure.orientation: ${JSON.stringify(orientation)} is not 'rows' or 'columns'`,
      );
    }

    // Each dimension is judged on its own - a bad rows count and a bad
    // columns count are two different mistakes and both are worth reporting.
    for (const [value, label] of [
      [rows, 'rows'],
      [columns, 'columns'],
    ] as const) {
      if (typeof value !== 'number') continue;
      if (!Number.isInteger(value)) {
        issues.push(`figure.${label}: ${value} is not a whole number of ${label}`);
      } else if (value < MIN_ARRAY_DIMENSION) {
        issues.push(
          `figure.${label}: ${value} is under ${MIN_ARRAY_DIMENSION} - an array needs at least` +
            ` ${MIN_ARRAY_DIMENSION} ${label} to show rows and columns, not a single line of dots`,
        );
      }
    }

    if (typeof rows === 'number' && typeof columns === 'number' && Number.isInteger(rows) && Number.isInteger(columns)) {
      const longest = Math.max(rows, columns);
      if (longest > MAX_ARRAY_DIMENSION) {
        issues.push(
          `figure: ${rows} rows by ${columns} columns is ${longest} along its longer side, over` +
            ` the ${MAX_ARRAY_DIMENSION} a report row can keep as separate dots - at` +
            ` ${REQUIRED_PITCH_PX.toFixed(1)}px needed between centres for a` +
            ` ${DOT_DIAMETER_PX.toFixed(1)}px dot, more would draw a grey block instead`,
        );
      }
    }

    return issues;
  },
};
