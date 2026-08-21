import type { Scope } from '../expr';
import { createRng, type Rng } from '../rng';
import { jitter, numberValue, readField } from './fields';
import { REPORT_BOX_PX, REPORT_STROKE_PX } from './labels';
import type { FigureKindModule } from './registry';
import { FIGURE_BOX, FIGURE_PADDING, type FigureSpec, type Mark, type Point } from './types';

/**
 * The `spinner` kind: a disc cut into sectors, the thing a chance question is
 * *about*. It is why this kind exists at all - the app ships almost no
 * probability content because "which colour is the arrow most likely to land
 * on?" is not a sentence with a hole in it. It is a picture, and until there
 * was one it could not be asked.
 *
 * **Parts arrive comma-joined because the expression language has no arrays**,
 * exactly as `bar`'s values and `pictograph`'s counts do: `sectors: "'1,1,2'"`
 * is a string literal and `"a + ',' + b"` is how a template builds one from its
 * own bound variables.
 *
 * ---
 *
 * ## The constraint this kind has that the graph kinds did not
 *
 * A chance question's answer **names a sector**. "Which colour is the arrow
 * most likely to land on?" has the answer `red` only because red's sector is
 * the biggest one, and the template committed to that answer before anything
 * was drawn. So a jitter that reshuffles which sector is largest, or which
 * appearance covers the most of the disc, produces a figure that **contradicts
 * the question it illustrates** - and it does it silently, since nothing about
 * a well-drawn spinner looks wrong.
 *
 * That collides head-on with the anchoring rule (`types.ts`): a figure must
 * vary, or a child learns "the answer is the part at the top" rather than the
 * chance. The two pull in opposite directions and the resolution is written
 * down here rather than left to be re-derived:
 *
 * **Exactly two things vary, and both are invariants of every question a
 * spinner can be asked.**
 *
 * 1. **The rotation of the whole disc.** A rotation is an isometry: it carries
 *    each sector to a congruent sector with the same appearance, so *every*
 *    quantity a chance question reads - which sector is biggest, what fraction
 *    is shaded, how many parts there are, whether it is fair - is unchanged by
 *    construction, not by argument. It is the obviously safe lever and it is
 *    the main one.
 *
 * 2. **Which slot round the disc each sector sits in** - a permutation of the
 *    `(size, appearance)` **pairs**, always together and never independently.
 *    Permuting the pairs preserves the multiset of sizes (so the largest sector
 *    is the same size, and a fair spinner stays fair) *and* the total turn per
 *    appearance (so the shaded share is the same number). Permuting sizes
 *    against fixed appearances would preserve neither, which is why the pairs
 *    move as one.
 *
 *    The one thing a permutation does change is **adjacency**: two sectors of
 *    the same appearance can come out side by side and read as a single larger
 *    region. They stay countable because a boundary line is drawn at every
 *    sector boundary whatever the appearances are - that is not decoration, it
 *    is what keeps "how many parts?" answerable under this jitter.
 *
 * **What deliberately does *not* vary**, each for the same reason - it would
 * change the answer, not the picture:
 *
 * - **Which group is shaded.** With two appearances a child can only answer
 *   "the shaded one" or "the plain one", so the answer *is* the appearance;
 *   swapping them inverts it. The first group named in `fills` is the shaded
 *   one, on every seed.
 * - **The sizes.** They are the question.
 * - **A pointer.** A real spinner has an arrow, and the prompt says "the
 *   arrow" - but an arrow drawn resting inside a sector is read by a child as
 *   *the* answer, and a jittered one would say the biggest sector wins only as
 *   often as chance says it does. So no arrow is drawn, and the prompt's arrow
 *   is the one that has not been spun yet.
 * - **The radius.** The section-3 trap: `fit` is uniform and centring, so
 *   overall size is normalised straight back out and varying it varies nothing.
 *
 * **Rotation alone would defeat anchoring**, and it is worth writing down why,
 * because it is the lever that survives when a template pins nothing else. It
 * is drawn uniformly over the whole turn and it moves every boundary line's rim
 * end, which lands at `(50 + 44·cos θ, 50 − 44·sin θ)` rounded to
 * `FIGURE_PRECISION`. Two rotations draw the same figure only when every such
 * coordinate rounds the same way, which needs them within about 0.0065° of one
 * another - roughly one part in 55,000 of the turn. `validateTemplate` draws 50
 * figures and fails an answer only when *all fifty* come out byte-identical, so
 * rotation on its own clears that by an astronomical margin. The permutation is
 * there for the template that **pins** `rotation`, which is the case the notes
 * insist on: a kind that varies only while nothing is pinned has a latent
 * anchoring failure waiting for the first author who pins it.
 *
 * ---
 *
 * ## Equal sectors are exactly equal
 *
 * "Is this spinner fair?" is a real question and its truth is the geometry, so
 * `'1,1,1'` has to be three sectors of exactly 120°, not 119.99999999999999.
 * `sectorAngles` is written `part * 360 / total` and not `part / total * 360`
 * for that one reason - the second gives 119.99999999999999 for a third of a
 * turn - and being a function of `(part, total)` alone it cannot give two equal
 * parts two different angles however the arithmetic falls out.
 *
 * That choice is exact where a *sum* cannot always be: `360 / 7` is not a
 * number a double holds, so seven equal sectors add to 360.00000000000006 and
 * no definition of the angles fixes both properties at once (a per-sector angle
 * that depends only on its own part is what makes equal parts equal, and it is
 * exactly what stops the residual being absorbed anywhere). Equality is the one
 * a child's question rests on, so equality wins; the sum is exact for every
 * total that divides the turn, and a hundredth of a nanodegree out otherwise.
 * Nothing is drawn from the sum - the seam is drawn once, at the rotation - so
 * the disc closes regardless.
 *
 * ---
 *
 * ## The frame is pinned, so the fit is the same on every seed
 *
 * The rim is sampled at `RIM_POINTS` **fixed** angles - not at angles measured
 * from the rotation - and `RIM_POINTS` is a multiple of four, so the polygon
 * always has a vertex at each of 0°, 90°, 180° and 270° and its bounding box is
 * exactly the disc's, `[-1, 1]` square, on every seed. Every other mark
 * (boundary lines, filled wedges) ends on or inside that circle, so `fit`
 * always finds the same bounds, the same scale and the same centre.
 *
 * That is section 4's technique and it costs nothing here, since the rim is a
 * mark this kind was drawing anyway. It buys the thing section 3 warns about:
 * because the frame cannot move, the rotation cannot be normalised away by the
 * centring fit. A disc of fixed radius turned about its own centre is precisely
 * the shape that would otherwise fit to an identical drawing every time.
 *
 * There are no labels on a spinner, so none of `labels.ts`' *label* budgets
 * apply - only the two constants describing the report row itself, which live
 * there because they are facts about `progress-topics.tsx` rather than about
 * type. The two limits below are measured against that thumbnail, because ink
 * is ink.
 */

