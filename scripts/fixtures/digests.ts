import { compareYearLevels } from '../../src/lib/curriculum';
import type { QuestionTemplate } from '../../src/lib/templates/types';
import { digest } from './canonical';
import { corpusCases, DRAWS } from './corpus';
import { exprSet } from './expr';
import { gradingSet } from './grading';
import { profileSet } from './profile';

/** Two spaces, because the digest diff is how an engine change gets reviewed. */
const INDENT = 2;

/**
 * One named collection of hashes. Every digest file has this shape - corpus
 * years, the expression sets, grading and profile folding alike - so a Swift
 * client reads one format rather than four.
 */
export interface DigestSet {
  name: string;
  /** Group name to twelve hex characters. A group is a template id or a scenario. */
  groups: Map<string, string>;
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

export function corpusSets(templates: readonly QuestionTemplate[]): DigestSet[] {
  const sets: DigestSet[] = [];
  for (const subject of unique(templates.map((t) => t.subject)).sort()) {
    const forSubject = templates.filter((t) => t.subject === subject);
    for (const level of unique(forSubject.map((t) => t.level)).sort(compareYearLevels)) {
      const groups = new Map<string, string>();
      for (const template of forSubject.filter((t) => t.level === level)) {
        groups.set(template.id, digest(corpusCases(template)));
      }
      sets.push({ name: `${subject}.${level}`, groups });
    }
  }
  return sets;
}

/**
 * Every set the digests cover, in file order.
 *
 * **This is the one place the list is written.** `build-fixtures.ts`,
 * `emit-fixtures.ts` and the drift guard all call it, so a set added here
 * reaches all three at once. Written out in three places instead,
 * `emit-fixtures.ts` would stamp an emitted corpus with a manifest version
 * computed over a different set list than the committed manifest covers - and
 * the whole point of that stamp is that a stale vendored copy names itself.
 */
export function allSets(templates: readonly QuestionTemplate[]): DigestSet[] {
  return [...corpusSets(templates), exprSet(templates), gradingSet(templates), profileSet()];
}

/**
 * Every digest file and the manifest, as the exact bytes that get committed.
 *
 * Returning bytes rather than objects is what lets the drift guard compare
 * against the files on disk without re-deciding how to format them - the same
 * reason `buildPacks` does it.
 */
export function buildDigestFiles(sets: readonly DigestSet[]): Map<string, string> {
  const files = new Map<string, string>();
  const versions: { set: string; version: string }[] = [];

  for (const set of sets) {
    const groups = Object.fromEntries([...set.groups].sort(([a], [b]) => (a < b ? -1 : 1)));
    // The version is over the body without itself, which it would otherwise
    // have to contain.
    const body = { set: set.name, draws: DRAWS, groups };
    const version = digest([JSON.stringify(body, null, INDENT)]);
    files.set(`${set.name}.json`, `${JSON.stringify({ version, ...body }, null, INDENT)}\n`);
    versions.push({ set: set.name, version });
  }

  const manifest = {
    sets: sets.map((s, i) => ({
      set: s.name,
      groups: s.groups.size,
      version: versions[i].version,
    })),
  };
  files.set(
    'manifest.json',
    `${JSON.stringify(
      { version: digest(versions.map((v) => `${v.set}:${v.version}`)), ...manifest },
      null,
      INDENT,
    )}\n`,
  );

  return files;
}
