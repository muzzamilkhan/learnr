import { evaluate, type Scope, type Value } from '../expr';
import type { Rng } from '../rng';
import { angleMarks } from './angle';
import { symmetryAxes, unitPolygon } from './polygon';
import {
  FIGURE_BOX,
  FIGURE_KINDS,
  FIGURE_PRECISION,
  POLYGON_SHAPES,
  type Expr,
  type Figure,
  type FigureSpec,
  type Mark,
  type Point,
  type PolygonShape,
} from './types';

/**
 * Turning an authored `FigureSpec` into a drawing, and - separately, and only
 * at authoring time - saying what about that spec had to be clamped to get one.
 *
 * **`buildFigure` never throws.** It runs mid-session with a child waiting, so
 * an unknown shape name or a 400-degree angle degrades into something drawable,
 * exactly as `MAX_CHOICES` clamps a fifth option away rather than refusing the
 * question. `evaluate` *does* throw - on an unbound variable or a malformed
 * expression - and every call to it here is caught. Reporting any of that is
 * `figureIssues`' job, which validation calls before content ships, and which
 * is the reason clamping quietly is safe: the mistake is caught, just not in
 * front of the child.
 *
 * The two halves of the coordinate system meet here. Shapes and angles are
 * built in the maths frame, y up, because that is the frame rotations and
 * symmetry axes are named in; `fit` scales the lot into the `FIGURE_BOX` square
 * and turns y over on the way out, so what a renderer receives needs no
 * flipping of its own. The scale is **uniform**, which is not a detail: a
 * separate x and y scale would fill the box more neatly and turn every square
 * into a rectangle doing it.
 */

/**
 * Kept clear inside the box, so a stroke drawn along the outline has somewhere
 * to be: the marks are lines with width, and a figure fitted to the very edge
 * of its box loses half that width to the clip.
 */
const PADDING = 6;

/** How long an angle's arms are drawn, before the fit rescales everything anyway. */
const ARM_BAND = [0.6, 1] as const;

/** Where a broken or missing `degrees` lands - still an angle, just not the asked one. */
const DEGREES_BAND = [15, 345] as const;

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

export function buildFigure(spec: FigureSpec, scope: Scope, rng: Rng): Figure {
  // An unrecognised kind lands on the polygon path and, with no shape it knows,
  // on an equilateral triangle - the same fallback an unknown shape name gets,
  // because "something drawable" is the whole contract here. `?? {}` is the
  // same contract one step further out: every field below is read off the spec
  // and every one of them may be missing, so a spec that is missing entirely is
  // only the case where all of them are.
  const safe = (spec ?? {}) as FigureSpec;
  return fit(
    safe.kind === 'angle' ? angleFigure(safe, scope, rng) : polygonFigure(safe, scope, rng),
  );
}

function polygonFigure(
  spec: Extract<FigureSpec, { kind: 'polygon' }>,
  scope: Scope,
  rng: Rng,
): Mark[] {
  const shape = shapeName(read(spec.shape, scope));
  const points = unitPolygon(shape, rng);
  const rotation = numberValue(read(spec.rotation, scope)) ?? jitter(rng, 0, 360);
  const turned = points.map((point) => rotate(point, rotation));

  const marks: Mark[] = [
    { kind: 'path', points: turned, closed: true, fill: false, dashed: false },
  ];

  if (truthy(read(spec.rightAngles, scope))) marks.push(...rightAngleTicks(turned));

  // Absent is the one state that draws nothing. Present and false is a
  // question with a false answer, which needs a line to be false *about*.
  const mirror = read(spec.mirror, scope);
  if (mirror !== undefined) {
    marks.push(mirrorLine(turned, symmetryAxes(shape), truthy(mirror), rotation, rng));
  }

  return marks;
}

