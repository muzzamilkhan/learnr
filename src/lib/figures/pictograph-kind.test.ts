import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import { createRng } from '../rng';
import { FIGURE_BOX, type Figure, type FigureSpec, type Point } from './types';

/**
 * The `pictograph` kind, read through the two public doors - `buildFigure` and
 * `figureIssues` - rather than through the module, for `bar`'s reason: what a
 * picture graph has to get right is only true *after* the fit, because whether
 * two icons can be counted apart is a question about where they land in the box
 * a renderer is handed.
 */

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

const build = (spec: FigureSpec, seed: string): Figure => buildFigure(spec, {}, createRng(seed));

const labels = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'label' ? [mark] : []));

/** Every icon: a closed path. The two rules are open, and nothing else is drawn. */
const icons = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'path' && mark.closed ? [mark] : []));

const widthOf = (points: readonly Point[]) => {
  const xs = points.map(([x]) => x);
  return Math.max(...xs) - Math.min(...xs);
};

const centreY = (points: readonly Point[]) => {
  const ys = points.map(([, y]) => y);
  return (Math.max(...ys) + Math.min(...ys)) / 2;
};

/**
 * The icons of each data row, top to bottom, with the key's sample icon
 * dropped. Grouped by the y they share, since a row is what a fitted figure
 * has instead of an index - and the key's icon is the lowest thing drawn.
 */
function rows(figure: Figure): { at: number; width: number }[][] {
  const groups = new Map<string, { at: number; width: number }[]>();
  for (const icon of icons(figure)) {
    const at = centreY(icon.points);
    const key = at.toFixed(1);
    const group = groups.get(key) ?? [];
    group.push({ at, width: widthOf(icon.points) });
    groups.set(key, group);
  }
  const ordered = [...groups.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, group]) => group);
  // The key's own icon sits below the baseline, alone on the bottom row.
  return ordered.slice(0, -1);
}

