import { describe, expect, it } from 'vitest';
import { ROUND_SIZE, closedRound, rounds, starsForRound } from './stars';

/** `n` answers, the first `correct` of them right. */
const results = (n: number, correct: number): boolean[] =>
  Array.from({ length: n }, (_, i) => i < correct);

describe('starsForRound', () => {
  it('gives three stars for a clean round', () => {
    expect(starsForRound(ROUND_SIZE)).toBe(3);
  });

  it('gives two stars for some right and some wrong', () => {
    expect(starsForRound(1)).toBe(2);
    expect(starsForRound(ROUND_SIZE - 1)).toBe(2);
  });

  it('still gives a star for turning up', () => {
    expect(starsForRound(0)).toBe(1);
  });
});

describe('rounds', () => {
  it('has nothing to award before ten questions', () => {
    expect(rounds(results(9, 9))).toEqual([]);
  });

  it('awards one round per ten answers, ignoring the part-finished one', () => {
    const played = [...results(10, 10), ...results(10, 4), ...results(3, 3)];
    expect(rounds(played)).toEqual([
      { index: 1, correct: 10, stars: 3 },
      { index: 2, correct: 4, stars: 2 },
    ]);
  });

  it('scores each round on its own answers, not the running total', () => {
    // Ten wrong then ten right: a bare star, then a full three.
    const played = [...results(10, 0), ...results(10, 10)];
    expect(rounds(played).map((round) => round.stars)).toEqual([1, 3]);
  });
});

describe('closedRound', () => {
  it('is nothing until an answer lands on the boundary', () => {
    expect(closedRound(results(9, 9))).toBeNull();
    expect(closedRound(results(11, 11))).toBeNull();
    expect(closedRound([])).toBeNull();
  });

  it('is the round the last answer just finished', () => {
    const played = [...results(10, 10), ...results(10, 0)];
    expect(closedRound(played)).toEqual({ index: 2, correct: 0, stars: 1 });
  });
});
