/**
 * How the topic names under a bar chart are laid out: flat, or tilted, and how
 * much of each name survives.
 *
 * Pure and here rather than in the component for the reason `photo/crop.ts`
 * gives: it is geometry, and geometry judged by eye in a component is what the
 * `src/lib` rule exists to prevent. A phone is the case that goes wrong, and a
 * phone is the hardest thing to keep checking by hand.
 *
 * **The tilt is `LABEL_ANGLE` from horizontal, and the labels used to be
 * vertical.** Vertical labels cannot collide with each other whatever the bar
 * width, which is why they were the narrow screen's answer - but a parent has
 * to turn the phone on its side to read one, and a label nobody reads is not
 * doing its job. Tilted, a name is read with a glance instead.
 *
 * Tilting costs two things vertical labels got for nothing, and both are
 * measured here rather than hoped for:
 *
 * **Horizontal room.** A label leans up and to the left of the bar it names, so
 * the leftmost one runs off the side of the chart - and an SVG clips at its own
 * edge, so what runs off is simply gone. The flatter the label the further it
 * leans, which is exactly why vertical fit anywhere. So the chart takes a
 * **gutter** on its left for the labels to lean into.
 *
 * **What that gutter is worth is decided by position, not by length.** Only the
 * bars near the left edge can run out of chart: a long name over the sixth bar
 * has five bars' width of its own to lean across and wants nothing from the
 * gutter at all. So every label is asked what *it* needs from where *it* sits
 * and the gutter is the largest of those answers - usually nothing, since the
 * bars are ordered by how much a topic has been answered and the longest name
 * is only occasionally the leftmost. Sizing it off the longest name wherever it
 * sat spent a quarter of a phone's panel on room the labels did not want.
 *
 * Eliding follows position for the same reason. A single budget would have to
 * be the tightest bar's, which is the leftmost - and trimming a name that has
 * the whole plot to lean across, because a different name on the far side is
 * cramped, is that same mistake pointed the other way.
 *
 * **Clearance from the label next door.** Tilted labels are parallel strips,
 * and what separates two of them is not the bar width but the bar width across
 * the tilt - about seven tenths of it, at 45 degrees. Vertical labels are
 * parallel to the gap between the bars and so can never touch however narrow it
 * gets; these can. Length is no help, since two strips are the same distance
 * apart however long they are, so what gives way is the **type size**: it comes
 * down as far as `MIN_FONT` to keep a descender off the name below it.
 */

/**
 * Degrees from horizontal. Shallow enough to read straight on, steep enough
 * not to spend the left of the chart on getting there - the two pull opposite
 * ways, since a flatter label reaches further sideways and so needs a wider
 * gutter to lean into.
 */
export const LABEL_ANGLE = 45;

const RADIANS = (LABEL_ANGLE * Math.PI) / 180;
/** How far a tilted label reaches down from the axis, per pixel of its length. */
const DROP = Math.sin(RADIANS);
/** How far it reaches sideways, per pixel of its length - the room it must be given. */
const REACH = Math.cos(RADIANS);

/** The size a label is drawn at where there is room for it, and the smallest worth drawing. */
const BASE_FONT = 12;
const MIN_FONT = 9;

/** About what one character costs, as a share of the type size. */
const CHAR_RATIO = 0.55;

/** Ink height including descenders, plus a hair of daylight, as a share of the type size. */
const LINE_RATIO = 1.05;

/**
 * What the chart spends on either side of the plot. Exported because the
 * component declares them to recharts and this file reasons about them: two
 * copies of the same two numbers is how a label starts being clipped by a
 * margin nobody remembered to tell the geometry about.
 */
export const CHART_INSETS = {
  /** The value axis down the left, which a tilted label may lean across. */
  valueAxis: 36,
  /** The margin on the right, which nothing leans into. */
  right: 8,
} as const;

const Y_AXIS_WIDTH = CHART_INSETS.valueAxis;
const RIGHT_MARGIN = CHART_INSETS.right;

/** Kept clear of the label next door, so two flat labels never touch. */
const LABEL_GAP = 8;

/**
 * Below this a flat label is elided down to nothing worth reading, so a wide
 * screen with a great many topics on it tilts them rather than ruling a row of
 * stumps under the axis.
 */
export const MIN_CHARS = 6;

/** Room below the axis for a flat label. */
const FLAT_HEIGHT = 34;

/**
 * The most the axis may take out of the chart's height, tilted. Everything
 * above this is height the bars themselves are not getting.
 */
const MAX_LABEL_HEIGHT = 110;

/** Clearance between the tick and the start of the label. */
const TICK_GAP = 10;

/**
 * The most of the width the tilted labels may take for themselves. A quarter
 * leaves three quarters for the bars, which is enough for eight of them to
 * still read as bars. It is a ceiling rather than a budget - what the labels
 * ask for is usually far less, and often nothing.
 */
