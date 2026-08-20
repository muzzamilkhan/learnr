import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import { createRng } from '../rng';
import { FIGURE_BOX, type Figure, type FigureSpec, type Mark } from './types';

/**
 * The `bar` kind, read through the two public doors - `buildFigure` and
 * `figureIssues` - rather than through the module. What a bar graph has to get
 * right is only true *after* the fit: whether two labels collide is a question
 * about where they land in the box a renderer is handed, not about the working
 * units the module lays them out in.
 */

/**
 * What a label costs in the fitted box's own units **in a parent's report**,
 * which is the larger of the two call sites: `progress-topics.tsx` draws this
 * figure at `labelSize={16}` in a 64px square, against `labelSize={7}` on the
 * play screen. Spacing that only clears the play screen's glyph is spacing
 * that collides in the report, so every measurement below is taken against
 * these - see the module comment in `src/components/diagram.tsx`.
 */
const REPORT_LABEL_SIZE = 16;
/** One character's width, and one line's ink height, as shares of the type size. */
const REPORT_CHAR = REPORT_LABEL_SIZE * 0.58;
const REPORT_INK = REPORT_LABEL_SIZE * 0.72;

const build = (spec: FigureSpec, seed: string): Figure => buildFigure(spec, {}, createRng(seed));

const marksOf = (figure: Figure, kind: Mark['kind']) =>
  figure.marks.filter((mark) => mark.kind === kind);

const labels = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'label' ? [mark] : []));

const paths = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'path' ? [mark] : []));

/** The bars: closed paths, in the order they were drawn. */
const bars = (figure: Figure) => paths(figure).filter((path) => path.closed);

/**
 * Every label's **ink** inside the box, measured at report scale. `fit` bounds
 * a drawing by label anchor points and an SVG clips at its own edge, so half of
 * every label hangs outside what was measured - which is invisible on the play
 * screen, where a glyph is small, and slices a digit off in a 64px report row.
 */
function expectInsideTheBox(figure: Figure, note = '') {
  for (const label of figure.marks.flatMap((mark) => (mark.kind === 'label' ? [mark] : []))) {
    const half = (label.text.length * REPORT_CHAR) / 2;
    const where = `${note} ${label.text}`;
    expect(label.at[0] - half, where).toBeGreaterThanOrEqual(0);
    expect(label.at[0] + half, where).toBeLessThanOrEqual(FIGURE_BOX);
    expect(label.at[1] - REPORT_INK / 2, where).toBeGreaterThanOrEqual(0);
    expect(label.at[1] + REPORT_INK / 2, where).toBeLessThanOrEqual(FIGURE_BOX);
  }
}

/**
 * The furthest any label's ink pokes outside the box, at report scale - zero
 * when everything is inside. The measuring half of `expectInsideTheBox`, split
 * out because the sweep below wants the number rather than an assertion.
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

/** How tall one bar stands, in the fitted box (y is down there, so this is a span). */
const height = (points: readonly (readonly [number, number])[]) => {
  const ys = points.map(([, y]) => y);
  return Math.max(...ys) - Math.min(...ys);
};

