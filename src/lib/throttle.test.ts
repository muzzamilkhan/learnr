import { describe, expect, it } from 'vitest';
import { MAX_TRACKED_KEYS, browserIp, createThrottle } from './throttle';

const OPTIONS = { limit: 3, windowMs: 1000 };

describe('createThrottle', () => {
  it('lets a key through while it has failures left', () => {
    const throttle = createThrottle(OPTIONS);

    throttle.fail('a', 0);
    throttle.fail('a', 0);

    expect(throttle.blocked('a', 0)).toBe(false);
  });

  it('blocks a key once it has spent its failures', () => {
    const throttle = createThrottle(OPTIONS);

    for (let i = 0; i < OPTIONS.limit; i += 1) throttle.fail('a', 0);

    expect(throttle.blocked('a', 0)).toBe(true);
  });

  it('frees a key once its window has passed', () => {
    const throttle = createThrottle(OPTIONS);

    for (let i = 0; i < OPTIONS.limit; i += 1) throttle.fail('a', 0);

    expect(throttle.blocked('a', OPTIONS.windowMs)).toBe(false);
  });

  it('counts each key separately, so one caller cannot lock another out', () => {
    const throttle = createThrottle(OPTIONS);

    for (let i = 0; i < OPTIONS.limit; i += 1) throttle.fail('a', 0);

    expect(throttle.blocked('b', 0)).toBe(false);
  });

  // A success is what a child does after mistyping, so it has to wipe the
  // failures - and an attacker has no success to clear with, which is the
  // whole thing they are trying to get.
  it('forgets a key that succeeds', () => {
    const throttle = createThrottle(OPTIONS);

    for (let i = 0; i < OPTIONS.limit; i += 1) throttle.fail('a', 0);
    throttle.clear('a');

    expect(throttle.blocked('a', 0)).toBe(false);
  });

  it('says how long is left of the window, rounded up to a whole second', () => {
    const throttle = createThrottle({ limit: 1, windowMs: 5000 });

    throttle.fail('a', 0);

    expect(throttle.retryAfterSeconds('a', 1500)).toBe(4);
  });

  it('never asks a caller to wait less than a second', () => {
    const throttle = createThrottle({ limit: 1, windowMs: 5000 });

    throttle.fail('a', 0);

    expect(throttle.retryAfterSeconds('a', 4999)).toBe(1);
  });

  // The key is the caller's IP, which an attacker on IPv6 has a great many of.
  // Without a cap the map is a memory leak with a remote write to it.
  it('bounds how many keys it tracks', () => {
    const throttle = createThrottle({ limit: 1, windowMs: 60_000 });

    for (let i = 0; i < MAX_TRACKED_KEYS + 50; i += 1) throttle.fail(`key-${i}`, 0);

    expect(throttle.size()).toBeLessThanOrEqual(MAX_TRACKED_KEYS);
  });

  it('keeps the freshest keys when it evicts', () => {
    const throttle = createThrottle({ limit: 1, windowMs: 60_000 });

    for (let i = 0; i < MAX_TRACKED_KEYS + 50; i += 1) throttle.fail(`key-${i}`, i);

    expect(throttle.blocked(`key-${MAX_TRACKED_KEYS + 49}`, 0)).toBe(true);
  });

  // Expiry is what keeps the map small in ordinary use; eviction is the
  // backstop for an attack. A swept key must not still be blocking.
  it('drops keys whose window has passed rather than evicting live ones', () => {
    const throttle = createThrottle({ limit: 1, windowMs: 1000 });

    throttle.fail('old', 0);
    throttle.fail('new', 5000);

    expect(throttle.size()).toBe(1);
  });
});

describe('browserIp', () => {
  it('prefers the single-value header, which needs no parsing', () => {
    expect(browserIp('203.0.113.7', '198.51.100.1, 70.41.3.18')).toBe('203.0.113.7');
  });

  it('takes the client from the front of a forwarded chain', () => {
    expect(browserIp(null, '198.51.100.1, 70.41.3.18, 150.172.238.178')).toBe('198.51.100.1');
  });

  it('trims the spaces a forwarded chain is written with', () => {
    expect(browserIp(null, ' 198.51.100.1 , 70.41.3.18')).toBe('198.51.100.1');
  });

  it('handles a chain of one', () => {
    expect(browserIp(null, '198.51.100.1')).toBe('198.51.100.1');
  });

  // A caller with no address is one key for everybody, which would turn the
  // throttle into a lockout. Better to say so and let the caller decide.
  it('is null when neither header says anything', () => {
    expect(browserIp(null, null)).toBeNull();
    expect(browserIp('', '')).toBeNull();
    expect(browserIp(null, '  ,  ')).toBeNull();
  });
});