const MAX_GUTTER_SHARE = 0.25;

export interface AxisLabels {
  /** Tilted by `LABEL_ANGLE`, or lying flat. */
  angled: boolean;
  /** Blank space to the left of the value axis, for the leftmost labels to lean into. */
  gutter: number;
  /** Room reserved below the axis, which is height taken off the bars. */
  height: number;
  /** How many characters each label keeps, in bar order; the rest is elided. */
  maxChars: number[];
  /** The type size the labels are drawn at. */
  fontSize: number;
}

export function axisLabels({
  width,
  lengths,
  wide,
}: {
  /** The measured width of the chart, or 0 before it has been measured. */
  width: number;
  /** How long each label is, in characters, in the order the bars are drawn. */
  lengths: readonly number[];
  /** A screen with the room to lay labels flat, if the bars are wide enough. */
  wide: boolean;
}): AxisLabels {
  const count = lengths.length;

  // A flat label is bounded by the bar it sits under rather than by anything
  // below the axis, so its budget is the plot divided by the number of bars -
  // one number, the same for every bar.
  const flatBand = bandWidth(width, count, 0);
  const flatChars = Math.floor(Math.max(flatBand - LABEL_GAP, 0) / (BASE_FONT * CHAR_RATIO));

  if (wide && flatChars >= MIN_CHARS) {
    return {
      angled: false,
      gutter: 0,
      height: FLAT_HEIGHT,
      maxChars: lengths.map((length) => Math.min(flatChars, length)),
      fontSize: BASE_FONT,
    };
  }

  // Asked for at `BASE_FONT` even where the type then comes down, because
  // erring towards a wider gutter costs a little plot and erring the other way
  // costs the front of a word.
  const gutter = clamp(
    Math.max(0, ...lengths.map((length, bar) => gutterFor(length, bar, width, count, BASE_FONT))),
    0,
    width * MAX_GUTTER_SHARE,
  );

  const band = bandWidth(width, count, gutter);
  // What separates two tilted labels is the band across the tilt, so that -
  // and not the bar width - is what the type has to fit between.
  const fontSize = clamp(Math.floor((band * DROP) / LINE_RATIO), MIN_FONT, BASE_FONT);
  const charWidth = fontSize * CHAR_RATIO;

  const drawn = lengths.map((length, bar) => {
    const room = gutter + Y_AXIS_WIDTH + band * (bar + 0.5);
    return Math.min(
      length * charWidth,
      tiltedCeiling(fontSize),
      // The room left once the half of the line standing above its own baseline
      // has been paid for - it is that corner, not the end of the baseline,
      // that reaches furthest left and so meets the edge first.
      Math.max(room - (fontSize / 2) * DROP, 0) / REACH,
    );
  });

  return {
    angled: true,
    gutter,
    // Only as deep as the longest label actually drawn, so short names give
    // their room back to the bars instead of ruling an empty band under them.
    height: Math.ceil(Math.max(0, ...drawn) * DROP + TICK_GAP + fontSize * REACH),
    maxChars: drawn.map((length) => Math.floor(length / charWidth)),
    fontSize,
  };
}

/**
 * What one label at one position needs from the gutter, which is nothing at all
 * for anything but the first bar or two.
 *
 * The room a label has is the gutter, the value axis and the bars to its left;
 * widening the gutter narrows those bars, so a pixel of gutter buys less than a
 * pixel of room, and less the further right the bar sits. Solving for the
 * gutter rather than stepping towards it is what makes the answer the one that
 * actually fits, instead of one measured against a plot it then changed.
 */
function gutterFor(
  length: number,
  bar: number,
  width: number,
  count: number,
  fontSize: number,
): number {
  if (count <= 0) return 0;

  const wanted = Math.min(length * fontSize * CHAR_RATIO, tiltedCeiling(fontSize));
  const share = (bar + 0.5) / count;
  const plot = Math.max(width - Y_AXIS_WIDTH - RIGHT_MARGIN, 0);

  return (reachOf(wanted, fontSize) - Y_AXIS_WIDTH - plot * share) / (1 - share);
}

/**
 * How far left of its bar a tilted label of this length reaches: its baseline,
 * plus the corner of the line box standing above that baseline.
 */
function reachOf(length: number, fontSize: number): number {
  return length * REACH + (fontSize / 2) * DROP;
}

/** The longest tilted label `MAX_LABEL_HEIGHT` can hold at this type size. */
function tiltedCeiling(fontSize: number): number {
  return Math.max(MAX_LABEL_HEIGHT - TICK_GAP - fontSize * REACH, 0) / DROP;
}

/** How much width one bar and its share of the gaps gets. */
function bandWidth(width: number, count: number, gutter: number): number {
  if (count <= 0) return 0;
  const plot = Math.max(width - Y_AXIS_WIDTH - RIGHT_MARGIN - gutter, 0);
  return plot / count;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
