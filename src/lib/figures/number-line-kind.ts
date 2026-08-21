import type { Scope } from '../expr';
import type { Rng } from '../rng';
import { clamp, jitter, numberValue, readField, truthy } from './fields';
import { CHAR_SHARE, DRAWN_SPAN, LABEL_DAYLIGHT, MIN_MARK_GAP_PX, REPORT_BOX_PX } from './labels';
import type { FigureKindModule } from './registry';
import { FIGURE_BOX, type Expr, type FigureSpec, type Mark, type Point } from './types';

/**
 * The `number-line` kind: a ruled line with numbers under some of its ticks
 * and an arrow standing on one point of it. Like `bar` and `pictograph` the
 * drawing *is* the question - "what number is the arrow pointing at?" has no
 * answer in the prompt - and unlike either of them the reading is a *position*:
 * a child finds the arrow, counts back to the nearest number, and says what it
 * landed on.
 *
 * ---
 *
 * ## What varies, and the one thing that never does
 *
 * The arrow's share of the line is `(at - from) / (to - from)`. That is the
 * answer, so it is not a lever: every jitter below leaves it exactly where the
 * template's own `at` puts it, and the sweep asserts as much on every seed.
 *
 * What varies:
 *
 * 1. **The range**, when `from` and `to` are left open - the headline lever,
 *    and the one this kind most needs. A question answered 7 draws on 0-10 on
 *    one seed and on 5-15 on the next, so the arrow sits seven tenths along
 *    one time and a fifth of the way the next. Without it a child would learn
 *    "the answer is the tick most of the way along" and the analytics would
 *    call the topic secure on the strength of it. (0-20 was the example here
 *    until the minor ticks were measured in a report row: reading a 7 needs
 *    ticks at every 1, and twenty of them in a 64px thumbnail is a band. It is
 *    still drawn for values its ticks *can* reach, an even one like 4.)
 * 2. **The step**, when it is left open: which of the values get a number
 *    under them, out of the steps that divide the range and still leave labels
 *    a reader can tell apart.
 * 3. **Whether the minor ticks are drawn**, when that is left open - but only
 *    where the arrow does not need them; see below.
 * 4. **How long the ticks are** and **how big the arrow is**. These are the
 *    two that survive a template pinning everything else, which is the case
 *    the notes insist on: a kind that varies only while something is open has
 *    a latent anchoring failure waiting for the first author who pins it. Both
 *    are proportions of a frame the labels pin (below), so neither is the
 *    "overall size" jitter the uniform, centring fit normalises straight back
 *    out - and both are plainly visible, which a lever has to be to be worth
 *    having.
 *
 * ## The minor ticks are not a free jitter, because the answer can depend on them
 *
 * A report-scale number is about a tenth of the box wide, so a line can carry
 * three or four of them and no more (`MAX_LABEL_GAPS`). That is why `step`
 * exists at all - 0 to 20 is labelled 0, 10, 20 - and it means the arrow very
 * often stands *between* two numbers, where the only thing that says which
 * value it is on is the run of small ticks the child counts along.
 *
 * So **where the builder chose the range itself, the arrow stands on a drawn
 * tick**: it picks only among ranges and steps that can express `at`, and it
 * draws the minor ticks whenever `at` is not on a labelled one, jittering them
 * only where they say nothing the child has to read. Choosing a range that
 * hides its own answer would be the builder's fault, not the author's, and
 * `spinner`'s lesson is that a figure contradicting its own question is worse
 * than one that anchors - a wrong answer is visible where a picture that
 * cannot be read is just a child guessing.
 *
 * **Where no range can express `at`, that is reported, not drawn around.**
 * `1 / 3` is the case: a fractions template computes it and nothing on the
 * ladder of ranges and steps steps onto it. `build` still draws a line,
 * because it never refuses and a child is waiting - but `arrowIsStranded`
 * fails the template first, so the only figure a child meets with the arrow
 * floating is one an author deliberately asked for by pinning the range. The
 * guarantee lives across the two halves, exactly as `MAX_CHOICES` does: the
 * builder clamps quietly and validation is what makes the clamping safe.
 * Stated this way because the previous wording promised it of `build` alone,
 * which was never true of the code - and `clock` (an `at` between minute
 * marks) and `grid` (a point off the lattice) face this same question.
 *
 * **Where the author pinned the range, the author's line is drawn.** An arrow
 * deliberately between two ticks is a real question - "is it nearer 10 or
 * 20?" - and a kind that refused it would be deciding what content may exist.
 * Pinning `minorTicks: 'false'` on such a line is honoured in silence for the
 * same reason: supplying a parameter is what pins it, deliberately.
 *
 * ## The frame is pinned by the labels, so nothing clips
 *
 * The layout is a frame of **width exactly 1 and height well under it**, which
 * is what makes `labels.ts`' shares directly comparable with the geometry
 * here: the fit's scale is then `DRAWN_SPAN` and a report-scale character is
 * `CHAR_SHARE` of this file's own units.
 *
 * The line is drawn `frameOverhangFor` past each end tick, and that overhang is
 * exactly half the widest label's ink. So the leftmost bound of the drawing is
 * the line's own end, the leftmost ink is a label's, and the second is inside
 * the first **by construction** rather than by a solved inequality - the
 * technique `pictograph` found and `labels.ts` recommends. `CHAR_SHARE` sits on
 * both sides and cancels. Measured over the accepted sweep, the horizontal ink
 * margin is the whole of `FIGURE_PADDING`, never spent.
 *
 * Two preconditions, both checked. The pinned side really is the span: the
 * frame is exactly 1 wide and at most `TICK_BAND[1] + LABEL_GAP + ARROW_GAP +
 * ARROW_BAND[1]` tall, about a quarter of that. And the overhang is a mark the
 * kind was drawing anyway - a number line without a bit of line past its last
 * tick looks cut off.
 *
 * ## The three questions a derived label owes
 *
 * Every number under this line is *computed* from `from`, `to` and `step`, so
 * all three of `labels.ts`' questions are live and each is answered by its own
 * check:
 *
 * 1. **Is it the label that gets drawn?** Every measurement here folds over
 *    `tickTexts` - the formatted strings - and never over `from`, `to` or the
 *    step they came from. `formatTick` rounds, so the two differ.
 * 2. **Does all of it fit?** `labelsFit` asks *every adjacent pair*, not the
 *    ends and not one representative: "0", "5", "10", "15", "20" is widest in
 *    the middle-to-right pairs, and a range starting below zero carries its
 *    minus sign at whichever end it likes.
 * 3. **Is it still distinct from its neighbour?** `repeatedTickLabel`, and it
 *    is the one no amount of measuring ink can find: a step under a thousandth
 *    prints the same text twice, and a line reading `0 | 0 | 0 | 0` fits its
 *    box perfectly and says nothing at all. It is **reported**, never quietly
 *    stepped around - `bar`'s stance on its own repeated rungs, and for its
 *    reason: redrawing a template's line at a step it did not ask for would be
 *    a picture the template never described.
 *
 * The first two of those bound what the third can reach: `MAX_LABEL_CHARS` is
 * four, and `formatTick` rounds at the thousandth, so a step fine enough to
 * collide almost always prints a label too wide to be accepted anyway. The
 * exception is a line whose numbers all round to the same *short* string -
 * 0 to 0.0004 reads `0 | 0 | 0` in one character each - and that is precisely
 * the case ink cannot see and this check exists for.
 */

