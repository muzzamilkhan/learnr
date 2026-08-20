import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { jitter, numberValue, readField, truthy } from './fields';
import { symmetryAxes, unitPolygon } from './polygon';
import type { FigureKindModule } from './registry';
import {
  POLYGON_SHAPES,
  type FigureSpec,
  type Mark,
  type Point,
  type PolygonShape,
} from './types';

/**
 * The `polygon` kind: a named shape, turned, optionally ticked at its square
 * corners and optionally crossed by a line that is or is not an axis of
 * symmetry.
 *
 * Its drawing and its authoring rules sit together here, which is the point of
 * the registry: whether `mirror: 'false'` is a fair question of an octagon is
 * decided by the same `bestClearance` the drawing uses to place the wrong line.
 */

type PolygonSpec = Extract<FigureSpec, { kind: 'polygon' }>;

/** A right-angle tick, as a share of the shorter of the two edges meeting there. */
const TICK_SHARE = 0.15;

/**
 * How far a mirror line runs past the shape it crosses, as a share of the
 * shape's own size. It is an overhang on top of what the shape actually
 * occupies *along that line* rather than a multiple of the whole shape: the fit
 * scales everything drawn, so a line measured against the widest part of the
 * shape rather than the part it crosses shrinks the shape to make room for
 * daylight nobody asked for.
 */
const MIRROR_OVERHANG = 0.12;

/** Two edges are square when their directions are this close to perpendicular. */
const SQUARE_ENOUGH = 1e-6;

/**
 * How near the best available angle a candidate mirror line has to be to count
 * as "not an axis". A share rather than a fixed number of degrees because the
 * room available depends on the shape: a rectangle has 45 degrees of daylight
 * between its axes and an octagon has 11, and a fixed tolerance wide enough to
 * mean anything on the rectangle is unsatisfiable on the octagon.
 */
const OFF_AXIS_SHARE = 0.8;

/**
 * The daylight a shape has to leave between its axes before `mirror: 'false'`
 * is a fair question, in degrees.
 *
 * The wrong line is drawn as far from every axis as the shape allows, and how
 * far that is falls as the axes multiply: a regular polygon's axes are `180/n`
 * apart, so the best any line can do is `90/n`. Fifteen degrees is a hexagon's,
 * which makes this "no rounder than a hexagon" - but it is written as the angle
 * rather than as a list of shapes, so a shape added later is judged by its own
 * geometry rather than by whether somebody remembered to add it.
 *
 * The warning exists because the alternative is a question with no answerable
 * difference on the screen. A heptagon with a line twelve degrees off an axis
 * is not a child failing to see symmetry; it is a picture that does not contain
 * the answer, and it would be marked wrong either way.
 */
const WRONG_MIRROR_CLEARANCE = 15;

export const polygonModule: FigureKindModule<'polygon'> = {
  kind: 'polygon',

  // The shape is the only thing a polygon cannot be drawn without. Leaving the
  // other three out is the deliberate act: an omitted `rotation` jitters over
  // the whole turn, and an omitted `mirror` draws no line at all.
  fields: {
    shape: 'required',
    rotation: 'optional',
    mirror: 'optional',
    rightAngles: 'optional',
  },

  build(spec: PolygonSpec, scope: Scope, rng: Rng): Mark[] {
    const shape = shapeName(readField(spec.shape, scope));
    const points = unitPolygon(shape, rng);
    const rotation = numberValue(readField(spec.rotation, scope)) ?? jitter(rng, 0, 360);
    const turned = points.map((point) => rotate(point, rotation));

    const marks: Mark[] = [
      { kind: 'path', points: turned, closed: true, fill: false, dashed: false },
    ];

    if (truthy(readField(spec.rightAngles, scope))) marks.push(...rightAngleTicks(turned));

    // Absent is the one state that draws nothing. Present and false is a
    // question with a false answer, which needs a line to be false *about*.
    const mirror = readField(spec.mirror, scope);
    if (mirror !== undefined) {
      marks.push(mirrorLine(turned, symmetryAxes(shape), truthy(mirror), rotation, rng));
    }

    return marks;
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const shape = read(spec.shape, 'figure.shape', 'string', true);
    read(spec.rotation, 'figure.rotation', 'number');
    read(spec.rightAngles, 'figure.rightAngles', 'boolean');
    const mirror = read(spec.mirror, 'figure.mirror', 'boolean');

    const known =
      typeof shape === 'string' && (POLYGON_SHAPES as readonly string[]).includes(shape);

    if (typeof shape === 'string' && !known) {
      issues.push(
        `figure.shape: ${JSON.stringify(shape)} is not a known shape` +
          ` (expected one of ${POLYGON_SHAPES.join(', ')})`,
      );
    }

    const axes = known ? symmetryAxes(shape as PolygonShape) : [];
    const named = known ? `${/^[aeiou]/.test(String(shape)) ? 'an' : 'a'} ${shape}` : '';

    if (mirror === true && known && axes.length === 0) {
      issues.push(
        `figure.mirror: ${named} has no line of symmetry, so no true mirror can be drawn`,
      );
    }
    if (mirror === false && known && bestClearance(axes) < WRONG_MIRROR_CLEARANCE) {
      issues.push(
        `figure.mirror: ${named} has ${axes.length} lines of symmetry, so a wrong one can` +
          ` only be ${Math.round(bestClearance(axes))} degrees off a real axis - too near for` +
          ` a child to see the difference`,
      );
    }

    return issues;
  },
};

