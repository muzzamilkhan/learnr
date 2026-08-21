import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import { ASPECT_MIN, MAX_ARRAY_DIMENSION, arrayModule, reportDotPitchPx } from './array-kind';
import { MIN_MARK_GAP_PX, REPORT_BOX_PX, REPORT_STROKE_PX } from './labels';
import { createRng, type Rng } from '../rng';
import { FIGURE_BOX, MAX_MARKS, type Figure, type FigureSpec, type Mark, type Point } from './types';

/**
 * The `array` kind, read mostly through the two public doors every other kind
 * is - `buildFigure` and `figureIssues` - for the reason every kind since
 * `bar` has been: what a grid says about its rows and columns is only true
 * *after* the fit, since that is what the dots' actual coordinates are.
 *
 * Two things are asked directly instead. `reportDotPitchPx` is the argument
 * `MAX_ARRAY_DIMENSION` rests on, and re-running it is how that argument is
 * checked rather than trusted. `arrayModule.answerIssues` is a third door
 * none of the other eight kinds have - `validate.ts` dispatches it generically,
 * with no kind name in the call, but its own behaviour is exercised here
 * directly as well as through that dispatch (see `validate.test.ts`'s
 * `describe('array orientation', ...)`).
 */

const build = (spec: FigureSpec, scope: Record<string, number> = {}, seed = 'array'): Figure =>
  buildFigure(spec, scope, createRng(seed));

const arraySpec = (overrides: Partial<Extract<FigureSpec, { kind: 'array' }>> = {}) =>
  ({ kind: 'array', rows: '3', columns: '5', ...overrides }) as FigureSpec;

const dots = (figure: Figure) =>
  figure.marks.filter((mark): mark is Extract<Mark, { kind: 'dot' }> => mark.kind === 'dot');

/**
 * The grid's own structure, recovered from where the dots actually landed -
 * not from how many were drawn. Two figures can carry the same dot count
 * (3 rows of 4 and 4 rows of 3 both draw twelve) and disagree about what the
 * picture says, which is exactly the bug this kind exists to avoid; a test
 * that only counted marks could not see it (lesson 1 of
 * `figure-kind-author-notes.md`).
 */
function gridShape(figure: Figure): { rows: number; columns: number; count: number } {
  const marks = dots(figure);
  const xs = new Set(marks.map((mark) => mark.at[0]));
  const ys = new Set(marks.map((mark) => mark.at[1]));
  return { rows: ys.size, columns: xs.size, count: marks.length };
}

/** Every gap between consecutive values must be positive and within 0.05 of the first. */
function assertEvenlySpaced(values: readonly number[], label: string) {
  const sorted = [...values].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((value, index) => value - sorted[index]);
  for (const gap of gaps) {
    expect(gap, label).toBeGreaterThan(0);
    expect(gap, label).toBeCloseTo(gaps[0], 1);
  }
}

/**
 * An `Rng` that hands back a scripted sequence of `next()` values rather than
 * a real pseudo-random stream, so a test can put the cell-aspect jitter
 * (`build`'s second draw) at an exact, chosen point in its range instead of
 * hoping a seed happens to land near it.
 */
function scriptedRng(values: readonly number[]): Rng {
  let index = 0;
  const next = () => values[Math.min(index++, values.length - 1)];
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => items[0],
  };
}

/** The smallest distance between any two distinct dots, in the figure's own fitted units. */
function minDotDistance(figure: Figure): number {
  const points = dots(figure).map((mark) => mark.at);
  let min = Infinity;
  for (let a = 0; a < points.length; a++) {
    for (let b = a + 1; b < points.length; b++) {
      const [ax, ay] = points[a] as Point;
      const [bx, by] = points[b] as Point;
      const distance = Math.hypot(ax - bx, ay - by);
      if (distance > 0) min = Math.min(min, distance);
    }
  }
  return min;
}

