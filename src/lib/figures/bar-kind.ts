import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { clamp, jitter, numberValue, readField } from './fields';
import {
  CHAR_RATIO,
  CHAR_SHARE,
  DRAWN_SPAN,
  PITCH_SHARE,
  PLAY_LABEL_SIZE,
  reportLabelWidth,
} from './labels';
import type { FigureKindModule } from './registry';
import { FIGURE_BOX, FIGURE_PRECISION, type FigureSpec, type Mark, type Point } from './types';

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
 * **The labels are laid out for the report, not for the play screen** -
 * `labels.ts` is where that is measured and why. What it costs *this* kind is
 * the number of rungs on the value axis: a 100-unit box holds about six lines
 * of report-scale type, so `MAX_STEPS` is five, and that is the whole reason
 * `scale` is a parameter - a graph of values up to 20 is drawn in steps of 5,
 * not 20 rungs of 1. The layout below is in a frame whose height is exactly 1
 * and whose width is never more, which is what makes `labels.ts`' shares
 * directly comparable with the geometry here.
 *
 * Two things that buys and one it does not. It buys no clipping: the drawing
 * is sized so every label's ink lands inside the box at report scale, category
 * labels included. It buys clear axis steps. It does **not** buy category
 * labels clear of *each other* there - no arrangement can, since a slot is the
 * plot divided by the data's own category count - so that budget is computed
 * per graph (`categoryBudget`), judged at play-screen scale, and *reported*
 * rather than enforced by a constant chosen up front. The
 * other thing left tight is a *descender* at report scale: the lowest label is
 * the bottom of the drawing by construction, so it gets exactly the fit's own
 * padding, which covers digits and capitals and leaves the tail of a "p" a
 * pixel short in a 64px thumbnail. Short category labels - "Mon", "Red", "A" -
 * are what this kind is for.
 */

type BarSpec = Extract<FigureSpec, { kind: 'bar' }>;

const STYLES = ['column', 'dot', 'line'] as const;
type BarStyle = (typeof STYLES)[number];

/** The two that are the same reading drawn differently, and so may be picked between. */
const JITTERED_STYLES: readonly BarStyle[] = ['column', 'dot'];

/** Comparing values against a step, where both came out of floating-point arithmetic. */
const EPSILON = 1e-9;

/** How far the axes run past the last step and the last category. */
const TOP_OVERHANG = 0.06;
const RIGHT_OVERHANG = 0.05;
/** From the value axis out to the right edge of a step's label. */
const STEP_GAP = 0.035;
/** From the category axis down to the middle of a category's label. */
const CATEGORY_BAND = 0.12;
/** The stroke that marks a step on the value axis. */
const TICK = 0.02;

/** The plot is never squeezed past this share of the width, however wide the labels. */
const MIN_PLOT_WIDTH = 0.2;

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
 *
 * **This is a silent truncation, which `labels.ts`' third lesson otherwise
 * rules out, and it is the storage-cap exception named there.** It is safe
 * only because it is unreachable by anything that validates: `MAX_CATEGORIES`
 * is reported at less than half of it, so a template that ships can never have
 * a value cut. Keep both halves if you copy it.
 */
const MAX_DRAWN_VALUES = 12;

/**
 * The most characters a step's label may carry, derived from the room the left
 * margin can give up: a label that wide leaves the plot exactly
 * `MIN_PLOT_WIDTH` and anything wider eats into it. It is **reported**, never
 * quietly clamped - a longer label is measured at its true width, so the
 * geometry stays honest and the drawing narrows, which is lesson 3's third
 * state (neither obeyed nor reported) deliberately closed off.
 */
const MAX_STEP_CHARS = Math.floor(
  (1 - MIN_PLOT_WIDTH - RIGHT_OVERHANG - STEP_GAP) / CHAR_SHARE,
);

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
  if (parts.some((part) => part === '')) return null;
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
function scaleCandidates(
  values: readonly number[],
  max: number,
  pinned: number | undefined,
): number[] {
  if (pinned !== undefined && pinned > 0 && stepsFor(max, pinned) <= MAX_STEPS) return [pinned];

  const fits = SCALE_LADDER.filter((step) => {
    const steps = stepsFor(max, step);
    return steps >= MIN_STEPS && steps <= MAX_STEPS;
  });
  const exact = fits.filter((step) =>
    values.every((value) => Math.abs(value / step - Math.round(value / step)) < EPSILON),
  );
  const pool = exact.length > 0 ? exact : fits;
  if (pool.length > 0) return pool;

  // Past the ladder's reach - a step of the data's own, so the axis still fits.
  return [Math.max(EPSILON, Math.ceil(max / MAX_STEPS))];
}

