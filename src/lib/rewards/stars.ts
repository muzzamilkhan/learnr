/**
 * Stars: what a child gets for finishing ten questions.
 *
 * This is a reward, not a measurement - the analytics side already says what a
 * child can do, and it says it carefully. Stars exist to make coming back feel
 * worth it, so the floor matters more than the ceiling: a round where nothing
 * went right still earns one, because sitting through ten hard questions is the
 * thing we actually want more of. Three is kept for a clean round so it stays
 * worth aiming at.
 *
 * Pure, like everything in `lib`: rounds are read off the answers themselves,
 * so the play screen, a server recount and a test all reach the same total.
 */

/** Questions to a round. Short enough that a child sees a reward in one sitting. */
export const ROUND_SIZE = 10;

export type Stars = 1 | 2 | 3;

export interface Round {
  /** 1-based - the child's first ten questions are round 1. */
  index: number;
  correct: number;
  stars: Stars;
}

/** All right, or something right, or turned up. */
export function starsForRound(correct: number, size = ROUND_SIZE): Stars {
  if (correct >= size) return 3;
  return correct > 0 ? 2 : 1;
}

/**
 * The closed rounds in a run of answers, oldest first. A part-finished round is
 * not in here: stars are awarded on the boundary and never part way, so a child
 * who stops at question seven has not lost anything they were shown.
 */
export function rounds(results: readonly boolean[]): Round[] {
  const closed: Round[] = [];

  for (let start = 0; start + ROUND_SIZE <= results.length; start += ROUND_SIZE) {
    const correct = results.slice(start, start + ROUND_SIZE).filter(Boolean).length;
    closed.push({ index: start / ROUND_SIZE + 1, correct, stars: starsForRound(correct) });
  }

  return closed;
}

/**
 * The round the last answer just closed, or null if it did not close one. This
 * is the celebration's cue, so it has to fire on the boundary answer alone -
 * asking "is the count a multiple of ten?" of any other answer says no.
 */
export function closedRound(results: readonly boolean[]): Round | null {
  if (results.length === 0 || results.length % ROUND_SIZE !== 0) return null;
  const closed = rounds(results);
  return closed[closed.length - 1];
}

/** Every star a run of answers is worth. The same sum whoever counts it. */
export function starsEarned(results: readonly boolean[]): number {
  return rounds(results).reduce((total, round) => total + round.stars, 0);
}
