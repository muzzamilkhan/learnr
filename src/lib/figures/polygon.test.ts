import { describe, expect, it } from 'vitest';
import { symmetryAxes, unitPolygon } from './polygon';
import { POLYGON_SHAPES, type Point, type PolygonShape } from './types';
import { createRng } from '../rng';

/**
 * Enough seeds that a shape which only *usually* keeps its name is caught. One
 * draw of an isosceles triangle proves nothing: the failure being guarded
 * against is the draw that happens to come out equilateral.
 */
const SEEDS = Array.from({ length: 60 }, (_, index) => `polygon-${index}`);

const draw = (shape: PolygonShape, seed: string) => unitPolygon(shape, createRng(seed));

/** The side lengths, in order round the shape. */
function sides(points: readonly Point[]): number[] {
  return points.map((point, index) => {
    const next = points[(index + 1) % points.length];
    return Math.hypot(next[0] - point[0], next[1] - point[1]);
  });
}

/** Twice the signed area - zero only if the vertices are collinear. */
function shoelace(points: readonly Point[]): number {
  return points.reduce((sum, [x, y], index) => {
    const [nx, ny] = points[(index + 1) % points.length];
    return sum + (x * ny - nx * y);
  }, 0);
}

/** How many pairs of sides are the same length, within a tolerance a child could see. */
function equalPairs(points: readonly Point[]): number {
  const lengths = sides(points);
  let pairs = 0;
  for (let a = 0; a < lengths.length; a++) {
    for (let b = a + 1; b < lengths.length; b++) {
      if (Math.abs(lengths[a] - lengths[b]) < 0.02 * lengths[a]) pairs++;
    }
  }
  return pairs;
}

/** Reflect a point in the line through the origin at `degrees`. */
function reflect([x, y]: Point, degrees: number): Point {
  const twice = (2 * degrees * Math.PI) / 180;
  const cos = Math.cos(twice);
  const sin = Math.sin(twice);
  return [x * cos + y * sin, x * sin - y * cos];
}

/** Does reflecting in this line land every vertex back on a vertex? */
function symmetricAbout(points: readonly Point[], degrees: number, tolerance = 1e-6): boolean {
  return points.every((point) => {
    const [rx, ry] = reflect(point, degrees);
    return points.some(([x, y]) => Math.hypot(x - rx, y - ry) < tolerance);
  });
}

describe('unitPolygon', () => {
  it('gives every name the number of corners the name promises', () => {
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
      for (const seed of SEEDS) expect(draw(shape, seed)).toHaveLength(corners[shape]);
    }
  });

  it('never draws a shape with no area to it', () => {
    for (const shape of POLYGON_SHAPES) {
      for (const seed of SEEDS) {
        expect(Math.abs(shoelace(draw(shape, seed)))).toBeGreaterThan(0.05);
      }
    }
  });

  it('keeps exactly two sides equal on an isosceles, and none on a scalene', () => {
    for (const seed of SEEDS) {
      expect(equalPairs(draw('isosceles', seed))).toBe(1);
      expect(equalPairs(draw('scalene', seed))).toBe(0);
    }
  });

  it('keeps a rectangle square-cornered, and a rectangle rather than a square', () => {
    for (const seed of SEEDS) {
      const points = draw('rectangle', seed);
      const lengths = sides(points);

      expect(corners(points).every((angle) => Math.abs(angle - 90) < 1e-6)).toBe(true);
      expect(Math.abs(lengths[0] - lengths[1])).toBeGreaterThan(0.1);
    }
  });

  it('keeps a rhombus four-sided-equal without letting it become a square', () => {
    for (const seed of SEEDS) {
      const points = draw('rhombus', seed);
      const lengths = sides(points);

      expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThan(1e-6);
      expect(corners(points).some((angle) => Math.abs(angle - 90) > 5)).toBe(true);
    }
  });

  it('gives a kite two pairs of equal neighbours and no more', () => {
    for (const seed of SEEDS) {
      // Two adjacent pairs equal, and the pairs unequal to each other: three
      // pairs' worth of equality would be a rhombus wearing the wrong name.
      expect(equalPairs(draw('kite', seed))).toBe(2);
    }
  });

  it('varies its proportions from seed to seed, so no one drawing is the shape', () => {
    for (const shape of ['isosceles', 'scalene', 'rectangle', 'kite', 'trapezium'] as const) {
      const drawings = SEEDS.slice(0, 12).map((seed) => JSON.stringify(draw(shape, seed)));
      expect(new Set(drawings).size).toBe(drawings.length);
    }
  });
});

/** The interior angles, in degrees, in vertex order. */
function corners(points: readonly Point[]): number[] {
  return points.map((point, index) => {
    const before = points[(index - 1 + points.length) % points.length];
    const after = points[(index + 1) % points.length];
    const u = [before[0] - point[0], before[1] - point[1]];
    const v = [after[0] - point[0], after[1] - point[1]];
    const cos = (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v));
    return (Math.acos(Math.min(1, Math.max(-1, cos))) * 180) / Math.PI;
  });
}

describe('symmetryAxes', () => {
  it('names lines the shape really is symmetric about', () => {
    for (const shape of POLYGON_SHAPES) {
      for (const seed of SEEDS.slice(0, 12)) {
        const points = draw(shape, seed);
        for (const axis of symmetryAxes(shape)) {
          expect(symmetricAbout(points, axis)).toBe(true);
        }
      }
    }
  });

  it('leaves out every line the shape is not symmetric about', () => {
    for (const shape of POLYGON_SHAPES) {
      const axes = symmetryAxes(shape);
      // The line furthest from anything claimed, which is where a wrong mirror
      // is drawn - if that one happened to be an axis, `mirror: 'false'` would
      // be drawing true lines.
      const clearance = (degrees: number) =>
        axes.length === 0 ? 90 : Math.min(...axes.map((axis) => gap(degrees, axis)));
      const candidates = Array.from({ length: 180 }, (_, degrees) => degrees);
      const probe = candidates.reduce((best, next) =>
        clearance(next) > clearance(best) ? next : best,
      );

      for (const seed of SEEDS.slice(0, 12)) {
        expect(symmetricAbout(draw(shape, seed), probe, 0.02)).toBe(false);
      }
    }
  });

  it('gives the shapes with no symmetry no axes at all', () => {
    expect(symmetryAxes('scalene')).toEqual([]);
    expect(symmetryAxes('parallelogram')).toEqual([]);
    expect(symmetryAxes('right-triangle')).toEqual([]);
  });

  it('gives a regular polygon one axis per side', () => {
    expect(symmetryAxes('equilateral')).toHaveLength(3);
    expect(symmetryAxes('square')).toHaveLength(4);
    expect(symmetryAxes('pentagon')).toHaveLength(5);
    expect(symmetryAxes('octagon')).toHaveLength(8);
  });
});

function gap(a: number, b: number): number {
  const between = (((a - b) % 180) + 180) % 180;
  return Math.min(between, 180 - between);
}
