/**
 * How the topic names under a bar chart are laid out: flat, or tilted, and how
 * much of each name survives.
 *
 * Pure and here rather than in the component for the reason `photo/crop.ts`
 * gives: it is geometry, and geometry judged by eye in a component is what the
 * `src/lib` rule exists to prevent. A phone is the case that goes wrong, and a
 * phone is the hardest thing to keep checking by hand.
 *
 * **The tilt is 30 degrees from horizontal, and the labels used to be
 * vertical.** Vertical labels cannot collide with each other whatever the bar
 * width, which is why they were the narrow screen's answer - but a parent has
 * to turn the phone on its side to read one, and a label nobody reads is not
 * doing its job. At 30 degrees a name is read with a glance instead.
 *
 * Tilting costs two things vertical labels got for nothing, and both are
 * measured here rather than hoped for:
 *
 * **Horizontal room.** A label leans up and to the left of the bar it names, so
 * the leftmost one runs off the side of the chart - and an SVG clips at its own
 * edge, so what runs off is simply gone. The flatter the label the further it
 * leans, which is exactly why vertical fit anywhere. So the chart takes a
 * **gutter** on its left for the labels to lean into, sized to what the longest
 * name actually needs and capped at `MAX_GUTTER_SHARE` of the width so the bars
 * never become slivers. Nothing is spent when the names are short.
 *
 * **Clearance from the label next door.** Tilted labels are parallel strips,
 * and what separates two of them is not the bar width but the bar width across
 * the tilt - half of it, at 30 degrees. Vertical labels are parallel to the
 * gap between the bars and so can never touch however narrow it gets; these can.
 * Length is no help, since two strips are the same distance apart however long
 * they are, so what gives way is the **type size**: it comes down as far as
 * `MIN_FONT` to keep a descender off the name below it. A slightly smaller name
 * is a fair price, and it buys back characters as well as clearance.
 */

/** Degrees from horizontal. Shallow enough to read straight on. */
export const LABEL_ANGLE = 30;

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
 * still read as bars.
 */
const MAX_GUTTER_SHARE = 0.25;

export interface AxisLabels {
  /** Tilted by `LABEL_ANGLE`, or lying flat. */
  angled: boolean;
  /** Blank space to the left of the value axis, for the leftmost label to lean into. */
  gutter: number;
  /** Room reserved below the axis, which is height taken off the bars. */
  height: number;
  /** How many characters of a name survive; the rest is elided. */
  maxChars: number;
  /** The type size the labels are drawn at. */
  fontSize: number;
}

export function axisLabels({
  width,
  count,
  longestChars,
  wide,
}: {
  /** The measured width of the chart, or 0 before it has been measured. */
  width: number;
  /** How many bars are being labelled. */
  count: number;
  /** The longest name to be drawn, in characters. */
  longestChars: number;
  /** A screen with the room to lay labels flat, if the bars are wide enough. */
  wide: boolean;
}): AxisLabels {
  // A flat label is bounded by the bar it sits under rather than by anything
  // below the axis, so its budget is the plot divided by the number of bars.
  const flatBand = bandWidth(width, count, 0);
  const flatChars = Math.floor(Math.max(flatBand - LABEL_GAP, 0) / (BASE_FONT * CHAR_RATIO));

  if (wide && flatChars >= MIN_CHARS) {
    return {
      angled: false,
      gutter: 0,
      height: FLAT_HEIGHT,
      maxChars: Math.min(flatChars, longestChars),
      fontSize: BASE_FONT,
    };
  }

  // What the longest name needs to the left of the first bar is `wanted *
  // REACH`, and what it already has is the value axis plus half a band. The
  // gutter makes up the difference - but a wider gutter narrows the plot, and a
  // narrower plot narrows the band that was part of the room, so a pixel of
  // gutter buys slightly less than a pixel of room. `settles` is how much less,
  // and dividing by it is what makes the gutter the one that actually fits
  // rather than one measured against a band it then changed.
  //
  // It is asked for at `BASE_FONT` even when the type then comes down, because
  // erring towards a wider gutter costs a little plot and erring the other way
  // costs the front of a word.
  const wanted = Math.min(longestChars * BASE_FONT * CHAR_RATIO, tiltedCeiling(BASE_FONT));
  const settles = count > 0 ? 1 - 1 / (2 * count) : 1;
  const gutter = clamp(
    (reachOf(wanted, BASE_FONT) - Y_AXIS_WIDTH - flatBand / 2) / settles,
    0,
    width * MAX_GUTTER_SHARE,
  );

  const band = bandWidth(width, count, gutter);
  const room = gutter + Y_AXIS_WIDTH + band / 2;
  // What separates two tilted labels is the band across the tilt, so that -
  // and not the bar width - is what the type has to fit between.
  const fontSize = clamp(Math.floor((band * DROP) / LINE_RATIO), MIN_FONT, BASE_FONT);
  const charWidth = fontSize * CHAR_RATIO;
  const tilted = Math.min(
    longestChars * charWidth,
    tiltedCeiling(fontSize),
    // The room left once the half of the line standing above its own baseline
    // has been paid for - it is that corner, not the end of the baseline, that
    // reaches furthest left and so meets the edge first.
    Math.max(room - (fontSize / 2) * DROP, 0) / REACH,
  );

  return {
    angled: true,
    gutter,
    // Only as deep as the labels actually are, so short names give their room
    // back to the bars instead of ruling an empty band under them.
    height: Math.ceil(tilted * DROP + TICK_GAP + fontSize * REACH),
    maxChars: Math.floor(tilted / charWidth),
    fontSize,
  };
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
