import { describe, expect, it } from 'vitest';
import {
  groupViewers,
  householdId,
  mergeViewable,
  resolveChild,
  type ShareRow,
} from './children';

const profiles = [
  { id: 'a', name: 'Ada' },
  { id: 'b', name: 'Bo' },
];

describe('resolveChild', () => {
  it('picks the child the id names', () => {
    expect(resolveChild(profiles, 'b')?.name).toBe('Bo');
  });

  it('falls back to the first child when the id is unknown', () => {
    expect(resolveChild(profiles, 'nobody')?.name).toBe('Ada');
  });

  it('falls back to the first child when no id is given', () => {
    expect(resolveChild(profiles, null)?.name).toBe('Ada');
    expect(resolveChild(profiles, undefined)?.name).toBe('Ada');
  });

  it('has nothing to resolve without children', () => {
    expect(resolveChild([], 'a')).toBeNull();
  });
});

describe('mergeViewable', () => {
  const shared = [{ id: 'c', name: 'Cy' }];

  it('marks each child with how it is being looked at', () => {
    const all = mergeViewable(profiles, shared);
    expect(all.map((child) => [child.name, child.access])).toEqual([
      ['Ada', 'owner'],
      ['Bo', 'owner'],
      ['Cy', 'viewer'],
    ]);
  });

  it('never sorts a shared child above one of your own', () => {
    // The default child a screen opens on is the first in this list, and that
    // must be a child the parent came to see rather than someone else's.
    const all = mergeViewable([{ id: 'z', name: 'Zed' }], [{ id: 'a', name: 'Ada' }]);
    expect(resolveChild(all, null)?.name).toBe('Zed');
  });

  it('is empty for someone with nothing of their own and nothing shared', () => {
    expect(mergeViewable([], [])).toEqual([]);
  });
});

describe('groupViewers', () => {
  const row = (viewerId: string, childId: string, childName: string): ShareRow => ({
    childId,
    childName,
    viewerId,
    viewerName: viewerId,
    viewerEmail: `${viewerId}@example.com`,
    viewerImage: null,
  });

  it('lists a person once, with every child they can see', () => {
    const viewers = groupViewers([row('sam', 'a', 'Ada'), row('sam', 'b', 'Bo')]);
    expect(viewers).toHaveLength(1);
    expect(viewers[0]?.children.map((child) => child.name)).toEqual(['Ada', 'Bo']);
    expect(viewers[0]?.email).toBe('sam@example.com');
  });

  it('keeps people in the order they first appear', () => {
    const viewers = groupViewers([row('sam', 'a', 'Ada'), row('kim', 'a', 'Ada'), row('sam', 'b', 'Bo')]);
    expect(viewers.map((viewer) => viewer.id)).toEqual(['sam', 'kim']);
  });

  it('has nobody to list before anything is shared', () => {
    expect(groupViewers([])).toEqual([]);
  });
});

describe('householdId', () => {
  it('puts a parent at the head of their own household', () => {
    expect(householdId({ id: 'p', role: 'parent', parentId: null })).toBe('p');
  });

  it('puts a managed child in their parent’s household', () => {
    expect(householdId({ id: 'c', role: 'child', parentId: 'p' })).toBe('p');
  });

  it('gives a child with their own account no household', () => {
    expect(householdId({ id: 'c', role: 'child', parentId: null })).toBeNull();
  });

  it('gives someone who has not chosen a role no household', () => {
    expect(householdId({ id: 'u', role: null, parentId: null })).toBeNull();
  });
});
