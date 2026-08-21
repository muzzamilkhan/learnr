import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { jitter, numberValue, readField, truthy } from './fields';
import { CHAR_SHARE, INK_SHARE } from './labels';
import type { FigureKindModule } from './registry';
import { FIGURE_BOX, FIGURE_PADDING, type FigureSpec, type Mark, type Point } from './types';

/**
 * The `clock` kind: an analogue face, two hands and the time they tell. Telling
 * the time is a picture question end to end - "what time is this?" has no hole
 * in the sentence to fill, and a prompt that described the face would be
 * reading the answer out.
 *
 * **Both hands come from the bound scope, and nothing here reads the system
 * clock.** Everything in `src/lib` is pure - `now` and the `Rng` are always
 * injected - and the one kind that draws a clock face is the one where reaching
 * for `Date.now()` would look plausible. It would also be an anchoring failure
 * of a new sort: a question whose answer changed while the child was reading it.
 *
 * ---
 *
 * ## The anchoring case here is the inverse of every kind before it
 *
 * `validateTemplate` draws a figure fifty times and fails any answer that
 * always produced the same picture (`types.ts`). Every other kind answers that
 * by moving the thing being drawn - a spinner turns, a number line reframes its
 * range. **Three o'clock is three o'clock.** The hands *are* the answer, so
 * they may not move at all, and every drop of variation has to come from the
 * face around them:
 *
 * 1. **Whether the numerals are drawn** (`numerals`, omitted, jitters).
 * 2. **Whether the minute track is drawn** (`minuteTicks`, omitted, jitters).
 * 3. **How long each hand is drawn**, as a share of the dial's radius - two
 *    continuous jitters, and **the two that survive a template pinning both of
 *    the above**, which is the case the notes insist on. They are proportions
 *    of a frame the rim pins, so the uniform, centring `fit` cannot normalise
 *    them away. Measured over sixty seeds, the hour hand is drawn anywhere from
 *    0.400 to 0.517 of the dial and the minute hand from 0.760 to 0.919 - a
 *    third again and a fifth again - which is a difference a child sees rather
 *    than one only `JSON.stringify` can find.
 *
 * **What deliberately does not vary**, and both would draw a different time
 * rather than a different picture:
 *
 * - **The rotation of the face.** Twelve is at the top of every clock a child
 *   will ever read, and a dial turned even slightly is not a clock, it is a
 *   different time. This is the one kind here with no rotation lever, which is
 *   why the face levers above have to carry the whole rule.
 * - **The overall radius.** The section-3 trap: `fit` is uniform and centring,
 *   so a bigger dial is the same drawing. Only the *proportions* inside it -
 *   which is what the hand lengths are - survive.
 *
 * ---
 *
 * ## What a report row can hold, and the time it costs this kind
 *
 * A figure is built **once** and drawn both on the play screen and in a 64px
 * row of a parent's report at a 1.5px stroke (`progress-topics.tsx`);
 * `buildFigure`'s signature carries no scale, so the smaller surface governs
 * anything a reading depends on. `spinner-kind.ts` argues it from the
 * architecture and `number-line-kind.ts` follows it for the marks a child
 * counts along, which is exactly what a clock's are.
 *
 * Measured on that row: the dial's fitted radius is 28.16 real pixels, so
 * **sixty minute ticks land 2.95px apart against a 1.5px stroke** - under the
 * two stroke widths (`MIN_MARK_GAP_PX`) that `number-line` derived for two
 * ticks being two ticks rather than one band. The twelve hour marks land
 * 14.7px apart and are countable with room to spare.
 *
 * Two consequences, and they are the whole shape of this kind:
 *
 * - **The minute hand may only stand on an hour mark**, so `minute` has to be a
 *   multiple of `MINUTE_STEP` (5). A minute the face cannot express is
 *   **reported and never snapped** - moving 37 onto the mark next door would
 *   draw a time the template did not ask for and mark a right answer wrong,
 *   which is `number-line`'s lesson about an arrow between two ticks in a
 *   clock's clothes. `build` still draws the minute it was given, because it
 *   never refuses and a child is waiting; `issues` is what stops it shipping.
 * - **The minute track therefore carries no answer**, which is what makes it a
 *   free jitter. On the play screen it is a real minute track; in a report row
 *   it reads as a band round the rim, and nothing is lost there because nothing
 *   was ever read off it. That is `bar`'s argument for judging its category
 *   labels at play scale - "a reminder of a question already answered" - and it
 *   applies here only because the step above made it true.
 *
 * `MINUTE_STEP` is written as that measurement rather than as the number 5: if
 * the report row ever grew, or the stroke thinned, the ticks would become
 * countable and this kind would draw every minute without anyone editing a
 * constant.
 *
 * ## The numerals, and the three questions they owe
 *
 * The numerals are *derived* - they are computed from the hour positions, not
 * authored - so `labels.ts`' three questions are all live.
 *
 * 1. **Is it the label that gets drawn?** Every measurement below folds over
 *    `String(n)`, the text the mark carries, and never over the hour it came
 *    from. That is what makes `12` two characters and `3` one.
 * 2. **Does all of it fit?** `NUMERAL_RADIUS` is the rim less the widest
 *    numeral's report-scale ink reach, whichever way round the ring that
 *    numeral is turned - so its ink lands inside the rim, and the rim is what
 *    `fit` bounded the drawing by. Containment is then an identity rather than
 *    a solved inequality, which is the technique `pictograph` found and
 *    `labels.ts` recommends. Measured over the sweep, the worst numeral's ink
 *    lands 9.52 units inside the box, where `FIGURE_PADDING` alone would have
 *    been 6 - so `FIGURE_PADDING` is never asked to pay for a numeral at all.
 * 3. **Is it still distinct from its neighbour?** And this is the question that
 *    decided **which** numerals a face carries. The twelve of them cannot be
 *    drawn: the ring can be no further out than `RADIUS - CHAR_SHARE`
 *    (question 2), and two-character numerals 30 degrees apart at the top of
 *    that ring - the 11 and the 12 - are 0.197 units apart where their own ink
 *    needs 0.211, before any daylight at all. Separating them would need a ring
 *    at 0.422 against the 0.395 that fits, so no radius satisfies both. They
 *    overlap, at report scale, on a face that looks perfectly correct.
 *    **The four quarter numerals are what fits**: 90 degrees apart, distinct as
 *    text, and clear of one another by more than twice their own ink. It is a
 *    real clock design and a real cost - a template cannot ask a child to read
 *    a face numbered all the way round - and it is written here rather than
 *    left to be discovered, because "draw all twelve" is the obvious edit.
 *
 * A numeral is drawn **last**, so a hand pointing at one passes under it rather
 * than crossing it out - marks are painted in the order they are returned
 * (`diagram.tsx`), and the minute hand stands on a numeral at every quarter.
 *
 * ## The frame is pinned, so the fit is the same on every seed
 *
 * The rim is sampled at `RIM_POINTS` fixed angles and `RIM_POINTS` is a
 * multiple of four, so the polygon has a vertex at each of 0, 90, 180 and 270
 * degrees and its bounding box is exactly the dial's on every seed - both
 * halves of `spinner`'s precondition 3, which is where that was measured.
 * Everything else is drawn inside the rim, numeral *anchors* included. That is
 * what stops the hand-length jitter being scaled straight back out by the
 * centring fit, and it is why the layout is a frame exactly 1 across: the fit's
 * scale is then exactly `DRAWN_SPAN`, which is what makes `labels.ts`' shares
 * directly comparable with the geometry here.
 */