type SpinnerSpec = Extract<FigureSpec, { kind: 'spinner' }>;

/**
 * How many points the rim is sampled at. **A multiple of four**, and sampled
 * from a fixed zero rather than from the rotation: that is what puts a vertex
 * on each axis and makes the fitted bounds the same on every seed (see above).
 * Seventy-two is 5° a step, which at the report's ~28px radius is a chord
 * bulging 0.03px inside the true circle - a circle, not a polygon.
 */
const RIM_POINTS = 72;

/** The disc, before `fit` scales the drawing into the box. */
const RADIUS = 1;

/**
 * A parent's report draws this figure in a 64px square at a stroke of 1.5 real
 * pixels (`REPORT_BOX_PX` and `REPORT_STROKE_PX` in `labels.ts`), against the
 * play screen's whole question area. A figure is built **once** for both -
 * `buildFigure`'s signature carries no scale - so a spinner that is only
 * readable on the play screen is a spinner that is unreadable in every report
 * row, and both limits below are measured against the smaller.
 */

/** What `fit` leaves the drawing, and so the rim's radius, in the box's units. */
const FITTED_RADIUS = (FIGURE_BOX - 2 * FIGURE_PADDING) / 2;

/**
 * How much of the turn one real pixel of rim is worth in a report thumbnail.
 * Every angular limit here is a number of stroke widths through this.
 */
const DEGREES_PER_RIM_PX =
  360 / (2 * Math.PI * (FITTED_RADIUS / FIGURE_BOX) * REPORT_BOX_PX);

/**
 * The smallest sector that is a *region* rather than a thick line: half a
 * stroke belongs to each of the two boundary lines that bound it, and two
 * clear strokes of daylight between them is what makes the wedge visible at
 * all. Derived rather than chosen, for section 6's reason - it is about ink,
 * not taste - and it is generous, allowing a disc cut into 39 equal parts.
 */
