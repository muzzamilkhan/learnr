import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import { createRng } from '../rng';
import { FIGURE_BOX, type Figure, type FigureSpec, type Mark, type Point } from './types';

/**
 * The `number-line` kind, read through the two public doors - `buildFigure` and
 * `figureIssues` - for `bar`'s and `spinner`'s reason: what a number line has
 * to get right is only true *after* the fit, since where the arrow stands
 * between two ticks is a question about the box a renderer is handed, not
 * about the working units the module lays it out in.
 */

/**
 * What a label costs in the fitted box's own units **in a parent's report**,
 * which is the larger of the two call sites: `progress-topics.tsx` draws this
 * figure at `labelSize={16}` in a 64px square, against `labelSize={7}` on the
 * play screen. Ink measured any smaller is ink that clips in every report row.
 */
const REPORT_LABEL_SIZE = 16;
const REPORT_CHAR = REPORT_LABEL_SIZE * 0.58;
const REPORT_INK = REPORT_LABEL_SIZE * 0.72;

const build = (spec: FigureSpec, seed: string): Figure => buildFigure(spec, {}, createRng(seed));

type PathMark = Extract<Mark, { kind: 'path' }>;

const paths = (figure: Figure): PathMark[] =>
  figure.marks.flatMap((mark) => (mark.kind === 'path' ? [mark] : []));

/** The line itself: the one open two-point path whose ends share a y. */
const axis = (figure: Figure): PathMark =>
  paths(figure).find(
    (path) => !path.closed && path.points.length === 2 && path.points[0][1] === path.points[1][1],
  )!;

/** Every tick: an open two-point path standing straight up from the line. */
const ticks = (figure: Figure): PathMark[] =>
  paths(figure).filter(
    (path) => !path.closed && path.points.length === 2 && path.points[0][0] === path.points[1][0],
  );

const lengthOf = (tick: PathMark): number => Math.abs(tick.points[0][1] - tick.points[1][1]);

/** The labelled ticks - the long ones. Minor ticks are drawn shorter. */
const majorTicks = (figure: Figure): PathMark[] => {
  const all = ticks(figure);
  const longest = Math.max(...all.map(lengthOf));
  return all.filter((tick) => lengthOf(tick) === longest).sort((a, b) => a.points[0][0] - b.points[0][0]);
};

const minorTicks = (figure: Figure): PathMark[] => {
  const all = ticks(figure);
  const longest = Math.max(...all.map(lengthOf));
  return all.filter((tick) => lengthOf(tick) < longest);
};

const labels = (figure: Figure) =>
  figure.marks
    .flatMap((mark) => (mark.kind === 'label' ? [mark] : []))
    .sort((a, b) => a.at[0] - b.at[0]);

/** The arrow: the one closed, filled path. */
const arrow = (figure: Figure): PathMark => paths(figure).find((path) => path.closed && path.fill)!;

const dot = (figure: Figure): Point =>
  figure.marks.flatMap((mark) => (mark.kind === 'dot' ? [mark.at] : []))[0];

/** The labelled ticks' own length, which is one of the two jitters left when all is pinned. */
const longestTick = (figure: Figure): number => Math.max(...ticks(figure).map(lengthOf));

/** The arrow tip to tail, which is the other. */
const arrowHeight = (figure: Figure): number => {
  const ys = arrow(figure).points.map(([, y]) => y);
  return Math.max(...ys) - Math.min(...ys);
};

/** The numbers the axis actually says, left to right. */
const labelValues = (figure: Figure): number[] => labels(figure).map((label) => Number(label.text));

/** The range the drawing claims, read off its own end labels. */
const drawnRange = (figure: Figure): [number, number] => {
  const values = labelValues(figure);
  return [values[0], values[values.length - 1]];
};

/**
 * Where the arrow stands as a share of the line between the first and last
 * labelled tick - which is the one thing the answer pins and no jitter may
 * touch.
 */
const arrowShare = (figure: Figure): number => {
  const major = majorTicks(figure);
  const first = major[0].points[0][0];
  const last = major[major.length - 1].points[0][0];
  return (dot(figure)[0] - first) / (last - first);
};

/**
 * Every label's **ink** inside the box, at report scale. `fit` bounds a
 * drawing by label anchor points and an SVG clips at its own edge, so half of
 * every label hangs outside what was measured - invisible on the play screen
 * and a digit sliced off in a 64px report row.
 */
function worstOverflow(figure: Figure): number {
  let worst = 0;
  for (const mark of figure.marks) {
    if (mark.kind !== 'label') continue;
    const half = (mark.text.length * REPORT_CHAR) / 2;
    worst = Math.max(
      worst,
      -(mark.at[0] - half),
      mark.at[0] + half - FIGURE_BOX,
      -(mark.at[1] - REPORT_INK / 2),
      mark.at[1] + REPORT_INK / 2 - FIGURE_BOX,
    );
  }
  return worst;
}

