import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import {
  FIGURE_BOX,
  POLYGON_SHAPES,
  type Figure,
  type FigureSpec,
  type Point,
  type PolygonShape,
} from './types';
import { createRng } from '../rng';

const build = (spec: FigureSpec, seed: string, scope = {}) =>
  buildFigure(spec, scope, createRng(seed));

const SEEDS = Array.from({ length: 12 }, (_, index) => `figure-${index}`);

/** The shape itself: the one closed path, which is always drawn first. */
function outline(figure: Figure): readonly Point[] {
  const path = figure.marks.find((mark) => mark.kind === 'path' && mark.closed);
  if (path?.kind !== 'path') throw new Error('nothing was drawn');
  return path.points;
}

function dashed(figure: Figure): readonly Point[] | undefined {
  const path = figure.marks.find((mark) => mark.kind === 'path' && mark.dashed);
  return path?.kind === 'path' ? path.points : undefined;
}

function every(figure: Figure): number[] {
  return figure.marks.flatMap((mark) =>
    mark.kind === 'path'
      ? mark.points.flat()
      : mark.kind === 'arc'
        ? [...mark.at, mark.radius, mark.from, mark.to]
        : [...mark.at],
  );
}

/** Reflect a point in the line through `a` and `b`. */
function reflect([x, y]: Point, [ax, ay]: Point, [bx, by]: Point): Point {
  const length = Math.hypot(bx - ax, by - ay);
  const dx = (bx - ax) / length;
  const dy = (by - ay) / length;
  const along = (x - ax) * dx + (y - ay) * dy;
  return [2 * (ax + along * dx) - x, 2 * (ay + along * dy) - y];
}

/** Does the dashed line map the shape back onto itself - is it really an axis? */
function mirrorsTheShape(figure: Figure, tolerance = 0.2): boolean {
  const line = dashed(figure);
  if (!line) throw new Error('no mirror line was drawn');
  return outline(figure).every((point) => {
    const [rx, ry] = reflect(point, line[0], line[1]);
    return outline(figure).some(([x, y]) => Math.hypot(x - rx, y - ry) < tolerance);
  });
}

