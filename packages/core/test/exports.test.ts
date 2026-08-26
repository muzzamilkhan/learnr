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
// here and fatal in any repo that consumes this package. The five impure files
// are exempt because the API extraction deletes them; the list should shrink to
// nothing, never grow.
describe('the package is self-contained', () => {
  const IMPURE = ['lib/db.ts', 'lib/accounts.ts', 'lib/records.ts', 'lib/sharing.ts', 'lib/speed-records.ts'];

  it('reaches for no aliased import', () => {
    const root = resolve(import.meta.dirname, '../../../src');
    const scanned = readdirSync(root, { recursive: true, encoding: 'utf8' })
      .filter((entry) => entry.endsWith('.ts'))
      .filter((entry) => entry.startsWith('lib/') || entry.startsWith('content/'))
      .filter((entry) => !IMPURE.includes(entry));

    const offenders = scanned.filter((entry) =>
      readFileSync(join(root, entry), 'utf8').includes("from '@/"),
    );

    expect(scanned.length).toBeGreaterThan(50);
    expect(offenders).toEqual([]);
  });
});