type ClockSpec = Extract<FigureSpec, { kind: 'clock' }>;

/** The dial, before `fit` scales the drawing into the box. Half of 1, so the frame is exactly 1 across. */
const RADIUS = 0.5;

/**
 * How many points the rim is sampled at. **A multiple of four**, and sampled
 * from a fixed zero: that is what puts a vertex on each axis and makes the
 * fitted bounds the same on every seed. Seventy-two is 5 degrees a step, which
 * at the report's ~28px radius bulges 0.03px inside the true circle.
 */
const RIM_POINTS = 72;

const HOURS = 12;
const MINUTES_PER_HOUR = 60;
/** How many minutes one hour mark stands for - a fact about clocks, not a choice. */
const MINUTES_PER_HOUR_MARK = MINUTES_PER_HOUR / HOURS;

/**
 * A parent's report draws this figure in a 64px square at a stroke of 1.5 real
 * pixels (`progress-topics.tsx`), against the play screen's whole question
 * area. Both numbers are exact rather than estimated - the report row is
 * `h-16 w-16` and passes `strokeWidth={1.5}`.
 */
const REPORT_BOX_PX = 64;
const REPORT_STROKE_PX = 1.5;

/** What `fit` leaves the drawing, and so the dial's radius, in the box's units. */
const FITTED_RADIUS = (FIGURE_BOX - 2 * FIGURE_PADDING) / 2;

