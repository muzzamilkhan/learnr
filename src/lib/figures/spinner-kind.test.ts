import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import { sectorAngles } from './spinner-kind';
import { createRng } from '../rng';
import { type Figure, type FigureSpec, type Point } from './types';

/**
 * The `spinner` kind, read through the two public doors - `buildFigure` and
 * `figureIssues` - for `bar`'s and `pictograph`'s reason: what a spinner has to
 * get right is only true *after* the fit, because whether the biggest sector is
 * still the biggest is a question about where the boundary lines land in the
 * box a renderer is handed.
 *
 * The one exception is `sectorAngles`, which is asked directly. Whether three
 * parts really are 120 degrees each cannot be read off a fitted figure, where
 * every coordinate has been scaled and rounded - and "is this spinner fair?" is
 * a question whose answer is exactly that.
 */

const build = (spec: FigureSpec, seed: string): Figure => buildFigure(spec, {}, createRng(seed));

/** The sector boundaries: the only open paths a spinner draws. */
const boundaries = (figure: Figure) =>
  figure.marks.flatMap((mark) => (mark.kind === 'path' && !mark.closed ? [mark.points] : []));

/** The disc itself: closed, and the only closed path that is not a shaded wedge. */
const rim = (figure: Figure) =>
  figure.marks.flatMap((mark) =>
    mark.kind === 'path' && mark.closed && !mark.fill ? [mark.points] : [],
  );

const wedges = (figure: Figure) =>
  figure.marks.flatMap((mark) =>
    mark.kind === 'path' && mark.closed && mark.fill ? [mark.points] : [],
  );

const hubs = (figure: Figure) => figure.marks.filter((mark) => mark.kind === 'dot');

/**
 * Which way a point on the rim lies, in degrees anticlockwise from east - the
 * frame the figure was authored in, read back through the y-flip `fit` applied
 * on the way out.
 */
const directionOf = ([x, y]: Point): number =>
  ((Math.atan2(50 - y, x - 50) * 180) / Math.PI + 360) % 360;

/**
 * How far a recovered angle may be out. Coordinates are rounded to
 * `FIGURE_PRECISION` at a fitted radius of 44, so a point can be half a
 * hundredth off in each direction - about 0.009 degrees - and a span, being a
 * difference of two of them, about twice that. Everything below is asserted
 * against the *drawing*, so this is the floor on what a drawing can say.
 */
const ANGLE_TOLERANCE = 0.05;

/** The turn each sector takes up, read back off the boundary lines. */
function sectorSpans(figure: Figure): number[] {
  const turns = boundaries(figure)
    .map((points) => directionOf(points[1]))
    .sort((a, b) => a - b);
  return turns.map((turn, index) => (turns[(index + 1) % turns.length] - turn + 360) % 360);
}

/** How much of the whole turn is shaded - the number a "which colour?" answer rests on. */
function shadedTurn(figure: Figure): number {
  return wedges(figure).reduce((total, points) => {
    // A wedge is the centre, then its arc from one boundary to the other.
    const from = directionOf(points[1]);
    const to = directionOf(points[points.length - 1]);
    return total + ((to - from + 360) % 360);
  }, 0);
}

/** The box the rim occupies, which is what `fit` measured the whole drawing by. */
function discBounds(figure: Figure): [number, number, number, number] {
  const points = rim(figure)[0];
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
}

const sorted = (values: readonly number[]) => [...values].sort((a, b) => a - b);
const total = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0);

