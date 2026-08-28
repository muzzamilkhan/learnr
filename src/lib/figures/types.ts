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
   * Text pinned to a point. It was here before anything emitted one, because
   * the kinds the first pass deferred - bar and picture graphs, number lines,
   * clock faces - are unreadable without one and a renderer is cheaper to
   * write once than to extend. Five of them emit one now - `bar`, `pictograph`,
   * `number-line`, `clock` and `grid` - and what a label costs the geometry
   * around it is `labels.ts`.
   */
  | { kind: 'label'; at: Point; text: string };

/** A resolved figure: serialisable, comparable, and drawable by anything. */
export interface Figure {
  width: number;
  height: number;
  marks: readonly Mark[];
}

export const FIGURE_KINDS = [
  'polygon',
  'angle',
  'bar',
  'pictograph',
  'spinner',
  'solid',
  'number-line',
  'clock',
  'array',
  'fraction-shape',
  'grid',
  'timeline',
] as const;
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
    }
  | {
      kind: 'bar';
      /** The values, comma-joined, e.g. "'3,7,5,2'". */
      values: Expr;
      /** Category labels, comma-joined. Omitted, categories go unlabelled. */
      labels?: Expr;
      /** 'column' | 'dot' | 'line'. Omitted, jitters between column and dot. */
      style?: Expr;
      /** Units per axis step. Omitted, jitters over 1, 2, 5 and 10 as the values allow. */
      scale?: Expr;
    }
  | {
      kind: 'pictograph';
      /** Counts of the icon per row, comma-joined, e.g. "'3,7,5'". */
      counts: Expr;
      /** Row labels, comma-joined. Omitted, rows go unlabelled. */
      labels?: Expr;
      /** How many things one icon stands for. Omitted, jitters over 1, 2, 5, 10. */
      key?: Expr;
      /**
       * Allow a half icon for a remainder. Omitted, false - and then a key can
       * only say multiples of itself, so a count it cannot say is *reported*
       * rather than quietly rounded into the same picture as its neighbour.
       */
      halves?: Expr;
    }
  | {
      kind: 'spinner';
      /**
       * Sector sizes as parts of the whole, comma-joined, e.g. "'1,1,2'". The
       * list is a *multiset*: how many parts each sector is worth is the
       * question, and where each one sits round the disc is the builder's to
       * vary - see `spinner-kind.ts` for why that is the one arrangement a
       * chance question's answer survives.
       */
      sectors: Expr;
      /**
       * Which sectors share an appearance, comma-joined, one name per sector -
       * "'red,blue,red'" is two red parts and a blue one. The names are the
       * author's; only how many *groups* they make is drawn, and a figure has
       * exactly two appearances (shaded and plain), so the first-named group is
       * the shaded one. Omitted, sectors alternate.
       */
      fills?: Expr;
      /** Degrees anticlockwise. Omitted, it jitters over the whole turn. */
      rotation?: Expr;
    }
  | {
      kind: 'solid';
      /**
       * A name from `SOLIDS` (`solid-kind.ts`): 'cube', 'cuboid', 'sphere',
       * 'cone', 'cylinder', 'square-pyramid' or 'triangular-prism'.
       */
      solid: Expr;
      /**
       * 'object' - the solid itself, in an oblique projection - or 'net', the
       * flat shape it folds up from. Omitted, it jitters between the two,
       * which is what a template asking "how many faces?" wants and what a
       * template whose prompt says "this net" must **not** leave open: the
       * prompt names the view, so the prompt is what pins it.
       *
       * A solid that cannot be unfolded is the exception at both ends: a
       * sphere is always drawn as an object, the jitter never offers a net
       * for one, and a pinned `'net'` is reported as an authoring mistake.
       */
      view?: Expr;
      /**
       * Degrees anticlockwise. Omitted, it jitters over the whole turn - and
       * **pinning it does not fix the orientation here**, unlike a polygon's
       * or a spinner's. A solid has no upright, so which of the eight ways
       * round a net lies, and which side an object's depth leans towards,
       * stay free whatever this says. That is deliberate: it is what lets a
       * pinned rotation still satisfy the anchoring check, where a regular
       * polygon's pinned rotation has to be refused outright.
       */
      rotation?: Expr;
    }
  | {
      kind: 'number-line';
      /** The value the arrow points at. */
      at: Expr;
      /**
       * Omitted, the builder picks a range containing `at` - and a *different*
       * one on a different seed, which is this kind's answer to the anchoring
       * rule.
       *
       * A range it picks for itself always has a tick under the arrow, so the
       * child can read the answer off it; where no range it can draw manages
       * that - `1/3` is the case - the template is **refused** rather than
       * drawn with the arrow floating. A range **pinned** here is drawn as
       * written, arrow between two ticks and all, and refused for nothing:
       * estimating is a real question to ask, and only the builder's own
       * choice is the builder's to answer for.
       *
       * **One case where the range does not vary, and it is worth knowing
       * before authoring against it:** a value with a decimal place, like
       * `1.1`, needs ticks every tenth, and only a line one unit wide carries
       * ten of those in a parent's report row - so there is exactly one round
       * line to draw it on and every seed draws it. The picture still varies
       * (the step and the tick and arrow proportions all move), but the range
       * does not. Whole numbers are offered two framings or more. Pin `from`
       * and `to` yourself if a decimals question wants a particular line.
       */
      from?: Expr;
      to?: Expr;
      /** Distance between labelled ticks. Omitted, jitters over what divides the range. */
      step?: Expr;
      /**
       * Draw minor ticks between the labelled ones. Omitted, jitters - but
       * **only where the arrow is already standing on a labelled tick**.
       * Otherwise the small ticks are the only thing saying which number the
       * arrow is on, so they are always drawn, and this is the one optional
       * field whose absence is not a free coin toss.
       *
       * Pinning it false is honoured exactly as written, and narrows what the
       * builder may choose rather than being overridden: it then picks a range
       * where `at` falls on a *labelled* tick, and refuses the template where
       * no such range exists. How close two ticks may be drawn is judged in a
       * parent's 64px report row, not on the play screen - see `MIN_TICK_GAP`.
       */
      minorTicks?: Expr;
    }
  | {
      kind: 'clock';
      /** Hours, 1-12. */ hour: Expr;
      /**
       * Minutes, 0-59 - and a multiple of 5, because those are the only
       * positions the minute hand can be *read* at. Sixty minute ticks round a
       * dial are 2.95px apart in a parent's 64px report row against a 1.5px
       * stroke, so they read as a band there and only the twelve hour marks can
       * be counted; a minute between two of them is **reported** rather than
       * nudged onto the mark next door. See `clock-kind.ts` for the
       * measurement, and for what it costs a template.
       */
      minute: Expr;
      /**
       * Draw the numerals - the quarters, 12, 3, 6 and 9, which is as many as
       * a report row can tell apart. Omitted, it jitters, which is where a
       * clock's variation has to come from: the hands *are* the answer, so the
       * face is the only thing free to move.
       */
      numerals?: Expr;
      /**
       * Draw the minute track between the hour marks. Omitted, it jitters -
       * freely, and unlike a number line's minor ticks, because the minute
       * above can never depend on it.
       */
      minuteTicks?: Expr;
    }
  | {
      kind: 'array';
      /**
       * How many rows of dots - or, with `orientation` omitted, how many of
       * one of the two dimensions the builder draws; see `array-kind.ts`.
       * Whole numbers, at least 2 (a single row is a line, not an array).
       */
      rows: Expr;
      /** The other dimension, on the same terms as `rows`. */
      columns: Expr;
      /**
       * `'rows'` draws `rows` rows of `columns` dots; `'columns'` draws the
       * transpose - `columns` rows of `rows` dots. Omitted, it jitters
       * between the two, which is the commutativity a "how many groups of
       * four make twelve?" question is often about.
       *
       * **Pin this whenever the answer means "how many rows" or "how many
       * columns" specifically** - the obligation is about what the answer
       * *asks*, not about how it happens to be spelled. `answer: 'rows'`
       * means it, and so does an answer reached through an intermediate
       * variable or arithmetic that still names one dimension
       * (`answer: 'r + 0'`); every one of those is wrong on about half of
       * all draws if this is left to jitter, for the identical reason.
       *
       * `array-kind.ts`'s `answerIssues` catches the first, directly-spelled
       * case as a **heuristic** on every validate - it is a useful signal,
       * not a guarantee, and it cannot see an answer spelled any other way.
       * A clean `validateTemplate` result means "the common mistake was not
       * detected", not "this template is safe to leave unpinned" - judge it
       * by what the answer means, not by whether a check happened to fire.
       *
       * **And the same blindness runs the other way, which is the trap worth
       * knowing about.** `array-kind.ts` refuses the array with no lever left
       * - both dimensions fixed by the template *and* a fixed orientation -
       * but "fixed by the template" is decided textually, by `isClosed` on
       * the expression, because a kind sees one draw at a time and cannot
       * know that `rows: 'r'` bound the same number on all fifty of them. So
       * `{ rows: 'r', columns: 'c', orientation: "'rows'" }`, with `r` and
       * `c` declared as `expr` constants, is exactly the anchored figure that
       * check exists to refuse and it validates completely clean: one picture
       * for one answer, every draw, with nothing on screen or in the suite to
       * say so. Nothing shipped does this. If you write a dimension through a
       * variable, the variable has to actually vary - and if it does not,
       * write the constant in the figure where the check can read it.
       */
      orientation?: Expr;
    }
  | {
      kind: 'fraction-shape';
      /** How many of the equal parts are shaded. */
      numerator: Expr;
      /** How many equal parts the shape is cut into. Never simplified - see `fraction-shape-kind.ts`. */
      denominator: Expr;
      /**
       * 'circle' | 'rectangle' | 'strip'. Omitted, jitters over those that
       * divide `denominator` evenly and legibly - see `fraction-shape-kind.ts`
       * for what each of those two words costs a shape. A prompt that names
       * the shape ("this circle") must pin it, for `solid`'s `view` reason:
       * nothing here can check a prompt's wording against a jittered choice.
       */
      shape?: Expr;
      /**
       * Degrees anticlockwise. Only a circle spins on this - see the module
       * comment for why a rectangle or a strip does not.
       */
      rotation?: Expr;
    }
  | {
      kind: 'grid';
      /**
       * The marked point, "x,y" - whole numbers, and the **first quadrant
       * only**: NSW places negative coordinates at Stage 4 and the number pad
       * has no minus key to answer one with. A cell grid counts its columns
       * and rows from 1; with `onLines` the origin is 0 and is a real place to
       * stand.
       *
       * **Mark a point with room to spare.** How much the extent below can
       * vary depends on where this is: the builder only offers grids big
       * enough to hold it, so a point at the far corner of what a report row
       * can hold leaves exactly *one* grid and the figure stops varying at
       * all. Measured, with the notation pinned: cell (2,3) draws 10 different
       * pictures, cell (5,4) draws 2, and cell **(5,5) draws 1** - as does
       * point **(5,4)** on the lines. The last two are refused, but by the
       * *generic* anchoring check, whose message says "unpin figure.rotation"
       * and names nothing here. If you meet that error on a grid, this field
       * is where to look.
       */
      at: Expr;
      /**
       * How many cells across and up. Omitted, the builder picks a grid big
       * enough to hold `at` - and a *different* one on a different seed, which
       * is this kind's headline answer to the anchoring rule. It is a safe
       * lever precisely because it is only free when the template did not name
       * it: a field no template named is one no answer can depend on, and B3
       * is B3 on a four-wide grid and on a six-wide one.
       *
       * **Leave these open wherever you can.** A template that pins the extent
       * *and* `axisLabels` has used up both of this kind's levers and draws one
       * byte-identical picture per answer, which `validateTemplate`'s 50-seed
       * check then refuses - the same refusal a regular polygon gets for a
       * pinned rotation, and for its reason. How many of them a parent's 64px
       * report row can hold is worked out per figure and reported with its
       * number; a labelled grid runs out of room at a handful, and an
       * unlabelled one holds far more.
       */
      columns?: Expr;
      rows?: Expr;
      /**
       * 'numbers' | 'letters' | 'none'. Omitted, jitters between numbers and
       * letters - and on a coordinate plane (`onLines`) it does not jitter at
       * all, since a lettered axis has no number to give a coordinate.
       *
       * **This is not a choice about decoration: it is the spelling of the
       * answer.** Column 2 is drawn `2` on a numbered grid and `B` on a
       * lettered one, so a template answered `B3` with this left open is
       * illustrated by a grid saying `2,3` on about half of all draws. That is
       * `array`'s `orientation` again - and, like it, **the 50-seed anchoring
       * check structurally cannot catch it**, because the jitter makes the
       * figures differ, which is what that check reads as healthy.
       *
       * So **pin it on any question whose answer names a cell**, in the
       * notation the answer is written in. `grid-kind.ts`'s `answerIssues`
       * catches the common case as a **heuristic** - an answer the template
       * alone fixes to a string that reads as `B3`, `2,3` or `(2,3)` - and it
       * cannot see an answer reached through a bound variable or a `pick`. A
       * clean `validateTemplate` means the common mistake was not detected,
       * not that the template is safe.
       */
      axisLabels?: Expr;
      /**
       * Mark the point on the lines rather than in a cell - the Stage 3
       * coordinate plane rather than the Stage 2 grid map. Omitted, false.
       *
       * **Defaulted rather than jittered, deliberately**, because it decides
       * the same sort of thing `axisLabels` does: a jittered one would make
       * the answer mean a cell on one seed and a point on the next. A default
       * is a pin, so nothing here flips between draws.
       *
       * What it cannot do is notice a template that *meant* the coordinate
       * reading and forgot to say so - that draws the map reading on every
       * seed, `solid`'s `view` exposure exactly, and nothing in `lib` reads a
       * prompt. `answerIssues` cannot help either: a numbered cell reference
       * and a coordinate pair are both written `2,3`.
       */
      onLines?: Expr;
    }
  | {
      kind: 'timeline';
      /**
       * The years the events happened, comma-joined, e.g. `"'1901,1926,1945'"`
       * - the expression language has no arrays, so a list arrives as a string
       * exactly as `bar`'s values and `pictograph`'s counts do, and
       * `"a + ',' + b"` is how a template builds one from its own variables.
       *
       * **They are given in the order the letters run, not in date order.** A
       * kind that lettered its events left to right would answer "which
       * happened first?" off the alphabet, so which letter sits on which year
       * is the template's to say and never the builder's.
       */
      years: Expr;
      /**
       * What each event is called, comma-joined and index-aligned with
       * `years`. Omitted, they are lettered A, B, C in the order given.
       *
       * **One or two characters, and there is no room for a name.** At report
       * scale a character costs `CHAR_SHARE` of the line, so a word beside a
       * dot both collides with its neighbour and pushes the rule's own
       * bound - the letter is a key the prompt refers to ("how many years
       * between A and B?"), which is `bar`'s answer to the same problem.
       */
      labels?: Expr;
      /**
       * The years the two ends of the line are labelled with. Omitted, the
       * builder picks a pair that reaches past the outermost events - and a
       * *different* pair on a different seed, which is this kind's headline
       * answer to the anchoring rule.
       *
       * **The line always overshoots the events by at least one division**, so
       * an end label is never sitting on an event and reading its year off the
       * label. Pinning both ends says exactly which stretch of history is
       * drawn and gives that lever up, which is fine where the content moves
       * instead - see the note in `figure-content-notes.md`.
       */
      from?: Expr;
      to?: Expr;
      /**
       * Years per small tick - the scale the child counts along. Omitted, the
       * builder takes the coarsest division that still puts a tick under every
       * event, which is `number-line`'s rule and is there for its reason: the
       * ticks are the only thing saying what the gap between two dots is
       * worth, so an event floating between two of them cannot be read.
       */
      step?: Expr;
    };

