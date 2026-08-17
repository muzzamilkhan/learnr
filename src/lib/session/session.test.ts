import { describe, it, expect } from 'vitest';

import {
  MAX_TIME_MS,
  startSession,
  submitAnswer,
  elapsedMs,
  formatDuration,
  type SessionState,
} from './session';
import { buildProfile, findSkill, type Observation } from '../analytics/profile';
import type { QuestionTemplate } from '../templates/types';

const templates: QuestionTemplate[] = [
  {
    id: 'add-1',
    subject: 'maths',
    topic: 'addition',
    level: 'K',
    prompt: 'What is {x} + {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '1', max: '9' },
      { name: 'y', kind: 'int', min: '1', max: '9' },
    ],
    answer: 'x + y',
  },
  {
    id: 'sub-1',
    subject: 'maths',
    topic: 'subtraction',
    level: 'K',
    prompt: 'What is the difference between {x} and {y}?',
    vars: [
      { name: 'x', kind: 'int', min: '5', max: '10' },
      { name: 'y', kind: 'int', min: '1', max: '4' },
    ],
    answer: 'x - y',
  },
];

const start = (at = 1000) => startSession({ templates, seed: 'test', startedAt: at });

describe('startSession', () => {
  it('opens with a question ready and nothing recorded', () => {
    const session = start();
    expect(session.current.subject).toBe('maths');
    expect(session.attempts).toEqual([]);
    expect(session.askedCount).toBe(0);
  });

  it('rejects an empty template pool rather than starting a dead session', () => {
    expect(() => startSession({ templates: [], seed: 's', startedAt: 0 })).toThrow(/no question templates/i);
  });

  it('is deterministic for a given seed', () => {
    expect(start().current).toEqual(start().current);
  });
});

describe('submitAnswer', () => {
  it('records a correct attempt and moves to the next question', () => {
    const session = start(1000);
    const answer = String(session.current.answer);

    const next = submitAnswer(session, answer, 3500);

    expect(next.attempts).toHaveLength(1);
    expect(next.attempts[0]).toMatchObject({
      templateId: session.current.templateId,
      topic: session.current.topic,
      level: 'K',
      correct: true,
      timeTakenMs: 2500,
      response: answer,
    });
    expect(next.askedCount).toBe(1);
    expect(next.current).not.toEqual(session.current);
  });

  it('records an incorrect attempt without ending the session', () => {
    const session = start(1000);
    const wrong = String(Number(session.current.answer) + 1);

    const next = submitAnswer(session, wrong, 2000);

    expect(next.attempts[0].correct).toBe(false);
    expect(next.attempts[0].response).toBe(wrong);
    expect(next.current).toBeDefined();
  });

  it('times each question from when it was shown, not from session start', () => {
    let session = start(1000);
    session = submitAnswer(session, String(session.current.answer), 3000); // 2000ms
    session = submitAnswer(session, String(session.current.answer), 4000); // 1000ms

    expect(session.attempts.map((a) => a.timeTakenMs)).toEqual([2000, 1000]);
  });

  it('caps an abandoned question rather than calling it a four hour answer', () => {
    const session = start(0);
    const walkedAway = submitAnswer(session, String(session.current.answer), 4 * 60 * 60 * 1000);

    // The iPad was put down and picked up after dinner. That is not a time.
    expect(walkedAway.attempts[0].timeTakenMs).toBe(MAX_TIME_MS);
  });

  it('records the day the answer belongs to as the child’s, not the server’s', () => {
    const session = start(0);
    const next = submitAnswer(session, String(session.current.answer), 1000, 660);

    expect(next.attempts[0].offsetMinutes).toBe(660);
  });

  it('never runs out of questions', () => {
    let session = start(0);
    for (let i = 0; i < 100; i++) {
      session = submitAnswer(session, String(session.current.answer), (i + 1) * 1000);
    }
    expect(session.attempts).toHaveLength(100);
    expect(session.attempts.every((a) => a.correct)).toBe(true);
    expect(session.current).toBeDefined();
  });

  it('draws from every template in the pool over a long session', () => {
    let session = start(0);
    const seen = new Set<string>([session.current.templateId]);
    for (let i = 0; i < 60; i++) {
      session = submitAnswer(session, String(session.current.answer), (i + 1) * 1000);
      seen.add(session.current.templateId);
    }
    expect(seen).toEqual(new Set(['add-1', 'sub-1']));
  });

  it('does not mutate the previous state', () => {
    const session = start(1000);
    const before = structuredClone(session.attempts);
    submitAnswer(session, '1', 2000);
    expect(session.attempts).toEqual(before);
  });
});

