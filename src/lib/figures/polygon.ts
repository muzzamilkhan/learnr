import type { Point, PolygonShape } from './types';
import type { Rng } from '../rng';

/**
 * The named shapes, and where their lines of symmetry are.
 *
 * Pure and tested here rather than eyeballed in a component, for the reason
 * `photo/crop.ts` and `chart/axis-labels.ts` give: it is geometry, and geometry
 * checked by looking at it is checked once, on one screen, by someone who
 * already knows what it is meant to be. The tests reflect a shape in the axes
 * this file claims and insist the vertices land back on themselves.
 *
 * **Every shape is jittered, within what keeps its name true.** That is the
 * anchoring rule made arithmetic: a rectangle varies its aspect but stays a
 * rectangle, an isosceles triangle varies its apex and base but keeps exactly
 * two sides equal, a scalene keeps all three unequal. A child who sees the same
 * rectangle every time learns that picture rather than the property, and the
 * report would call it secure.
 *
 * The regular shapes - `equilateral`, `square`, `pentagon` through `octagon` -
 * are the exception, and honestly so: their proportions are fixed by the name,
 * so there is nothing left to vary but size and rotation. Size does not survive
 * the fit into the box, which is uniform, so their whole variation is the
 * rotation the builder supplies. That is why `rotation` jitters by default and
 * pinning it is the deliberate act.
 *
 * Everything here is in the ordinary maths frame: x right, y up, angles
 * anticlockwise from east. Vertices come back centred on their own mean, which
 * is the centre every axis of symmetry passes through - a reflection permutes
 * the vertices, so it fixes their mean.
 */

/** A number somewhere in [low, high). */
function jitter(rng: Rng, low: number, high: number): number {
  return low + rng.next() * (high - low);
}

/** One of two bands, so a value can be kept clear of the one that changes the name. */
function eitherBand(rng: Rng, band: readonly [number, number], other: readonly [number, number]) {
  const [low, high] = rng.next() < 0.5 ? band : other;
  return jitter(rng, low, high);
}

/** Vertices of a regular n-gon on the unit circle, the first at `start` degrees. */
function regular(sides: number, start: number): Point[] {
  return Array.from({ length: sides }, (_, index) => {
    const angle = ((start + (360 * index) / sides) * Math.PI) / 180;
    return [Math.cos(angle), Math.sin(angle)] as Point;
  });
}

/**
 * A triangle from its three side lengths, laid on its base. Built this way
 * rather than by moving a vertex around because the property that must survive
 * the jitter - two sides equal, or all three unequal - is a fact about the
 * lengths, and drawing from the lengths makes it true by construction instead
 * of by rejection.
 */
function triangle(base: number, left: number, right: number): Point[] {
  const x = (left * left - right * right + base * base) / (2 * base);
  const y = Math.sqrt(Math.max(0, left * left - x * x));
  return [
    [0, 0],
    [base, 0],
    [x, y],
  ];
}

/** Shift a shape so its vertex mean sits on the origin, where its axes cross. */
function centred(points: readonly Point[]): Point[] {
  const mx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const my = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  return points.map(([x, y]) => [x - mx, y - my] as Point);
}

export function unitPolygon(shape: PolygonShape, rng: Rng): Point[] {
  return centred(vertices(shape, rng));
}