/** The resolved box is this square, in whatever units the renderer scales it to. */
export const FIGURE_BOX = 100;

/**
 * Kept clear inside the box by `fit`, so a stroke drawn along the outline has
 * somewhere to be: the marks are lines with width, and a figure fitted to the
 * very edge of its box loses half that width to the clip.
 *
 * **It lives in the vocabulary rather than in `build.ts`, which is the file
 * that spends it, because a kind that places labels has to know it too** - the
 * slack between the drawing and the box is the only room a label's ink has to
 * hang outside the anchor point `fit` measures it by (see `labels.ts`). It was
 * private to `build.ts` while nothing else needed it, and `bar-kind.ts` began
 * by restating it as a literal, which is exactly the drift that ends with a
 * label clipped in a parent's report and no test able to see it.
 *
 * **Tuning it moves every kind's label budget**, and those budgets are exact -
 * see `CHAR_RATIO` in `labels.ts` for how little room they leave and what the
 * only alarm is.
 *
 * `types.ts` rather than `build.ts` because this file imports nothing.
 * `build.ts` sits at the top of a cycle - it imports the registry, which
 * imports every kind - so a kind importing a *constant* back out of `build.ts`
 * reads it before it is initialised, and under Vite that is `undefined` rather
 * than a `ReferenceError`: every share derived from it becomes `NaN`, `fit`
 * finds no finite bounds, and the figure comes back **empty** with nothing
 * thrown. Measured, not assumed - see the task 6 report, round 1.
 */
