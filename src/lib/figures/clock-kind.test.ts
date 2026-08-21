import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import {
  HAND_LENGTH_GAP,
  MIN_HAND_DIFFERENCE,
  MIN_MARK_GAP_PX,
  MINUTE_STEP,
  dialDirection,
  handAngles,
  reportMarkPitchPx,
} from './clock-kind';
import { CHAR_RATIO, INK_RATIO, REPORT_LABEL_SIZE } from './labels';
import { createRng, type Rng } from '../rng';
import { FIGURE_BOX, FIGURE_PADDING, MAX_MARKS, type Figure, type FigureSpec, type Point } from './types';

/**
 * The `clock` kind, read through the two public doors - `buildFigure` and
 * `figureIssues` - for the reason every kind since `bar` has been: what the
 * picture says is only true *after* the fit, and where the hands point is a
 * question about where their tips land in the box a renderer is handed.
 *
 * The three exceptions are asked directly, because each is arithmetic no
 * fitted figure can be read for:
 *
 * - `handAngles` is **the time the picture tells**, in the same spirit as
 *   `sectorAngles` being a spinner's fairness. Whether the hour hand really
 *   sits half way between the 3 and the 4 at half past three is a property of
 *   that number, not of a coordinate rounded to two places.
 * - `dialDirection` is the one place the two frames meet - a clock turns
 *   clockwise from twelve, the builder draws anticlockwise from east - and the
 *   whole point of it being a named function is that it can be checked rather
 *   than re-derived by whoever reads `90 - x` next.
 * - `reportMarkPitchPx` and `MIN_MARK_GAP_PX` are the measurement `MINUTE_STEP`
 *   rests on, and `MINUTE_STEP` is what decides which times this kind can draw
 *   at all.
 */

const build = (spec: FigureSpec, seed: string): Figure => buildFigure(spec, {}, createRng(seed));

/** Where `fit` puts the centre of a drawing bounded by its own rim. */
const CENTRE = FIGURE_BOX / 2;

/** What `fit` leaves the dial, which is the rim's radius in the box's units. */
const FITTED_RADIUS = (FIGURE_BOX - 2 * FIGURE_PADDING) / 2;

/**
 * How far a recovered angle may be out. A tip is rounded to `FIGURE_PRECISION`
 * in each direction at a radius of at least `0.4 * 44`, which is about
 * 0.023 degrees of slop; everything below is asserted against the *drawing*,
 * so this is the floor on what a drawing can say.
 */
const ANGLE_TOLERANCE = 0.05;

/** The dial: the only closed path a clock draws. */
const rim = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'path' && mark.closed ? [mark.points] : []));

const isHand = (points: readonly Point[]) =>
  points.length === 2 && points[0][0] === CENTRE && points[0][1] === CENTRE;

/** The open paths that do not start at the centre: the marks round the rim. */
const ticks = (figure: Figure) =>
  figure.marks.flatMap((mark) =>
    mark.kind === 'path' && !mark.closed && !isHand(mark.points) ? [mark.points] : [],
  );

const labels = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'label' ? [mark] : []));

const dots = (figure: Figure) => figure.marks.filter((mark) => mark.kind === 'dot');

/**
 * Which way a point lies from the centre, in degrees **clockwise from twelve** -
 * the frame a clock is read in, recovered through the y-flip `fit` applied on
 * the way out. If `dialDirection` were the wrong way round this would come back
 * mirrored, which is exactly what it is here to catch.
 */
const clockwiseOf = ([x, y]: Point): number =>
  ((90 - (Math.atan2(CENTRE - y, x - CENTRE) * 180) / Math.PI) % 360 + 360) % 360;

const lengthOf = ([x, y]: Point): number => Math.hypot(x - CENTRE, y - CENTRE);

