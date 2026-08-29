import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT_LABELS, logTiming, parseSamples, stopwatch, timed, uptimeMs } from './timing';

afterEach(() => vi.restoreAllMocks());

const lines = () => {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
  return () => spy.mock.calls.map((call) => String(call[0]));
};

describe('timed', () => {
  it('returns what the run resolved to', async () => {
    lines();
    await expect(timed('read', async () => 'value')).resolves.toBe('value');
  });

  it('logs the label with an elapsed reading', async () => {
    const read = lines();
    await timed('read', async () => 'value');

    expect(read()).toHaveLength(1);
    expect(read()[0]).toContain('read');
    expect(read()[0]).toMatch(/\d+ms/);
  });

  // A failed read is the case most worth timing - it is where a hung hop shows
  // up - so the line has to survive the throw rather than be skipped by it.
  it('logs and rethrows when the run fails', async () => {
    const read = lines();
    await expect(timed('read', async () => { throw new Error('down'); })).rejects.toThrow('down');

    expect(read()).toHaveLength(1);
    expect(read()[0]).toContain('read');
  });
});

describe('stopwatch', () => {
  it('reports milliseconds since it started', async () => {
    const elapsed = stopwatch();
    await new Promise((resolve) => setTimeout(resolve, 12));

    expect(elapsed()).toBeGreaterThanOrEqual(10);
    expect(elapsed()).toBeLessThan(2_000);
  });
});

describe('logTiming', () => {
  it('carries the label, the reading and anything extra', () => {
    const read = lines();
    logTiming('api /me', 42, 'status=200');

    expect(read()[0]).toContain('api /me');
    expect(read()[0]).toContain('42ms');
    expect(read()[0]).toContain('status=200');
  });

  // Every line says how old this instance is, so a cold invocation is readable
  // from any one of them rather than needing a second line to correlate with.
  it('says how long this instance has been up', () => {
    const read = lines();
    logTiming('api /me', 42);

    expect(read()[0]).toMatch(/up=\d+ms/);
  });
});

describe('uptimeMs', () => {
  it('counts from when the module was loaded, not from the epoch', () => {
    expect(uptimeMs()).toBeLessThan(60_000);
  });
});

describe('parseSamples', () => {
  const ok = { samples: [{ label: 'recordAttempt', ms: 120 }] };

  it('keeps a well-formed batch', () => {
    expect(parseSamples(ok)).toEqual([{ label: 'recordAttempt', ms: 120 }]);
  });

  it('refuses anything that is not a batch of samples', () => {
    expect(parseSamples(null)).toEqual([]);
    expect(parseSamples({})).toEqual([]);
    expect(parseSamples({ samples: 'recordAttempt' })).toEqual([]);
    expect(parseSamples([{ label: 'recordAttempt', ms: 1 }])).toEqual([]);
  });

  // The sink writes these straight into a log line, so a label carrying a
  // newline would forge log lines of its own. An allowlist rather than an
  // escape: the labels are a closed set this app writes, so anything outside it
  // is not a measurement that could have come from here.
  it('drops a label that is not one this app records', () => {
    expect(parseSamples({ samples: [{ label: 'nope', ms: 1 }] })).toEqual([]);
    expect(parseSamples({ samples: [{ label: 'recordAttempt\nfake', ms: 1 }] })).toEqual([]);
  });

  it('drops a reading that is not a sane number of milliseconds', () => {
    const bad = (ms: unknown) => parseSamples({ samples: [{ label: 'recordAttempt', ms }] });
    expect(bad(-1)).toEqual([]);
    expect(bad(Number.NaN)).toEqual([]);
    expect(bad(Number.POSITIVE_INFINITY)).toEqual([]);
    expect(bad('120')).toEqual([]);
    expect(bad(9_999_999)).toEqual([]);
  });

  it('keeps the good samples in a batch that also holds bad ones', () => {
    expect(
      parseSamples({ samples: [{ label: 'nope', ms: 1 }, { label: 'awardRound', ms: 7 }] }),
    ).toEqual([{ label: 'awardRound', ms: 7 }]);
  });

  // An unbounded batch is an unbounded number of log lines from one request.
  it('caps how many one request may write', () => {
    const many = Array.from({ length: 500 }, () => ({ label: 'recordAttempt', ms: 5 }));
    expect(parseSamples({ samples: many }).length).toBeLessThanOrEqual(50);
  });

  it('names the labels the client is allowed to report', () => {
    expect(CLIENT_LABELS).toContain('recordAttempt');
    expect(CLIENT_LABELS).toContain('awardTarget');
    expect(CLIENT_LABELS).toContain('submitRun');
  });
});