export const FIGURE_PADDING = 6;

/**
 * The ceiling `parseFigure` holds `marks.length` to. Most real figures are a
 * handful of marks - a shape's outline, maybe a tick or a mirror line, maybe a
 * dot and an arc for an angle - but the headroom here is nearer three times
 * than the two orders of magnitude this comment used to claim. Measured over
 * all 127 shipped figure templates on 200 seeds each, the worst is **68**: a
 * clock face, whose dial is sixty minute ticks before it has drawn a hand.
 * A kind that rules a fine scale is the shape to watch, and a cap raised for
 * one would want measuring again. This is defence
 * against a hand-rolled call to the recording action, not against a child's
 * session: `Attempt.figure` is read off the browser before it is ever
 * validated (see `recordAttemptAction`), and without a cap a crafted payload
 * of tens of thousands of marks would be stored verbatim and then rendered as
 * that many SVG nodes inside a parent's report - the same reasoning
 * `MAX_PHOTO_BYTES` gives for its own cap.
 */
export const MAX_MARKS = 200;

/**
 * Coordinates are rounded to this many places at build time. It keeps the JSON
 * stored beside an attempt small, and - the reason that matters - it makes two
 * figures comparable as strings, which is what the anchoring check needs to
 * tell "drawn afresh" from "drawn identically again".
 *
 * It is also the whole clearance a kind's label-ink budget has to absorb that
 * rounding with, so tuning it moves a budget that is already exact - see
 * `CHAR_RATIO` in `labels.ts`.
 */