/** The two hands, told apart the way a child tells them apart: by length. */
function handsOf(figure: Figure): { hour: { angle: number; length: number }; minute: { angle: number; length: number } } {
  const drawn = figure.marks
    .flatMap((mark) => (mark.kind === 'path' && !mark.closed && isHand(mark.points) ? [mark.points[1]] : []))
    .map((tip) => ({ angle: clockwiseOf(tip), length: lengthOf(tip) }))
    .sort((a, b) => a.length - b.length);
  return { hour: drawn[0], minute: drawn[1] };
}

/** The box the rim occupies, which is what `fit` measured the whole drawing by. */
function dialBounds(figure: Figure): [number, number, number, number] {
  const points = rim(figure)[0];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

/**
 * The ink one numeral covers in a **parent's report row**, where a label is
 * about 2.3x wider in the box's own units than on the play screen. `fit` bounds
 * a drawing by a label's anchor point, not by its ink, so this is the only way
 * to see a numeral hanging over the edge - and `dominantBaseline="middle"`
 * (`diagram.tsx`) is why the height is measured either side of the anchor.
 */
function inkBox(label: { at: Point; text: string }): [number, number, number, number] {
  const halfWidth = (label.text.length * REPORT_LABEL_SIZE * CHAR_RATIO) / 2;
  const halfHeight = (REPORT_LABEL_SIZE * INK_RATIO) / 2;
  const [x, y] = label.at;
  return [x - halfWidth, x + halfWidth, y - halfHeight, y + halfHeight];
}

const overlap = (a: [number, number, number, number], b: [number, number, number, number]) =>
  a[0] < b[1] && b[0] < a[1] && a[2] < b[3] && b[2] < a[3];

const clockSpec = (fields: Partial<Record<'hour' | 'minute' | 'numerals' | 'minuteTicks', string>>): FigureSpec =>
  ({ kind: 'clock', hour: '3', minute: '0', ...fields }) as FigureSpec;

describe('the time a clock face tells', () => {
  it('turns a clock angle into the frame the builder draws in', () => {
    // Clockwise from twelve, into anticlockwise from east. Twelve is north,
    // three is east, six is south, nine is west - and getting this backwards
    // draws every time mirrored, which still looks like a clock.
    expect(dialDirection(0)).toBe(90);
    expect(dialDirection(90)).toBe(0);
    expect(dialDirection(180)).toBe(-90);
    expect(dialDirection(270)).toBe(-180);
  });

  it('puts the minute hand six degrees round for every minute', () => {
    expect(handAngles(3, 0).minute).toBe(0);
    expect(handAngles(3, 15).minute).toBe(90);
    expect(handAngles(3, 30).minute).toBe(180);
    expect(handAngles(3, 45).minute).toBe(270);
    expect(handAngles(3, 55).minute).toBe(330);
  });

  it('carries the hour hand on past the hour as the minutes pass', () => {
    // **The classic bug.** At half past three the hour hand is half way to the
    // four, not still on the three - a face that leaves it on the three is
    // drawing a time that does not exist, and it looks perfectly correct.
    expect(handAngles(3, 0).hour).toBe(90);
    expect(handAngles(3, 30).hour).toBe(105);
    expect(handAngles(3, 45).hour).toBe(112.5);
    expect(handAngles(4, 0).hour).toBe(120);

    // Twelve is the top of the dial, not thirty-six turns round it.
    expect(handAngles(12, 0).hour).toBe(0);
    expect(handAngles(12, 30).hour).toBe(15);
  });
});

describe('what a report row can hold, and what it costs this kind', () => {
  it('finds the minute ticks too close together to count in a report row', () => {
    // The measurement the whole design turns on, written down rather than
    // asserted as a round number: sixty marks round a 64px dial land 2.95px
    // apart against a 1.5px stroke, under the two stroke widths that make two
    // marks two marks. Twelve hour marks land 14.7px apart and are countable.
    expect(reportMarkPitchPx(60)).toBeCloseTo(2.95, 2);
    expect(reportMarkPitchPx(12)).toBeCloseTo(14.74, 2);
    expect(MIN_MARK_GAP_PX).toBe(3);

    expect(reportMarkPitchPx(60)).toBeLessThan(MIN_MARK_GAP_PX);
    expect(reportMarkPitchPx(12)).toBeGreaterThan(MIN_MARK_GAP_PX);
  });

  it('reads the time only off marks it can tell apart', () => {
    // So the minute hand may only stand on an hour mark, and `MINUTE_STEP` is
    // that fact rather than a chosen five: were the ticks countable it would
    // be one, and this kind would draw every minute.
    expect(MINUTE_STEP).toBe(5);
  });
});

describe('the clock figure kind', () => {
  it('draws a dial, twelve hour marks, two hands and a centre', () => {
    const figure = build(clockSpec({ minuteTicks: 'false', numerals: 'false' }), 'clock-shape');

    expect(rim(figure)).toHaveLength(1);
    expect(ticks(figure)).toHaveLength(12);
    expect(dots(figure)).toEqual([{ kind: 'dot', at: [CENTRE, CENTRE] }]);
    expect(labels(figure)).toHaveLength(0);

    // Every hour mark runs inward from the rim, and the twelve of them stand at
    // every thirtieth degree round it.
    const turns = ticks(figure)
      .map((points) => clockwiseOf(points[0]))
      .sort((a, b) => a - b);
    expect(turns.map((turn) => Math.round(turn))).toEqual([0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330]);
    for (const points of ticks(figure)) {
      expect(lengthOf(points[0])).toBeGreaterThan(lengthOf(points[1]));
    }
  });

  it('adds forty-eight more marks between the hours when the minute track is asked for', () => {
    const withTrack = build(clockSpec({ minuteTicks: 'true' }), 'clock-track');
    // Sixty positions, twelve of which an hour mark already stands on: a short
    // stroke under a long one is a heavier line, not a second mark.
    expect(ticks(withTrack)).toHaveLength(60);

    const lengths = [...new Set(ticks(withTrack).map((points) => Math.round(lengthOf(points[0]) - lengthOf(points[1]))))];
    expect(lengths).toHaveLength(2);
  });

  it('points the hands where the time says, whatever the seed says', () => {
    for (const [hour, minute] of [[3, 0], [12, 0], [6, 30], [9, 45], [1, 5], [11, 55]]) {
      const spec = clockSpec({ hour: String(hour), minute: String(minute) });
      expect(figureIssues(spec, {}), `${hour}:${minute}`).toEqual([]);
      const asked = handAngles(hour, minute);

      for (let seed = 0; seed < 12; seed++) {
        const { hour: shorter, minute: longer } = handsOf(build(spec, `clock-time-${seed}`));
        expect(shorter.angle, `${hour}:${minute} hour hand`).toBeCloseTo(asked.hour, 1);
        expect(longer.angle, `${hour}:${minute} minute hand`).toBeCloseTo(asked.minute, 1);
      }
    }
  });

  it('sits the hour hand half way between the three and the four at half past three', () => {
    // Asserted against the marks the child reads it against, rather than
    // against a number computed the same way the builder computed it: the hour
    // hand has to land exactly between the hour mark it has left and the one it
    // is heading for.
    const figure = build(clockSpec({ hour: '3', minute: '30' }), 'clock-half-past');
    const turns = ticks(figure).map((points) => clockwiseOf(points[0]));
    const three = turns.find((turn) => Math.abs(turn - 90) < 1)!;
    const four = turns.find((turn) => Math.abs(turn - 120) < 1)!;

    expect(handsOf(figure).hour.angle).toBeCloseTo((three + four) / 2, 1);
    // And plainly not on the three, which is the bug this is here for.
    expect(Math.abs(handsOf(figure).hour.angle - three)).toBeGreaterThan(10);
  });

  it('draws the hour hand clearly shorter than the minute hand, at every time and on every seed', () => {
    // Length is the only thing telling the two apart - `Mark` has no stroke
    // width - so the difference has to be one a 64px report row can show: three
    // stroke widths of it. The bands the two hands are drawn from are disjoint
    // by more than that whatever the seed does, which is the guarantee, and the
    // drawings below are what proves the bands are what the builder uses.
    expect(HAND_LENGTH_GAP).toBeGreaterThan(MIN_HAND_DIFFERENCE);
    const minimum = MIN_HAND_DIFFERENCE * FITTED_RADIUS;

    for (const minute of [0, 15, 30, 45]) {
      for (let seed = 0; seed < 10; seed++) {
        const { hour, minute: long } = handsOf(build(clockSpec({ hour: '7', minute: String(minute) }), `clock-lengths-${minute}-${seed}`));
        expect(long.length - hour.length, `:${minute} seed ${seed}`).toBeGreaterThan(minimum);
      }
    }
  });

  it('draws the same time differently on a different seed, with every face parameter pinned', () => {
    // **The anchoring rule at its hardest, and inverted for this kind.** Three
    // o'clock is three o'clock: the hands are the answer, so all of the
    // variation has to come from the face - and with the numerals and the
    // minute track both pinned, what is left is how long the hands are drawn.
    const spec = clockSpec({ hour: '3', minute: '0', numerals: 'true', minuteTicks: 'true' });
    expect(figureIssues(spec, {})).toEqual([]);

    const drawings = new Set(
      Array.from({ length: 20 }, (_, seed) => JSON.stringify(build(spec, `clock-pinned-${seed}`))),
    );
    expect(drawings.size).toBeGreaterThan(15);
  });

  it('varies the face and never the hands', () => {
    // The two halves of this kind's bargain, asserted together because either
    // one alone is a lie: a face that never varies is an anchor, and hands that
    // vary are a clock telling a different time on a different seed. The spread
    // is measured rather than counted - two figures with different JSON and the
    // same picture would pass a count and teach the anchor anyway.
    const spec = clockSpec({ hour: '3', minute: '0' });
    const numerals = new Set<number>();
    const track = new Set<number>();
    const hourShares: number[] = [];
    const minuteShares: number[] = [];

    for (let seed = 0; seed < 60; seed++) {
      const figure = build(spec, `clock-face-${seed}`);
      const hands = handsOf(figure);

      expect(hands.hour.angle, `seed ${seed}`).toBeCloseTo(90, 1);
      expect(hands.minute.angle, `seed ${seed}`).toBeCloseTo(0, 1);

      numerals.add(labels(figure).length);
      track.add(ticks(figure).length);
      hourShares.push(hands.hour.length / FITTED_RADIUS);
      minuteShares.push(hands.minute.length / FITTED_RADIUS);
    }

    // The face comes and goes: numerals or none, a minute track or none.
    expect([...numerals].sort((a, b) => a - b)).toEqual([0, 4]);
    expect([...track].sort((a, b) => a - b)).toEqual([12, 60]);

    // And the hands are drawn over a real range of lengths, not jiggled.
    expect(Math.max(...hourShares) / Math.min(...hourShares)).toBeGreaterThan(1.2);
    expect(Math.max(...minuteShares) / Math.min(...minuteShares)).toBeGreaterThan(1.15);
  });

  it('fits the dial to the same box on every seed, so the hand lengths are not scaled away', () => {
    // `fit` is uniform and centring, so a jitter it can normalise away is not a
    // jitter at all. The rim is sampled at fixed angles with a vertex on each
    // axis, so the bounds are the dial's whatever is drawn inside it - which is
    // what lets a hand drawn shorter really read as shorter.
    for (const minuteTicks of ['true', 'false']) {
      for (let seed = 0; seed < 20; seed++) {
        const figure = build(clockSpec({ minuteTicks }), `clock-frame-${minuteTicks}-${seed}`);
        expect(dialBounds(figure), minuteTicks).toEqual([FIGURE_PADDING, FIGURE_BOX - FIGURE_PADDING, FIGURE_PADDING, FIGURE_BOX - FIGURE_PADDING]);
      }
    }
  });

  it('draws the numerals a quarter of the way round, and every one of them distinct', () => {
    const figure = build(clockSpec({ numerals: 'true' }), 'clock-numerals');
    const drawn = labels(figure);

    // Verified as the numbers they are and where they stand, not counted: four
    // labels in the right places is a different claim from four labels.
    const byAngle = drawn.map((label) => [Math.round(clockwiseOf(label.at)), label.text] as const);
    expect(byAngle.sort((a, b) => a[0] - b[0])).toEqual([
      [0, '12'],
      [90, '3'],
      [180, '6'],
      [270, '9'],
    ]);

    // The third of `labels.ts`' three questions, which no amount of measuring
    // ink can answer: two numerals reading the same text would fit perfectly
    // and say nothing.
    expect(new Set(drawn.map((label) => label.text)).size).toBe(drawn.length);
  });

  it('keeps every numeral inside the box and clear of the one beside it, at report scale', () => {
    // The second question: does *all* of it fit - every numeral, at the size a
    // parent's report draws it, where `fit` has bounded the drawing by the
    // anchor points and the ink hangs outside them. One figure rather than a
    // sweep of seeds, because the ring is the same on all of them: it is
    // derived from the numerals' own text and nothing here jitters. The sweep
    // at the end is what checks that across the rest of this kind's dimensions.
    const drawn = labels(build(clockSpec({ numerals: 'true' }), 'clock-ink')).map(inkBox);
    expect(drawn).toHaveLength(4);

    for (const [minX, maxX, minY, maxY] of drawn) {
      // Held to `FIGURE_PADDING` rather than to the box edge: passing this
      // means `FIGURE_PADDING` is never asked to pay for a numeral at all,
      // which is the containment `pictograph` gets by construction and `bar`
      // has to solve an inequality for.
      expect(minX).toBeGreaterThanOrEqual(FIGURE_PADDING);
      expect(minY).toBeGreaterThanOrEqual(FIGURE_PADDING);
      expect(maxX).toBeLessThanOrEqual(FIGURE_BOX - FIGURE_PADDING);
      expect(maxY).toBeLessThanOrEqual(FIGURE_BOX - FIGURE_PADDING);
    }
    for (let a = 0; a < drawn.length; a++) {
      for (let b = a + 1; b < drawn.length; b++) {
        expect(overlap(drawn[a], drawn[b]), `${a} and ${b}`).toBe(false);
      }
    }
  });

  it('draws the numerals last, so a hand reaching one passes under it', () => {
    // The minute hand stands on a numeral at every quarter, and marks are
    // painted in order - a numeral drawn first would be crossed out by the hand
    // pointing at it.
    const marks = build(clockSpec({ hour: '3', minute: '0', numerals: 'true' }), 'clock-order').marks;
    const firstLabel = marks.findIndex((mark) => mark.kind === 'label');
    const lastPath = marks.map((mark) => mark.kind).lastIndexOf('path');

    expect(firstLabel).toBeGreaterThan(lastPath);
  });

  it('draws both hands at twelve o clock, where they lie on top of one another', () => {
    // A real clock does this too, and the shorter hand disappearing under the
    // longer one is how twelve o'clock looks. What must not happen is a hand
    // going missing from the drawing, which is what a de-duplicating renderer
    // or a builder skipping a zero-length mark would do.
    const figure = build(clockSpec({ hour: '12', minute: '0' }), 'clock-noon');
    const hands = handsOf(figure);

    expect(hands.hour.angle).toBeCloseTo(0, 1);
    expect(hands.minute.angle).toBeCloseTo(0, 1);
    expect(hands.hour.length).toBeLessThan(hands.minute.length);
  });

  it('draws the minute it was given rather than the nearest mark it could read', () => {
    // **Report, never snap.** A minute the face cannot express is refused by
    // `issues`; it is never quietly moved onto the mark next door, which would
    // draw a time the template did not ask for and mark a right answer wrong.
    const spec = clockSpec({ hour: '3', minute: '37' });
    expect(figureIssues(spec, {})).not.toEqual([]);
    expect(handsOf(build(spec, 'clock-unsnapped')).minute.angle).toBeCloseTo(37 * 6, 1);
  });

  it('draws something for a time it cannot read at all', () => {
    // Generation runs mid-session with a child waiting, so a broken field
    // degrades into a drawable clock rather than throwing. Including content
    // `issues` refuses outright: `build` never refuses, and a refused clock
    // still has to fit the same box as any other.
    for (const [hour, minute] of [['when', '0'], ['3', 'later'], ['0', '0'], ['13', '0'], ['3.4', '61'], ['3', '-5']]) {
      const figure = build(clockSpec({ hour, minute }), `clock-broken-${hour}-${minute}`);
      expect(rim(figure), `${hour}:${minute}`).toHaveLength(1);
      expect(ticks(figure).length, `${hour}:${minute}`).toBeGreaterThanOrEqual(12);
      expect(dialBounds(figure), `${hour}:${minute}`).toEqual([FIGURE_PADDING, FIGURE_BOX - FIGURE_PADDING, FIGURE_PADDING, FIGURE_BOX - FIGURE_PADDING]);
      const hands = handsOf(figure);
      expect(hands.hour.length, `${hour}:${minute}`).toBeLessThan(hands.minute.length);
    }
  });

  it('reads the hour round the dial rather than off the end of it', () => {
    // Nought and thirteen are real readings of a twenty-four hour clock, so
    // `build` wraps them onto the face a child is looking at instead of
    // clamping two different hours onto the same one. Both are reported.
    expect(handsOf(build(clockSpec({ hour: '0', minute: '0' }), 'clock-wrap-0')).hour.angle).toBeCloseTo(0, 1);
    expect(handsOf(build(clockSpec({ hour: '13', minute: '0' }), 'clock-wrap-13')).hour.angle).toBeCloseTo(30, 1);
  });

  it('stays well inside the marks a figure can be stored with', () => {
    // A clock's marks are a fixed list - a rim, sixty ticks, two hands, a
    // centre and four numerals - so unlike `bar` or `spinner` there is nothing
    // for a template to grow and nothing to slice.
    const figure = build(clockSpec({ numerals: 'true', minuteTicks: 'true' }), 'clock-marks');
    expect(figure.marks.length).toBe(68);
    expect(figure.marks.length).toBeLessThan(MAX_MARKS);
  });

  it('draws the same figure twice from one seed, because a clock kind must never read the clock', () => {
    // The irony this kind has to avoid: everything in `src/lib` is pure, and
    // the one that draws a clock face is the one that would look plausible
    // reading `Date.now()`. Both hands come from the bound scope, so two builds
    // on one seed are the same drawing.
    const spec = clockSpec({ hour: '8', minute: '20' });
    expect(JSON.stringify(build(spec, 'clock-pure'))).toBe(JSON.stringify(build(spec, 'clock-pure')));
  });

  it("takes exactly four values off the question's own Rng, whatever is pinned", () => {
    // `generate` threads one `Rng` through `tryBind`, `buildFigure` and then
    // `buildChoices`, so a figure whose appetite depended on what a template
    // pinned would reshuffle the distractors of the very question it
    // illustrates - and adding `numerals: 'true'` to a template would silently
    // change that template's own choices. Both face flags are drawn whether or
    // not they are used, which is what keeps the count flat.
    for (const numerals of [undefined, 'true', 'false']) {
      for (const minuteTicks of [undefined, 'true', 'false']) {
        let draws = 0;
        const inner = createRng('appetite');
        const counted: Rng = {
          next: () => (draws++, inner.next()),
          int: (min, max) => (draws++, inner.int(min, max)),
          pick: (items) => (draws++, inner.pick(items)),
        };
        const spec = clockSpec({
          ...(numerals === undefined ? {} : { numerals }),
          ...(minuteTicks === undefined ? {} : { minuteTicks }),
        });
        buildFigure(spec, {}, counted);
        expect(draws, `${numerals ?? 'open'} / ${minuteTicks ?? 'open'}`).toBe(4);
      }
    }
  });

  it('never tells a time other than the one it was given, whatever it is given', () => {
    // The invariant the tests above sample, swept across every dimension this
    // kind has. For every shape `figureIssues` ACCEPTS, on every seed: the dial
    // fits the same box, the hands stand where the time says, the hour hand is
    // the shorter one, and no numeral's report-scale ink leaves the box.
    //
    // **The odd-looking members of these lists are the load-bearing ones:**
    //
    // - Hour 12 is the one that is 0 degrees rather than 360, and the one where
    //   both hands can coincide.
    // - Minutes 7 and 37 are the refusal arm - times the face cannot express -
    //   and they are here so the sweep exercises both sides of `MINUTE_STEP`
    //   rather than only the half that is green.
    // - Minute 55 puts the hour hand within five degrees of the *next* hour
    //   mark, which is where an hour hand that ignored the minutes would still
    //   look almost right.
    // - Pinning both face fields is the arm where only the hand lengths vary.
    const hours = [1, 3, 6, 9, 11, 12];
    const minutes = [0, 5, 7, 15, 30, 37, 45, 55];
    const flags: (string | undefined)[] = [undefined, 'true', 'false'];

    const wrong: string[] = [];
    let accepted = 0;
    let refused = 0;

    for (const hour of hours) {
      for (const minute of minutes) {
        for (const numerals of flags) {
          for (const minuteTicks of flags) {
            const spec = {
              kind: 'clock',
              hour: String(hour),
              minute: String(minute),
              ...(numerals === undefined ? {} : { numerals }),
              ...(minuteTicks === undefined ? {} : { minuteTicks }),
            } as FigureSpec;

            if (figureIssues(spec, {}).length > 0) {
              refused++;
              continue;
            }
            accepted++;

            const asked = handAngles(hour, minute);
            const where = `${hour}:${minute} / ${numerals ?? 'open'} / ${minuteTicks ?? 'open'}`;

            for (let seed = 0; seed < 4; seed++) {
              const figure = build(spec, `clock-sweep-${seed}`);

              const bounds = dialBounds(figure);
              if (bounds.join() !== `${FIGURE_PADDING},${FIGURE_BOX - FIGURE_PADDING},${FIGURE_PADDING},${FIGURE_BOX - FIGURE_PADDING}`) {
                wrong.push(`${where}: fitted to ${bounds.join()}`);
              }

              const hands = handsOf(figure);
              if (Math.abs(hands.hour.angle - asked.hour) > ANGLE_TOLERANCE) {
                wrong.push(`${where}: hour hand at ${hands.hour.angle} where ${asked.hour} was asked`);
              }
              if (Math.abs(hands.minute.angle - asked.minute) > ANGLE_TOLERANCE) {
                wrong.push(`${where}: minute hand at ${hands.minute.angle} where ${asked.minute} was asked`);
              }
              if (!(hands.hour.length < hands.minute.length)) {
                wrong.push(`${where}: hour hand ${hands.hour.length} against minute ${hands.minute.length}`);
              }

              const drawn = labels(figure).map(inkBox);
              if (numerals === 'false' && drawn.length > 0) wrong.push(`${where}: ${drawn.length} numerals`);
              for (const box of drawn) {
                if (Math.min(box[0], box[2]) < FIGURE_PADDING || Math.max(box[1], box[3]) > FIGURE_BOX - FIGURE_PADDING) {
                  wrong.push(`${where}: numeral ink at ${box.join()}`);
                }
              }
              if (figure.marks.length > MAX_MARKS) wrong.push(`${where}: ${figure.marks.length} marks`);
            }
          }
        }
      }
    }

    expect(wrong).toEqual([]);
    // A green sweep that refused almost everything would be testing almost
    // nothing - and a refusal arm that never fired would make the comment above
    // about minutes 7 and 37 false.
    expect(accepted).toBe(hours.length * (minutes.length - 2) * flags.length * flags.length);
    expect(refused).toBe(hours.length * 2 * flags.length * flags.length);
  });
});

describe('what the clock kind reports to an author', () => {
  it('insists on both hands', () => {
    const issues = figureIssues({ kind: 'clock' } as FigureSpec, {}).join();
    expect(issues).toContain('figure.hour');
    expect(issues).toContain('figure.minute');
  });

  it('names an expression it cannot evaluate', () => {
    const issues = figureIssues({ kind: 'clock', hour: 'h', minute: '0' } as FigureSpec, {}).join();
    expect(issues).toContain('figure.hour');
    expect(issues).toMatch(/h/);
  });

  it('names an hour that is not a number at all', () => {
    expect(figureIssues(clockSpec({ hour: "'three'" }), {}).join()).toContain('expected number');
  });

  it('names an hour that is not a whole hour', () => {
    const issues = figureIssues(clockSpec({ hour: '3.5' }), {}).join();
    expect(issues).toContain('figure.hour');
    expect(issues).toContain('whole hour');
    // And not also reported as out of range: one fault, one message.
    expect(figureIssues(clockSpec({ hour: '3.5' }), {})).toHaveLength(1);
  });

  it('names an hour outside the twelve a face shows', () => {
    expect(figureIssues(clockSpec({ hour: '0' }), {}).join()).toContain('1-12');
    expect(figureIssues(clockSpec({ hour: '13' }), {}).join()).toContain('1-12');
    expect(figureIssues(clockSpec({ hour: '12' }), {})).toEqual([]);
  });

  it('names a minute outside the hour', () => {
    expect(figureIssues(clockSpec({ minute: '60' }), {}).join()).toContain('0-59');
    expect(figureIssues(clockSpec({ minute: '-5' }), {}).join()).toContain('0-59');
  });

  it('names a minute that is not a whole minute', () => {
    expect(figureIssues(clockSpec({ minute: '7.5' }), {}).join()).toContain('whole minute');
  });

  it('names a minute the face has no mark for, and says what it measured', () => {
    // The `number-line` lesson in a clock's clothes: a minute hand between two
    // marks nobody can tell apart is a picture that cannot answer its own
    // question, and it is reported rather than nudged onto the mark next door.
    const issues = figureIssues(clockSpec({ minute: '37' }), {}).join();
    expect(issues).toContain('figure.minute');
    expect(issues).toContain('multiple of 5');
    // And it hands the author the measurement rather than a bare rule, so the
    // limit can be argued with rather than only obeyed.
    expect(issues).toContain('2.95px');
    expect(issues).toContain('12 hour marks');

    for (const minute of ['0', '5', '15', '30', '45', '55']) {
      expect(figureIssues(clockSpec({ minute }), {}), minute).toEqual([]);
    }
  });

  it('names a numerals or a minuteTicks that is not a truth value', () => {
    expect(figureIssues(clockSpec({ numerals: '1' }), {}).join()).toContain('expected boolean');
    expect(figureIssues(clockSpec({ minuteTicks: "'yes'" }), {}).join()).toContain('expected boolean');
  });

  it('says nothing about a clock an author got right', () => {
    expect(
      figureIssues({ kind: 'clock', hour: '7', minute: '20', numerals: 'true', minuteTicks: 'false' }, {}),
    ).toEqual([]);
  });
});