type NumberLineSpec = Extract<FigureSpec, { kind: 'number-line' }>;

/** Comparing values against a step, where both came out of floating-point arithmetic. */
const EPSILON = 1e-9;

/** How close to a tick a value has to be to count as standing on it. */
const LATTICE_TOLERANCE = 1e-6;

/**
 * The most characters a number under this line may carry. **Derived, not
 * chosen**: the frame gives up half a label's ink at each end, so a line
 * labelled with `c` characters has `1 - c * CHAR_SHARE` left, and the single
 * labelled gap a line must have needs `(c + LABEL_DAYLIGHT) * CHAR_SHARE` of
 * it. Solving `1 - c·s >= (c + d)·s` leaves four characters - which is a line
 * labelled to 1000, or one that starts at -100. Reported, never clamped.
 *
 * **Clipping does not begin here; it begins at ten characters**, and only
 * because of `MIN_LINE_SPAN`. Measured across labels of one to thirteen
 * characters, the horizontal ink margin is exactly `FIGURE_PADDING` (6.00) up
 * to eight, 4.05 at nine, and -0.21 at ten. So the limit reported to an author
 * sits six characters inside the one that would actually lose ink, which is
 * what `labels.ts` asks for and what `bar` could not manage.
 */
const MAX_LABEL_CHARS = Math.floor((1 / CHAR_SHARE - LABEL_DAYLIGHT) / 2);

/**
 * The most labelled gaps a line may be cut into. Derived the same way, at the
 * generous end - single-character numbers, which are the narrowest there are.
 * A wider label buys fewer gaps, which `labelsFit` works out per line; this is
 * only the loop bound, and the reason `step` is a parameter at all.
 */
const MAX_LABEL_GAPS = Math.floor((1 - CHAR_SHARE) / ((1 + LABEL_DAYLIGHT) * CHAR_SHARE));

/**
 * A line is never squeezed past this, however wide the labels: a drawing has
 * to exist even for content `issues` refuses, since `build` runs mid-session
 * and validation is a separate gate. It is the one thing that can stop the
 * frame being exactly 1 wide, and so the one thing that can break the
 * containment identity above - which it does past **eight** characters
 * (`1 - 8 * CHAR_SHARE` is still over this; nine is not), four past what
 * `MAX_LABEL_CHARS` already reports, and clipping does not actually begin
 * until ten. Every such label is a reported one.
 */
const MIN_LINE_SPAN = 0.1;

