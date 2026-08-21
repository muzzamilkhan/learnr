import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import {
  MAX_CIRCLE_PARTS,
  MAX_LINEAR_PARTS,
  gridFactorPairs,
} from './fraction-shape-kind';
import { MAX_MARKS, type Figure, type FigureSpec, type Mark, type Point } from './types';
import { createRng } from '../rng';

/**
 * The `fraction-shape` kind, read through the two public doors every kind
 * since `bar` is - `buildFigure` and `figureIssues` - because what a shape
 * says about its parts is only true *after* `fit`, when the coordinates are
 * the ones a renderer would actually draw.
 *
 * `gridFactorPairs` is the one thing asked directly, for `array`'s
 * `reportDotPitchPx` reason: `MAX_LINEAR_PARTS` rests on it, so re-running it
 * is how that argument is checked rather than trusted.
 */

const build = (spec: FigureSpec, seed: string, scope = {}): Figure =>
  buildFigure(spec, scope, createRng(seed));

const fractionSpec = (
  overrides: Partial<Extract<FigureSpec, { kind: 'fraction-shape' }>> = {},
): FigureSpec => ({ kind: 'fraction-shape', numerator: '1', denominator: '2', ...overrides });

const closedPaths = (figure: Figure) =>
  figure.marks.filter(
    (mark): mark is Extract<Mark, { kind: 'path' }> => mark.kind === 'path' && mark.closed,
  );

const openPaths = (figure: Figure) =>
  figure.marks.filter(
    (mark): mark is Extract<Mark, { kind: 'path' }> => mark.kind === 'path' && !mark.closed,
  );

/** The shaded parts: every closed, filled path. */
const shadedPaths = (figure: Figure) => closedPaths(figure).filter((mark) => mark.fill);

/** The one closed, unfilled path - the outline (a strip/rectangle) or the rim (a circle). */
const outline = (figure: Figure) => closedPaths(figure).find((mark) => !mark.fill);

/** Partition-line divider marks, split by whether they run vertically or horizontally. */
function dividerCounts(figure: Figure): { vertical: number; horizontal: number } {
  const dividers = openPaths(figure);
  const vertical = dividers.filter((mark) => mark.points[0][0] === mark.points[1][0]).length;
  const horizontal = dividers.filter((mark) => mark.points[0][1] === mark.points[1][1]).length;
  return { vertical, horizontal };
}

/**
 * Which of the three shapes drew a figure, read off the geometry alone: a
 * circle's outline is `DISC_RIM_POINTS` long and the other two are a 4-point
 * box, told apart by their dividers - a strip's are all vertical, a
 * rectangle's (with `rows, columns >= 2`) run both ways.
 */
function drawnShape(figure: Figure): 'circle' | 'strip' | 'rectangle' {
  const rim = outline(figure)!.points.length;
  if (rim > 4) return 'circle';
  const { vertical, horizontal } = dividerCounts(figure);
  return vertical > 0 && horizontal > 0 ? 'rectangle' : 'strip';
}

