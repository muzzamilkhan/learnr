import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { clamp, fieldReader } from './fields';
import { polygonModule } from './polygon-kind';
import { figureKindModule } from './registry';
import {
  FIGURE_BOX,
  FIGURE_KINDS,
  FIGURE_PRECISION,
  type Figure,
  type FigureSpec,
  type Mark,
  type Point,
} from './types';

export { fieldReader, type FieldReader } from './fields';

/**
 * Turning an authored `FigureSpec` into a drawing, and - separately, and only
 * at authoring time - saying what about that spec had to be clamped to get one.
 *
 * **`buildFigure` never throws.** It runs mid-session with a child waiting, so
 * an unknown shape name or a 400-degree angle degrades into something drawable,
 * exactly as `MAX_CHOICES` clamps a fifth option away rather than refusing the
 * question. `evaluate` *does* throw - on an unbound variable or a malformed
 * expression - and every call to it is caught. Reporting any of that is
 * `figureIssues`' job, which validation calls before content ships, and which
 * is the reason clamping quietly is safe: the mistake is caught, just not in
 * front of the child.
 *
 * **What each kind draws is the kind's own file** (`polygon-kind.ts`,
 * `angle-kind.ts`, and the rest, behind `registry.ts`). What is left here is
 * what every kind shares: the frame, the fit, and the two guards a spec has to
 * get past before any kind sees it.
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

export function buildFigure(spec: FigureSpec, scope: Scope, rng: Rng): Figure {
  // An unrecognised kind lands on the polygon path and, with no shape it knows,
  // on an equilateral triangle - the same fallback an unknown shape name gets,
  // because "something drawable" is the whole contract here. `?? {}` is the
  // same contract one step further out: every field below is read off the spec
  // and every one of them may be missing, so a spec that is missing entirely is
  // only the case where all of them are.
  const safe = (spec ?? {}) as FigureSpec;
  const kindModule = figureKindModule(safe.kind);
  return fit(
    kindModule
      ? kindModule.build(safe, scope, rng)
      : polygonModule.build(safe as Extract<FigureSpec, { kind: 'polygon' }>, scope, rng),
  );
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

function round(value: number): number {
  const factor = 10 ** FIGURE_PRECISION;
  // `+ 0` only to turn a -0 back into a 0, so two figures that are the same
  // drawing are also the same string.
  return Math.round(value * factor) / factor + 0;
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
 *
 * Two guards before any kind sees the spec, then the kind's own reading of its
 * own fields. The field-level wording is not the kind's: every kind is handed
 * the same `FieldReader`, so a missing field reads the same whether it is a
 * polygon's `shape` or a clock's `minutes`.
 */
export function figureIssues(spec: FigureSpec, scope: Scope): string[] {
  // Guarded here rather than left to the caller: this is the function that will
  // be handed content authored outside the app, where the rule is that an
  // authoring mistake is *reported* and never thrown - and "the figure is not
  // an object" is the first mistake such a file can make.
  if (typeof spec !== 'object' || spec === null || Array.isArray(spec)) {
    return ['figure must be an object'];
  }

  const kind = (spec as { kind?: unknown }).kind;

  if (typeof kind !== 'string' || !(FIGURE_KINDS as readonly string[]).includes(kind)) {
    return [
      `figure.kind: ${JSON.stringify(kind)} is not a figure kind` +
        ` (expected ${FIGURE_KINDS.join(' or ')})`,
    ];
  }

  const kindModule = figureKindModule(kind);
  // Unreachable while `registry.test.ts` passes - it insists every kind the
  // vocabulary names has a module. Said in words rather than thrown, because
  // this is still the function that must never throw at content.
  if (!kindModule) return [`figure.kind: ${JSON.stringify(kind)} has no builder`];

  // The reader writes into `fields`, which the kind cannot reach; what the kind
  // returns is what it judged about the values that read back clean. Assigned
  // before the spread, since `fields` is filled by the call.
  const fields: string[] = [];
  const own = kindModule.issues(spec, scope, fieldReader(scope, fields));
  return [...fields, ...own];
}