/**
 * How close two of this line's ticks may be drawn, in this file's own frame
 * units, where 1 is the whole drawn span. `MIN_MARK_GAP_PX` in `labels.ts` is
 * the shared half - two stroke widths in a report row's real pixels, so a whole
 * stroke of daylight stands between them - and the conversion into a share of
 * the span is this kind's own arithmetic. Under it two ticks are one thick line
 * at report scale, and a child counting along the line in the report is
 * counting a band.
 *
 * **The minor ticks are measured against the report row rather than against
 * the play screen, and that is `spinner`'s argument rather than a taste**: a
 * figure is built **once**, `buildFigure`'s signature carries no scale, so the
 * smaller of the two call sites governs anything that has to stay countable.
 * `spinner-kind.ts` states it outright, and its `MIN_SECTOR_DEGREES` is derived
 * exactly this way.
 *
 * **`bar` makes the opposite choice for its category labels, and it does not
 * transfer here.** Read `categoryBudget`: it judges *collision* at play scale
 * on the ground that crowded labels in a thumbnail are "a reminder of a
 * question already answered" - redundant with the prompt, so nothing is lost
 * by letting them crowd. Minor ticks are the opposite of redundant. This
 * kind's whole reason for drawing them (see the module comment) is that when
 * the arrow stands between two numbers they are the only thing saying which
 * value it is on, so a report row where they merge into a band is a row that
 * cannot answer its own question - and CLAUDE.md keeps the stored figure
 * precisely so "a parent asking how a question went wrong has to be looking at
 * the one their child was looking at". A contrary precedent exists; it was
 * read, and it is about a mark that carries no answer.
 *
 * What this costs a template - the ranges it stops being able to draw, and the
 * one case where a range cannot vary at all - is written on `from` in
 * `types.ts`, which is where an author will meet it.
 */
const MIN_TICK_GAP = (MIN_MARK_GAP_PX / REPORT_BOX_PX) * (FIGURE_BOX / DRAWN_SPAN);

/**
 * How many minor ticks one labelled step is cut into, in the order they are
 * preferred. Fewest first: the subdivision a child counts along should be as
 * coarse as it can be and still land on the arrow.
 */
const MINOR_PARTS = [2, 4, 5, 10] as const;

/**
 * The spans a builder-chosen range is picked from, in units of `at`'s own
 * magnitude - so a 7 is offered lines of 1, 2, 5, 10 and 20, and a 70 is
 * offered 10, 20, 50, 100 and 200. Only those whose ticks can express `at`
 * survive the filter in `linesToDraw`.
 */
const SPAN_BASES = [1, 2, 5, 10, 20] as const;

/**
 * How long a labelled tick is drawn, as a share of the frame. **One of the two
 * jitters that survive a template pinning everything else** - it changes the
 * proportions of a frame the labels pin, so the centring fit cannot normalise
 * it away, and a child can see it.
 */
const TICK_BAND = [0.05, 0.085] as const;

/** A minor tick's length as a share of a labelled one's, so the two never read alike. */
const MINOR_TICK_RATIO = 0.55;

/** From the foot of a tick to the middle of the number under it. */
const LABEL_GAP = 0.03;

/** The whole arrow, tip to tail - the other jitter that survives every pin. */
const ARROW_BAND = [0.09, 0.15] as const;
/** Daylight between the arrow's tip and the line, so the point is visible. */
const ARROW_GAP = 0.012;
/** Half the arrowhead, half the shaft, and how much of the arrow is head. */
const ARROW_HEAD_HALF = 0.022;
const ARROW_STEM_HALF = 0.007;
const ARROW_HEAD_RATIO = 0.45;

/** Where an `at` nobody could read lands - still a number line, just not the asked one. */
const FALLBACK_AT = 5;

/**
 * A tick's number, without the tail a floating-point step would otherwise
 * leave on it. It rounds, which is what makes the third question above a real
 * one: two different values can come out of here as the same string.
 *
 * **The rounding is skipped where it would overflow.** `Math.round(v * 1000)`
 * is `Infinity` for anything past about 1.79e305, so multiplying to round to
 * three places turns a perfectly ordinary (if enormous) number into a tick
 * reading `Infinity` - a label that is no longer the number it came from,
 * which is the first of the three questions failing at the top. Such a line is
 * refused for width either way; this is so the sentence an author is shown
 * names their own value back to them.
 */
function formatTick(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  return String((Number.isFinite(rounded) ? rounded : value) + 0);
}

/** How many whole steps fit along the line - the number of labelled gaps. */
function tickCount(from: number, to: number, step: number): number {
  if (!(step > 0) || !Number.isFinite(step)) return 0;
  const gaps = Math.floor((to - from) / step + EPSILON);
  return Number.isFinite(gaps) ? Math.max(gaps, 0) : 0;
}

/** The numbers that will be drawn, as the strings they will be drawn as. */
function tickTexts(from: number, step: number, gaps: number): string[] {
  return Array.from({ length: gaps + 1 }, (_, index) => formatTick(from + index * step));
}

function widestLabel(texts: readonly string[]): number {
  return texts.reduce((widest, text) => Math.max(widest, text.length), 0);
}

/**
 * Half the widest label's ink, which is exactly how far the line runs past its
 * end ticks - the identity that makes clipping impossible rather than merely
 * unlikely. The arrowhead is the other thing that can reach an end, and it is
 * narrower than a single character, so the `max` is belt and braces rather
 * than a case that bites.
 */
function frameOverhangFor(chars: number): number {
  return Math.max((chars * CHAR_SHARE) / 2, ARROW_HEAD_HALF);
}

