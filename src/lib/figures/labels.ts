import { FIGURE_BOX, FIGURE_PADDING } from './types';

/**
 * How big a label is, to a kind that has to leave room for one.
 *
 * A figure is built **once** and rendered at two very different sizes: the play
 * screen passes `labelSize={7}` and a parent's report passes `labelSize={16}`
 * into the same 100-unit box (`src/components/diagram.tsx`). `buildFigure`'s
 * signature carries no scale and never will, so a kind cannot ask which one it
 * is being built for - it has to leave room for the **larger**, or spacing that
 * looks right on the play screen collides in every report row. These are that
 * larger case, and they are here rather than in one kind because they are facts
 * about type, not about bars: `number-line` and `grid` place labels too, and
 * three private copies would disagree the first time one was tuned.
 *
 * ---
 *
 * **Three things to know before you place a label.** They are not obvious, and
 * each of them is a bug that no test in this repo would have caught, because
 * nothing here renders SVG and the failure is only visible in a 64px thumbnail.
 *
 * **1. `fit` bounds a drawing by label *anchor points*, not by ink.** A `label`
 * is drawn `textAnchor="middle"`, so half of it hangs outside the box `fit`
 * measured - and an SVG clips at its own edge, so what hangs out is gone.
 * `FIGURE_PADDING` is the only slack there is: it covers half a line's ink
 * height (`INK_SHARE`) and it does **not** cover half a two-character label's
 * width. If a label sits at the extreme edge of your drawing, size the drawing
 * so its ink lands inside, or the first digit is sliced off in every report row.
 *
 * The same goes for every mark with extent, not only for text. A `dot` renders
 * as a round cap `strokeWidth * 3` real pixels across, centred on a point `fit`
 * bounded as a point - `bar`'s only mark that lands *exactly* on the fitted
 * bound is the dot of a zero value in an unlabelled dot chart, and it survives
 * because `FIGURE_PADDING` happens to pay for it, not because the kind budgeted
 * anything. A kind that puts a heavier mark on its own bound has no such luck,
 * and would clip in silence.
 *
 * **2. `fit` is uniform and centring, so varying the overall *size* of a
 * drawing is not varying the drawing.** A figure must never become the anchor
 * for an answer (see `types.ts`), and `validateTemplate` enforces that by
 * drawing a template 50 times and failing any answer that always produced the
 * same picture - after the fit, which scales any size difference away. Vary
 * *proportions* or the internal arrangement instead, and make sure at least one
 * such lever is left when every parameter a template can pin is pinned.
 *
 * **3. Report-scale type caps *content*, not just spacing.** A 100-unit box
 * holds about six lines of 16-unit type, top to bottom - so "how many rungs may
 * this axis have" is answered by the type size, not by taste, and it is why
 * `bar` has a `scale` parameter at all. Derive such a limit from `PITCH_SHARE`
 * rather than picking a round number. Where the limit falls on a *drawing*
 * choice, obey it silently; where it falls on the *data* (how many categories a
 * template gave you), draw what you were given and **report** it from `issues`.
 * Silently dropping or truncating data draws a picture the template never
 * described, which is worse than a cramped one.
 *
 * There is exactly one exception, and it is not a readability limit: `MAX_MARKS`
 * in `types.ts` is a *storage* cap, and `parseFigure` refuses a figure past it
 * when it is read back out of an `Attempt`. A kind may slice its input to stay
 * under that (`bar-kind.ts`'s `MAX_DRAWN_VALUES`) because the alternative is a
 * figure that cannot be shown again at all - but only where the slice is
 * unreachable in practice, being far past a limit `issues` already reports, so
 * no content that validates can ever be silently cut. If your kind takes this
 * exception, keep both halves: the slice *and* the reported limit well inside it.
 */

/**
 * The type size a figure is drawn at in a parent's report, in the fitted box's
 * own units - `progress-topics.tsx` passes `labelSize={16}`, against the play
 * screen's 7. Every share below is derived from this one number, so a change to
 * the report's density moves the geometry of every kind that labels anything.
 */
export const REPORT_LABEL_SIZE = 16;

/**
 * The type size the same figure is drawn at on the play screen, where the box
 * is the child's whole question rather than a thumbnail. Exported beside its
 * larger twin because the two together are the *range* a kind is drawing for -
 * and because a limit that genuinely cannot be met at report scale (see
 * `bar-kind.ts`'s `categoryBudget`, and read why before copying the exception)
 * has to be measured against something rather than guessed.
 */
export const PLAY_LABEL_SIZE = 7;

/**
 * The report row itself: a 64px square drawn at a stroke of 1.5 real pixels.
 * Both are exact rather than estimated - `progress-topics.tsx` renders the
 * figure in an `h-16 w-16` box and passes `strokeWidth={1.5}`.
 *
 * **They are facts about that component, not about any one kind**, which is why
 * they live here beside `REPORT_LABEL_SIZE` rather than being restated in each
 * file that measures ink. Three kinds now derive a legibility limit from them -
 * `spinner`'s thinnest sector, `number-line`'s tick gap, `clock`'s minute
 * track - and three private copies would disagree the first time the report's
 * density was tuned, which is the drift `FIGURE_PADDING` was moved into
 * `types.ts` to prevent.
 */
export const REPORT_BOX_PX = 64;
export const REPORT_STROKE_PX = 1.5;

/**
 * How far apart two strokes have to be, in a report row's real pixels, to read
 * as two marks rather than one thick one: two stroke widths, so a whole stroke
 * of daylight stands between them.
 *
 * The shared half of a rule two kinds had derived separately - `number-line`
 * converts it into its own frame units as `MIN_TICK_GAP`, `clock` compares it
 * against the pitch of a dial's marks - because *how far apart two strokes must
 * be* is a fact about the row, while *what that costs a straight line or a
 * dial* is each kind's own arithmetic and stays in each kind's own file.
 */