function scaleFor(values: readonly number[], max: number, pinned: number | undefined, rng: Rng): number {
  // A pick from one candidate is still a pick, and that is the point: this
  // spends **exactly one draw whichever path it takes**, where a pinned scale
  // and the past-the-ladder fallback used to return without drawing at all.
  //
  // Constant consumption is not tidiness. `generate` hands *one* `Rng` through
  // `tryBind`, then `buildFigure`, then `buildChoices`, so a figure that spent
  // a variable number of draws would shift everything drawn after it: adding a
  // `scale` pin to a template silently reshuffled that template's own
  // distractors, in the very question the figure illustrates. A kind whose
  // parameters can be pinned should keep this property - spend the same number
  // of draws pinned as unpinned, rather than skipping the draw it no longer
  // needs.
  return rng.pick(scaleCandidates(values, max, pinned));
}

/**
 * The widest label the value axis can end up carrying, over every rung of it
 * and every scale that could be picked for this data. It is the same fold
 * `build` does over its own `stepTexts`, run without an `Rng`, so the two
 * cannot disagree about how wide the left margin has to be.
 *
 * **Neither the tallest value nor the axis's top rung is this number**, and
 * both are tempting:
 *
 * - The *data* is not it, because the axis is labelled at `step x scale` and
 *   rounding the tallest value up to a whole step can carry it into another
 *   digit: `'999999'` is six characters and the rung above it reads `1000000`,
 *   which is seven.
 * - The *top rung* is not it either, because a rung below the top can print
 *   longer than the top does. A fractional scale is one way - an axis topping
 *   out at `400.5` passes through `100.125`, which is two characters wider -
 *   and JavaScript's own number formatting is another: at 1e21 `String` switches
 *   to exponential, so an axis whose top prints `1e+21` in five characters
 *   passes through a rung printing twenty-one.
 *
 * So the rule is **ask every label the drawing will actually contain**, not the
 * input it was derived from and not one representative of it. Any kind whose
 * labels are *derived* rather than copied - a number line's ticks, a clock's
 * hour marks, a grid's coordinates - has the same trap, because rounding,
 * formatting and unit suffixes all change a label's width between the input and
 * the ink.
 */
function widestStepLabel(values: readonly number[], max: number, pinned: number | undefined): string {
  let widest = '';
  for (const scale of scaleCandidates(values, max, pinned)) {
    // Bounded by `MAX_STEPS`: `scaleCandidates` keeps a pinned scale only when
    // it leaves that few rungs, and every scale it picks for itself leaves at
    // most that many.
    for (let step = 0; step <= stepsFor(max, scale); step++) {
      const text = formatStep(step * scale);
      if (text.length > widest.length) widest = text;
    }
  }
  return widest;
}

/**
 * The text two rungs of the axis would both carry, or nothing at all if every
 * rung reads differently.
 *
 * **This is the same class of bug as `widestStepLabel` on a different axis: not
 * how wide a derived label is, but whether it is still the label it should be.**
 * `formatStep` rounds to three decimals, so a step finer than that prints the
 * same text twice - an axis reading `0 | 0.001 | 0.001 | 0.002 | 0.002` fits its
 * box perfectly and cannot be read at all. No amount of measuring ink finds
 * this, which is exactly why it is a check of its own rather than a wider
 * sweep: the labels are the right size, they are the wrong labels.
 *
 * A kind whose labels are derived owes its authors both questions. Does the
 * label fit? And is it still distinct from the one next to it? Rounding answers
 * the first by breaking the second.
 */
function repeatedStepLabel(
  values: readonly number[],
  max: number,
  pinned: number | undefined,
): { text: string; scale: number } | null {
  for (const scale of scaleCandidates(values, max, pinned)) {
    const seen = new Set<string>();
    for (let step = 0; step <= stepsFor(max, scale); step++) {
      const text = formatStep(step * scale);
      if (seen.has(text)) return { text, scale };
      seen.add(text);
    }
  }
  return null;
}

