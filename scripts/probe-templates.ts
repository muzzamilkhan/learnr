/**
 * Authoring loop for a content pass: validate one year's templates, then
 * measure the three things a green `validateTemplate` does not tell you -
 * the longest rendered prompt against `MAX_PROMPT_CHARS`, the answer spread
 * (which is what a true/false balance or a fixed answer rank shows up in), and
 * how often a `choice` question can be answered from its buttons alone.
 *
 * Throwaway: it exists to be run while writing templates and is not part of
 * the suite. `catalog.test.ts` and the two `leaks.test.ts` files are what hold
 * the shipped content; this only shortens the loop between writing a template
 * and finding out it is wrong.
 *
 *   npx tsx scripts/probe-templates.ts K
 *   npx tsx scripts/probe-templates.ts K maths.K.position.top-row
 */
import { mathsTemplates } from '../src/content/maths/index';
import { englishTemplates } from '../src/content/english/index';
import { validateTemplate } from '../src/lib/templates/validate';
import { generateQuestion } from '../src/lib/templates/generate';
import { createRng } from '../src/lib/rng';
import { MAX_PROMPT_CHARS } from '../src/lib/templates/limits';

const DRAWS = 3000;
const TRAIN = 1500;

const [level, only] = process.argv.slice(2);
const all = [...mathsTemplates, ...englishTemplates];
const templates = all.filter(
  (t) => (only ? t.id === only : level ? t.level === level : true) && (!only || t.id === only),
);

if (templates.length === 0) {
  console.error(`no templates matched level=${level} id=${only}`);
  process.exit(1);
}

let bad = 0;

for (const template of templates) {
  const result = validateTemplate(template);
  if (result.errors.length > 0) {
    bad++;
    console.log(`\x1b[31mINVALID\x1b[0m ${template.id}`);
    for (const e of result.errors) console.log(`        ${e}`);
    continue;
  }

  const draws = Array.from({ length: DRAWS }, (_, i) =>
    generateQuestion(template, createRng(`${template.id}-probe-${i}`)),
  );

  const longest = draws.reduce((a, q) => (q.prompt.length > a.length ? q.prompt : a), '');
  const overCap = longest.length > MAX_PROMPT_CHARS;

  // The answer spread. A true/false template wants ~50/50; a choice template
  // wants every option reachable, and the rank spread is what the anchoring
  // check reads.
  const answers = new Map<string, number>();
  for (const q of draws) answers.set(String(q.answer), (answers.get(String(q.answer)) ?? 0) + 1);
  const spread = [...answers.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([a, n]) => `${a}:${((n / draws.length) * 100).toFixed(0)}%`);

  // Where the answer sits among numerically sorted options, which is the check
  // `validateTemplate` makes over 40 draws and this makes over 3000.
  const ranks = new Map<number, number>();
  for (const q of draws) {
    if (!q.choices || q.choices.length === 0) continue;
    const numeric = q.choices.every((c) => typeof c === 'number');
    if (!numeric) continue;
    const sorted = [...(q.choices as number[])].sort((a, b) => a - b);
    ranks.set(sorted.indexOf(q.answer as number), (ranks.get(sorted.indexOf(q.answer as number)) ?? 0) + 1);
  }

  // The held-out option-set leak, the same method as `leaks.test.ts` - keyed on
  // prompt plus options where the template carries a figure, options alone
  // otherwise.
  let leak = '';
  const withChoices = draws.filter((q) => q.choices && q.choices.length > 0);
  if (withChoices.length > 0) {
    const carriesFigure = Boolean(template.figure);
    const key = (q: (typeof withChoices)[number]) => {
      const options = [...q.choices!].map(String).sort().join(' ');
      return carriesFigure ? `${q.prompt}${options}` : options;
    };
    const counts = new Map<string, Map<string, number>>();
    for (const q of withChoices.slice(0, TRAIN)) {
      const byAnswer = counts.get(key(q)) ?? new Map<string, number>();
      const a = String(q.answer);
      byAnswer.set(a, (byAnswer.get(a) ?? 0) + 1);
      counts.set(key(q), byAnswer);
    }
    const modal = new Map<string, string>();
    for (const [k, byAnswer] of counts) {
      modal.set(k, [...byAnswer.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    }
    let scored = 0;
    let hit = 0;
    let blind = 0;
    for (const q of withChoices.slice(TRAIN)) {
      const guess = modal.get(key(q));
      if (guess === undefined) continue;
      scored++;
      blind += 1 / q.choices!.length;
      if (guess === String(q.answer)) hit++;
    }
    leak =
      scored < 100
        ? `  leak: unmeasurable (n=${scored})`
        : `  leak: ${((hit / scored) * 100).toFixed(0)}% vs blind ${((blind / scored) * 100).toFixed(0)}% (n=${scored})`;
  }

  const flag = overCap ? '\x1b[31m' : '\x1b[32m';
  console.log(`${flag}OK\x1b[0m      ${template.id}`);
  console.log(
    `        prompt max ${longest.length}/${MAX_PROMPT_CHARS}${overCap ? '  <-- OVER' : ''}`,
  );
  if (overCap) console.log(`        "${longest}"`);
  console.log(`        answers ${spread.slice(0, 8).join(' ')}${spread.length > 8 ? ' …' : ''}`);
  if (ranks.size > 0) {
    console.log(
      `        rank    ${[...ranks.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([r, n]) => `${r}:${((n / draws.length) * 100).toFixed(0)}%`)
        .join(' ')}`,
    );
  }
  if (leak) console.log(`      ${leak}`);
  if (overCap) bad++;
}

console.log(`\n${templates.length} template(s), ${bad} needing work`);
