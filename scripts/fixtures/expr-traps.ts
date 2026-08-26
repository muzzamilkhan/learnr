import type { Scope, Value } from '../../src/lib/expr';

/**
 * Expressions whose expected values were written by a human, not read off the
 * engine.
 *
 * Everywhere else in this suite the engine is the oracle and a fixture proves
 * *agreement* - a bug here would be faithfully reproduced in Swift and both
 * sides would stay green. This file is the exception, and it is deliberate. The
 * cases below are the places where idiomatic Swift silently diverges from the
 * JavaScript the content was authored against, and where this repo has no
 * coverage at all: `expr.test.ts` asserts `round(2.5)` is `3` and nothing on the
 * other side of zero, `^` is tested only for right-associativity, and `&&` is
 * never given a truthy non-boolean.
 *
 * Harvesting from content cannot reach them. The 505 shipped templates use `^`
 * **not once**, and never use `ceil`, `trunc`, `sign`, `sqrt` or `isInt`.
 *
 * **When this file and the engine disagree, decide which is wrong.** Do not
 * edit an expectation to match the engine without saying why in the commit -
 * that is the whole value of the file.
 */
export interface TrapCase {
  expr: string;
  scope?: Scope;
  expect: Value;
}

export const EXPR_TRAPS: readonly TrapCase[] = [
  // Rounding at .5, on both sides of zero. `Math.round` is half-up; Swift's
  // `rounded()` is half-away-from-zero, so the negatives are where they part.
  { expr: 'round(2.5)', expect: 3 },
  { expr: 'round(3.5)', expect: 4 },
  { expr: 'round(-2.5)', expect: -2 },
  { expr: 'round(-3.5)', expect: -3 },
  { expr: 'round(2.4)', expect: 2 },
  { expr: 'round(-2.4)', expect: -2 },

  // Unary minus against the power operator. `^` binds tighter, so this is the
  // negation of a square rather than the square of a negative.
  { expr: '-2 ^ 2', expect: -4 },
  { expr: '(-2) ^ 2', expect: 4 },
  { expr: '2 ^ 3 ^ 2', expect: 512 },
  { expr: '-2 ^ 3', expect: -8 },

  // `&&` and `||` yield booleans here, not the operand.
  { expr: '1 && 2', expect: true },
  { expr: '0 || 3', expect: true },
  { expr: '0 && 1', expect: false },
  { expr: '!0', expect: true },
  { expr: '!2', expect: false },

  // `%` follows the dividend's sign, as in JavaScript.
  { expr: '-7 % 3', expect: -1 },
  { expr: '7 % -3', expect: 1 },
  { expr: '-7 % -3', expect: -1 },
  { expr: '7 % 3', expect: 1 },

  // **`mod()` is not `%`**, which is the trap nothing else here would catch.
  // It is written `((a % b) + b) % b`, so it takes the *divisor's* sign where
  // the operator takes the dividend's, and the two disagree on every
  // mixed-sign pair. A port implementing `mod` as `%` is wrong on exactly
  // these. Verified against the engine, not assumed.
  { expr: 'mod(-7, 3)', expect: 2 },
  { expr: 'mod(7, -3)', expect: -2 },
  { expr: 'mod(-7, -3)', expect: -1 },
  { expr: 'mod(7, 3)', expect: 1 },

  // Division producing a whole number. The value is what a prompt hole
  // stringifies, and `"2.0"` there marks a correct answer wrong.
  { expr: 'x / 2', scope: { x: 4 }, expect: 2 },
  { expr: 'x / 4', scope: { x: 2 }, expect: 0.5 },
  { expr: '6 / 3', expect: 2 },
  { expr: '1 / 3', expect: 0.3333333333333333 },

  // The five functions no shipped template uses, so nothing else covers them.
  { expr: 'ceil(2.1)', expect: 3 },
  { expr: 'ceil(-2.1)', expect: -2 },
  { expr: 'trunc(2.9)', expect: 2 },
  { expr: 'trunc(-2.9)', expect: -2 },
  { expr: 'sign(-4)', expect: -1 },
  { expr: 'sign(0)', expect: 0 },
  { expr: 'sign(4)', expect: 1 },
  { expr: 'sqrt(9)', expect: 3 },
  { expr: 'sqrt(2)', expect: 1.4142135623730951 },
  { expr: 'isInt(4)', expect: true },
  { expr: 'isInt(4.5)', expect: false },
  { expr: 'isInt(-4)', expect: true },

  // Floor and abs across zero, where truncation and flooring part company.
  { expr: 'floor(-2.1)', expect: -3 },
  { expr: 'floor(2.9)', expect: 2 },
  { expr: 'abs(-3)', expect: 3 },
  { expr: 'abs(-3.5)', expect: 3.5 },

  // The remaining named functions, on the awkward arguments.
  { expr: 'gcd(12, 18)', expect: 6 },
  { expr: 'gcd(7, 13)', expect: 1 },
  { expr: 'lcm(4, 6)', expect: 12 },
  { expr: 'pow(2, 10)', expect: 1024 },
  { expr: 'pow(2, 0.5)', expect: 1.4142135623730951 },
  { expr: 'min(3, -3)', expect: -3 },
  { expr: 'max(3, -3)', expect: 3 },
  { expr: 'isEven(0)', expect: true },
  { expr: 'isEven(-2)', expect: true },
  { expr: 'isOdd(-3)', expect: true },

  // Precedence and associativity of the ordinary operators.
  { expr: '2 + 3 * 4', expect: 14 },
  { expr: '(2 + 3) * 4', expect: 20 },
  { expr: '10 - 3 - 2', expect: 5 },
  { expr: '100 / 10 / 2', expect: 5 },
  { expr: '1 + 2 > 2', expect: true },
  { expr: '2 * 3 == 6', expect: true },

  // The ternary, and strings.
  { expr: 'x > 3 ? "big" : "small"', scope: { x: 5 }, expect: 'big' },
  { expr: 'x > 3 ? "big" : "small"', scope: { x: 1 }, expect: 'small' },
  { expr: '"a" == "a"', expect: true },

  // **`+` concatenates when either side is a string**, and that is the
  // stringification trap again in a branch nothing else here reaches
  // (`evaluate.ts`'s `+` case). `renderTemplateString` stringifies every hole,
  // so a port yielding "2.0" for `x / 2` yields "n2.0" for the fourth of these.
  // Left-associativity decides whether the numbers are summed first or
  // concatenated one at a time - the last two differ for that reason alone.
  { expr: '1 + "a"', expect: '1a' },
  { expr: '"a" + 1', expect: 'a1' },
  { expr: '2 + "0"', expect: '20' },
  { expr: '"n" + (x / 2)', scope: { x: 4 }, expect: 'n2' },
  { expr: '1 + 2 + "a"', expect: '3a' },
  { expr: '"a" + 1 + 2', expect: 'a12' },

  // Float accumulation, which both engines must get wrong identically.
  { expr: '0.1 + 0.2', expect: 0.30000000000000004 },
  { expr: '0.1 * 3', expect: 0.30000000000000004 },
];