/**
 * How wide the plot is drawn before the width jitter, and what the left margin
 * costs - the half of the layout that depends on nothing random, so `build` and
 * `categoryBudget` can never disagree about how much room a label has.
 *
 * **What it produces is exact, and exact means there is no slack.** At the
 * tightest legal shape the binding label's ink lands 0.24 units inside the box
 * with a one-character axis and **0.01 units** inside it with a six-character
 * one - the `10 ** -FIGURE_PRECISION` term below is the entire clearance, and it
 * is there to survive rounding rather than to leave room. See `labels.ts` for
 * which three constants flip that, and for the fact that the sweep in
 * `bar-kind.test.ts` is the only thing that would notice.
 *
 * The width is whatever is left once the step labels have their margin,
 * narrowed until **every label's ink** lands inside the box at report scale.
 * `fit` bounds a drawing by anchor points and an SVG clips at its own edge
 * (`labels.ts`, lesson 1), so the only room a label's ink has is the padding
 * the fit leaves outside those bounds, and this is what spends it.
 *
 * Both kinds of label are measured, because both sit near an edge. The widest
 * step label *is* the left bound, so it needs its whole half-width. A category
 * label sits `RIGHT_OVERHANG` inside the right bound - the axis runs that far
 * past the last bar - so that much of its half-width is already paid for. (The
 * left-hand one is further in still, by the step label's own band, which is
 * always the wider of the two; the tighter side is what is solved for.) Each
 * category label also has half a slot of room beyond that, which is real and is
 * deliberately *not* counted, so this stays one expression rather than a solve
 * coupled to the category count.
 */
function plotShape(stepChars: number, categoryChars: number): { leftBand: number; width: number } {
  const leftBand = STEP_GAP + stepChars * CHAR_SHARE;
  const available = Math.max(1 - leftBand - RIGHT_OVERHANG, MIN_PLOT_WIDTH);

  const stepInk = reportLabelWidth(stepChars) / 2;
  const categoryInk = Math.max(
    reportLabelWidth(categoryChars) / 2 - RIGHT_OVERHANG * DRAWN_SPAN,
    0,
  );
  // Met with a rounding step to spare: `fit` rounds every coordinate to
  // `FIGURE_PRECISION`, and this bound is otherwise tight enough that the ink
  // of the binding label lands on the box edge exactly.
  const roomForInk =
    (FIGURE_BOX / 2 - Math.max(stepInk, categoryInk) - 10 ** -FIGURE_PRECISION) /
    (DRAWN_SPAN / 2);
  const outside = RIGHT_OVERHANG + leftBand - (stepChars * CHAR_SHARE) / 2;
  const widest = clamp((roomForInk - outside) / available, MIN_PLOT_WIDTH, 1);

  return { leftBand, width: available * widest };
}

/**
 * The most characters a category label can carry on *this* graph and still
 * clear the label beside it, at play-screen scale. Measured against the
 * narrowest slot the graph is ever drawn with - the low end of `WIDTH_BAND` -
 * so a label that fits is one that fits on every seed, not on the lucky ones.
 *
 * **The room a category label has is not a constant, so it is not written as
 * one.** `MAX_STEPS` and `MAX_CATEGORIES` are caps the geometry can honour by
 * choosing differently; how wide a category label may be is settled by the
 * data instead - a slot is the plot divided by the number of categories, and
 * no arrangement makes one wider than `DRAWN_SPAN / n`. So this is computed
 * from the layout the graph will actually get, and a label past it is reported
 * with the number in the message rather than banned by a figure chosen up
 * front. A kind with a limit of this shape should do the same: a constant here
 * would be wrong, and would look derived.
 *
 * It is measured at `PLAY_LABEL_SIZE`, and that is the one place in this file
 * where the larger call site does not get its way. Two failures hide behind
 * "that label is too big":
 *
 * - **Clipping** - ink outside the box, which is simply gone (`labels.ts`,
 *   lesson 1). Geometry's to prevent, and prevented: `plotShape` sizes the
 *   drawing so the widest step label *and* the widest category label land
 *   inside the box **at report scale**, whatever was authored. Nothing here
 *   relaxes that.
 * - **Collision** - labels touching. Geometry cannot fix this one, so someone
 *   has to be told. Judged at play-screen scale because that is where the
 *   child reads the graph; the same labels do crowd each other in a 64px
 *   report thumbnail, which is a reminder of a question already answered.
 *
 * **It is deliberately self-referential**: `categoryChars` is the label being
 * judged, and a wider one narrows the plot it is judged against, so a label
 * over budget makes the budget it failed a little smaller. That is monotone
 * and it errs strict - it can refuse a label it would have allowed judged
 * against a roomier plot, never the reverse - which is the safe direction for
 * a check that decides whether a picture is legible.
 */
