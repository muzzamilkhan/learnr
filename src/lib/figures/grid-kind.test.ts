import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import { columnLabel, gridModule, MIN_GRID_DIMENSION, reportPitchPx } from './grid-kind';
import { createRng, type Rng } from '../rng';
import { validateTemplate } from '../templates/validate';
import {
  CHAR_RATIO,
  INK_RATIO,
  MIN_MARK_GAP_PX,
  REPORT_LABEL_SIZE,
  reportLabelWidth,
} from './labels';
import { FIGURE_BOX, MAX_MARKS, type Figure, type FigureSpec, type Mark } from './types';

/**
 * The `grid` kind, read through `buildFigure` and `figureIssues` for the reason
 * every kind since `bar` has been: what a grid has to get right - which cell
 * the mark is in, which letter is under that column - is only true *after* the
 * fit, because the answer a child reads off the picture is read off the box a
 * renderer is handed.
 *
 * `columnLabel` and `reportPitchPx` are the two exceptions, asked directly:
 * the first because the alphabet running out is a property of the function and
 * not of any one drawing, and the second so the density boundaries below are
 * re-derived here rather than copied as numbers that could quietly stop being
 * the boundary.
 */

const build = (spec: FigureSpec, seed: string, scope: Record<string, unknown> = {}): Figure =>
  buildFigure(spec, scope, createRng(seed));

type Rule = { from: [number, number]; to: [number, number] };

const rules = (figure: Figure): Rule[] =>
  figure.marks.flatMap((mark) =>
    mark.kind === 'path' && mark.points.length === 2
      ? [{ from: mark.points[0] as [number, number], to: mark.points[1] as [number, number] }]
      : [],
  );

/** The vertical grid lines, left to right. `fit` does not turn x over. */
const verticals = (figure: Figure): number[] =>
  rules(figure)
    .filter((rule) => Math.abs(rule.from[0] - rule.to[0]) < 0.01)
    .map((rule) => rule.from[0])
    .sort((a, b) => a - b);

/**
 * The horizontal grid lines, **bottom row first**. `fit` turns y over on the
 * way out, so the bottom of the grid is the largest screen y - which is
 * exactly the flip this sort is here to undo, and the reason row 1 being the
 * bottom row is asserted through it rather than by eye.
 */
const horizontals = (figure: Figure): number[] =>
  rules(figure)
    .filter((rule) => Math.abs(rule.from[1] - rule.to[1]) < 0.01)
    .map((rule) => rule.from[1])
    .sort((a, b) => b - a);

const labelMarks = (figure: Figure): Extract<Mark, { kind: 'label' }>[] =>
  figure.marks.flatMap((mark) => (mark.kind === 'label' ? [mark] : []));

const dotAt = (figure: Figure): [number, number] => {
  const dot = figure.marks.find((mark) => mark.kind === 'dot');
  if (!dot || dot.kind !== 'dot') throw new Error('no mark on the grid');
  return dot.at as [number, number];
};

/** The labels under the grid, left to right - the column names a child reads. */
const columnLabels = (figure: Figure): string[] => {
  const marks = labelMarks(figure);
  const lowest = Math.max(...marks.map((mark) => mark.at[1]));
  return marks
    .filter((mark) => Math.abs(mark.at[1] - lowest) < 0.01)
    .sort((a, b) => a.at[0] - b.at[0])
    .map((mark) => mark.text);
};

/** The labels beside the grid, **bottom first**, undoing the y flip as above. */
const rowLabels = (figure: Figure): string[] => {
  const marks = labelMarks(figure);
  const leftmost = Math.min(...marks.map((mark) => mark.at[0]));
  return marks
    .filter((mark) => Math.abs(mark.at[0] - leftmost) < 0.01)
    .sort((a, b) => b.at[1] - a.at[1])
    .map((mark) => mark.text);
};

