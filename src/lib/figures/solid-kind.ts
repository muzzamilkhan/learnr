import type { Scope } from '../expr';
import { createRng, type Rng } from '../rng';
import { jitter, numberValue, readField } from './fields';
import type { FigureKindModule } from './registry';
import type { FigureSpec, Mark, Point } from './types';

/**
 * The `solid` kind: a three-dimensional object, or the flat shape it folds up
 * from. It is the Space strand's other hole - a polygon covers what a shape
 * *is*, and nothing in the vocabulary could ask what a cube is, how many faces
 * it has, or which solid a net makes, because all three of those questions are
 * a picture rather than a sentence.
 *
 * Two views of the same solid, and they are drawn from the same name:
 *
 * - **`object`** - the solid itself, in an **oblique projection**: the face you
 *   look straight at is drawn at its true proportions in the picture plane, and
 *   everything behind it is that face shifted once, along a depth axis leaning
 *   up and to one side. Edges the solid hides from you are drawn dashed, which
 *   is what lets a child count all twelve of a cube's edges from a picture that
 *   only shows nine of them.
 * - **`net`** - the faces laid out flat and joined at their folds, every face
 *   drawn, nothing dashed.
 *
 * ---
 *
 * ## The anchoring case this kind carries
 *
 * A cube has **eleven** nets. "Which solid does this net fold into?" answered
 * `cube` must therefore not always show the cross: a child shown the cross
 * fifty times learns the cross, answers it right, and the analytics call the
 * topic secure while the thing that was learned is a picture. That is the worst
 * failure available here and it is the reason the whole feature is shaped the
 * way it is (`types.ts`).
 *
 * So `CUBE_NETS` is all eleven, not a favourite, and a cube's net picks one of
 * them, lays it one of the eight ways round a square can go, and turns the
 * whole thing. **Nothing about a cube's net is pinnable**, which is what makes
 * the anchoring rule hold even for the author who pins the rotation.
 *
 * The other solids have fewer nets - a square pyramid has essentially one, four
 * triangles round a square - so for them the notes' other technique does the
 * work: what varies is the **proportion**, which the answer does not fix. A
 * pyramid may be squat or steep, a cylinder tall or wide, a cone pointed or
 * broad, and a prism's cross-section sharp or shallow; a cylinder's two circles
 * may sit anywhere along the rectangle they roll off, a cone's base circle
 * anywhere along the arc it rolls off, and a prism's two ends flap off any of
 * its three sides. Every one of those is a free proportion or a free
 * arrangement of the solid the template named, so none of them can contradict
 * its answer.
 *
 * ---
 *
 * ## What may vary, and what may not
 *
 * The notes' test is to enumerate every quantity a question of this kind could
 * ask about and prove each is invariant under every jitter allowed. The list:
 *
 * - **Which solid it is.** Fixed by the name. The two ways a jitter could break
 *   it are guarded by construction: a cube's three edges are always equal (so
 *   the face you look straight at is always a square), and a cuboid's three are
 *   always **visibly** different (`cuboidEdges`, `MIN_CUBOID_RATIO`) - a cuboid
 *   jittered into equal edges is a cube under a question answered "cuboid".
 * - **How many faces, edges or vertices.** Topology, which no proportion or
 *   rotation touches. A net draws exactly the solid's faces, and an object
 *   draws every edge, the hidden ones dashed.
 * - **Whether the faces are flat or curved, and which shapes they are.** Fixed
 *   by the solid; the nets differ in arrangement, never in what a face is.
 * - **The mirror is presentation on top of a real lever, never the lever
 *   itself.** `flipped` negates x, and a sphere, a cone and a cylinder are all
 *   symmetric about that axis - so mirroring one gives back the same picture
 *   with its sample points in the other order, which `JSON.stringify` counts as
 *   a different figure and a child cannot tell apart at all. That is a way to
 *   pass the anchoring check while defeating the rule it enforces, and it is
 *   why the mirror is never what makes a solid vary: every solid here has a
 *   real lever underneath it - which of eleven nets, or a proportion the answer
 *   does not fix - and the mirror only ever adds to that. A kind that reaches
 *   for "mirror it" as the variation on a symmetric drawing has no lever at all.
 * - **Which view it is.** `view` is the one parameter a jitter can change that
 *   the *prompt* may already have committed to - "which solid does this net
 *   fold into?" is a question about a net. That is why a prompt naming the view
 *   must pin it, and it is said again on the field in `types.ts`. Nothing here
 *   can check it: `figureIssues` sees the figure, never the sentence beside it.
 *
 * **What is deliberately not askable**, because the drawing genuinely does not
 * say it: the *lengths* of a solid's edges. An oblique drawing foreshortens
 * depth by a convention rather than by measurement - here, a share of the
 * shortest side of the face the depth recedes behind, which is what keeps the
 * far corner behind the near face so the hidden edges are always the same three.
 * A question comparing a solid's depth with its width would be reading a
 * convention, so no such question can be authored honestly whatever this file
 * did, and pretending otherwise by drawing depth to scale would only hide that.
 *
 * ---
 *
 * ## A sphere has no net, and that is a fact rather than a gap
 *
 * A sphere's surface cannot be flattened - it is the one solid here that is not
 * developable, which is why every world map distorts something. So `view: 'net'`
 * on a sphere is an **authoring mistake** and is reported as one; `build`,
 * which runs mid-session with a child waiting, degrades it into the sphere
 * itself rather than drawing a fiction of one. The `view` jitter never offers a
 * net for such a solid either, since a coin toss between a drawing and nothing
 * is not a choice worth having.
 *
 * That is the same call `spinner` makes about a third colour: content this
 * vocabulary cannot draw is said out loud rather than drawn wrong.
 *
 * ---
 *
 * ## Every mark is a `path`, and there are never many of them
 *
 * A solid is line art: no fills (a figure has two appearances and there is
 * nothing here to tell apart by shading), no labels, no dots, no arcs - the
 * curved rims are sampled paths, which is what lets the same `movePoints` turn
 * and mirror the whole drawing in one place. Nothing in `labels.ts` applies,
 * for `spinner`'s reason: there is no text to leave room for.
 *
 * What is drawn is a property of the *solid*, never of anything a template
 * hands over, so there is no data that could grow the count. The largest
 * drawing here is seven marks against `MAX_MARKS`' two hundred, and there is
 * nothing to slice and no limit to report.
 */

