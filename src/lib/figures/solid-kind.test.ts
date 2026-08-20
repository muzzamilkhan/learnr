import { describe, expect, it } from 'vitest';
import { buildFigure, figureIssues } from './build';
import { CUBE_NETS, cuboidEdges, MIN_CUBOID_RATIO, SOLIDS, type SolidName } from './solid-kind';
import { createRng, type Rng } from '../rng';
import { FIGURE_BOX, type Figure, type FigureSpec, type Point } from './types';

/**
 * The `solid` kind, read through the two public doors - `buildFigure` and
 * `figureIssues` - like every kind before it, with two exceptions asked
 * directly because a fitted figure cannot answer them.
 *
 * `CUBE_NETS` is one: whether a table of six squares really folds into a cube
 * is arithmetic about the folding, not about the drawing, and a table that
 * shipped a hexomino which is *not* a net would draw perfectly and teach a
 * child something false. The folding is simulated here rather than trusted.
 *
 * `cuboidEdges` is the other, for `sectorAngles`' reason: an oblique drawing
 * foreshortens its depth by a convention of its own, so "is this a cuboid or a
 * cube?" cannot be read off the picture in the depth direction at all - the
 * three edge lengths are where that question is decided.
 */

const SEEDS = Array.from({ length: 24 }, (_, index) => `solid-${index}`);

const build = (spec: FigureSpec, seed: string, scope = {}): Figure =>
  buildFigure(spec, scope, createRng(seed));

const spec = (solid: string, view?: string, rotation?: string): FigureSpec => ({
  kind: 'solid',
  solid: `'${solid}'`,
  ...(view === undefined ? {} : { view: `'${view}'` }),
  ...(rotation === undefined ? {} : { rotation }),
});

const paths = (figure: Figure) => figure.marks.flatMap((mark) => (mark.kind === 'path' ? [mark] : []));
const closed = (figure: Figure) => paths(figure).filter((path) => path.closed);
const hidden = (figure: Figure) => paths(figure).filter((path) => path.dashed);

const drawings = (subject: FigureSpec, seeds: readonly string[]) =>
  new Set(seeds.map((seed) => JSON.stringify(build(subject, seed))));

const manySeeds = Array.from({ length: 50 }, (_, index) => `solid-many-${index}`);

/** Every solid but the one that cannot be unfolded. */
type Netted = Exclude<SolidName, 'sphere'>;
const NETTED: readonly Netted[] = SOLIDS.filter((solid) => solid !== 'sphere');

/**
 * How many faces each solid that has a net has, which is how many a net of it
 * draws. The sphere is left out rather than given a number: how many faces a
 * ball has is a question people answer differently, and nothing here needs it.
 */
const FACES: Record<Netted, number> = {
  cube: 6,
  cuboid: 6,
  cone: 2,
  cylinder: 3,
  'square-pyramid': 5,
  'triangular-prism': 5,
};

const distance = ([ax, ay]: Point, [bx, by]: Point) => Math.hypot(bx - ax, by - ay);

/** The side lengths of a closed path, in order. */
const sides = (points: readonly Point[]) =>
  points.map((point, index) => distance(point, points[(index + 1) % points.length]));

/**
 * Rolling a cube across the grid a net is laid out on: the face that ends up
 * touching the paper at each cell. `D` is the cube's own face vector pointing
 * down, `N` the one pointing north, and a roll turns them. A hexomino is a net
 * of a cube exactly when its six cells put six *different* faces on the paper.
 */
type Roll = { D: readonly number[]; N: readonly number[] };
const cross = (a: readonly number[], b: readonly number[]) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const flip = (a: readonly number[]) => a.map((value) => -value);

function roll({ D, N }: Roll, direction: 'E' | 'W' | 'N' | 'S'): Roll {
  const E = cross(D, N);
  if (direction === 'E') return { D: E, N };
  if (direction === 'W') return { D: flip(E), N };
  if (direction === 'N') return { D: N, N: flip(D) };
  return { D: flip(N), N: D };
}