/** The shoelace-formula area of a closed path, in the figure's own fitted units. */
function area(points: readonly Point[]): number {
  let sum = 0;
  for (let index = 0; index < points.length; index++) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Every gap between consecutive sorted values must be positive and close to the first. */
function assertEvenlySpaced(values: readonly number[], label: string) {
  const sorted = [...values].sort((a, b) => a - b);
  const gaps = sorted.slice(1).map((value, index) => value - sorted[index]);
  for (const gap of gaps) {
    expect(gap, label).toBeGreaterThan(0);
    expect(gap, label).toBeCloseTo(gaps[0], 1);
  }
}

describe('fraction-shape build: never simplifies', () => {
  it('shades exactly numerator parts out of exactly denominator total, for every shape', () => {
    // denominator: 4, so a circle draws 4 boundaries, a strip draws 3 internal
    // dividers (4 segments), and a rectangle - the only 4-cell grid is 2x2 -
    // draws 1 vertical and 1 horizontal divider (2 columns, 2 rows).
    const circle = build(fractionSpec({ numerator: '2', denominator: '4', shape: "'circle'" }), 'count-circle');
    expect(shadedPaths(circle)).toHaveLength(2);
    expect(openPaths(circle)).toHaveLength(4);

    const strip = build(fractionSpec({ numerator: '2', denominator: '4', shape: "'strip'" }), 'count-strip');
    expect(shadedPaths(strip)).toHaveLength(2);
    expect(openPaths(strip)).toHaveLength(3);

    const rectangle = build(
      fractionSpec({ numerator: '2', denominator: '4', shape: "'rectangle'" }),
      'count-rectangle',
    );
    expect(shadedPaths(rectangle)).toHaveLength(2);
    const dividers = openPaths(rectangle);
    const vertical = dividers.filter((mark) => mark.points[0][0] === mark.points[1][0]);
    const horizontal = dividers.filter((mark) => mark.points[0][1] === mark.points[1][1]);
    // 2x2 is the only factor split of 4, so exactly one divider each way -
    // (1 + 1) * (1 + 1) = 4 cells total.
    expect((vertical.length + 1) * (horizontal.length + 1)).toBe(4);
  });

  it('draws 2/4 and 1/2 as different pictures - the same shape, pinned, and a different one', () => {
    for (const shape of ["'circle'", "'strip'"]) {
      const half = build(fractionSpec({ numerator: '1', denominator: '2', shape, rotation: '0' }), 'half');
      const twoQuarters = build(
        fractionSpec({ numerator: '2', denominator: '4', shape, rotation: '0' }),
        'two-quarters',
      );
      expect(shadedPaths(half), shape).toHaveLength(1);
      expect(shadedPaths(twoQuarters), shape).toHaveLength(2);
      expect(JSON.stringify(half), shape).not.toBe(JSON.stringify(twoQuarters));
    }
  });

  it('never reduces the denominator even when numerator and denominator share a factor', () => {
    // 3/6 is not drawn as 1/2 - six parts, three shaded, whatever the shape.
    const figure = build(fractionSpec({ numerator: '3', denominator: '6', shape: "'strip'" }), 'no-reduce');
    expect(shadedPaths(figure)).toHaveLength(3);
    expect(openPaths(figure)).toHaveLength(5); // 6 segments, 5 internal dividers
  });
});

describe('fraction-shape build: equal parts are exactly equal', () => {
  it('spaces a circle`s sector boundaries evenly round the turn', () => {
    const figure = build(
      fractionSpec({ numerator: '0', denominator: '7', shape: "'circle'", rotation: '0' }),
      'circle-spacing',
    );
    const angles = openPaths(figure)
      .map((mark) => mark.points[1] as Point)
      .map(([x, y]) => (Math.atan2(50 - y, x - 50) * 180) / Math.PI)
      .map((degrees) => (degrees + 360) % 360)
      .sort((a, b) => a - b);
    const spans = angles.map((angle, index) => (angles[(index + 1) % angles.length] - angle + 360) % 360);
    for (const span of spans) expect(span).toBeCloseTo(spans[0], 1);
  });

  it('spaces a strip`s dividing lines evenly along its width', () => {
    const figure = build(
      fractionSpec({ numerator: '0', denominator: '5', shape: "'strip'" }),
      'strip-spacing',
    );
    const xs = openPaths(figure).map((mark) => mark.points[0][0]);
    assertEvenlySpaced(xs, 'strip dividers');
  });

  it('gives a rectangle`s cells exactly equal area, not merely the right count', () => {
    const figure = build(
      fractionSpec({ numerator: '6', denominator: '6', shape: "'rectangle'" }),
      'rect-area',
    );
    // Areas are in the hundreds here (fitted-box units squared), so the
    // rounding `FIGURE_PRECISION` introduces per coordinate is a coarser
    // absolute error at this scale than it is for a single coordinate -
    // `toBeCloseTo`'s digit count is against the raw difference, not a share
    // of the value, so precision 0 (half a unit) is the right comparison.
    const areas = shadedPaths(figure).map((mark) => area(mark.points));
    for (const value of areas) expect(value).toBeCloseTo(areas[0], 0);
    // And they tile the whole outline: six cells' areas sum to the outline's.
    const total = areas.reduce((sum, value) => sum + value, 0);
    const whole = outline(figure);
    expect(whole).toBeDefined();
    expect(total).toBeCloseTo(area(whole!.points), 0);
  });
});

describe('fraction-shape build: what varies', () => {
  it('varies which shape is drawn across seeds when shape is omitted, all three of them', () => {
    const spec = fractionSpec({ numerator: '1', denominator: '4' });
    const shapes = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      shapes.add(drawnShape(build(spec, `shape-jitter-${seed}`)));
    }
    // Not just "more than one outline size" - all three shapes have to turn
    // up, or a jitter that quietly never produces a strip (say) would still
    // pass a two-bucket check.
    expect(shapes).toEqual(new Set(['circle', 'strip', 'rectangle']));
  });

  it('draws a different picture on a different seed with numerator, denominator and shape pinned', () => {
    const spec = fractionSpec({ numerator: '1', denominator: '4', shape: "'circle'", rotation: '0' });
    expect(figureIssues(spec, {})).toEqual([]);
    const drawings = new Set(
      Array.from({ length: 30 }, (_, seed) => JSON.stringify(build(spec, `pin-circle-${seed}`))),
    );
    expect(drawings.size).toBeGreaterThan(2);
  });

  it('draws a different picture on a different seed for a pinned strip too', () => {
    const spec = fractionSpec({ numerator: '2', denominator: '5', shape: "'strip'" });
    expect(figureIssues(spec, {})).toEqual([]);
    const drawings = new Set(
      Array.from({ length: 30 }, (_, seed) => JSON.stringify(build(spec, `pin-strip-${seed}`))),
    );
    expect(drawings.size).toBeGreaterThan(2);
  });

  it('draws a different picture on a different seed for a pinned rectangle too, isolating offset', () => {
    // 9 = 3x3 is the *only* factor split of 9 (`gridFactorPairs(9)` has one
    // entry), so with `shape` pinned the factor-pair lever has nothing to
    // vary and this isolates `offset` alone - the rectangle equivalent of the
    // circle test above. A multi-pair denominator like 12 would pass even if
    // `offset` did nothing, riding entirely on which pair got picked.
    expect(gridFactorPairs(9)).toEqual([[3, 3]]);
    const spec = fractionSpec({ numerator: '5', denominator: '9', shape: "'rectangle'" });
    expect(figureIssues(spec, {})).toEqual([]);
    const drawings = new Set(
      Array.from({ length: 30 }, (_, seed) => JSON.stringify(build(spec, `pin-rect-${seed}`))),
    );
    expect(drawings.size).toBeGreaterThan(2);
  });

  it('varies rotation for a circle but the shape stays the same picture size', () => {
    const spec = fractionSpec({ numerator: '1', denominator: '3', shape: "'circle'" });
    const rims = new Set(
      Array.from({ length: 20 }, (_, seed) => JSON.stringify(build(spec, `spin-${seed}`).marks[0])),
    );
    expect(rims.size).toBeGreaterThan(1);
  });
});