type SolidSpec = Extract<FigureSpec, { kind: 'solid' }>;

/** The only mark kind this file emits. */
type Line = Extract<Mark, { kind: 'path' }>;

/** A point in the solid's own space: x right, y up, z away from the viewer. */
type Point3 = readonly [number, number, number];

/**
 * The closed vocabulary of solids, like `POLYGON_SHAPES` beside it and for the
 * same reason: a name is what an author can write and what a prompt can say,
 * and each of these is drawn by geometry of its own rather than by a rule over
 * a face count. Exported because the tests walk every one of them, and because
 * the message an unknown name gets is built from it.
 */
export const SOLIDS = [
  'cube',
  'cuboid',
  'sphere',
  'cone',
  'cylinder',
  'square-pyramid',
  'triangular-prism',
] as const;
export type SolidName = (typeof SOLIDS)[number];

const VIEWS = ['object', 'net'] as const;
type SolidView = (typeof VIEWS)[number];

/** The solids that cannot be unfolded flat. See the module comment. */
const NETLESS: readonly SolidName[] = ['sphere'];

/** Where a name nobody can draw lands - still a solid, just not the asked one. */
const FALLBACK_SOLID: SolidName = 'cube';

/**
 * How many points a whole turn of a curved rim is sampled at. Sixty is 6
 * degrees a step, which on a report thumbnail's ~28px radius bulges 0.04px
 * inside the true circle: a circle, not a polygon.
 */
const CURVE_POINTS = 60;

/**
 * Which way the depth axis leans, in degrees above the horizontal. It stays
 * under 56 for a reason the triangular prism sets: the far corner of a
 * triangular face is behind the near one only while the lean is shallower than
 * the face's own sides, and the shallowest side this file draws rises at
 * `2 * 0.75` to 1 - about 56.3 degrees.
 */
const LEAN_DEGREES: readonly [number, number] = [28, 55];