/** What is left for the line itself once both overhangs are paid for. */
function lineSpanFor(chars: number): number {
  return Math.max(1 - 2 * frameOverhangFor(chars), MIN_LINE_SPAN);
}

/**
 * Whether every number this step draws fits, and clears the one beside it.
 *
 * **Asked of every adjacent pair rather than of the widest label**, because
 * the two neighbours that crowd each other are not always the two longest
 * strings: `0, 5, 10, 15, 20` is roomiest at its left end and tightest in the
 * middle, and a range starting below zero carries an extra character at
 * whichever end the minus sign falls.
 */
function labelsFit(texts: readonly string[]): boolean {
  const gaps = texts.length - 1;
  if (gaps < 1) return false;
  const chars = widestLabel(texts);
  if (chars > MAX_LABEL_CHARS) return false;

  const pitch = lineSpanFor(chars) / gaps;
  for (let index = 0; index + 1 < texts.length; index++) {
    const needed =
      ((texts[index].length + texts[index + 1].length) / 2 + LABEL_DAYLIGHT) * CHAR_SHARE;
    if (pitch + EPSILON < needed) return false;
  }
  return true;
}

/**
 * The text two ticks would both carry, or nothing at all if every one reads
 * differently. **The question no amount of measuring ink can answer**: a line
 * of repeated numbers fits its box perfectly and is not a scale. The labels
 * are the right size; they are the wrong labels.
 */
function repeatedTickLabel(texts: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const text of texts) {
    if (seen.has(text)) return text;
    seen.add(text);
  }
  return null;
}

/**
 * Whether the small ticks may be drawn at all.
 *
 * **The one reading, shared by `build` and `issues`**, which is what stops the
 * two judging different candidate sets. They used to read this field
 * differently: `build` took `truthy` of whatever the expression evaluated to,
 * so `minorTicks: '0'` pinned them off, while `issues` asked
 * `typeof value === 'boolean'`, which a `0` is not, so validation inspected
 * the lines a figure *with* minor ticks could take. Such a spec is already
 * reported as the wrong type, so nothing could ship on it - but it was the one
 * place the "validation recomputes what the builder does" property did not
 * hold, and a property with an exception is not one anybody can rely on.
 */
function minorsAllowedBy(expr: Expr | undefined, scope: Scope): boolean {
  const asked = readField(expr, scope);
  return asked === undefined || truthy(asked);
}

/** Whether a value lands on a lattice of this spacing starting at `from`. */
function onLattice(value: number, from: number, spacing: number): boolean {
  if (!(spacing > 0) || !Number.isFinite(spacing)) return false;
  const steps = (value - from) / spacing;
  if (!Number.isFinite(steps)) return false;
  return Math.abs(steps - Math.round(steps)) < LATTICE_TOLERANCE;
}

/** Whether a step divides the line exactly, so the last tick is the end of it. */
function dividesEvenly(span: number, step: number): boolean {
  if (!(step > 0)) return false;
  const steps = span / step;
  return Number.isFinite(steps) && Math.abs(steps - Math.round(steps)) < LATTICE_TOLERANCE;
}

/**
 * How many parts one labelled step is cut into, or nothing if there is no room
 * for minor ticks at all.
 *
 * The fewest that puts `at` on a tick, so the child counts as few small marks
 * as the number allows; failing that the fewest that fit, which still gives
 * something to estimate against. Deterministic on purpose - it is a
 * consequence of the step and the value, not a lever of its own, and one more
 * random pick here would be variation a child can barely see.
 */
function minorPartsFor(
  from: number,
  step: number,
  gaps: number,
  at: number,
  chars: number,
): number | undefined {
  const span = lineSpanFor(chars);
  const legible = MINOR_PARTS.filter(
    (parts) => span / (gaps * parts) >= MIN_TICK_GAP - EPSILON,
  );
  const expressing = legible.filter((parts) => onLattice(at, from, step / parts));
  return expressing[0] ?? legible[0];
}

/** Whether the arrow would have something under it to stand on. */
function standsOnATick(
  from: number,
  step: number,
  gaps: number,
  at: number,
  chars: number,
  minorsAllowed: boolean,
): boolean {
  if (onLattice(at, from, step)) return true;
  if (!minorsAllowed) return false;
  const parts = minorPartsFor(from, step, gaps, at, chars);
  return parts !== undefined && onLattice(at, from, step / parts);
}

/**
 * The steps this line could be labelled in, biggest first.
 *
 * A pinned step is kept unless it asks for a line that cannot be labelled -
 * `bar`'s rule for a pinned scale, and for its reason: drawing what was asked
 * for is worse than drawing something readable, and it is reported so no such
 * template ships.
 *
 * Left open, the candidates are the span cut into 1, 2, ... equal parts, so
 * **a builder-chosen step divides the range evenly by construction** and the
 * last tick is always the end of the line. A part count whose step prints
 * awkwardly - a third of 20 is 6.667, five characters - falls out on its own
 * through `labelsFit` rather than needing a table of nice numbers.
 */
