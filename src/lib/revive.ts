/**
 * What a timestamp looks like crossing this boundary, exported so nothing else
 * has to write it a second time: `parsePlayedAt` bounds a stamp arriving *into*
 * the API and this revives the ones going out, and the two must not be able to
 * disagree about what counts as one.
 *
 * JSON has no date type, and the API's reads are full of them - a code's expiry,
 * when a record was achieved, when a link runs out. Without this every one of
 * them arrives as a string and the first `.getTime()` throws in a component.
 *
 * The pattern is deliberately strict: a full ISO 8601 timestamp with a `T` and a
 * zone, which is what `Date.prototype.toJSON` produces and what a question prompt
 * never does. A looser match would turn "2026" in a maths question into a Date.
 */
export const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function reviveDates<T>(value: unknown): T {
  return walk(value) as T;
}

function walk(value: unknown): unknown {
  if (typeof value === 'string') return ISO_TIMESTAMP.test(value) ? new Date(value) : value;
  if (Array.isArray(value)) return value.map(walk);

  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value)) out[key] = walk(inner);
    return out;
  }

  return value;
}