export const FIGURE_PRECISION = 2;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function parsePoint(value: unknown): Point | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, y] = value;
  return isFiniteNumber(x) && isFiniteNumber(y) ? [x, y] : null;
}

function parsePoints(value: unknown): Point[] | null {
  if (!Array.isArray(value)) return null;
  const points: Point[] = [];
  for (const raw of value) {
    const point = parsePoint(raw);
    if (!point) return null;
    points.push(point);
  }
  return points;
}

/** One mark, validated against the shape its own `kind` promises. `null` on anything else. */
function parseMark(value: unknown): Mark | null {
  if (typeof value !== 'object' || value === null) return null;
  const mark = value as Record<string, unknown>;

  switch (mark.kind) {
    case 'path': {
      const points = parsePoints(mark.points);
      if (
        !points ||
        typeof mark.closed !== 'boolean' ||
        typeof mark.fill !== 'boolean' ||
        typeof mark.dashed !== 'boolean'
      ) {
        return null;
      }
      return { kind: 'path', points, closed: mark.closed, fill: mark.fill, dashed: mark.dashed };
    }

    case 'arc': {
      const at = parsePoint(mark.at);
      if (!at || !isFiniteNumber(mark.radius) || !isFiniteNumber(mark.from) || !isFiniteNumber(mark.to)) {
        return null;
      }
      return { kind: 'arc', at, radius: mark.radius, from: mark.from, to: mark.to };
    }

    case 'dot': {
      const at = parsePoint(mark.at);
      return at ? { kind: 'dot', at } : null;
    }

    case 'label': {
      const at = parsePoint(mark.at);
      return at && typeof mark.text === 'string' ? { kind: 'label', at, text: mark.text } : null;
    }

    default:
      return null;
  }
}

