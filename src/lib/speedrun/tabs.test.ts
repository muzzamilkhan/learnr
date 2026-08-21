import { describe, expect, it } from 'vitest';
import { parseScoreTab, scoreTabHref } from './tabs';

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
    expect(scoreTabHref('/speed', 'records')).toBe('/speed');
    expect(scoreTabHref('/progress/speed', 'leaderboard')).toBe('/progress/speed?tab=leaderboard');
  });
});
