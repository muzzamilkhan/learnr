/**
 * The pictures a parent can give a child profile. A managed child has no Google
 * account and so no photo; this is what stands in for one, and it is how a child
 * who cannot yet read their own name finds their profile on the sign-in screen.
 *
 * A fixed list rather than an upload: eight choices is enough to tell siblings
 * apart, and it keeps a photo of a child out of the database entirely.
 */
export const AVATARS = ['fox', 'bear', 'cat', 'owl', 'frog', 'whale', 'rabbit', 'panda'] as const;

export type Avatar = (typeof AVATARS)[number];

export const DEFAULT_AVATAR: Avatar = 'fox';

export function parseAvatar(value: string | null | undefined): Avatar | null {
  return AVATARS.includes(value as Avatar) ? (value as Avatar) : null;
}