describe('what it asks next', () => {
  const topics = ['counting', 'addition', 'shapes', 'even and odd'];

  const wider: QuestionTemplate[] = topics.map((topic) => ({
    id: `maths.K.${topic}.a`,
    subject: 'maths',
    topic,
    level: 'K',
    prompt: 'What is {x} + 1?',
    vars: [{ name: 'x', kind: 'int', min: '1', max: '9' }],
    answer: 'x + 1',
  }));

  const wrongAnswers = (topic: string): Observation[] =>
    Array.from({ length: 5 }, (_, index) => ({
      topic,
      level: 'K' as const,
      correct: false,
      timeTakenMs: 6000,
      answeredAt: index * 60_000,
    }));

  /** Plays `count` questions, getting `wrongTopic` wrong and everything else right. */
  function play(state: SessionState, count: number, wrongTopic?: string) {
    const asked: string[] = [state.current.topic];
    let at = state.startedAt;

    for (let i = 0; i < count; i++) {
      at += 5000;
      const answer = String(state.current.answer);
      const response = state.current.topic === wrongTopic ? `${answer}9` : answer;
      state = submitAnswer(state, response, at);
      asked.push(state.current.topic);
    }

    return { state, asked };
  }

  const shareOf = (asked: string[], topic: string) =>
    asked.filter((seen) => seen === topic).length / asked.length;

  it('draws at random until the answers say something', () => {
    const { asked } = play(startSession({ templates: wider, seed: 'fresh', startedAt: 0 }), 3);

    expect(asked).toHaveLength(4);
    // Three answers is not a pattern, so nothing has been prioritised yet.
    expect(shareOf(asked, 'counting')).toBeLessThanOrEqual(0.5);
  });

  it('leans on the topic the child is finding hard, and still asks the rest', () => {
    const session = startSession({
      templates: wider,
      seed: 'lean',
      startedAt: 0,
      profile: buildProfile(wrongAnswers('counting')),
    });

    const { asked } = play(session, 60, 'counting');

    expect(shareOf(asked, 'counting')).toBeGreaterThan(0.25);
    expect(shareOf(asked, 'counting')).toBeLessThanOrEqual(0.5);
    for (const topic of topics) expect(asked).toContain(topic);
  });

  it('eases off once the child has got the hang of it', () => {
    // The same sitting twice over, differing only in whether the child gets
    // counting right — so the change in the mix is the engine's doing.
    const session = () =>
      startSession({
        templates: wider,
        seed: 'ease',
        startedAt: 0,
        profile: buildProfile(wrongAnswers('counting')),
      });

    const stillStuck = play(session(), 60, 'counting');
    const gettingIt = play(session(), 60);

    expect(shareOf(gettingIt.asked, 'counting')).toBeLessThan(shareOf(stillStuck.asked, 'counting'));
    expect(findSkill(gettingIt.state.profile, 'counting', 'K')!.strength).toBeGreaterThan(0.85);
  });

  it('takes this sitting into account, not just the history it started with', () => {
    const session = startSession({ templates: wider, seed: 'learn', startedAt: 0 });
    const topic = session.current.topic;

    const next = submitAnswer(session, 'definitely wrong', 5000);
    const skill = findSkill(next.profile, topic, 'K')!;

    expect(skill).toMatchObject({ attempts: 1, correct: 0, streak: 0 });
    expect(session.profile.skills).toEqual([]);
  });

  it('does not open a session on the topic the last one closed on', () => {
    const opened = startSession({
      templates: wider,
      seed: 'carry',
      startedAt: 0,
      profile: buildProfile(wrongAnswers('counting')),
      recentTopics: ['counting'],
    });

    expect(opened.current.topic).not.toBe('counting');
  });
});

describe('timer', () => {
  it('reports elapsed time from session start', () => {
    const session = start(1000);
    expect(elapsedMs(session, 61_000)).toBe(60_000);
  });

  it('formats durations for the on-screen timer', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9_000)).toBe('0:09');
    expect(formatDuration(75_000)).toBe('1:15');
    expect(formatDuration(3_600_000)).toBe('60:00');
  });
});
