import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { clamp, jitter, numberValue, readField } from './fields';
import type { FigureKindModule } from './registry';
import { FIGURE_BOX, type FigureSpec, type Mark, type Point } from './types';

/**
 * The `bar` kind: a column graph, a dot plot or a line graph - the picture a
 * statistics question is read *off*. It is the first kind whose question is
 * not about the shape of the drawing at all: nothing here is asked "what is
 * this?", it is asked "how many on Tuesday?", and the drawing is the only
 * place that answer exists.
 *
 * **Values arrive comma-joined because the expression language has no
 * arrays.** `values: "'3,7,5,2'"` is a string literal, and `"x + ',' + y"` is
 * how a template varies the data from its own bound variables - the language
 * concatenates with `+`. Parsing is defensive for the reason everything in
 * this folder is: a malformed list is an authoring mistake to *report*, and
 * mid-session it degrades into a graph that can still be drawn.
 *
 * **`column` and `dot` are one choice and `line` is another.** A column and a
 * dot plot are the same categorical reading drawn two ways, so omitting
 * `style` picks between them and that is the kind's main answer to the
 * anchoring rule: a question whose answer is 7 must not always produce one
 * picture. `line` is never picked, because a line graph asserts that the
 * categories are a continuous run - which is a claim about the data, not a
 * drawing choice - so it has to be asked for.
 *
 * **The labels are laid out for the report, not for the play screen.** The
 * same figure is drawn at `labelSize={7}` on the play screen and
 * `labelSize={16}` in a 64px report thumbnail (`src/components/diagram.tsx`),
 * so one glyph is roughly 2.3x wider in the box's own units there than here -
 * and `buildFigure` cannot see which of the two it is being built for, since
 * it is built once and rendered twice. Spacing that clears the play screen's
 * glyph collides in the report, so every gap below is measured against the
 * report's: it is the number of *axis steps* that this pays for, since the
 * report's type size is what says a 100-unit box holds six lines of it and no
 * more. That is `MAX_STEPS`, and it is why `scale` exists at all - a graph of
 * values up to 20 is drawn in steps of 5, not 20 rungs of 1.
 *
 * The one thing this cannot buy back is a *descender* in a category label at
 * report scale: the lowest label is the bottom of the drawing by construction,
 * so it gets exactly the fit's own padding, which covers a line of digits and
 * capitals and leaves the tail of a "p" a pixel short in a 64px thumbnail.
 * Short category labels - "Mon", "Red", "A" - are what this kind is for, and
 * `MAX_LABEL_CHARS` is where that stops being advice.
 */

type BarSpec = Extract<FigureSpec, { kind: 'bar' }>;

const STYLES = ['column', 'dot', 'line'] as const;
type BarStyle = (typeof STYLES)[number];

/** The two that are the same reading drawn differently, and so may be picked between. */
const JITTERED_STYLES: readonly BarStyle[] = ['column', 'dot'];

/** Comparing values against a step, where both came out of floating-point arithmetic. */
const EPSILON = 1e-9;

/**
 * The type size a figure is drawn at in a parent's report, in the fitted box's
 * own units, and what a character of it costs there.
 * `progress-topics.tsx` passes `labelSize={16}`; the ratios are the ones
 * `src/lib/chart/axis-labels.ts` measures its own labels with.
 */
const REPORT_LABEL_SIZE = 16;
const CHAR_RATIO = 0.58;
const INK_RATIO = 0.72;
/** Daylight between two lines of it, so a stack of numbers reads as a stack. */
const LINE_CLEARANCE = 1.15;

/**
 * What `fit` leaves a drawing inside `FIGURE_BOX` once its padding is taken
 * off both sides - `build.ts`'s `PADDING`, which is not exported and is named
 * here rather than imported. It is used only to turn a report-scale label into
 * a share of the drawing's own span, so the two would have to disagree by a
 * lot before a label moved.
 */
const DRAWN_SPAN = FIGURE_BOX - 12;

/**
 * The three above, as shares of the drawing's own span. Everything below is
 * laid out in a frame whose height is exactly 1 and whose width is never more
 * than that, so the span *is* 1 and these are directly comparable with the
 * geometry - which is the only reason the labels can be spaced without knowing
 * what scale the figure will be fitted to.
 */
