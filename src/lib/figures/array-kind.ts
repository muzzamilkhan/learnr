import { evaluate, type Scope } from '../expr';
import type { Rng } from '../rng';
import { clamp, jitter, numberValue, readField } from './fields';
import { DRAWN_SPAN, MIN_MARK_GAP_PX, REPORT_BOX_PX, REPORT_STROKE_PX } from './labels';
import type { FigureKindModule } from './registry';
import { FIGURE_BOX, type Expr, type FigureSpec, type Mark } from './types';

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
 * **Pin `orientation` whenever the answer means "how many rows" or "how many
 * columns" specifically** - the obligation is about what the answer is
 * *asking*, never about how it happens to be spelled. `answer: 'rows'` means
 * it, and so does an answer read through an `expr` variable, or arithmetic
 * that still names one dimension (`answer: 'r + 0'`); all three are wrong on
 * about half of all draws if `orientation` is left to jitter, for the
 * identical reason.
 *
 * `answerIssues` below catches only the first of those - an answer written
 * as *exactly* `figure.rows` or *exactly* `figure.columns` - because the
 * module contract gives a kind no way to prove two arbitrary expressions
 * mean the same number (see its own doc for why symbolic equivalence was not
 * attempted). **It is a heuristic, not a proof, and passing it is not a
 * guarantee**: a template can still be wrong in a way nothing here catches,
 * and the only reliable judgment is reading what the question actually asks
 * and pinning accordingly. Treat a clean `validateTemplate` result as "the
 * common mistake was not detected", not as "this is safe".
 *
 * **The 50-seed anchoring check in `validate.ts` cannot see this bug at
 * all**, and it is worth writing down why, because the failure mode is not
 * "the check misses it sometimes" - it is structural. That check groups
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
 * `answerIssues` is what closes part of that gap - the optional member on
 * `FigureKindModule` (`registry.ts`) that exists for exactly this kind of
 * question, one a bound `scope` alone cannot answer. `validate.ts` dispatches
 * it with no kind name in it (`figureKindModule(kind)?.answerIssues?.(...)`),
 * the same way it already dispatches `fields` and `issues` - so this stays
 * the one file that knows an `array`'s answer can name a dimension, and nothing
 * in `validate.ts` has to know that `array` exists at all.
 *
 * ## Two ways `answerIssues` can be wrong about intent, and why it still ships
 *
 * The check is textual: it does not know whether a match is the bug it is
 * looking for or a coincidence. Two classes of coincidence are worth naming
 * because they are not exotic:
 *
 * - A literal answer that happens to equal a literal `rows` or `columns` by
 *   chance - `answer: '3'` on a template that is actually "what is 1 + 2?",
 *   beside an unrelated `figure: { rows: '3', columns: '5' }` illustrating
 *   something else entirely.
 * - `rows` and `columns` that are always equal to each other by construction
 *   (a shared variable, or a constraint like `r == c`) rather than by literal
 *   spelling - here the transpose is a genuine visual no-op on every draw
 *   (see "Refusing the no-lever case" below), so pinning `orientation` was
 *   never actually necessary, even though the answer does read one of the
 *   two names.
 *
 * Both are reported, and the message says only what was detected - a textual
 * match - rather than asserting the author's intent, since the check cannot
 * see it. Both unblock the same way regardless of which case it was: pinning
 * `orientation` is always a safe fix (it never changes a template that did
 * not need it, and it always fixes one that did), so the remedy is sound even
 * on the draws where the diagnosis undersells what is actually going on.
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
 * ## Refusing the no-lever case
 *
 * The cell-aspect jitter exists so a fully-pinned array still passes the
 * 50-seed anchoring check - but a wobble of 10-11% in one cell's height is
 * not something a six-year-old can see, so a template that has fixed every
 * *visible* lever and is only surviving on that wobble has content that reads,
 * on screen, exactly like the anchored figure the whole feature exists to
 * refuse. That is `solid`'s `flip` again: variation the JSON can see and a
 * child cannot.
 *
 * This is the identical situation `CLAUDE.md` already names for a regular
 * polygon: *"Pinning `rotation: '0'` on a regular polygon therefore fails
 * validation, deliberately and with no escape hatch. Such a shape has no free
 * proportion left."* A polygon gets that refusal for free, because a pinned,
 * regular shape draws **byte-identically** on every seed and the generic
 * 50-seed check already catches byte-identical. An array does not get it for
 * free, because the cell-aspect jitter (unlike a regular polygon's *zero*
 * jitter) keeps every draw byte-*different* even when nothing about the
 * picture a child could name has moved - so `issues` refuses it explicitly,
 * below, rather than leaving it to a generic check that structurally cannot
 * see it.
 *
 * The refusal fires only when `rows` and `columns` are **closed** expressions
 * - literal, or arithmetic on literals, evaluable with no scope at all
 * (`isClosed`) - because only then is it certain the picture cannot move for
 * any reason but the invisible wobble. A `rows` bound to a variable still
 * varies in real, visible size across the fifty draws even when a constraint
 * happens to keep it equal to `columns` on every one of them (the second
 * coincidence named above), and that is genuine content, not a no-lever
 * template - refusing it would be exactly the false positive this section
 * exists to avoid creating a *second* one of.
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
 *
 * **`ASPECT_MAX` is its reciprocal, and that is load-bearing, not cosmetic.**
 * The worst case `MAX_ARRAY_DIMENSION` is measured against sits at the
 * *stretch* end of the range for one axis and the *squash* end for the other
 * (a short, wide grid whose short axis is the one the aspect stretches) -
 * see `reportDotPitchPx`'s doc. A reciprocal range is what makes stretching
 * one axis by exactly as much as the other is squashed, which is what keeps
 * `reportDotPitchPx(dimension) * ASPECT_MIN` the true minimum over the whole
 * range rather than an approximation of it; an independently chosen
 * `ASPECT_MAX` would not carry that guarantee, and the boundary tests would
 * stay green while silently no longer measuring the worst case.
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

