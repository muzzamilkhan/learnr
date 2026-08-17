import { describe, it, expect } from 'vitest';

import { MAX_FOCUS_SHARE, RECENT_MEMORY, focusTopics, selectTemplate, weightTemplates } from './select';
import { buildProfile, emptyProfile, type LearnerProfile, type Observation } from '../analytics/profile';
import { createRng } from '../rng';
import type { QuestionTemplate } from '../templates/types';

const TOPICS = ['counting', 'addition', 'shapes', 'even and odd'];

const template = (topic: string, variant = 'a'): QuestionTemplate => ({
  id: `maths.K.${topic}.${variant}`,
  subject: 'maths',
  topic,
  level: 'K',
  prompt: 'What is {x} + 1?',
  vars: [{ name: 'x', kind: 'int', min: '1', max: '9' }],
  answer: 'x + 1',
});

/** Two templates a topic, so a topic's share does not just follow its template count. */
const pool: QuestionTemplate[] = TOPICS.flatMap((topic) => [template(topic, 'a'), template(topic, 'b')]);

const DAY = 24 * 60 * 60 * 1000;
const NOW = 100 * DAY;

/** A run of answers on one topic, finishing an hour ago. */
function answers(topic: string, results: boolean[], endedAt = NOW - 60 * 60 * 1000): Observation[] {
  return results.map((correct, index) => ({
    topic,
    level: 'K' as const,
    correct,
    timeTakenMs: 4000,
    answeredAt: endedAt - (results.length - 1 - index) * 60_000,
  }));
}

const rights = (n: number) => Array(n).fill(true);
const wrongs = (n: number) => Array(n).fill(false);

interface Run {
  counts: Record<string, number>;
  share: (topic: string) => number;
  longestRun: number;
  repeats: number;
}

/** Draw `draws` questions the way a session does: one seeded RNG each, carrying recent topics. */
function simulate(profile: LearnerProfile, draws = 400, now = NOW): Run {
  const counts: Record<string, number> = Object.fromEntries(TOPICS.map((t) => [t, 0]));
  let recent: string[] = [];
  let longestRun = 0;
  let run = 0;
  let repeats = 0;

  for (let draw = 0; draw < draws; draw++) {
    const picked = selectTemplate(pool, { profile, now, recent }, createRng(`sim:${draw}`));
    counts[picked.topic] += 1;
    if (picked.topic === recent[0]) {
      repeats += 1;
      run += 1;
    } else {
      run = 1;
    }
    longestRun = Math.max(longestRun, run);
    recent = [picked.topic, ...recent].slice(0, RECENT_MEMORY);
  }

  return { counts, share: (topic) => counts[topic] / draws, longestRun, repeats };
}

describe('with nothing known yet', () => {
  it('asks at random', () => {
    const run = simulate(emptyProfile());

    for (const topic of TOPICS) expect(run.share(topic)).toBeGreaterThan(0.15);
    for (const topic of TOPICS) expect(run.share(topic)).toBeLessThan(0.35);
  });

  it('weights everything the same until a topic has been answered enough times', () => {
    const profile = buildProfile(answers('counting', wrongs(3)));
    const weights = weightTemplates(pool, { profile, now: NOW });

    expect(new Set(weights.map((entry) => entry.weight))).toEqual(new Set([1]));
    expect(focusTopics(pool, { profile, now: NOW })).toEqual([]);
  });
});

describe('once a pattern has formed', () => {
  const struggling = buildProfile([
    ...answers('counting', [true, false, false, false, false]),
    ...answers('addition', rights(5)),
  ]);

  it('names the topic that needs work', () => {
    expect(focusTopics(pool, { profile: struggling, now: NOW })).toEqual(['counting']);
  });

  it('gives the hard topic a healthy share without swarming it', () => {
    const run = simulate(struggling);

    expect(run.share('counting')).toBeGreaterThan(0.2);
    expect(run.share('counting')).toBeLessThanOrEqual(MAX_FOCUS_SHARE);
  });

  it('mixes other topics in rather than drilling one', () => {
    const run = simulate(struggling);

    // Every other topic still turns up, and no topic clumps.
    for (const topic of TOPICS) expect(run.counts[topic]).toBeGreaterThan(0);
    expect(run.longestRun).toBeLessThanOrEqual(2);
    expect(run.repeats / 400).toBeLessThan(0.1);
  });

  it('keeps asking a mastered topic, just less often', () => {
    const run = simulate(struggling);

    expect(run.share('addition')).toBeGreaterThan(0.02);
    expect(run.share('addition')).toBeLessThan(run.share('counting'));
  });

  it('spreads the work when several topics are weak', () => {
    const profile = buildProfile([
      ...answers('counting', wrongs(5)),
      ...answers('shapes', wrongs(5)),
      ...answers('addition', rights(5)),
    ]);
    const run = simulate(profile);

    expect(run.share('counting') + run.share('shapes')).toBeLessThanOrEqual(MAX_FOCUS_SHARE + 0.02);
    expect(run.share('counting')).toBeGreaterThan(0.1);
    expect(run.share('shapes')).toBeGreaterThan(0.1);
  });

  it('holds back a topic that was just asked', () => {
    const context = { profile: struggling, now: NOW };
    const cold = weightTemplates(pool, context).find((e) => e.template.topic === 'counting')!;
    const hot = weightTemplates(pool, { ...context, recent: ['counting'] }).find(
      (e) => e.template.topic === 'counting',
    )!;

    expect(hot.weight).toBeLessThan(cold.weight);
  });
});

describe('coming back to what has been learned', () => {
  const mastered = buildProfile(answers('shapes', rights(4)));

  it('leaves a freshly mastered topic alone', () => {
    const statuses = weightTemplates(pool, { profile: mastered, now: NOW });
    const shapes = statuses.find((entry) => entry.template.topic === 'shapes')!;

    expect(shapes.status).toBe('secure');
    expect(focusTopics(pool, { profile: mastered, now: NOW })).toEqual([]);
  });

  it('revisits it once it has had time to fade', () => {
    const later = NOW + 10 * DAY;

    expect(focusTopics(pool, { profile: mastered, now: later })).toEqual(['shapes']);
    expect(simulate(mastered, 400, later).share('shapes')).toBeGreaterThan(
      simulate(mastered, 400, NOW).share('shapes'),
    );
  });

  it('confirms rather than re-teaches: the review stays a fraction of the session', () => {
    const run = simulate(mastered, 400, NOW + 10 * DAY);

    expect(run.share('shapes')).toBeLessThanOrEqual(MAX_FOCUS_SHARE);
  });
});

describe('selectTemplate', () => {
  it('is deterministic for a given seed and profile', () => {
    const context = { profile: emptyProfile(), now: NOW };
    const first = selectTemplate(pool, context, createRng('seed:7'));
    const again = selectTemplate(pool, context, createRng('seed:7'));

    expect(again).toBe(first);
  });

  it('refuses an empty pool rather than returning nothing', () => {
    expect(() => selectTemplate([], { profile: emptyProfile(), now: NOW }, createRng('s'))).toThrow(
      /empty pool/i,
    );
  });

  it('still answers when every topic is in cooldown', () => {
    const profile = buildProfile(TOPICS.flatMap((topic) => answers(topic, rights(5))));
    const picked = selectTemplate(pool, { profile, now: NOW, recent: TOPICS }, createRng('s'));

    expect(pool).toContain(picked);
  });
});
