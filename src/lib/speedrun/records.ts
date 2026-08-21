/**
 * A first run is not a record.
 *
 * It makes a personal best mean somebody improved, and it stops a child
 * working through the modes from firing twenty-six notifications at their
 * parent in an afternoon. The cost is that the very first run has nothing to celebrate,
 * which is why the result screen has a third thing to say rather than two -
 * "that's your score to beat" is honest where a fanfare would be invented.
 */
export function isRecord(previousBest: number | null, score: number): boolean {
  return previousBest !== null && score > previousBest;
}

/** Which of the three things the result screen says. */
export type ResultTone = 'first' | 'record' | 'short';

export function resultTone(previousBest: number | null, score: number): ResultTone {
  if (previousBest === null) return 'first';
  return score > previousBest ? 'record' : 'short';
}
