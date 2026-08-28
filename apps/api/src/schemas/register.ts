import { z } from 'zod';
import * as common from './common.js';
import * as account from './account.js';
import * as play from './play.js';
import * as dto from './dto.js';

/**
 * Every boundary shape, named once in `components/schemas`.
 *
 * Without this the contract inlines every schema at every use site, and a
 * generator has nothing to share: `ChildProfile` in `GET /children` and the
 * same shape in `GET /children/viewable` become two unrelated Swift types with
 * no conversion between them, each buried under a name like
 * `Operations.listChildren.Output.Ok.Body.jsonPayload`. That is what `learnr#4`
 * closed for the *contract* and left open for the *client* - iOS was asked to
 * delete its hand-transcribed models, and against an inlined document the
 * generated replacements would have been worse than the models they replaced.
 *
 * **The names are derived from the export names, so there is no second list.**
 * A list of ids written out here would be free to disagree with the schemas it
 * names, and the failure would be a shape quietly dropping out of
 * `components/schemas` and re-inlining itself - visible in the generated client
 * and nowhere else. Deriving them means adding a schema names it, and the
 * guard in `test/openapi.test.ts` fails the moment one is not.
 *
 * The cost of deriving is that a variable rename is a *contract* rename, which
 * would break a generated client's type names. That is deliberately not hidden:
 * `contract/openapi.yaml` is committed and the drift test compares against it,
 * so a rename lands in a reviewable diff rather than in somebody's build.
 *
 * **The sort is load-bearing, and not a tidiness.** Registration order is the
 * order `components/schemas` comes out in, and the obvious way to get these -
 * `Object.entries` over the imported namespaces - does not have one order. A
 * real ES module namespace returns its keys *alphabetically*, because that is
 * what the spec says [[OwnPropertyKeys]] does; a bundler or a test transform
 * hands back a plain object, whose keys come out in *source* order. So the
 * document differed between `npm run contract` under tsx, the same code under
 * vitest, and the esbuild bundle that actually ships - three orders for one
 * contract, and the drift test catching it only by luck of which ran first.
 * Sorting here means the order is ours rather than the loader's. It is the same
 * failure `learnr` fixed in the fixture harvest for `L8`, arriving from the
 * other end.
 */
export function registerComponents(): void {
  const schemas = Object.entries({ ...common, ...account, ...play, ...dto }).sort(
    ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0),
  );

  for (const [name, value] of schemas) {
    if (!name.endsWith('Schema')) continue;
    if (!(value instanceof z.ZodType)) continue;

    const id = name.slice(0, -'Schema'.length);
    z.globalRegistry.add(value, { id: id[0].toUpperCase() + id.slice(1) });
  }
}