const CHAR_SHARE = (REPORT_LABEL_SIZE * CHAR_RATIO) / DRAWN_SPAN;
const INK_SHARE = (REPORT_LABEL_SIZE * INK_RATIO) / DRAWN_SPAN;
const PITCH_SHARE = INK_SHARE * LINE_CLEARANCE;

/** How far the axes run past the last step and the last category. */
const TOP_OVERHANG = 0.06;
const RIGHT_OVERHANG = 0.05;
/** From the value axis out to the right edge of a step's label. */
const STEP_GAP = 0.035;
/** From the category axis down to the middle of a category's label. */
const CATEGORY_BAND = 0.12;
/** The stroke that marks a step on the value axis. */
const TICK = 0.02;

/** The plot's own height, with room below it for the category labels. */
const PLOT_HEIGHT = 1 - TOP_OVERHANG - CATEGORY_BAND;

/**
 * The most steps a value axis may be cut into. **Derived, not chosen**: a step
 * label is `INK_SHARE` tall at report scale and wants `LINE_CLEARANCE` of that
 * between it and the next, and the plot is `PLOT_HEIGHT` of the span - so five
 * is simply how many lines of report-scale type fit up the side of a 64px
 * thumbnail. Everything else about the value axis follows from it: it is why
 * `scale` is a parameter, and why a pinned scale that asks for more steps than
 * this is overridden rather than drawn.
 */
const MAX_STEPS = Math.floor(PLOT_HEIGHT / PITCH_SHARE);

/** Fewer than this and the axis is a top and a bottom, with nothing to read against. */
const MIN_STEPS = 2;

/** The steps a scale is chosen from, biggest data first. */
const SCALE_LADDER = [1, 2, 5, 10] as const;

/**
 * The most categories a graph can carry and still label them. Derived the same
 * way `MAX_STEPS` is, across instead of up: a slot has to be at least one
 * report-scale character wide, and at the narrow end of the width jitter with
 * a two-character axis, five slots is what the plot has room for. It is a
 * ceiling on the *data*, so it is reported rather than enforced - `build`
 * still draws a sixth bar, it just draws it cramped.
 */
const MAX_CATEGORIES = 5;

/**
 * A hard stop on how many bars are drawn at all, well past `MAX_CATEGORIES`.
 * `parseFigure` refuses a figure over `MAX_MARKS` when it is read back out of
 * storage, so a list of two hundred values would draw a graph that could never
 * be shown again in a parent's report. Content this long is an authoring
 * mistake that validation catches; this is only so that mid-session it is a
 * cramped graph rather than a lost one.
 */
const MAX_DRAWN_VALUES = 12;

/** Longer than this and a category label is prose, not a label. */
const MAX_LABEL_CHARS = 6;

/** As many characters of a step's label as the left margin is sized for. */
const MAX_STEP_CHARS = 5;

/** The plot is never squeezed past this share of the width, however wide the labels. */
const MIN_PLOT_WIDTH = 0.2;

/**
 * How much of the room left over the plot actually takes. **This is the jitter
 * that is always available**: a template may pin the style and the scale, and
 * the drawing still has to differ between two seeds or it becomes the anchor
 * for its own answer. How wide a graph is drawn says nothing about the data,
 * which is exactly what makes it the right thing to vary.
 */
const WIDTH_BAND = [0.86, 1] as const;

/** A bar's width, as a share of the slot its category owns. */
const BAR_BAND = [0.5, 0.72] as const;

/** Where a `values` nobody could read lands - still a graph, just not the asked one. */
function fallbackValues(rng: Rng): number[] {
  return Array.from({ length: rng.int(3, 4) }, () => rng.int(1, MAX_STEPS));
}

/**
 * The comma-joined list, or nothing at all. Deliberately strict: `Number('')`
 * is 0, so a list with a hole in it would otherwise read as a bar of height
 * nothing rather than as the typo it is.
 */
function parseValues(text: string): number[] | null {
  const parts = text.split(',').map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => part === '')) return null;
  const values = parts.map(Number);
  return values.every((value) => Number.isFinite(value)) ? values : null;
}

function parseLabels(text: string): string[] {
  return text.split(',').map((part) => part.trim());
}

/** How many steps an axis is cut into at this scale - at least one, always. */
function stepsFor(max: number, scale: number): number {
  return Math.max(1, Math.ceil(max / scale - EPSILON));
}

