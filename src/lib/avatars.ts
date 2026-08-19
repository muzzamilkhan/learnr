/**
 * The drawn pictures a parent can give a child profile. A managed child has no
 * Google account and so no picture of their own; this is what stands in for one,
 * and it is how a child who cannot yet read their name finds their profile.
 *
 * A parent may crop a photograph instead (`src/lib/photo`), and these eight are
 * what shows when they have not - which is most of the time, and is the whole
 * story for a family that never uploads anything. A fixed list is enough to tell
 * siblings apart, needs nothing decoded and no bytes stored, and is the picture a
 * child recognises before they can read their own name.
 */
export const AVATARS = ['fox', 'bear', 'cat', 'owl', 'frog', 'whale', 'rabbit', 'panda'] as const;

export type Avatar = (typeof AVATARS)[number];

export const DEFAULT_AVATAR: Avatar = 'fox';

export function parseAvatar(value: string | null | undefined): Avatar | null {
  return AVATARS.includes(value as Avatar) ? (value as Avatar) : null;
}
