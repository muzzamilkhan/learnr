import type { Expr } from '@/lib/templates/types';

/**
 * Name of the day `i` steps around the week, where `i` is an expression giving
 * 0 for Monday. Written once because the day questions need four of them each:
 * the answer plus its neighbours as distractors.
 */
export const dayName = (i: Expr): Expr =>
  `${i} == 0 ? 'Monday' : ${i} == 1 ? 'Tuesday' : ${i} == 2 ? 'Wednesday' : ` +
  `${i} == 3 ? 'Thursday' : ${i} == 4 ? 'Friday' : ${i} == 5 ? 'Saturday' : 'Sunday'`;

/** Name of the polygon with `i` sides, for `i` an expression giving 3 to 6. */
export const shapeName = (i: Expr): Expr =>
  `${i} == 3 ? 'triangle' : ${i} == 4 ? 'square' : ${i} == 5 ? 'pentagon' : 'hexagon'`;

/**
 * How many sides the polygon named by the expression `s` has, across the whole
 * shape vocabulary `src/lib/figures` can draw. Written once because the picture
 * questions want the same count three ways: as the answer to "how many sides",
 * as the answer to "how many corners" - a polygon has exactly one corner per
 * side - and as the number a true/false claim is checked against. Anything that
 * is not a named triangle or a 5-to-8-sided polygon is a quadrilateral, which
 * is the entire rest of that vocabulary.
 */
export const sideCount = (s: Expr): Expr =>
  `${s} == 'equilateral' || ${s} == 'isosceles' || ${s} == 'scalene' || ` +
  `${s} == 'right-triangle' ? 3 : ${s} == 'pentagon' ? 5 : ${s} == 'hexagon' ? 6 : ` +
  `${s} == 'heptagon' ? 7 : ${s} == 'octagon' ? 8 : 4`;

/**
 * The everyday name of the solid `i` steps along the short list a Year 1
 * naming question draws from - cube, sphere, cone, cylinder, pyramid. Written
 * once because that question needs four of them at a time: the answer and
 * three distractors, stepped round the list so no two ever coincide. The
 * figure's own vocabulary calls the last one `square-pyramid`; a six-year-old
 * calls it a pyramid, and the button is what they read.
 */
export const solidWord = (i: Expr): Expr =>
  `${i} == 0 ? 'cube' : ${i} == 1 ? 'sphere' : ${i} == 2 ? 'cone' : ` +
  `${i} == 3 ? 'cylinder' : 'pyramid'`;

/** One `'1'` per part, comma-joined, as an expression-language string literal. */
const ones = (count: number): Expr => `'${Array.from({ length: count }, () => '1').join(',')}'`;

/** `count` names, the first `shaded` of them the shaded group. */
const fills = (count: number, shaded: number): Expr =>
  `'${Array.from({ length: count }, (_, k) => (k < shaded ? 'a' : 'b')).join(',')}'`;

/**
 * A spinner cut into `n` equal parts, as the `sectors` list that kind wants.
 *
 * **The expression language has no arrays and nothing to repeat a value
 * with**, so a list of `n` equal parts cannot be built from `n`: it has to be
 * written out per candidate count. `counts` is the closed set of part counts
 * the template draws `n` from, and the chain of ternaries this returns covers
 * exactly those - which is why the same list has to be passed here and to
 * `shadedFills` below.
 */
export const equalSectors = (n: Expr, counts: readonly number[]): Expr =>
  counts
    .slice(0, -1)
    .reduceRight(
      (rest, count) => `${n} == ${count} ? ${ones(count)} : ${rest}`,
      ones(counts[counts.length - 1]),
    );

/**
 * The matching `fills` list: `n` equal parts with `s` of them shaded.
 *
 * A figure has exactly two appearances and the **first-named group is the
 * shaded one**, so `s` shaded parts is `s` names of one kind followed by the
 * rest of another. Where `s` reaches `n` there is only one group and the whole
 * disc is shaded - which is what a "will it stop on a shaded part?" question
 * needs a picture of, and the reason an *un*shaded whole disc cannot be drawn
 * at all.
 */
export const shadedFills = (n: Expr, s: Expr, counts: readonly number[]): Expr => {
  const forCount = (count: number): Expr =>
    Array.from({ length: count }, (_, k) => k + 1)
      .slice(0, -1)
      .reduceRight(
        (rest, shaded) => `${s} == ${shaded} ? ${fills(count, shaded)} : ${rest}`,
        fills(count, count),
      );

  return counts
    .slice(0, -1)
    .reduceRight(
      (rest, count) => `${n} == ${count} ? (${forCount(count)}) : ${rest}`,
      `(${forCount(counts[counts.length - 1])})`,
    );
};