/**
 * Which cell the mark is in, recovered from the lines themselves rather than
 * from the count of them: the column is how many vertical lines stand to its
 * left, the row how many horizontal lines stand below it. Counting
 * `columns * rows` cells would prove a grid was drawn and say nothing at all
 * about whether the mark landed in the right one.
 */
const cellOf = (figure: Figure): [number, number] => {
  const [x, y] = dotAt(figure);
  return [
    verticals(figure).filter((at) => at < x - 0.01).length,
    horizontals(figure).filter((at) => at > y + 0.01).length,
  ];
};

/** Which intersection the mark stands on, for the coordinate reading. */
const latticeOf = (figure: Figure): [number, number] => {
  const [x, y] = dotAt(figure);
  const column = verticals(figure).findIndex((at) => Math.abs(at - x) < 0.01);
  const row = horizontals(figure).findIndex((at) => Math.abs(at - y) < 0.01);
  return [column, row];
};

/** The box a label's ink really occupies in a parent's report row. */
const inkBox = (mark: Extract<Mark, { kind: 'label' }>) => {
  const halfWidth = reportLabelWidth(mark.text.length) / 2;
  const halfHeight = (REPORT_LABEL_SIZE * INK_RATIO) / 2;
  return {
    left: mark.at[0] - halfWidth,
    right: mark.at[0] + halfWidth,
    top: mark.at[1] - halfHeight,
    bottom: mark.at[1] + halfHeight,
  };
};

const spacings = (positions: readonly number[]): number[] =>
  positions.slice(1).map((at, index) => Math.abs(at - positions[index]));

const cellSpec = (extra: Partial<Record<string, string>> = {}): FigureSpec =>
  ({ kind: 'grid', at: "'2,3'", ...extra }) as FigureSpec;

describe('the letters running along a grid', () => {
  it('names the first twenty-six columns with one letter each', () => {
    expect(columnLabel(1)).toBe('A');
    expect(columnLabel(2)).toBe('B');
    expect(columnLabel(26)).toBe('Z');
  });

  // The fourth question a derived label owes, and the one the other label
  // kinds never had to ask: A-Z runs out. Wrapping is what keeps every column
  // named by something, and named by something of its own - a blank or a
  // second "A" would be two columns a child cannot tell apart.
  it('never draws a blank or a repeat once the alphabet runs out', () => {
    expect(columnLabel(27)).toBe('AA');
    expect(columnLabel(28)).toBe('AB');
    expect(columnLabel(52)).toBe('AZ');
    expect(columnLabel(53)).toBe('BA');

    const seen = new Set<string>();
    for (let index = 1; index <= 200; index++) {
      const text = columnLabel(index);
      expect(text, `column ${index}`).not.toBe('');
      expect(seen.has(text), `column ${index} repeats ${text}`).toBe(false);
      seen.add(text);
    }
  });
});