function stepCandidates(from: number, to: number, pinned: number | undefined): number[] {
  const span = to - from;

  if (pinned !== undefined && pinned > 0) {
    const gaps = tickCount(from, to, pinned);
    if (gaps >= 1 && gaps <= MAX_LABEL_GAPS && labelsFit(tickTexts(from, pinned, gaps))) {
      return [pinned];
    }
  }

  const steps: number[] = [];
  for (let gaps = 1; gaps <= MAX_LABEL_GAPS; gaps++) {
    const step = span / gaps;
    if (labelsFit(tickTexts(from, step, gaps))) steps.push(step);
  }
  // Past what any step can label - a line to a million. Drawn with one gap so
  // there is still a drawing, and reported, which is what stops it shipping.
  return steps.length > 0 ? steps : [span];
}

/** The steps the builder actually picks between, arrow readability preferred. */
function stepsToDraw(
  from: number,
  to: number,
  at: number,
  pinned: number | undefined,
  minorsAllowed: boolean,
): number[] {
  const pool = stepCandidates(from, to, pinned);
  const expressing = pool.filter((step) => {
    const gaps = tickCount(from, to, step);
    if (gaps < 1) return false;
    const chars = widestLabel(tickTexts(from, step, gaps));
    return standsOnATick(from, step, gaps, at, chars, minorsAllowed);
  });
  return expressing.length > 0 ? expressing : pool;
}

/** Any line at all containing `at` - where a range nobody could read lands. */
function fallbackRange(
  at: number,
  from: number | undefined,
  to: number | undefined,
): [number, number] {
  const low = from !== undefined && from <= at ? from : at - 1;
  const high =
    to !== undefined && to > low && to >= at ? to : low + Math.max(2, Math.abs(at - low) * 2);
  return [low, high];
}

/**
 * The ranges a builder-chosen line could take: nice spans around `at`'s own
 * magnitude, each offered twice - started at the multiple of itself at or below
 * `at`, and again half a span along (`shiftedStart`). That is what puts a 7 on
 * 0-10 and on 5-15 - the same number, two different pictures - which is the
 * whole of this kind's answer to the anchoring rule.
 *
 * A range the author pinned at both ends is the only candidate there is: it is
 * their line, and the builder does not go looking for a better one.
 */
function rangeCandidates(
  at: number,
  from: number | undefined,
  to: number | undefined,
): [number, number][] {
  if (from !== undefined && to !== undefined) return to > from ? [[from, to]] : [];

  const magnitude = 10 ** Math.floor(Math.log10(Math.max(Math.abs(at), 1)));
  const seen = new Set<string>();
  const ranges: [number, number][] = [];

  const offer = (low: number, span: number) => {
    const high = low + span;
    // A span that has overflowed to `Infinity` - which the biggest bases do
    // for an `at` near the top of what a double holds - is not a line.
    if (!(high > low) || !Number.isFinite(high) || at < low - EPSILON || at > high + EPSILON) {
      return;
    }
    const key = `${low}:${high}`;
    if (seen.has(key)) return;
    seen.add(key);
    ranges.push([low, high]);
  };

  for (const base of SPAN_BASES) {
    const span = base * magnitude;
    const low = from ?? (to !== undefined ? to - span : Math.floor(at / span) * span);
    offer(low, span);

    // The second framing of the same width. Only where the builder is choosing
    // both ends: an author who gave one has said where the line starts.
    if (from === undefined && to === undefined) {
      const shifted = shiftedStart(at, low, span);
      if (shifted !== undefined) offer(shifted, span);
    }
  }

  return ranges;
}

/**
 * The same span started half a span along, or nothing where that would draw
 * uglier numbers than the span grid already does.
 *
 * **Why there is a second offset at all.** One start per span means a value the
 * grid can only frame one way gets exactly one line, on every seed - and
 * measured, that was 36 of the integers 0-100 (11, 13, 17, 19, 21 ...) and 40
 * of the one-decimal values. Their pictures still differed, because the step
 * and the two proportional jitters still moved, so `validateTemplate` - which
 * compares whole figures - passed them. That is worse than a check failing: a
 * child answering 11 saw the same line every time and could learn "the tick
 * after the 10" instead of reading the number, which is the mislearning the
 * anchoring rule exists to prevent, slipping *under* the check rather than
 * through it. Half a span along is `5..15` beside `10..20`, and 11 sits on a
 * minor tick of both.
 *
 * **The roundness constraint, and why it is asked of the text.** An arbitrary
 * offset trades one unreadable picture for another - `3..13` labelled 3, 8, 13
 * is no better than a line with no tick under the arrow. Half a span keeps the
 * numbers round where half the span is itself round, and does not where it is
 * not: half of 5 is 2.5, so a `7` would be offered `2.5..7.5`. So the test is
 * the one this file applies to every other derived label - **ask the text that
 * gets drawn**: an endpoint that *prints* longer than the one the span grid
 * would have used is an endpoint that has grown a decimal, and the candidate is
 * dropped rather than drawn. No second candidate beats an ugly one.
 *
 * The shift never takes a non-negative value below zero, which is the same
 * invariant `Math.floor(at / span) * span` already gives the span grid: a child
 * asked about 3 is not shown negative numbers to get there.
 */