describe('the bar figure kind', () => {
  it('draws a bar per value, in proportion to the values', () => {
    const figure = build({ kind: 'bar', values: "'2,4,6,8'", style: "'column'" }, 'bar-heights');
    const drawn = bars(figure);

    expect(drawn).toHaveLength(4);

    const heights = drawn.map((bar) => height(bar.points));
    // Proportional, not equal to anything in particular: the fit rescales the
    // whole drawing, so only the ratios between the bars survive it.
    for (const [index, want] of [2, 4, 6, 8].entries()) {
      expect(heights[index] / heights[3]).toBeCloseTo(want / 8, 2);
    }
  });

  it('stands every bar on the same baseline', () => {
    const figure = build({ kind: 'bar', values: "'1,5,3'", style: "'column'" }, 'bar-baseline');
    const feet = bars(figure).map((bar) => Math.max(...bar.points.map(([, y]) => y)));

    expect(new Set(feet.map((foot) => foot.toFixed(2))).size).toBe(1);
  });

  it('draws a dot per point and no bars at all as a dot plot', () => {
    const figure = build({ kind: 'bar', values: "'3,7,5,2'", style: "'dot'" }, 'bar-dots');

    expect(marksOf(figure, 'dot')).toHaveLength(4);
    expect(bars(figure)).toHaveLength(0);
  });

  it('joins the points with exactly one open path as a line graph', () => {
    const figure = build({ kind: 'bar', values: "'3,7,5,2'", style: "'line'" }, 'bar-line');

    // The axes are open paths too, and so is every tick, so the line is
    // identified by carrying a point per value rather than by being open.
    const through = paths(figure).filter((path) => !path.closed && path.points.length === 4);
    expect(through).toHaveLength(1);

    const [line] = through;
    expect(line.closed).toBe(false);
    expect(marksOf(figure, 'dot')).toHaveLength(0);
    expect(bars(figure)).toHaveLength(0);

    // Left to right, and higher values sit higher up the box (y is down).
    const xs = line.points.map(([x]) => x);
    expect([...xs].sort((a, b) => a - b)).toEqual(xs);
    const ys = line.points.map(([, y]) => y);
    expect(ys[1]).toBeLessThan(ys[0]);
    expect(ys[2]).toBeGreaterThan(ys[1]);
    expect(ys[3]).toBeGreaterThan(ys[2]);
  });

  it('draws both a column graph and a dot plot when the style is left open', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const figure = build({ kind: 'bar', values: "'3,7,5,2'" }, `bar-style-${seed}`);
      if (bars(figure).length > 0) seen.add('column');
      if (marksOf(figure, 'dot').length > 0) seen.add('dot');
      // A line graph is a continuous reading, never a drawing choice. (A
      // column is a four-point path too, so the line is the *open* one.)
      expect(
        paths(figure).filter((path) => !path.closed && path.points.length === 4),
      ).toHaveLength(0);
    }

    expect(seen).toEqual(new Set(['column', 'dot']));
  });

  it('draws the same data as a different picture on a different seed', () => {
    // The anchoring rule: a figure must never become the anchor for an answer.
    // Pinning both the style and the scale is the tightest a template can be
    // and the drawing still has to vary, or every question whose answer is 7
    // ships with one picture and the child learns the picture.
    const spec: FigureSpec = { kind: 'bar', values: "'3,7,5,2'", style: "'column'", scale: '2' };
    const drawings = new Set(
      Array.from({ length: 10 }, (_, seed) => JSON.stringify(build(spec, `bar-vary-${seed}`))),
    );

    expect(drawings.size).toBeGreaterThan(5);
  });

  it('labels every step of the value axis and nothing between them', () => {
    const figure = build({ kind: 'bar', values: "'2,4,6,8'", scale: '2' }, 'bar-steps');

    // No `labels`, so every label on the drawing is an axis step.
    expect(new Set(labels(figure).map((label) => label.text))).toEqual(
      new Set(['0', '2', '4', '6', '8']),
    );
  });

  it('labels each category when it is given names for them', () => {
    const figure = build(
      { kind: 'bar', values: "'3,7,5,2'", labels: "'Mo,Tu,We,Th'" },
      'bar-categories',
    );
    const texts = labels(figure).map((label) => label.text);

    for (const name of ['Mo', 'Tu', 'We', 'Th']) expect(texts).toContain(name);
  });

  it('leaves the categories unlabelled when it is given no names', () => {
    const figure = build({ kind: 'bar', values: "'3,7,5,2'" }, 'bar-unlabelled');

    // Every label is a number off the axis, and none of them is a category.
    for (const label of labels(figure)) expect(label.text).toMatch(/^\d+(\.\d+)?$/);
  });

  it('spaces its labels for the report, not for the play screen', () => {
    // The same figure is drawn at `labelSize={7}` on the play screen and
    // `labelSize={16}` in a 64px report thumbnail - a glyph roughly 2.3x wider
    // in the box's own units. Geometry that clears the smaller one collides in
    // the report, so this measures against the larger.
    for (let seed = 0; seed < 30; seed++) {
      const figure = build(
        { kind: 'bar', values: "'4,8,6,2,10'", labels: "'Mo,Tu,We,Th,Fr'" },
        `bar-spacing-${seed}`,
      );
      const drawn = labels(figure);

      const steps = drawn.filter((label) => /^\d/.test(label.text));
      const categories = drawn.filter((label) => !/^\d/.test(label.text));

      // Axis steps are stacked, so what separates two of them is height.
      const heights = steps.map((label) => label.at[1]).sort((a, b) => a - b);
      for (let i = 1; i < heights.length; i++) {
        expect(heights[i] - heights[i - 1]).toBeGreaterThanOrEqual(REPORT_INK);
      }

      // Categories sit side by side, so what separates them is width. One
      // glyph is what the geometry can promise for any number of categories;
      // a longer name than that is the author's to keep short.
      const acrosses = categories.map((label) => label.at[0]).sort((a, b) => a - b);
      for (let i = 1; i < acrosses.length; i++) {
        expect(acrosses[i] - acrosses[i - 1]).toBeGreaterThanOrEqual(REPORT_CHAR);
      }

      expectInsideTheBox(figure);
    }
  });

  it('keeps every label inside the box at the widest the caps allow', () => {
    // The invariant above, taken to the corner rather than the easy case: an
    // SVG clips at its own edge and `fit` bounds a drawing by anchor points,
    // so half of a label always hangs outside what was measured. Two-character
    // labels prove nothing about that - they are narrower than the padding.
    // These are the widest each field is allowed to be, so if the geometry has
    // failed to budget for a label's ink it fails here.
    const corners: [string, FigureSpec][] = [
      // The most categories, each carrying the longest label that graph allows.
      ['five categories', { kind: 'bar', values: "'4,8,6,2,10'", labels: "'Mo,Tu,We,Th,Fr'" }],
      // Fewer categories buy longer labels; this is that trade at its end.
      ['long labels', { kind: 'bar', values: "'2,3,4'", labels: "'Mond,Tues,Wedn'" }],
      // The same three categories, with an axis that reaches two digits: the
      // wider axis takes a character off what a category label may be, so this
      // is the *same* corner one step along. It is here because the budget
      // moving with the axis is the thing that was wrong before.
      ['long labels, wider axis', { kind: 'bar', values: "'3,7,5'", labels: "'Mon,Tue,Wed'" }],
      // The widest value axis, which is the other label that reaches an edge.
      ['a wide axis', { kind: 'bar', values: "'100000,300000,500000'" }],
      // Both at once, plus a category count to squeeze them.
      ['both at once', { kind: 'bar', values: "'40,80,60,20,100'", labels: "'Mo,Tu,We,Th,Fr'" }],
      // A line graph puts its labels in the same places; a dot plot too.
      ['as a line', { kind: 'bar', values: "'40,80,60,20,100'", labels: "'Mo,Tu,We,Th,Fr'", style: "'line'" }],
    ];

    for (const [name, spec] of corners) {
      // Every one of them is content an author is allowed to write - the point
      // is that the *legal* extremes draw legibly, not that illegal ones do.
      expect(figureIssues(spec, {}), name).toEqual([]);
      for (let seed = 0; seed < 40; seed++) {
        expectInsideTheBox(build(spec, `bar-corner-${name}-${seed}`), name);
      }
    }
  });

  it('keeps a label inside the box even when it is one it would refuse', () => {
    // `build` never throws and never refuses: it runs mid-session, on whatever
    // was authored, and validation is a *separate* gate that catches bad
    // content before it ships rather than while a child is waiting. So the ink
    // budget has to hold for labels `issues` would reject too - these three are
    // the widths measured as clipped before the category labels were budgeted
    // for at all, and they are what regresses if that budget is removed.
    const refused: [string, FigureSpec][] = [
      ['4 x 5-char', { kind: 'bar', values: "'4,8,6,2'", labels: "'Monda,Tueda,Wedne,Thurs'" }],
      [
        '5 x 5-char',
        { kind: 'bar', values: "'4,8,6,2,10'", labels: "'Monda,Tueda,Wedne,Thurs,Frida'" },
      ],
      [
        '5 x 6-char',
        { kind: 'bar', values: "'4,8,6,2,10'", labels: "'Mondae,Tuedae,Wednes,Thursd,Fridae'" },
      ],
    ];

    for (const [name, spec] of refused) {
      expect(figureIssues(spec, {}).join(), name).toContain('figure.labels');
      for (let seed = 0; seed < 40; seed++) {
        expectInsideTheBox(build(spec, `bar-refused-${name}-${seed}`), name);
      }
    }
  });

  it('says so when a label is wider than its share of the graph', () => {
    // The budget is per graph, not a constant: five categories leave room for
    // two characters and three categories leave room for four, so the same
    // label is fine on one graph and reported on the other.
    expect(
      figureIssues({ kind: 'bar', values: "'3,7,5'", labels: "'Mon,Tue,Wed'" }, {}),
    ).toEqual([]);
    expect(
      figureIssues({ kind: 'bar', values: "'4,8,6,2,10'", labels: "'Mon,Tue,Wed,Thu,Fri'" }, {})
        .join(),
    ).toContain('figure.labels');
  });

  it('says so when the value axis needs more characters than it has room for', () => {
    expect(figureIssues({ kind: 'bar', values: "'100000,300000'" }, {})).toEqual([]);
    expect(figureIssues({ kind: 'bar', values: "'1000000,3000000'" }, {}).join()).toContain(
      'figure.values',
    );
  });

  it('never clips a label without saying so, whatever it is given', () => {
    // The invariant the tests above sample, stated once and swept: a shape may
    // draw its labels cramped, and it may draw them outside the box if what it
    // was handed cannot be drawn at all - but it may never do the second one
    // *silently*. Clipping is invisible on the play screen and slices a
    // character off in every report row, so a shape that clips has to be a
    // shape `figureIssues` refuses.
    //
    // Nine categories by eleven characters is far past anything legal, which is
    // the point: the guarantee is about the shapes nobody validated, since
    // those are the ones a child meets mid-session.
    //
    // **The odd-looking members of these two lists are the load-bearing ones,
    // and a copy of this test should keep their equivalents.** A sweep over
    // tidy round numbers passed while two whole families clipped in silence:
    //
    // - `1e21` is where `String` switches to exponential, so the axis *top*
    //   prints in five characters while a rung below it prints twenty-one. A
    //   sweep that never crosses that boundary cannot catch a guard that asks
    //   the top rung instead of every rung.
    // - `100.125` and `0.375` are scales whose rungs print wider than the top
    //   does for the ordinary reason - a fraction that does not divide - and
    //   pinning a scale is the only way to reach them, since nothing on the
    //   ladder is fractional.
    const magnitudes = [1, 3, 7, 9, 12, 47, 99, 100, 400.5, 999, 5000, 999998, 999999, 1e21];
    const pins: (string | undefined)[] = [undefined, '100.125', '0.375'];
    const silent: string[] = [];

    for (let count = 1; count <= 9; count++) {
      for (let chars = 0; chars <= 11; chars++) {
        for (const magnitude of magnitudes) {
          for (const scale of pins) {
            const values = Array.from({ length: count }, (_, index) =>
              Math.max(1, magnitude * (1 - index * 0.13)),
            ).join(',');
            const names = Array.from({ length: count }, () => 'Wednesday'.slice(0, chars)).join(',');
            const spec: FigureSpec = {
              kind: 'bar',
              values: `'${values}'`,
              ...(chars === 0 ? {} : { labels: `'${names}'` }),
              ...(scale === undefined ? {} : { scale }),
            };

            if (figureIssues(spec, {}).length > 0) continue;
            for (let seed = 0; seed < 8; seed++) {
              const outside = worstOverflow(build(spec, `bar-sweep-${seed}`));
              if (outside > 0) {
                silent.push(
                  `${count} x ${chars} chars, to ${magnitude}, scale ${scale ?? 'open'}:` +
                    ` ${outside.toFixed(2)} out`,
                );
              }
            }
          }
        }
      }
    }

    expect(silent).toEqual([]);
  });

  it('measures the axis it will draw, not the tallest value', () => {
    // The axis is labelled at `steps x scale`, so rounding the tallest value up
    // to a whole step can carry it into another digit: every one of these is
    // six characters of data under a seven-character axis, and judging them by
    // the data called them clean while the top label was sliced off in a
    // report row.
    for (const values of [
      "'999999'",
      "'999998'",
      "'999999,500000'",
      "'800000,999999'",
      "'999999,999999,999999'",
    ]) {
      const issues = figureIssues({ kind: 'bar', values }, {}).join();
      expect(issues, values).toContain('figure.values');
      // Named by what gets drawn, which is the whole point of the fix.
      expect(issues, values).toContain('1000000');
    }
  });

  it('keeps a scale it is given, and picks one that fits when it is not', () => {
    const pinned = build({ kind: 'bar', values: "'4,8,6,2'", scale: '4' }, 'bar-scale-pinned');
    expect(new Set(labels(pinned).map((label) => label.text))).toEqual(new Set(['0', '4', '8']));

    // Left open, the scale is chosen so the axis stays legible and jitters
    // over whatever the values allow - here steps of 1 and of 2 both divide
    // every value and both leave an axis that can be labelled, so the number
    // of steps on it is not something a child can learn the answer from.
    const chosen = new Set(
      Array.from(
        { length: 30 },
        (_, seed) => labels(build({ kind: 'bar', values: "'2,4'" }, `bar-scale-${seed}`)).length,
      ),
    );
    expect(chosen.size).toBeGreaterThan(1);
  });

  it('draws something for values it cannot read at all', () => {
    // Generation runs mid-session with a child waiting, so a broken `values`
    // degrades into a drawable graph rather than throwing.
    const figure = build({ kind: 'bar', values: "'not a list'" }, 'bar-broken');

    expect(figure.marks.length).toBeGreaterThan(0);
    expect(labels(figure).length).toBeGreaterThan(0);
  });
});