describe('the grid figure kind', () => {
  it('draws columns x rows cells, evenly spaced and square', () => {
    const figure = build(cellSpec({ columns: '4', rows: '3' }), 'grid-shape');

    // Four columns and three rows are five vertical lines and four horizontal
    // ones - the lines are what a child counts cells between.
    expect(verticals(figure)).toHaveLength(5);
    expect(horizontals(figure)).toHaveLength(4);

    const across = spacings(verticals(figure));
    const up = spacings(horizontals(figure));
    for (const gap of [...across, ...up]) expect(gap).toBeCloseTo(across[0], 1);
  });

  it('puts the mark in the cell the template asked for, counting from the bottom left', () => {
    const figure = build(cellSpec({ columns: '4', rows: '3' }), 'grid-cell');
    // Column 2, row 3: two vertical lines to its left, three horizontal lines
    // below it. Row 3 of 3 is the top row, because row 1 is the bottom one.
    expect(cellOf(figure)).toEqual([2, 3]);
  });

  it('puts the mark on the intersection when the grid is read as a coordinate plane', () => {
    const figure = build(
      cellSpec({ columns: '4', rows: '4', onLines: 'true' }),
      'grid-lattice',
    );
    // (2,3) is the point where the third vertical line crosses the fourth
    // horizontal one - index 2 and index 3, counting the axes as 0.
    expect(latticeOf(figure)).toEqual([2, 3]);
  });

  it('numbers or letters the columns, and always numbers the rows', () => {
    const numbered = build(
      cellSpec({ columns: '4', rows: '3', axisLabels: "'numbers'" }),
      'grid-numbers',
    );
    expect(columnLabels(numbered)).toEqual(['1', '2', '3', '4']);
    expect(rowLabels(numbered)).toEqual(['1', '2', '3']);

    const lettered = build(
      cellSpec({ columns: '4', rows: '3', axisLabels: "'letters'" }),
      'grid-letters',
    );
    expect(columnLabels(lettered)).toEqual(['A', 'B', 'C', 'D']);
    // The map convention: letters across, numbers up, so a cell is "B3".
    expect(rowLabels(lettered)).toEqual(['1', '2', '3']);
  });

  it('counts a coordinate plane from zero, on both axes', () => {
    const figure = build(
      cellSpec({ columns: '4', rows: '4', onLines: 'true', axisLabels: "'numbers'" }),
      'grid-axes',
    );
    expect(columnLabels(figure)).toEqual(['0', '1', '2', '3', '4']);
    expect(rowLabels(figure)).toEqual(['0', '1', '2', '3', '4']);
  });

  it('draws no labels at all where the template asked for none', () => {
    const figure = build(
      cellSpec({ columns: '4', rows: '3', axisLabels: "'none'" }),
      'grid-bare',
    );
    expect(labelMarks(figure)).toHaveLength(0);
  });

  it('never draws a coordinate outside the first quadrant, whatever it is handed', () => {
    // **Both assertions here are about grid coordinates, not fitted ones.**
    // Asserting the emitted points lie in [0, FIGURE_BOX] would look like this
    // requirement and be a tautology: `fit` clamps every coordinate into
    // exactly that range for every kind and every spec, so such a check passes
    // whatever this file does. What carries the requirement is the two below -
    // no axis is named with a negative number, and the mark itself lands
    // inside the grid rather than off its bottom-left corner.
    for (const at of ["'2,3'", "'-1,-4'", "'0,0'", "'nonsense'", "'2.4,3.6'"]) {
      for (const onLines of ['false', 'true']) {
        const figure = build({ kind: 'grid', at, onLines } as FigureSpec, `quadrant-${at}-${onLines}`);
        const where = `${at} / onLines=${onLines}`;

        // A negative one would be a second quadrant this kind has no business
        // drawing, and the number pad has no minus key to answer it with.
        for (const mark of labelMarks(figure)) {
          expect(mark.text, where).toMatch(/^(?:[0-9]+|[A-Z]+)$/);
        }

        // The mark is inside the ruled lattice - between the first and last
        // line on each axis. A `-1,-4` clamped anywhere but into the grid
        // would land outside this, and so would one drawn at a negative cell.
        const [x, y] = dotAt(figure);
        const columns = verticals(figure);
        const rows = horizontals(figure);
        expect(x, `${where} x`).toBeGreaterThanOrEqual(columns[0]);
        expect(x, `${where} x`).toBeLessThanOrEqual(columns[columns.length - 1]);
        // `horizontals` is sorted bottom-first, which in screen units is
        // largest-first, so the grid's own top and bottom are the two ends.
        expect(y, `${where} y`).toBeLessThanOrEqual(rows[0]);
        expect(y, `${where} y`).toBeGreaterThanOrEqual(rows[rows.length - 1]);
      }
    }
  });
});