/**
 * The boundary on the way a figure comes back out of storage, beside
 * `parseYearLevel`, `parseTarget` and `parsePhoto`. `Attempt.figure` is
 * untrusted the moment it is read back: an old row predates this column, a
 * newer build of the app may have reshaped `Mark`, and a hand-rolled write
 * could put anything at all in a `Json?` column. Anything that is not a
 * well-formed `Figure` becomes `null`, so a malformed row draws nothing rather
 * than throwing inside a parent's report - the same failure mode `parsePhoto`
 * refuses at the same kind of seam.
 *
 * The whole structure is checked, not just that the value is an object: the
 * box dimensions, and every mark validated against what its own `kind`
 * promises. **One bad mark fails the whole figure.** A figure is a single
 * composition read together - a shape's outline, the tick that says a corner
 * is square, the dashed line that says an axis is real - and silently
 * dropping just the mark that failed to parse would draw a picture
 * `buildFigure` never produced: a shape missing the one stroke that made it a
 * different question from its neighbour, with nothing on screen to say a
 * stroke went missing. That is a worse failure than drawing nothing, so this
 * takes the same wholesale refusal `parsePhoto` and `parseTarget` already
 * make rather than trying to save what it can.
 *
 * `marks.length` is also held to `MAX_MARKS` - see there for why, and for who
 * this defends against. Real content never gets near it; a hand-rolled write
 * to the recording action does.
 */
export function parseFigure(value: unknown): Figure | null {
  if (typeof value !== 'object' || value === null) return null;
  const figure = value as Record<string, unknown>;

  if (!isFiniteNumber(figure.width) || figure.width <= 0) return null;
  if (!isFiniteNumber(figure.height) || figure.height <= 0) return null;
  if (!Array.isArray(figure.marks) || figure.marks.length > MAX_MARKS) return null;

  const marks: Mark[] = [];
  for (const raw of figure.marks) {
    const mark = parseMark(raw);
    if (!mark) return null;
    marks.push(mark);
  }

  return { width: figure.width, height: figure.height, marks };
}