describe('fraction-shape build: rectangle regression - Set iteration order is not a lever', () => {
  it('draws exactly one picture for a fully-shaded rectangle, whatever offset the Rng chose', () => {
    // Regression for fix round 1, finding 1: `shadedSlots` returns a `Set`
    // whose *insertion* order depends on `offset`, and the old `rectangleMarks`
    // walked that `Set` directly - so every offset shaded the identical nine
    // cells (numerator === denominator) but emitted their `Mark`s in a
    // different order, serialising as a different figure for a picture no
    // child could tell apart on screen. `circleMarks` and `stripMarks` never
    // had this bug, because they always walked their parts by index.
    const spec = fractionSpec({ numerator: '9', denominator: '9', shape: "'rectangle'" });
    expect(figureIssues(spec, {})).toEqual([]);
    const drawings = new Set(
      Array.from({ length: 50 }, (_, seed) => JSON.stringify(build(spec, `full-rect-${seed}`))),
    );
    expect(drawings.size).toBe(1);
  });

  it('draws exactly one picture for a fully-shaded circle or strip too, as a baseline', () => {
    for (const shape of ["'circle'", "'strip'"]) {
      const spec = fractionSpec({ numerator: '4', denominator: '4', shape, rotation: '0' });
      const drawings = new Set(
        Array.from({ length: 50 }, (_, seed) => JSON.stringify(build(spec, `full-${shape}-${seed}`))),
      );
      expect(drawings.size, shape).toBe(1);
    }
  });
});

