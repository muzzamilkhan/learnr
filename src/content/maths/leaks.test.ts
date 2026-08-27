import { describe, it, expect } from 'vitest';
import { allTemplates } from '../catalog';
import { generateQuestion } from '../../lib/templates/generate';
import { createRng } from '../../lib/rng';

/**
 * How often a maths `choice` question can be answered without looking at the
 * thing that is supposed to determine the answer.
 *
 * The measurement is `src/content/english/leaks.test.ts`'s and the reasoning
 * behind held-out scoring, the modal rule and the blind baseline is written
 * out there rather than repeated here. What follows is only what maths does
 * differently, and why.
 *
 * **The key branches, and the branch is that file's own rule applied rather
 * than restated.** The rule is: key on everything the child can see *except*
 * the thing that is supposed to determine the answer. In English the prompt
 * carries the question, so the key is the options alone. In maths it depends
 * on the template. A **figure** template's prompt is a caption - "What time is
 * this?" - and the *picture* carries the question, so everything else the
 * child can see is prompt **and** options, and both go in the key. A
 * **non-figure** maths template is English's case exactly, and takes English's
 * key.
 *
 * **That is not a tidying-up, and measuring it both ways is what showed it.**
 * `maths.3.position.grid-direction` scores 1.6 points *below* blind on the
 * options alone and **26 points above** it on prompt-plus-options, because its
 * four options are the two-by-two block around the dot and the direction word
 * in the prompt halves them on its own. Keyed the English way it is invisible.
 * Going the other way is worse: prompt-plus-options on a non-figure template
 * degenerates exactly as English's note predicts a self-keying question would,
 * and every one of the 75 measurable non-figure templates scores 100% - a
 * number that measures nothing but the uniqueness of the prompt.
 *
 * **A prompt that gives its own answer away is therefore caught here on the
 * figure half and not on the other**, which is the one place this file covers
 * more than its sibling. A figure template's prompt is inside the key, so a
 * caption that determines the answer makes the key predict it and is flagged.
 * On a non-figure template the prompt is not read at all, and English's blind
 * spot is inherited whole: a question that hands over its answer in words
 * scores clean, because nothing about the options moved.
 *
 * **`rankIsTheQuestion` and `propertyIsTheQuestion` are exempt, and have to
 * be.** `maths.4.decimals.larger` and `maths.4.angles.larger-angle` score 100%
 * against a 50% blind and are right to: comparing the options *is* the
 * question, and there is nothing else to read. `validateTemplate` stands its
 * own two checks down for these flags for the same reason, so honouring them
 * keeps one meaning for the flag rather than inventing a second. Without the
 * exemption they would be permanent red, which is the state in which a suite
 * stops being read.
 *
 * **The numbers are English's, arrived at separately rather than inherited.**
 * Measured over all 79 maths `choice` templates, the flagged ones run from
 * 11.3 to 38.8 points above blind, the highest unflagged sits at 7.5, and the
 * bulk are under 2.5 - so a 0.10 margin falls in open space from both sides,
 * as it does in English. 3,000 draws split 1,500/1,500 for the reason given
 * there: the leaks this catches are 10 to 15 points at this sample and
 * indistinguishable from noise at a fifth of it.
 */
const DRAWS = 3000;
const TRAIN = 1500;

/** How far above blind guessing counts as a leak. See the note above `DRAWS`. */
const MARGIN = 0.1;

/**
 * Below this many held-out draws sharing a key with the training half, no rate
 * computed from them means anything, and the template is reported as
 * *unmeasurable* rather than as clean.
 */
const MIN_SCORED = 100;

interface Row {
  id: string;
  scored: number;
  hit: number;
  baseline: number;
}

function measure(): { rows: Row[]; unmeasurable: string[] } {
  const rows: Row[] = [];
  const unmeasurable: string[] = [];

  for (const template of allTemplates) {
    if (template.subject !== 'maths') continue;

    const spec = template.choices;
    if (spec?.rankIsTheQuestion || spec?.propertyIsTheQuestion) continue;

    // One probe draw tells whether this template is `choices` at all, which
    // most maths templates are not - drawing 3,000 questions from each of them
    // only to discard the lot is most of this file's running time.
    const probe = generateQuestion(template, createRng(`${template.id}-leak-probe`));
    if (!probe.choices || probe.choices.length === 0) continue;

    const draws = Array.from({ length: DRAWS }, (_, i) =>
      generateQuestion(template, createRng(`${template.id}-leak-${i}`)),
    ).filter((q) => q.choices && q.choices.length > 0);

    if (draws.length === 0) continue;

    // The spec, not a drawn figure: whether the question is a picture is a
    // fact about the template and must not depend on which draw was asked.
    const carriesFigure = Boolean(template.figure);
    const key = (q: (typeof draws)[number]) => {
      const options = [...q.choices!].map(String).sort().join(' ');
      return carriesFigure ? `${q.prompt}${options}` : options;
    };

    const counts = new Map<string, Map<string, number>>();
    for (const q of draws.slice(0, TRAIN)) {
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
    for (const q of draws.slice(TRAIN)) {
      const guess = modal.get(key(q));
      if (guess === undefined) continue;
      scored++;
      blind += 1 / q.choices!.length;
      if (guess === String(q.answer)) hit++;
    }

    if (scored < MIN_SCORED) {
      unmeasurable.push(template.id);
      continue;
    }

    rows.push({ id: template.id, scored, hit, baseline: blind / scored });
  }

  return { rows, unmeasurable };
}

describe('Maths multiple-choice questions', () => {
  it('cannot be answered without the question', { timeout: 120_000 }, () => {
    const { rows, unmeasurable } = measure();

    const leaks = rows
      .filter((r) => r.hit / r.scored > r.baseline + MARGIN)
      .sort((a, b) => b.hit / b.scored - a.hit / a.scored)
      .map(
        (r) =>
          `${r.id}: ${((r.hit / r.scored) * 100).toFixed(0)}% without the question ` +
          `(blind ${(r.baseline * 100).toFixed(0)}%, n=${r.scored})`,
      );

    // Surfaced rather than dropped, for the reason its sibling gives: no
    // evidence is not evidence of no leak.
    if (unmeasurable.length > 0) {
      console.warn(
        `${unmeasurable.length} template(s) had too few repeated keys to score: ` +
          unmeasurable.join(', '),
      );
    }

    expect(leaks).toEqual([]);
  });
});
