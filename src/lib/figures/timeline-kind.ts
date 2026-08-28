import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { jitter, numberValue, readField } from './fields';
import { CHAR_SHARE, INK_SHARE, LABEL_DAYLIGHT, MIN_MARK_GAP_PX, REPORT_BOX_PX } from './labels';
import type { FigureKindModule } from './registry';
import { DRAWN_SPAN } from './labels';
import { FIGURE_BOX, type FigureSpec, type Mark, type Point } from './types';

/**
 * The `timeline` kind: a rule across the page with the two ends labelled with
 * their years, small ticks between them carrying the scale, and each event a
 * dot on the rule with a letter above it.
 *
 * It is a data display rather than a number line, which is why it is a kind of
 * its own: a number line is a scale with one value on it, and a timeline
 * carries **labelled events at positions**, so the questions it answers are
 * "how many years between A and B?", "which came first?" and "what year was
 * C?". Squeezing those into `number-line` would have been that kind growing a
 * second purpose, which is the thing the registry exists to avoid.
 *
 * ---
 *
 * **Two labelled years, not five, and that measurement is what shapes the
 * layout.** `CHAR_SHARE` is 0.105 of the line per character at report scale, so
 * a four-digit year costs 0.42 and the two ends alone take 84% of the width. A
 * third never fits, and a rule that labelled a middle rung only when the years
 * were short enough would make a timeline's readability depend on which century
 * it was about. So the ends are labelled, the ticks between them are not, and
 * the scale is read by counting - which is the shape `number-line` arrives at
 * from the other direction when a template pins a narrow window.
 *
 * ---
 *
 * **The layout is a frame of width exactly 1**, which is what makes
 * `labels.ts`' shares directly comparable with the geometry here: the fit's
 * scale is then `DRAWN_SPAN` and a report-scale character is `CHAR_SHARE` of
 * this file's own units. The height is never allowed near 1, so that stays
 * true - `labels.ts`' first precondition for this technique.
 *
 * **The rule is drawn from 0 to 1 whatever years it stands for, and the rungs
 * are inset by half the widest label's ink.** So the rule's own extent and the
 * outermost label's ink edge are *the same quantity*, with `CHAR_RATIO` on both
 * sides of it: clipping is impossible by construction rather than by a solved
 * inequality, which is `pictograph`'s technique and the one `figure-kind-author
 * -notes.md` says to reach for first. The inset is measured against the wider
 * of the two label families - the end years and the event letters - because
 * either can be the thing that reaches furthest.
 *
 * ---
 *
 * **Everything this kind jitters is an affine remap of the axis or a change of
 * proportion, so none of it can contradict an answer.** The questions a
 * timeline can be asked are about an event's year, the order of two events, the
 * gap between two, or how many fall either side of a point - every one a
 * function of the `years` and `labels` the template authored. Widening the
 * line, dividing it more finely and drawing longer ticks leave all four true,
 * which is why there is no `answerIssues` here: `bar`'s reason rather than an
 * omission.
 *
 * The lever that survives a template pinning `from`, `to` **and** `step` is the
 * tick and gap jitter alone, which is `number-line`'s position exactly - and it
 * carries `number-line`'s warning with it. That jitter is visible and says
 * nothing about the answer, so a fully pinned line is one *question* drawn many
 * ways. Move the variation into the content: a different stretch of history, a
 * different pair of events.
 */

type TimelineSpec = Extract<FigureSpec, { kind: 'timeline' }>;

/** Comparing years and lattice positions that came out of floating-point arithmetic. */
const EPSILON = 1e-9;

/**
 * How far apart two ticks have to be in this kind's own frame units to read as
 * two marks rather than one thick one. The conversion is `number-line`'s,
 * written again rather than shared because what a pixel of daylight costs *a
 * line of this width* is this kind's arithmetic - `labels.ts` keeps the fact
 * about the report row and each kind spends it in its own frame.
 */
const MIN_TICK_GAP = (MIN_MARK_GAP_PX / REPORT_BOX_PX) * (FIGURE_BOX / DRAWN_SPAN);