function shiftedStart(at: number, low: number, span: number): number | undefined {
  const half = span / 2;
  // Whichever of the two neighbouring half-grid starts still contains `at`.
  const shifted = at <= low + half + EPSILON ? low - half : low + half;

  if (at >= 0 && shifted < 0) return undefined;
  if (!Number.isFinite(shifted)) return undefined;
  // Longer text is a decimal the span grid did not have: 10 -> 5 is fine, 5 ->
  // 2.5 is not, and neither end may grow.
  if (formatTick(shifted).length > formatTick(low).length) return undefined;
  if (formatTick(shifted + span).length > formatTick(low + span).length) return undefined;

  return shifted;
}

/**
 * The lines the builder actually picks between. Where it is choosing, it keeps
 * only the ranges whose ticks can express `at` - see the module comment for
 * why that guarantee is the builder's and not the author's.
 */
function linesToDraw(
  at: number,
  from: number | undefined,
  to: number | undefined,
  pinnedStep: number | undefined,
  minorsAllowed: boolean,
): [number, number][] {
  const ranges = rangeCandidates(at, from, to);
  const standing = ranges.filter((range) => lineStands(range, at, pinnedStep, minorsAllowed));
  // Falling back to the whole list is `build` keeping its side of the bargain -
  // it draws *something* mid-session and never refuses. It is not the guarantee
  // quietly giving way: `arrowIsStranded` reports exactly this case, so no
  // template reaching a child can be one where `standing` was empty.
  const pool = standing.length > 0 ? standing : ranges;
  return pool.length > 0 ? pool : [fallbackRange(at, from, to)];
}

/**
 * Whether any step this line could be labelled in leaves a tick under the
 * arrow. Shared by `linesToDraw` and by `arrowIsStranded`, so what validation
 * judges cannot drift from what the builder picks between.
 */
function lineStands(
  [low, high]: [number, number],
  at: number,
  pinnedStep: number | undefined,
  minorsAllowed: boolean,
): boolean {
  return stepsToDraw(low, high, at, pinnedStep, minorsAllowed).some((step) => {
    const gaps = tickCount(low, high, step);
    if (gaps < 1) return false;
    const chars = widestLabel(tickTexts(low, step, gaps));
    return standsOnATick(low, step, gaps, at, chars, minorsAllowed);
  });
}

/**
 * Whether the arrow would end up floating between two ticks on **every** line
 * the builder could choose - the authoring mistake behind a figure that cannot
 * answer its own question.
 *
 * Only asked where the builder is picking at least one end of the range. A
 * range the author pinned at both ends is theirs, and an arrow deliberately
 * between two ticks is a real question there ("is it nearer 10 or 20?"); it is
 * only when the *builder* chose the line that a line without the answer on it
 * is the builder's fault. That split is stated on `from` in `types.ts` as well,
 * because it is the contract an author acts on.
 *
 * `1 / 3` is the case this exists for: a fractions template computes it, no
 * range and step whose numbers fit steps onto it, and before this check the
 * figure validated clean and drew an arrow pointing at nothing.
 */
function arrowIsStranded(
  at: number,
  from: number | undefined,
  to: number | undefined,
  pinnedStep: number | undefined,
  minorsAllowed: boolean,
  lines: readonly [number, number][],
): boolean {
  if (from !== undefined && to !== undefined) return false;
  return !lines.some((range) => lineStands(range, at, pinnedStep, minorsAllowed));
}

/**
 * Where a range whose arithmetic has run out lands. Up near the largest number
 * a double holds, `at + 1` is still `at` and every span overflows, so there is
 * no line to put an arrow on - and `build` owes a child a drawing rather than
 * a blank square. `issues` names it; here it only has to be drawable.
 */
const LAST_RESORT_RANGE: [number, number] = [0, 10];

/** A range with a positive, finite width, or the one above. */
function drawableRange(range: [number, number]): [number, number] {
  const span = range[1] - range[0];
  return Number.isFinite(range[0]) && span > 0 && Number.isFinite(span) ? range : LAST_RESORT_RANGE;
}

function rule(from: Point, to: Point): Mark {
  return { kind: 'path', points: [from, to], closed: false, fill: false, dashed: false };
}

/** A tick, straddling the line so it reads as a mark *on* it rather than beside it. */
function tickAt(x: number, length: number): Mark {
  return rule([x, -length / 2], [x, length / 2]);
}

/** The arrow: one closed outline, tip down on the line, shaft up out of it. */
function arrowAt(x: number, length: number): Mark {
  const head = length * ARROW_HEAD_RATIO;
  const tip = ARROW_GAP;
  const points: Point[] = [
    [x, tip],
    [x - ARROW_HEAD_HALF, tip + head],
    [x - ARROW_STEM_HALF, tip + head],
    [x - ARROW_STEM_HALF, tip + length],
    [x + ARROW_STEM_HALF, tip + length],
    [x + ARROW_STEM_HALF, tip + head],
    [x + ARROW_HEAD_HALF, tip + head],
  ];
  return { kind: 'path', points, closed: true, fill: true, dashed: false };
}