function vertices(shape: PolygonShape, rng: Rng): Point[] {
  switch (shape) {
    case 'equilateral':
      return regular(3, 90);
    case 'square':
      // From 45 degrees, so the square sits square on the page before rotation.
      return regular(4, 45);
    case 'pentagon':
      return regular(5, 90);
    case 'hexagon':
      return regular(6, 90);
    case 'heptagon':
      return regular(7, 90);
    case 'octagon':
      return regular(8, 90);

    case 'isosceles': {
      // The legs are equal by construction; what has to be watched is the base
      // accidentally joining them. A leg is `sqrt(b² + h²)` against a base of
      // `2b`, so the two meet at `h = √3·b` - the equilateral - and the height
      // is drawn from a band either side of it rather than across it.
      const half = jitter(rng, 0.35, 0.75);
      const height = eitherBand(rng, [0.7 * half, 1.3 * half], [2 * half, 3 * half]);
      const leg = Math.hypot(half, height);
      return triangle(2 * half, leg, leg);
    }

    case 'scalene': {
      // Three lengths from three bands that do not overlap, so no two can come
      // out equal, and whose worst case still clears the triangle inequality by
      // a wide margin - a scalene that draws itself as a sliver is a scalene
      // nobody can see the three unequal sides of.
      const shortest = 1;
      const middle = jitter(rng, 1.2, 1.4);
      const longest = jitter(rng, 1.55, 1.8);
      return triangle(longest, shortest, middle);
    }

    case 'right-triangle': {
      // The legs are kept unequal on purpose: equal legs are an isosceles right
      // triangle, which has a line of symmetry, and `symmetryAxes` answers per
      // name - it cannot say "sometimes".
      const other = eitherBand(rng, [0.45, 0.8], [1.25, 2]);
      return [
        [0, 0],
        [1, 0],
        [0, other],
      ];
    }

    case 'rectangle': {
      const short = jitter(rng, 0.35, 0.75);
      // Upright as often as it is laid down. Rotation would eventually get
      // there, but an author who pinned rotation to 0 would only ever see one.
      const [w, h] = rng.next() < 0.5 ? [1, short] : [short, 1];
      return [
        [-w, -h],
        [w, -h],
        [w, h],
        [-w, h],
      ];
    }

    case 'rhombus': {
      // Diagonals along the axes, which is how a rhombus is drawn and where its
      // two lines of symmetry are. They are kept unequal so it is not a square.
      const other = eitherBand(rng, [0.45, 0.8], [1.25, 1.8]);
      return [
        [1, 0],
        [0, other],
        [-1, 0],
        [0, -other],
      ];
    }

    case 'parallelogram': {
      // A slanted rectangle. The slant is never zero, so it is never a
      // rectangle, and the bands keep the slanted side shorter than the base,
      // so it is never a rhombus either - both of which have symmetry this one
      // is defined by not having.
      const half = jitter(rng, 0.4, 0.7);
      const slant = jitter(rng, 0.3, 0.55);
      return [
        [-1 - slant, -half],
        [1 - slant, -half],
        [1 + slant, half],
        [-1 + slant, half],
      ];
    }

    case 'trapezium': {
      // Always isosceles, and that is a decision rather than a shortcut:
      // `symmetryAxes` is pure and keyed by name, so a trapezium that had an
      // axis on some draws and not others would make "is the dashed line a line
      // of symmetry?" a question with no knowable answer.
      const top = jitter(rng, 0.3, 0.7);
      const half = jitter(rng, 0.35, 0.7);
      return [
        [-1, -half],
        [1, -half],
        [top, half],
        [-top, half],
      ];
    }

    case 'kite': {
      // Two pairs of adjacent equal sides: the vertical diagonal is the axis,
      // and the two halves of it differ so the kite is not a rhombus.
      const top = jitter(rng, 0.8, 1.2);
      const bottom = jitter(rng, 0.35, 0.6);
      const half = jitter(rng, 0.4, 0.7);
      return [
        [0, top],
        [half, 0],
        [0, -bottom],
        [-half, 0],
      ];
    }
  }
}

/**
 * The angles, in degrees in the shape's own unrotated frame, of every line of
 * symmetry - normalised into [0, 180), because a line at 210 degrees and a line
 * at 30 are the same line.
 *
 * This is what lets `mirror: 'true'` draw a real axis and `mirror: 'false'` draw
 * a plausible wrong one, so it has to agree with `unitPolygon` exactly rather
 * than approximately: a shape whose claimed axis is a degree off would make the
 * true case of a symmetry question quietly false.
 */
export function symmetryAxes(shape: PolygonShape): number[] {
  switch (shape) {
    case 'equilateral':
      return regularAxes(3, 90);
    case 'square':
      return regularAxes(4, 45);
    case 'pentagon':
      return regularAxes(5, 90);
    case 'hexagon':
      return regularAxes(6, 90);
    case 'heptagon':
      return regularAxes(7, 90);
    case 'octagon':
      return regularAxes(8, 90);

    // The one axis is the vertical: the apex over the middle of the base, the
    // long diagonal of the kite, the line between the two parallel sides.
    case 'isosceles':
    case 'trapezium':
    case 'kite':
      return [90];

    // Both diagonals of a rhombus, and both midlines of a rectangle.
    case 'rectangle':
    case 'rhombus':
      return [0, 90];

    // None, by definition - and `right-triangle` joins them because its legs
    // are drawn unequal.
    case 'scalene':
    case 'right-triangle':
    case 'parallelogram':
      return [];
  }
}

/**
 * A regular n-gon has n axes. With an odd number of sides each runs from a
 * vertex to the middle of the side opposite, so the axes are the vertices
 * themselves as lines; with an even number they come in two interleaved sets -
 * vertex to vertex and side to side - which is the same thing as a half step.
 */
function regularAxes(sides: number, start: number): number[] {
  const step = sides % 2 === 0 ? 180 / sides : 360 / sides;
  const axes = Array.from({ length: sides }, (_, index) => normaliseAxis(start + step * index));
  return [...new Set(axes)].sort((a, b) => a - b);
}

/** A line has no direction, so every axis angle folds into [0, 180). */
function normaliseAxis(degrees: number): number {
  return ((degrees % 180) + 180) % 180;
}
