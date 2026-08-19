import { describe, expect, it } from 'vitest';
import { HISTORY_RUNS, runHistory, type SpeedAttempt } from './history';

const at = (day: number) => new Date(Date.UTC(2026, 0, day));

const attempt = (mode: string, correct: number, day: number): SpeedAttempt => ({
  mode,
  correct,
  answered: correct + 2,
  playedAt: at(day),
});

describe('runHistory', () => {
  it('ranks a mode’s runs highest first', () => {
    const history = runHistory([
      attempt('add.easy', 8, 1),
      attempt('add.easy', 14, 2),
      attempt('add.easy', 11, 3),
    ]);

    expect(history).toHaveLength(1);
    expect(history[0].runs.map((run) => run.correct)).toEqual([14, 11, 8]);
  });

  it(`keeps at most ${HISTORY_RUNS} runs of a mode`, () => {
    const history = runHistory(
      Array.from({ length: 9 }, (_, index) => attempt('add.easy', index + 1, index + 1)),
    );

    expect(history[0].runs.map((run) => run.correct)).toEqual([9, 8, 7, 6, 5]);
  });

  it('stars only the best run', () => {
    const history = runHistory([
      attempt('add.easy', 8, 1),
      attempt('add.easy', 14, 2),
    ]);

    expect(history[0].runs.map((run) => run.best)).toEqual([true, false]);
  });

  it('gives a tied best to whoever got there first, and stars it alone', () => {
    const history = runHistory([
      attempt('add.easy', 14, 5),
      attempt('add.easy', 14, 2),
    ]);

    expect(history[0].runs.map((run) => run.playedAt)).toEqual([at(2), at(5)]);
    expect(history[0].runs.map((run) => run.best)).toEqual([true, false]);
  });

  it('lists modes freshest first', () => {
    const history = runHistory([
      attempt('add.easy', 9, 1),
      attempt('multiply.7', 3, 4),
      attempt('subtract.hard', 5, 2),
    ]);

    expect(history.map((entry) => entry.mode.op)).toEqual(['multiply', 'subtract', 'add']);
  });

  it('orders equally fresh modes the way the game lists them', () => {
    const history = runHistory([
      attempt('subtract.easy', 5, 1),
      attempt('add.easy', 9, 1),
    ]);

    expect(history.map((entry) => entry.mode.op)).toEqual(['add', 'subtract']);
  });

  it('takes freshness from the runs it shows, not the ones it drops', () => {
    const shown = Array.from({ length: HISTORY_RUNS }, (_, index) =>
      attempt('add.easy', index + 5, 1),
    );
    const history = runHistory([
      ...shown,
      // A recent run too low to make the table changes nothing anyone can see.
      attempt('add.easy', 1, 9),
      attempt('multiply.7', 3, 4),
    ]);

    expect(history.map((entry) => entry.mode.op)).toEqual(['multiply', 'add']);
  });

  it('drops a mode key this build no longer knows', () => {
    expect(runHistory([attempt('add.impossible', 9, 1)])).toEqual([]);
  });

  it('has nothing to say about a player who has never run', () => {
    expect(runHistory([])).toEqual([]);
  });
});