describe('what a grid varies, and what it may not', () => {
  it('draws the same cell on grids of different extents when the extent is open', () => {
    const extents = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const figure = build(cellSpec({ axisLabels: "'letters'" }), `extent-${seed}`);
      extents.add(`${verticals(figure).length}x${horizontals(figure).length}`);
      // The lever is safe precisely because the answer survives it: B3 is B3
      // on a 3-wide grid and on a 5-wide one.
      expect(cellOf(figure), `seed ${seed}`).toEqual([2, 3]);
      expect(columnLabels(figure)[1]).toBe('B');
    }
    expect(extents.size).toBeGreaterThan(1);
  });

  it('varies the extent visibly, not by a wobble only the JSON can see', () => {
    const cells = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      cells.add(verticals(build(cellSpec({ axisLabels: "'letters'" }), `spread-${seed}`)).length);
    }
    // Three different widths of grid is a picture a child can tell apart, which
    // a tenth of a millimetre of cell aspect would not be.
    expect(cells.size).toBeGreaterThanOrEqual(3);
  });

  // The reason `answerIssues` exists on this kind: the notation is not
  // decoration, it is the spelling of the answer.
  it('draws the same column as a letter or as a number when the notation is open', () => {
    const spellings = new Set<string>();
    for (let seed = 0; seed < 40; seed++) {
      const figure = build(cellSpec({ columns: '4', rows: '4' }), `notation-${seed}`);
      spellings.add(columnLabels(figure)[1]);
    }
    expect(spellings).toEqual(new Set(['B', '2']));
  });

  it('draws one picture and one only once the template has pinned everything', () => {
    // No hidden jitter is left, deliberately: a fully pinned grid comes out
    // byte-identical, so `validateTemplate`'s 50-seed anchoring check refuses
    // it for free, the way it already refuses a regular polygon with a pinned
    // rotation. A cell-aspect wobble here would have hidden that.
    const spec = cellSpec({ columns: '4', rows: '4', axisLabels: "'letters'", onLines: 'false' });
    const drawings = new Set(
      Array.from({ length: 20 }, (_, seed) => JSON.stringify(build(spec, `pinned-${seed}`))),
    );
    expect(drawings.size).toBe(1);
  });

  it('takes the same number of values off the Rng whatever the template pins', () => {
    const draws = (spec: FigureSpec): number => {
      const inner = createRng('appetite');
      let calls = 0;
      const counting: Rng = {
        next: () => {
          calls++;
          return inner.next();
        },
        int: (min, max) => {
          calls++;
          return inner.int(min, max);
        },
        pick: (items) => {
          calls++;
          return inner.pick(items);
        },
      };
      buildFigure(spec, {}, counting);
      return calls;
    };

    // A figure whose appetite grew with what a template pinned would reshuffle
    // the distractors of the very question it illustrates.
    const bare = draws(cellSpec());
    expect(draws(cellSpec({ columns: '4' }))).toBe(bare);
    expect(draws(cellSpec({ columns: '4', rows: '4' }))).toBe(bare);
    expect(draws(cellSpec({ columns: '4', rows: '4', axisLabels: "'numbers'" }))).toBe(bare);
    expect(draws(cellSpec({ onLines: 'true' }))).toBe(bare);
  });
});