function foldsToACube(cells: readonly Point[]): boolean {
  const filled = new Set(cells.map(([column, row]) => `${column},${row}`));
  const seen = new Map<string, Roll>();
  const start: Roll = { D: [0, 0, 1], N: [0, 1, 0] };
  const queue: [Point, Roll][] = [[cells[0], start]];
  seen.set(`${cells[0][0]},${cells[0][1]}`, start);
  const faces: string[] = [];

  while (queue.length > 0) {
    const [[column, row], state] = queue.shift()!;
    faces.push(state.D.join(','));
    const steps: [number, number, 'E' | 'W' | 'N' | 'S'][] = [
      [1, 0, 'E'],
      [-1, 0, 'W'],
      [0, -1, 'N'],
      [0, 1, 'S'],
    ];
    for (const [dc, dr, direction] of steps) {
      const key = `${column + dc},${row + dr}`;
      if (!filled.has(key) || seen.has(key)) continue;
      const rolled = roll(state, direction);
      seen.set(key, rolled);
      queue.push([[column + dc, row + dr], rolled]);
    }
  }

  return seen.size === cells.length && new Set(faces).size === 6;
}

/** A cell list under one of the eight symmetries of the square, normalised to the origin. */
const TURNS: ((cell: Point) => Point)[] = [
  ([c, r]) => [c, r],
  ([c, r]) => [-r, c],
  ([c, r]) => [-c, -r],
  ([c, r]) => [r, -c],
  ([c, r]) => [-c, r],
  ([c, r]) => [r, c],
  ([c, r]) => [c, -r],
  ([c, r]) => [-r, -c],
];

function canonical(cells: readonly Point[]): string {
  return TURNS.map((turn) => {
    const moved = cells.map(turn);
    const minC = Math.min(...moved.map(([c]) => c));
    const minR = Math.min(...moved.map(([, r]) => r));
    return JSON.stringify(
      moved
        .map(([c, r]): Point => [c - minC, r - minR])
        .sort((a, b) => a[1] - b[1] || a[0] - b[0]),
    );
  }).sort()[0];
}

describe('the nets a cube has', () => {
  it('knows all eleven of them, and no two of them are the same net turned round', () => {
    // Eleven is the whole answer, not a selection: a cube has exactly eleven
    // nets up to rotation and reflection, and shipping fewer would narrow what
    // a child ever sees for no reason.
    expect(CUBE_NETS).toHaveLength(11);
    expect(new Set(CUBE_NETS.map(canonical)).size).toBe(11);
  });

  it('really folds into a cube, every one of them', () => {
    // A hexomino that is *not* a net draws exactly as well as one that is, so
    // nothing about the picture would ever say the table was wrong - the child
    // would simply be shown a shape that does not fold and told it makes a
    // cube. The folding is simulated rather than trusted.
    for (const cells of CUBE_NETS) {
      expect(cells, JSON.stringify(cells)).toHaveLength(6);
      expect(foldsToACube(cells), JSON.stringify(cells)).toBe(true);
    }
  });

  it('rejects a hexomino that is not a net, so the check above can fail', () => {
    // The 2x3 block and the straight line of six: connected, six squares, and
    // neither folds. Without this the test above would pass on any table at all.
    const block: Point[] = [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]];
    const line: Point[] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]];
    expect(foldsToACube(block)).toBe(false);
    expect(foldsToACube(line)).toBe(false);
  });
});

describe('the edges a cuboid is drawn with', () => {
  it('holds the two closest edges far enough apart to be seen apart', () => {
    // `MIN_CUBOID_RATIO` is derived from the ranges the jitter draws from, so
    // the sweep below can only prove the jitter honours its own derivation.
    // Whether the number it derives is *enough* to look like a cuboid rather
    // than a cube is a judgement, and this is where that judgement is written
    // down: a range edited into something visibly square fails here.
    expect(MIN_CUBOID_RATIO).toBeGreaterThan(1.3);
  });

  it('never gives a cuboid three edges near enough to equal to be a cube', () => {
    // The contradiction this kind has to avoid: the template's answer is
    // "cuboid", and a jitter that drew one with equal edges would mark that
    // answer wrong. Every pair has to be visibly different, not merely unequal.
    for (const seed of SEEDS) {
      const edges = cuboidEdges(createRng(`edges-${seed}`));
      expect(edges, seed).toHaveLength(3);
      for (const edge of edges) expect(edge).toBeGreaterThan(0);
      for (let a = 0; a < 3; a++) {
        for (let b = a + 1; b < 3; b++) {
          const ratio = Math.max(edges[a], edges[b]) / Math.min(edges[a], edges[b]);
          expect(ratio, `${seed}: ${edges.join(' x ')}`).toBeGreaterThanOrEqual(MIN_CUBOID_RATIO);
        }
      }
    }
  });

  it('puts the longest edge on a different axis from one seed to the next', () => {
    const longest = new Set(
      SEEDS.map((seed) => {
        const edges = cuboidEdges(createRng(`edges-${seed}`));
        return edges.indexOf(Math.max(...edges));
      }),
    );
    expect(longest.size).toBeGreaterThan(1);
  });
});

