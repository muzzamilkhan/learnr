import { describe, expect, it } from 'vitest';
import { speedSummaries, type SummaryRun } from './summary';

const at = (day: number) => new Date(Date.UTC(2026, 0, day));

const run = (mode: string, correct: number, day: number): SummaryRun => ({
  mode,
  correct,
  answered: correct + 2,
  playedAt: at(day),
});

describe('speedSummaries', () => {
  it('reports the latest run rather than the best', () => {
    const summaries = speedSummaries([run('add.easy', 14, 2), run('add.easy', 9, 5)]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].latest).toMatchObject({ correct: 9, answered: 11, playedAt: at(5) });
    expect(summaries[0].best).toBe(14);
  });

  it('measures the change against the run before the latest', () => {
    const summaries = speedSummaries([
      run('add.easy', 20, 1),
      run('add.easy', 10, 4),
      run('add.easy', 12, 5),
    ]);

    expect(summaries[0].change).toEqual({ delta: 2, percent: 20 });
  });

  it('gives a fall a negative change', () => {
    const summaries = speedSummaries([run('add.easy', 10, 1), run('add.easy', 7, 2)]);

    expect(summaries[0].change).toEqual({ delta: -3, percent: -30 });
  });

  it('has no change to report for a first run', () => {
    const summaries = speedSummaries([run('add.easy', 10, 1)]);

    expect(summaries[0].change).toBeNull();
  });

  it('reports no percentage against a previous run of nought', () => {
    const summaries = speedSummaries([run('add.easy', 0, 1), run('add.easy', 4, 2)]);

    expect(summaries[0].change).toEqual({ delta: 4, percent: null });
  });

  it('orders modes by their latest run, freshest first', () => {
    const summaries = speedSummaries([
      run('add.easy', 20, 1),
      run('multiply.7', 5, 6),
      run('divide.hard', 3, 4),
    ]);

    expect(summaries.map((summary) => summary.mode.op)).toEqual(['multiply', 'divide', 'add']);
  });

  it('leaves a mode nobody has run off the table', () => {
    const summaries = speedSummaries([run('add.easy', 4, 1)]);

    expect(summaries).toHaveLength(1);
  });

  it('ignores a mode key that no longer parses', () => {
    expect(speedSummaries([run('add.impossible', 4, 1)])).toEqual([]);
  });
});