/**
 * The most divisions a line can be cut into and still be counted along in a
 * 64px report row - derived from the gap above rather than chosen, and measured
 * against the *rungs'* span rather than the whole frame, since the inset the
 * labels take is not line a child can count on.
 */
const MAX_INTERVALS = Math.floor(1 / MIN_TICK_GAP);

/**
 * Fewer than two divisions is a line with nothing between its ends, where the
 * only thing a child could read is the two labels - which is the picture that
 * makes the figure decoration and the question a subtraction.
 */
const MIN_INTERVALS = 2;

/** The divisions a line is cut into when none is pinned - round years, coarsest first. */
const STEP_LADDER = [1000, 500, 250, 200, 100, 50, 25, 20, 10, 5, 2, 1] as const;

/**
 * How far past the outermost events the line runs, in divisions. **It never
 * runs to zero**, so an end label is never sitting on an event: a timeline
 * whose first dot is under the `1900` would answer "what year was A?" with its
 * own axis. Three choices at each end is the span jitter - what share of the
 * line the events occupy, which the centring fit cannot normalise away.
 */
const OVERSHOOT = [1, 2, 3] as const;

/**
 * A minor tick's length as a share of the frame, and the ratio the two labelled
 * end rungs are drawn longer at. The band is the jitter that is always
 * available - a template may pin both ends and the division, and the drawing
 * still has to differ between two seeds.
 */
const TICK_BAND = [0.06, 0.11] as const;
const MAJOR_RATIO = 1.8;

/** How far above the rule an event's letter sits - the second always-available jitter. */
const EVENT_GAP_BAND = [0.1, 0.17] as const;

/** From the foot of an end rung to its year, clear of half a line of the year's own ink. */
const YEAR_GAP = INK_SHARE / 2 + 0.01;

/** Where a `years` nobody could read lands - still a timeline, just not the asked one. */
const FALLBACK_YEARS = [1900, 1940, 1960];

/** The letters an event gets when the template named none. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * A hard stop on how much is drawn at all, well past what `issues` reports.
 * `parseFigure` refuses a figure over `MAX_MARKS` (200) when it is read back
 * out of an `Attempt`, so a line pinned `from: 0, to: 2000, step: 1` would
 * otherwise draw two thousand ticks and could never be shown again in a
 * parent's report.
 *
 * **This is the storage-cap exception `labels.ts` names**, and it is safe only
 * because it is unreachable by anything that validates: `MAX_INTERVALS` is 18
 * against 40 here, and `eventBudget` never returns more than 9 against 20. Keep
 * both halves if you copy it - the slice *and* a reported limit well inside it.
 */
const MAX_DRAWN_TICKS = MAX_INTERVALS * 2;
const MAX_DRAWN_EVENTS = 20;

/** One end of the line, and the pair of them is what the frame's inset is measured from. */
interface Line {
  from: number;
  to: number;
  step: number;
}

/**
 * The year as it is **drawn**, which is the string the inset is measured
 * against - `labels.ts`' first question about a derived label. A year is an
 * integer in every timeline anyone teaches, but `from` and `to` are
 * expressions, so the tail a float would leave is rounded off here rather than
 * being allowed to print twenty characters of it.
 */
function formatYear(year: number): string {
  return String(Math.round(year * 1000) / 1000 + 0);
}

/** Whether a year sits on a tick of this line - the test that makes it readable. */
function onLattice(year: number, from: number, step: number): boolean {
  if (!(step > 0)) return false;
  const steps = (year - from) / step;
  return Math.abs(steps - Math.round(steps)) < EPSILON;
}

/**
 * Half the widest label's ink, which is exactly how far inside the rule's own
 * ends the outermost rung and the outermost event have to sit. Measured against
 * both label families at once: the end years are usually the wider, and a
 * two-character event letter at the very end of the line is what makes that
 * *usually* rather than *always*.
 */
function insetFor(line: Line, eventChars: number): number {
  const yearChars = Math.max(formatYear(line.from).length, formatYear(line.to).length);
  return (Math.max(yearChars, eventChars) * CHAR_SHARE) / 2;
}

