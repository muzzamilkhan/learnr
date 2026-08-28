/**
 * How long a question is allowed to get, and the stand-in it is sized against.
 *
 * The play screen sets every question at one size, whatever it says
 * (`docs/superpowers/specs/2026-08-22-question-viewport-design.md`). A single
 * size can only ever be the worst case's size, so the only lever on how big it
 * is is how long the longest prompt is allowed to be - which is what this cap
 * is, and why it is enforced over the shipped content rather than intended.
 */

/**
 * The longest a rendered prompt may be.
 *
 * Measured rather than chosen: over 1,000 draws of each of the 505 shipped
 * templates, the longest prompt is 100 characters, the median is 46 and the
 * shortest is 14.
 *
 * **105 and not 100.** A cap with no headroom goes red the first time a number
 * *inside* an existing template grows a digit, which is a template being
 * edited rather than a template getting too long. Five characters of slack
 * costs under 3% of the rendered size - not visible - where a suite that goes
 * red for a reason nobody meant is.
 *
 * **It was 140, and the 35 characters came off the content rather than off the
 * cap.** Twenty-three templates were reworded, all of them chance, measurement
 * and data word problems that named a quantity twice ("A tin weighs the same
 * as 17 blocks. A jar weighs the same as 4 blocks.") plus four English frames
 * that wrapped a sentence variable in a longer question than the sentence.
 * Nothing was cut that the question needed: the arithmetic, the units and the
 * options offered in the prompt are all unchanged.
 *
 * **The tail is where the whole gain is, which is why the pass stopped where
 * it did.** A fixed box takes area proportional to the character count times
 * the square of the size, so the size a fit lands on goes as `1/sqrt(cap)`:
 * 140 to 105 is about 15% bigger type, and grinding on to a cap of 95 would
 * have bought 5% more for twice the rewriting and a good deal more damage to
 * the prose. The median prompt is 46 characters and was never the problem.
 */
export const MAX_PROMPT_CHARS = 105;

/**
 * The string the prompt's size is searched against, exactly `MAX_PROMPT_CHARS`
 * long.
 *
 * `Prompt` binary-searches for the largest whole pixel size at which *this*
 * fits its box, then sets the real prompt at that size - which is what makes
 * every question in the same box the same size. So this is a stand-in for the
 * worst case, and its job is to be **at least as wide** as any real prompt of
 * the same length.
 *
 * That is why it is prose and not a repeated character. A sentinel of `M`s
 * measures a width no real prompt has and would shrink every question on the
 * screen to pay for it; a sentinel of `l`s, or one unbroken word, measures too
 * little and a real prompt would clip. Ordinary words with a couple of runs of
 * digits is what the content is made of, so it is what the stand-in is made of.
 *
 * It never appears on screen - it is measured in a hidden element and thrown
 * away - so it does not have to mean anything, only to be shaped like a
 * question.
 */
export const PROMPT_SENTINEL =
  'A spinner stopped on red 26 times, blue 37 and green 22. Which colour is this one most likely to stop on?';
