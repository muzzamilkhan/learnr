import { describe, it, expect } from 'vitest';
import { allTemplates } from '../catalog';
import { generateQuestion } from '@/lib/templates/generate';
import { createRng } from '@/lib/rng';

/**
 * How often a `choice` question can be answered from its buttons alone.
 *
 * For each template: draw many questions, key each by its prompt and sorted
 * option set, learn the modal answer for each key on a training sample, then
 * score that rule on a held-out sample. Compare against the blind baseline -
 * the mean of 1/n over the options actually offered - and fail anything
 * meaningfully above it.
 *
 * **This is a fourth check, not a restatement of the three in
 * `validateTemplate`.** Those refuse a fixed answer rank, a closed set the
 * distractors never draw from, and an option set that predicts its answer -
 * and the third only speaks where a set repeats, so a leak that narrows the
 * answer to two buttons of four passes all three cleanly. Eight such leaks
 * were found by measuring during the figures work, at rates up to 100%, and
 * not one could have been found by the checks that existed then.
 *
 * **Held out rather than scored in-sample**, because a rule learned and tested
 * on the same draws reports the sample's own noise as signal - which, for a
 * template whose option sets rarely repeat, would be most of what it found.
 *
 * **The key is the option set and NOT the prompt, which is where this differs
 * from the figures work it is modelled on.** There the prompt is a constant
 * caption ("What shape is this?") and the *figure* carries the question, so
 * keying on prompt-plus-options asks "do the buttons give away what the
 * picture should be telling you". Here the prompt carries the question, so
 * including it makes the key unique per question and the modal rule degenerates
 * into memorising the answer to each one - which scores 100% on any
 * well-posed question and measures nothing. Measured both ways on the
 * Kindergarten content: prompt-plus-options flagged all 17 choice templates at
 * 100%, options-alone flagged 3. The rule is to key on everything the child can
 * see *except* the thing that is supposed to determine the answer.
 *
 * A template whose sets almost never repeat scores nothing here and is
 * reported as *unmeasurable* rather than as clean: no evidence is not evidence
 * of no leak, and saying so is the honest reading.
 */
/**
 * **3,000 held-out draws, not 300, and the difference is not academic.** The
 * index-reuse leak that six shipped templates carried measures 15 to 17 points
 * above blind at this sample and 10 to 13 - indistinguishable from noise - at
 * 600 draws. Five of the seven content years were first measured at the smaller
 * sample and passed. Raising it costs about forty seconds on the whole suite,
 * which is the cheapest insurance in this repo.
 */
const DRAWS = 6000;
const TRAIN = 3000;

/**
 * How far above blind guessing counts as a leak.
 *
 * Not zero: a held-out sample of a few hundred draws carries real sampling
 * noise, and a template whose answer is genuinely uniform over its options
 * still lands a few points either side of its baseline. 15 points is
 * comfortably outside that band and far below what an actual leak produces -
 * the figures work measured leaks at 60% to 100% against baselines of 25% to
 * 33%.
 */
const MARGIN = 0.15;

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
    if (template.subject !== 'english') continue;

    const draws = Array.from({ length: DRAWS }, (_, i) =>
      generateQuestion(template, createRng(`${template.id}-leak-${i}`)),
    ).filter((q) => q.choices && q.choices.length > 0);

    if (draws.length === 0) continue;

    // Keyed on the OPTIONS ALONE, deliberately - see the note above.
    const key = (q: (typeof draws)[number]) =>
      [...q.choices!].map(String).sort().join(' ');

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

    // Too few held-out draws shared a key with the training half for any rate
    // computed from them to mean anything.
    if (scored < 100) {
      unmeasurable.push(template.id);
      continue;
    }

    rows.push({ id: template.id, scored, hit, baseline: blind / scored });
  }

  return { rows, unmeasurable };
}

describe('English multiple-choice questions', () => {
  it('cannot be answered from the buttons alone', { timeout: 120_000 }, () => {
    const { rows } = measure();

    const leaks = rows
      .filter((r) => r.hit / r.scored > r.baseline + MARGIN)
      .sort((a, b) => b.hit / b.scored - a.hit / a.scored)
      .map(
        (r) =>
          `${r.id}: ${((r.hit / r.scored) * 100).toFixed(0)}% from the options alone ` +
          `(blind ${(r.baseline * 100).toFixed(0)}%, n=${r.scored})`,
      );

    expect(leaks).toEqual([]);
  });
});