/**
 * The step the value axis is drawn in. A pinned scale is kept unless it asks
 * for an axis that cannot be labelled, which is the one case where drawing
 * what was asked for is worse than drawing something readable - and it is
 * reported, so no such template ships.
 *
 * Left open it jitters, preferring the scales every value is a multiple of:
 * a column that stops between two ticks is a column nobody can read a number
 * off, which is the whole point of the picture.
 */
function scaleFor(values: readonly number[], max: number, pinned: number | undefined, rng: Rng): number {
  if (pinned !== undefined && pinned > 0 && stepsFor(max, pinned) <= MAX_STEPS) return pinned;

  const fits = SCALE_LADDER.filter((step) => {
    const steps = stepsFor(max, step);
    return steps >= MIN_STEPS && steps <= MAX_STEPS;
  });
  const exact = fits.filter((step) =>
    values.every((value) => Math.abs(value / step - Math.round(value / step)) < EPSILON),
  );
  const pool = exact.length > 0 ? exact : fits;
  if (pool.length > 0) return rng.pick(pool);

  // Past the ladder's reach - a step of the data's own, so the axis still fits.
  return Math.max(EPSILON, Math.ceil(max / MAX_STEPS));
}

/** A step's label, without the tail a floating-point step would otherwise leave on it. */
function formatStep(value: number): string {
  return String(Math.round(value * 1000) / 1000 + 0);
}

