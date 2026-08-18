import { describe, expect, it } from 'vitest';
import { AVATARS, DEFAULT_AVATAR, parseAvatar } from './avatars';

describe('parseAvatar', () => {
  it('accepts every avatar that ships', () => {
    for (const avatar of AVATARS) expect(parseAvatar(avatar)).toBe(avatar);
  });

  it('is null for anything else - the value arrives from a form', () => {
    expect(parseAvatar('dragon')).toBeNull();
    expect(parseAvatar('')).toBeNull();
    expect(parseAvatar(null)).toBeNull();
    expect(parseAvatar(undefined)).toBeNull();
  });

  it('has a default that is one of the avatars', () => {
    expect(AVATARS).toContain(DEFAULT_AVATAR);
  });
});