/**
 * How far the back of a solid sits from its front, as a share of the shortest
 * side of the face it recedes behind.
 *
 * **Under one, which is the whole proof that a far corner is always buried**:
 * the offset is no longer than the near face's shortest side, so neither of its
 * two components can reach past that face - whatever the lean is. A triangular
 * face needs the lean bounded as well, which is what `LEAN_DEGREES` is for. The
 * cost is that a solid is never drawn deeper than it is tall, so how *long* a
 * prism is is not something its object view says; its net says it instead.
 *
 * `fit` scales the drawing afterwards, so this is a proportion rather than a
 * size - varying a size would be varying nothing at all (`labels.ts`, lesson 2).
 */
const DEPTH_SHARE: readonly [number, number] = [0.35, 0.55];

const CUBOID_MIDDLE: readonly [number, number] = [0.62, 0.72];
const CUBOID_SHORT: readonly [number, number] = [0.3, 0.42];

/**
 * The closest two of a cuboid's edges are ever drawn, as a ratio. **Derived
 * from the ranges above rather than chosen**, so a range edited without
 * thinking moves the guarantee rather than quietly breaking it: it is the
 * tighter of the longest-to-middle and middle-to-shortest worst cases.
 *
 * It is exported because it is the whole of "a cuboid is not a cube" - the
 * question a jitter could otherwise answer wrongly, and one that cannot be read
 * off the finished drawing, since an oblique projection foreshortens the depth
 * by a convention of its own. `sectorAngles` is exported for the same reason.
 */
export const MIN_CUBOID_RATIO = Math.min(1 / CUBOID_MIDDLE[1], CUBOID_MIDDLE[0] / CUBOID_SHORT[1]);

/**
 * The eleven nets of a cube, as the grid cells each one fills - column right,
 * row down. Eleven is the whole answer up to turning and flipping, not a
 * selection, and they are listed rather than derived because the derivation is
 * a search over every hexomino: `solid-kind.test.ts` runs the folding
 * simulation over all eleven, which is the check that matters - a hexomino that
 * is *not* a net draws exactly as neatly as one that is, and nothing about the
 * picture would ever say so.
 *
 * Exported for that test, and because they are the anchoring answer: which one
 * a child sees is the whole reason a cube's net cannot be pinned to a picture.
 */
export const CUBE_NETS: readonly (readonly Point[])[] = [
  // A row of four with a flap above and below - six of the eleven, and the
  // family the cross belongs to.
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [1, 2]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [2, 2]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]],
  [[1, 0], [0, 1], [1, 1], [1, 2], [2, 2], [1, 3]],
  [[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]],
  // Two, three and one: three more.
  [[0, 0], [0, 1], [1, 1], [1, 2], [1, 3], [2, 3]],
  [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [1, 3]],
  [[0, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]],
  // The staircase, and the one made of two rows of three.
  [[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3]],
  [[0, 0], [0, 1], [0, 2], [1, 2], [1, 3], [1, 4]],
];

const radians = (degrees: number) => (degrees * Math.PI) / 180;

const seen = (points: readonly Point[], closed = false): Line => ({
  kind: 'path',
  points,
  closed,
  fill: false,
  dashed: false,
});

/** An edge the solid itself is in the way of. Never closed: it is always part of a face. */
const unseen = (points: readonly Point[]): Line => ({
  kind: 'path',
  points,
  closed: false,
  fill: false,
  dashed: true,
});

function movePoints(lines: readonly Line[], move: (point: Point) => Point): Line[] {
  return lines.map((line) => ({ ...line, points: line.points.map(move) }));
}

function turned([x, y]: Point, degrees: number): Point {
  const angle = radians(degrees);
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}

/**
 * A quarter turn, done by swapping coordinates rather than by `turned(90)`:
 * a cosine of 90 degrees is 6e-17 rather than 0, and four of the eight ways a
 * net can lie would each be a hair's breadth off the axis for no reason.
 */
function quarterTurned([x, y]: Point, quarters: number): Point {
  switch (((quarters % 4) + 4) % 4) {
    case 1:
      return [-y, x];
    case 2:
      return [-x, -y];
    case 3:
      return [y, -x];
    default:
      return [x, y];
  }
}

const flipped = ([x, y]: Point): Point => [-x, y];

/** Points on an ellipse, anticlockwise from east, both ends included. */
function arcPoints(
  [cx, cy]: Point,
  rx: number,
  ry: number,
  from: number,
  to: number,
): Point[] {
  const steps = Math.max(2, Math.round((Math.abs(to - from) / 360) * CURVE_POINTS));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = radians(from + ((to - from) * index) / steps);
    return [cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)] as Point;
  });
}

