import { MODES, modeKey, parseMode, type Mode } from './modes';

/**
 * One line per mode, for the table a parent reads on their child's report.
 * Pure like the rest of `speedrun/` - the rows come from `readSpeedSummaries`,
 * and nothing here reads a clock or a database.
 *
 * The cabinet beside this (`history.ts`) answers a player's question - is my
 * best a fluke or a floor - by ranking their five best runs at a mode. A parent
 * skimming a report is asking a different one: what has been played lately, and
 * is it getting better. So this keeps the best as the standing number and puts
 * the **latest** run beside it with the change since the run before, which is
 * the only pair that says which way things are going. A table of bests alone
 * cannot: a best never falls, so it says nothing about last week.
 */

/** One finished run, as stored. */
export interface SummaryRun {
  /** The stored mode key, parsed here rather than trusted. */
  mode: string;
  correct: number;
  playedAt: Date;
}

export interface Change {
  /** Correct answers gained or lost since the run before. */
  delta: number;
  /**
   * The same as a percentage of the previous run, rounded - or null when the
   * run before scored nought, where a percentage is a division by zero and the
   * count is the only honest thing to show.
   */
  percent: number | null;
}

export interface ModeSummary {
  mode: Mode;
  /** The personal best over every run given, which is what `SpeedRecord` keeps. */
  best: number;
  /** The run just played - the one the change below is measured at. */
  latest: { correct: number; playedAt: Date };
  /** How the latest run compares with the one before it, or null on a first run. */
  change: Change | null;
}

/**
 * Every mode this player has run, **freshest first** by its latest run.
 *
 * **Only modes that have been run appear** - `runHistory` and `familyStandings`
 * both draw that line, and for the reason the cabinet gives: twenty-seven empty
 * rows make a to-do list out of a record of what happened.
 *
 * The best is the maximum over the runs handed in, not a number read from
 * somewhere else, so a table can never claim a best that none of its own rows
 * could have set. `readSpeedSummaries` is what guarantees the best run is
 * always among them.
 */
export function speedSummaries(runs: readonly SummaryRun[]): ModeSummary[] {
  const byMode = new Map<string, SummaryRun[]>();

  for (const run of runs) {
    if (parseMode(run.mode) === null) continue;
    const rows = byMode.get(run.mode);
    if (rows) rows.push(run);
    else byMode.set(run.mode, [run]);
  }

  const summaries = MODES.flatMap((mode) => {
    const rows = byMode.get(modeKey(mode));
    if (!rows || rows.length === 0) return [];
    return [summarise(mode, rows)];
  });

  // Built in `MODES` order and sorted by freshness after, so `sort`'s stability
  // keeps two modes last played at the same moment in the order the game lists
  // them - the rule `runHistory` and `familyStandings` already follow.
  return summaries.sort((a, b) => b.latest.playedAt.getTime() - a.latest.playedAt.getTime());
}

function summarise(mode: Mode, rows: readonly SummaryRun[]): ModeSummary {
  // Newest first. Two runs at the same instant are all but impossible, but the
  // higher score wins the tie so the same rows always produce the same table.
  const byRecency = [...rows].sort(
    (a, b) => b.playedAt.getTime() - a.playedAt.getTime() || b.correct - a.correct,
  );
  const [latest, previous] = byRecency;

  return {
    mode,
    best: Math.max(...rows.map((row) => row.correct)),
    latest: { correct: latest.correct, playedAt: latest.playedAt },
    change: previous ? changeFrom(previous.correct, latest.correct) : null,
  };
}

function changeFrom(previous: number, latest: number): Change {
  const delta = latest - previous;
  return { delta, percent: previous > 0 ? Math.round((delta / previous) * 100) : null };
}
