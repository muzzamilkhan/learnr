import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRng } from '../src/lib/rng';
import { generateQuestion } from '../src/lib/templates/generate';
import { allTemplates } from '../src/content/catalog';
import { DRAWS, seedFor } from './fixtures/corpus';
import { allSets, buildDigestFiles } from './fixtures/digests';

const CORPUS_DIR = 'fixtures/corpus';

/**
 * Writes the full corpus - about 110 MB - which is never committed. The same
 * data measures 37.7 MB without the indentation; this indents two spaces
 * because the corpus exists to be read.
 *
 * It carries the manifest version of the run that produced it, so a copy
 * vendored into another repository names itself as stale rather than passing
 * quietly against an engine that has moved on.
 *
 * Takes an optional substring so a single failing template can be read without
 * rebuilding all of it: `npm run fixtures:emit -- angles.larger-angle`.
 */
async function main(): Promise<void> {
  const filter = process.argv[2];
  const templates = filter ? allTemplates.filter((t) => t.id.includes(filter)) : allTemplates;
  if (templates.length === 0) {
    console.error(`No template id contains ${JSON.stringify(filter)}`);
    process.exitCode = 1;
    return;
  }

  const version = JSON.parse(buildDigestFiles(allSets(allTemplates)).get('manifest.json')!).version;
  await mkdir(CORPUS_DIR, { recursive: true });

  const bySet = new Map<string, unknown[]>();
  for (const template of templates) {
    const key = `${template.subject}.${template.level}`;
    const cases = bySet.get(key) ?? [];
    for (let draw = 0; draw < DRAWS; draw++) {
      const seed = seedFor(template.id, draw);
      const q = generateQuestion(template, createRng(seed));
      cases.push({
        templateId: template.id,
        seed,
        prompt: q.prompt,
        answer: q.answer,
        answerType: q.answerType,
        ...(q.choices ? { choices: q.choices } : {}),
        ...(q.hint !== undefined ? { hint: q.hint } : {}),
        vars: q.vars,
        ...(q.figure ? { figure: q.figure } : {}),
      });
    }
    bySet.set(key, cases);
  }

  for (const [set, cases] of bySet) {
    await writeFile(
      join(CORPUS_DIR, `${set}.json`),
      `${JSON.stringify({ version, set, draws: DRAWS, cases }, null, 2)}\n`,
      'utf8',
    );
  }

  console.log(`Wrote ${bySet.size} files to ${CORPUS_DIR} (${templates.length} templates)`);
}

main();