function angleFigure(
  spec: Extract<FigureSpec, { kind: 'angle' }>,
  scope: Scope,
  rng: Rng,
): Mark[] {
  const asked = numberValue(read(spec.degrees, scope));
  const degrees = asked === undefined ? jitter(rng, ...DEGREES_BAND) : clamp(asked, 1, 359);
  const rotation = numberValue(read(spec.rotation, scope)) ?? jitter(rng, 0, 360);

  // A pinned arm length makes both arms that length - pinning is pinning. What
  // it really says is "the same", since the fit rescales the drawing and only
  // the ratio between the two arms survives it.
  const pinned = numberValue(read(spec.armLength, scope));
  const arms: [number, number] =
    pinned !== undefined && pinned > 0
      ? [pinned, pinned]
      : [jitter(rng, ...ARM_BAND), jitter(rng, ...ARM_BAND)];

  const arc = read(spec.arc, scope);
  return angleMarks(degrees, rotation, arms, arc === undefined ? true : truthy(arc));
}

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

/**
 * Scale and centre the marks into the box, turn y over, and round.
 *
 * Rounding is where `-0` has to be swept up, exactly as `photo/crop.ts` does:
 * the point of rounding is that two figures can be compared as strings, and
 * `-0` and `0` are the same coordinate written two ways.
 */
function fit(marks: readonly Mark[]): Figure {
  const bounds = boundsOf(marks);
  if (!bounds) return { width: FIGURE_BOX, height: FIGURE_BOX, marks: [] };

  const [minX, minY, maxX, maxY] = bounds;
  const span = Math.max(maxX - minX, maxY - minY);
  const scale = span > 0 ? (FIGURE_BOX - 2 * PADDING) / span : 1;
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;

  const place = ([x, y]: Point): Point => [
    round(clamp(FIGURE_BOX / 2 + (x - midX) * scale, 0, FIGURE_BOX)),
    // Minus, because the figure leaves here in screen coordinates: the one
    // flip lives at the boundary rather than in every shape above it.
    round(clamp(FIGURE_BOX / 2 - (y - midY) * scale, 0, FIGURE_BOX)),
  ];

  return {
    width: FIGURE_BOX,
    height: FIGURE_BOX,
    marks: marks.map((mark) =>
      mark.kind === 'arc'
        ? {
            ...mark,
            at: place(mark.at),
            radius: round(mark.radius * scale),
            from: round(mark.from),
            to: round(mark.to),
          }
        : mark.kind === 'path'
          ? { ...mark, points: mark.points.map(place) }
          : { ...mark, at: place(mark.at) },
    ),
  };
}

/** The box everything drawn occupies, or nothing at all if there is nothing to draw. */
function boundsOf(marks: readonly Mark[]): [number, number, number, number] | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const include = ([x, y]: Point, radius = 0) => {
    minX = Math.min(minX, x - radius);
    minY = Math.min(minY, y - radius);
    maxX = Math.max(maxX, x + radius);
    maxY = Math.max(maxY, y + radius);
  };

  for (const mark of marks) {
    // An arc is bounded by its whole circle rather than by its sweep. It gives
    // away a little room on a quarter turn, which costs a slightly smaller
    // drawing; measuring the sweep exactly would risk clipping the one mark
    // whose extent is not written down in its own points.
    if (mark.kind === 'arc') include(mark.at, mark.radius);
    else if (mark.kind === 'path') mark.points.forEach((point) => include(point));
    else include(mark.at);
  }

  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  return [minX, minY, maxX, maxY];
}

/**
 * The authoring-time companion: everything `buildFigure` would quietly clamp or
 * fall back on, in words. Called only by validation, which is what makes the
 * quiet clamping safe - and it takes no `Rng`, because it judges the spec and
 * the scope, not one of the drawings they can produce.
 */