describe('what a grid reports to its author', () => {
  const issuesFor = (spec: Partial<Record<string, string>>, scope: Record<string, unknown> = {}) =>
    figureIssues({ kind: 'grid', ...spec } as FigureSpec, scope);

  it('accepts a grid a report row can hold', () => {
    expect(issuesFor({ at: "'2,3'", columns: '4', rows: '4' })).toEqual([]);
    expect(issuesFor({ at: "'2,3'", columns: '4', rows: '4', onLines: 'true' })).toEqual([]);
    expect(issuesFor({ at: "'2,3'" })).toEqual([]);
  });

  it('reports a point that is not two numbers', () => {
    expect(issuesFor({ at: "'somewhere'" }).join(' ')).toContain('figure.at');
    expect(issuesFor({ at: "'2'" }).join(' ')).toContain('figure.at');
    expect(issuesFor({ at: "'2,3,4'" }).join(' ')).toContain('figure.at');
  });

  it('reports a point off the lattice, and one outside the first quadrant', () => {
    expect(issuesFor({ at: "'2.5,3'" }).join(' ')).toContain('whole');
    expect(issuesFor({ at: "'-1,3'" }).join(' ')).toContain('first quadrant');
    // A grid map's columns start at 1: there is no column 0 to be in.
    expect(issuesFor({ at: "'0,3'" }).join(' ')).toContain('column 0');
    // The coordinate reading has an origin, so 0 is a real place to stand.
    expect(issuesFor({ at: "'0,3'", onLines: 'true' })).toEqual([]);
  });

  it('reports a point outside the grid the template pinned', () => {
    expect(issuesFor({ at: "'6,3'", columns: '4', rows: '4' }).join(' ')).toContain('outside');
  });

  it('reports a grid too small to be a grid', () => {
    expect(issuesFor({ at: "'1,1'", columns: '1', rows: '3' }).join(' ')).toContain(
      `${MIN_GRID_DIMENSION}`,
    );
    expect(issuesFor({ at: "'1,1'", columns: '3', rows: '2.5' }).join(' ')).toContain('whole');
  });

  it('reports a grid whose lines or labels a report row cannot keep apart', () => {
    // The limits are derived, not chosen: `reportPitchPx` is what decides
    // them, and it is asked here rather than a number being copied.
    const accepted: number[] = [];
    for (let side = MIN_GRID_DIMENSION; side <= 20; side++) {
      if (issuesFor({ at: "'1,1'", columns: String(side), rows: String(side) }).length === 0) {
        accepted.push(side);
      }
    }
    expect(accepted[0]).toBe(MIN_GRID_DIMENSION);
    // Whatever the largest accepted square is, one more must be refused - the
    // boundary is a real boundary rather than a limit nothing reaches.
    const largest = accepted[accepted.length - 1];
    expect(largest).toBeLessThan(20);
    expect(issuesFor({ at: "'1,1'", columns: String(largest + 1), rows: String(largest + 1) }))
      .not.toEqual([]);

    // An unlabelled grid has no labels to keep apart, so it holds more.
    const bare = issuesFor({
      at: "'1,1'",
      columns: String(largest + 1),
      rows: String(largest + 1),
      axisLabels: "'none'",
    });
    expect(bare).toEqual([]);
  });

  it('holds a map to 5 by 5 and a coordinate plane to 4 by 4, exactly', () => {
    // **The two numbers Phase 3 is planning content against, pinned as a
    // contract rather than derived alongside the implementation.** The tests
    // above find whatever the largest accepted square happens to be and check
    // the next one is refused, which stays green if a regression moves the cap
    // from 5 to 3 - these do not. If either number changes, this fails and the
    // content plan has to be revisited rather than quietly shipping smaller
    // grids.
    expect(issuesFor({ at: "'1,1'", columns: '5', rows: '5', axisLabels: "'letters'" })).toEqual([]);
    expect(
      issuesFor({ at: "'1,1'", columns: '6', rows: '6', axisLabels: "'letters'" }),
    ).not.toEqual([]);

    // A plane labels its lines, so it carries one more name per axis than a
    // map of the same size and runs out of room a square sooner.
    const plane = { at: "'1,1'", axisLabels: "'numbers'", onLines: 'true' };
    expect(issuesFor({ ...plane, columns: '4', rows: '4' })).toEqual([]);
    expect(issuesFor({ ...plane, columns: '5', rows: '5' })).not.toEqual([]);
  });

  it('leaves a point at the density corner with no extent left to vary', () => {
    // The corner case the module comment and `at`'s field doc both name: with
    // the notation pinned, as it must be, the number of grids the builder can
    // choose from falls to one as the mark approaches the far corner - and the
    // figure then stops varying for a reason nothing in this kind reports.
    // The generic anchoring check catches it, naming figure.rotation, which is
    // why the rule "mark a point with room to spare" is written down.
    const pictures = (at: string, onLines: string) =>
      new Set(
        Array.from({ length: 20 }, (_, seed) =>
          JSON.stringify(
            build(
              {
                kind: 'grid',
                at,
                axisLabels: onLines === 'true' ? "'numbers'" : "'letters'",
                onLines,
              } as FigureSpec,
              `corner-${at}-${onLines}-${seed}`,
            ),
          ),
        ),
      ).size;

    expect(pictures("'2,3'", 'false')).toBeGreaterThan(1);
    expect(pictures("'5,4'", 'false')).toBeGreaterThan(1);
    expect(pictures("'5,5'", 'false')).toBe(1);

    expect(pictures("'2,3'", 'true')).toBeGreaterThan(1);
    expect(pictures("'5,4'", 'true')).toBe(1);
  });

  it('draws an unlabelled grid as densely as the report row allows and no denser', () => {
    // With no labels the only thing to keep apart is the lines themselves, so
    // the boundary must be `MIN_MARK_GAP_PX` and nothing else. Re-derived here
    // through `reportPitchPx` rather than written down as a number, so
    // retuning the report row moves the test and the kind together.
    const bare: number[] = [];
    for (let side = MIN_GRID_DIMENSION; side <= 30; side++) {
      if (
        issuesFor({ at: "'1,1'", columns: String(side), rows: String(side), axisLabels: "'none'" })
          .length === 0
      ) {
        bare.push(side);
      }
    }
    const widest = bare[bare.length - 1];
    // An unlabelled grid's cell is exactly 1 / its longer side.
    expect(reportPitchPx(1 / widest)).toBeGreaterThanOrEqual(MIN_MARK_GAP_PX);
    expect(reportPitchPx(1 / (widest + 1))).toBeLessThan(MIN_MARK_GAP_PX);
  });

  it('names the number the author wrote for a grid past anything a report row can hold', () => {
    // The density message describes the grid `build` would really draw, which
    // is capped - so a thousand columns is reported against the thousand,
    // and is the only thing reported about it.
    const reported = issuesFor({ at: "'1,1'", columns: '1000', rows: '3' });
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('1000');
  });

  it('reports a point no readable grid could reach, rather than the grid around it', () => {
    const reported = issuesFor({ at: "'1000000000,1'" });
    expect(reported).toHaveLength(1);
    expect(reported[0]).toContain('figure.at');
    expect(reported[0]).toContain('1000000000');
  });

  it('still draws something for a point no readable grid could reach', () => {
    // `build` never refuses and never hangs: the grid it falls back to is
    // capped, so a billion columns is not a billion rules.
    const figure = build({ kind: 'grid', at: "'1000000000,1'" } as FigureSpec, 'runaway');
    expect(figure.marks.length).toBeLessThanOrEqual(MAX_MARKS);
  });

  it('reports a lettered axis on a coordinate plane, where a pair of numbers is the answer', () => {
    const reported = issuesFor({
      at: "'2,3'",
      columns: '4',
      rows: '4',
      onLines: 'true',
      axisLabels: "'letters'",
    });
    expect(reported.join(' ')).toContain('figure.axisLabels');
    expect(reported.join(' ')).toContain('onLines');
  });

  it('reports an axisLabels nobody could draw', () => {
    expect(issuesFor({ at: "'2,3'", axisLabels: "'squiggles'" }).join(' ')).toContain('squiggles');
  });

  it('reports a field that does not read as what it has to be', () => {
    expect(issuesFor({ at: '2' }).join(' ')).toContain('expected string');
    expect(issuesFor({ at: "'2,3'", columns: "'four'" }).join(' ')).toContain('expected number');
    expect(issuesFor({ at: "'2,3'", onLines: "'yes'" }).join(' ')).toContain('expected boolean');
    expect(issuesFor({})).toContain('figure.at must be a non-empty expression string');
  });
});

