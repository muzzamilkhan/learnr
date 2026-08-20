import { describe, expect, it } from 'vitest';
import { angleMarks } from './angle';
import type { Mark, Point } from './types';

const arms = (marks: readonly Mark[]) => {
  const path = marks.find((mark) => mark.kind === 'path');
  if (path?.kind !== 'path') throw new Error('no arms were drawn');
  return path.points;
};

const bearing = ([x, y]: Point) => (((Math.atan2(y, x) * 180) / Math.PI) + 360) % 360;

describe('angleMarks', () => {
  it('draws two arms meeting at the vertex, with the vertex marked', () => {
    const marks = angleMarks(60, 0, [1, 1], false);
    const points = arms(marks);

    expect(points).toHaveLength(3);
    expect(points[1]).toEqual([0, 0]);
    expect(marks.some((mark) => mark.kind === 'dot')).toBe(true);
  });

  it('opens the arms by the angle asked for, wherever they are pointing', () => {
    for (const degrees of [15, 45, 90, 137, 270, 359]) {
      for (const rotation of [0, 37, 180, 300]) {
        const [first, , second] = arms(angleMarks(degrees, rotation, [1, 0.8], true));
        const opened = (bearing(second) - bearing(first) + 360) % 360;

        expect(opened).toBeCloseTo(degrees % 360, 6);
      }
    }
  });

  it('draws the arms at the two lengths it is given', () => {
    const [first, , second] = arms(angleMarks(70, 20, [1, 0.6], false));

    expect(Math.hypot(...first)).toBeCloseTo(1, 6);
    expect(Math.hypot(...second)).toBeCloseTo(0.6, 6);
  });

  it('sweeps the arc between the arms, inside the shorter of them', () => {
    const marks = angleMarks(70, 20, [1, 0.6], true);
    const arc = marks.find((mark) => mark.kind === 'arc');

    if (arc?.kind !== 'arc') throw new Error('no arc was drawn');
    expect(arc.from).toBe(20);
    expect(arc.to).toBe(90);
    expect(arc.radius).toBeLessThan(0.6);
  });

  it('leaves the arc out when it is not asked for', () => {
    expect(angleMarks(70, 20, [1, 0.6], false).some((mark) => mark.kind === 'arc')).toBe(false);
  });

  it('draws a right angle exactly like any other angle', () => {
    // No corner box, ever: it would answer "what kind of angle is this?" before
    // the child had looked at the picture.
    const square = angleMarks(90, 0, [1, 0.8], true);
    const oblique = angleMarks(70, 0, [1, 0.8], true);

    expect(square.map((mark) => mark.kind)).toEqual(oblique.map((mark) => mark.kind));
  });
});
