import { describe, expect, it } from 'vitest';
import { LAUNCH_STALE_MS, launchTiming, parseLaunchMark } from './launch';

describe('parseLaunchMark', () => {
  it('reads a mark it wrote', () => {
    expect(parseLaunchMark('{"mode":"multiply.7","at":1000}')).toEqual({
      mode: 'multiply.7',
      at: 1000,
    });
  });

  it('refuses anything else, because session storage holds whatever is put there', () => {
    // The boundary rule the app applies at every other one: this is read back
    // out of the browser after a navigation, so it is not ours by the time it
    // returns.
    for (const junk of [
      null,
      '',
      'not json',
      '{}',
      '[]',
      '{"mode":"multiply.7"}',
      '{"at":1000}',
      '{"mode":7,"at":1000}',
      '{"mode":"multiply.7","at":"1000"}',
      '"__proto__"',
    ]) {
      expect(parseLaunchMark(junk)).toBeNull();
    }
  });
});

describe('launchTiming', () => {
  const base = { mark: null, mode: 'multiply.7', readyAt: 5_000, fetchMs: null, hardLoad: false };

  it('measures the finger going down to the run being on screen', () => {
    // The only number a child could report. Everything else is a share of it.
    const timing = launchTiming({
      ...base,
      mark: { mode: 'multiply.7', at: 3_800 },
    });

    expect(timing.waitMs).toBe(1_200);
  });

  it('splits the wait into the request and everything else', () => {
    const timing = launchTiming({
      ...base,
      mark: { mode: 'multiply.7', at: 3_800 },
      fetchMs: 900,
    });

    expect(timing.fetchMs).toBe(900);
    expect(timing.restMs).toBe(300);
  });

  it('has no wait for a run opened directly rather than tapped', () => {
    // A typed URL is a real way to start a run and must not be reported as an
    // instant one - that would quietly drag every average down.
    expect(launchTiming({ ...base, mark: null }).waitMs).toBeNull();
  });

  it('ignores a mark left by a different mode', () => {
    // A tap on one chip and an arrival at another is a mark that outlived the
    // journey it was made for, not a measurement.
    const timing = launchTiming({
      ...base,
      mark: { mode: 'add.easy', at: 3_800 },
    });

    expect(timing.waitMs).toBeNull();
  });

  it('ignores a mark old enough to be from another sitting', () => {
    // Session storage outlives the navigation, so a tap that never arrived -
    // the child wandered off, came back and opened the run some other way -
    // would otherwise be reported as a wait of several minutes.
    const timing = launchTiming({
      ...base,
      mark: { mode: 'multiply.7', at: 5_000 - LAUNCH_STALE_MS - 1 },
    });

    expect(timing.waitMs).toBeNull();
  });

  it('ignores a mark from the future rather than reporting a negative wait', () => {
    expect(launchTiming({ ...base, mark: { mode: 'multiply.7', at: 6_000 } }).waitMs).toBeNull();
  });

  it('reports the request even when there was no tap to measure from', () => {
    // A typed URL still says what the server cost, which is the half worth
    // having across every run rather than only the tapped ones.
    const timing = launchTiming({ ...base, mark: null, fetchMs: 700 });

    expect(timing.waitMs).toBeNull();
    expect(timing.fetchMs).toBe(700);
    expect(timing.restMs).toBeNull();
  });

  it('keeps whether the run arrived by a full page load', () => {
    // A hard load and a tap from the cards are different journeys with
    // different costs, and averaging them together hides both.
    expect(launchTiming({ ...base, hardLoad: true }).hardLoad).toBe(true);
  });
});