describe('fraction-shape build: a denominator a shape cannot divide evenly is not chosen for it', () => {
  it('never draws a rectangle for a prime denominator when shape is omitted', () => {
    const spec = fractionSpec({ numerator: '2', denominator: '7' });
    for (let seed = 0; seed < 40; seed++) {
      const figure = build(spec, `prime-${seed}`);
      // A true 2D grid of 7 cells is impossible (7 is prime), so this must
      // never look like one: never both a vertical and a horizontal divider
      // at once for this denominator - a rectangle drawing 7 parts would need
      // 6 partition lines whose x and y values both vary, which a strip's
      // (all-vertical) or a circle's (radial) lines never produce.
      const { vertical, horizontal } = dividerCounts(figure);
      expect(vertical === 0 || horizontal === 0, `seed ${seed}`).toBe(true);
    }
  });

  it('draws something for a garbage denominator rather than throwing', () => {
    const spec = fractionSpec({ numerator: '3', denominator: 'q' });
    expect(() => build(spec, 'garbage')).not.toThrow();
    expect(build(spec, 'garbage').marks.length).toBeGreaterThan(0);
  });

  it('never draws past MAX_MARKS even for an absurd literal', () => {
    const spec = fractionSpec({ numerator: '1', denominator: '100000', shape: "'circle'" });
    expect(build(spec, 'huge').marks.length).toBeLessThanOrEqual(MAX_MARKS);
  });
});

describe('fraction-shape build: constant Rng consumption', () => {
  it('takes the same number of values off the Rng whatever is pinned', () => {
    const variants: Partial<Extract<FigureSpec, { kind: 'fraction-shape' }>>[] = [
      {},
      { shape: "'circle'" },
      { shape: "'strip'" },
      { shape: "'rectangle'", denominator: '12' },
      { rotation: '45' },
    ];
    for (const overrides of variants) {
      let draws = 0;
      const inner = createRng('appetite');
      const counted = {
        next: () => (draws++, inner.next()),
        int: (min: number, max: number) => (draws++, inner.int(min, max)),
        pick: <T,>(items: readonly T[]) => (draws++, inner.pick(items)),
      };
      buildFigure(fractionSpec(overrides), {}, counted);
      expect(draws, JSON.stringify(overrides)).toBe(4);
    }
  });
});

