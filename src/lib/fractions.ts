/**
 * Which slashes in a question are fractions, and what is on either side of
 * them.
 *
 * Pure, like the rest of `lib`: this decides what a piece of text *is*, and
 * `src/components/maths-text.tsx` decides how to draw it - the same split
 * `src/lib/figures/` and `src/components/diagram.tsx` already make.
 *
 * **Every `/` in the shipped content is a fraction, because division is
 * written `÷`.** That claim used to live in a comment in
 * `src/lib/speech/narration.ts`; it is a test in `src/content/catalog.test.ts`
 * now, over every rendered prompt, hint, answer and choice.
 *
 * `narration.ts` reads the rule from here rather than keeping its own copy.
 * The spoken form and the drawn form must not be able to disagree about which
 * slashes are fractions, and two regexes in two files is exactly how they
 * would - one tuned, the other not, and nothing on screen to say so.
 */

/** A run of plain text, or a fraction to be drawn with a bar. */
export type MathsSegment =
  | { kind: 'text'; text: string }
  | { kind: 'fraction'; numerator: string; denominator: string };

/**
 * A digit run or the gap marker, a slash, a digit run.
 *
 * The gap counts as a numerator so "?/9" is a fraction with its top missing -
 * which is what `maths.4.fractions.equivalent` and the four add/subtract
 * templates are actually asking. Spaces around the slash are allowed, because
 * a template is free to write one.
 */
const FRACTION_SOURCE = String.raw`(\d+|\?)\s*\/\s*(\d+)`;

/**
 * A fresh matcher each time.
 *
 * A `/g` regex carries `lastIndex` between uses, so a single shared instance
 * would have two modules stepping on each other's position - and the failure
 * is a fraction silently skipped rather than an error.
 */
export const fractionPattern = (): RegExp => new RegExp(FRACTION_SOURCE, 'g');

/**
 * Break a rendered prompt, hint, answer or choice into the pieces a renderer
 * draws. Text with no fraction in it comes back as a single `text` segment, so
 * a caller never needs a special case for the ordinary question.
 *
 * No empty segments: a text run is pushed only when there is text in it. The
 * one exception is an empty input, which has to come back as *something* for a
 * caller to map over.
 */
export function splitFractions(text: string): MathsSegment[] {
  const segments: MathsSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(fractionPattern())) {
    const at = match.index;
    if (at > cursor) segments.push({ kind: 'text', text: text.slice(cursor, at) });
    segments.push({ kind: 'fraction', numerator: match[1], denominator: match[2] });
    cursor = at + match[0].length;
  }

  const tail = text.slice(cursor);
  if (tail !== '' || segments.length === 0) segments.push({ kind: 'text', text: tail });

  return segments;
}
