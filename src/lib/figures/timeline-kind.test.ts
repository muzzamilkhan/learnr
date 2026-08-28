import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import { createRng } from '../rng';
import { FIGURE_BOX, type Figure, type FigureSpec } from './types';

/**
 * The `timeline` kind, read through the two public doors - `buildFigure` and
 * `figureIssues` - rather than through the module, for `pictograph`'s reason:
 * what a timeline has to get right is only true *after* the fit, because
 * whether two events can be told apart is a question about where they land in
 * the box a renderer is handed.
 */

const build = (spec: FigureSpec, seed: string): Figure => buildFigure(spec, {}, createRng(seed));

const labelsOf = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'label' ? [mark] : []));

const dots = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'dot' ? [mark] : []));

const paths = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'path' ? [mark] : []));

/**
 * What a label costs in the fitted box's own units **in a parent's report**,
 * which is the larger of the two call sites: `progress-topics.tsx` draws this
 * figure at `labelSize={16}` in a 64px square, against `labelSize={7}` on the
 * play screen. Spacing that only clears the play screen's glyph collides in the
 * report, so every measurement below is taken against these.
 */
const REPORT_LABEL_SIZE = 16;
const REPORT_CHAR = REPORT_LABEL_SIZE * 0.58;
const REPORT_INK = REPORT_LABEL_SIZE * 0.72;