describe('the turn a spinner divides', () => {
  it('gives each sector a share of the turn in proportion to its parts', () => {
    expect(sectorAngles([1, 1, 2])).toEqual([90, 90, 180]);
    expect(sectorAngles([3, 5])).toEqual([135, 225]);
    expect(sectorAngles([1, 2, 3, 4])).toEqual([36, 72, 108, 144]);
  });

  it('divides the whole turn and no more: the angles add to exactly 360', () => {
    for (const parts of [[1, 1], [1, 1, 1], [1, 1, 2], [1, 2, 3], [3, 5], [2, 3, 5, 6]]) {
      expect(total(sectorAngles(parts)), JSON.stringify(parts)).toBe(360);
    }
  });

  it('gives equal parts exactly equal angles, because "is this spinner fair?" is a real question', () => {
    // Not `toBeCloseTo`: the truth of a fairness question *is* the geometry, and
    // three sectors of 119.99999999999999 degrees are a spinner that is not
    // fair. `part / total * 360` is what produces that number for a third of a
    // turn, which is why `sectorAngles` is written the other way round.
    expect(sectorAngles([1, 1, 1])).toEqual([120, 120, 120]);

    for (let count = 1; count <= 39; count++) {
      const angles = sectorAngles(Array(count).fill(1));
      for (const angle of angles) expect(angle, `${count} equal parts`).toBe(angles[0]);
    }

    // The same holds for equal parts sitting among unequal ones.
    const mixed = sectorAngles([2, 5, 2, 5, 2]);
    expect(mixed[0]).toBe(mixed[2]);
    expect(mixed[2]).toBe(mixed[4]);
    expect(mixed[1]).toBe(mixed[3]);
  });

  it('is a hundredth of a nanodegree out where the turn cannot be divided exactly', () => {
    // Written down rather than swept away: `360 / 7` is not a number a double
    // holds, so seven equal sectors cannot both be exactly equal *and* add to
    // exactly 360. Equality is the property a child's question rests on, so it
    // is the one that is exact - and nothing is drawn from the sum, since the
    // seam is drawn once, at the rotation.
    const sevenths = sectorAngles(Array(7).fill(1));
    for (const angle of sevenths) expect(angle).toBe(sevenths[0]);
    expect(total(sevenths)).not.toBe(360);
    expect(total(sevenths)).toBeCloseTo(360, 10);
  });
});