/**
 * How far the worst pair of neighbouring numbers overlap at report scale -
 * zero when every one of them clears the next.
 *
 * **This is the other half of "does all of it fit", and clipping cannot see
 * it**: two labels that overlap in the middle of the line are both entirely
 * inside the box, and `worstOverflow` reports nothing at all. It is what
 * catches a spacing rule that judges by one representative label rather than
 * by every neighbouring pair - `0, 5, 10, 15, 20` is roomy at its left end and
 * touching on its right.
 */
function worstCollision(figure: Figure): number {
  const drawn = figure.marks
    .flatMap((mark) => (mark.kind === 'label' ? [mark] : []))
    .sort((a, b) => a.at[0] - b.at[0]);

  let worst = 0;
  for (let index = 0; index + 1 < drawn.length; index++) {
    const left = drawn[index];
    const right = drawn[index + 1];
    const gap =
      right.at[0] -
      (right.text.length * REPORT_CHAR) / 2 -
      (left.at[0] + (left.text.length * REPORT_CHAR) / 2);
    worst = Math.max(worst, -gap);
  }
  return worst;
}

describe('the number-line figure kind', () => {
  it('draws the line, a tick and a label per labelled value, and an arrow on a dot', () => {
    const figure = build(
      { kind: 'number-line', at: '5', from: '0', to: '10', step: '5', minorTicks: 'false' },
      'nl-shape',
    );

    expect(axis(figure)).toBeDefined();
    expect(arrow(figure)).toBeDefined();
    expect(dot(figure)).toBeDefined();

    // Not a tally: the labels have to be the right numbers, and each one has
    // to sit under the tick it names. Counting three of each proves neither.
    expect(labels(figure).map((label) => label.text)).toEqual(['0', '5', '10']);
    const major = majorTicks(figure);
    expect(major).toHaveLength(3);
    labels(figure).forEach((label, index) => {
      expect(label.at[0]).toBeCloseTo(major[index].points[0][0], 1);
      // Below the line, which is where a number line reads from.
      expect(label.at[1]).toBeGreaterThan(axis(figure).points[0][1]);
    });

    // The dot marks the point on the line the arrow points at.
    expect(dot(figure)[1]).toBeCloseTo(axis(figure).points[0][1], 1);
  });

  it('stands the arrow proportionally between the ends of the range', () => {
    // The one quantity the answer pins. Everything else about this kind may
    // jitter; where the arrow is may not, or the picture stops illustrating
    // the question it was drawn for.
    for (const [at, from, to, share] of [
      [3, 0, 10, 0.3],
      [7, 0, 10, 0.7],
      [7, 0, 20, 0.35],
      [0, 0, 10, 0],
      [10, 0, 10, 1],
      [-5, -10, 10, 0.25],
    ] as const) {
      for (let seed = 0; seed < 6; seed++) {
        const figure = build(
          { kind: 'number-line', at: String(at), from: String(from), to: String(to) },
          `nl-share-${at}-${from}-${to}-${seed}`,
        );
        expect(arrowShare(figure), `${at} on ${from}..${to}`).toBeCloseTo(share, 2);
      }
    }
  });

  it('always draws a range that contains the value the arrow points at', () => {
    for (const at of [0, 1, 7, 12, 45, 100, -3]) {
      for (let seed = 0; seed < 25; seed++) {
        const figure = build({ kind: 'number-line', at: String(at) }, `nl-contains-${at}-${seed}`);
        const [from, to] = drawnRange(figure);
        expect(from, `${at} on ${from}..${to}`).toBeLessThanOrEqual(at);
        expect(to, `${at} on ${from}..${to}`).toBeGreaterThanOrEqual(at);
      }
    }
  });

  it('draws the same 7 on a genuinely different line on a different seed', () => {
    // **The anchoring case.** A question answered 7 must not always produce one
    // picture: a child who learns "the answer is the tick seven tenths along"
    // has learned the drawing instead of the number, and the analytics would
    // call the topic secure on the strength of it.
    //
    // **This asserts the requirement, not the illustration.** It used to insist
    // on the literal `0..20`, which was the brief's *example* of a varying
    // range - and 0-20 stopped being drawable for a 7 when the minor-tick limit
    // moved to report scale, since 7 needs ticks at every 1 there and twenty of
    // them in a 64px row is a band rather than something countable. The
    // requirement is that the range varies, and it does.
    const ranges = new Set<string>();
    const shares = new Set<string>();
    for (let seed = 0; seed < 80; seed++) {
      const figure = build({ kind: 'number-line', at: '7' }, `nl-anchor-${seed}`);
      ranges.add(drawnRange(figure).join('..'));
      shares.add(arrowShare(figure).toFixed(3));
    }

    expect(ranges.size).toBeGreaterThan(2);
    // And the arrow genuinely moves along the line, rather than the line being
    // redrawn around a fixed position - which is the thing a child would learn.
    expect(shares.size).toBeGreaterThan(2);
  });

  it('frames a value the span grid can only frame one way in more than one way', () => {
    // **The second offset per span, and the class it exists for.** A span
    // offers one start - the multiple of itself at or below `at` - so a value
    // like 11 had exactly one line it could ever be drawn on: 10..20, since
    // reading 11 needs ticks at every 1 and only a ten-wide line carries ten
    // of them in a report row. Measured, that was 36 of the integers 0-100 -
    // the odd non-multiples of five - so this samples the class rather than
    // pinning on the one value that turned it up.
    //
    // It slipped *under* the anchoring check rather than through it: the step
    // and the two proportional jitters still moved, so no two of fifty figures
    // were identical and `validateTemplate` passed them, while the range a
    // child actually reads never changed. Half a span along is the second
    // framing: 5..15 beside 10..20, with 11 on a minor tick of both.
    for (const at of ['11', '13', '17', '19', '23', '29', '37', '41']) {
      const ranges = new Set<string>();
      for (let seed = 0; seed < 60; seed++) {
        const figure = build({ kind: 'number-line', at }, `nl-offset-${at}-${seed}`);
        const [low, high] = drawnRange(figure);
        ranges.add(`${low}..${high}`);
        // The offset only ever buys a **round** line. Half of ten is five;
        // where half a span is not round - half of five is 2.5 - no second
        // line is offered at all, because a line labelled 2.5, 5, 7.5 trades
        // one unreadable picture for another.
        expect(Number.isInteger(low), `${at} on ${low}..${high}`).toBe(true);
        expect(Number.isInteger(high), `${at} on ${low}..${high}`).toBe(true);
      }
      expect(ranges.size, at).toBeGreaterThan(1);
    }

    // The rejection arm, on the value whose span-5 shift is the ugly one: an
    // unconstrained half-span offset would frame a 7 as 2.5..7.5.
    const sevens = new Set<string>();
    for (let seed = 0; seed < 80; seed++) {
      sevens.add(drawnRange(build({ kind: 'number-line', at: '7' }, `nl-round-${seed}`)).join('..'));
    }
    expect(sevens).not.toContain('2.5..7.5');
    expect(sevens.size).toBeGreaterThan(2);
  });

  it('picks a step that divides the range evenly, so the last tick is the end of the line', () => {
    for (const [from, to] of [
      [0, 10],
      [0, 20],
      [0, 100],
      [-10, 10],
      [5, 10],
    ] as const) {
      for (let seed = 0; seed < 20; seed++) {
        const figure = build(
          { kind: 'number-line', at: String(from), from: String(from), to: String(to) },
          `nl-divides-${from}-${to}-${seed}`,
        );
        const values = labelValues(figure);
        const step = values[1] - values[0];

        expect(values[0], `${from}..${to}`).toBeCloseTo(from, 6);
        expect(values[values.length - 1], `${from}..${to}`).toBeCloseTo(to, 6);
        // Equal steps all the way along, and a whole number of them.
        for (let index = 1; index < values.length; index++) {
          expect(values[index] - values[index - 1], `${from}..${to}`).toBeCloseTo(step, 6);
        }
        expect((to - from) / step, `${from}..${to}`).toBeCloseTo(Math.round((to - from) / step), 6);
      }
    }
  });

  it('stands the arrow on a tick whenever it picked the range itself', () => {
    // The builder's own guarantee, and the reason the minor ticks are not a
    // free jitter: a range it chose for itself must let the child read the
    // answer off it. An arrow floating between two ticks with nothing to count
    // is a question nobody can answer.
    //
    // **Every value here is asserted to be one validation accepts**, which is
    // what makes this the guarantee rather than a sample of where it happens to
    // hold: accepted, plus builder-chosen, now implies a tick under the arrow.
    // The list is deliberately not all integers - `2.5`, `0.5`, `3.7` and `7.5`
    // are the fractional values that reach the minor ticks, and they are where
    // the old sample of round numbers could not have caught anything.
    for (const at of [0, 3, 7, 12, 25, 45, -3, 2.5, 0.5, 3.7, 7.5, 100]) {
      expect(figureIssues({ kind: 'number-line', at: String(at) }, {}), String(at)).toEqual([]);
      for (let seed = 0; seed < 20; seed++) {
        const figure = build({ kind: 'number-line', at: String(at) }, `nl-ontick-${at}-${seed}`);
        const where = dot(figure)[0];
        const nearest = Math.min(
          ...ticks(figure).map((tick) => Math.abs(tick.points[0][0] - where)),
        );
        expect(nearest, `${at} on ${drawnRange(figure).join('..')}`).toBeLessThan(0.05);
      }
    }
  });

  it('draws the same number line differently with every parameter pinned', () => {
    // The anchoring rule at its hardest: a kind that varies only while
    // something is left open has a latent anchoring failure waiting for the
    // first author who pins it. With the value, the range, the step *and* the
    // minor ticks all pinned, what is left is how long the ticks are drawn and
    // how big the arrow is - both proportions of a frame the labels pin, so
    // neither is normalised away by the centring fit.
    const spec: FigureSpec = {
      kind: 'number-line',
      at: '7',
      from: '0',
      to: '20',
      step: '10',
      minorTicks: 'true',
    };
    expect(figureIssues(spec, {})).toEqual([]);

    const seeds = Array.from({ length: 20 }, (_, seed) => `nl-pinned-${seed}`);
    const drawings = new Set(seeds.map((seed) => JSON.stringify(build(spec, seed))));

    expect(drawings.size).toBeGreaterThan(15);

    // **Distinct is not the same as visible, and only the second is worth
    // having.** Coordinates are rounded at `FIGURE_PRECISION`, so a band of
    // any width at all produces twenty different JSON strings - including one
    // no child could ever see, which is exactly what `solid`'s `flip` taught:
    // variation the file can measure and a child cannot is a way of passing
    // the anchoring check while anchoring. So the spread itself is asserted.
    // Both bands run 1.7 wide by construction and measure 1.64 over these
    // seeds; anything under 1.4 is a lever that has quietly stopped being one.
    const spreadOf = (measure: (figure: Figure) => number): number => {
      const seen = seeds.map((seed) => measure(build(spec, seed)));
      return Math.max(...seen) / Math.min(...seen);
    };

    expect(spreadOf(longestTick)).toBeGreaterThan(1.4);
    expect(spreadOf(arrowHeight)).toBeGreaterThan(1.4);

    // And the answer is untouched by all of it.
    for (const seed of seeds) {
      expect(arrowShare(build(spec, seed))).toBeCloseTo(0.35, 2);
    }
  });

  it('draws minor ticks between the labelled ones, and skips the ones a label already stands on', () => {
    const figure = build(
      { kind: 'number-line', at: '0', from: '0', to: '10', step: '5', minorTicks: 'true' },
      'nl-minor',
    );

    const major = majorTicks(figure).map((tick) => tick.points[0][0]);
    const minor = minorTicks(figure).map((tick) => tick.points[0][0]);

    expect(minor.length).toBeGreaterThan(0);
    // No tick is drawn twice: a minor stroke under a major one is a heavier
    // line, not a countable mark.
    for (const x of minor) {
      expect(Math.min(...major.map((m) => Math.abs(m - x)))).toBeGreaterThan(0.05);
    }
    // Evenly spaced all the way along, majors and minors together.
    const all = [...major, ...minor].sort((a, b) => a - b);
    const gap = all[1] - all[0];
    for (let index = 1; index < all.length; index++) {
      expect(all[index] - all[index - 1]).toBeCloseTo(gap, 1);
    }
  });

  it('picks a range with the arrow on a numbered tick when the minor ticks are pinned off', () => {
    // Pinning them off is honoured exactly, and the readability guarantee is
    // kept the only way left: by choosing a range where `at` lands on a
    // *labelled* tick. The pin narrows what the builder may choose rather than
    // being quietly overridden - and rather than being honoured into a picture
    // that cannot answer its own question.
    for (const at of ['0', '3', '7', '10', '25']) {
      const spec: FigureSpec = { kind: 'number-line', at, minorTicks: 'false' };
      expect(figureIssues(spec, {}), at).toEqual([]);

      for (let seed = 0; seed < 20; seed++) {
        const figure = build(spec, `nl-nominor-${at}-${seed}`);
        expect(minorTicks(figure), at).toHaveLength(0);
        const numbered = majorTicks(figure).map((tick) => tick.points[0][0]);
        expect(
          Math.min(...numbered.map((x) => Math.abs(x - dot(figure)[0]))),
          `${at} on ${drawnRange(figure).join('..')}`,
        ).toBeLessThan(0.05);
      }
    }

    // A value the labelled ticks cannot reach on any range is reported rather
    // than drawn with the arrow floating - 12 needs ticks at every 1, and no
    // line the builder can label that finely fits.
    expect(
      figureIssues({ kind: 'number-line', at: '12', minorTicks: 'false' }, {}).join(),
    ).toContain('has a tick under it');
  });

  it('leaves the minor ticks off and on across seeds when the arrow does not need them', () => {
    // Free to jitter only where the answer does not depend on it: with the
    // arrow already standing on a labelled tick, the small ticks say nothing
    // the child has to read.
    const counts = new Set(
      Array.from({ length: 40 }, (_, seed) =>
        minorTicks(
          build(
            { kind: 'number-line', at: '10', from: '0', to: '20', step: '10' },
            `nl-minor-jitter-${seed}`,
          ),
        ).length > 0,
      ),
    );

    expect(counts).toEqual(new Set([true, false]));
  });

  it('draws something for an `at` it cannot read at all', () => {
    // Generation runs mid-session with a child waiting, so a broken `at`
    // degrades into a drawable line rather than throwing. Including content
    // `issues` refuses outright: `build` never refuses.
    for (const at of ['position', "'seven'", '0 / 0', '1e30']) {
      const figure = build({ kind: 'number-line', at }, `nl-broken-${at}`);
      expect(axis(figure), at).toBeDefined();
      expect(labels(figure).length, at).toBeGreaterThan(1);
      expect(dot(figure), at).toBeDefined();
    }
  });

  it('still draws a line where the arithmetic runs out', () => {
    // Up near the largest number a double holds every range the builder reaches
    // for overflows to `Infinity` and `at + 1` is still `at`, so there is no
    // line to put an arrow on. `build` never refuses, so it draws an ordinary
    // one instead of the blank square a NaN coordinate would leave - `fit`
    // finds no finite bounds and returns *nothing*, which is the failure this
    // guards, and it is silent.
    for (const spec of [
      { kind: 'number-line', at: '10 ^ 308' },
      { kind: 'number-line', at: '5', from: '0 - (10 ^ 308)', to: '10 ^ 308' },
      { kind: 'number-line', at: '5', from: '0', to: '10', step: '10 ^ -308' },
    ] as FigureSpec[]) {
      const figure = build(spec, 'nl-vast');
      expect(figureIssues(spec, {}), JSON.stringify(spec)).not.toEqual([]);
      expect(labels(figure).length, JSON.stringify(spec)).toBeGreaterThan(1);
      expect(axis(figure), JSON.stringify(spec)).toBeDefined();
    }

    // And it says which of the two the author has to change.
    expect(figureIssues({ kind: 'number-line', at: '10 ^ 308' }, {}).join()).toContain('figure.at');
    expect(
      figureIssues({ kind: 'number-line', at: '5', from: '0 - (10 ^ 308)', to: '10 ^ 308' }, {}).join(),
    ).toContain('figure.to');
  });

  it('never draws a tick reading Infinity', () => {
    // `formatTick` rounds by multiplying, and `v * 1000` overflows past about
    // 1.79e305 - so rounding to three places turned an enormous but ordinary
    // number into a label that was no longer the number it came from, which is
    // the first of a derived label's three questions failing outright.
    for (const to of ['10 ^ 308', '10 ^ 306', '0 - (10 ^ 308)']) {
      const spec = { kind: 'number-line', at: '0', from: '0', to } as FigureSpec;
      for (const text of labels(build(spec, 'nl-infinity')).map((label) => label.text)) {
        expect(text, to).not.toContain('Infinity');
      }
    }
  });

  it('keeps every label clear of the one beside it, on every legal shape and every seed', () => {
    // The invariant `labels.ts` exists for, swept: a label is anchored at its
    // middle and an SVG clips at its own edge, so a number at the end of the
    // line hangs half its ink outside the bounds `fit` measured. The line is
    // drawn to reach exactly as far as that ink, which makes containment an
    // identity rather than a solved inequality.
    //
    // **The odd-looking members of these lists are the load-bearing ones.**
    //
    // - `1000` is the widest range this can label at all (four characters),
    //   where the frame gives up the most width to ink.
    // - `-10..10` is the minus sign: one label a character wider than either
    //   of its neighbours, so the two ends of the drawing are sized by
    //   *different* labels and the tighter of the two is the one to measure.
    // - `0..0.0004` and `0..100000` are refused - by rounding and by width
    //   respectively - and are here because a refused shape still has to be
    //   drawn mid-session, where validation has not run.
    const shapes: [string, string, string][] = [
      ['0', '0', '10'],
      ['7', '0', '20'],
      ['3', '0', '4'],
      ['500', '0', '1000'],
      ['-5', '-10', '10'],
      ['0.5', '0', '1'],
      ['0.0002', '0', '0.0004'],
      ['12345', '0', '100000'],
    ];

    const outside: string[] = [];
    let accepted = 0;

    for (const [at, from, to] of shapes) {
      for (const step of [undefined, '1', '2', '5', '10', '0.5'] as const) {
        for (const minor of [undefined, 'true', 'false'] as const) {
          const spec: FigureSpec = {
            kind: 'number-line',
            at,
            from,
            to,
            ...(step === undefined ? {} : { step }),
            ...(minor === undefined ? {} : { minorTicks: minor }),
          };
          const legal = figureIssues(spec, {}).length === 0;
          if (legal) accepted++;
          if (!legal) continue;
          for (let seed = 0; seed < 6; seed++) {
            const figure = build(spec, `nl-sweep-${seed}`);
            const where = `${at} on ${from}..${to} / ${step ?? 'open'} / ${minor ?? 'open'}`;
            // Nothing that validates may clip, and nothing that validates may
            // have two of its numbers touching. A shape that does not validate
            // is allowed to be drawn cramped - but never silently, which is
            // what makes the refusal the alarm.
            const clipped = worstOverflow(figure);
            if (clipped > 0) outside.push(`${where}: ${clipped.toFixed(2)} out of the box`);
            const collided = worstCollision(figure);
            if (collided > 0) outside.push(`${where}: ${collided.toFixed(2)} of overlap`);
          }
        }
      }
    }

    expect(outside).toEqual([]);
    // A green sweep that accepted almost nothing would be testing almost
    // nothing - see the notes `pictograph` paid for.
    expect(accepted).toBeGreaterThan(30);
  });

  it('keeps a label inside the box even when it is one it would refuse', () => {
    // `build` never refuses: it runs mid-session, on whatever was authored,
    // and validation is a *separate* gate that catches bad content before it
    // ships rather than while a child is waiting. So the frame has to hold for
    // shapes `issues` rejects too - and each of these is a different rejection.
    const refused: [string, FigureSpec][] = [
      ['a range too wide to label', { kind: 'number-line', at: '5', from: '0', to: '100000' }],
      [
        'a step that rounds two ticks together',
        { kind: 'number-line', at: '0.0002', from: '0', to: '0.0004', step: '0.0001' },
      ],
      [
        'a step with too many ticks',
        { kind: 'number-line', at: '5', from: '0', to: '100', step: '5' },
      ],
      ['an arrow off the end of its line', { kind: 'number-line', at: '30', from: '0', to: '20' }],
      ['a range that runs backwards', { kind: 'number-line', at: '5', from: '10', to: '0' }],
      [
        'a step longer than the line',
        { kind: 'number-line', at: '5', from: '0', to: '10', step: '20' },
      ],
    ];

    for (const [name, spec] of refused) {
      expect(figureIssues(spec, {}), name).not.toEqual([]);
      for (let seed = 0; seed < 20; seed++) {
        expect(worstOverflow(build(spec, `nl-refused-${name}-${seed}`)), name).toBe(0);
      }
    }
  });

  it('runs out of box only at ten characters, six past what it already refuses', () => {
    // The boundary written down rather than left to be discovered. The frame is
    // exactly one unit wide - so the line's own end is the ink's end and
    // nothing can clip - until `MIN_LINE_SPAN` stops the line shrinking, which
    // is where the identity gives out. Measured, that is at ten characters,
    // against the four `issues` reports at.
    const line = (to: string): FigureSpec => ({ kind: 'number-line', at: '5', from: '0', to });

    for (const to of ['1000', '10000000']) {
      expect(worstOverflow(build(line(to), 'nl-edge')), to).toBe(0);
    }
    // Nine characters is the last one drawn whole, and it is already reported.
    expect(figureIssues(line('100000000'), {})).not.toEqual([]);
    expect(worstOverflow(build(line('100000000'), 'nl-edge'))).toBe(0);
    // Ten is the first that loses ink, and it is reported too - which is the
    // whole guarantee: a shape may be drawn cramped, never clipped in silence.
    expect(figureIssues(line('1000000000'), {})).not.toEqual([]);
    expect(worstOverflow(build(line('1000000000'), 'nl-edge'))).toBeGreaterThan(0);
  });

  it('never draws two ticks with the same label on a shape it accepts', () => {
    // The third question a derived label owes, swept: rounding can make two
    // different values print the same text, and a line reading `0 | 0 | 0`
    // fits its box perfectly and says nothing. No amount of measuring ink
    // finds it.
    //
    // **This is a smoke test, and the guard is elsewhere - say so rather than
    // let a green sweep be mistaken for one.** It accepts six of its twenty
    // specs, and not one of them *can* repeat: a repeat needs two tick values
    // under a thousandth apart, which prints five characters (`0.001`) and is
    // refused for width long before rounding could collide. The single family
    // that escapes that - a line whose numbers all round to the same *short*
    // text - is `0 -> 0.0004`, and it is refused by the distinctness check
    // itself, so the sweep skips it. **The real guard is the targeted test
    // `says so when two ticks would read the same`**: delete
    // `repeatedTickLabel` and that one goes red while this one stays green.
    // What this sweep is worth is the standing invariant - nothing validation
    // accepts ever draws a repeated number, on any seed.
    let accepted = 0;

    for (const [at, from, to] of [
      ['0', '0', '10'],
      ['7', '0', '20'],
      ['0.0002', '0', '0.0004'],
      ['0.5', '0', '2'],
      ['1', '0', '3'],
    ] as const) {
      for (const step of [undefined, '0.0001', '0.5', '1'] as const) {
        const spec: FigureSpec = {
          kind: 'number-line',
          at,
          from,
          to,
          ...(step === undefined ? {} : { step }),
        };
        if (figureIssues(spec, {}).length > 0) continue;
        accepted++;
        for (let seed = 0; seed < 6; seed++) {
          const texts = labels(build(spec, `nl-distinct-${seed}`)).map((label) => label.text);
          expect(new Set(texts).size, `${at} on ${from}..${to} / ${step ?? 'open'}`).toBe(
            texts.length,
          );
        }
      }
    }

    // Counted, so a sweep that quietly stopped accepting anything at all would
    // fail rather than pass by refusing everything.
    expect(accepted).toBeGreaterThan(4);
  });
});

