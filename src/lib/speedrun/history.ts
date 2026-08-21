import { MODES, modeKey, parseMode, type Mode } from './modes';

/**
 * A player's own runs at each mode, ranked. Pure like the rest of `speedrun/` -
 * the rows come from `readSpeedAttempts`, and nothing here reads a clock or a
 * database.
 *
 * The cabinet used to show one number per mode, because one number was all
 * there was: `SpeedRecord` keeps the maximum and a run that failed to beat it
 * left no trace. A table of five says something a single best cannot - whether
 * a score was a fluke or a floor, and whether the last few runs are climbing
 * towards the best or away from it - and that only exists once every run is
 * kept, which is what `SpeedAttempt` is for.
 */

/** One finished run, as stored. */
export interface SpeedAttempt {
  /** The stored mode key, parsed here rather than trusted. */
  mode: string;
  correct: number;
  playedAt: Date;
}

export interface Run {
  correct: number;
  playedAt: Date;
  /**
   * The personal best - the top row, and only ever one of them. A tie at the
   * top is two runs of the same score, and the star marks the run that *set*
   * the best rather than every run that has since matched it, so the row it
   * sits on is the one `SpeedRecord.achievedAt` names.
   */
  best: boolean;
}

export interface History {
  mode: Mode;
  runs: Run[];
}

/** How many runs a mode's table shows. */
export const HISTORY_RUNS = 5;

/**
 * Every mode this player has run, **freshest first**, each with its best runs
 * highest first.
 *
 * **Only modes that have been run appear** - `familyStandings` and the cabinet
 * before it draw the empty ones the same way for the same reason: twenty-seven
 * empty tables make a to-do list out of a trophy case.
 *
 * **A tie is broken by who got there first**, exactly as the leaderboard breaks
 * one between two players: the earlier run is the one that set the score, and
 * that is the only thing honestly separating two identical numbers.
 *
 * **Freshness is measured over the runs shown**, not every run recorded. A
 * sixth-best run finished this afternoon changes nothing on the card, so it
 * must not reorder the board either - the same rule `familyStandings` applies
 * to a fourth-place run. Equally fresh modes keep `MODES` order between them.
 */
export function runHistory(attempts: readonly SpeedAttempt[]): History[] {
  const byMode = new Map<string, SpeedAttempt[]>();

  for (const attempt of attempts) {
    if (parseMode(attempt.mode) === null) continue;
    const rows = byMode.get(attempt.mode);
    if (rows) rows.push(attempt);
    else byMode.set(attempt.mode, [attempt]);
  }

  const history = MODES.flatMap((mode) => {
    const rows = byMode.get(modeKey(mode));
    if (!rows || rows.length === 0) return [];
    return [{ mode, runs: runsFor(rows) }];
  });

  // Built in `MODES` order and sorted by freshness after, so `sort`'s stability
  // is what keeps two equally fresh modes in the order the game lists them.
  return history.sort((a, b) => freshness(b) - freshness(a));
}

/** When this mode's table last changed: the newest run on it. */
function freshness(entry: History): number {
  return Math.max(...entry.runs.map((run) => run.playedAt.getTime()));
}

function runsFor(rows: readonly SpeedAttempt[]): Run[] {
  return [...rows]
    .sort((a, b) => b.correct - a.correct || a.playedAt.getTime() - b.playedAt.getTime())
    .slice(0, HISTORY_RUNS)
    .map((row, index) => ({
      correct: row.correct,
      playedAt: row.playedAt,
      best: index === 0,
    }));
}
