import { createHash } from 'node:crypto';
import { compareYearLevels } from '../src/lib/curriculum';
import type { QuestionTemplate } from '../src/lib/templates/types';
import type { ContentManifestSubject } from '../src/lib/dto';
import { mathsTemplates } from '../src/content/maths';
import { englishTemplates } from '../src/content/english';

/**
 * The shipped corpus, in the order `allTemplates` has always had: maths K-6,
 * then english K-6.
 *
 * **This module may not import `../src/content/catalog`.** The catalog is
 * sourced from what this generates, so importing it would close a cycle and
 * make a first run against an empty `src/content/packs/` impossible.
 */
export const CORPUS: readonly QuestionTemplate[] = [...mathsTemplates, ...englishTemplates];

/** Two spaces, because the pack diff is how a content change gets reviewed. */
const INDENT = 2;

/** Twelve hex characters of sha256 - short enough to read, long enough never to collide. */
function hash(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);
}

const unique = <T>(items: readonly T[]): T[] => [...new Set(items)];

/**
 * Every pack and the manifest, as the exact bytes that get committed and
 * served. Returning bytes rather than objects is what lets the drift test
 * compare against the files on disk without re-deciding how to format them.
 */
export function buildPacks(templates: readonly QuestionTemplate[]): Map<string, string> {
  const files = new Map<string, string>();

  const subjects: ContentManifestSubject[] = unique(templates.map((t) => t.subject))
    .sort()
    .map((subject) => {
      const forSubject = templates.filter((t) => t.subject === subject);
      const levels = unique(forSubject.map((t) => t.level))
        .sort(compareYearLevels)
        .map((level) => {
          const forLevel = forSubject.filter((t) => t.level === level);
          // The hash is over the pack without its own version, which would
          // otherwise have to contain itself.
          const body = { subject, level, templates: forLevel };
          const etag = hash(JSON.stringify(body, null, INDENT));

          files.set(
            `${subject}.${level}.json`,
            `${JSON.stringify({ version: etag, ...body }, null, INDENT)}\n`,
          );

          return {
            level,
            topics: unique(forLevel.map((t) => t.topic)).sort(),
            templateCount: forLevel.length,
            etag,
          };
        });

      return { subject, levels };
    });

  const version = hash(
    subjects.flatMap((s) => s.levels.map((l) => `${s.subject}.${l.level}:${l.etag}`)).join('\n'),
  );

  files.set('manifest.json', `${JSON.stringify({ version, subjects }, null, INDENT)}\n`);

  return files;
}
