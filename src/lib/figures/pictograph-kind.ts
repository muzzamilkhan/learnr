import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { jitter, numberValue, readField, truthy } from './fields';
import { CHAR_SHARE, PITCH_SHARE } from './labels';
import type { FigureKindModule } from './registry';
import type { FigureSpec, Mark, Point } from './types';

/**
 * The `pictograph` kind: a picture graph, where a row of small icons stands
 * for a count and a key at the foot says what one icon is worth. Like `bar`,
 * the drawing *is* the question - "how many on Tuesday?" has no answer in the
 * prompt - and unlike `bar` the reading is a count rather than a measurement:
 * a child counts icons and multiplies by the key.
 *
 * **Counts arrive comma-joined because the expression language has no arrays**,
 * exactly as `bar`'s values do: `counts: "'3,7,5'"` is a string literal and
 * `"a + ',' + b"` is how a template builds one from its own bound variables.
 *
 * ---
 *
 * **The icon count is a derived quantity, so it owes the three questions a
 * derived *label* owes** (see `labels.ts` and the notes `bar` paid for). What
 * gets drawn is `ceil(count / key * u) / u` icons, where `u` is 2 with
 * `halves` and 1 without - not `count`, and not `count / key`:
 *
 * 1. **What is drawn** is that rounded figure, which is why every check below
 *    asks it rather than asking the count.
 * 2. **Does all of it fit** - a row is `iconBudget` icons wide at most, and
 *    that budget is settled by the *data*, so it is computed per figure and
 *    reported with its number rather than being a constant chosen up front.
 * 3. **Is it still distinct from its neighbour** - and this is the question
 *    that makes `halves` matter. With `key: '5'`, a count of 7 needs one and
 *    two fifths of an icon; rounded up it draws two, which is what a count of
 *    10 draws. **Two different rows, the same picture, and a question with one
 *    right answer whose picture supports two.** No amount of measuring ink
 *    finds that, so it is a check of its own: `issues` reports a count the key
 *    cannot express, and reports two rows that would come out identical.
 *    Nothing here silently rounds a child's data away - `build` rounds because
 *    it must draw *something* mid-session, and validation is what stops such a
 *    template shipping.
 *
 * `halves` is what makes the honest drawing available: with it, a key of 5
 * expresses 0, 2.5, 5, 7.5, 10 and a count of 7.5 is one icon and a half.
 * Without it a key of 5 expresses multiples of 5 and nothing else.
 *
 * ---
 *
 * **The layout is a frame of width exactly 1 and height at most 1**, which is
 * what makes `labels.ts`' shares directly comparable with the geometry here:
 * the fit's scale is then `DRAWN_SPAN` and a report-scale character is
 * `CHAR_SHARE` of this file's own units.
 *
 * **The two rules - the axis at `x = 0` and the baseline under the rows - are
 * not decoration; they pin the bounds.** `fit` measures a drawing by its marks,
 * and every *other* mark here moves: the icons jitter in size and the labels
 * are the author's. With the rules, the left bound is exactly where the widest
 * row label's ink ends and the right bound is exactly where the widest row (or
 * the key line) ends, so **no label's ink hangs outside the fitted bounds at
 * all** and the clipping `labels.ts` warns about is closed off by construction
 * rather than by an ink solve. It also means the icon jitter cannot change the
 * frame, which it otherwise would - and a jitter that changes the frame is a
 * jitter the uniform, centring fit normalises straight back out.
 *
 * The one place ink still hangs outside a bound is *vertically*, under the key
 * label: its anchor sits level with the key icon's centre and half a line of
 * ink (`INK_SHARE / 2`, 5.76 fitted units) can reach past the bottom-most mark
 * into the fit's own `FIGURE_PADDING` (6). That inequality is the whole
 * clearance - the same 0.24-unit margin `bar` runs on - and the sweep at the
 * bottom of `pictograph-kind.test.ts` is the only thing wired to notice it
 * move.
 */

type PictographSpec = Extract<FigureSpec, { kind: 'pictograph' }>;

/** Comparing counts against a key, where both came out of floating-point arithmetic. */
const EPSILON = 1e-9;