/**
 * Every label's **ink** inside the box, measured at report scale. `fit` bounds
 * a drawing by label anchor points and an SVG clips at its own edge, so half of
 * every label hangs outside what was measured - invisible on the play screen,
 * and a sliced character in a 64px report row.
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

function expectInsideTheBox(figure: Figure, note = '') {
  expect(worstOverflow(figure), note).toBe(0);
}

describe('the pictograph figure kind', () => {
  it('draws one icon per count when one icon is worth one thing', () => {
    const figure = build({ kind: 'pictograph', counts: "'2,4,3'", key: '1' }, 'picto-ones');

    expect(rows(figure).map((row) => row.length)).toEqual([2, 4, 3]);
  });

  it('lets one icon stand for more than one thing', () => {
    // The whole point of a key: 30 things is six icons, not thirty.
    const figure = build({ kind: 'pictograph', counts: "'10,30,20'", key: '5' }, 'picto-key');

    expect(rows(figure).map((row) => row.length)).toEqual([2, 6, 4]);
  });

  it('draws ceil(count / key) icons, which is what makes a remainder a lie', () => {
    // The documented function, and the reason `issues` refuses this content:
    // 7 and 10 are different data drawn as the same two icons.
    const seven = build({ kind: 'pictograph', counts: "'7'", key: '5' }, 'picto-ceil-7');
    const ten = build({ kind: 'pictograph', counts: "'10'", key: '5' }, 'picto-ceil-10');

    expect(rows(seven)[0]).toHaveLength(2);
    expect(rows(ten)[0]).toHaveLength(2);
    expect(figureIssues({ kind: 'pictograph', counts: "'7,10'", key: '5' }, {}).join()).toContain(
      'the same picture',
    );
  });

  it('draws a half icon for a remainder when halves are allowed', () => {
    const figure = build(
      { kind: 'pictograph', counts: "'7.5,10'", key: '5', halves: 'true' },
      'picto-halves',
    );
    const [first, second] = rows(figure);

    // One and a half against two: the half is the narrow one.
    expect(first).toHaveLength(2);
    expect(second).toHaveLength(2);
    expect(first[1].width).toBeCloseTo(first[0].width / 2, 1);
    expect(second[1].width).toBeCloseTo(second[0].width, 1);
  });

  it('never draws a half icon when halves are not allowed', () => {
    // The same data, with `halves` absent - every icon is a whole one, which is
    // exactly why the count it cannot express has to be reported instead.
    for (let seed = 0; seed < 20; seed++) {
      const figure = build({ kind: 'pictograph', counts: "'7.5,10'", key: '5' }, `picto-whole-${seed}`);
      for (const row of rows(figure)) {
        const widest = Math.max(...row.map((icon) => icon.width));
        for (const icon of row) expect(icon.width).toBeCloseTo(widest, 1);
      }
    }
  });

  it('states the key in a label of its own', () => {
    for (const [key, text] of [
      ['1', '= 1'],
      ['5', '= 5'],
      ['10', '= 10'],
    ]) {
      const figure = build({ kind: 'pictograph', counts: "'10,20'", key }, `picto-key-${key}`);
      expect(labels(figure).map((label) => label.text)).toContain(text);
    }
  });

  it('labels each row when it is given names for them', () => {
    const figure = build(
      { kind: 'pictograph', counts: "'2,4,3'", key: '1', labels: "'Mon,Tue,Wed'" },
      'picto-names',
    );
    const texts = labels(figure).map((label) => label.text);

    for (const name of ['Mon', 'Tue', 'Wed']) expect(texts).toContain(name);
  });

  it('leaves the rows unlabelled when it is given no names', () => {
    const figure = build({ kind: 'pictograph', counts: "'2,4,3'", key: '1' }, 'picto-unnamed');

    // The key is the only label on an unlabelled graph.
    expect(labels(figure).map((label) => label.text)).toEqual(['= 1']);
  });

  it('keeps two counts a single icon apart tellable from one another', () => {
    // The derived quantity's third question, in the picture rather than in a
    // label: two rows that differ by one thing must not be a wall. One icon of
    // difference is a whole icon pitch of row, on every seed.
    for (let seed = 0; seed < 20; seed++) {
      const figure = build(
        { kind: 'pictograph', counts: "'4,5'", key: '1' },
        `picto-adjacent-${seed}`,
      );
      const [four, five] = rows(figure);
      const right = (row: { at: number; width: number }[], marks: Figure) =>
        Math.max(
          ...icons(marks)
            .filter((icon) => Math.abs(centreY(icon.points) - row[0].at) < 0.05)
            .map((icon) => Math.max(...icon.points.map(([x]) => x))),
        );

      const gap = right(five, figure) - right(four, figure);
      // A whole icon's width at least, so the longer row is visibly longer.
      expect(gap).toBeGreaterThanOrEqual(four[0].width);
    }
  });

  it('draws the same data as a different picture on a different seed', () => {
    // The anchoring rule: a figure must never become the anchor for an answer.
    // Every parameter a template can pin is pinned here, and the drawing still
    // has to vary - a kind that varies only when something is left open has a
    // latent anchoring failure the day a template pins it.
    const spec: FigureSpec = {
      kind: 'pictograph',
      counts: "'10,20,15'",
      labels: "'Mon,Tue,Wed'",
      key: '5',
      halves: 'false',
    };
    const drawings = new Set(
      Array.from({ length: 20 }, (_, seed) => JSON.stringify(build(spec, `picto-vary-${seed}`))),
    );

    expect(drawings.size).toBeGreaterThan(5);
  });

  it('picks a different key on a different seed when none is pinned', () => {
    const keys = new Set(
      Array.from({ length: 30 }, (_, seed) => {
        const figure = build({ kind: 'pictograph', counts: "'10,20'" }, `picto-open-key-${seed}`);
        return labels(figure).map((label) => label.text).join();
      }),
    );

    expect(keys.size).toBeGreaterThan(1);
  });

  it('spaces its rows and its icons for the report, not for the play screen', () => {
    const spec: FigureSpec = {
      kind: 'pictograph',
      counts: "'10,20,15'",
      key: '5',
      labels: "'Mon,Tue,Wed'",
    };
    expect(figureIssues(spec, {})).toEqual([]);

    for (let seed = 0; seed < 30; seed++) {
      const figure = build(spec, `picto-spacing-${seed}`);

      // Row labels are stacked, so what separates two of them is height.
      const heights = labels(figure)
        .map((label) => label.at[1])
        .sort((a, b) => a - b);
      for (let index = 1; index < heights.length; index++) {
        expect(heights[index] - heights[index - 1]).toBeGreaterThanOrEqual(REPORT_INK);
      }

      // Icons sit side by side, so what separates them is width - and the pitch
      // they are budgeted at is a stacked label's, `LINE_CLEARANCE` included,
      // which is what makes an icon grid as separable as two lines of type.
      const first = centreY(icons(figure)[0].points);
      const lefts = icons(figure)
        .filter((icon) => Math.abs(centreY(icon.points) - first) < 0.05)
        .map((icon) => Math.min(...icon.points.map(([x]) => x)))
        .sort((a, b) => a - b);
      for (let index = 1; index < lefts.length; index++) {
        expect(lefts[index] - lefts[index - 1]).toBeGreaterThanOrEqual(REPORT_INK * 1.15);
      }

      expectInsideTheBox(figure);
    }
  });

  it('keeps every label inside the box at the widest the budgets allow', () => {
    // `fit` bounds a drawing by anchor points and an SVG clips at its own edge,
    // so half of every label always hangs outside what was measured. These are
    // the widest each field is allowed to be, so if the two rules have failed
    // to reach as far as the ink does, it fails here.
    const corners: [string, FigureSpec][] = [
      ['the most rows', { kind: 'pictograph', counts: "'5,10,15,20,25'", key: '5' }],
      // The longest row label a graph still carrying two icons can have: a
      // wider gutter is a narrower row, so the two budgets trade against each
      // other and this is that trade at its end.
      ['long labels', { kind: 'pictograph', counts: "'10,20'", key: '10', labels: "'Monda,Tuesd'" }],
      ['labels and rows', { kind: 'pictograph', counts: "'5,10,15,20,25'", key: '5', labels: "'Mo,Tu,We,Th,Fr'" }],
      // The widest key label, which is the other label that reaches an edge.
      ['a wide key', { kind: 'pictograph', counts: "'1000,2000'", key: '1000' }],
      ['halves', { kind: 'pictograph', counts: "'2.5,7.5,5'", key: '5', halves: 'true' }],
      ['one row, one icon', { kind: 'pictograph', counts: "'1'", key: '1' }],
    ];

    for (const [name, spec] of corners) {
      // Every one of them is content an author is allowed to write - the point
      // is that the *legal* extremes draw legibly, not that illegal ones do.
      expect(figureIssues(spec, {}), name).toEqual([]);
      for (let seed = 0; seed < 40; seed++) {
        expectInsideTheBox(build(spec, `picto-corner-${name}-${seed}`), name);
      }
    }
  });

  it('keeps a label inside the box even when it is one it would refuse', () => {
    // `build` never refuses: it runs mid-session, on whatever was authored, and
    // validation is a separate gate. So the ink has to land inside for content
    // `issues` rejects too.
    //
    // **Where that stops being possible is written down rather than swept
    // under**: the two rules reach as far as a label's ink at a span of 1, and
    // a drawing wider than it is tall is one where the same label is wider
    // still. Everything `issues` reports about the *rows* stays inside, since
    // the widest legal gutter still leaves the frame square. A label past nine
    // characters is wider than the whole box at report scale and no
    // arrangement of anything holds it - which is the argument for reporting
    // such content rather than trying to draw it, and the reason the key's own
    // budget is not swept here: every key label past its room is by definition
    // one the frame had to widen for.
    const refused: [string, FigureSpec][] = [
      ['too many rows', { kind: 'pictograph', counts: "'1,2,3,4,5,6,7,8'", key: '1' }],
      ['a label past the gutter', { kind: 'pictograph', counts: "'1,2'", key: '1', labels: "'Wednesda,Thursday'" }],
      ['a row past the budget', { kind: 'pictograph', counts: "'40'", key: '1' }],
      ['a count the key cannot say', { kind: 'pictograph', counts: "'7,13'", key: '5' }],
    ];

    for (const [name, spec] of refused) {
      expect(figureIssues(spec, {}), name).not.toEqual([]);
      for (let seed = 0; seed < 20; seed++) {
        expectInsideTheBox(build(spec, `picto-refused-${name}-${seed}`), name);
      }
    }
  });

  it('draws something for counts it cannot read at all', () => {
    // Generation runs mid-session with a child waiting, so a broken `counts`
    // degrades into a drawable graph rather than throwing.
    const figure = build({ kind: 'pictograph', counts: "'not a list'" }, 'picto-broken');

    expect(figure.marks.length).toBeGreaterThan(0);
    expect(icons(figure).length).toBeGreaterThan(0);
    expect(labels(figure).length).toBeGreaterThan(0);
  });

  it('never clips a label, and never draws two rows the same, whatever it is given', () => {
    // The invariant the tests above sample, stated once and swept - across
    // every dimension this kind has. A shape may draw itself cramped, and it
    // may draw a count its key cannot express, but it may never do either
    // *silently*: a shape that clips or that gives two different counts one
    // picture has to be a shape `figureIssues` refuses.
    //
    // **The odd-looking members of these lists are the load-bearing ones**, and
    // a copy of this test should keep their equivalents:
    //
    // - `7` against a key of `5` is the remainder case in its plainest form -
    //   two fifths of an icon, which `halves` cannot express either.
    // - `2.5` is a count only a key of 5 with halves says exactly, so it sweeps
    //   the half-icon path rather than only the whole-icon one.
    // - `1e21` is where `String` switches to exponential, so the key's own
    //   label prints in five characters rather than twenty-two - the derived
    //   label's first question, asked of the text that gets drawn.
    // - `0.375` is a fractional pinned key, reachable no other way, whose label
    //   rounds where an integer's never would.
    //
    // Counts come in two families, and **both are load-bearing**: multiples of
    // the magnitude are the ones a key can say exactly, so they are what gets
    // *accepted* and therefore what the no-clip half actually sweeps - a sweep
    // over awkward counts alone accepts almost nothing past one row and
    // silently stops testing the layout it claims to. Awkward counts are what
    // gets *refused*, which is the other half.
    const magnitudes = [1, 2.5, 7, 9, 24, 40, 999, 1e21];
    const pins: (string | undefined)[] = [undefined, '1', '5', '0.375', '10^21'];
    const families = [
      (magnitude: number, index: number) => magnitude * (index + 1),
      (magnitude: number, index: number) => Math.max(1, magnitude * (1 - index * 0.11)),
    ];
    const silent: string[] = [];

    for (let count = 1; count <= 7; count++) {
      for (let chars = 0; chars <= 9; chars++) {
        for (const magnitude of magnitudes) {
          for (const key of pins) {
            for (const halves of [undefined, 'true']) {
              for (const family of families) {
                const counts = Array.from({ length: count }, (_, index) =>
                  family(magnitude, index),
                ).join(',');
                const names = Array.from({ length: count }, () => 'Wednesdays'.slice(0, chars)).join(',');
                const spec: FigureSpec = {
                  kind: 'pictograph',
                  counts: `'${counts}'`,
                  ...(chars === 0 ? {} : { labels: `'${names}'` }),
                  ...(key === undefined ? {} : { key }),
                  ...(halves === undefined ? {} : { halves }),
                };

                if (figureIssues(spec, {}).length > 0) continue;
                const where = `${counts} x ${chars} chars, key ${key ?? 'open'}`;
                for (let seed = 0; seed < 6; seed++) {
                  const figure = build(spec, `picto-sweep-${seed}`);
                  const outside = worstOverflow(figure);
                  if (outside > 0) silent.push(`${where}: ${outside.toFixed(2)} out`);

                  // Two rows the ink sweep cannot tell apart: same icons, same
                  // widths, different data. Invisible to any amount of measuring.
                  const drawn = rows(figure).map((row) =>
                    row.map((icon) => icon.width.toFixed(1)).join('|'),
                  );
                  const values = counts.split(',');
                  for (let a = 0; a < drawn.length; a++) {
                    for (let b = a + 1; b < drawn.length; b++) {
                      if (drawn[a] === drawn[b] && values[a] !== values[b]) {
                        silent.push(`${where}: rows ${a} and ${b} drawn the same`);
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    expect(silent).toEqual([]);
  });
});

describe('what the pictograph kind reports to an author', () => {
  it('insists on the counts', () => {
    expect(figureIssues({ kind: 'pictograph' } as FigureSpec, {}).join()).toContain('figure.counts');
  });

  it('names an expression it cannot evaluate', () => {
    const issues = figureIssues({ kind: 'pictograph', counts: 'tally' }, {}).join();
    expect(issues).toContain('figure.counts');
    expect(issues).toMatch(/tally/);
  });

  it('names a counts that is not a string at all', () => {
    expect(figureIssues({ kind: 'pictograph', counts: '7' }, {}).join()).toContain('expected string');
  });

  it('names a counts that is not a list of numbers', () => {
    expect(figureIssues({ kind: 'pictograph', counts: "'3,,7'" }, {}).join()).toContain(
      'figure.counts',
    );
    expect(figureIssues({ kind: 'pictograph', counts: "'3,seven'" }, {}).join()).toContain(
      'figure.counts',
    );
  });

  it('names a count below zero', () => {
    expect(figureIssues({ kind: 'pictograph', counts: "'3,-2'", key: '1' }, {}).join()).toContain(
      'below zero',
    );
  });

  it('says so when there is nothing to graph at all', () => {
    expect(figureIssues({ kind: 'pictograph', counts: "'0,0'" }, {}).join()).toContain(
      'every count is zero',
    );
  });

  it('names a key that is not a number of things', () => {
    expect(figureIssues({ kind: 'pictograph', counts: "'3'", key: '0' }, {}).join()).toContain(
      'figure.key',
    );
    expect(figureIssues({ kind: 'pictograph', counts: "'3'", key: '-2' }, {}).join()).toContain(
      'figure.key',
    );
  });

  it('names a key that is not a number at all', () => {
    expect(figureIssues({ kind: 'pictograph', counts: "'3'", key: "'five'" }, {}).join()).toContain(
      'expected number',
    );
  });

  it('names labels that do not match the counts', () => {
    expect(
      figureIssues({ kind: 'pictograph', counts: "'1,2,3'", key: '1', labels: "'a,b'" }, {}).join(),
    ).toContain('figure.labels');
  });

  it('names a label too long for the gutter it has to sit in', () => {
    expect(
      figureIssues(
        { kind: 'pictograph', counts: "'1,2'", key: '1', labels: "'Wednesdays,Thursdays'" },
        {},
      ).join(),
    ).toContain('figure.labels');
  });

  it('says so when a row carries more icons than can be counted apart', () => {
    // The budget is per graph, not a constant: a gutter full of names leaves
    // fewer icons than none does, so the same counts pass one way and are
    // reported the other.
    expect(figureIssues({ kind: 'pictograph', counts: "'5,6'", key: '1' }, {})).toEqual([]);
    expect(
      figureIssues({ kind: 'pictograph', counts: "'5,6'", key: '1', labels: "'Monday,Tuesda'" }, {})
        .join(),
    ).toContain('counted apart');
  });

  it('says so when a key cannot express one of the counts', () => {
    // The remainder question, answered rather than rounded away: `ceil` would
    // draw 7 as two icons and call it 10.
    const issues = figureIssues({ kind: 'pictograph', counts: "'7,15'", key: '5' }, {}).join();
    expect(issues).toContain('cannot say 7');
    expect(issues).toContain('reading 10');

    // Halves widen what a key can say, and 7 is still not one of them.
    expect(
      figureIssues({ kind: 'pictograph', counts: "'7,15'", key: '5', halves: 'true' }, {}).join(),
    ).toContain('cannot say 7');
    // 7.5 is, so the same graph with the honest count says nothing.
    expect(
      figureIssues({ kind: 'pictograph', counts: "'7.5,15'", key: '5', halves: 'true' }, {}),
    ).toEqual([]);
  });

  it('says so when two rows would be drawn identically', () => {
    // The failure no ink sweep can see: both rows fit their box perfectly and
    // are simply the same picture, under a question with one right answer.
    expect(figureIssues({ kind: 'pictograph', counts: "'6,7'", key: '5' }, {}).join()).toContain(
      'the same picture',
    );
    expect(
      figureIssues({ kind: 'pictograph', counts: "'6,7'", key: '5', halves: 'true' }, {}).join(),
    ).toContain('the same picture');
  });

  it('says so when there are more rows than a report can label', () => {
    expect(
      figureIssues({ kind: 'pictograph', counts: "'1,2,3,4,5'", key: '1' }, {}),
    ).toEqual([]);
    expect(
      figureIssues({ kind: 'pictograph', counts: "'1,2,3,4,5,6'", key: '1' }, {}).join(),
    ).toContain('rows is more than');
  });

  it('measures the key label that gets drawn, not the key it came from', () => {
    // `= ` and whatever `String` does to a large number both sit between the
    // key and its label. At 1e21 `String` switches to exponential, so the
    // *bigger* key prints in seven characters where the smaller one prints in
    // twenty-two - which a check that measured the key rather than its label
    // would have exactly backwards.
    const bigger = figureIssues({ kind: 'pictograph', counts: "'1e21,2e21'", key: '10^21' }, {}).join();
    expect(bigger).toContain('"= 1e+21"');
    expect(bigger).toContain('7 characters');

    const smaller = figureIssues({ kind: 'pictograph', counts: "'1e20,2e20'", key: '10^20' }, {}).join();
    expect(smaller).toContain('22 characters');

    // A key whose label does fit says nothing at all.
    expect(figureIssues({ kind: 'pictograph', counts: "'1000,2000'", key: '1000' }, {})).toEqual([]);
  });

  it('says nothing about a graph an author got right', () => {
    expect(
      figureIssues(
        {
          kind: 'pictograph',
          counts: "'10,20,15'",
          labels: "'Mon,Tue,Wed'",
          key: '5',
          halves: 'false',
        },
        {},
      ),
    ).toEqual([]);
  });
});
