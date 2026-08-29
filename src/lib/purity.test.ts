import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// `src/lib` and `src/content` are "all logic lives in src/lib as pure
// functions" made checkable: nothing in either touches React, Next, Prisma or
// the impure `src/server` modules that hold the database connection and the
// route handlers. This is what `packages/core/test/exports.test.ts` used to
// guard from the outside, back when the engine was published through a
// symlinked package and a `@/` import inside it would have resolved to the
// wrong tree for a consumer. There is no package boundary any more - the `@/`
// alias is legal here again - but the purity rule the guard stood beside is
// unrelated to that boundary and does not get to lapse with it.
describe('src/lib and src/content stay pure', () => {
  it('import neither React, Next, Prisma, nor src/server', () => {
    const root = resolve(import.meta.dirname, '..');
    const scanned = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.ts') || entry.endsWith('.tsx'))
      .filter((entry) => entry.startsWith('lib/') || entry.startsWith('content/'));

    const forbidden = [
      /from ['"]react['"]/,
      /from ['"]react-dom/,
      /from ['"]next(\/|['"])/,
      /from ['"]@prisma\/client['"]/,
      /from ['"].*\/server\//,
      /from ['"]@\/server\//,
    ];

    const offenders = scanned.filter((entry) => {
      const source = readFileSync(join(root, entry), 'utf8');
      return forbidden.some((pattern) => pattern.test(source));
    });

    expect(scanned.length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