/** From a row label's right edge to the axis the icons stand on. */
const LABEL_GAP = 0.03;
/** From the key's sample icon to the text beside it. */
const KEY_TEXT_GAP = 0.03;
/** How far below the last row the key line sits, in row pitches. */
const KEY_ROW_RATIO = 1.3;
/** An icon's size as a share of the slot it sits in, so icons never touch. */
const ICON_SLOT_FILL = 0.78;
/**
 * An icon's height as a share of the row pitch. **This is the jitter that is
 * always available**: a template may pin the counts, the labels, the key and
 * `halves`, and the drawing still has to differ between two seeds or it becomes
 * the anchor for its own answer. How big an icon is drawn inside its slot says
 * nothing about the data - and, because the two rules pin the frame, it is a
 * change of *proportion* rather than of overall size, which is the only kind
 * the centring fit does not normalise away.
 */
const SIZE_BAND = [0.45, 0.8] as const;

/** The keys picked between when none is pinned. */
const KEY_LADDER = [1, 2, 5, 10] as const;

/**
 * The pitch between two rows, given how many there are and how tall an icon is
 * drawn. Solved so the whole drawing is at most 1 tall: the vertical rule
 * reaches half a pitch above the top row, and the key icon half its own height
 * below the key line, which sits `KEY_ROW_RATIO` pitches under the bottom row.
 */
function rowPitch(rows: number, fill: number): number {
  return 1 / (rows - 0.5 + KEY_ROW_RATIO + fill / 2);
}

/** The tallest an icon is ever drawn at this many rows - the top of `SIZE_BAND`. */
function maxIconHeight(rows: number): number {
  return rowPitch(rows, SIZE_BAND[1]) * SIZE_BAND[1];
}

/**
 * The most rows a picture graph can carry. **Derived, not chosen**: a row
 * label wants `PITCH_SHARE` of the drawing between it and the next at report
 * scale, and the pitch above is what the frame can give - so five is simply
 * how many lines of report-scale type fit down a 64px thumbnail once the key
 * line has had its share.
 */
const MAX_ROWS = (() => {
  let rows = 1;
  while (rowPitch(rows + 1, SIZE_BAND[1]) >= PITCH_SHARE) rows++;
  return rows;
})();

/**
 * A row is never squeezed past this, however long the labels: one icon at the
 * pitch two icons need to be told apart. It is what `MAX_LABEL_CHARS` is
 * solved from, so a row always has somewhere to draw at least one icon.
 */
const MIN_ROW_SPAN = PITCH_SHARE;

/**
 * The most characters a row label may carry, derived from the room the gutter
 * can take before a row has nowhere left to draw an icon. Reported, never
 * clamped - `build` draws the label at its true width and the drawing comes
 * out wider than it is tall, which is honest and is not something to ship.
 */
const MAX_LABEL_CHARS = Math.floor((1 - MIN_ROW_SPAN - LABEL_GAP) / CHAR_SHARE);

/**
 * A hard stop on how much is drawn at all, well past what `issues` reports.
 * `parseFigure` refuses a figure over `MAX_MARKS` (200) when it is read back
 * out of an `Attempt`, so a count of ten thousand at a key of one would draw a
 * graph that could never be shown again in a parent's report.
 *
 * **This is a silent truncation, which `labels.ts`' third lesson otherwise
 * rules out, and it is the storage-cap exception named there.** It is safe
 * only because it is unreachable by anything that validates: `MAX_ROWS` is 5
 * against 10 here, and `iconBudget` never returns more than 6 against 12 - so
 * no template that ships can have a row or an icon cut. Ten rows of twelve,
 * their labels, the two rules and the key come to 134 marks. Keep both halves
 * if you copy it.
 */
const MAX_DRAWN_ROWS = 10;
const MAX_DRAWN_ICONS = 12;

/** Where a `counts` nobody could read lands - still a graph, just not the asked one. */
const FALLBACK_COUNTS = [3, 5, 2];

/**
 * The icons a row is drawn with. **This is the number the three questions in
 * the module comment are asked about**, and it is not `count / key`: a picture
 * graph draws whole icons, or halves where `halves` allows them, so what
 * reaches the page is rounded *up* to the nearest one it can draw. Up rather
 * than to nearest, so a count that is not zero is never drawn as nothing.
 */