function categoryBudget(count: number, stepChars: number, categoryChars: number): number {
  const slot =
    (plotShape(stepChars, categoryChars).width * WIDTH_BAND[0] * DRAWN_SPAN) /
    Math.max(count, 1);
  return Math.floor(slot / (PLAY_LABEL_SIZE * CHAR_RATIO));
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
    // Measured at its true width, never clamped to `MAX_STEP_CHARS`: a label
    // budgeted narrower than it is drawn is the one thing worse than a wide
    // one, since the geometry then leaves room that does not exist. Too wide a
    // label is reported, and `MIN_PLOT_WIDTH` below keeps it drawable meanwhile.
    const stepChars = Math.max(...stepTexts.map((text) => text.length));
    const categoryChars = labelled
      ? Math.max(...values.map((_, index) => (names[index] ?? '').length))
      : 0;

    const plotWidth = plotShape(stepChars, categoryChars).width * jitter(rng, ...WIDTH_BAND);

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
      const width = text.length * CHAR_SHARE;
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

    // Read before the labels below, which need it: how tall the axis is drawn
    // decides how wide its own labels are, and that decides how much of the
    // width is left for a category's name.
    const scale = read(spec.scale, 'figure.scale', 'number');
    const max = values ? Math.max(...values.map((value) => Math.max(value, 0)), 0) : 0;
    const pinned = typeof scale === 'number' && scale > 0 ? scale : undefined;

    if (values) {
      // Asked of every label the axis will carry, not of the data and not of
      // the top rung - see `widestStepLabel` for why both of those are wrong.
      // Reported rather than clamped: `build` draws the label at its true width
      // and the plot narrows, which is honest, but nobody should ship a graph
      // like it. Named as a step label rather than as an axis top, because the
      // rung that does not fit is often not the top one.
      const rung = widestStepLabel(values, max, pinned);
      if (rung.length > MAX_STEP_CHARS) {
        issues.push(
          `figure.values: a step label reading ${rung} needs ${rung.length} characters` +
            ` beside the plot, more than the ${MAX_STEP_CHARS} it has room for`,
        );
      }

      // Whether the axis can be *read*, which measuring its ink cannot answer:
      // an axis of repeated labels fits its box perfectly. The all-zero case is
      // split out because it is the one reachable without pinning a scale, and
      // "every value is zero" is what its author actually did wrong - a
      // sentence about rounding would send them looking in the wrong place.
      if (max === 0) {
        if (!values.some((value) => value < 0)) {
          issues.push(
            'figure.values: every value is zero, so the graph has no bar to read' +
              ' and its axis is a single rung',
          );
        }
      } else {
        const repeated = repeatedStepLabel(values, max, pinned);
        if (repeated) {
          issues.push(
            `figure.values: a step of ${repeated.scale} makes two rungs of the axis both` +
              ` read ${repeated.text}, so it cannot be read as a scale`,
          );
        }
      }

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

    if (typeof scale === 'number') {
      if (scale <= 0) {
        issues.push(`figure.scale: ${scale} is not a step the axis can be counted in`);
      } else if (values && values.length > 0) {
        const steps = stepsFor(max, scale);
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

    const labels = read(spec.labels, 'figure.labels', 'string');
    if (typeof labels === 'string') {
      const names = parseLabels(labels);
      if (values && names.length !== values.length) {
        issues.push(`figure.labels: ${names.length} labels for ${values.length} values`);
      }
      const longest = names.reduce((a, b) => (b.length > a.length ? b : a), '');
      if (values && longest.length > 0) {
        // The widest label the axis could carry, so the budget is the one that
        // holds on every seed rather than on the lucky ones.
        const budget = categoryBudget(
          values.length,
          widestStepLabel(values, max, pinned).length,
          longest.length,
        );
        if (longest.length > budget) {
          issues.push(
            `figure.labels: ${JSON.stringify(longest)} needs ${longest.length} characters` +
              ` where ${values.length} categories leave room for ${budget} - shorten the` +
              ' labels, or graph fewer categories',
          );
        }
      }
    }

    const style = read(spec.style, 'figure.style', 'string');
    if (typeof style === 'string' && !(STYLES as readonly string[]).includes(style)) {
      issues.push(
        `figure.style: ${JSON.stringify(style)} is not a graph style` +
          ` (expected ${STYLES.slice(0, -1).join(', ')} or ${STYLES[STYLES.length - 1]})`,
      );
    }

    return issues;
  },
};

function line(from: Point, to: Point): Mark {
  return { kind: 'path', points: [from, to], closed: false, fill: false, dashed: false };
}
