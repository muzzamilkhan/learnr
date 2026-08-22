import { describe, expect, it } from 'vitest';
import {
  CHILD_DEFAULT_TAB,
  CHILD_SPEED_HREF,
  PARENT_SPEED_HREF,
  PARENT_DEFAULT_TAB,
  parseScoreTab,
  scoreTabHref,
  SPEED_SECTION,
  tabOrder,
} from './tabs';

describe('parseScoreTab', () => {
  it('takes the two tabs there are', () => {
    expect(parseScoreTab('records', CHILD_DEFAULT_TAB)).toBe('records');
    expect(parseScoreTab('leaderboard', CHILD_DEFAULT_TAB)).toBe('leaderboard');
    expect(parseScoreTab('records', PARENT_DEFAULT_TAB)).toBe('records');
  });

  it('falls back to the screen it is on rather than refusing', () => {
    // A junk tab is a mistyped URL in front of a screen that works, so it opens
    // on whichever tab that screen opens on instead of 404ing - and on that one
    // rather than on a fixed favourite, since the bare URL means the same thing.
    for (const junk of [undefined, null, '', 'RECORDS', 'podium', '__proto__']) {
      expect(parseScoreTab(junk, CHILD_DEFAULT_TAB)).toBe('records');
      expect(parseScoreTab(junk, PARENT_DEFAULT_TAB)).toBe('leaderboard');
    }
  });
});

describe('tabOrder', () => {
  it('puts the tab a screen opens on first', () => {
    // A child came to see what they scored; a parent came to see how the house
    // is going. The left tab and the open panel are the same answer.
    expect(tabOrder(CHILD_DEFAULT_TAB)).toEqual(['records', 'leaderboard']);
    expect(tabOrder(PARENT_DEFAULT_TAB)).toEqual(['leaderboard', 'records']);
  });

  it('names both tabs whichever is default', () => {
    expect(tabOrder('records')).toHaveLength(2);
    expect(tabOrder('leaderboard')).toHaveLength(2);
  });
});

describe('scoreTabHref', () => {
  it('leaves the default tab on the bare screen and puts the other in a query', () => {
    expect(scoreTabHref('/', 'records', CHILD_DEFAULT_TAB)).toBe('/');
    expect(scoreTabHref('/', 'leaderboard', CHILD_DEFAULT_TAB)).toBe('/?tab=leaderboard');
  });

  it('follows the screen, so a parent bare URL is the board', () => {
    // The half that opens has to be the half the bare path names, or the tab a
    // screen opens on is one nothing can link back to.
    expect(scoreTabHref(PARENT_SPEED_HREF, 'leaderboard', PARENT_DEFAULT_TAB)).toBe('/speed');
    expect(scoreTabHref(PARENT_SPEED_HREF, 'records', PARENT_DEFAULT_TAB)).toBe(
      '/speed?tab=records',
    );
  });

  it('keeps the reader where the tabs are, when asked', () => {
    // The home screen's tabs sit below the practice section, so a switch that
    // landed at the top of the page would lose the wall being read.
    expect(scoreTabHref('/', 'records', CHILD_DEFAULT_TAB, SPEED_SECTION)).toBe('/#speed-run');
    expect(scoreTabHref('/', 'leaderboard', CHILD_DEFAULT_TAB, SPEED_SECTION)).toBe(
      '/?tab=leaderboard#speed-run',
    );
  });

  it('agrees with the href everything out of a run points at', () => {
    // The door and "See records" both aim here, and the home screen's section
    // carries the id - two strings that must not drift, so they are one.
    expect(CHILD_SPEED_HREF).toBe('/#speed-run');
    expect(CHILD_SPEED_HREF).toBe(
      scoreTabHref('/', CHILD_DEFAULT_TAB, CHILD_DEFAULT_TAB, SPEED_SECTION),
    );
  });

  it('gives a parent one speed path, which their bare URL names', () => {
    // A parent's scores and a parent's runs are the same screen, so the nav
    // item, the door out of a run and every Try button are one string. It has
    // to be the bare path too: the tab a parent opens on is the leaderboard,
    // and a default tab no URL names is a panel nothing can link back to.
    expect(PARENT_SPEED_HREF).toBe('/speed');
    expect(PARENT_SPEED_HREF).toBe(
      scoreTabHref(PARENT_SPEED_HREF, PARENT_DEFAULT_TAB, PARENT_DEFAULT_TAB),
    );
  });
});
