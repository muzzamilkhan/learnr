import { describe, expect, it } from 'vitest';

import { buildFigure } from '@/lib/figures/build';
import type { Mark } from '@/lib/figures/types';
import { createRng } from '@/lib/rng';

import { arcPath } from './diagram';

/**
 * `arcPath` is the one piece of the renderer that is arithmetic rather than
 * markup, and it is the place the figure's two coordinate frames meet: an arc's
 * centre `at` is in screen coordinates (y down, where `build.ts`'s `fit` left
 * it) while `from`/`to` are maths-frame degrees (anticlockwise, 0 = east). Two
 * reviewers have re-derived the minus in `pointOnArc` and the two SVG flags by
 * hand; this is so nobody has to do it a third time.
 *
 * **The geometry is asserted, never the string.** What matters is where the two
 * endpoints land and which way round SVG is told to walk between them, not how
 * many decimal places the numbers carry - so a change to formatting is not a
 * failure here, and a sign flip is.
 */

/**
 * The numbers out of `M x y A rx ry rotation largeArc sweep x y`, in that
 * order. Pulling them out with a number match rather than a shape match is
 * what keeps this test indifferent to spacing and to how many decimals the
 * coordinates happen to carry.
 */
function parseArc(d: string) {
  const numbers = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  expect(numbers).toHaveLength(9);
  const [startX, startY, rx, ry, rotation, largeArc, sweep, endX, endY] = numbers;
  return {
    start: [startX, startY] as const,
    radii: [rx, ry] as const,
    rotation,
    largeArc,
    sweep,
    end: [endX, endY] as const,
  };
}

/** How far a point sits from the arc's centre. */
function radiusFrom(at: readonly [number, number], point: readonly [number, number]) {
  return Math.hypot(point[0] - at[0], point[1] - at[1]);
}

/**
 * The maths-frame bearing of a point about the centre - the inverse of what
 * `pointOnArc` does, so a wrong sign on the y term shows up as a reflected
 * angle rather than as nothing at all. Normalised into 0-360.
 */
function bearingFrom(at: readonly [number, number], point: readonly [number, number]) {
  const degrees = (Math.atan2(at[1] - point[1], point[0] - at[0]) * 180) / Math.PI;
  return (degrees + 360) % 360;
}

function arcOf(at: readonly [number, number], radius: number, from: number, to: number) {
  const mark: Extract<Mark, { kind: 'arc' }> = { kind: 'arc', at: [at[0], at[1]], radius, from, to };
  return { mark, path: parseArc(arcPath(mark)) };
}