describe('what the bar kind reports to an author', () => {
  it('insists on the values', () => {
    expect(figureIssues({ kind: 'bar' } as FigureSpec, {}).join()).toContain('figure.values');
  });

  it('names an expression it cannot evaluate', () => {
    const issues = figureIssues({ kind: 'bar', values: 'counts' }, {});
    expect(issues.join()).toContain('figure.values');
    expect(issues.join()).toMatch(/counts/);
  });

  it('names a values that is not a string at all', () => {
    expect(figureIssues({ kind: 'bar', values: '7' }, {}).join()).toContain('expected string');
  });

  it('names a values that is not a list of numbers', () => {
    expect(figureIssues({ kind: 'bar', values: "'3,,7'" }, {}).join()).toContain('figure.values');
  });

  it('names a style that is not one of the three', () => {
    expect(figureIssues({ kind: 'bar', values: "'1,2'", style: "'bars'" }, {}).join()).toContain(
      'figure.style',
    );
  });

  it('names a scale that leaves the axis too crowded to label', () => {
    expect(figureIssues({ kind: 'bar', values: "'1,20'", scale: '1' }, {}).join()).toContain(
      'figure.scale',
    );
  });

  it('names labels that do not match the values', () => {
    expect(figureIssues({ kind: 'bar', values: "'1,2,3'", labels: "'a,b'" }, {}).join()).toContain(
      'figure.labels',
    );
  });

  it('says nothing about a graph an author got right', () => {
    expect(
      figureIssues(
        {
          kind: 'bar',
          values: "'2,4,6,8'",
          labels: "'Mo,Tu,We,Th'",
          style: "'column'",
          scale: '2',
        },
        {},
      ),
    ).toEqual([]);
  });
});
