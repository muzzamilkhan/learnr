import { describe, expectTypeOf, it } from 'vitest';
import type { AttemptResult, SpeedOutcome } from '@/lib/dto';

/**
 * `reviveDates` is gone from this path, so a `Date` anywhere in either shape -
 * required or optional - would arrive as a string and every caller would be
 * quietly wrong.
 *
 * A first version of this check used a hand-rolled `NoDates<T> extends never`
 * test, which was toothless: a mapped object type is never itself `never`
 * however its properties resolve, so the check passed for every object
 * regardless of whether a `Date` was in it, and the only thing standing guard
 * was the literal's own ordinary structural assignability - which a missing
 * *optional* field cannot fail, the exact case this exists to catch.
 *
 * `ReplaceDate<T>` instead walks `T` and swaps every `Date` it finds for
 * `never`, homomorphically - so it preserves each property's optional and
 * readonly modifiers rather than restating them, which is what makes it catch
 * an optional `Date` too: `Date | undefined` distributes to `never |
 * undefined`, i.e. `undefined`, a different type from the original. Comparing
 * `T` against `ReplaceDate<T>` with `toEqualTypeOf` is then a real assertion:
 * it holds only while no branch of `T` ever resolved to `Date`, and it is
 * checked by the compiler, not at runtime - `npm run typecheck` is what turns
 * red, not `npm test`.
 */
type ReplaceDate<T> = T extends Date
  ? never
  : T extends readonly (infer U)[]
    ? ReplaceDate<U>[]
    : T extends object
      ? { [K in keyof T]: ReplaceDate<T[K]> }
      : T;

describe('browser-api response shapes', () => {
  it('carries no Date anywhere, required or optional, because nothing revives one any more', () => {
    expectTypeOf<AttemptResult>().toEqualTypeOf<ReplaceDate<AttemptResult>>();
    expectTypeOf<SpeedOutcome>().toEqualTypeOf<ReplaceDate<SpeedOutcome>>();
  });
});