const MIN_SECTOR_DEGREES = DEGREES_PER_RIM_PX * REPORT_STROKE_PX * 3;

/**
 * How far apart two sectors' arcs have to be before anybody can see that they
 * are different sizes. One stroke width: closer than that and two *different*
 * parts are drawn as the same picture, which is `pictograph`'s third question
 * wearing a spinner's clothes - "is this spinner fair?" answered `false` over
 * a disc that looks perfectly fair. No amount of measuring ink finds it, so it
 * is a check of its own in `issues`.
 */
const MIN_TELLABLE_DEGREES = DEGREES_PER_RIM_PX * REPORT_STROKE_PX;

/**
 * A figure has exactly **two** appearances: `path.fill` is a boolean, which
 * `src/components/diagram.tsx` renders as `--color-brand-soft` or as nothing.
 * So a third group of sectors would be drawn identically to one of the first
 * two - two parts a child is being asked to tell apart with one picture
 * between them - and it is reported rather than drawn. A spinner of three
 * genuine colours is content this vocabulary cannot draw, and saying so is
 * better than drawing it wrong.
 */
const MAX_FILL_GROUPS = 2;

/**
 * A hard stop on how much is drawn at all, well past anything `issues`
 * accepts. `parseFigure` refuses a figure over `MAX_MARKS` (200) when it is
 * read back out of an `Attempt`, so a thousand-sector disc would draw a
 * picture that could never be shown again in a parent's report.
 *
 * **This is a silent truncation, which is otherwise ruled out, and it is the
 * storage-cap exception `labels.ts` names.** It is safe only because it is
 * unreachable by anything that validates: `MIN_SECTOR_DEGREES` caps a spinner
 * that ships at 39 sectors, against 80 here, and 80 sectors draw at most 80
 * boundary lines, 80 wedges, the rim and the hub - 162 marks. Keep both halves
 * if you copy it.
 */
const MAX_DRAWN_SECTORS = 80;

/** Where a `sectors` nobody could read lands - still a spinner, just not the asked one. */
const FALLBACK_SECTORS = [1, 1, 2];

/**
 * The turn each sector takes up, in degrees. **Exported because it is the
 * fairness of the spinner**, in the same spirit as `weightTemplates` being the
 * selector's policy: whether three parts really are 120° each cannot be read
 * off the fitted figure, where every coordinate has been scaled and rounded to
 * `FIGURE_PRECISION`, and it is the whole truth of a "is this fair?" question.
 *
 * `part * 360 / total`, never `part / total * 360` - see the module comment.
 */
export function sectorAngles(parts: readonly number[]): number[] {
  const total = parts.reduce((sum, part) => sum + part, 0);
  return parts.map((part) => (part * 360) / total);
}

/**
 * The comma-joined list, or nothing at all. Strict for `bar`'s reason:
 * `Number('')` is 0, so a list with a hole in it would read as a sector the
 * arrow can never land on rather than as the typo it is.
 */
function parseParts(text: string): number[] | null {
  const pieces = text.split(',').map((piece) => piece.trim());
  if (pieces.some((piece) => piece === '')) return null;
  const parts = pieces.map(Number);
  return parts.every((part) => Number.isFinite(part)) ? parts : null;
}

function parseFills(text: string): string[] {
  return text.split(',').map((piece) => piece.trim());
}

/**
 * Which sectors are shaded, **in the order the author wrote them**, which is
 * the order the pairing is built in before anything is permuted. Reading it
 * off the drawn order instead would let the arrangement move which appearance
 * covers the most of the disc, and that is the answer.
 *
 * The first group named takes the ink. With no names at all the sectors
 * alternate, which is only there so neighbouring parts can be told apart -
 * after the arrangement two of them may still land side by side, and the
 * boundary line between them is what keeps them countable.
 */
function inkedSectors(count: number, names: readonly string[] | null): boolean[] {
  if (!names) return Array.from({ length: count }, (_, index) => index % 2 === 0);
  const first = names[0];
  return Array.from({ length: count }, (_, index) => names[index] === first);
}

/**
 * Which slot round the disc each sector takes, as a permutation of the
 * authored order.
 *
 * **One value off the shared `Rng`, expanded into a stream of its own.** A
 * Fisher-Yates shuffle wants one draw per sector, and `generate` threads a
 * single `Rng` through `buildFigure` into `buildChoices` - so a figure whose
 * appetite grows with its own data would reshuffle the distractors of the very
 * question it illustrates, differently for a three-part spinner than for a
 * four-part one. Seeding a private stream from a single draw keeps a spinner
 * at exactly two values whatever it is asked to draw.
 */