/** Where a year lands across the frame, between the two rungs the inset leaves room for. */
function positionFor(year: number, line: Line, inset: number): number {
  const span = line.to - line.from;
  const across = span === 0 ? 0.5 : (year - line.from) / span;
  return inset + across * (1 - 2 * inset);
}

/** Whether every neighbouring pair of events is drawn far enough apart to read as two. */
function lettersStandApart(
  years: readonly number[],
  line: Line,
  inset: number,
  eventChars: number,
): boolean {
  return closestPair(years, line, inset) >= letterPitch(eventChars) - EPSILON;
}

/** How far apart the nearest two events are drawn on this line, in frame units. */
function closestPair(years: readonly number[], line: Line, inset: number): number {
  const xs = years.map((year) => positionFor(year, line, inset)).sort((a, b) => a - b);
  let closest = Infinity;
  for (let index = 1; index < xs.length; index++) closest = Math.min(closest, xs[index] - xs[index - 1]);
  return closest;
}

/**
 * The lines this timeline could be drawn on. A pinned field is always kept - it
 * is the author's statement about which stretch of history the question is
 * about, and anything wrong with it is *reported* rather than overridden.
 *
 * Left open, a division is taken from the ladder coarsest first and the two
 * ends from `OVERSHOOT`, keeping every combination that puts a tick under every
 * event and still reads at report scale. `build` picks one of those with a
 * single draw and `issues` asks all of them, so a bad line anywhere in the list
 * is a picture some child will meet.
 */
function linesFor(
  years: readonly number[],
  eventChars: number,
  pinned: { from?: number; to?: number; step?: number },
): Line[] {
  const lo = Math.min(...years);
  const hi = Math.max(...years);

  const steps =
    pinned.step !== undefined
      ? [pinned.step]
      : STEP_LADDER.filter((step) => years.every((year) => onLattice(year, lo, step)));

  const lines: Line[] = [];
  for (const step of steps) {
    if (!(step > 0)) continue;
    const froms = pinned.from !== undefined ? [pinned.from] : OVERSHOOT.map((n) => lo - n * step);
    const tos = pinned.to !== undefined ? [pinned.to] : OVERSHOOT.map((n) => hi + n * step);

    for (const from of froms) {
      for (const to of tos) {
        const line = { from, to, step };
        if (!(to > from)) continue;
        if (from > lo + EPSILON || to < hi - EPSILON) continue;
        const intervals = (to - from) / step;
        if (Math.abs(intervals - Math.round(intervals)) > EPSILON) continue;
        if (intervals < MIN_INTERVALS || intervals > MAX_INTERVALS) continue;
        if (!years.every((year) => onLattice(year, from, step))) continue;
        // The ticks have to be countable along the stretch the *rungs* get,
        // which is what the labels' inset left over rather than the whole frame.
        const inset = insetFor(line, eventChars);
        if ((1 - 2 * inset) / intervals < MIN_TICK_GAP - EPSILON) continue;
        // And the events themselves have to stand apart on it. This is a
        // filter rather than a report because it is a limit the geometry can
        // honour by choosing differently: a wider line spreads the same events
        // further, so the builder picks a line that works and `issues` speaks
        // only when there is none.
        if (!lettersStandApart(years, line, inset, eventChars)) continue;
        lines.push(line);
      }
    }
  }
  return lines;
}

/**
 * A line to draw when nothing in `linesFor` survived - reported by `issues`, and
 * still something a child can look at rather than an empty box. It honours
 * whatever was pinned, so the picture in front of the child is the one the
 * author asked for even where that picture is the mistake.
 */
function fallbackLine(years: readonly number[], pinned: { from?: number; to?: number; step?: number }): Line {
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  const step = pinned.step !== undefined && pinned.step > 0 ? pinned.step : Math.max((hi - lo) / 4, EPSILON);
  return {
    from: pinned.from !== undefined ? pinned.from : lo - step,
    to: pinned.to !== undefined ? pinned.to : hi + step,
    step,
  };
}