describe('what a grid reports about the answer beside it', () => {
  const answerIssues = (spec: Partial<Record<string, string>>, answer: string) =>
    gridModule.answerIssues!({ kind: 'grid', at: "'2,3'", ...spec } as never, answer);

  it('reports an answer written in one notation while the notation is still open', () => {
    expect(answerIssues({}, "'B3'").join(' ')).toContain('figure.axisLabels');
    expect(answerIssues({}, "'2,3'").join(' ')).toContain('figure.axisLabels');
  });

  it('reports an answer the pinned notation can never draw', () => {
    expect(answerIssues({ axisLabels: "'numbers'" }, "'B3'").join(' ')).toContain('never');
    expect(answerIssues({ axisLabels: "'letters'" }, "'2,3'").join(' ')).toContain('never');
    expect(answerIssues({ axisLabels: "'none'" }, "'B3'").join(' ')).toContain('no labels');
  });

  it('says nothing where the notation is pinned to what the answer is written in', () => {
    expect(answerIssues({ axisLabels: "'letters'" }, "'B3'")).toEqual([]);
    expect(answerIssues({ axisLabels: "'numbers'" }, "'2,3'")).toEqual([]);
    // A coordinate plane never letters its axes, so a pair is safe unpinned.
    expect(answerIssues({ onLines: 'true' }, "'(2,3)'")).toEqual([]);
    // ...and a letter reference on one is wrong on every draw, not half.
    expect(answerIssues({ onLines: 'true' }, "'B3'").join(' ')).toContain('never');
  });

  it('says nothing about an answer that is not a cell reference', () => {
    expect(answerIssues({}, '12')).toEqual([]);
    expect(answerIssues({}, "'red'")).toEqual([]);
    // The blind spot, stated as a test so it cannot be mistaken for a
    // guarantee: an answer reached through a bound variable is unreadable
    // here, and a template can still be wrong in exactly the way above.
    expect(answerIssues({}, 'reference')).toEqual([]);
    expect(answerIssues({}, "column + row")).toEqual([]);
  });
});

