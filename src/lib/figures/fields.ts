import { evaluate, type Scope, type Value } from '../expr';
import type { Rng } from '../rng';
import type { Expr } from './types';

/**
 * Turning an authored expression into something drawable, twice over - once for
 * the builder and once for the validator - because those two readings of the
 * same field are the one place this folder could quietly disagree with itself.
 *
 * `readField` is the builder's reading: absent, malformed and unbound all come
 * back as nothing, and the kind draws a fallback. `fieldReader` is the
 * validator's, and it says in words what the builder swallowed. Every kind
 * takes its `FieldReader` from `figureIssues` rather than writing its own, so
 * eleven kinds report a missing field, an unevaluable one and a wrongly typed
 * one in identical wording - a kind that invented its own phrasing would make
 * an author learn the same mistake eleven times.
 */

/**
 * Evaluate one field and say what went wrong with it: absent when it is
 * required, unevaluable, or the wrong type. Returns the value only when it is
 * the type asked for, so a caller can go on to judge the value itself.
 *
 * **It reports its own findings and hands back nothing else.** The array it
 * writes into belongs to `figureIssues`, which a kind module cannot reach - so
 * a module's own `issues` can only ever return the judgements it made about
 * values that read back clean, and the two can neither be forgotten nor
 * reported twice.
 */
export type FieldReader = (
  expr: Expr | undefined,
  label: string,
  expected: 'number' | 'boolean' | 'string',
  required?: boolean,
) => Value | undefined;

/** A `FieldReader` bound to the scope it evaluates in and the list it reports into. */
export function fieldReader(scope: Scope, into: string[]): FieldReader {
  return (expr, label, expected, required = false) => {
    if (expr === undefined || (typeof expr === 'string' && expr.trim() === '')) {
      if (required) into.push(`${label} must be a non-empty expression string`);
      return undefined;
    }
    if (typeof expr !== 'string') {
      into.push(`${label} must be a non-empty expression string`);
      return undefined;
    }
    let value: Value;
    try {
      value = evaluate(expr, scope);
    } catch (error) {
      into.push(`${label}: ${(error as Error).message}`);
      return undefined;
    }
    if (typeof value !== expected) {
      into.push(`${label}: expected ${expected}, got ${typeof value} (${JSON.stringify(value)})`);
      return undefined;
    }
    // **The one place the two halves of this module could disagree.** `NaN` is
    // a number to `typeof` and fails every comparison, so a `degrees` of `x / y`
    // with both zero passed both the type check and the range check and was
    // reported clean - while `buildFigure`, which needs a number it can draw,
    // threw it away and jittered an angle instead. That is the anchoring
    // failure this module exists to prevent, arriving through the door marked
    // "validated": a template asking whether an angle is acute, drawing an
    // angle unrelated to its own answer, differently on every seed. The
    // expression language does not guard division, so `0 / 0`, `mod(x, 0)` and
    // `sqrt(-1)` all arrive here looking like numbers.
    if (expected === 'number' && !Number.isFinite(value)) {
      into.push(`${label}: ${String(value)} is not a number that can be drawn,` +
        ` so it would be ignored and a jittered value drawn instead`);
      return undefined;
    }
    return value;
  };
}

/** Evaluate a field, or nothing at all: absent, malformed and unbound all read the same here. */
export function readField(expr: Expr | undefined, scope: Scope): Value | undefined {
  if (typeof expr !== 'string' || expr.trim() === '') return undefined;
  try {
    return evaluate(expr, scope);
  } catch {
    return undefined;
  }
}

export function numberValue(value: Value | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** The same reading of truth the expression language itself uses. */
export function truthy(value: Value | undefined): boolean {
  if (value === undefined) return false;
  return typeof value === 'boolean' ? value : Boolean(value);
}

/** A number somewhere in [low, high) - what omitting an optional field asks for. */
export function jitter(rng: Rng, low: number, high: number): number {
  return low + rng.next() * (high - low);
}

export function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}
