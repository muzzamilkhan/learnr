/** Deterministic PRNG so question generation is reproducible in tests and replays. */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
}

function hashSeed(seed: string | number): number {
  const text = String(seed);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 - small, fast, good enough for question shuffling. */
export function createRng(seed: string | number): Rng {
  let state = hashSeed(seed);

  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => {
    if (max < min) throw new Error(`Invalid range: min ${min} is greater than max ${max}`);
    return min + Math.floor(next() * (max - min + 1));
  };

  return {
    next,
    int,
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('Cannot pick from an empty list');
      return items[int(0, items.length - 1)];
    },
  };
}