describe('a grid template as validateTemplate sees it', () => {
  /**
   * The module comment claims two things about the gate a template actually
   * passes through, and neither is true of this file alone: that pinning the
   * notation and leaving the extent open ships, and that pinning both is
   * refused by the generic anchoring check with no rule of this kind's own.
   * Both are asserted here rather than left as prose.
   */
  const template = (figure: Record<string, string>) => ({
    id: 'maths.3.position.grid-reference',
    subject: 'maths',
    topic: 'position',
    level: '3',
    prompt: 'Which square is the dot in?',
    vars: [],
    answer: "'B3'",
    answerType: 'text' as const,
    figure: { kind: 'grid' as const, at: "'2,3'", ...figure },
  });

  it('ships a grid whose notation is pinned and whose extent is left open', () => {
    expect(validateTemplate(template({ axisLabels: "'letters'" })).errors).toEqual([]);
  });

  it('is refused by the anchoring check once the extent is pinned as well', () => {
    const errors = validateTemplate(
      template({ axisLabels: "'letters'", columns: '4', rows: '4' }),
    ).errors;
    expect(errors).toContainEqual(expect.stringMatching(/always drew the same picture/i));
  });

  it('is refused for the notation the answer is written in when that is left open', () => {
    const errors = validateTemplate(template({ columns: '4', rows: '4' })).errors;
    expect(errors).toContainEqual(expect.stringMatching(/figure\.axisLabels is left to jitter/i));
  });
});