export const numberLineModule: FigureKindModule<'number-line'> = {
  kind: 'number-line',

  // Only the value is required - it is the answer, and the one thing the
  // builder cannot invent. Omitting `from` and `to` is what asks for the range
  // to jitter; omitting `step` is what asks for whichever spacing the range
  // allows; omitting `minorTicks` is what asks for the small ticks to come and
  // go, where the arrow does not depend on them.
  fields: {
    at: 'required',
    from: 'optional',
    to: 'optional',
    step: 'optional',
    minorTicks: 'optional',
  },

  build(spec: NumberLineSpec, scope: Scope, rng: Rng): Mark[] {
    const at = numberValue(readField(spec.at, scope)) ?? FALLBACK_AT;
    const askedFrom = numberValue(readField(spec.from, scope));
    const askedTo = numberValue(readField(spec.to, scope));
    const pinnedStep = numberValue(readField(spec.step, scope));

    const minorsAllowed = minorsAllowedBy(spec.minorTicks, scope);

    // **Five draws, always, whichever of these is pinned.** `generate` threads
    // one `Rng` through `tryBind`, `buildFigure` and then `buildChoices`, so a
    // figure whose appetite depended on what a template pinned would reshuffle
    // the distractors of the very question it illustrates - see `bar`'s
    // `scaleFor`. A pick from a single candidate is still a pick.
    const [from, to] = drawableRange(
      rng.pick(linesToDraw(at, askedFrom, askedTo, pinnedStep, minorsAllowed)),
    );
    const step = rng.pick(stepsToDraw(from, to, at, pinnedStep, minorsAllowed));
    const minorsJittered = rng.next() < 0.5;
    const tickLength = jitter(rng, ...TICK_BAND);
    const arrowLength = jitter(rng, ...ARROW_BAND);

    const span = to - from;
    const gaps = Math.max(tickCount(from, to, step), 1);
    const texts = tickTexts(from, step, gaps);
    const chars = widestLabel(texts);
    const lineSpan = lineSpanFor(chars);
    const overhang = frameOverhangFor(chars);

    // The small ticks are only free to come and go where the arrow is already
    // standing on a numbered one - otherwise they are the answer, not decoration.
    const minorsOn = !minorsAllowed ? false : onLattice(at, from, step) ? minorsJittered : true;
    const parts = minorsOn ? minorPartsFor(from, step, gaps, at, chars) : undefined;

    const along = (value: number) => ((value - from) / span) * lineSpan;
    const marks: Mark[] = [rule([-overhang, 0], [lineSpan + overhang, 0])];

    for (let index = 0; index <= gaps; index++) {
      marks.push(tickAt(along(from + index * step), tickLength));
    }

    if (parts !== undefined) {
      for (let index = 0; index <= gaps * parts; index++) {
        // The ones a labelled tick already stands on are skipped: a short
        // stroke under a long one is a heavier line, not a countable mark.
        if (index % parts === 0) continue;
        marks.push(tickAt(along(from + (index * step) / parts), tickLength * MINOR_TICK_RATIO));
      }
    }

    texts.forEach((text, index) => {
      marks.push({
        kind: 'label',
        at: [along(from + index * step), -(tickLength / 2 + LABEL_GAP)],
        text,
      });
    });

    // Clamped, not refused: an `at` outside the line is reported, and here it
    // only has to be drawable.
    const arrowX = clamp(along(at), 0, lineSpan);
    marks.push(arrowAt(arrowX, arrowLength));
    marks.push({ kind: 'dot', at: [arrowX, 0] });

    return marks;
  },

  issues(spec, scope, read) {
    const issues: string[] = [];

    const value = read(spec.at, 'figure.at', 'number', true);
    const low = read(spec.from, 'figure.from', 'number');
    const high = read(spec.to, 'figure.to', 'number');
    const step = read(spec.step, 'figure.step', 'number');
    // Read for its own sake: this is what reports a `minorTicks` that is not a
    // truth value. What the field *means* to the geometry is read through
    // `minorsAllowedBy` below, the same call `build` makes.
    read(spec.minorTicks, 'figure.minorTicks', 'boolean');

    const at = typeof value === 'number' ? value : undefined;
    const from = typeof low === 'number' ? low : undefined;
    const to = typeof high === 'number' ? high : undefined;
    const pinned = typeof step === 'number' && step > 0 ? step : undefined;

    if (typeof step === 'number' && !(step > 0)) {
      issues.push(`figure.step: ${step} is not a distance between two ticks`);
    }
    if (from !== undefined && to !== undefined && !(to > from)) {
      issues.push(
        `figure.to: ${to} is not past figure.from ${from}, so there is no line to draw`,
      );
    }
    if (at !== undefined && from !== undefined && to !== undefined && to > from) {
      if (at < from || at > to) {
        issues.push(
          `figure.at: ${at} is outside the line from ${from} to ${to},` +
            ' so the arrow has nowhere to point',
        );
      }
    }

    // Everything below is about the numbers the line will carry, which needs a
    // value to build a line around. A missing `at` has already been reported.
    if (at === undefined) return issues;

    const minorsAllowed = minorsAllowedBy(spec.minorTicks, scope);
    const lines =
      from !== undefined && to !== undefined && !(to > from)
        ? []
        : linesToDraw(at, from, to, pinned, minorsAllowed);

    // Up near the largest number a double holds there is no line to draw at
    // all: every span the builder reaches for overflows, and `at + 1` is still
    // `at`, so the arithmetic a scale is made of has run out. Reported here
    // rather than as a fault of the step, which is only the symptom.
    const impossible = lines.find(
      ([start, end]) => !(end - start > 0) || !Number.isFinite(end - start),
    );
    if (impossible) {
      const [start, end] = impossible;
      // Named against the range where the author gave one, and against the
      // value where the builder had to invent one around it.
      issues.push(
        from !== undefined && to !== undefined
          ? `figure.to: a line from ${start} to ${end} is wider than arithmetic can tell` +
              ' apart, so its ticks would all fall on the same number'
          : `figure.at: ${at} is too big a number to draw a line around - every range` +
              ' holding it runs off the end of the numbers arithmetic can tell apart',
      );
      return issues;
    }

    // The picture that cannot answer its own question. `build` still draws it -
    // it never refuses - so this report is the only thing standing between a
    // child and an arrow pointing at nothing between two ticks.
    if (arrowIsStranded(at, from, to, pinned, minorsAllowed, lines)) {
      issues.push(
        `figure.at: no line the builder can draw around ${at} has a tick under it -` +
          ' every range and step whose numbers fit steps straight past it, so the arrow' +
          ' would stand between two ticks with nothing to count. Pin figure.from and' +
          ' figure.to to a range whose ticks include it.',
      );
    }

    // **One fault, one message**, keyed on a tag rather than on a phrase from
    // the prose: the wording is the half that gets reworded, and a dedup
    // matching a substring nobody kept still compiles, still passes, and
    // silently stops deduping - which is exactly the bug `pictograph` shipped.
    const reported = new Set<string>();
    const firstOfItsKind = (fault: string): boolean => {
      if (reported.has(fault)) return false;
      reported.add(fault);
      return true;
    };

    // Named against a field the author actually wrote. A step they pinned is
    // theirs; otherwise the fault is in how far the line reaches, which is `to`
    // if they gave one, `from` if they gave only that, and `at` itself when the
    // builder had to size a range around their value.
    const rangeField =
      to !== undefined ? 'figure.to' : from !== undefined ? 'figure.from' : 'figure.at';

    for (const [start, end] of lines) {
      // The pinned step is asked about even when it was overridden - being
      // overridden is precisely what an author needs telling. Everything else
      // here is a step the builder could really pick.
      const candidates = [
        ...(pinned === undefined ? [] : [pinned]),
        ...stepsToDraw(start, end, at, pinned, minorsAllowed),
      ];

      for (const candidate of new Set(candidates)) {
        const where = candidate === pinned ? 'figure.step' : rangeField;
        // How many gaps the step *asks* for, before `tickCount` floors it - a
        // step of a millionth of the line asks for a million and floors to
        // `Infinity`, which read as "not even one" and was reported as a step
        // too long. Both ends of that mistake are named apart here.
        const wanted = (end - start) / candidate;
        const gaps = tickCount(start, end, candidate);

        if (!(wanted >= 1)) {
          if (firstOfItsKind('long')) {
            issues.push(
              `figure.step: a step of ${candidate} is longer than the line from` +
                ` ${start} to ${end}, so there is nothing between its ends to label`,
            );
          }
          continue;
        }
        if (!Number.isFinite(wanted)) {
          if (firstOfItsKind('crowded')) {
            issues.push(
              `figure.step: a step of ${candidate} cuts the line from ${start} to ${end}` +
                ' into more ticks than can be counted, let alone labelled',
            );
          }
          continue;
        }
        if (gaps > MAX_LABEL_GAPS) {
          if (firstOfItsKind('crowded')) {
            issues.push(
              `figure.step: a step of ${candidate} puts ${gaps + 1} numbers along the line,` +
                ` more than the ${MAX_LABEL_GAPS + 1} whose labels stay clear of one another` +
                ' in a report, so a step that fits would be drawn instead',
            );
          }
          continue;
        }

        const texts = tickTexts(start, candidate, gaps);
        const chars = widestLabel(texts);
        const widest = texts.find((text) => text.length === chars) ?? '';

        if (chars > MAX_LABEL_CHARS) {
          if (firstOfItsKind('wide')) {
            issues.push(
              `${where}: a tick reading ${widest} needs ${chars} characters where the line` +
                ` has room for ${MAX_LABEL_CHARS} - label a shorter range`,
            );
          }
        } else if (!labelsFit(texts)) {
          if (firstOfItsKind('collide')) {
            issues.push(
              `${where}: ${texts.length} numbers as wide as ${widest} cannot be spread along` +
                ' the line without touching one another in a report - label fewer of them',
            );
          }
        }

        // Asked of the text that gets drawn, never of the values it came from.
        const repeated = repeatedTickLabel(texts);
        if (repeated && firstOfItsKind('repeat')) {
          issues.push(
            `${where}: a step of ${candidate} makes two ticks both read ${repeated},` +
              ' so the line cannot be read as a scale',
          );
        }

        if (!dividesEvenly(end - start, candidate) && firstOfItsKind('short')) {
          issues.push(
            `figure.step: a step of ${candidate} does not divide the line from ${start}` +
              ` to ${end}, so its last tick falls short of the end and ${end} goes unlabelled`,
          );
        }
      }
    }

    return issues;
  },
};