describe('array build', () => {
  it('draws rows times columns dots', () => {
    const figure = build(arraySpec({ rows: '3', columns: '5', orientation: "'rows'" }));
    expect(gridShape(figure)).toEqual({ rows: 3, columns: 5, count: 15 });
  });

  it("draws the transpose when orientation is 'columns'", () => {
    // The same 3-by-5 data, the other way round: what was asked for as
    // `columns` becomes the row count and vice versa. This is the test that
    // would fail if rows and columns were ever swapped by accident, not just
    // a count of dots.
    const figure = build(arraySpec({ rows: '3', columns: '5', orientation: "'columns'" }));
    expect(gridShape(figure)).toEqual({ rows: 5, columns: 3, count: 15 });
  });

  it('spaces the dots evenly along each axis', () => {
    const figure = build(arraySpec({ rows: '4', columns: '6', orientation: "'rows'" }));
    const marks = dots(figure);
    const xs = [...new Set(marks.map((mark) => mark.at[0]))];
    const ys = [...new Set(marks.map((mark) => mark.at[1]))];
    assertEvenlySpaced(xs, 'columns');
    assertEvenlySpaced(ys, 'rows');
  });

  it('jitters between drawing rows-as-rows and its transpose when orientation is omitted', () => {
    // A single unpinned parameter jittering is the easy case every other
    // kind's anchoring defence relies on; this is the version specific to
    // `array` - both layouts have to turn up, not just some variation.
    const spec = arraySpec({ rows: '3', columns: '5' });
    const shapes = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      const { rows, columns } = gridShape(build(spec, {}, `orientation-${seed}`));
      shapes.add(`${rows}x${columns}`);
    }
    expect(shapes).toEqual(new Set(['3x5', '5x3']));
  });

  it("always draws rows rows when orientation is pinned to 'rows'", () => {
    const spec = arraySpec({ rows: '3', columns: '5', orientation: "'rows'" });
    for (let seed = 0; seed < 20; seed++) {
      expect(gridShape(build(spec, {}, `pinned-rows-${seed}`))).toEqual({
        rows: 3,
        columns: 5,
        count: 15,
      });
    }
  });

  it("always draws the transpose when orientation is pinned to 'columns'", () => {
    const spec = arraySpec({ rows: '3', columns: '5', orientation: "'columns'" });
    for (let seed = 0; seed < 20; seed++) {
      expect(gridShape(build(spec, {}, `pinned-columns-${seed}`))).toEqual({
        rows: 5,
        columns: 3,
        count: 15,
      });
    }
  });

  it('varies the drawn figure across seeds even with rows, columns and orientation all pinned', () => {
    // The anchoring test every kind's notes insist on: every pinnable field
    // pinned, and the figure still has to differ from seed to seed. Square
    // (rows === columns) on purpose - this is the one case where the
    // transpose is a visual no-op (lesson 2), so if this passed only for a
    // rectangular grid the orientation lever would be doing the work the
    // cell-aspect jitter is supposed to be doing on its own.
    const spec = arraySpec({ rows: '4', columns: '4', orientation: "'rows'" });
    const drawings = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      drawings.add(JSON.stringify(build(spec, {}, `pin-all-${seed}`)));
    }
    expect(drawings.size).toBeGreaterThan(1);
    // And the structure itself - which dots are the "rows" and which the
    // "columns" - never moves, whatever the cell aspect does to the spacing.
    for (let seed = 0; seed < 20; seed++) {
      expect(gridShape(build(spec, {}, `pin-all-shape-${seed}`))).toEqual({
        rows: 4,
        columns: 4,
        count: 16,
      });
    }
  });

  it('draws something for a garbage rows/columns rather than throwing', () => {
    const spec = arraySpec({ rows: 'q', columns: '-5' });
    expect(() => build(spec)).not.toThrow();
    const figure = build(spec);
    expect(figure.marks.length).toBeGreaterThan(0);
  });

  it('never draws past MAX_MARKS even for an absurd literal', () => {
    const spec = arraySpec({ rows: '10000', columns: '10000' });
    expect(build(spec).marks.length).toBeLessThanOrEqual(MAX_MARKS);
  });

  it("takes exactly two values off the question's own Rng, whatever is pinned", () => {
    // `generate` threads one `Rng` through `tryBind`, `buildFigure` and then
    // `buildChoices` - see `spinner-kind.ts` and `clock-kind.ts` for the
    // identical argument. Both the orientation coin flip and the cell-aspect
    // jitter are drawn whether or not a template pins them, which is what
    // keeps the count flat rather than letting a pinned `orientation` change
    // how many distractors get reshuffled.
    for (const orientation of [undefined, "'rows'", "'columns'"]) {
      let draws = 0;
      const inner = createRng('appetite');
      const counted: Rng = {
        next: () => (draws++, inner.next()),
        int: (min, max) => (draws++, inner.int(min, max)),
        pick: (items) => (draws++, inner.pick(items)),
      };
      const spec = arraySpec(orientation === undefined ? {} : { orientation });
      buildFigure(spec, {}, counted);
      expect(draws, orientation ?? 'open').toBe(2);
    }
  });
});