describe('the sweep: everything an author can ship stays legible', () => {
  /**
   * Every shape `issues` accepts, drawn on several seeds, measured for ink and
   * read for repeats. The awkward values here are load-bearing and are not to
   * be tidied into round ones: `onLines: true` puts a label *on* the top and
   * right bounds of the drawing where nothing else reaches, and `'letters'`
   * is the only mode whose labels are not the numbers they were derived from.
   */
  const points = ["'1,1'", "'2,3'", "'3,2'"];
  const modes = ["'numbers'", "'letters'", "'none'", undefined];

  it('never clips a label and never draws two the same', () => {
    let accepted = 0;
    const labelledColumns = new Set<number>();
    const bareColumns = new Set<number>();
    const acceptedModes = new Set<string>();

    for (let columns = 1; columns <= 8; columns++) {
      for (let rows = 1; rows <= 8; rows++) {
        for (const axisLabels of modes) {
          for (const onLines of ['false', 'true']) {
            for (const at of points) {
              const spec = {
                kind: 'grid',
                at,
                columns: String(columns),
                rows: String(rows),
                ...(axisLabels === undefined ? {} : { axisLabels }),
                onLines,
              } as FigureSpec;
              // A corner that is actually refused proves nothing about
              // clipping, so the ink is only measured where issues is empty.
              if (figureIssues(spec, {}).length > 0) continue;
              accepted++;
              (axisLabels === "'none'" ? bareColumns : labelledColumns).add(columns);
              acceptedModes.add(String(axisLabels));

              for (let seed = 0; seed < 3; seed++) {
                const figure = build(spec, `sweep-${columns}-${rows}-${axisLabels}-${onLines}-${at}-${seed}`);
                const where = `${columns}x${rows} ${axisLabels} onLines=${onLines} ${at}`;

                for (const mark of labelMarks(figure)) {
                  const ink = inkBox(mark);
                  expect(ink.left, `${where} left`).toBeGreaterThanOrEqual(0);
                  expect(ink.right, `${where} right`).toBeLessThanOrEqual(FIGURE_BOX);
                  expect(ink.top, `${where} top`).toBeGreaterThanOrEqual(0);
                  expect(ink.bottom, `${where} bottom`).toBeLessThanOrEqual(FIGURE_BOX);
                }

                // The third question a derived label owes, and the one no
                // amount of measuring ink can answer.
                const across = columnLabels(figure);
                const up = rowLabels(figure);
                if (across.length > 0) expect(new Set(across).size, `${where} columns`).toBe(across.length);
                if (up.length > 0) expect(new Set(up).size, `${where} rows`).toBe(up.length);
              }
            }
          }
        }
      }
    }

    // Counting what the sweep accepted, rather than trusting that it is green:
    // a sweep that refuses everything passes and tests nothing.
    expect(accepted).toBeGreaterThan(100);
    // Every dimension commented as load-bearing has to contribute acceptances.
    expect(acceptedModes).toEqual(new Set(["'numbers'", "'letters'", "'none'", 'undefined']));
    expect(labelledColumns.has(MIN_GRID_DIMENSION)).toBe(true);
    // ...and the two density limits have to bite in different places inside
    // the swept range, or the sweep is measuring nothing about legibility:
    // names down the side are what a labelled grid runs out of room for, and
    // a bare one only ever runs out of room for its own lines.
    expect(labelledColumns.has(8)).toBe(false);
    expect(bareColumns.has(8)).toBe(true);
  });

  it('leaves the whole of the padding unspent on the side the labels pin', () => {
    // The containment identity: the drawing's own bound *is* the widest
    // label's ink edge, so the horizontal margin is FIGURE_PADDING never
    // being asked to pay for text at all - `pictograph`'s technique, not
    // `bar`'s solved inequality.
    const figure = build(
      cellSpec({ columns: '4', rows: '4', axisLabels: "'letters'" }),
      'margin',
    );
    const inks = labelMarks(figure).map(inkBox);
    const leftmost = Math.min(...inks.map((ink) => ink.left));
    expect(leftmost).toBeGreaterThan(0);
    expect(leftmost).toBeLessThan(REPORT_LABEL_SIZE * CHAR_RATIO);
  });
});
