import { describe, expect, it } from 'vitest';
import { CHILD_SPEED_HREF, parseScoreTab, scoreTabHref, SPEED_SECTION } from './tabs';

describe('parseScoreTab', () => {
  it('takes the two tabs there are', () => {
    expect(parseScoreTab('records')).toBe('records');
    expect(parseScoreTab('leaderboard')).toBe('leaderboard');
  });

  it('falls back to records rather than refusing', () => {
    // A junk tab is a mistyped URL in front of a screen that works, so it opens
    // on the tab a player came for instead of 404ing.
    for (const junk of [undefined, null, '', 'RECORDS', 'podium', '__proto__']) {
      expect(parseScoreTab(junk)).toBe('records');
    }
  });
});

describe('scoreTabHref', () => {
  it('leaves records on the bare screen and puts the board in a query', () => {
    expect(scoreTabHref('/progress/speed', 'records')).toBe('/progress/speed');
    expect(scoreTabHref('/progress/speed', 'leaderboard')).toBe('/progress/speed?tab=leaderboard');
  });

  it('keeps the reader where the tabs are, when asked', () => {
    // The home screen's tabs sit below the practice section, so a switch that
    // landed at the top of the page would lose the wall being read.
    expect(scoreTabHref('/', 'records', SPEED_SECTION)).toBe('/#speed-run');
    expect(scoreTabHref('/', 'leaderboard', SPEED_SECTION)).toBe('/?tab=leaderboard#speed-run');
  });

  it('agrees with the href everything out of a run points at', () => {
    // The door and "See records" both aim here, and the home screen's section
    // carries the id - two strings that must not drift, so they are one.
    expect(CHILD_SPEED_HREF).toBe(scoreTabHref('/', 'records', SPEED_SECTION));
  });
});
