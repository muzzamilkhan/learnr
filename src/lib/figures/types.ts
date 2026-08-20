/**
 * A question the child has to *look* at: the picture is the question and the
 * prompt is its caption. This file is the vocabulary - what an author writes
 * (`FigureSpec`) and what the builder resolves it into (`Figure`).
 *
 * The rule the whole feature exists to protect is that **no single diagram may
 * become the anchor for an answer**. If every obtuse angle is drawn the same
 * way, a child learns to recognise that picture rather than an obtuse angle,
 * and the analytics would call the topic secure while the wrong thing was
 * learned. So a figure is generated from the bound scope and the injected
 * `Rng`, like everything else here, and it **varies by default**: a template
 * pins the property the question is about and says nothing about rotation, size
 * or proportion. Omitting an optional parameter is what asks for jitter;
 * supplying one pins it, deliberately.
 */

/**
 * An expression string, evaluated against the scope the question was bound in -
 * exactly what `min`/`max` already are on a variable.
 *
 * Declared here rather than imported from `../templates/types`, which has the
 * identical declaration, because figures sit *below* templates: a template will
 * carry a `FigureSpec`, so a figure importing back up from templates would
 * close a module cycle. One shared line of `type Expr = string` is not worth
 * that, and the duplication is stated rather than accidental.
 */
export type Expr = string;

/**
 * A point in the resolved figure's box: x right, y **down**, which is what an
 * SVG renderer wants with no flipping of its own. The builder works in the
 * ordinary maths frame with y up - that is the frame rotations and symmetry
 * axes are named in - and turns it over once, on the way out.
 */
export type Point = readonly [number, number];

/**
 * The four primitives a figure is drawn from. Deliberately few: the renderer
 * (`src/components/diagram.tsx`) turns marks into SVG and makes no decisions, so
 * anything it has to know how to draw is a decision that has escaped `lib`.
 */
export type Mark =
  /** A polyline: the shape itself, a right-angle tick, a mirror line. */
  | { kind: 'path'; points: readonly Point[]; closed: boolean; fill: boolean; dashed: boolean }
  /**
   * Degrees, anticlockwise-positive, 0 = east - read the way the angle in the
   * question is read, not the way a y-down frame would count them. A renderer
   * places the sweep at `(cx + r·cos θ, cy − r·sin θ)`.
   */
  | { kind: 'arc'; at: Point; radius: number; from: number; to: number }
  /** A marked point - the vertex an angle is *at*, which the arms alone do not say. */
  | { kind: 'dot'; at: Point }
  /**
   * Text pinned to a point. No kind emits one yet; it is here because the kinds
   * this design defers - number lines, bar and picture graphs - are unreadable
   * without one, and the renderer is cheaper to write once than to extend.
   */
  | { kind: 'label'; at: Point; text: string };

/** A resolved figure: serialisable, comparable, and drawable by anything. */
export interface Figure {
  width: number;
  height: number;
  marks: readonly Mark[];
}

export const FIGURE_KINDS = ['polygon', 'angle'] as const;
export type FigureKind = (typeof FIGURE_KINDS)[number];

/**
 * The closed vocabulary of shape names. A count of sides would be less to
 * author with and not enough to author *from*: it cannot tell a rhombus from a
 * kite, and a randomly wobbled quadrilateral has no line of symmetry at all, so
 * a true/false symmetry question drawn that way would have no true case.
 */
export const POLYGON_SHAPES = [
  'equilateral',
  'isosceles',
  'scalene',
  'right-triangle',
  'square',
  'rectangle',
  'rhombus',
  'parallelogram',
  'trapezium',
  'kite',
  'pentagon',
  'hexagon',
  'heptagon',
  'octagon',
] as const;
export type PolygonShape = (typeof POLYGON_SHAPES)[number];

export type FigureSpec =
  | {
      kind: 'polygon';
      /** A name from `POLYGON_SHAPES`. */
      shape: Expr;
      /** Degrees anticlockwise. Omitted, it jitters over the whole turn. */
      rotation?: Expr;
      /**
       * Whether the dashed line drawn across the shape is a genuine axis of
       * symmetry. *Which* true axis, or which plausible wrong line, is the
       * builder's to vary - the template's own variable is what the answer
       * reads. Omitted, no line is drawn at all.
       */
      mirror?: Expr;
      /** Tick the corners that are square. Omitted, false. */
      rightAngles?: Expr;
    }
  | {
      kind: 'angle';
      /** The angle being asked about, clamped into 1-359. */
      degrees: Expr;
      /** Where the first arm points. Omitted, it jitters over the whole turn. */
      rotation?: Expr;
      /**
       * Both arms, the same length. Omitted, the two arms are jittered
       * separately - see `angleMarks` for why they must not match by default.
       */
      armLength?: Expr;
      /** Draw the sweep between the arms. Omitted, true. */
      arc?: Expr;
    };

/** The resolved box is this square, in whatever units the renderer scales it to. */
export const FIGURE_BOX = 100;

/**
 * Coordinates are rounded to this many places at build time. It keeps the JSON
 * stored beside an attempt small, and - the reason that matters - it makes two
 * figures comparable as strings, which is what the anchoring check needs to
 * tell "drawn afresh" from "drawn identically again".
 */
export const FIGURE_PRECISION = 2;