/** The dial's radius in a report row's own real pixels. */
const REPORT_RADIUS_PX = (FITTED_RADIUS / FIGURE_BOX) * REPORT_BOX_PX;

/**
 * How far apart two marks round the rim have to be to read as two marks: two
 * stroke widths, so a whole stroke of daylight stands between them. Closer than
 * that and a child counting round the dial in a report row is counting a band.
 * `number-line-kind.ts`'s `MIN_TICK_GAP` is the same quantity for a straight
 * line, derived the same way.
 */
export const MIN_MARK_GAP_PX = REPORT_STROKE_PX * 2;

/**
 * Centre to centre of two neighbouring marks, in a report row's real pixels,
 * for a rim divided into this many of them.
 *
 * **Exported because it is the argument this kind is built on**, in the spirit
 * of `sectorAngles` being a spinner's fairness: which times a clock may show is
 * decided by this number and by nothing else, and a limit nobody can re-run is
 * a limit that becomes a magic constant the first time somebody edits around it.
 */
export function reportMarkPitchPx(marks: number): number {
  return (2 * Math.PI * REPORT_RADIUS_PX) / marks;
}

/**
 * The finest run of marks the minute hand may be read against, in minutes.
 *
 * Written as the measurement rather than as a five: the minute ticks are 2.95px
 * apart in a report row against a 1.5px stroke, under `MIN_MARK_GAP_PX`, so
 * only the twelve hour marks can be counted and a minute has to land on one of
 * them. Were the row ever drawn bigger this would become 1 on its own.
 */
export const MINUTE_STEP =
  reportMarkPitchPx(MINUTES_PER_HOUR) >= MIN_MARK_GAP_PX ? 1 : MINUTES_PER_HOUR_MARK;

/**
 * The numerals a face carries when it carries any: the quarters, and **not all
 * twelve**. See the module comment - twelve two-character numerals overlap at
 * report scale on a ring that also has to keep its own ink inside the dial, and
 * there is no radius that satisfies both.
 */
const NUMERALS = [12, 3, 6, 9] as const;

/**
 * Half the ink of the widest numeral that will be drawn, whichever way round
 * the ring it is turned - the width where it sits east or west, the height
 * where it sits north or south. Folded over the *text*, never over the hour it
 * came from, which is `labels.ts`' first question.
 */
const NUMERAL_INK_REACH = Math.max(
  ...NUMERALS.map((numeral) => Math.max((String(numeral).length * CHAR_SHARE) / 2, INK_SHARE / 2)),
);

/** The ring the numerals stand on: as far out as their own ink still fits inside the dial. */
const NUMERAL_RADIUS = RADIUS - NUMERAL_INK_REACH;

/**
 * How far the two hands reach, as shares of the dial's radius. Bands rather than
 * numbers: this is the jitter that survives a template pinning both face
 * fields, so it is the whole of this kind's answer to the anchoring rule when
 * an author pins everything they can.
 *
 * They are disjoint by more than `MIN_HAND_DIFFERENCE`, which is what keeps the
 * hour hand readable as the shorter one - length is the only thing telling the
 * two apart, since `Mark` carries no stroke width. The minute hand stops short
 * of the rim and reaches about as far as the numeral ring, which is what an
 * analogue clock does - and the numerals are drawn last, so one it is pointing
 * at sits over it rather than being crossed out by it.
 */
const HOUR_HAND_BAND = [0.4, 0.52] as const;
const MINUTE_HAND_BAND = [0.76, 0.92] as const;

/**
 * How much longer the minute hand must be than the hour hand: three stroke
 * widths at report scale, as a share of the dial's radius. Derived rather than chosen,
 * for the reason `MIN_MARK_GAP_PX` is - it is about ink.
 *
 * Exported with the gap the bands actually leave, because that relationship is
 * between three constants and moving any one of them is what breaks it -
 * `clock-kind.test.ts` asserts it rather than assuming it.
 */
export const MIN_HAND_DIFFERENCE = (REPORT_STROKE_PX * 3) / REPORT_RADIUS_PX;

/** The shortest the minute hand is, less the longest the hour hand is. */
export const HAND_LENGTH_GAP = MINUTE_HAND_BAND[0] - HOUR_HAND_BAND[1];

/** How far the marks round the rim reach inward, as shares of the dial's radius. */
const HOUR_TICK = 0.14;
const MINUTE_TICK = 0.07;

/** Where a time nobody could read lands - still a clock, just not the asked one. */
const FALLBACK_HOUR = 3;
const FALLBACK_MINUTE = 0;