function iconsFor(count: number, key: number, halves: boolean): number {
  const unit = halves ? 2 : 1;
  if (count <= 0) return 0;
  return Math.ceil((count / key) * unit - EPSILON) / unit;
}

/** Whether the key can say this count exactly, or only round it. */
function isExact(count: number, key: number, halves: boolean): boolean {
  const unit = halves ? 2 : 1;
  const steps = (count / key) * unit;
  return Math.abs(steps - Math.round(steps)) < EPSILON;
}

/** The slots the widest row takes - a half icon still stands in a whole one. */
function slotsFor(counts: readonly number[], key: number, halves: boolean): number {
  const widest = Math.max(...counts.map((count) => iconsFor(count, key, halves)), 0);
  return Math.max(1, Math.min(Math.ceil(widest), MAX_DRAWN_ICONS));
}

/** The gutter the row labels take, ink included - it is exactly the left bound. */
function gutterFor(labelChars: number): number {
  return labelChars > 0 ? LABEL_GAP + labelChars * CHAR_SHARE : 0;
}

/**
 * The most icons a row of *this* graph can carry and still be countable at
 * report scale.
 *
 * **The room an icon has is not a constant, so it is not written as one.**
 * `MAX_ROWS` is a cap the geometry can honour by choosing differently; how many
 * icons fit across is settled by the data - the counts and the key the template
 * asked for - against a gutter the template's own labels decide. So it is
 * computed from the layout this graph will actually get, and a row past it is
 * *reported* with the number, never cut. `MAX_DRAWN_ICONS` above is the only
 * cut, and it sits at twice the largest budget this can return.
 *
 * The pitch it is measured against is `PITCH_SHARE` - the same centre-to-centre
 * distance two stacked labels need. An icon grid at the pitch of report-scale
 * type is one whose icons are as separable as two lines of it, which is what
 * keeps a row of five tellable from a row of six in a 64px thumbnail. Set any
 * looser and the honest reading of a long row is "a wall", which is the one
 * thing a picture graph must not be: the count *is* the answer.
 */
function iconBudget(labelChars: number): number {
  const available = Math.max(1 - gutterFor(labelChars), MIN_ROW_SPAN);
  return Math.max(1, Math.floor(available / PITCH_SHARE));
}

/**
 * The half of the layout that depends on nothing random, so `build` and the
 * budgets in `issues` can never disagree about how much room anything has.
 *
 * The key legend is left-aligned with the **drawing's** left edge rather than
 * with the icons, so its width is measured against the whole frame instead of
 * against what the gutter left over. A key that fits with no labels therefore
 * fits with them too, which is why `keyCharBudget` barely moves with the
 * labels - one fewer budget for an author to discover by tripping over it.
 */
function layoutFor(
  rows: number,
  labelChars: number,
  slots: number,
  keyChars: number,
): { gutter: number; available: number; iconPitch: number; keySlot: number; right: number } {
  const gutter = gutterFor(labelChars);
  const available = Math.max(1 - gutter, MIN_ROW_SPAN);
  const iconPitch = available / Math.max(slots, 1);
  const keySlot = Math.min(maxIconHeight(rows), iconPitch * ICON_SLOT_FILL);
  const keyRight = -gutter + keySlot + KEY_TEXT_GAP + keyChars * CHAR_SHARE;
  return { gutter, available, iconPitch, keySlot, right: Math.max(available, keyRight) };
}

/**
 * The most characters the key's own label may carry. Derived from the width the
 * whole frame has left once the sample icon and its gap are paid for - and it
 * is asked of the text that gets **drawn** (`= 10`, four characters), not of the
 * key it came from (`10`, two), because the two differ by the prefix and by
 * whatever `formatKey` rounds off.
 */
function keyCharBudget(rows: number, labelChars: number, slots: number): number {
  const { gutter, available, keySlot } = layoutFor(rows, labelChars, slots, 0);
  return Math.max(1, Math.floor((gutter + available - keySlot - KEY_TEXT_GAP) / CHAR_SHARE));
}