/**
 * Every label's **ink** inside the box, measured at report scale. `fit` bounds
 * a drawing by label anchor points and an SVG clips at its own edge, so half of
 * every label hangs outside what was measured - invisible on the play screen,
 * and a sliced digit in a 64px report row.
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

describe('the timeline figure kind', () => {
  it('puts every event on the rule in proportion to its year', () => {
    // The whole of what makes it a data display rather than a decoration: the
    // gap between two dots is the gap between two years, to scale.
    const figure = build(
      { kind: 'timeline', years: "'1900,1950,2000'", labels: "'A,B,C'" },
      'timeline-spacing',
    );

    const xs = dots(figure)
      .map((dot) => dot.at[0])
      .sort((a, b) => a - b);

    expect(xs).toHaveLength(3);
    // To a tenth of a fitted unit: `FIGURE_PRECISION` rounds a stored figure's
    // coordinates at build time, which is what makes two of them comparable as
    // strings and costs the last hundredth here.
    expect(xs[1] - xs[0]).toBeCloseTo(xs[2] - xs[1], 1);
  });

  it('letters the events in the order the template gave them, never left to right', () => {
    // A kind that lettered its dots by position would answer "which happened
    // first?" off the alphabet, with no need to look at the line at all.
    const figure = build({ kind: 'timeline', years: "'1950,1900,1975'" }, 'timeline-letters');

    const named = labelsOf(figure)
      .filter((label) => /^[A-Z]$/.test(label.text))
      .sort((a, b) => a.at[0] - b.at[0])
      .map((label) => label.text);

    expect(named).toEqual(['B', 'A', 'C']);
  });

  it('runs the line past the outermost events, so no end label sits on one', () => {
    // The overshoot is not decoration: an event under the `1900` would have its
    // year read off the axis rather than counted along it.
    for (let seed = 0; seed < 30; seed++) {
      const figure = build({ kind: 'timeline', years: "'1900,1950'" }, `timeline-overshoot-${seed}`);
      const xs = dots(figure).map((dot) => dot.at[0]);
      const years = labelsOf(figure).filter((label) => /^\d+$/.test(label.text));

      for (const year of years) {
        for (const x of xs) expect(Math.abs(year.at[0] - x)).toBeGreaterThan(1);
      }
    }
  });

  it('puts a tick under every event, whatever line it picks', () => {
    // What makes the gap between two dots readable: an event floating between
    // two ticks is one whose year cannot be counted to.
    for (let seed = 0; seed < 30; seed++) {
      const figure = build(
        { kind: 'timeline', years: "'1900,1950,2000'" },
        `timeline-lattice-${seed}`,
      );
      const ticks = paths(figure)
        .filter((path) => path.points.length === 2 && path.points[0][0] === path.points[1][0])
        .map((path) => path.points[0][0]);

      for (const dot of dots(figure)) {
        expect(ticks.some((tick) => Math.abs(tick - dot.at[0]) < 0.5)).toBe(true);
      }
    }
  });

  it('draws a different picture on a different seed with every field pinned', () => {
    // The anchoring rule at its hardest: a template that has pinned both ends
    // and the division has taken away every lever but the tick and gap jitter,
    // and there still has to be one.
    const spec: FigureSpec = {
      kind: 'timeline',
      years: "'1900,1950'",
      labels: "'A,B'",
      from: '1875',
      to: '1975',
      step: '25',
    };
    const drawn = new Set(
      Array.from({ length: 20 }, (_, seed) => JSON.stringify(build(spec, `timeline-pinned-${seed}`))),
    );

    expect(drawn.size).toBeGreaterThan(1);
  });

  it('degrades into a drawable timeline when the years cannot be read', () => {
    // Generation runs mid-session with a child waiting, so a broken `years`
    // degrades rather than throwing.
    const figure = build({ kind: 'timeline', years: "'not a list'" }, 'timeline-broken');

    expect(dots(figure).length).toBeGreaterThan(0);
    expect(labelsOf(figure).length).toBeGreaterThan(0);
  });

  it('never clips a label, and never draws two on one another, whatever it is given', () => {
    // The invariant the tests above sample, stated once and swept across every
    // dimension this kind has. A timeline may be drawn cramped, but it may
    // never be drawn *silently* wrong: a shape whose labels clip, or whose two
    // events land on one another, has to be a shape `figureIssues` refuses.
    //
    // **The odd-looking members of these lists are the load-bearing ones**, and
    // a copy of this test should keep their equivalents:
    //
    // - `12000` is a five-character year, where the end labels' inset takes
    //   more than half the frame - the case where the room for events is the
    //   *years'* fault rather than the letters'.
    // - `5` is a year of one character, the other end of that: the inset the
    //   end labels take runs from a tenth of the frame to over half of it.
    // - a step of `3` against decade spacing is a division no event lands on,
    //   which is the refusal arm of the lattice check.
    // - `''` for the labels is the omitted case, where the builder letters the
    //   events itself, and it is the one every shipped template will take.
    // - `Abcd` and `Abcde` are past `eventCharBudget`, which is three for years
    //   of every width, so they sweep its refusal arm and never its other one.
    //
    // Measured over what it accepts: **two, three and four events, never five**,
    // and event labels of three characters at most. Five events would need the
    // pair nearest each other a fifth of the line apart with four such gaps on
    // it, which no division that is still countable leaves room for.
    const magnitudes = [5, 800, 1900, 12000];
    const spacings = [1, 2, 5];
    const steps: (string | undefined)[] = [undefined, '3', '5', '10', '25'];
    const names = ['', 'A', 'Ab', 'Abc', 'Abcd', 'Abcde'];
    const silent: string[] = [];
    const accepted = { count: new Map<number, number>(), magnitude: new Map<number, number>(),
      step: new Map<string, number>(), chars: new Map<number, number>() };
    const tally = <K,>(into: Map<K, number>, key: K) => into.set(key, (into.get(key) ?? 0) + 1);

    for (let count = 2; count <= 5; count++) {
      for (const magnitude of magnitudes) {
        for (const spacing of spacings) {
          for (const step of steps) {
            for (const chars of [0, 1, 2, 3, 4, 5]) {
              for (const pinned of [false, true]) {
                const years = Array.from({ length: count }, (_, index) => magnitude + index * spacing * 10);
                const labels = Array.from({ length: count }, (_, index) =>
                  names[chars].replace(/^./, String.fromCharCode(65 + index)),
                ).join(',');
                const spec: FigureSpec = {
                  kind: 'timeline',
                  years: `'${years.join(',')}'`,
                  ...(chars === 0 ? {} : { labels: `'${labels}'` }),
                  ...(step === undefined ? {} : { step }),
                  ...(pinned
                    ? { from: String(years[0] - spacing * 10), to: String(years[count - 1] + spacing * 10) }
                    : {}),
                };

                if (figureIssues(spec, {}).length > 0) continue;
                tally(accepted.count, count);
                tally(accepted.magnitude, magnitude);
                tally(accepted.step, step ?? 'open');
                tally(accepted.chars, chars);

                const where = `${years.join(',')} x ${chars} chars, step ${step ?? 'open'}`;
                for (let seed = 0; seed < 4; seed++) {
                  const figure = build(spec, `timeline-sweep-${seed}`);
                  const outside = worstOverflow(figure);
                  if (outside > 0) silent.push(`${where}: ${outside.toFixed(2)} out`);

                  // Two labels on one another: the ink sweep sees a label that
                  // leaves the box and nothing at all about one drawn on top of
                  // its neighbour, which is the same picture for two events.
                  const drawn = labelsOf(figure).slice().sort((a, b) => a.at[0] - b.at[0]);
                  for (let index = 1; index < drawn.length; index++) {
                    const [left, right] = [drawn[index - 1], drawn[index]];
                    if (Math.abs(left.at[1] - right.at[1]) > 1) continue;
                    const need = ((left.text.length + right.text.length) / 2) * REPORT_CHAR;
                    if (right.at[0] - left.at[0] < need) {
                      silent.push(`${where}: ${left.text} and ${right.text} overlap`);
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // **What the sweep accepts, not just that it is green.** A dimension
    // contributing no acceptances is one exercising the refusal arm alone,
    // and a comment calling it load-bearing would be false.
    expect(silent).toEqual([]);
    expect([...accepted.count.keys()].sort()).toEqual([2, 3, 4]);
    expect([...accepted.magnitude.keys()].sort((a, b) => a - b)).toEqual(magnitudes);
    expect([...accepted.step.keys()].sort()).toEqual(['10', '25', '5', 'open']);
    expect([...accepted.chars.keys()].sort()).toEqual([0, 1, 2, 3]);
  });
});

describe('what the timeline kind reports to an author', () => {
  it('insists on the years', () => {
    expect(figureIssues({ kind: 'timeline' } as FigureSpec, {}).join()).toContain('figure.years');
  });

  it('names a years that is not a list of numbers', () => {
    expect(figureIssues({ kind: 'timeline', years: "'1900,,1950'" }, {}).join()).toContain(
      'comma-separated list of numbers',
    );
    expect(figureIssues({ kind: 'timeline', years: "'1900,soon'" }, {}).join()).toContain(
      'comma-separated list of numbers',
    );
  });

  it('says so when there is nothing to read between', () => {
    // One dot on a rule is a picture with no gap in it, and every question a
    // timeline asks is about a gap.
    expect(figureIssues({ kind: 'timeline', years: "'1900'" }, {}).join()).toContain(
      'at least two events',
    );
  });

  it('says so when two events share a year', () => {
    // The `pictograph` question in another costume: two different events, one
    // dot, and a question whose picture supports both answers.
    expect(figureIssues({ kind: 'timeline', years: "'1900,1950,1900'" }, {}).join()).toContain(
      'happens twice',
    );
  });

  it('names labels that do not match the events', () => {
    expect(
      figureIssues({ kind: 'timeline', years: "'1900,1950,2000'", labels: "'A,B'" }, {}).join(),
    ).toContain('figure.labels');
  });

  it('names a label too long to stand beside a dot', () => {
    // A word beside a dot both collides with its neighbour and pushes the
    // rule's own bound, which is why the letter is a key the prompt refers to.
    expect(
      figureIssues(
        { kind: 'timeline', years: "'1900,1950'", labels: "'Federation,War'" },
        {},
      ).join(),
    ).toContain('characters beside');
  });

  it('names a pinned end the line does not reach', () => {
    expect(
      figureIssues({ kind: 'timeline', years: "'1900,1950'", from: '1920' }, {}).join(),
    ).toContain('does not reach');
    expect(figureIssues({ kind: 'timeline', years: "'1900,1950'", to: '1930' }, {}).join()).toContain(
      'does not reach',
    );
  });

  it('names a division no tick of which lands under an event', () => {
    expect(
      figureIssues({ kind: 'timeline', years: "'1900,1925'", step: '10' }, {}).join(),
    ).toContain('no tick under');
  });

  it('says so when a division is too fine to count along', () => {
    expect(figureIssues({ kind: 'timeline', years: "'1900,1980'", step: '1' }, {}).join()).toContain(
      'counted apart',
    );
  });

  it('says so when two events sit closer than their letters can', () => {
    // Settled by the data rather than by the geometry, so it is measured
    // against the line this figure actually gets and reported with its number.
    expect(figureIssues({ kind: 'timeline', years: "'1900,1901,1902'" }, {}).join()).toContain(
      'told apart',
    );
  });

  it('says nothing about a timeline an author got right', () => {
    expect(
      figureIssues(
        { kind: 'timeline', years: "'1920,1960'", labels: "'A,B'", from: '1900', to: '2000', step: '20' },
        {},
      ),
    ).toEqual([]);
    expect(figureIssues({ kind: 'timeline', years: "'1900,1950,2000'" }, {})).toEqual([]);
  });
});