/** The whole rim, as a closed path. One sample short of a full turn, since it closes itself. */
function ring(centre: Point, rx: number, ry: number): Line {
  return seen(arcPoints(centre, rx, ry, 0, 360).slice(0, -1), true);
}

function rectangle(x: number, y: number, width: number, height: number): Point[] {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

/**
 * Whether a point is strictly inside a convex polygon - the test that finds the
 * corner a solid hides behind itself. Doing it rather than hard-coding "the far
 * bottom corner" is what keeps the dashed edges right for every proportion and
 * every lean, instead of for the ones that were drawn while it was written.
 */
function inside([px, py]: Point, polygon: readonly Point[]): boolean {
  if (polygon.length < 3) return false;
  let side = 0;
  for (let index = 0; index < polygon.length; index++) {
    const [ax, ay] = polygon[index];
    const [bx, by] = polygon[(index + 1) % polygon.length];
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    if (cross === 0) return false;
    const now = Math.sign(cross);
    if (side === 0) side = now;
    else if (side !== now) return false;
  }
  return true;
}

/** How far the back of a solid is drawn from its front, as one 2D offset. */
interface Depth {
  readonly x: number;
  readonly y: number;
}

function depthOf(rng: Rng, across: number): Depth {
  const lean = radians(jitter(rng, LEAN_DEGREES[0], LEAN_DEGREES[1]));
  const share = jitter(rng, DEPTH_SHARE[0], DEPTH_SHARE[1]) * across;
  return { x: share * Math.cos(lean), y: share * Math.sin(lean) };
}

/** `z` is a share of the whole depth, so 0 is the near face and 1 the far one. */
const project = ([x, y, z]: Point3, depth: Depth): Point => [x + z * depth.x, y + z * depth.y];

const shifted = (points: readonly Point[], depth: Depth): Point[] =>
  points.map(([x, y]): Point => [x + depth.x, y + depth.y]);

/**
 * A solid swept straight back from one face: a cuboid from a rectangle, a
 * triangular prism from a triangle. The far copy of the face has at most one
 * corner behind the near face, and that corner's three edges are the ones you
 * cannot see.
 *
 * If no corner is behind - which the ranges above are chosen to prevent, since
 * an offset shorter than the near face's shortest side always lands inside it -
 * every edge is drawn solid. That is an honest drawing rather than a wrong one,
 * and the test that every object hides exactly the edges it should is what
 * would say the ranges had drifted.
 */
function sweptLines(face: readonly Point[], depth: Depth): Line[] {
  const back = shifted(face, depth);
  const corners = face.length;
  const buried = back.findIndex((corner) => inside(corner, face));
  const lines: Line[] = [seen(face, true)];

  if (buried < 0) {
    lines.push(seen(back, true));
    return [...lines, ...face.map((corner, index) => seen([corner, back[index]]))];
  }

  const at = (offset: number) => back[(buried + offset + corners) % corners];
  lines.push(seen(Array.from({ length: corners - 1 }, (_, step) => at(step + 1))));
  lines.push(unseen([at(-1), at(0), at(1)]));

  return [
    ...lines,
    ...face.map((corner, index) =>
      index === buried ? unseen([corner, back[index]]) : seen([corner, back[index]]),
    ),
  ];
}

/**
 * A cuboid's three edges, longest first before they are dealt out to the axes.
 * **Exported because it is the whole of "this is a cuboid and not a cube"**:
 * every pair is at least `MIN_CUBOID_RATIO` apart, so no seed can draw one with
 * edges near enough to equal to answer a different question. Which axis gets
 * the longest edge is dealt out too, so a cuboid is tall on one seed and wide
 * on the next.
 */
export function cuboidEdges(rng: Rng): [number, number, number] {
  const edges = [
    1,
    jitter(rng, CUBOID_MIDDLE[0], CUBOID_MIDDLE[1]),
    jitter(rng, CUBOID_SHORT[0], CUBOID_SHORT[1]),
  ];
  const orders: readonly (readonly number[])[] = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const order = orders[rng.int(0, orders.length - 1)];
  return [edges[order[0]], edges[order[1]], edges[order[2]]];
}

/** The three edges of the named box: a cube's are equal, a cuboid's never are. */
function boxEdges(name: SolidName, rng: Rng): [number, number, number] {
  return name === 'cube' ? [1, 1, 1] : cuboidEdges(rng);
}

/**
 * Which two of the three edges you are looking straight at is a choice of its
 * own, so a cuboid is tall on one seed and wide on the next. **The third is not
 * drawn to scale and cannot be** - the depth is the convention the module
 * comment names, a share of the near face rather than a measurement - which is
 * also what keeps the far corner behind the near face on every seed.
 */
function boxObject(name: SolidName, rng: Rng): Line[] {
  const [width, height] = boxEdges(name, rng);
  return sweptLines(rectangle(0, 0, width, height), depthOf(rng, Math.min(width, height)));
}

/** Base one wide, apex over its middle: how tall is the free proportion. */
const PYRAMID_HEIGHT: readonly [number, number] = [0.85, 1.5];
/** How far the cross-section's apex sits above its base, as a share of the base. */
const PRISM_APEX: readonly [number, number] = [0.75, 1.05];
/** How long the prism is, as a share of its cross-section's base. Its net's, not its object's. */
const PRISM_LENGTH: readonly [number, number] = [0.8, 1.9];
const CYLINDER_HEIGHT: readonly [number, number] = [1.2, 2.4];
const CONE_HEIGHT: readonly [number, number] = [1.4, 2.6];
/**
 * How flat a circular rim looks from where the child is standing - the height
 * of the ellipse it is drawn as, against its width. A cone and a cylinder are
 * seen from a little above, never straight on, or their rims would be lines.
 */
const RIM_SQUASH: readonly [number, number] = [0.2, 0.38];

/**
 * The same, for the line round a sphere's middle. It has a range of its own and
 * a wider one, because it is **the only thing that varies about a sphere at
 * all**: a ball has no proportion, so where the child is standing is the whole
 * of what one seed can differ from the next by once the rotation is pinned.
 */
const SPHERE_SQUASH: readonly [number, number] = [0.16, 0.4];

/**
 * A pyramid net's slant height, as a share of the base. **Over a half, and that
 * floor is not taste**: four triangles shorter than half the square they stand
 * on cannot reach one another when they fold up, so the shape would not be a
 * net of anything.
 */
const PYRAMID_SLANT: readonly [number, number] = [0.62, 1.15];

/** How tall a cylinder's net is, against the radius of the circles rolling off it. */
const CYLINDER_NET_HEIGHT: readonly [number, number] = [1.6, 4];

/** How tall the cone a net folds into is, which is what sets the sector's angle. */
const CONE_NET_HEIGHT: readonly [number, number] = [1.2, 3];

/**
 * How far along the arc the base circle rolls off, as a share of the sweep
 * either side of its middle. Short of a half, so the circle is always attached
 * to the arc rather than balanced on one of its ends.
 */
const CONE_BASE_ALONG = 0.3;

function pyramidObject(rng: Rng): Line[] {
  const height = jitter(rng, PYRAMID_HEIGHT[0], PYRAMID_HEIGHT[1]);
  const depth = depthOf(rng, Math.min(1, height));
  const base = [
    project([0, 0, 0], depth),
    project([1, 0, 0], depth),
    project([1, 0, 1], depth),
    project([0, 0, 1], depth),
  ];
  const apex = project([0.5, height, 0.5], depth);

  // The far base corner is the one hidden behind the face you are looking at,
  // which is the triangle the near base edge and the apex make.
  const front = [base[0], base[1], apex];
  const buried = base.findIndex((corner, index) => index >= 2 && inside(corner, front));

  if (buried < 0) {
    return [seen(base, true), ...base.map((corner) => seen([corner, apex]))];
  }

  const at = (offset: number) => base[(buried + offset + base.length) % base.length];
  return [
    seen(Array.from({ length: base.length - 1 }, (_, step) => at(step + 1))),
    unseen([at(-1), at(0), at(1)]),
    ...base.map((corner, index) =>
      index === buried ? unseen([corner, apex]) : seen([corner, apex]),
    ),
  ];
}

/**
 * The triangular face at the front and the prism receding behind it. How long
 * the prism is drawn is the same convention the box takes, and for the same
 * reason: a depth past the near face's shortest side would leave the far corner
 * out in the open, and then three edges that are genuinely hidden would be
 * drawn as though you could see them. `PRISM_LENGTH` is the net's, where the
 * length is a real measurement laid flat on the page.
 */
function prismObject(rng: Rng): Line[] {
  const apex = jitter(rng, PRISM_APEX[0], PRISM_APEX[1]);
  const face: Point[] = [
    [0, 0],
    [1, 0],
    [0.5, apex],
  ];
  return sweptLines(face, depthOf(rng, Math.min(1, apex)));
}

function cylinderObject(rng: Rng): Line[] {
  const height = jitter(rng, CYLINDER_HEIGHT[0], CYLINDER_HEIGHT[1]);
  const squash = jitter(rng, RIM_SQUASH[0], RIM_SQUASH[1]);
  return [
    ring([0, height], 1, squash),
    // The near half of the bottom rim is the half below its widest points; the
    // far half is behind the cylinder itself.
    seen(arcPoints([0, 0], 1, squash, 180, 360)),
    unseen(arcPoints([0, 0], 1, squash, 0, 180)),
    seen([
      [-1, 0],
      [-1, height],
    ]),
    seen([
      [1, 0],
      [1, height],
    ]),
  ];
}

function coneObject(rng: Rng): Line[] {
  const height = jitter(rng, CONE_HEIGHT[0], CONE_HEIGHT[1]);
  const squash = jitter(rng, RIM_SQUASH[0], RIM_SQUASH[1]);
  // The sloping sides touch the base rim, and where they touch is not its
  // widest point: squash the picture back into a circle, take the tangent from
  // the apex, and squash the answer again. Drawing them to the widest points
  // instead puts a visible kink where the side meets the rim.
  const reach = height / squash;
  const touch = (Math.atan2(1 / reach, Math.sqrt(reach * reach - 1) / reach) * 180) / Math.PI;
  const right: Point = [Math.cos(radians(touch)), squash * Math.sin(radians(touch))];
  const left: Point = [-right[0], right[1]];
  const apex: Point = [0, height];

  return [
    seen(arcPoints([0, 0], 1, squash, 180 - touch, 360 + touch)),
    unseen(arcPoints([0, 0], 1, squash, touch, 180 - touch)),
    seen([apex, right]),
    seen([apex, left]),
  ];
}

function sphereObject(rng: Rng): Line[] {
  const squash = jitter(rng, SPHERE_SQUASH[0], SPHERE_SQUASH[1]);
  return [
    ring([0, 0], 1, 1),
    // The line round the middle is what says this is a ball rather than a
    // circle, and its near half is the half you can see.
    seen(arcPoints([0, 0], 1, squash, 180, 360)),
    unseen(arcPoints([0, 0], 1, squash, 0, 180)),
  ];
}

function objectLines(name: SolidName, rng: Rng): Line[] {
  switch (name) {
    case 'cube':
    case 'cuboid':
      return boxObject(name, rng);
    case 'square-pyramid':
      return pyramidObject(rng);
    case 'triangular-prism':
      return prismObject(rng);
    case 'cylinder':
      return cylinderObject(rng);
    case 'cone':
      return coneObject(rng);
    case 'sphere':
      return sphereObject(rng);
  }
}

function cubeNet(rng: Rng): Line[] {
  const cells = CUBE_NETS[rng.int(0, CUBE_NETS.length - 1)];
  // The table counts rows downwards and this frame counts y upwards, which
  // costs a minus and nothing else: a net turned over is still that net.
  return cells.map(([column, row]) => seen(rectangle(column, -row, 1, 1), true));
}

/**
 * A cuboid's net: the four faces round one axis in a row, with the two ends
 * flapped off any of them. Which axis the band runs round is a choice of its
 * own, so the same cuboid unrolls three ways before the flaps are placed.
 */
function cuboidNet(rng: Rng): Line[] {
  const edges = cuboidEdges(rng);
  const axis = rng.int(0, 2);
  const along = edges[axis];
  const [first, second] = edges.filter((_, index) => index !== axis);
  const widths = [first, second, first, second];
  const lefts = widths.map((_, index) => widths.slice(0, index).reduce((sum, w) => sum + w, 0));
  // The flap on a face of width `first` is the end face the other way round.
  const flap = (index: number) => (index % 2 === 0 ? second : first);

  const above = rng.int(0, 3);
  const below = rng.int(0, 3);

  return [
    ...widths.map((width, index) => seen(rectangle(lefts[index], 0, width, along), true)),
    seen(rectangle(lefts[above], along, widths[above], flap(above)), true),
    seen(rectangle(lefts[below], -flap(below), widths[below], flap(below)), true),
  ];
}

/**
 * Four triangles round a square, which is the only way this net is drawn - a
 * pyramid has nothing like a cube's eleven. `PYRAMID_SLANT` is what varies, and
 * with the rotation pinned it is the only thing that does; it is enough,
 * because it is continuous and every seed lands somewhere different in it.
 */
function pyramidNet(rng: Rng): Line[] {
  const slant = jitter(rng, PYRAMID_SLANT[0], PYRAMID_SLANT[1]);
  return [
    seen(rectangle(0, 0, 1, 1), true),
    seen([[0, 0], [1, 0], [0.5, -slant]], true),
    seen([[1, 0], [1, 1], [1 + slant, 0.5]], true),
    seen([[1, 1], [0, 1], [0.5, 1 + slant]], true),
    seen([[0, 1], [0, 0], [-slant, 0.5]], true),
  ];
}

/**
 * Three rectangles in a row with a triangle flapped off two of them - which two
 * is free, and so are the cross-section's shape and the prism's length.
 *
 * The triangle on a band face is placed by its own side lengths rather than
 * copied and turned: the face of width `sides[k]` folds up to the edge between
 * corners k and k+1, so the apex is the third corner, `sides[k+2]` from the
 * left end and `sides[k+1]` from the right. Getting that the wrong way round
 * draws a triangle the same size that does not fold.
 */
function prismNet(rng: Rng): Line[] {
  const apex = jitter(rng, PRISM_APEX[0], PRISM_APEX[1]);
  const long = jitter(rng, PRISM_LENGTH[0], PRISM_LENGTH[1]);
  const leg = Math.hypot(0.5, apex);
  const sides = [1, leg, leg];
  const lefts = sides.map((_, index) => sides.slice(0, index).reduce((sum, side) => sum + side, 0));

  const cap = (index: number, up: boolean): Line => {
    const base = sides[index];
    const fromLeft = sides[(index + 2) % 3];
    const fromRight = sides[(index + 1) % 3];
    const x = (base * base + fromLeft * fromLeft - fromRight * fromRight) / (2 * base);
    const y = Math.sqrt(Math.max(fromLeft * fromLeft - x * x, 0));
    const foot = up ? long : 0;
    return seen(
      [
        [lefts[index], foot],
        [lefts[index] + base, foot],
        [lefts[index] + x, up ? foot + y : -y],
      ],
      true,
    );
  };

  return [
    ...sides.map((side, index) => seen(rectangle(lefts[index], 0, side, long), true)),
    cap(rng.int(0, 2), true),
    cap(rng.int(0, 2), false),
  ];
}

/**
 * The curved face unrolls into a rectangle exactly as wide as the rim is long,
 * and the two ends roll off it anywhere along their edges. Both of those are
 * why this net is so much wider than it is tall: a rim is a bit over six times
 * its own radius, and no drawing choice can make that squarer.
 */
function cylinderNet(rng: Rng): Line[] {
  const width = 2 * Math.PI;
  const height = jitter(rng, CYLINDER_NET_HEIGHT[0], CYLINDER_NET_HEIGHT[1]);
  return [
    seen(rectangle(0, 0, width, height), true),
    ring([jitter(rng, 1, width - 1), height + 1], 1, 1),
    ring([jitter(rng, 1, width - 1), -1], 1, 1),
  ];
}

/**
 * A sector and a circle. The sector's angle is not free: its arc has to be
 * exactly as long as the base circle's rim, so it is the base's circumference
 * over the slant height, and how pointed the cone is is what moves it.
 */
function coneNet(rng: Rng): Line[] {
  const height = jitter(rng, CONE_NET_HEIGHT[0], CONE_NET_HEIGHT[1]);
  const slant = Math.hypot(1, height);
  const sweep = 360 / slant;
  const from = 90 - sweep / 2;
  const along = 90 + jitter(rng, -CONE_BASE_ALONG, CONE_BASE_ALONG) * sweep;
  const centre: Point = [
    (slant + 1) * Math.cos(radians(along)),
    (slant + 1) * Math.sin(radians(along)),
  ];

  return [
    seen([[0, 0], ...arcPoints([0, 0], slant, slant, from, from + sweep)], true),
    ring(centre, 1, 1),
  ];
}

function netLines(name: SolidName, rng: Rng): Line[] {
  switch (name) {
    case 'cube':
      return cubeNet(rng);
    case 'cuboid':
      return cuboidNet(rng);
    case 'square-pyramid':
      return pyramidNet(rng);
    case 'triangular-prism':
      return prismNet(rng);
    case 'cylinder':
      return cylinderNet(rng);
    case 'cone':
      return coneNet(rng);
    // A sphere is never asked for a net: `viewOf` refuses to jitter into one
    // and turns a pinned one into the object, which is the sphere itself.
    case 'sphere':
      return sphereObject(rng);
  }
}

const named = (value: unknown): SolidName | undefined =>
  typeof value === 'string' && (SOLIDS as readonly string[]).includes(value)
    ? (value as SolidName)
    : undefined;

const viewNamed = (value: unknown): SolidView | undefined =>
  typeof value === 'string' && (VIEWS as readonly string[]).includes(value)
    ? (value as SolidView)
    : undefined;

export const solidModule: FigureKindModule<'solid'> = {
  kind: 'solid',

  // Only the solid is required - it is the question. Omitting `view` is what
  // asks for the object and the net to jitter between them, and omitting
  // `rotation` is what asks for the turn to jitter.
  fields: {
    solid: 'required',
    view: 'optional',
    rotation: 'optional',
  },

  build(spec: SolidSpec, scope: Scope, rng: Rng): Mark[] {
    // **One value off the question's own `Rng`, expanded into a stream of its
    // own.** `generate` threads a single `Rng` through `tryBind`, `buildFigure`
    // and `buildChoices`, so a figure that took a different number of values
    // for a cube's net than for a sphere would reshuffle the distractors of the
    // very question it illustrates - and adding `view: 'net'` to a template
    // would silently change that template's own choices. Everything below draws
    // from the private stream, so this kind's appetite is one, always.
    const stream = createRng(`solid-${rng.next()}`);

    const name = named(readField(spec.solid, scope)) ?? FALLBACK_SOLID;
    const asked = viewNamed(readField(spec.view, scope));
    const view: SolidView = NETLESS.includes(name)
      ? 'object'
      : (asked ?? (stream.next() < 0.5 ? 'object' : 'net'));

    const drawn = view === 'net' ? netLines(name, stream) : objectLines(name, stream);

    // A net has no upright, so all eight ways round a square are open to it; an
    // object has one, and only the side its depth leans towards is free. Both
    // are lifted out of the turn below because a mirror is not a rotation, and
    // because a quarter turn done exactly beats one done in cosines.
    const flip = stream.next() < 0.5;
    const quarters = view === 'net' ? stream.int(0, 3) : 0;
    const placed = movePoints(drawn, (point) =>
      quarterTurned(flip ? flipped(point) : point, quarters),
    );

    // Drawn last, so a pinned rotation leaves everything above it untouched.
    const rotation = numberValue(readField(spec.rotation, scope)) ?? jitter(stream, 0, 360);
    return movePoints(placed, (point) => turned(point, rotation));
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const raw = read(spec.solid, 'figure.solid', 'string', true);
    const name = named(raw);
    if (typeof raw === 'string' && !name) {
      issues.push(
        `figure.solid: ${JSON.stringify(raw)} is not a solid` +
          ` (expected one of ${SOLIDS.join(', ')})`,
      );
    }

    const rawView = read(spec.view, 'figure.view', 'string');
    const view = viewNamed(rawView);
    if (typeof rawView === 'string' && !view) {
      issues.push(
        `figure.view: ${JSON.stringify(rawView)} is not a view` +
          ` (expected ${VIEWS.join(' or ')})`,
      );
    }

    read(spec.rotation, 'figure.rotation', 'number');

    // One fault, one message: whether a thing has a net is only a question
    // about a thing that is a solid at all, so a name nobody knows is reported
    // once rather than twice.
    if (name && view === 'net' && NETLESS.includes(name)) {
      issues.push(
        `figure.solid: a ${name} cannot be unfolded flat, so there is no net to draw` +
          ' - the object itself would be drawn instead',
      );
    }

    return issues;
  },
};
