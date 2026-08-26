import { describe, expect, it } from 'vitest';
import { viewerKind } from './viewer';
import type { Account } from './dto';

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'u1',
    role: 'parent',
    parentId: null,
    name: 'Sam',
    avatar: null,
    image: null,
    photo: null,
    ...overrides,
  };
}

describe('viewerKind', () => {
  it('is signed out when there is no user', () => {
    expect(viewerKind(undefined, null)).toBe('signed-out');
  });

  /**
   * The case this exists for. Every screen used to read a null account as "not
   * a parent", which is true of a visitor and false of a parent whose account
   * could not be read - and the two arrive identically.
   */
  it('is unreadable when somebody is signed in and their account did not come back', () => {
    expect(viewerKind('u1', null)).toBe('unreadable');
  });

  it('tells a parent from a child', () => {
    expect(viewerKind('u1', account({ role: 'parent' }))).toBe('parent');
    expect(viewerKind('u1', account({ role: 'child' }))).toBe('child');
  });

  /**
   * A role that has not been claimed yet is its own answer, not a parent and
   * not a failure. `/` claims it and every other screen bounces there, so the
   * bounce heals rather than loops - which only works if this is distinguishable
   * from `parent`.
   */
  it('keeps an unclaimed role apart from a claimed one', () => {
    expect(viewerKind('u1', account({ role: null }))).toBe('unclaimed');
  });

  // Signed out wins: without a user nothing was ever asked for, so there is no
  // read to have failed.
  it('is signed out rather than unreadable when there is no user at all', () => {
    expect(viewerKind(undefined, null)).toBe('signed-out');
    expect(viewerKind('', null)).toBe('signed-out');
  });
});
