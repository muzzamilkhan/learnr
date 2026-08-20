import type { Mark, Point } from './types';

/**
 * An angle: a vertex, two arms, and the sweep between them.
 *
 * In the maths frame the rest of this folder works in - x right, y up, degrees
 * anticlockwise from east - and at whatever scale the caller likes, since
 * `buildFigure` fits the whole drawing into the box afterwards. What survives
 * that fit is not the arm lengths but the *ratio* between them, which is the
 * only reason they are two numbers.
 *
 * **The arms are deliberately unequal.** Two arms the same length every time is
 * an anchor of exactly the kind this feature exists to avoid, and it feeds a
 * misconception ACARA names outright: children read a longer pair of arms as a
 * bigger angle. Drawing the same angle with a long arm and a short one, then
 * with two middling ones, is what says the arms are not the measurement.
 *
 * **There is never a right-angle square.** A little box in the corner is how a
 * right angle is conventionally marked, and it would answer "what kind of angle
 * is this?" before the child had looked at it - the same reason the play
 * screen's header counts nothing. A right angle here is drawn like any other
 * and has to be recognised.
 */

/** How far out the sweep is drawn, as a share of the shorter arm. */
const ARC_SHARE = 0.3;

export function angleMarks(
  degrees: number,
  rotation: number,
  armLength: readonly [number, number],
  arc: boolean,
): Mark[] {
  const [first, second] = armLength;
  const start = rotation;
  const end = rotation + degrees;

  const marks: Mark[] = [
    {
      kind: 'path',
      // One polyline through the vertex rather than two segments meeting there:
      // the corner is the thing being asked about, and a join drawn twice is a
      // join that can be drawn twice differently.
      points: [along(start, first), [0, 0], along(end, second)],
      closed: false,
      fill: false,
      dashed: false,
    },
    // The arms alone do not say which end is the corner - at a glance a shallow
    // angle is two lines that happen to cross.
    { kind: 'dot', at: [0, 0] },
  ];

  if (arc) {
    // Inside the shorter arm, so the sweep never runs off the end of the thing
    // it is measuring between.
    marks.push({
      kind: 'arc',
      at: [0, 0],
      radius: Math.min(first, second) * ARC_SHARE,
      from: start,
      to: end,
    });
  }

  return marks;
}

function along(degrees: number, distance: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return [Math.cos(radians) * distance, Math.sin(radians) * distance];
}
