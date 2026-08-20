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
 * `bar-kind.ts`'s `MAX_LABEL_CHARS`) has to be measured against something
 * rather than guessed.
 */
export const PLAY_LABEL_SIZE = 7;

/** About what one character costs, as a share of the type size. */
export const CHAR_RATIO = 0.58;

/** Ink height for digits and capitals, as a share of the type size. */
export const INK_RATIO = 0.72;

/** Daylight between two stacked lines of it, so a column of numbers reads as one. */
export const LINE_CLEARANCE = 1.15;

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
