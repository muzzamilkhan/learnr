import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { allTemplates } from '../src/content/catalog';
import { allSets, buildDigestFiles } from './fixtures/digests';

const DIGEST_DIR = 'fixtures/digests';

/**
 * Writes the committed digests.
 *
 * **Running this is a deliberate act.** The drift guard exists to make an
 * unintended engine change red, and regenerating is the wrong reflex for a red
 * build - it is what would turn the suite into a rubber stamp. Regenerate only
 * in a commit that says why, and never in the same commit as the engine change
 * itself.
 */
async function main(): Promise<void> {
  const files = buildDigestFiles(allSets(allTemplates));
  await mkdir(DIGEST_DIR, { recursive: true });
  for (const [name, body] of files) await writeFile(join(DIGEST_DIR, name), body, 'utf8');
  console.log(`Wrote ${files.size} files to ${DIGEST_DIR}`);
}

main();