/**
 * The keys the graph could be drawn with. A pinned key is always kept - it is
 * the author's statement about what the picture means, and anything wrong with
 * it is reported rather than overridden, unlike `bar`'s scale, which is
 * overridden only where the axis could not be labelled at all.
 *
 * Left open it jitters over the ladder, preferring keys that say every count
 * exactly: a key that has to round is a key that draws two different rows the
 * same, which is the failure this kind exists to avoid.
 */
function keyCandidates(
  counts: readonly number[],
  halves: boolean,
  budget: number,
  pinned: number | undefined,
): number[] {
  if (pinned !== undefined && pinned > 0) return [pinned];

  const fits = KEY_LADDER.filter((key) => slotsFor(counts, key, halves) <= budget);
  const exact = fits.filter((key) => counts.every((count) => isExact(count, key, halves)));
  const pool = exact.length > 0 ? exact : fits;
  if (pool.length > 0) return pool;

  // Past the ladder's reach - a key of the data's own, so the row still fits.
  const most = Math.max(...counts, 0);
  return [Math.max(EPSILON, Math.ceil(most / Math.max(budget, 1)))];
}

/** The key's own text, without the tail a floating-point key would leave on it. */
function formatKey(key: number): string {
  return `= ${String(Math.round(key * 1000) / 1000 + 0)}`;
}

/** A shape stretched to fill `[-0.5, 0.5]` in both directions. */
function normalise(points: readonly Point[]): Point[] {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  const midX = (Math.max(...xs) + Math.min(...xs)) / 2;
  const midY = (Math.max(...ys) + Math.min(...ys)) / 2;
  return points.map(([x, y]): Point => [(x - midX) / width, (y - midY) / height]);
}

/**
 * The icons, each normalised to fill the unit square exactly. **Filling it is
 * what makes the shape a free jitter**: every shape has the same extent, so
 * picking between them changes the picture without moving a single bound.
 */
const ICON_SHAPES: readonly (readonly Point[])[] = [
  normalise([
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]),
  normalise([
    [0, 1],
    [1, 0],
    [0, -1],
    [-1, 0],
  ]),
  normalise([
    [0, 1],
    [1, -1],
    [-1, -1],
  ]),
  normalise([
    [0, 1],
    [1, 0.2],
    [1, -1],
    [-1, -1],
    [-1, 0.2],
  ]),
  normalise(
    Array.from({ length: 5 }, (_, index): Point => {
      const angle = Math.PI / 2 + (index * 2 * Math.PI) / 5;
      return [Math.cos(angle), Math.sin(angle)];
    }),
  ),
];

/**
 * The left half of an icon, cut down its middle rather than squashed to half
 * the width: a narrow pentagon is a different icon, and a pentagon with its
 * right side missing is half of one. Convex shapes only, which is all of them
 * above.
 */
function leftHalf(points: readonly Point[]): Point[] {
  const out: Point[] = [];
  for (let index = 0; index < points.length; index++) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    const fromIn = from[0] <= 0;
    const toIn = to[0] <= 0;
    if (fromIn) out.push(from);
    if (fromIn !== toIn) {
      const along = -from[0] / (to[0] - from[0]);
      out.push([0, from[1] + along * (to[1] - from[1])]);
    }
  }
  return out;
}

/**
 * The comma-joined list, or nothing at all. Strict for `bar`'s reason:
 * `Number('')` is 0, so a list with a hole in it would read as a row of no
 * icons rather than as the typo it is.
 */
function parseCounts(text: string): number[] | null {
  const parts = text.split(',').map((part) => part.trim());
  if (parts.some((part) => part === '')) return null;
  const counts = parts.map(Number);
  return counts.every((count) => Number.isFinite(count)) ? counts : null;
}

function parseLabels(text: string): string[] {
  return text.split(',').map((part) => part.trim());
}