describe('buildFigure', () => {
  it('draws every shape in the vocabulary, with the corners its name promises', () => {
    const corners: Record<PolygonShape, number> = {
      equilateral: 3,
      isosceles: 3,
      scalene: 3,
      'right-triangle': 3,
      square: 4,
      rectangle: 4,
      rhombus: 4,
      parallelogram: 4,
      trapezium: 4,
      kite: 4,
      pentagon: 5,
      hexagon: 6,
      heptagon: 7,
      octagon: 8,
    };

    for (const shape of POLYGON_SHAPES) {
      for (const seed of SEEDS) {
        expect(outline(build({ kind: 'polygon', shape: `'${shape}'` }, seed))).toHaveLength(
          corners[shape],
        );
      }
    }
  });

  it('reads its parameters out of the bound scope', () => {
    const figure = build({ kind: 'polygon', shape: 'name' }, 'scope', { name: 'hexagon' });
    expect(outline(figure)).toHaveLength(6);

    const angle = build({ kind: 'angle', degrees: 'a + b' }, 'scope', { a: 100, b: 35 });
    const arc = angle.marks.find((mark) => mark.kind === 'arc');
    if (arc?.kind !== 'arc') throw new Error('no arc was drawn');
    expect(arc.to - arc.from).toBeCloseTo(135, 1);
  });

  it('keeps every coordinate finite and inside the box', () => {
    const specs: FigureSpec[] = [
      { kind: 'polygon', shape: "'octagon'", mirror: 'true', rightAngles: 'true' },
      { kind: 'polygon', shape: "'rectangle'", mirror: 'false', rightAngles: 'true' },
      { kind: 'angle', degrees: '359' },
      { kind: 'angle', degrees: '1' },
    ];

    for (const spec of specs) {
      for (const seed of SEEDS) {
        for (const value of every(build(spec, seed))) {
          expect(Number.isFinite(value)).toBe(true);
        }
        for (const mark of build(spec, seed).marks) {
          const points = mark.kind === 'path' ? mark.points : [mark.at];
          for (const [x, y] of points) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(FIGURE_BOX);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(FIGURE_BOX);
          }
        }
      }
    }
  });

  it('replays exactly from the same seed', () => {
    const spec: FigureSpec = { kind: 'polygon', shape: "'kite'", mirror: 'true' };
    expect(build(spec, 'again')).toEqual(build(spec, 'again'));
  });

  it('draws a different picture on every seed, which is the whole point', () => {
    // The anchoring rule: a child who is shown the same obtuse angle every time
    // learns that picture, not the property - and the report calls it secure.
    // Every shape, not a hand-picked few: the rule is the point of the feature,
    // and a subset chosen once stops being representative the moment a shape
    // changes how it jitters.
    const specs: FigureSpec[] = [
      ...POLYGON_SHAPES.map((shape): FigureSpec => ({ kind: 'polygon', shape: `'${shape}'` })),
      { kind: 'angle', degrees: '120' },
    ];

    for (const spec of specs) {
      const drawings = SEEDS.map((seed) => JSON.stringify(build(spec, seed)));
      expect(new Set(drawings).size).toBe(drawings.length);
    }
  });

  it('holds still when the author pins what varies', () => {
    const pinned: FigureSpec = { kind: 'polygon', shape: "'square'", rotation: '0' };
    const drawings = SEEDS.map((seed) => JSON.stringify(build(pinned, seed)));

    expect(new Set(drawings).size).toBe(1);
  });

  it('draws a true mirror on a real axis and a false one nowhere near it', () => {
    for (const seed of SEEDS) {
      for (const shape of ['square', 'kite', 'rectangle', 'isosceles', 'trapezium'] as const) {
        const truly = build({ kind: 'polygon', shape: `'${shape}'`, mirror: 'true' }, seed);
        const falsely = build({ kind: 'polygon', shape: `'${shape}'`, mirror: 'false' }, seed);

        expect(mirrorsTheShape(truly)).toBe(true);
        expect(mirrorsTheShape(falsely)).toBe(false);
      }
    }
  });

  it('draws no line at all when the mirror is left out', () => {
    for (const seed of SEEDS) {
      expect(dashed(build({ kind: 'polygon', shape: "'square'" }, seed))).toBeUndefined();
    }
  });

  it('ticks the corners that are square, and only when asked', () => {
    const ticks = (figure: Figure) =>
      figure.marks.filter((mark) => mark.kind === 'path' && !mark.closed && !mark.dashed).length;

    for (const seed of SEEDS) {
      const ticked = (shape: string, rightAngles?: string) =>
        ticks(build({ kind: 'polygon', shape: `'${shape}'`, rightAngles }, seed));

      expect(ticked('rectangle', 'true')).toBe(4);
      expect(ticked('right-triangle', 'true')).toBe(1);
      expect(ticked('scalene', 'true')).toBe(0);
      expect(ticked('rectangle')).toBe(0);
    }
  });

  it('clamps an impossible angle instead of refusing to draw one', () => {
    const sweep = (spec: FigureSpec, seed: string) => {
      const arc = build(spec, seed).marks.find((mark) => mark.kind === 'arc');
      if (arc?.kind !== 'arc') throw new Error('no arc was drawn');
      return arc.to - arc.from;
    };

    expect(sweep({ kind: 'angle', degrees: '400' }, 'clamp')).toBeCloseTo(359, 1);
    expect(sweep({ kind: 'angle', degrees: '0' }, 'clamp')).toBeCloseTo(1, 1);
    expect(sweep({ kind: 'angle', degrees: '-90' }, 'clamp')).toBeCloseTo(1, 1);
  });

  it('never throws, whatever the spec says', () => {
    const nonsense: FigureSpec[] = [
      { kind: 'polygon', shape: "'trapazoid'" },
      { kind: 'polygon', shape: 'unbound' },
      { kind: 'polygon', shape: "'scalene'", mirror: 'true' },
      { kind: 'polygon', shape: "'square'", rotation: 'x +' },
      { kind: 'angle', degrees: '400' },
      { kind: 'angle', degrees: 'nonsense' },
      { kind: 'angle', degrees: '90', armLength: '0' },
      { kind: 'angle', degrees: '90', armLength: "'long'" },
      { kind: 'blob' } as unknown as FigureSpec,
    ];

    for (const spec of nonsense) {
      for (const seed of SEEDS.slice(0, 4)) {
        const figure = build(spec, seed);
        expect(figure.marks.length).toBeGreaterThan(0);
        expect(every(figure).every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('draws something even when handed no spec at all', () => {
    expect(() => build(null as unknown as FigureSpec, 'nothing')).not.toThrow();
  });

  it('falls back to a triangle when it cannot tell what shape was meant', () => {
    expect(outline(build({ kind: 'polygon', shape: "'trapazoid'" }, 'fallback'))).toHaveLength(3);
    expect(outline(build({ kind: 'polygon', shape: 'unbound' }, 'fallback'))).toHaveLength(3);
  });

  it('draws a mirror on a shape with no axes rather than none at all', () => {
    // A clamp, and the reason `figureIssues` exists: the template is wrong, but
    // it is wrong at authoring time, not in front of the child.
    const figure = build({ kind: 'polygon', shape: "'scalene'", mirror: 'true' }, 'clamped');

    expect(dashed(figure)).toBeDefined();
    expect(mirrorsTheShape(figure)).toBe(false);
  });
});

describe('figureIssues', () => {
  it('says nothing about a spec that needs no clamping', () => {
    expect(figureIssues({ kind: 'polygon', shape: "'square'", mirror: 'true' }, {})).toEqual([]);
    expect(
      figureIssues({ kind: 'polygon', shape: 'name', rotation: 'r' }, { name: 'kite', r: 30 }),
    ).toEqual([]);
    expect(figureIssues({ kind: 'angle', degrees: 'd', arc: 'false' }, { d: 135 })).toEqual([]);
  });

  it('refuses to throw on something that is not a figure at all', () => {
    // The one function here that will be handed content written outside the
    // app, where an authoring mistake is reported and never thrown.
    expect(figureIssues(null as unknown as FigureSpec, {})).toEqual(['figure must be an object']);
    expect(figureIssues('polygon' as unknown as FigureSpec, {})).toEqual([
      'figure must be an object',
    ]);
  });

  it('names a number that arithmetic has made undrawable', () => {
    // `0 / 0` is a number to `typeof` and fails every range comparison, so this
    // is the one way a spec could read as clean and still be drawn at random.
    const nan = figureIssues({ kind: 'angle', degrees: 'x / y' }, { x: 0, y: 0 });
    expect(nan).toHaveLength(1);
    expect(nan[0]).toContain('NaN');

    const infinite = figureIssues({ kind: 'angle', degrees: 'x / y' }, { x: 1, y: 0 });
    expect(infinite.join()).toContain('Infinity');
    // And it says what actually happens, which is not clamping.
    expect(infinite.join()).not.toContain('clamped');

    expect(figureIssues({ kind: 'polygon', shape: "'square'", rotation: 'x / y' }, { x: 0, y: 0 }))
      .toHaveLength(1);
    expect(
      figureIssues({ kind: 'angle', degrees: '90', armLength: 'sqrt(0 - 1)' }, {}),
    ).toHaveLength(1);
  });

  it('names a wrong mirror the shape has no room to draw', () => {
    // A heptagon's seven axes leave a wrong line about twelve degrees off a
    // real one, which is not a question about symmetry any more.
    expect(figureIssues({ kind: 'polygon', shape: "'octagon'", mirror: 'false' }, {}).join())
      .toContain('too near');
    expect(figureIssues({ kind: 'polygon', shape: "'heptagon'", mirror: 'false' }, {}).join())
      .toContain('too near');

    // A hexagon is where that stops, and a shape with two axes has all the room
    // in the world - as does a true mirror on any of them.
    expect(figureIssues({ kind: 'polygon', shape: "'hexagon'", mirror: 'false' }, {})).toEqual([]);
    expect(figureIssues({ kind: 'polygon', shape: "'square'", mirror: 'false' }, {})).toEqual([]);
    expect(figureIssues({ kind: 'polygon', shape: "'octagon'", mirror: 'true' }, {})).toEqual([]);
  });

  it('names an unknown kind', () => {
    const issues = figureIssues({ kind: 'blob' } as unknown as FigureSpec, {});
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('figure.kind');
  });

  it('names an unknown shape', () => {
    const issues = figureIssues({ kind: 'polygon', shape: "'trapazoid'" }, {}).join();
    expect(issues).toContain('trapazoid');
  });

  it('names an expression it cannot evaluate', () => {
    expect(figureIssues({ kind: 'polygon', shape: 'missing' }, {}).join()).toContain('missing');
    expect(figureIssues({ kind: 'angle', degrees: 'x +' }, { x: 1 }).join()).toContain(
      'figure.degrees',
    );
  });

  it('names an expression of the wrong type', () => {
    expect(figureIssues({ kind: 'polygon', shape: '4' }, {}).join()).toContain('expected string');
    expect(figureIssues({ kind: 'polygon', shape: "'square'", mirror: '1' }, {}).join()).toContain(
      'expected boolean',
    );
  });

  it('names an angle outside what can be drawn', () => {
    expect(figureIssues({ kind: 'angle', degrees: '400' }, {}).join()).toContain('outside 1-359');
    expect(figureIssues({ kind: 'angle', degrees: '0' }, {}).join()).toContain('outside 1-359');
  });

  it('names a true mirror asked of a shape that has no symmetry', () => {
    const asked = figureIssues({ kind: 'polygon', shape: "'scalene'", mirror: 'true' }, {});
    expect(asked.join()).toContain('no line of symmetry');
    expect(figureIssues({ kind: 'polygon', shape: "'scalene'", mirror: 'false' }, {})).toEqual([]);
  });

  it('insists on the field a kind cannot be drawn without', () => {
    const polygon = figureIssues({ kind: 'polygon' } as unknown as FigureSpec, {});
    const angle = figureIssues({ kind: 'angle' } as unknown as FigureSpec, {});

    expect(polygon.join()).toContain('figure.shape');
    expect(angle.join()).toContain('figure.degrees');
  });
});
