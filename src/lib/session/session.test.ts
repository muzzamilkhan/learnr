import { describe, it, expect } from 'vitest';

import { startSession, submitAnswer, elapsedMs, formatDuration } from './session';
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