describe('the spinner figure kind', () => {
  it('draws a disc, a boundary for every sector, and a hub at the centre', () => {
    const figure = build({ kind: 'spinner', sectors: "'1,1,2'" }, 'spin-shape');

    expect(rim(figure)).toHaveLength(1);
    expect(boundaries(figure)).toHaveLength(3);
    expect(hubs(figure)).toHaveLength(1);
    expect(hubs(figure)[0]).toEqual({ kind: 'dot', at: [50, 50] });
    // Every boundary runs from the hub out to the rim.
    for (const points of boundaries(figure)) expect(points[0]).toEqual([50, 50]);
  });

  it('puts the boundaries exactly where the parts say, not nearly there', () => {
    // At a pinned rotation the arithmetic is checkable by hand, which is the
    // only way to tell an exact division from an almost-exact one: three equal
    // sectors put a boundary at exactly 120 degrees, whose rim end is
    // `50 - 44/2 = 28` across. A third of 119.97 degrees lands on 28.02.
    expect(
      boundaries(build({ kind: 'spinner', sectors: "'1,1,1'", rotation: '0' }, 'spin-exact')).map(
        (points) => points[1],
      ),
    ).toEqual([
      [94, 50],
      [28, 11.89],
      [28, 88.11],
    ]);

    // Quarters and a half, which land on the axes exactly.
    expect(
      boundaries(build({ kind: 'spinner', sectors: "'1,1,2'", rotation: '0' }, 'spin-quarters')).map(
        (points) => points[1],
      ),
    ).toEqual([
      [94, 50],
      [50, 6],
      [6, 50],
    ]);
  });

  it('turns the disc a different way on a different seed', () => {
    // The main lever, and the one that carries a template pinning nothing:
    // rotation is drawn over the whole turn and moves every boundary line.
    const drawings = new Set(
      Array.from({ length: 50 }, (_, seed) =>
        JSON.stringify(build({ kind: 'spinner', sectors: "'1,1,2'", fills: "'r,b,r'" }, `spin-turn-${seed}`)),
      ),
    );

    expect(drawings.size).toBeGreaterThan(40);
  });

  it('draws the same spinner differently with every parameter pinned', () => {
    // The anchoring rule at its hardest: a kind that varies only while
    // something is left open has a latent anchoring failure waiting for the
    // first author who pins it. With the sectors, the fills *and* the rotation
    // all pinned, what is left is which slot round the disc each sector takes.
    const spec: FigureSpec = {
      kind: 'spinner',
      sectors: "'1,2,3,4'",
      fills: "'a,b,a,b'",
      rotation: '0',
    };
    expect(figureIssues(spec, {})).toEqual([]);

    const drawings = new Set(
      Array.from({ length: 20 }, (_, seed) => JSON.stringify(build(spec, `spin-pinned-${seed}`))),
    );

    expect(drawings.size).toBeGreaterThan(5);
  });

  it('keeps the biggest sector the biggest, and the shaded share the same, on every seed', () => {
    // **The guard this kind exists to hold.** A chance question's answer names
    // a sector - "red" is right only because red's share is the biggest - and
    // the template committed to that answer before anything was drawn. So
    // everything that jitters has to leave the sizes and the per-appearance
    // totals exactly as authored, or the picture contradicts its own question.
    const spec: FigureSpec = { kind: 'spinner', sectors: "'1,1,2'", fills: "'red,blue,red'" };
    expect(figureIssues(spec, {})).toEqual([]);

    for (let seed = 0; seed < 60; seed++) {
      const figure = build(spec, `spin-guard-${seed}`);
      const spans = sorted(sectorSpans(figure));

      expect(spans).toHaveLength(3);
      expect(spans[0]).toBeCloseTo(90, 1);
      expect(spans[1]).toBeCloseTo(90, 1);
      // The largest, and it is a half of the disc every time.
      expect(spans[2]).toBeCloseTo(180, 1);
      expect(Math.max(...spans)).toBe(spans[2]);
      // Two red parts of one and two: three quarters of the turn, always.
      expect(shadedTurn(figure)).toBeCloseTo(270, 1);
    }
  });

  it('fits the disc to the same box on every seed, so turning it is not scaled away', () => {
    // `fit` is uniform and centring, so a jitter it can normalise away is not a
    // jitter at all - and a disc of fixed radius turned about its own centre is
    // exactly the shape that falls into that trap. The rim is sampled at fixed
    // angles with a vertex on each axis, so the bounds are the disc's whatever
    // the rotation is, and the rotation survives the fit.
    for (const sectors of ["'1,1,2'", "'1,1,1'", "'2,3,7'", "'1,1,1,1,1'"]) {
      for (let seed = 0; seed < 20; seed++) {
        const figure = build({ kind: 'spinner', sectors }, `spin-frame-${sectors}-${seed}`);
        expect(discBounds(figure), sectors).toEqual([6, 94, 6, 94]);
      }
    }
  });

  it('shades the first group named and leaves the rest plain', () => {
    // A figure has two appearances, so which group holds the ink cannot jitter:
    // the child's answer is "the shaded one", and swapping them inverts it.
    for (let seed = 0; seed < 20; seed++) {
      const red = build(
        { kind: 'spinner', sectors: "'1,1,2'", fills: "'red,blue,red'" },
        `spin-first-${seed}`,
      );
      expect(wedges(red)).toHaveLength(2);
      expect(shadedTurn(red)).toBeCloseTo(270, 1);

      // The same spinner named the other way round is the other three quarters.
      const blue = build(
        { kind: 'spinner', sectors: "'2,1,1'", fills: "'blue,red,blue'" },
        `spin-first-other-${seed}`,
      );
      expect(shadedTurn(blue)).toBeCloseTo(270, 1);
    }
  });

  it('alternates the sectors when it is given no fills at all', () => {
    // Only so neighbouring parts can be told apart - it says nothing about
    // them, which is why a template asking about colour has to name the groups.
    const figure = build({ kind: 'spinner', sectors: "'1,1,1,1'", rotation: '0' }, 'spin-alternate');

    expect(wedges(figure)).toHaveLength(2);
    expect(shadedTurn(figure)).toBeCloseTo(180, 1);
  });

  it('draws something for sectors it cannot read at all', () => {
    // Generation runs mid-session with a child waiting, so a broken `sectors`
    // degrades into a drawable spinner rather than throwing.
    // Including content `issues` refuses outright: `build` never refuses, it
    // runs mid-session on whatever was authored, and validation is a separate
    // gate. A refused spinner still has to fit the same box as any other.
    for (const sectors of ["'not a list'", "'0,0'", "'-1,-2'", 'parts', "'1'", "'1,1,40'", "'119,121'"]) {
      const figure = build({ kind: 'spinner', sectors }, `spin-broken-${sectors}`);
      expect(rim(figure), sectors).toHaveLength(1);
      expect(boundaries(figure).length, sectors).toBeGreaterThan(0);
      expect(discBounds(figure), sectors).toEqual([6, 94, 6, 94]);
    }
  });

  it('stays inside the marks a figure can be stored with, however many sectors it is given', () => {
    // The storage-cap exception: `parseFigure` refuses a figure over
    // `MAX_MARKS` when it is read back out of an `Attempt`, and this slice is
    // twice as far out as anything `issues` accepts, so no content that
    // validates can be cut by it.
    const many = `'${Array(500).fill(1).join(',')}'`;
    expect(figureIssues({ kind: 'spinner', sectors: many }, {})).not.toEqual([]);
    expect(build({ kind: 'spinner', sectors: many }, 'spin-many').marks.length).toBeLessThan(200);
  });

  it('never contradicts its own sectors, whatever it is given', () => {
    // The invariant the tests above sample, swept across every dimension this
    // kind has. For every shape `figureIssues` ACCEPTS, on every seed: the disc
    // fits the same box, the sectors are the sizes that were authored, and the
    // shaded share is the share that was authored. A spinner may be drawn
    // cramped, but it may never be drawn saying something else.
    //
    // **The odd-looking members of these lists are the load-bearing ones**:
    //
    // - `[1, 1, 1]` and friends are the fair spinners, where every arrangement
    //   is the same picture and the exactness of the division is all there is.
    // - `[1, 1, 30]` is the smallest sector this still accepts, a shade over
    //   `MIN_SECTOR_DEGREES` - the case where the ink limit nearly bites.
    // - `[1, 3]` under alternating fills is the shape where the two appearances
    //   are *not* the same size, so a permutation that moved a size against a
    //   fill would show up in the shaded share rather than cancelling out.
    // - A pinned rotation of `0` is the arrangement-only arm; leaving it open
    //   is the rotation arm. Both are needed, since they are the two levers.
    const families: number[][] = [
      [1, 1],
      [1, 3],
      [1, 1, 1],
      [1, 1, 2],
      [1, 2, 3],
      [1, 1, 30],
      [2, 3, 5, 6],
      [1, 1, 1, 1, 1],
      [4, 4, 4, 4, 4, 4],
    ];
    const fillsFor = (count: number): (string | undefined)[] => [
      undefined,
      `'${Array.from({ length: count }, (_, index) => (index === 0 ? 'a' : 'b')).join(',')}'`,
      `'${Array.from({ length: count }, (_, index) => (index % 2 === 0 ? 'a' : 'b')).join(',')}'`,
      `'${Array.from({ length: count }, () => 'a').join(',')}'`,
    ];
    const rotations: (string | undefined)[] = [undefined, '0', '137.5'];

    const wrong: string[] = [];
    let accepted = 0;

    for (const parts of families) {
      for (const fills of fillsFor(parts.length)) {
        for (const rotation of rotations) {
          const spec: FigureSpec = {
            kind: 'spinner',
            sectors: `'${parts.join(',')}'`,
            ...(fills === undefined ? {} : { fills }),
            ...(rotation === undefined ? {} : { rotation }),
          };
          if (figureIssues(spec, {}).length > 0) continue;
          accepted++;

          const angles = sectorAngles(parts);
          const inked = fills
            ? fills.slice(1, -1).split(',')
            : parts.map((_, index) => (index % 2 === 0 ? 'a' : 'b'));
          const shaded = total(
            angles.filter((_, index) => inked[index] === inked[0]),
          );
          const where = `${parts.join(',')} / ${fills ?? 'open'} / ${rotation ?? 'open'}`;

          for (let seed = 0; seed < 8; seed++) {
            const figure = build(spec, `spin-sweep-${seed}`);

            const bounds = discBounds(figure);
            if (bounds.join() !== '6,94,6,94') wrong.push(`${where}: fitted to ${bounds.join()}`);

            const spans = sorted(sectorSpans(figure));
            const asked = sorted(angles);
            for (let index = 0; index < asked.length; index++) {
              if (Math.abs(spans[index] - asked[index]) > ANGLE_TOLERANCE) {
                wrong.push(`${where}: sector ${spans[index]} where ${asked[index]} was asked`);
              }
            }

            // The whole disc is shaded when every sector is in one group, and
            // then there is one wedge covering the turn with no gap to measure.
            if (shaded < 360 && Math.abs(shadedTurn(figure) - shaded) > ANGLE_TOLERANCE) {
              wrong.push(`${where}: ${shadedTurn(figure)} shaded where ${shaded} was asked`);
            }
          }
        }
      }
    }

    expect(wrong).toEqual([]);
    // The sweep is only worth its comments if it accepts things: a green sweep
    // that refused almost everything would be testing almost nothing.
    expect(accepted).toBeGreaterThan(90);
  });
});