function arrangementOf(count: number, rng: Rng): number[] {
  const spread = createRng(`spinner-arrangement-${rng.next()}`);
  const order = Array.from({ length: count }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index--) {
    const swap = spread.int(0, index);
    [order[index], order[swap]] = [order[swap], order[index]];
  }
  return order;
}

function onRim(degrees: number): Point {
  const radians = (degrees * Math.PI) / 180;
  return [Math.cos(radians) * RADIUS, Math.sin(radians) * RADIUS];
}

/**
 * The disc itself, and the reason the fit never moves: fixed sample angles,
 * four of them exactly on the axes, so the bounding box is the circle's
 * whatever the sectors inside are doing.
 */
function rimPath(): Mark {
  return {
    kind: 'path',
    points: Array.from({ length: RIM_POINTS }, (_, index) => onRim((index * 360) / RIM_POINTS)),
    closed: true,
    fill: false,
    dashed: false,
  };
}

/** One sector boundary: the centre out to the rim. */
function boundaryPath(degrees: number): Mark {
  return { kind: 'path', points: [[0, 0], onRim(degrees)], closed: false, fill: false, dashed: false };
}

/** A shaded sector: the centre, the arc between its two boundaries, and back. */
function wedgePath(from: number, sweep: number): Mark {
  const step = 360 / RIM_POINTS;
  const samples = Math.max(1, Math.ceil(sweep / step));
  const points: Point[] = [[0, 0]];
  for (let index = 0; index <= samples; index++) {
    points.push(onRim(from + (sweep * index) / samples));
  }
  return { kind: 'path', points, closed: true, fill: true, dashed: false };
}

/**
 * The first two sectors that are different parts and the same picture, or
 * nothing. Different *parts*, because two sectors that really are the same
 * size are meant to look it - a fair spinner is the point of half the
 * questions here.
 */
function pairDrawnAlike(
  parts: readonly number[],
  angles: readonly number[],
): [number, number] | null {
  for (let a = 0; a < parts.length; a++) {
    for (let b = a + 1; b < parts.length; b++) {
      if (parts[a] === parts[b]) continue;
      if (Math.abs(angles[a] - angles[b]) < MIN_TELLABLE_DEGREES) return [a, b];
    }
  }
  return null;
}