/**
 * A tick at every corner that is square, drawn as a three-point open path -
 * two short steps in along the edges and the corner between them. Which corners
 * those are is read off the geometry rather than kept in a table per shape, so
 * a square, a rectangle and a right triangle all get theirs from the same four
 * lines, and a shape that stops having one stops being ticked.
 */
function rightAngleTicks(points: readonly Point[]): Mark[] {
  const marks: Mark[] = [];

  for (let index = 0; index < points.length; index++) {
    const corner = points[index];
    const before = points[(index - 1 + points.length) % points.length];
    const after = points[(index + 1) % points.length];

    const toBefore = difference(before, corner);
    const toAfter = difference(after, corner);
    const lengthBefore = Math.hypot(...toBefore);
    const lengthAfter = Math.hypot(...toAfter);
    if (lengthBefore === 0 || lengthAfter === 0) continue;

    const u: Point = [toBefore[0] / lengthBefore, toBefore[1] / lengthBefore];
    const v: Point = [toAfter[0] / lengthAfter, toAfter[1] / lengthAfter];
    if (Math.abs(u[0] * v[0] + u[1] * v[1]) > SQUARE_ENOUGH) continue;

    const step = TICK_SHARE * Math.min(lengthBefore, lengthAfter);
    marks.push({
      kind: 'path',
      points: [
        [corner[0] + u[0] * step, corner[1] + u[1] * step],
        [corner[0] + (u[0] + v[0]) * step, corner[1] + (u[1] + v[1]) * step],
        [corner[0] + v[0] * step, corner[1] + v[1] * step],
      ],
      closed: false,
      fill: false,
      dashed: false,
    });
  }

  return marks;
}

/**
 * The dashed line across the shape: a real axis of symmetry, or a plausible
 * wrong one. Which of the true axes, and which of the wrong lines, is the
 * builder's to vary - a symmetry question whose true case always drew the
 * vertical would teach the picture rather than the property.
 *
 * A shape with no axes asked for a true mirror is a clamp, not a refusal: it
 * gets a wrong line like any other, and `figureIssues` says so at authoring
 * time, where somebody can fix the template.
 */
function mirrorLine(
  points: readonly Point[],
  axes: readonly number[],
  wanted: boolean,
  rotation: number,
  rng: Rng,
): Mark {
  const angle = (wanted && axes.length > 0 ? rng.pick(axes) : offAxis(axes, rng)) + rotation;
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const crossed = Math.max(...points.map(([x, y]) => Math.abs(x * cos + y * sin)), 0);
  const size = Math.max(...points.map((point) => Math.hypot(...point)), 0);
  const half = crossed + size * MIRROR_OVERHANG;
  const step: Point = [cos * half, sin * half];

  return {
    kind: 'path',
    points: [
      [-step[0], -step[1]],
      [step[0], step[1]],
    ],
    closed: false,
    fill: false,
    dashed: true,
  };
}

/**
 * An angle as far from every axis as the shape allows, jittered among the
 * candidates that come close to it. Asking for "at least n degrees off" would
 * be unanswerable for an octagon, whose axes are 22.5 degrees apart; asking for
 * the roomiest angle available is answerable for every shape, and for a shape
 * with no axes at all it is simply any angle.
 */
function offAxis(axes: readonly number[], rng: Rng): number {
  if (axes.length === 0) return jitter(rng, 0, 180);

  const best = bestClearance(axes);
  return rng.pick(
    CANDIDATE_LINES.filter((degrees) => clearanceAt(degrees, axes) >= best * OFF_AXIS_SHARE),
  );
}

/** Every line worth considering, to the degree. */
const CANDIDATE_LINES = Array.from({ length: 180 }, (_, degrees) => degrees);

/** How far one line is from the nearest axis - 90, the most there is, when there are none. */
function clearanceAt(degrees: number, axes: readonly number[]): number {
  return axes.length === 0 ? 90 : Math.min(...axes.map((axis) => separation(degrees, axis)));
}

/** The most daylight any line can find between a shape's axes. */
function bestClearance(axes: readonly number[]): number {
  return Math.max(...CANDIDATE_LINES.map((degrees) => clearanceAt(degrees, axes)));
}

/** How far apart two lines are, in degrees - never more than 90, since a line has no direction. */
function separation(a: number, b: number): number {
  const gap = (((a - b) % 180) + 180) % 180;
  return Math.min(gap, 180 - gap);
}

function shapeName(value: unknown): PolygonShape {
  return typeof value === 'string' && (POLYGON_SHAPES as readonly string[]).includes(value)
    ? (value as PolygonShape)
    : 'equilateral';
}

function rotate([x, y]: Point, degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return [x * cos - y * sin, x * sin + y * cos];
}

function difference(to: Point, from: Point): Point {
  return [to[0] - from[0], to[1] - from[1]];
}
