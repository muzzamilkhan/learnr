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
