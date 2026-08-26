import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseYearLevel, YEAR_LEVELS } from '@learnr/core/curriculum';
import { emptyProfile } from '@learnr/core/analytics/profile';
import { createRng } from '@learnr/core/rng';
import { allTemplates, listSubjects } from '@learnr/core/content/catalog';

describe('@learnr/core', () => {
  it('exports the curriculum vocabulary', () => {
    expect(YEAR_LEVELS).toEqual(['K', '1', '2', '3', '4', '5', '6']);
    expect(parseYearLevel('03')).toBe('3');
    expect(parseYearLevel('nope')).toBeNull();
  });

  it('exports an empty learner profile', () => {
    expect(emptyProfile().skills).toEqual([]);
  });

  it('exports a deterministic rng', () => {
    const first = createRng('seed').next();
    const second = createRng('seed').next();
    expect(first).toBe(second);
  });

  // The content tree is the part of the engine that reached for learnr's `@/`
  // alias. A package has no alias, so this is the case that proves the export
  // map resolves for a consumer standing outside this repo.
  it('exports the content catalog', () => {
    expect(allTemplates.length).toBeGreaterThan(0);
    expect(listSubjects().map((subject) => subject.subject)).toContain('maths');
  });
});

// A `@/...` import resolves only under learnr's own alias, so it is invisible
// here and fatal in any repo that consumes this package.
//
// **The exemption list is gone, and that is the point.** It held the five impure
// modules the API extraction was going to delete, and it did: `src/lib` and
// `src/content` are now exactly the pure engine, with nothing in either that
// touches React, the network, the clock or the database. The web app's own two
// impure files - `src/api.ts` and `src/auth-db.ts` - sit outside both, which is
// why they need no exemption rather than having been given one.
describe('the package is self-contained', () => {
  it('reaches for no aliased import', () => {
    const root = resolve(import.meta.dirname, '../../../src');
    const scanned = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.ts'))
      .filter((entry) => entry.startsWith('lib/') || entry.startsWith('content/'));

    const offenders = scanned.filter((entry) =>
      readFileSync(join(root, entry), 'utf8').includes("from '@/"),
    );

    expect(scanned.length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