describe('what the spinner kind reports to an author', () => {
  it('insists on the sectors', () => {
    expect(figureIssues({ kind: 'spinner' } as FigureSpec, {}).join()).toContain('figure.sectors');
  });

  it('names an expression it cannot evaluate', () => {
    const issues = figureIssues({ kind: 'spinner', sectors: 'parts' }, {}).join();
    expect(issues).toContain('figure.sectors');
    expect(issues).toMatch(/parts/);
  });

  it('names a sectors that is not a string at all', () => {
    expect(figureIssues({ kind: 'spinner', sectors: '3' }, {}).join()).toContain('expected string');
  });

  it('names a sectors that is not a list of numbers', () => {
    expect(figureIssues({ kind: 'spinner', sectors: "'1,,2'" }, {}).join()).toContain(
      'figure.sectors',
    );
    expect(figureIssues({ kind: 'spinner', sectors: "'1,two'" }, {}).join()).toContain(
      'figure.sectors',
    );
  });

  it('names a part below zero', () => {
    expect(figureIssues({ kind: 'spinner', sectors: "'3,-2'" }, {}).join()).toContain('below zero');
  });

  it('names a sector of nothing at all', () => {
    expect(figureIssues({ kind: 'spinner', sectors: "'1,0,2'" }, {}).join()).toContain(
      'never land on',
    );
  });

  it('says so when the parts add up to nothing', () => {
    expect(figureIssues({ kind: 'spinner', sectors: "'0,0'" }, {}).join()).toContain(
      'add up to nothing',
    );
  });

  it('says so when one sector fills the whole disc', () => {
    expect(figureIssues({ kind: 'spinner', sectors: "'1'" }, {}).join()).toContain(
      'nothing for the arrow to land on but itself',
    );
    // And not of a lone part of nought, which is the other mistake.
    expect(figureIssues({ kind: 'spinner', sectors: "'0'" }, {}).join()).not.toContain(
      'but itself',
    );
  });

  it('says so when a sector is too thin to be a wedge in a report', () => {
    // Derived from the ink rather than chosen: a sector narrower than the two
    // boundary lines that bound it is a thick line, not a part of a disc.
    expect(figureIssues({ kind: 'spinner', sectors: "'1,1,30'" }, {})).toEqual([]);
    expect(figureIssues({ kind: 'spinner', sectors: "'1,1,40'" }, {}).join()).toContain(
      'rather than a thick line',
    );
  });

  it('says so when two different parts would be drawn the same size', () => {
    // The failure no amount of measuring ink can see: the sectors fit the disc
    // perfectly and are simply indistinguishable, under a question - "is this
    // spinner fair?" - whose answer says they are not.
    expect(figureIssues({ kind: 'spinner', sectors: "'119,121'" }, {}).join()).toContain(
      'the same picture',
    );
    // Far enough apart to see, and it says nothing.
    expect(figureIssues({ kind: 'spinner', sectors: "'1,2'" }, {})).toEqual([]);
  });

  it('names fills that do not match the sectors', () => {
    expect(
      figureIssues({ kind: 'spinner', sectors: "'1,1,2'", fills: "'red,blue'" }, {}).join(),
    ).toContain('figure.fills');
  });

  it('says so when there are more fills than a figure has appearances', () => {
    // Two appearances is the whole vocabulary - `path.fill` is a boolean - so a
    // three-colour spinner is content this cannot draw, and saying so is better
    // than drawing two of the three the same.
    const issues = figureIssues(
      { kind: 'spinner', sectors: "'1,1,1'", fills: "'red,green,blue'" },
      {},
    ).join();
    expect(issues).toContain('figure.fills');
    expect(issues).toContain('drawn the same');
  });

  it('names a fills with a hole in it, and does not call that a third colour', () => {
    const issues = figureIssues({ kind: 'spinner', sectors: "'1,1,2'", fills: "'r,,b'" }, {});
    expect(issues.join()).toContain('no name');
    expect(issues).toHaveLength(1);
  });

  it('names a rotation that is not a number', () => {
    expect(
      figureIssues({ kind: 'spinner', sectors: "'1,1,2'", rotation: "'north'" }, {}).join(),
    ).toContain('expected number');
  });

  it('says nothing about a spinner an author got right', () => {
    expect(
      figureIssues(
        { kind: 'spinner', sectors: "'1,1,2'", fills: "'red,blue,red'", rotation: '30' },
        {},
      ),
    ).toEqual([]);
  });
});
