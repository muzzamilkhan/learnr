import { afterEach, describe, expect, it, vi } from 'vitest';
import { logTiming, stopwatch, timed, uptimeMs } from './timing';

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