describe('array issues', () => {
  it('accepts a well formed array', () => {
    expect(figureIssues(arraySpec({ rows: '3', columns: '5' }), {})).toEqual([]);
  });

  it('reports a rows or columns under MIN_ARRAY_DIMENSION', () => {
    expect(figureIssues(arraySpec({ rows: '1' }), {})).toContainEqual(
      expect.stringMatching(/figure\.rows.*under 2/i),
    );
    expect(figureIssues(arraySpec({ columns: '0' }), {})).toContainEqual(
      expect.stringMatching(/figure\.columns.*under 2/i),
    );
  });

  it('reports a non-integer rows or columns', () => {
    expect(figureIssues(arraySpec({ rows: '2.5' }), {})).toContainEqual(
      expect.stringMatching(/figure\.rows: 2\.5 is not a whole number/i),
    );
  });

  it('reports an orientation that is not rows or columns', () => {
    expect(figureIssues(arraySpec({ orientation: "'sideways'" }), {})).toContainEqual(
      expect.stringMatching(/figure\.orientation.*not 'rows' or 'columns'/i),
    );
  });

  it('accepts every side up to MAX_ARRAY_DIMENSION and rejects one past it', () => {
    expect(
      figureIssues(arraySpec({ rows: String(MAX_ARRAY_DIMENSION), columns: '2' }), {}),
    ).toEqual([]);
    expect(
      figureIssues(arraySpec({ rows: String(MAX_ARRAY_DIMENSION + 1), columns: '2' }), {}),
    ).toContainEqual(expect.stringMatching(/over the 7 a report row can keep/i));
  });

  it('reports rows and columns as two separate faults when both are wrong', () => {
    // "One fault, one message" (`figure-kind-author-notes.md`) is about not
    // saying the *same* mistake twice, not about only ever saying one thing -
    // a bad rows and a bad columns are two different mistakes.
    const issues = figureIssues(arraySpec({ rows: '1', columns: '2.5' }), {});
    expect(issues).toContainEqual(expect.stringMatching(/figure\.rows.*under 2/i));
    expect(issues).toContainEqual(expect.stringMatching(/figure\.columns: 2\.5 is not a whole number/i));
  });
});

describe('array issues: refusing the no-lever case', () => {
  // "Refusing the no-lever case" in the module comment - the identical
  // situation CLAUDE.md already refuses for a regular polygon's pinned
  // rotation, applied explicitly here because the cell-aspect jitter (unlike
  // a regular polygon's zero jitter) keeps every draw byte-different, so the
  // generic 50-seed anchoring check can never see this on its own.
  const NO_LEVER = /no free proportion left/i;

  it('refuses a literal square array, orientation omitted', () => {
    expect(figureIssues(arraySpec({ rows: '4', columns: '4' }), {})).toContainEqual(
      expect.stringMatching(NO_LEVER),
    );
  });

  it('refuses a literal square array, orientation pinned', () => {
    expect(
      figureIssues(arraySpec({ rows: '4', columns: '4', orientation: "'rows'" }), {}),
    ).toContainEqual(expect.stringMatching(NO_LEVER));
  });

  it('refuses a literal, non-square array with orientation pinned', () => {
    expect(
      figureIssues(arraySpec({ rows: '3', columns: '5', orientation: "'columns'" }), {}),
    ).toContainEqual(expect.stringMatching(NO_LEVER));
  });

  it('does not refuse a literal, non-square array with orientation left open', () => {
    // The transpose is a real, visible lever here - this is legitimate
    // content, and the case the aspect jitter alone already covers.
    expect(figureIssues(arraySpec({ rows: '3', columns: '5' }), {})).toEqual([]);
  });

  it('does not refuse rows/columns bound to a variable, even if equal in this one scope', () => {
    // `isClosed` judges the *expression* `spec.rows` is written as ('r'),
    // not the number it happens to evaluate to in the scope handed to this
    // one call - a var whose range happens to include 4 is not a literal 4,
    // and refusing it here would be exactly the false positive "Refusing
    // the no-lever case" exists to avoid creating a second one of.
    expect(
      figureIssues(arraySpec({ rows: 'r', columns: 'r', orientation: "'rows'" }), { r: 4 }),
    ).toEqual([]);
  });
});