/**
 * Where the two hands point, in degrees **clockwise from twelve** - the frame a
 * clock is read in, not the frame it is drawn in.
 *
 * **Exported because it is the time the picture tells**, in the same spirit as
 * `sectorAngles` being a spinner's fairness: whether the hour hand really sits
 * half way between the 3 and the 4 at half past three cannot be read off a
 * fitted figure, where every coordinate has been scaled and rounded.
 *
 * The hour hand **carries on past the hour as the minutes pass** - it is the
 * whole hour in minutes plus the minutes, halved, so 3:30 is 105 degrees and
 * not 90. A face that left it on the three at half past would be drawing a time
 * that does not exist, and would look perfectly correct doing it.
 */
export function handAngles(hour: number, minute: number): { hour: number; minute: number } {
  return {
    hour: ((hour % HOURS) * MINUTES_PER_HOUR + minute) / 2,
    minute: minute * (360 / MINUTES_PER_HOUR),
  };
}

/**
 * A clock angle in the frame the builder draws in.
 *
 * **The one place the two frames meet.** A clock runs clockwise from twelve;
 * `build` returns marks in the maths frame - x right, y up, degrees
 * anticlockwise from east - which `fit` turns over on the way out. It is one
 * named function rather than a `90 - x` scattered through the file because
 * getting it backwards draws every time mirrored, and a mirrored clock still
 * looks like a clock.
 */
export function dialDirection(clockwiseFromTwelve: number): number {
  return 90 - clockwiseFromTwelve;
}

/** A point on the dial at a clock angle, at this fraction of the way out. */
function onDial(clockwiseFromTwelve: number, radius: number): Point {
  const radians = (dialDirection(clockwiseFromTwelve) * Math.PI) / 180;
  return [Math.cos(radians) * radius, Math.sin(radians) * radius];
}

function rule(from: Point, to: Point): Mark {
  return { kind: 'path', points: [from, to], closed: false, fill: false, dashed: false };
}

/**
 * The dial itself, and the reason the fit never moves: fixed sample angles,
 * four of them exactly on the axes, so the bounding box is the circle's
 * whatever is drawn inside it.
 */
function rimPath(): Mark {
  return {
    kind: 'path',
    points: Array.from({ length: RIM_POINTS }, (_, index) => onDial((index * 360) / RIM_POINTS, RADIUS)),
    closed: true,
    fill: false,
    dashed: false,
  };
}

/** One mark round the rim, reaching inward. */
function tickAt(clockwiseFromTwelve: number, length: number): Mark {
  return rule(onDial(clockwiseFromTwelve, RADIUS), onDial(clockwiseFromTwelve, RADIUS - length));
}

/** One hand: the centre out to where the time points. */
function handAt(clockwiseFromTwelve: number, length: number): Mark {
  return rule([0, 0], onDial(clockwiseFromTwelve, length));
}

/**
 * The hour a face will show. **Wrapped round the dial rather than clamped**,
 * because 0 and 13 are real twenty-four hour readings of twelve and one, and
 * clamping would draw two different hours as the same one. Both are reported.
 */
function hourOf(value: number | undefined): number {
  if (value === undefined) return FALLBACK_HOUR;
  const whole = Math.round(value);
  return (((whole - 1) % HOURS) + HOURS) % HOURS + 1;
}

/**
 * The minute a face will show. Wrapped for `hourOf`'s reason - and **never
 * snapped to `MINUTE_STEP`**: a minute the face cannot express is reported, and
 * quietly moving it onto the mark next door would draw a time the template did
 * not ask for and mark a right answer wrong.
 */
function minuteOf(value: number | undefined): number {
  if (value === undefined) return FALLBACK_MINUTE;
  const whole = Math.round(value);
  return ((whole % MINUTES_PER_HOUR) + MINUTES_PER_HOUR) % MINUTES_PER_HOUR;
}

