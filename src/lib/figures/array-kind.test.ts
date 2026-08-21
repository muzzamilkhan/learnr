import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import {
  ASPECT_MIN,
  MAX_ARRAY_DIMENSION,
  MIN_ARRAY_DIMENSION,
  reportDotPitchPx,
} from './array-kind';
import { MIN_MARK_GAP_PX, REPORT_STROKE_PX } from './labels';
import { createRng, type Rng } from '../rng';
import { MAX_MARKS, type Figure, type FigureSpec, type Mark } from './types';

/**
 * The `array` kind, read through the two public doors - `buildFigure` and
 * `figureIssues` - for the reason every kind since `bar` has been: what a
 * grid says about its rows and columns is only true *after* the fit, since
 * that is what the dots' actual coordinates are.
 *
 * The one exception is `reportDotPitchPx`, asked directly: it is the
 * argument `MAX_ARRAY_DIMENSION` rests on, and re-running it is how that
 * argument is checked rather than trusted.
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
});

describe('MIN_ARRAY_DIMENSION', () => {
  it('is 2 - a single row or column has nothing for the cell-aspect jitter to vary', () => {
    expect(MIN_ARRAY_DIMENSION).toBe(2);
  });
});