/**
 * Whether an expression's value is fixed by the author, provably, rather
 * than by anything a bound variable could move - true when it evaluates with
 * no scope at all. A `rows` of `'4'` or `'2 + 2'` is closed; a `rows` of
 * `'r'` is not, even if `r` is a variable whose range happens to be a single
 * value or is pinned equal to another variable by a constraint - this check
 * is deliberately syntactic, not a range analysis, so it never refuses
 * content that genuinely varies (see "Refusing the no-lever case" above).
 */
function isClosed(expr: Expr | undefined): boolean {
  if (typeof expr !== 'string' || expr.trim() === '') return false;
  try {
    evaluate(expr, {});
    return true;
  } catch {
    return false;
  }
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
          `${rows} rows by ${columns} columns is ${longest} along its longer side, over` +
            ` the ${MAX_ARRAY_DIMENSION} a report row can keep as separate dots - at` +
            ` ${REQUIRED_PITCH_PX.toFixed(1)}px needed between centres for a` +
            ` ${DOT_DIAMETER_PX.toFixed(1)}px dot, more would draw a grey block instead`,
        );
      }

      // "Refusing the no-lever case" in the module comment. Both dimensions
      // fixed by the author (closed, not just equal on this one draw) and
      // either square or an orientation equally fixed leaves nothing to vary
      // but the cell-aspect wobble - too small to see, so this is refused
      // rather than left to a generic check that cannot detect it (the
      // aspect jitter keeps every draw byte-different, so nothing here is
      // ever byte-identical the way a pinned regular polygon is).
      if (isClosed(spec.rows) && isClosed(spec.columns)) {
        const orientationFixed =
          spec.orientation !== undefined &&
          isClosed(spec.orientation) &&
          (orientation === 'rows' || orientation === 'columns');

        if (rows === columns || orientationFixed) {
          issues.push(
            `rows and columns are both fixed by the template (${rows} by ${columns})` +
              (rows === columns
                ? ', and square, so figure.orientation cannot change the picture either way'
                : ` and figure.orientation is fixed to ${JSON.stringify(orientation)}`) +
              ' - nothing is left to vary but a wobble in the cell spacing too small for a child' +
              " to see, the same failure CLAUDE.md refuses for a regular polygon's pinned" +
              ' rotation ("such a shape has no free proportion left"). Let rows or columns come' +
              ' from a bound variable, or drop the pin, so the array has a lever a child can' +
              ' actually see.',
          );
        }
      }
    }

    return issues;
  },

  /**
   * See the module comment's "orientation does not vary the answer" and "Two
   * ways this can be wrong" sections - this is a heuristic, textual check,
   * not a proof, and it says only what it detected.
   */
  answerIssues(spec, answer) {
    if (spec.orientation !== undefined) return [];
    if (typeof spec.rows !== 'string' || typeof spec.columns !== 'string') return [];
    const rows = spec.rows.trim();
    const columns = spec.columns.trim();
    if (rows === columns || typeof answer !== 'string') return [];

    const trimmedAnswer = answer.trim();
    const matched = trimmedAnswer === rows ? 'rows' : trimmedAnswer === columns ? 'columns' : null;
    if (!matched) return [];

    return [
      `answer is written as exactly figure.${matched}, which is how a template usually reads ` +
        'that dimension directly, and figure.orientation is left to jitter between rows and ' +
        'columns. If the answer does mean that dimension, the picture disagrees with it on ' +
        "about half of all draws; pinning figure.orientation to 'rows' or 'columns' removes the" +
        ' risk whether or not this match is coincidental (see array-kind.ts for two ways it' +
        ' can be).',
    ];
  },
};