/**
 * How far apart two events' letters have to be drawn to read as two letters -
 * their own half-widths plus `LABEL_DAYLIGHT`'s clear air, which is the spacing
 * `number-line` gives the numbers under its ticks and `grid` the names under
 * its columns. **It is about three times `MIN_TICK_GAP`**, so what limits a
 * timeline is almost always its letters and hardly ever its ticks: two events
 * on neighbouring divisions collide long before the divisions themselves do.
 */
function letterPitch(chars: number): number {
  return (chars + LABEL_DAYLIGHT) * CHAR_SHARE;
}

/**
 * The most events a line of *this* timeline can carry and still be read.
 *
 * **Settled by the data rather than by the geometry**, so it is a per-figure
 * budget computed from the layout this figure will actually get, and reported
 * with its number - `labels.ts`' sixth section. It is what the pitch above
 * comes to over the stretch the labels' inset left the rungs.
 */
function eventBudget(inset: number, eventChars: number): number {
  const across = Math.max(1 - 2 * inset, 0);
  return Math.max(1, Math.floor(across / letterPitch(eventChars)) + 1);
}

/**
 * The most characters an event's own label may carry - **three**, for years of
 * any width, which is why the letter beside a dot is a key and not a name.
 *
 * **Derived against the widest line this kind can actually draw, not against
 * the frame.** A label that merely fits inside the rule is not enough: two of
 * them have to stand apart on some line that also has countable ticks, and
 * those two pull opposite ways - the further apart two events are drawn, the
 * more divisions lie between them and the finer those divisions get. So the
 * best case is the most divisions still legible at report scale, with the two
 * events at either end of them and the overshoot at its smallest.
 *
 * Written this way because the obvious version - "does the label fit between
 * the rule's ends" - is optimistic by a character, and `bar`'s
 * `MAX_LABEL_CHARS` is the cautionary tale: a limit dressed as derived that was
 * ~2x wrong, reported cleanly, and sent authors to the wrong field.
 */
function eventCharBudget(yearChars: number): number {
  const fits = (chars: number): boolean => {
    const across = 1 - Math.max(yearChars, chars) * CHAR_SHARE;
    const intervals = Math.floor(across / MIN_TICK_GAP);
    if (intervals < MIN_INTERVALS) return false;
    // Two events, one division of overshoot at each end: the widest apart this
    // kind ever draws a pair.
    return ((intervals - 2) / intervals) * across >= letterPitch(chars) - EPSILON;
  };
  let chars = 1;
  while (chars < 16 && fits(chars + 1)) chars++;
  return chars;
}

/** The comma-joined list, or nothing at all - `Number('')` is 0, so a hole is a typo. */
function parseYears(text: string): number[] | null {
  const parts = text.split(',').map((part) => part.trim());
  if (parts.some((part) => part === '')) return null;
  const years = parts.map(Number);
  return years.every((year) => Number.isFinite(year)) ? years : null;
}

function parseLabels(text: string): string[] {
  return text.split(',').map((part) => part.trim());
}

/** The letters, whether the template named them or left them to run A, B, C. */
function lettersFor(names: readonly string[], count: number): string[] {
  return Array.from({ length: count }, (_, index) => names[index] ?? ALPHABET[index % 26]);
}

function open(from: Point, to: Point): Mark {
  return { kind: 'path', points: [from, to], closed: false, fill: false, dashed: false };
}