describe('arcPath', () => {
  it('starts on one arm and ends on the other, for the angle buildFigure draws', () => {
    // The worked example: 90 degrees, rotation pinned to 0, both arms 1. The
    // fit puts the vertex at [26.31, 73.69], the horizontal arm running right
    // to [94, 73.69] and the vertical one running up to [26.31, 6].
    const figure = buildFigure(
      { kind: 'angle', degrees: '90', rotation: '0', armLength: '1' },
      Object.create(null),
      createRng('arc-path-worked-example'),
    );

    const arms = figure.marks.find((mark) => mark.kind === 'path');
    const arc = figure.marks.find((mark) => mark.kind === 'arc');
    if (arms?.kind !== 'path' || arc?.kind !== 'arc') throw new Error('expected arms and an arc');

    expect(arms.points).toEqual([
      [94, 73.69],
      [26.31, 73.69],
      [26.31, 6],
    ]);
    expect(arc).toEqual({ kind: 'arc', at: [26.31, 73.69], radius: 20.31, from: 0, to: 90 });

    const path = parseArc(arcPath(arc));

    // On the horizontal arm: same y as the vertex, further right, at the arc's
    // own radius. This is the assertion the minus in `pointOnArc` is load
    // bearing for - drop it and the sweep leaves from below the vertex.
    expect(path.start[1]).toBeCloseTo(arc.at[1], 6);
    expect(path.start[0]).toBeGreaterThan(arc.at[0]);
    expect(radiusFrom(arc.at, path.start)).toBeCloseTo(arc.radius, 6);

    // On the vertical arm: same x as the vertex, above it - which in screen
    // coordinates means a *smaller* y.
    expect(path.end[0]).toBeCloseTo(arc.at[0], 6);
    expect(path.end[1]).toBeLessThan(arc.at[1]);
    expect(radiusFrom(arc.at, path.end)).toBeCloseTo(arc.radius, 6);

    expect(path.radii).toEqual([arc.radius, arc.radius]);
    expect(path.largeArc).toBe(0);
    expect(path.sweep).toBe(0);
  });

  it('puts both endpoints on the bearings it was given', () => {
    const { mark, path } = arcOf([40, 60], 12, 20, 110);

    expect(bearingFrom(mark.at, path.start)).toBeCloseTo(20, 6);
    expect(bearingFrom(mark.at, path.end)).toBeCloseTo(110, 6);
    expect(radiusFrom(mark.at, path.start)).toBeCloseTo(12, 6);
    expect(radiusFrom(mark.at, path.end)).toBeCloseTo(12, 6);
  });

  it('leaves the large-arc flag clear for a minor angle', () => {
    const { mark, path } = arcOf([50, 50], 15, 30, 75);

    expect(path.largeArc).toBe(0);
    expect(path.sweep).toBe(0);
    expect(bearingFrom(mark.at, path.start)).toBeCloseTo(30, 6);
    expect(bearingFrom(mark.at, path.end)).toBeCloseTo(75, 6);
  });

  it('sets the large-arc flag for a reflex angle', () => {
    const { mark, path } = arcOf([50, 50], 15, 0, 300);

    expect(path.largeArc).toBe(1);
    expect(path.sweep).toBe(0);
    expect(bearingFrom(mark.at, path.start)).toBeCloseTo(0, 6);
    expect(bearingFrom(mark.at, path.end)).toBeCloseTo(300, 6);
  });

  it('crosses 180 degrees without either endpoint moving', () => {
    // A sweep straddling due west, which is where a frame flip done half way
    // would show: 150 and 210 are mirror images about the horizontal, so
    // getting the sign wrong swaps them and the arc still looks plausible.
    const { mark, path } = arcOf([50, 50], 20, 150, 210);

    expect(path.largeArc).toBe(0);
    expect(path.sweep).toBe(0);
    expect(bearingFrom(mark.at, path.start)).toBeCloseTo(150, 6);
    expect(bearingFrom(mark.at, path.end)).toBeCloseTo(210, 6);
    // Above the centre going in, below it coming out - screen coordinates, so
    // "above" is the smaller y.
    expect(path.start[1]).toBeLessThan(mark.at[1]);
    expect(path.end[1]).toBeGreaterThan(mark.at[1]);
  });

  it('stays large and single-command for a near-full turn', () => {
    const { mark, path } = arcOf([50, 50], 18, 1, 359);

    expect(path.largeArc).toBe(1);
    expect(path.sweep).toBe(0);
    expect(bearingFrom(mark.at, path.start)).toBeCloseTo(1, 6);
    expect(bearingFrom(mark.at, path.end)).toBeCloseTo(359, 6);
  });

  it('flips the sweep flag when the arc walks backwards', () => {
    // Nothing `angleMarks` produces today has `to` below `from`, but the sign
    // is read rather than assumed, and a reader deserves to see which way that
    // falls before relying on it.
    const { mark, path } = arcOf([50, 50], 15, 90, 30);

    expect(path.sweep).toBe(1);
    expect(path.largeArc).toBe(0);
    expect(bearingFrom(mark.at, path.start)).toBeCloseTo(90, 6);
    expect(bearingFrom(mark.at, path.end)).toBeCloseTo(30, 6);
  });
});
