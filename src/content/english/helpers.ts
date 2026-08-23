import type { Expr } from '@/lib/templates/types';

/**
 * A closed list of words a template draws both its answer and its distractors
 * from. Named as a type because the same constant has to reach three places -
 * the `pick` that chooses the target, the `answer`, and the `distractors` - and
 * three literals written out three times is the shape `equalSectors` warns
 * about in the maths helpers.
 */
export type WordBank = readonly string[];

/**
 * The word at index `i` of `bank`, as an expression-language string.
 *
 * **The expression language has no arrays and nothing to index one with**,
 * which is why `maths/helpers.ts` holds `dayName`, `shapeName`, `solidWord` and
 * `columnLetter` - each a chain of ternaries turning an integer into a word.
 * English needs many more of them and they all have the same shape, so this
 * builds the chain instead of each bank writing its own.
 *
 * **The chain ends in an unguarded else**, so an index the bank does not have
 * comes back as the *last* word rather than failing - the same caveat
 * `solidWord` and `columnLetter` carry. That is safe only because the caller's
 * own `pick` list is what produces the index: name the bank once as a constant
 * and hand that same constant to the `pick` and to this.
 */
export function wordFrom(bank: WordBank, i: Expr): Expr {
  if (bank.length === 0) throw new Error('wordFrom: empty bank');
  for (const word of bank) {
    // A bank holds plain lowercase words. Anything else - a space, a quote, an
    // apostrophe - would either break the string literal this builds or produce
    // an answer the letter pad cannot type, so it is refused at authoring time
    // rather than discovered as a question a child cannot answer.
    if (!/^[a-z]+$/.test(word)) {
      throw new Error(`wordFrom: ${JSON.stringify(word)} is not a plain lowercase word`);
    }
  }

  return bank
    .slice(0, -1)
    .reduceRight(
      (rest, word, index) => `${i} == ${index} ? '${word}' : ${rest}`,
      `'${bank[bank.length - 1]}'`,
    );
}