export const timelineModule: FigureKindModule<'timeline'> = {
  kind: 'timeline',

  // Only the years are required - they are the question. Omitting `labels`
  // letters the events A, B, C; omitting the two ends and the division is what
  // asks for whichever line the events allow, which is this kind's variation.
  fields: {
    years: 'required',
    labels: 'optional',
    from: 'optional',
    to: 'optional',
    step: 'optional',
  },

  build(spec: TimelineSpec, scope: Scope, rng: Rng): Mark[] {
    const read = readField(spec.years, scope);
    const parsed = typeof read === 'string' ? parseYears(read) : null;
    const years = (parsed ?? FALLBACK_YEARS).slice(0, MAX_DRAWN_EVENTS);

    const readLabels = readField(spec.labels, scope);
    const names = typeof readLabels === 'string' ? parseLabels(readLabels) : [];
    const letters = lettersFor(names, years.length);
    const eventChars = Math.max(...letters.map((letter) => letter.length), 1);

    const pinned = {
      from: numberValue(readField(spec.from, scope)),
      to: numberValue(readField(spec.to, scope)),
      step: numberValue(readField(spec.step, scope)),
    };

    const candidates = linesFor(years, eventChars, pinned);
    // Exactly one draw whichever path this takes, pinned or not - see `bar`'s
    // `scaleFor` for why a figure that spends a variable number of draws
    // reshuffles the distractors of the very question it illustrates.
    const line = rng.pick(candidates.length > 0 ? candidates : [fallbackLine(years, pinned)]);
    const inset = insetFor(line, eventChars);

    const tick = jitter(rng, ...TICK_BAND);
    const eventGap = jitter(rng, ...EVENT_GAP_BAND);
    const major = tick * MAJOR_RATIO;

    // The rule first, because it is what the fit measures the drawing by: every
    // label's ink ends inside it, so nothing here can be clipped.
    const marks: Mark[] = [open([0, 0], [1, 0])];

    const intervals = Math.min(
      Math.max(Math.round((line.to - line.from) / line.step), 1),
      MAX_DRAWN_TICKS,
    );
    for (let index = 0; index <= intervals; index++) {
      const year = line.from + index * line.step;
      const end = index === 0 || index === intervals ? major : tick;
      marks.push(open([positionFor(year, line, inset), 0], [positionFor(year, line, inset), -end]));
    }

    for (const end of [line.from, line.to]) {
      marks.push({
        kind: 'label',
        at: [positionFor(end, line, inset), -(major + YEAR_GAP)],
        text: formatYear(end),
      });
    }

    years.forEach((year, index) => {
      const x = positionFor(year, line, inset);
      marks.push({ kind: 'dot', at: [x, 0] });
      const letter = letters[index];
      if (letter !== '') marks.push({ kind: 'label', at: [x, eventGap], text: letter });
    });

    return marks;
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const raw = read(spec.years, 'figure.years', 'string', true);
    const years = typeof raw === 'string' ? parseYears(raw) : null;

    if (typeof raw === 'string' && !years) {
      issues.push(`figure.years: ${JSON.stringify(raw)} is not a comma-separated list of numbers`);
    }

    const pinned = {
      from: numberValue(read(spec.from, 'figure.from', 'number')),
      to: numberValue(read(spec.to, 'figure.to', 'number')),
      step: numberValue(read(spec.step, 'figure.step', 'number')),
    };

    if (pinned.step !== undefined && pinned.step <= 0) {
      issues.push(`figure.step: ${pinned.step} is not a number of years a tick can be worth`);
    }
    if (pinned.from !== undefined && pinned.to !== undefined && pinned.to <= pinned.from) {
      issues.push(`figure.to: ${formatYear(pinned.to)} is not after ${formatYear(pinned.from)}`);
    }

    const labels = read(spec.labels, 'figure.labels', 'string');
    const names = typeof labels === 'string' ? parseLabels(labels) : [];

    if (!years) return issues;

    if (years.length < 2) {
      issues.push(
        'figure.years: a timeline needs at least two events to read between,' +
          ` and this one has ${years.length}`,
      );
      return issues;
    }

    // Two events on one dot: the whole figure says one thing where the question
    // is about two. No amount of measuring ink finds it - `pictograph`'s
    // identical rows in another costume.
    const twice = years.find((year, index) => years.indexOf(year) !== index);
    if (twice !== undefined) {
      issues.push(
        `figure.years: ${formatYear(twice)} happens twice, so two events are drawn as one dot`,
      );
    }

    const letters = lettersFor(names, years.length);
    const eventChars = Math.max(...letters.map((letter) => letter.length), 1);
    const yearChars = Math.max(...years.map((year) => formatYear(year).length));

    if (typeof labels === 'string') {
      if (names.length !== years.length) {
        issues.push(`figure.labels: ${names.length} labels for ${years.length} events`);
      }
      const longest = names.reduce((a, b) => (b.length > a.length ? b : a), '');
      const room = eventCharBudget(yearChars);
      if (longest.length > room) {
        issues.push(
          `figure.labels: ${JSON.stringify(longest)} needs ${longest.length} characters beside` +
            ` a dot, more than the ${room} the widest line this kind draws has room for` +
            ' - a letter the prompt names is what a timeline labels with,' +
            ' never the name of the event',
        );
        return issues;
      }
    }

    // The pinned ends are judged against the events before any line is looked
    // for, because a line that does not reach an event has an unanswerable
    // question on it whatever else is right.
    const lo = Math.min(...years);
    const hi = Math.max(...years);
    if (pinned.from !== undefined && pinned.from > lo + EPSILON) {
      issues.push(
        `figure.from: ${formatYear(pinned.from)} is later than ${formatYear(lo)},` +
          ' the earliest event, so the line does not reach it',
      );
    }
    if (pinned.to !== undefined && pinned.to < hi - EPSILON) {
      issues.push(
        `figure.to: ${formatYear(pinned.to)} is earlier than ${formatYear(hi)},` +
          ' the latest event, so the line does not reach it',
      );
    }
    if (pinned.step !== undefined && pinned.step > 0) {
      const floating = years.find((year) => !onLattice(year, pinned.from ?? lo, pinned.step!));
      if (floating !== undefined) {
        issues.push(
          `figure.step: a division of ${formatYear(pinned.step)} puts no tick under` +
            ` ${formatYear(floating)}, so its year cannot be counted to`,
        );
      }
    }

    if (issues.length > 0) return issues;

    // Only now, when everything nameable is clean: is there a line at all? The
    // reason is worked out rather than reported as "no line", because "no line"
    // sends an author to the one field that is fine.
    if (linesFor(years, eventChars, pinned).length === 0) {
      issues.push(whyNoLine(years, eventChars, pinned));
    }

    return issues;
  },
};

