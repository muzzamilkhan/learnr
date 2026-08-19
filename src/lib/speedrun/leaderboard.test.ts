import { describe, expect, it } from 'vitest';
import { familyStandings, type FamilyRecord } from './leaderboard';

function entry(overrides: Partial<FamilyRecord> = {}): FamilyRecord {
  return {
    playerId: 'player-1',
    playerName: 'Shanaaya',
    mode: 'multiply.4',
    best: 20,
    achievedAt: new Date('2026-08-18T10:00:00Z'),
    ...overrides,
  };
}

describe('familyStandings', () => {
  it('orders a mode by score, highest first', () => {
    const [standing] = familyStandings([
      entry({ playerId: 'a', playerName: 'Ada', best: 12 }),
      entry({ playerId: 'b', playerName: 'Bo', best: 19 }),
      entry({ playerId: 'c', playerName: 'Cy', best: 15 }),
    ]);

    expect(standing.places.map((place) => place.playerName)).toEqual(['Bo', 'Cy', 'Ada']);
    expect(standing.places.map((place) => place.place)).toEqual([1, 2, 3]);
  });

  it('shares a place on a tie and skips the next one', () => {
    const [standing] = familyStandings([
      entry({ playerId: 'a', playerName: 'Ada', best: 19 }),
      entry({ playerId: 'b', playerName: 'Bo', best: 19 }),
      entry({ playerId: 'c', playerName: 'Cy', best: 15 }),
    ]);

    expect(standing.places.map((place) => place.place)).toEqual([1, 1, 3]);
  });

  it('carries each player\u2019s face through the ranking, tie and all', () => {
    const [standing] = familyStandings([
      entry({ playerId: 'a', playerName: 'Ada', playerAvatar: 'owl', best: 19 }),
      entry({
        playerId: 'b',
        playerName: 'Bo',
        playerPhoto: 'data:image/webp;base64,AAAA',
        best: 19,
      }),
    ]);

    // The board draws the face and keeps the name for its alt text, so both have
    // to survive a ranking that cares about neither.
    expect(standing.places.map((place) => place.place)).toEqual([1, 1]);
    expect(standing.places.map((place) => place.playerAvatar)).toEqual(['owl', undefined]);
    expect(standing.places.map((place) => place.playerPhoto)).toEqual([
      undefined,
      'data:image/webp;base64,AAAA',
    ]);
  });

  it('lists whoever got there first ahead of a tie', () => {
    const [standing] = familyStandings([
      entry({ playerName: 'Late', best: 19, achievedAt: new Date('2026-08-18T10:00:00Z') }),
      entry({ playerName: 'Early', best: 19, achievedAt: new Date('2026-08-01T10:00:00Z') }),
    ]);

    expect(standing.places.map((place) => place.playerName)).toEqual(['Early', 'Late']);
  });

  it('keeps three places, not three rows', () => {
    const standings = familyStandings([
      entry({ playerId: 'a', playerName: 'Ada', best: 19 }),
      entry({ playerId: 'b', playerName: 'Bo', best: 19 }),
      entry({ playerId: 'c', playerName: 'Cy', best: 19 }),
      entry({ playerId: 'd', playerName: 'Di', best: 18 }),
    ]);

    expect(standings[0].places.map((place) => place.playerName)).toEqual(['Ada', 'Bo', 'Cy']);
    expect(standings[0].places.every((place) => place.place === 1)).toBe(true);
  });

  it('drops everyone past third', () => {
    const [standing] = familyStandings([
      entry({ playerId: 'a', playerName: 'Ada', best: 19 }),
      entry({ playerId: 'b', playerName: 'Bo', best: 18 }),
      entry({ playerId: 'c', playerName: 'Cy', best: 17 }),
      entry({ playerId: 'd', playerName: 'Di', best: 16 }),
    ]);

    expect(standing.places.map((place) => place.playerName)).toEqual(['Ada', 'Bo', 'Cy']);
  });

  it('lists a mode nobody has run not at all', () => {
    const standings = familyStandings([entry({ mode: 'add.easy' })]);

    expect(standings).toHaveLength(1);
    expect(standings[0].mode).toEqual({ op: 'add', difficulty: 'easy' });
  });

  it('puts the mode whose podium changed most recently first', () => {
    const standings = familyStandings([
      entry({ mode: 'add.easy', achievedAt: new Date('2026-08-01T10:00:00Z') }),
      entry({ mode: 'mixed.hard', achievedAt: new Date('2026-08-18T10:00:00Z') }),
      entry({ mode: 'multiply.7', achievedAt: new Date('2026-08-09T10:00:00Z') }),
    ]);

    expect(standings.map((standing) => standing.mode.op)).toEqual(['mixed', 'multiply', 'add']);
  });

  it('ranks a mode by its podium, not by a run that missed it', () => {
    const standings = familyStandings([
      entry({ mode: 'add.easy', playerId: 'a', best: 20, achievedAt: new Date('2026-08-10T10:00:00Z') }),
      // Fourth place, and the newest run in the house - but nothing on the card
      // changed, so it must not haul addition to the front of the board.
      entry({ mode: 'add.easy', playerId: 'b', best: 19, achievedAt: new Date('2026-08-02T10:00:00Z') }),
      entry({ mode: 'add.easy', playerId: 'c', best: 18, achievedAt: new Date('2026-08-02T10:00:00Z') }),
      entry({ mode: 'add.easy', playerId: 'd', best: 17, achievedAt: new Date('2026-08-19T10:00:00Z') }),
      entry({ mode: 'mixed.hard', playerId: 'e', achievedAt: new Date('2026-08-12T10:00:00Z') }),
    ]);

    expect(standings.map((standing) => standing.mode.op)).toEqual(['mixed', 'add']);
  });

  it('keeps MODES order between modes that are equally fresh', () => {
    const standings = familyStandings([
      entry({ mode: 'mixed.hard' }),
      entry({ mode: 'add.easy' }),
      entry({ mode: 'multiply.7' }),
    ]);

    expect(standings.map((standing) => standing.mode.op)).toEqual(['add', 'multiply', 'mixed']);
  });

  it('ignores a mode key this build no longer knows', () => {
    expect(familyStandings([entry({ mode: 'divide.impossible' })])).toEqual([]);
  });
});