export const barModule: FigureKindModule<'bar'> = {
  kind: 'bar',

  // Only the data is required - it is the question. Omitting `style` is what
  // asks for a column graph or a dot plot; omitting `scale` is what asks for
  // whichever step the values allow; omitting `labels` leaves the categories
  // unnamed, which is right for a graph whose caption names them.
  fields: {
    values: 'required',
    labels: 'optional',
    style: 'optional',
    scale: 'optional',
  },

  build(spec: BarSpec, scope: Scope, rng: Rng): Mark[] {
    const read = readField(spec.values, scope);
    const parsed = typeof read === 'string' ? parseValues(read) : null;
    const values = (parsed ?? fallbackValues(rng))
      .slice(0, MAX_DRAWN_VALUES)
      // A bar graph has no room below its own axis, so a negative value is
      // drawn as nothing. It is reported; here it only has to be drawable.
      .map((value) => Math.max(value, 0));

    const readLabels = readField(spec.labels, scope);
    const names = typeof readLabels === 'string' ? parseLabels(readLabels) : [];
    const labelled = names.some((name) => name !== '');

    const readStyle = readField(spec.style, scope);
    const style: BarStyle = (STYLES as readonly string[]).includes(readStyle as string)
      ? (readStyle as BarStyle)
      : rng.pick(JITTERED_STYLES);

    const max = Math.max(...values, 0);
    const scale = scaleFor(values, max, numberValue(readField(spec.scale, scope)), rng);
    const steps = stepsFor(max, scale);

    // The frame: height exactly 1, width never more than that, so the fit's
    // scale is `DRAWN_SPAN` and every share above is a real measurement.
    const plotHeight = 1 - TOP_OVERHANG - (labelled ? CATEGORY_BAND : 0);
    const stepHeight = plotHeight / steps;

    const stepTexts = Array.from({ length: steps + 1 }, (_, step) => formatStep(step * scale));
    const stepChars = Math.min(
      Math.max(...stepTexts.map((text) => text.length)),
      MAX_STEP_CHARS,
    );

    const leftBand = STEP_GAP + stepChars * CHAR_SHARE;
    const available = Math.max(1 - leftBand - RIGHT_OVERHANG, MIN_PLOT_WIDTH);
    // What is left over once the widest step label has been paid for, as a
    // share of the box: the label's ink reaches half its own width past the
    // anchor the fit measures, and an SVG clips at its own edge, so the
    // drawing has to stay narrow enough for that half to land inside.
    const roomForInk =
      (FIGURE_BOX / 2 - (stepChars * REPORT_LABEL_SIZE * CHAR_RATIO) / 2) / (DRAWN_SPAN / 2);
    const outside = RIGHT_OVERHANG + leftBand - (stepChars * CHAR_SHARE) / 2;
    const widest = clamp((roomForInk - outside) / available, MIN_PLOT_WIDTH, 1);
    const plotWidth = available * widest * jitter(rng, ...WIDTH_BAND);

    const slot = plotWidth / Math.max(values.length, 1);
    const barWidth = slot * jitter(rng, ...BAR_BAND);
    const at = (value: number) => (value / scale) * stepHeight;
    const centre = (index: number) => (index + 0.5) * slot;

    const marks: Mark[] = [
      line([0, 0], [0, plotHeight + TOP_OVERHANG]),
      line([0, 0], [plotWidth + RIGHT_OVERHANG, 0]),
    ];

    // The ticks, then the numbers beside them: a label with nothing on the
    // axis to point at is a number floating next to a graph.
    for (let step = 1; step <= steps; step++) {
      marks.push(line([-TICK, step * stepHeight], [0, step * stepHeight]));
    }
    stepTexts.forEach((text, step) => {
      // Right-aligned against the axis, which is where a value axis reads
      // from - so the anchor moves left as the number gets longer.
      const width = Math.min(text.length, MAX_STEP_CHARS) * CHAR_SHARE;
      marks.push({ kind: 'label', at: [-(STEP_GAP + width / 2), step * stepHeight], text });
    });

    if (style === 'line') {
      marks.push({
        kind: 'path',
        points: values.map((value, index): Point => [centre(index), at(value)]),
        closed: false,
        fill: false,
        dashed: false,
      });
    } else {
      values.forEach((value, index) => {
        if (style === 'dot') {
          marks.push({ kind: 'dot', at: [centre(index), at(value)] });
          return;
        }
        const left = centre(index) - barWidth / 2;
        const right = centre(index) + barWidth / 2;
        marks.push({
          kind: 'path',
          points: [
            [left, 0],
            [left, at(value)],
            [right, at(value)],
            [right, 0],
          ],
          closed: true,
          fill: true,
          dashed: false,
        });
      });
    }

    if (labelled) {
      values.forEach((_, index) => {
        const name = names[index];
        if (name === undefined || name === '') return;
        marks.push({ kind: 'label', at: [centre(index), -CATEGORY_BAND], text: name });
      });
    }

    return marks;
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const raw = read(spec.values, 'figure.values', 'string', true);
    const values = typeof raw === 'string' ? parseValues(raw) : null;

    if (typeof raw === 'string' && !values) {
      issues.push(`figure.values: ${JSON.stringify(raw)} is not a comma-separated list of numbers`);
    }
    if (values) {
      const below = values.find((value) => value < 0);
      if (below !== undefined) {
        issues.push(`figure.values: ${below} is below zero, and a bar graph has no room under its axis`);
      }
      if (values.length > MAX_CATEGORIES) {
        issues.push(
          `figure.values: ${values.length} values is more than the ${MAX_CATEGORIES} a graph` +
            ' has room to label in a report',
        );
      }
    }

    const labels = read(spec.labels, 'figure.labels', 'string');
    if (typeof labels === 'string') {
      const names = parseLabels(labels);
      if (values && names.length !== values.length) {
        issues.push(`figure.labels: ${names.length} labels for ${values.length} values`);
      }
      const long = names.find((name) => name.length > MAX_LABEL_CHARS);
      if (long !== undefined) {
        issues.push(
          `figure.labels: ${JSON.stringify(long)} is longer than the ${MAX_LABEL_CHARS}` +
            ' characters a category label has room for',
        );
      }
    }

    const style = read(spec.style, 'figure.style', 'string');
    if (typeof style === 'string' && !(STYLES as readonly string[]).includes(style)) {
      issues.push(`figure.style: ${JSON.stringify(style)} is not ${STYLES.join(', ')}`);
    }

    const scale = read(spec.scale, 'figure.scale', 'number');
    if (typeof scale === 'number') {
      if (scale <= 0) {
        issues.push(`figure.scale: ${scale} is not a step the axis can be counted in`);
      } else if (values && values.length > 0) {
        const steps = stepsFor(Math.max(...values.map((value) => Math.max(value, 0)), 0), scale);
        if (steps > MAX_STEPS) {
          issues.push(
            `figure.scale: ${scale} leaves ${steps} steps on the axis, more than the` +
              ` ${MAX_STEPS} whose labels stay clear of one another, so a step that fits` +
              ' would be drawn instead',
          );
        } else if (steps < MIN_STEPS) {
          issues.push(
            `figure.scale: ${scale} leaves the axis a single step, with nothing between` +
              ' the bottom and the top to read a value against',
          );
        }
      }
    }

    return issues;
  },
};

function line(from: Point, to: Point): Mark {
  return { kind: 'path', points: [from, to], closed: false, fill: false, dashed: false };
}
