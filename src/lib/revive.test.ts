import { describe, expect, it } from 'vitest';
import { reviveDates } from './revive';

describe('reviveDates', () => {
  it('turns an ISO string into a Date', () => {
    const revived = reviveDates<{ at: Date }>({ at: '2026-08-26T09:00:00.000Z' });
    expect(revived.at).toBeInstanceOf(Date);
    expect(revived.at.getTime()).toBe(Date.parse('2026-08-26T09:00:00.000Z'));
  });

  it('walks into arrays and nested objects', () => {
    const revived = reviveDates<{ runs: { playedAt: Date }[] }>({
      runs: [{ playedAt: '2026-08-26T09:00:00.000Z' }],
    });
    expect(revived.runs[0].playedAt).toBeInstanceOf(Date);
  });

  it('leaves a number alone, because Sitting.startedAt is one', () => {
    const revived = reviveDates<{ startedAt: number }>({ startedAt: 1756197600000 });
    expect(revived.startedAt).toBe(1756197600000);
  });

  it('leaves an ordinary string alone', () => {
    const revived = reviveDates<{ name: string }>({ name: 'Ada' });
    expect(revived.name).toBe('Ada');
  });

  it('does not mistake a prompt that merely contains digits for a date', () => {
    const revived = reviveDates<{ prompt: string }>({ prompt: 'What is 2026 minus 8?' });
    expect(revived.prompt).toBe('What is 2026 minus 8?');
  });

  it('leaves null and undefined alone', () => {
    const revived = reviveDates<{ a: null; b?: undefined }>({ a: null, b: undefined });
    expect(revived.a).toBeNull();
    expect(revived.b).toBeUndefined();
  });
});

/**
 * The reviver only earns its place if it matches what the API actually puts on
 * the wire. That path is `Date` -> `JSON.stringify` -> HTTP -> `JSON.parse`, so
 * the round trip is simulated exactly rather than asserted against a hand-typed
 * string, and over the real payload shapes rather than a toy one.
 */
describe('a round trip through the wire', () => {
  const AT = new Date('2026-08-26T09:00:00.000Z');

  // Every Date-bearing field the data modules return, per the extraction plan.
  const payload = {
    child: { codeExpiresAt: AT, name: 'Ada', level: '3' },
    redeemed: { expires: AT, token: 'tok' },
    records: [{ achievedAt: AT, best: 12 }],
    attempts: [{ playedAt: AT, correct: 12 }],
    invites: [{ createdAt: AT, expiresAt: AT }],
    // Sitting.startedAt is a number and must stay one.
    sittings: [{ startedAt: AT.getTime(), questions: 10 }],
    // A question prompt is the string most likely to be mistaken for a date.
    attempt: { prompt: 'What is 2026 minus 8?', answeredAt: AT.getTime() },
  };

  const overTheWire = () => JSON.parse(JSON.stringify(payload));

  it('hands back Dates for every field that left as one', () => {
    const revived = reviveDates<typeof payload>(overTheWire());

    expect(revived.child.codeExpiresAt).toBeInstanceOf(Date);
    expect(revived.redeemed.expires).toBeInstanceOf(Date);
    expect(revived.records[0].achievedAt).toBeInstanceOf(Date);
    expect(revived.attempts[0].playedAt).toBeInstanceOf(Date);
    expect(revived.invites[0].createdAt).toBeInstanceOf(Date);
    expect(revived.invites[0].expiresAt).toBeInstanceOf(Date);

    expect(revived.child.codeExpiresAt.getTime()).toBe(AT.getTime());
  });

  it('leaves everything that left as a number or a word alone', () => {
    const revived = reviveDates<typeof payload>(overTheWire());

    expect(revived.sittings[0].startedAt).toBe(AT.getTime());
    expect(revived.attempt.answeredAt).toBe(AT.getTime());
    expect(revived.attempt.prompt).toBe('What is 2026 minus 8?');
    expect(revived.child.name).toBe('Ada');
    expect(revived.child.level).toBe('3');
  });

  // Without the reviver this is the production failure: a string where a
  // component expects a Date, and .getTime() throwing at render.
  it('is what stops a component calling .getTime() on a string', () => {
    const raw = overTheWire();
    expect(typeof raw.child.codeExpiresAt).toBe('string');
    expect(() => (raw.child.codeExpiresAt as Date).getTime()).toThrow(TypeError);
  });
});