export const MIN_MARK_GAP_PX = REPORT_STROKE_PX * 2;

/**
 * The disc geometry a kind that fits a circle into `FIGURE_BOX` needs -
 * `spinner`'s sectors and `fraction-shape`'s circular parts are literally the
 * same disc, cut into equal or unequal wedges by the same rule, and this is
 * that rule written once. It used to be a private copy in `spinner-kind.ts`,
 * until `fraction-shape-kind.ts` needed the identical arithmetic and copying
 * it was exactly the drift this file's own module comment names by name
 * ("three private copies would disagree the first time...").
 *
 * `DISC_RIM_POINTS` is how many points a whole turn of the rim is sampled at
 * - a multiple of four, and from a fixed zero rather than from any jittered
 * angle, so the sampled polygon has a vertex on each axis and its bounding
 * box is the true circle's whatever the rest of the drawing does. Seventy-two
 * is 5 degrees a step, which at the report's ~28px radius bulges 0.03px
 * inside the true circle - a circle, not a polygon.
 *
 * `FITTED_DISC_RADIUS` is what `fit` leaves a disc drawn at radius 1, in the
 * box's own units - the fitted size every kind that draws one actually gets.
 *
 * `DEGREES_PER_RIM_PX` is how much of the turn one real report-row pixel of
 * rim is worth, and every angular legibility limit here is a number of
 * stroke widths through it.
 *
 * `MIN_SECTOR_DEGREES` is the smallest sector that reads as a *region* rather
 * than a thick line: half a stroke belongs to each of the two boundary lines
 * that bound it, and two clear strokes of daylight between them is what makes
 * the wedge visible at all - three stroke widths in total, which is generous
 * enough to allow a disc cut into 39 equal parts.
 */
export const DISC_RIM_POINTS = 72;
export const FITTED_DISC_RADIUS = (FIGURE_BOX - 2 * FIGURE_PADDING) / 2;
export const DEGREES_PER_RIM_PX =
  360 / (2 * Math.PI * (FITTED_DISC_RADIUS / FIGURE_BOX) * REPORT_BOX_PX);
export const MIN_SECTOR_DEGREES = DEGREES_PER_RIM_PX * REPORT_STROKE_PX * 3;

/**
 * About what one character costs, as a share of the type size.
 *
 * **Before tuning this - or `FIGURE_PADDING`, or `FIGURE_PRECISION` - know what
 * the three of them are holding up.** A kind that budgets for label ink solves
 * for it *exactly*, and exact leaves nothing over: in `bar`, at the tightest
 * legal shape, the binding label's ink lands 0.24 units inside the box with a
 * one-character axis and **0.01 units** inside it with a six-character one,
 * where one character is 9.28 units wide. The entire clearance is a single
 * `10 ** -FIGURE_PRECISION` term in `plotShape`, and it is there to absorb
 * `fit`'s rounding rather than to leave room.
 *
 * So any of the three moving a little turns "just inside" into "just outside",
 * in a 64px thumbnail, on content that validates - and neither the type system
 * nor any per-case test would notice. The sweep at the bottom of
 * `bar-kind.test.ts` is the only alarm wired to it, which is the argument for a
 * kind that places labels having one of its own.
 */
export const CHAR_RATIO = 0.58;

/** Ink height for digits and capitals, as a share of the type size. */
export const INK_RATIO = 0.72;

/** Daylight between two stacked lines of it, so a column of numbers reads as one. */
export const LINE_CLEARANCE = 1.15;

/**
 * `LINE_CLEARANCE`'s sideways twin: clear air between two labels laid out
 * *along* a rule, in characters - what a space between them would be worth.
 * Two labels closer than their own half-widths plus this are touching.
 *
 * Here rather than in a kind for the reason stated at the top of this file:
 * it is a fact about type, not about number lines. `number-line` spaces the
 * numbers under its ticks by it and `grid` spaces the names under its columns
 * by it, and two kinds ruling numbers along a line must not disagree about how
 * far apart they have to be - which is exactly what a private copy in each
 * would have allowed the first time one of them was tuned.
 */
export const LABEL_DAYLIGHT = 0.5;

/**
 * What `fit` leaves a drawing inside `FIGURE_BOX` once its padding is taken off
 * both sides. Derived from the two constants rather than restated, so a change
 * to either cannot leave a kind measuring against a box that no longer exists.
 */
export const DRAWN_SPAN = FIGURE_BOX - 2 * FIGURE_PADDING;

/**
 * The three above as shares of a drawing's own span - which is what makes them
 * usable at all. Lay a figure out in a frame whose larger side is exactly 1 and
 * the fit's scale is exactly `DRAWN_SPAN`, so a report-scale label is a
 * *constant* fraction of your own geometry and can be compared against your own
 * gaps with no knowledge of the fit. Measured any other way the conversion is
 * circular: the span depends on the margins, which depend on the label size in
 * span-shares, which depends on the span.
 */
export const CHAR_SHARE = (REPORT_LABEL_SIZE * CHAR_RATIO) / DRAWN_SPAN;
export const INK_SHARE = (REPORT_LABEL_SIZE * INK_RATIO) / DRAWN_SPAN;
/** Centre to centre, for two labels stacked one above the other. */
export const PITCH_SHARE = INK_SHARE * LINE_CLEARANCE;

/** How wide a label of this many characters is drawn in a report, in fitted units. */
export function reportLabelWidth(characters: number): number {
  return characters * REPORT_LABEL_SIZE * CHAR_RATIO;
}