describe('the solid figure kind', () => {
  it('draws every solid, in both views', () => {
    for (const solid of SOLIDS) {
      for (const view of ['object', 'net']) {
        for (const seed of SEEDS) {
          const figure = build(spec(solid, view), seed);
          const where = `${solid} / ${view} / ${seed}`;

          expect(figure.marks.length, where).toBeGreaterThan(0);
          for (const path of paths(figure)) {
            expect(path.points.length, where).toBeGreaterThan(1);
            for (const [x, y] of path.points) {
              expect(Number.isFinite(x) && Number.isFinite(y), where).toBe(true);
              expect(x, where).toBeGreaterThanOrEqual(0);
              expect(x, where).toBeLessThanOrEqual(FIGURE_BOX);
              expect(y, where).toBeGreaterThanOrEqual(0);
              expect(y, where).toBeLessThanOrEqual(FIGURE_BOX);
            }
          }
        }
      }
    }
  });

  it('draws a net as exactly the faces the solid has', () => {
    // What makes a net answerable: "how many faces does this fold into?" is
    // read off the picture, so a net that drew five squares for a cube would
    // be a question with the wrong answer drawn under it.
    for (const solid of NETTED) {
      for (const seed of SEEDS) {
        expect(closed(build(spec(solid, 'net'), seed)), `${solid} / ${seed}`).toHaveLength(
          FACES[solid],
        );
      }
    }
  });

  it('never draws an object where a net was asked for, and never a net where an object was', () => {
    // A dashed line is an edge you cannot see, which is a thing only a solid
    // has: a net lies flat and every line on it is one you are looking at. So
    // the dashed marks are what tell the two views apart in the drawing
    // itself, and the check runs both ways rather than only the one the brief
    // names - a net drawn as an object and an object drawn as a net are the
    // same mistake pointed in opposite directions.
    for (const solid of NETTED) {
      for (const seed of SEEDS) {
        expect(hidden(build(spec(solid, 'net'), seed)), `${solid} / ${seed}`).toEqual([]);
        expect(
          hidden(build(spec(solid, 'object'), seed)).length,
          `${solid} / ${seed}`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it('hides exactly the edges the solid is in the way of, on every seed', () => {
    // The far corner of a swept solid is behind the near face only while the
    // depth is under that face's shortest side, and `build` finds the
    // corner by asking rather than by assuming - so a range edited until no
    // corner is behind draws every edge solid instead of drawing the wrong one
    // dashed. This is the alarm wired to that: three edges meet at the buried
    // corner, drawn as the two that belong to the far face and the one that
    // joins it to the near one.
    const buried: Record<SolidName, number> = {
      cube: 2,
      cuboid: 2,
      'square-pyramid': 2,
      'triangular-prism': 2,
      // A curved solid hides the far half of one rim and nothing else.
      cylinder: 1,
      cone: 1,
      sphere: 1,
    };

    for (const solid of SOLIDS) {
      for (const seed of manySeeds) {
        expect(hidden(build(spec(solid, 'object'), seed)), `${solid} / ${seed}`).toHaveLength(
          buried[solid],
        );
      }
    }
  });

  it('draws a cube net a different way on a different seed', () => {
    // **The anchoring case this kind exists to get right.** A cube has eleven
    // nets, so "which solid does this net fold into?" answered `cube` must not
    // always show the cross - a child who is shown the cross every time learns
    // the cross, and the analytics call the topic secure on the strength of it.
    // The brief's floor is three distinct pictures; the eleven nets, the eight
    // ways round each of them and the turn between them clear it by a mile.
    const varied = drawings(spec('cube', 'net'), manySeeds);
    expect(varied.size).toBeGreaterThanOrEqual(3);
    expect(varied.size).toBeGreaterThan(40);
  });

  it('draws a cube net a different way even with the rotation pinned', () => {
    // The notes' harder half: a kind that varies only while something is left
    // open has a latent anchoring failure waiting for the first author who
    // pins it. With the solid, the view *and* the rotation all pinned, which
    // of the eleven nets and which way round it lies are what is left.
    const pinned = spec('cube', 'net', '0');
    expect(figureIssues(pinned, {})).toEqual([]);

    const varied = drawings(pinned, manySeeds);
    expect(varied.size).toBeGreaterThanOrEqual(3);
    expect(varied.size).toBeGreaterThan(20);
  });

  it('draws every solid differently on every seed, in both views, with the rotation pinned', () => {
    for (const solid of SOLIDS) {
      for (const view of ['object', 'net']) {
        const pinned = spec(solid, view, '0');
        const varied = drawings(pinned, SEEDS);
        expect(varied.size, `${solid} / ${view}`).toBeGreaterThan(SEEDS.length / 2);
      }
    }
  });

  it('draws a cube as a cube: the face you look straight at is square', () => {
    // The other half of the contradiction guard. An oblique drawing lays the
    // front face flat in the picture plane, so that face is drawn at its true
    // proportions - and a cube whose front face came out a rectangle would be
    // a cuboid under a question answered "cube".
    for (const seed of SEEDS) {
      const front = closed(build(spec('cube', 'object'), seed));
      expect(front, seed).toHaveLength(1);
      const lengths = sides(front[0].points);
      expect(lengths, seed).toHaveLength(4);
      for (const length of lengths) expect(length / lengths[0], seed).toBeCloseTo(1, 2);
    }
  });

  it('draws a cuboid so that the face you look straight at is never square', () => {
    for (const seed of SEEDS) {
      const front = closed(build(spec('cuboid', 'object'), seed));
      expect(front, seed).toHaveLength(1);
      const lengths = sides(front[0].points);
      const ratio = Math.max(...lengths) / Math.min(...lengths);
      expect(ratio, seed).toBeGreaterThanOrEqual(MIN_CUBOID_RATIO);
    }
  });

  it('draws a sphere as an object whichever view it is asked for', () => {
    // A sphere is the one solid with no net at all - it cannot be unfolded
    // flat, which is a fact about spheres rather than a gap in this file. So a
    // net of one is an authoring mistake, reported below; here it only has to
    // degrade into something drawable, which is the sphere itself.
    for (const seed of SEEDS) {
      expect(hidden(build(spec('sphere', 'net'), seed)).length, seed).toBeGreaterThan(0);
      expect(build(spec('sphere', 'net'), seed), seed).toEqual(build(spec('sphere', 'object'), seed));
    }
  });

  it('never lets the jitter choose a net for a solid that has none', () => {
    // With `view` left out the two views jitter, and for a sphere that would
    // be a coin toss on drawing nothing at all.
    for (const seed of manySeeds) {
      expect(build(spec('sphere'), seed), seed).toEqual(build(spec('sphere', 'object'), seed));
    }
  });

  it('draws both views when the view is left out', () => {
    const views = new Set(
      manySeeds.map((seed) => (hidden(build(spec('cube'), seed)).length > 0 ? 'object' : 'net')),
    );
    expect(views).toEqual(new Set(['object', 'net']));
  });

  it('falls back to a cube on a solid name it does not know', () => {
    // Generation runs mid-session with a child waiting, so an unknown name
    // degrades into something drawable rather than throwing. It is reported by
    // `figureIssues` instead, where an author can still fix it.
    for (const solid of ["'dodecahedron'", "'Cube'", "''", 'name', '4']) {
      for (const seed of SEEDS.slice(0, 6)) {
        const figure = build({ kind: 'solid', solid, view: "'net'" }, seed);
        expect(figure, `${solid} / ${seed}`).toEqual(build(spec('cube', 'net'), seed));
      }
    }
  });

  it('reads its parameters out of the bound scope', () => {
    const figure = build({ kind: 'solid', solid: 'name', view: "'net'" }, 'scope', {
      name: 'triangular-prism',
    });
    expect(closed(figure)).toHaveLength(FACES['triangular-prism']);
  });

  it('replays exactly from the same seed', () => {
    for (const solid of SOLIDS) {
      expect(build(spec(solid), 'again'), solid).toEqual(build(spec(solid), 'again'));
    }
  });

  it("takes exactly one value off the question's own Rng, whatever it draws", () => {
    // `generate` threads one `Rng` through `tryBind`, `buildFigure` and
    // `buildChoices`, so a figure whose appetite depended on which solid or
    // which view it drew would reshuffle the distractors of the very question
    // it illustrates - and adding a pin to a template would silently change
    // that template's own choices. Everything this kind jitters comes off a
    // private stream seeded from a single draw.
    for (const solid of SOLIDS) {
      for (const view of [undefined, 'object', 'net']) {
        for (const rotation of [undefined, '0']) {
          let draws = 0;
          const inner = createRng('appetite');
          const counted: Rng = {
            next: () => (draws++, inner.next()),
            int: (min, max) => (draws++, inner.int(min, max)),
            pick: (items) => (draws++, inner.pick(items)),
          };
          buildFigure(spec(solid, view, rotation), {}, counted);
          expect(draws, `${solid} / ${view ?? 'open'} / ${rotation ?? 'open'}`).toBe(1);
        }
      }
    }
  });

  it('stays well inside the marks a figure can be stored with', () => {
    // What this kind draws is a property of the solid, not of anything a
    // template hands it, so there is no data that could grow the count and
    // nothing to slice: the largest drawing here is a handful of marks against
    // `MAX_MARKS`' two hundred.
    for (const solid of SOLIDS) {
      for (const view of ['object', 'net']) {
        for (const seed of SEEDS) {
          expect(build(spec(solid, view), seed).marks.length, `${solid} / ${view}`).toBeLessThan(20);
        }
      }
    }
  });
});

describe('what the solid kind reports to an author', () => {
  it('insists on the solid', () => {
    expect(figureIssues({ kind: 'solid' } as FigureSpec, {}).join()).toContain('figure.solid');
  });

  it('names an expression it cannot evaluate', () => {
    const issues = figureIssues({ kind: 'solid', solid: 'name' }, {}).join();
    expect(issues).toContain('figure.solid');
    expect(issues).toMatch(/name/);
  });

  it('names a solid that is not a string at all', () => {
    expect(figureIssues({ kind: 'solid', solid: '4' }, {}).join()).toContain('expected string');
  });

  it('names a solid nobody can draw', () => {
    const issues = figureIssues({ kind: 'solid', solid: "'dodecahedron'" }, {}).join();
    expect(issues).toContain('figure.solid');
    expect(issues).toContain('dodecahedron');
    // The vocabulary is closed, so the message can say what was expected.
    expect(issues).toContain('cube');
  });

  it('names a view that is not one of the two', () => {
    const issues = figureIssues({ kind: 'solid', solid: "'cube'", view: "'exploded'" }, {}).join();
    expect(issues).toContain('figure.view');
    expect(issues).toContain('exploded');
  });

  it('says a sphere has no net, because it has none', () => {
    const issues = figureIssues(
      { kind: 'solid', solid: "'sphere'", view: "'net'" },
      {},
    ).join();
    expect(issues).toContain('sphere');
    expect(issues).toContain('net');
    // And says nothing about the sphere a template draws as an object.
    expect(figureIssues({ kind: 'solid', solid: "'sphere'", view: "'object'" }, {})).toEqual([]);
  });

  it('does not call a net of an unknown solid a second mistake', () => {
    // One fault, one message: the name is what is wrong, and whether the thing
    // it names has a net is not knowable until it is a solid at all.
    expect(figureIssues({ kind: 'solid', solid: "'blob'", view: "'net'" }, {})).toHaveLength(1);
  });

  it('names a rotation that is not a number', () => {
    expect(
      figureIssues({ kind: 'solid', solid: "'cube'", rotation: "'upright'" }, {}).join(),
    ).toContain('expected number');
  });

  it('says nothing about a solid an author got right', () => {
    for (const solid of SOLIDS) {
      expect(figureIssues(spec(solid), {}), solid).toEqual([]);
      expect(figureIssues(spec(solid, 'object', '30'), {}), solid).toEqual([]);
    }
    for (const solid of NETTED) {
      expect(figureIssues(spec(solid, 'net', '0'), {}), solid).toEqual([]);
    }
  });
});