describe('what the number-line kind reports to an author', () => {
  it('insists on the value the arrow points at', () => {
    expect(figureIssues({ kind: 'number-line' } as FigureSpec, {}).join()).toContain('figure.at');
  });

  it('names an expression it cannot evaluate', () => {
    const issues = figureIssues({ kind: 'number-line', at: 'position' }, {}).join();
    expect(issues).toContain('figure.at');
    expect(issues).toMatch(/position/);
  });

  it('names an `at` that is not a number at all', () => {
    expect(figureIssues({ kind: 'number-line', at: "'seven'" }, {}).join()).toContain(
      'expected number',
    );
  });

  it('says so when the range does not contain the arrow', () => {
    expect(
      figureIssues({ kind: 'number-line', at: '30', from: '0', to: '20' }, {}).join(),
    ).toContain('figure.at');
    expect(
      figureIssues({ kind: 'number-line', at: '-1', from: '0', to: '20' }, {}).join(),
    ).toContain('nowhere to point');
  });

  it('says so when the range is not a range', () => {
    expect(figureIssues({ kind: 'number-line', at: '5', from: '10', to: '10' }, {}).join()).toContain(
      'figure.to',
    );
    expect(figureIssues({ kind: 'number-line', at: '5', from: '10', to: '0' }, {}).join()).toContain(
      'no line to draw',
    );
  });

  it('names a step that is not a distance between two ticks', () => {
    expect(
      figureIssues({ kind: 'number-line', at: '5', from: '0', to: '10', step: '0' }, {}).join(),
    ).toContain('figure.step');
    expect(
      figureIssues({ kind: 'number-line', at: '5', from: '0', to: '10', step: '-2' }, {}).join(),
    ).toContain('figure.step');
  });

  it('says so when a step leaves more labelled ticks than the line can carry', () => {
    // Derived from the type, not chosen: a report-scale number is a tenth of
    // the box wide, so how many of them fit along a line is arithmetic.
    expect(
      figureIssues({ kind: 'number-line', at: '5', from: '0', to: '10', step: '5' }, {}),
    ).toEqual([]);
    expect(
      figureIssues({ kind: 'number-line', at: '5', from: '0', to: '100', step: '5' }, {}).join(),
    ).toContain('figure.step');
  });

  it('says so when a step leaves the end of the line unlabelled', () => {
    expect(
      figureIssues({ kind: 'number-line', at: '3', from: '0', to: '10', step: '3' }, {}).join(),
    ).toContain('figure.step');
    // And says nothing when it divides.
    expect(
      figureIssues({ kind: 'number-line', at: '3', from: '0', to: '9', step: '3' }, {}),
    ).toEqual([]);
  });

  it('says so when a step is longer than the line it is meant to divide', () => {
    expect(
      figureIssues({ kind: 'number-line', at: '5', from: '0', to: '10', step: '20' }, {}).join(),
    ).toContain('figure.step');
  });

  it('says so when two ticks would read the same', () => {
    // The one failure no ink sweep can see: these labels fit their box
    // perfectly, they are simply not distinct. Rounding answers the "does it
    // fit" question by breaking the "is it still different" one.
    expect(
      figureIssues(
        { kind: 'number-line', at: '0.0002', from: '0', to: '0.0004', step: '0.0001' },
        {},
      ).join(),
    ).toContain('both read 0');

    // And reachable with no pinned step at all, which is the case that matters:
    // every number on this line rounds to the same short text, so it is the
    // width check's blind spot as well as the ink sweep's.
    expect(
      figureIssues({ kind: 'number-line', at: '0.0002', from: '0', to: '0.0004' }, {}).join(),
    ).toContain('both read 0');

    // A fractional line that stays distinct is fine - the check bites on the
    // rounding, not on the fraction.
    expect(
      figureIssues({ kind: 'number-line', at: '0.5', from: '0', to: '1', step: '0.5' }, {}),
    ).toEqual([]);
  });

  it('says so when a number is wider than the line has room for', () => {
    expect(
      figureIssues({ kind: 'number-line', at: '500', from: '0', to: '1000' }, {}),
    ).toEqual([]);
    expect(
      figureIssues({ kind: 'number-line', at: '12345', from: '0', to: '100000' }, {}).join(),
    ).toContain('characters');

    // And it names a field the author actually wrote. With no range given, the
    // value is what forced one this wide, so pointing at `figure.to` would send
    // them looking for something they never typed.
    const alone = figureIssues({ kind: 'number-line', at: '12345' }, {});
    expect(alone.join()).toContain('characters');
    // Asserted on the field each issue is *filed under*, not on a substring of
    // the joined prose - one of these messages names `figure.from` and
    // `figure.to` in its advice, and matching on that would be reading the
    // sentence rather than the verdict.
    for (const issue of alone) expect(issue.split(':')[0], issue).toBe('figure.at');
  });

  it('says so when no line it can draw has a tick under the arrow', () => {
    // **The figure that cannot answer its own question**, and the reason it is
    // a report rather than a clamp: snapping the arrow to the nearest tick
    // would draw a different number from the one the template committed to,
    // and drawing it floating asks a child to read a value the picture does
    // not contain. `1 / 3` is not contrived - it is exactly what a fractions
    // template computes, and no range and step whose numbers fit at report
    // scale ever steps onto it.
    for (const at of ['1 / 3', '0.123456', '0.35']) {
      expect(figureIssues({ kind: 'number-line', at }, {}).join(), at).toContain(
        'has a tick under it',
      );
    }

    // The values a template actually asks about are untouched, which is what
    // stops this being a check that refuses half the content.
    for (const at of ['0', '3', '7', '2.5', '0.5', '3.7', '45', '100', '0 - 3']) {
      expect(figureIssues({ kind: 'number-line', at }, {}), at).toEqual([]);
    }

    // **A range the author pinned is theirs.** An arrow deliberately between
    // two ticks is a real question there - "is it nearer 0 or 1?" - so the same
    // value that is refused above is accepted the moment the line is given.
    expect(figureIssues({ kind: 'number-line', at: '1 / 3', from: '0', to: '1' }, {})).toEqual([]);
  });

  it('reads minorTicks the same way when it validates as when it draws', () => {
    // `minorTicks: '0'` is not a truth value, so it is reported as the wrong
    // type - but it still pins the small ticks off when the figure is drawn,
    // because `build` takes the expression language's own reading of truth.
    // Validation used to ask `typeof value === 'boolean'` instead, which a `0`
    // is not, so it judged the lines a figure *with* minor ticks could take
    // while `build` drew one without them. Nothing could ship on such a spec,
    // but it was the one place "validation recomputes what the builder does"
    // did not hold, and a property with an exception is not one to rely on.
    //
    // 3.7 is a value where the two readings give **different verdicts**, so the
    // disagreement is visible rather than theoretical: fine with the small
    // ticks, stranded without them.
    const asNumber = figureIssues({ kind: 'number-line', at: '3.7', minorTicks: '0' }, {});
    const asBoolean = figureIssues({ kind: 'number-line', at: '3.7', minorTicks: 'false' }, {});

    expect(asNumber.filter((issue) => !issue.includes('expected boolean'))).toEqual(asBoolean);
    expect(asBoolean.join()).toContain('has a tick under it');
    // Left open it is perfectly drawable, which is what makes the verdict turn
    // on this field and the test bite.
    expect(figureIssues({ kind: 'number-line', at: '3.7' }, {})).toEqual([]);
  });

  it('names a minorTicks that is not a truth value', () => {
    expect(
      figureIssues({ kind: 'number-line', at: '5', from: '0', to: '10', minorTicks: '3' }, {}).join(),
    ).toContain('expected boolean');
  });

  it('says nothing about a number line an author got right', () => {
    expect(
      figureIssues(
        { kind: 'number-line', at: '7', from: '0', to: '20', step: '10', minorTicks: 'true' },
        {},
      ),
    ).toEqual([]);
    expect(figureIssues({ kind: 'number-line', at: '7' }, {})).toEqual([]);
    expect(figureIssues({ kind: 'number-line', at: '3', from: '0', to: '10' }, {})).toEqual([]);
  });
});
