/**
 * Seeds identify a session's question sequence: given the same seed and template
 * pool, the engine replays the exact same questions. Generated once per session,
 * on the server, and stored alongside the session record.
 *
 * This is the one impure corner of the session code, kept out of the engines so
 * everything downstream stays deterministic.
 */
export function createSessionSeed(): string {
  return globalThis.crypto.randomUUID();
}

/** The per-request values a new session needs: its seed and its start time. */
export function newSession(): { seed: string; startedAt: number } {
  return { seed: createSessionSeed(), startedAt: Date.now() };
}