describe('fraction-shape issues', () => {
  it('accepts a well formed fraction on every shape', () => {
    for (const shape of ["'circle'", "'strip'", "'rectangle'"]) {
      expect(
        figureIssues(fractionSpec({ numerator: '1', denominator: '4', shape }), {}),
        shape,
      ).toEqual([]);
    }
  });

  it('reports a denominator under MIN_DENOMINATOR', () => {
    expect(figureIssues(fractionSpec({ denominator: '1' }), {})).toContainEqual(
      expect.stringMatching(/figure\.denominator.*under 2/i),
    );
  });

  it('reports a non-integer denominator or numerator', () => {
    expect(figureIssues(fractionSpec({ denominator: '2.5' }), {})).toContainEqual(
      expect.stringMatching(/figure\.denominator: 2\.5 is not a whole number/i),
    );
    expect(figureIssues(fractionSpec({ numerator: '0.5' }), {})).toContainEqual(
      expect.stringMatching(/figure\.numerator: 0\.5 is not a whole number/i),
    );
  });

  it('reports a negative numerator', () => {
    expect(figureIssues(fractionSpec({ numerator: '-1' }), {})).toContainEqual(
      expect.stringMatching(/figure\.numerator: -1 is below zero/i),
    );
  });

  it('reports more shaded parts than the shape has', () => {
    expect(figureIssues(fractionSpec({ numerator: '5', denominator: '4' }), {})).toContainEqual(
      expect.stringMatching(/figure\.numerator: 5 is more parts than the 4/i),
    );
  });

  it('reports an unknown shape', () => {
    expect(figureIssues(fractionSpec({ shape: "'triangle'" }), {})).toContainEqual(
      expect.stringMatching(/figure\.shape.*not one of/i),
    );
  });

  it('reports a circle past MAX_CIRCLE_PARTS and accepts one at it', () => {
    expect(
      figureIssues(
        fractionSpec({ numerator: '1', denominator: String(MAX_CIRCLE_PARTS), shape: "'circle'" }),
        {},
      ),
    ).toEqual([]);
    expect(
      figureIssues(
        fractionSpec({
          numerator: '1',
          denominator: String(MAX_CIRCLE_PARTS + 1),
          shape: "'circle'",
        }),
        {},
      ),
    ).toContainEqual(expect.stringMatching(/circle.*over the 39/));
  });

  it('reports a strip past MAX_LINEAR_PARTS and accepts one at it', () => {
    expect(
      figureIssues(
        fractionSpec({ numerator: '1', denominator: String(MAX_LINEAR_PARTS), shape: "'strip'" }),
        {},
      ),
    ).toEqual([]);
    expect(
      figureIssues(
        fractionSpec({
          numerator: '1',
          denominator: String(MAX_LINEAR_PARTS + 1),
          shape: "'strip'",
        }),
        {},
      ),
    ).toContainEqual(expect.stringMatching(/strip.*over the 12/));
  });

  it('reports a rectangle pinned to a prime denominator', () => {
    expect(
      figureIssues(fractionSpec({ numerator: '1', denominator: '7', shape: "'rectangle'" }), {}),
    ).toContainEqual(expect.stringMatching(/rectangle.*no rows-by-columns split of 7/));
  });

  it('reports a rectangle pinned to a denominator with only too-oblong splits', () => {
    // 2 * 19 = 38: the only factor pair has a side of 19, over MAX_LINEAR_PARTS.
    expect(gridFactorPairs(38)).toEqual([]);
    expect(
      figureIssues(fractionSpec({ numerator: '1', denominator: '38', shape: "'rectangle'" }), {}),
    ).toContainEqual(expect.stringMatching(/rectangle.*no rows-by-columns split of 38/));
  });

  it('reports a denominator no shape can draw legibly when shape is omitted', () => {
    // 41 is prime and over MAX_CIRCLE_PARTS (39): circle and strip are both
    // over their caps, and rectangle has no factor pair for a prime at all -
    // so nothing can draw it, unlike e.g. 40 = 4 x 10, which a rectangle can.
    expect(gridFactorPairs(41)).toEqual([]);
    expect(
      figureIssues(fractionSpec({ numerator: '1', denominator: '41' }), {}),
    ).toContainEqual(expect.stringMatching(/more than any shape can draw legibly/));
  });

  it('reports denominator and numerator faults separately when both are wrong', () => {
    const issues = figureIssues(fractionSpec({ numerator: '-1', denominator: '1' }), {});
    expect(issues).toContainEqual(expect.stringMatching(/figure\.denominator.*under 2/i));
    expect(issues).toContainEqual(expect.stringMatching(/figure\.numerator.*below zero/i));
  });
});

describe('gridFactorPairs', () => {
  it('lists both orientations of every valid split', () => {
    expect(gridFactorPairs(12)).toEqual(
      expect.arrayContaining([[2, 6], [6, 2], [3, 4], [4, 3]]),
    );
  });

  it('is empty for a prime', () => {
    expect(gridFactorPairs(7)).toEqual([]);
  });

  it('excludes a split with a side over MAX_LINEAR_PARTS', () => {
    for (const [rows, columns] of gridFactorPairs(38)) {
      expect(Math.max(rows, columns)).toBeLessThanOrEqual(MAX_LINEAR_PARTS);
    }
  });
});
