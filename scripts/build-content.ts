import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateTemplates } from '../src/lib/templates/validate';
import { buildPacks, CORPUS } from './content-packs';

const PACK_DIR = 'src/content/packs';

/**
 * Generates the content packs from the TypeScript literals.
 *
 * **It validates before it writes.** One invalid template and nothing is
 * written, so emitting a broken pack is impossible rather than merely tested
 * against afterwards.
 */
async function main(): Promise<void> {
  const check = validateTemplates([...CORPUS]);
  if (!check.valid) {
    console.error(`Refusing to write: ${check.errors.length} problem(s) in the templates.`);
    for (const error of check.errors.slice(0, 20)) console.error(`  ${error}`);
    process.exitCode = 1;
    return;
  }

  const files = buildPacks(CORPUS);
  await mkdir(PACK_DIR, { recursive: true });
  for (const [name, body] of files) {
    await writeFile(join(PACK_DIR, name), body, 'utf8');
  }

  console.log(`Wrote ${files.size} files to ${PACK_DIR}`);
}

main();
