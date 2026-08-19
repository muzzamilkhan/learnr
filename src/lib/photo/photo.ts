/**
 * A child's profile picture: what may be stored, and how big it is allowed to be.
 *
 * Pure like the rest of `lib` - the cropping itself happens in a canvas in the
 * browser (`src/components/photo-crop.tsx`), because nothing here may touch a
 * DOM. What lives in this file is the boundary: `parsePhoto` is to a picture
 * what `parseYearLevel` is to a school year and `parseTarget` is to a daily
 * target, the one place a value coming in from outside is judged.
 *
 * **Only a `data:image/webp;base64,` string is ever stored.** A photo arrives
 * through a server action, which is to say through the browser, so a remote URL
 * accepted here would be a way to make every screen that draws this child fetch
 * a resource somebody else chose. A data URL cannot do that.
 *
 * The size cap is defence against a hand-rolled call rather than against a
 * parent's camera roll: the cropper only ever produces a 256px square, about
 * 20KB of WebP, whatever the phone took.
 */

export const PHOTO_PREFIX = 'data:image/webp;base64,';

/** The side of the stored square, in pixels. Big enough for the largest face the app draws. */
export const PHOTO_SIZE = 256;

/** WebP quality for the encode. 0.8 is where a 256px face stops getting visibly better. */
export const PHOTO_QUALITY = 0.8;

/** Comfortably more than a 256px WebP needs, and far less than a photo would be. */
export const MAX_PHOTO_BYTES = 64 * 1024;

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** The decoded byte count of a base64 payload, without decoding it. */
function decodedBytes(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function parsePhoto(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || !value.startsWith(PHOTO_PREFIX)) return null;

  const payload = value.slice(PHOTO_PREFIX.length);
  if (payload.length === 0 || !BASE64.test(payload)) return null;
  if (decodedBytes(payload) > MAX_PHOTO_BYTES) return null;

  return value;
}