/**
 * Why nothing in `linesFor` survived, in words an author can act on. It reads
 * the *best* line available rather than any particular one: the coarsest
 * division that puts a tick under every event, run as tightly around the events
 * as the overshoot allows, since anything that fails there fails everywhere.
 */
function whyNoLine(
  years: readonly number[],
  eventChars: number,
  pinned: { from?: number; to?: number; step?: number },
): string {
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  const steps =
    pinned.step !== undefined
      ? [pinned.step]
      : STEP_LADDER.filter((step) => years.every((year) => onLattice(year, lo, step)));

  if (steps.length === 0) {
    return (
      `figure.years: no round division of the line puts a tick under all of ${years.join(', ')},` +
      ' so the gaps between them cannot be counted'
    );
  }

  const step = steps[0];
  const line = {
    from: pinned.from ?? lo - step,
    to: pinned.to ?? hi + step,
    step,
  };
  const intervals = Math.round((line.to - line.from) / step);
  const inset = insetFor(line, eventChars);

  if (intervals > MAX_INTERVALS || (1 - 2 * inset) / intervals < MIN_TICK_GAP - EPSILON) {
    return (
      `figure.step: a division of ${formatYear(step)} cuts the line into ${intervals} parts,` +
      ` more than the ${MAX_INTERVALS} that can be counted apart in a report` +
      ' - a coarser division, or a shorter stretch of years'
    );
  }

  const apart = years
    .slice()
    .sort((a, b) => a - b)
    .map((year, index, sorted) => [sorted[index - 1], year] as const)
    .slice(1)
    .reduce((nearest, pair) => (pair[1] - pair[0] < nearest[1] - nearest[0] ? pair : nearest));

  const holds = eventBudget(inset, eventChars);
  return (
    `figure.years: ${formatYear(apart[0])} and ${formatYear(apart[1])} are drawn closer than two` +
    ` letters can be told apart, on the tightest line that reaches them both` +
    ` - it holds ${holds} ${holds === 1 ? 'event' : 'events'}, spread further apart`
  );
}