describe('arrayModule.answerIssues', () => {
  // The optional `FigureKindModule` member `validate.ts` dispatches with no
  // kind name in the call (`registry.ts`) - exercised here directly, and via
  // `validate.test.ts`'s `describe('array orientation', ...)` through the
  // real dispatch path.
  const spec = (overrides: Partial<Extract<FigureSpec, { kind: 'array' }>> = {}) =>
    arraySpec(overrides) as Extract<FigureSpec, { kind: 'array' }>;

  it('flags an answer written as exactly figure.rows, orientation omitted', () => {
    expect(arrayModule.answerIssues?.(spec({ rows: 'r', columns: 'c' }), 'r')).toContainEqual(
      expect.stringMatching(/exactly figure\.rows/i),
    );
  });

  it('flags an answer written as exactly figure.columns, orientation omitted', () => {
    expect(arrayModule.answerIssues?.(spec({ rows: 'r', columns: 'c' }), 'c')).toContainEqual(
      expect.stringMatching(/exactly figure\.columns/i),
    );
  });

  it('says nothing once orientation is pinned', () => {
    expect(
      arrayModule.answerIssues?.(spec({ rows: 'r', columns: 'c', orientation: "'rows'" }), 'r'),
    ).toEqual([]);
  });

  it('says nothing about an answer that is not spelled exactly like either dimension', () => {
    expect(arrayModule.answerIssues?.(spec({ rows: 'r', columns: 'c' }), 'r * c')).toEqual([]);
  });

  it('says nothing when rows and columns are the same expression', () => {
    // Nothing for orientation to be pinned against - a square is already
    // covered by "refusing the no-lever case" when it is also literal, and
    // is otherwise legitimate, varying content (see the test above).
    expect(arrayModule.answerIssues?.(spec({ rows: 'r', columns: 'r' }), 'r')).toEqual([]);
  });
});

describe('MAX_ARRAY_DIMENSION, measured rather than guessed', () => {
  // The dot diameter and the daylight it needs to read as two dots rather
  // than one smear, in a report row's real pixels - see `array-kind.ts`'s
  // module comment for the derivation this re-runs.
  const requiredPitchPx = REPORT_STROKE_PX * 3 + MIN_MARK_GAP_PX;

  it('clears the required spacing at MAX_ARRAY_DIMENSION, on the worst-squashed axis', () => {
    expect(reportDotPitchPx(MAX_ARRAY_DIMENSION) * ASPECT_MIN).toBeGreaterThanOrEqual(
      requiredPitchPx,
    );
  });

  it('does not clear it one dimension further', () => {
    expect(reportDotPitchPx(MAX_ARRAY_DIMENSION + 1) * ASPECT_MIN).toBeLessThan(requiredPitchPx);
  });

  // `reportDotPitchPx` is a model of the geometry, not the geometry itself -
  // this checks the model against what `build` (by way of `fit`) actually
  // draws, on the exact worst-case shape and squash the model above is
  // checked against: a 2-row, `MAX_ARRAY_DIMENSION`-column grid (the row axis
  // is the one the cell-aspect jitter squashes) with the aspect pinned to
  // `ASPECT_MIN` by a scripted `Rng` rather than hoped for from a seed.
  it("measures the built figure's own dot spacing on the worst-case shape, not just the model", () => {
    const rng = scriptedRng([0.5, 0]); // orientation coin flip (unused, pinned below), then aspect at its minimum.
    const spec = arraySpec({
      rows: '2',
      columns: String(MAX_ARRAY_DIMENSION),
      orientation: "'rows'",
    });
    const figure = buildFigure(spec, {}, rng);
    const pitchPx = minDotDistance(figure) * (REPORT_BOX_PX / FIGURE_BOX);
    expect(pitchPx).toBeGreaterThanOrEqual(requiredPitchPx);
  });
});