export const spinnerModule: FigureKindModule<'spinner'> = {
  kind: 'spinner',

  // Only the sectors are required - they are the question. Omitting `fills`
  // alternates the sectors, which says nothing about them beyond "these are
  // different parts"; omitting `rotation` is what asks for the turn to jitter.
  fields: {
    sectors: 'required',
    fills: 'optional',
    rotation: 'optional',
  },

  build(spec: SpinnerSpec, scope: Scope, rng: Rng): Mark[] {
    const read = readField(spec.sectors, scope);
    const parsed = typeof read === 'string' ? parseParts(read) : null;
    // A negative part has no sector to be drawn in, so it is drawn as nothing.
    // It is reported; here it only has to be drawable.
    const asked = (parsed ?? FALLBACK_SECTORS)
      .slice(0, MAX_DRAWN_SECTORS)
      .map((part) => Math.max(part, 0));
    // Parts adding to nothing would divide the turn by zero, and mid-session
    // the contract is a drawing rather than a throw.
    const parts = asked.reduce((sum, part) => sum + part, 0) > 0 ? asked : FALLBACK_SECTORS;

    const readFills = readField(spec.fills, scope);
    const names = typeof readFills === 'string' ? parseFills(readFills) : null;
    const inked = inkedSectors(parts.length, names);

    // Drawn whether or not it is used, so pinning `rotation` cannot change how
    // many values a spinner takes off the `Rng` the question's own choices are
    // shuffled with afterwards.
    const spun = jitter(rng, 0, 360);
    const rotation = numberValue(readField(spec.rotation, scope)) ?? spun;

    const angles = sectorAngles(parts);
    // The pairs move together - the size and the appearance of one sector are
    // one thing, and separating them is what would change the answer.
    const arranged = arrangementOf(parts.length, rng).map((index) => ({
      angle: angles[index],
      inked: inked[index],
    }));

    // Shaded wedges first: the renderer draws marks in order, so the rim and
    // the boundary lines have to come after the fill they sit on.
    const marks: Mark[] = [];
    let turn = rotation;
    for (const sector of arranged) {
      if (sector.inked && sector.angle > 0) marks.push(wedgePath(turn, sector.angle));
      turn += sector.angle;
    }

    marks.push(rimPath());

    turn = rotation;
    for (const sector of arranged) {
      marks.push(boundaryPath(turn));
      turn += sector.angle;
    }

    // The hub the arrow would turn about - and the one mark that says this is a
    // spinner rather than a pie chart.
    marks.push({ kind: 'dot', at: [0, 0] });

    return marks;
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const raw = read(spec.sectors, 'figure.sectors', 'string', true);
    const parts = typeof raw === 'string' ? parseParts(raw) : null;

    if (typeof raw === 'string' && !parts) {
      issues.push(`figure.sectors: ${JSON.stringify(raw)} is not a comma-separated list of numbers`);
    }

    const rawFills = read(spec.fills, 'figure.fills', 'string');
    const names = typeof rawFills === 'string' ? parseFills(rawFills) : null;
    read(spec.rotation, 'figure.rotation', 'number');

    if (names) {
      if (parts && names.length !== parts.length) {
        issues.push(`figure.fills: ${names.length} fills for ${parts.length} sectors`);
      }
      // A hole in the list is one fault, and the group count is not a second
      // one to report about it: an empty name counts as a group of its own, so
      // saying both would be the same typo told twice.
      if (names.some((name) => name === '')) {
        issues.push(
          `figure.fills: ${JSON.stringify(rawFills)} has a sector with no name,` +
            ' so there is no saying which sectors it shares an appearance with',
        );
      } else {
        const groups = [...new Set(names)];
        if (groups.length > MAX_FILL_GROUPS) {
          issues.push(
            `figure.fills: ${groups.length} different fills (${groups.join(', ')}), and a figure` +
              ` has only ${MAX_FILL_GROUPS} appearances - ${groups
                .slice(1)
                .join(' and ')} would be drawn the same as one another`,
          );
        }
      }
    }

    if (parts) {
      const total = parts.reduce((sum, part) => sum + part, 0);
      const negative = parts.find((part) => part < 0);

      if (negative !== undefined) {
        issues.push(`figure.sectors: ${negative} is below zero, and a disc has no sector for it`);
      } else if (total <= 0) {
        issues.push(
          'figure.sectors: the parts add up to nothing, so there is no disc to divide',
        );
      } else if (parts.some((part) => part === 0)) {
        issues.push(
          'figure.sectors: a sector of 0 is one the arrow can never land on,' +
            ' and it is drawn as two boundary lines on top of each other',
        );
      }

      // Everything below is about how the disc is *divided*, which is a
      // question a disc has to exist to be asked. A lone part of nought does
      // not fill the whole disc, it has already been reported as the different
      // mistake it is.
      const drawable = negative === undefined && total > 0;

      if (drawable && parts.length < 2) {
        issues.push(
          'figure.sectors: one sector fills the whole disc, so there is nothing' +
            ' for the arrow to land on but itself',
        );
      } else if (drawable) {
        const angles = sectorAngles(parts);

        // **One fault, one message**, and each is found once by construction
        // rather than deduped afterwards - twenty sectors all too thin is one
        // authoring mistake, and a fold that reported every one of them would
        // bury the other fault under it. `pictograph`'s dedup had to be keyed
        // on a tag because it folded; there is nothing to key here because
        // there is no fold.
        const thin = angles.findIndex((angle) => angle > 0 && angle < MIN_SECTOR_DEGREES);
        if (thin >= 0) {
          issues.push(
            `figure.sectors: ${parts[thin]} part of ${total} is a sector of` +
              ` ${angles[thin].toFixed(1)} degrees, under the` +
              ` ${MIN_SECTOR_DEGREES.toFixed(1)} that is a wedge rather than a thick line` +
              ' in a report',
          );
        }

        // The question no amount of measuring ink can answer: the sectors fit
        // the disc perfectly and are simply drawn the same size, under a
        // question - "is this spinner fair?" - whose answer says they are not.
        const alike = pairDrawnAlike(parts, angles);
        if (alike) {
          const [a, b] = alike;
          issues.push(
            `figure.sectors: ${parts[a]} and ${parts[b]} parts of ${total} are` +
              ` ${angles[a].toFixed(2)} and ${angles[b].toFixed(2)} degrees, closer than the` +
              ` ${MIN_TELLABLE_DEGREES.toFixed(2)} it takes to see that two sectors are` +
              ' different sizes, so two different parts have the same picture',
          );
        }
      }
    }

    return issues;
  },
};