export const pictographModule: FigureKindModule<'pictograph'> = {
  kind: 'pictograph',

  // Only the counts are required - they are the question. Omitting `key` is
  // what asks for whichever key the counts allow; omitting `labels` leaves the
  // rows unnamed, which is right for a graph whose caption names them; omitting
  // `halves` says every count is a whole number of icons.
  fields: {
    counts: 'required',
    labels: 'optional',
    key: 'optional',
    halves: 'optional',
  },

  build(spec: PictographSpec, scope: Scope, rng: Rng): Mark[] {
    const read = readField(spec.counts, scope);
    const parsed = typeof read === 'string' ? parseCounts(read) : null;
    const counts = (parsed ?? FALLBACK_COUNTS)
      .slice(0, MAX_DRAWN_ROWS)
      // A row has no room to the left of its own axis, so a negative count is
      // drawn as nothing. It is reported; here it only has to be drawable.
      .map((count) => Math.max(count, 0));

    const readLabels = readField(spec.labels, scope);
    const names = typeof readLabels === 'string' ? parseLabels(readLabels) : [];
    const labelChars = Math.max(
      ...counts.map((_, index) => (names[index] ?? '').length),
      0,
    );

    const halves = truthy(readField(spec.halves, scope));
    // Exactly one draw whichever path this takes, pinned or not - see `bar`'s
    // `scaleFor` for why a figure that spends a variable number of draws
    // reshuffles the distractors of the very question it illustrates.
    const key = rng.pick(
      keyCandidates(counts, halves, iconBudget(labelChars), numberValue(readField(spec.key, scope))),
    );

    const drawn = counts.map((count) => Math.min(iconsFor(count, key, halves), MAX_DRAWN_ICONS));
    const rows = counts.length;
    const slots = slotsFor(counts, key, halves);
    const keyText = formatKey(key);
    const { gutter, iconPitch, keySlot, right } = layoutFor(rows, labelChars, slots, keyText.length);

    const shape = rng.pick(ICON_SHAPES);
    const fill = jitter(rng, ...SIZE_BAND);
    const pitch = rowPitch(rows, fill);
    const iconSize = Math.min(pitch * fill, iconPitch * ICON_SLOT_FILL);
    const half = leftHalf(shape);

    const keyY = -KEY_ROW_RATIO * pitch;

    // The two rules first, because they are what the fit measures the drawing
    // by: every label's ink ends inside them, so nothing here can be clipped.
    const marks: Mark[] = [
      rule([0, -pitch / 2], [0, (rows - 1) * pitch + pitch / 2]),
      rule([-gutter, -pitch / 2], [right, -pitch / 2]),
    ];

    counts.forEach((_, index) => {
      const y = (rows - 1 - index) * pitch;
      const name = names[index] ?? '';
      if (name !== '') {
        // Right-aligned against the axis, so the anchor moves left as the name
        // gets longer and the ink always ends inside the left bound.
        marks.push({
          kind: 'label',
          at: [-(LABEL_GAP + (name.length * CHAR_SHARE) / 2), y],
          text: name,
        });
      }
      const whole = Math.floor(drawn[index] + EPSILON);
      for (let icon = 0; icon < whole; icon++) {
        marks.push(iconAt((icon + 0.5) * iconPitch, y, iconSize, shape));
      }
      if (drawn[index] - whole > EPSILON) {
        marks.push(iconAt((whole + 0.5) * iconPitch, y, iconSize, half));
      }
    });

    marks.push(iconAt(-gutter + keySlot / 2, keyY, iconSize, shape));
    marks.push({
      kind: 'label',
      at: [-gutter + keySlot + KEY_TEXT_GAP + (keyText.length * CHAR_SHARE) / 2, keyY],
      text: keyText,
    });

    return marks;
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const raw = read(spec.counts, 'figure.counts', 'string', true);
    const counts = typeof raw === 'string' ? parseCounts(raw) : null;

    if (typeof raw === 'string' && !counts) {
      issues.push(`figure.counts: ${JSON.stringify(raw)} is not a comma-separated list of numbers`);
    }

    const halves = truthy(read(spec.halves, 'figure.halves', 'boolean'));
    const key = read(spec.key, 'figure.key', 'number');
    const pinned = typeof key === 'number' && key > 0 ? key : undefined;

    if (typeof key === 'number' && key <= 0) {
      issues.push(`figure.key: ${key} is not a number of things one icon can stand for`);
    }

    // Read before the counts are judged, which need it: how wide the gutter is
    // decides how many icons a row has room for.
    const labels = read(spec.labels, 'figure.labels', 'string');
    const names = typeof labels === 'string' ? parseLabels(labels) : [];
    const longest = names.reduce((a, b) => (b.length > a.length ? b : a), '');

    if (typeof labels === 'string') {
      if (counts && names.length !== counts.length) {
        issues.push(`figure.labels: ${names.length} labels for ${counts.length} rows`);
      }
      if (longest.length > MAX_LABEL_CHARS) {
        issues.push(
          `figure.labels: ${JSON.stringify(longest)} needs ${longest.length} characters` +
            ` beside the rows, more than the ${MAX_LABEL_CHARS} that leaves a row anywhere` +
            ' to draw an icon',
        );
      }
    }

    if (counts) {
      const negative = counts.find((count) => count < 0);
      if (negative !== undefined) {
        issues.push(
          `figure.counts: ${negative} is below zero, and a picture graph has no icon for it`,
        );
      } else if (counts.every((count) => count === 0)) {
        issues.push('figure.counts: every count is zero, so the graph has no icon to read');
      }

      if (counts.length > MAX_ROWS) {
        issues.push(
          `figure.counts: ${counts.length} rows is more than the ${MAX_ROWS} whose labels stay` +
            ' clear of one another in a report',
        );
      }

      const budget = iconBudget(longest.length);
      // Asked of every key the graph could be drawn with, not of the one a
      // lucky seed happens to pick: `build` picks from this same list, so a bad
      // key anywhere in it is a picture some child will meet. Each *kind* of
      // fault is reported once, naming the first key it bites on - four
      // candidates all failing the same way is one authoring mistake, and
      // saying it four times only buries the other three faults.
      for (const candidate of keyCandidates(counts, halves, budget, pinned)) {
        const slots = slotsFor(counts, candidate, halves);
        if (slots > budget && !said(issues, 'too many icons')) {
          issues.push(
            `figure.counts: a key of ${candidate} draws ${slots} icons across the widest row,` +
              ` more than the ${budget} that can be counted apart in a report` +
              ' - raise the key, or graph smaller counts',
          );
        }

        const rounded = counts.find((count) => count > 0 && !isExact(count, candidate, halves));
        if (rounded !== undefined && !said(issues, 'cannot say')) {
          const drawn = iconsFor(rounded, candidate, halves);
          issues.push(
            `figure.counts: a key of ${candidate} cannot say ${rounded}` +
              `${halves ? '' : ', and halves are off, so there is no half icon either'}` +
              ` - it is drawn as ${drawn} ${drawn === 1 ? 'icon' : 'icons'},` +
              ` a picture reading ${Math.round(drawn * candidate * 1000) / 1000}`,
          );
        }

        // The question no amount of measuring ink can answer: the icons fit
        // perfectly, they are simply the same icons. Two rows a child is being
        // asked to tell apart, drawn identically.
        const seen = new Map<number, number>();
        for (const count of counts) {
          const icons = iconsFor(count, candidate, halves);
          const already = seen.get(icons);
          if (already !== undefined && already !== count) {
            if (!said(issues, 'the same picture')) {
              issues.push(
                `figure.counts: a key of ${candidate} draws both ${already} and ${count} as` +
                  ` ${icons} ${icons === 1 ? 'icon' : 'icons'}, so two rows have the same picture`,
              );
            }
            break;
          }
          seen.set(icons, count);
        }

        const keyText = formatKey(candidate);
        const room = keyCharBudget(counts.length, longest.length, slots);
        if (keyText.length > room && !said(issues, 'figure.key: the key reads')) {
          issues.push(
            `figure.key: the key reads ${JSON.stringify(keyText)}, which needs` +
              ` ${keyText.length} characters where the graph has room for ${room}`,
          );
        }
      }
    }

    return issues;
  },
};

/** Whether this fault has already been reported against another candidate key. */
function said(issues: readonly string[], phrase: string): boolean {
  return issues.some((issue) => issue.includes(phrase));
}

function iconAt(cx: number, cy: number, size: number, points: readonly Point[]): Mark {
  return {
    kind: 'path',
    points: points.map(([x, y]): Point => [cx + x * size, cy + y * size]),
    closed: true,
    fill: true,
    dashed: false,
  };
}

function rule(from: Point, to: Point): Mark {
  return { kind: 'path', points: [from, to], closed: false, fill: false, dashed: false };
}