export function figureIssues(spec: FigureSpec, scope: Scope): string[] {
  const issues: string[] = [];

  // Guarded here rather than left to the caller: this is the function that will
  // be handed content authored outside the app, where the rule is that an
  // authoring mistake is *reported* and never thrown - and "the figure is not
  // an object" is the first mistake such a file can make.
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
    return ['figure must be an object'];
  }

  const kind = (spec as { kind?: unknown }).kind;

  if (typeof kind !== 'string' || !(FIGURE_KINDS as readonly string[]).includes(kind)) {
    issues.push(
      `figure.kind: ${JSON.stringify(kind)} is not a figure kind` +
        ` (expected ${FIGURE_KINDS.join(' or ')})`,
    );
    return issues;
  }

  /**
   * Evaluate one field and say what went wrong with it: absent when it is
   * required, unevaluable, or the wrong type. Returns the value only when it is
   * the type asked for, so a caller can go on to judge the value itself.
   */
  const check = (
    expr: Expr | undefined,
    label: string,
    expected: 'number' | 'boolean' | 'string',
    required = false,
  ): Value | undefined => {
    if (expr === undefined || (typeof expr === 'string' && expr.trim() === '')) {
      if (required) issues.push(`${label} must be a non-empty expression string`);
      return undefined;
    }
    if (typeof expr !== 'string') {
      issues.push(`${label} must be a non-empty expression string`);
      return undefined;
    }
    let value: Value;
    try {
      value = evaluate(expr, scope);
    } catch (error) {
      issues.push(`${label}: ${(error as Error).message}`);
      return undefined;
    }
    if (typeof value !== expected) {
      issues.push(`${label}: expected ${expected}, got ${typeof value} (${JSON.stringify(value)})`);
      return undefined;
    }
    // **The one place the two halves of this module could disagree.** `NaN` is
    // a number to `typeof` and fails every comparison, so a `degrees` of `x / y`
    // with both zero passed both the type check and the range check and was
    // reported clean - while `buildFigure`, which needs a number it can draw,
    // threw it away and jittered an angle instead. That is the anchoring
    // failure this module exists to prevent, arriving through the door marked
    // "validated": a template asking whether an angle is acute, drawing an
    // angle unrelated to its own answer, differently on every seed. The
    // expression language does not guard division, so `0 / 0`, `mod(x, 0)` and
    // `sqrt(-1)` all arrive here looking like numbers.
    if (expected === 'number' && !Number.isFinite(value)) {
      issues.push(`${label}: ${String(value)} is not a number that can be drawn,` +
        ` so it would be ignored and a jittered value drawn instead`);
      return undefined;
    }
    return value;
  };

  if (kind === 'polygon') {
    const polygon = spec as Extract<FigureSpec, { kind: 'polygon' }>;
    const shape = check(polygon.shape, 'figure.shape', 'string', true);
    if (typeof shape === 'string' && !(POLYGON_SHAPES as readonly string[]).includes(shape)) {
      issues.push(
        `figure.shape: ${JSON.stringify(shape)} is not a known shape` +
          ` (expected one of ${POLYGON_SHAPES.join(', ')})`,
      );
    }
    check(polygon.rotation, 'figure.rotation', 'number');
    check(polygon.rightAngles, 'figure.rightAngles', 'boolean');

    const mirror = check(polygon.mirror, 'figure.mirror', 'boolean');
    const known =
      typeof shape === 'string' && (POLYGON_SHAPES as readonly string[]).includes(shape);
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
  } else {
    const angle = spec as Extract<FigureSpec, { kind: 'angle' }>;
    const degrees = check(angle.degrees, 'figure.degrees', 'number', true);
    if (typeof degrees === 'number' && (degrees < 1 || degrees > 359)) {
      issues.push(`figure.degrees: ${degrees} is outside 1-359 and would be clamped`);
    }
    const armLength = check(angle.armLength, 'figure.armLength', 'number');
    if (typeof armLength === 'number' && armLength <= 0) {
      issues.push(`figure.armLength: ${armLength} is not a length`);
    }
    check(angle.rotation, 'figure.rotation', 'number');
    check(angle.arc, 'figure.arc', 'boolean');
  }

  return issues;
}

/** Evaluate a field, or nothing at all: absent, malformed and unbound all read the same here. */
function read(expr: Expr | undefined, scope: Scope): Value | undefined {
  if (typeof expr !== 'string' || expr.trim() === '') return undefined;
  try {
    return evaluate(expr, scope);
  } catch {
    return undefined;
  }
}

function numberValue(value: Value | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** The same reading of truth the expression language itself uses. */
function truthy(value: Value | undefined): boolean {
  if (value === undefined) return false;
  return typeof value === 'boolean' ? value : Boolean(value);
}

function shapeName(value: Value | undefined): PolygonShape {
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

function jitter(rng: Rng, low: number, high: number): number {
  return low + rng.next() * (high - low);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function round(value: number): number {
  const factor = 10 ** FIGURE_PRECISION;
  // `+ 0` only to turn a -0 back into a 0, so two figures that are the same
  // drawing are also the same string.
  return Math.round(value * factor) / factor + 0;
}