export const clockModule: FigureKindModule<'clock'> = {
  kind: 'clock',

  // Both hands are required - they are the answer, and the one thing the
  // builder cannot invent. Omitting either face field is what asks for it to
  // jitter, which is where all of this kind's variation comes from.
  fields: {
    hour: 'required',
    minute: 'required',
    numerals: 'optional',
    minuteTicks: 'optional',
  },

  build(spec: ClockSpec, scope: Scope, rng: Rng): Mark[] {
    const hour = hourOf(numberValue(readField(spec.hour, scope)));
    const minute = minuteOf(numberValue(readField(spec.minute, scope)));

    // **Four draws, always, whichever of the face fields is pinned.**
    // `generate` threads one `Rng` through `tryBind`, `buildFigure` and then
    // `buildChoices`, so a figure whose appetite depended on what a template
    // pinned would reshuffle the distractors of the very question it
    // illustrates - see `bar`'s `scaleFor`.
    const numeralsJittered = rng.next() < 0.5;
    const trackJittered = rng.next() < 0.5;
    const hourHand = jitter(rng, ...HOUR_HAND_BAND) * RADIUS;
    const minuteHand = jitter(rng, ...MINUTE_HAND_BAND) * RADIUS;

    const askedNumerals = readField(spec.numerals, scope);
    const askedTrack = readField(spec.minuteTicks, scope);
    const numerals = askedNumerals === undefined ? numeralsJittered : truthy(askedNumerals);
    const track = askedTrack === undefined ? trackJittered : truthy(askedTrack);

    const angles = handAngles(hour, minute);
    const marks: Mark[] = [rimPath()];

    if (track) {
      for (let index = 0; index < MINUTES_PER_HOUR; index++) {
        // The positions an hour mark already stands on are skipped: a short
        // stroke under a long one is a heavier line, not a countable mark.
        if (index % MINUTES_PER_HOUR_MARK === 0) continue;
        marks.push(tickAt((index * 360) / MINUTES_PER_HOUR, MINUTE_TICK * RADIUS));
      }
    }

    for (let index = 0; index < HOURS; index++) {
      marks.push(tickAt((index * 360) / HOURS, HOUR_TICK * RADIUS));
    }

    marks.push(handAt(angles.hour, hourHand));
    marks.push(handAt(angles.minute, minuteHand));
    // The pin the two hands turn about, and the one mark that says they are
    // hands rather than two lines that happen to cross.
    marks.push({ kind: 'dot', at: [0, 0] });

    // Last, so a hand pointing at a numeral passes under it rather than
    // crossing it out - the minute hand stands on one at every quarter.
    if (numerals) {
      for (const numeral of NUMERALS) {
        marks.push({
          kind: 'label',
          at: onDial((numeral * 360) / HOURS, NUMERAL_RADIUS),
          text: String(numeral),
        });
      }
    }

    return marks;
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const hour = read(spec.hour, 'figure.hour', 'number', true);
    const minute = read(spec.minute, 'figure.minute', 'number', true);
    // Read for the type check alone, and that is the whole of it: nothing
    // judged below depends on whether either is on, so unlike `number-line`'s
    // `minorsAllowedBy` there is no reading of them for `build` and this to
    // share and no way for the two to drift apart about what is drawn.
    read(spec.numerals, 'figure.numerals', 'boolean');
    read(spec.minuteTicks, 'figure.minuteTicks', 'boolean');

    // **One fault, one message**: an hour of 13.5 is out of range as well as
    // fractional, and saying both would be one mistake told twice. Each `else`
    // below is that, not a shortcut.
    if (typeof hour === 'number') {
      if (!Number.isInteger(hour)) {
        issues.push(
          `figure.hour: ${hour} is not a whole hour - how far past it the hour hand has` +
            ' come is figure.minute to say, and this field is which hour it has passed',
        );
      } else if (hour < 1 || hour > HOURS) {
        issues.push(`figure.hour: ${hour} is outside the 1-${HOURS} a clock face shows`);
      }
    }

    if (typeof minute === 'number') {
      if (!Number.isInteger(minute)) {
        issues.push(`figure.minute: ${minute} is not a whole minute`);
      } else if (minute < 0 || minute > MINUTES_PER_HOUR - 1) {
        issues.push(
          `figure.minute: ${minute} is outside the 0-${MINUTES_PER_HOUR - 1} an hour holds`,
        );
      } else if (minute % MINUTE_STEP !== 0) {
        issues.push(
          `figure.minute: ${minute} leaves the minute hand between two marks nobody can tell` +
            ` apart - ${MINUTES_PER_HOUR} minute ticks stand` +
            ` ${reportMarkPitchPx(MINUTES_PER_HOUR).toFixed(2)}px apart in a report row against` +
            ` a ${REPORT_STROKE_PX}px stroke, under the ${MIN_MARK_GAP_PX} that makes two of` +
            ` them two marks, so only the ${HOURS} hour marks can be read off the face. Ask` +
            ` for a multiple of ${MINUTE_STEP}.`,
        );
      }
    }

    return issues;
  },
};
