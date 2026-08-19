import { describe, it, expect } from 'vitest';

import { classifyError, errorClusters, MIN_CLUSTER } from './errors';
import type { AnsweredQuestion } from './report';
import type { YearLevel } from '../curriculum';

const NOW = Date.UTC(2026, 7, 18, 9, 0);

/**
 * The fixtures are real: every prompt, expected and response below was answered
 * by a Year 5/6 child and read out of the `Attempt` table. A classifier tested
 * against mistakes someone invented is a classifier tuned to the imagination of
 * whoever wrote it, and these are the errors children actually make.
 */
function answer(
  prompt: string,
  expected: string,
  response: string,
  { topic = 'measurement', level = '5' as YearLevel, index = 0 } = {},
): AnsweredQuestion {
  return {
    topic,
    level,
    prompt,
    expected,
    response,
    correct: expected === response,
    answeredAt: NOW + index * 60_000,
  };
}

describe('classifyError', () => {
  it('says nothing about an answer that was right', () => {
    expect(classifyError(answer('How many millimetres are there in 34 centimetres?', '340', '340'))).toBeNull();
  });

  describe('copied', () => {
    it('catches a unit conversion answered with the number it was given', () => {
      expect(classifyError(answer('How many metres is 415 centimetres?', '4.15', '415'))).toBe('copied');
      expect(classifyError(answer('How many kilograms is 5150 grams?', '5.15', '5150'))).toBe('copied');
    });

    it('catches a numerator copied instead of converted', () => {
      expect(
        classifyError(
          answer('3/8 + 7/16 = ?/16  What is the missing numerator?', '13', '7', { topic: 'fractions' }),
        ),
      ).toBe('copied');
      expect(
        classifyError(
          answer('1/7 + 2/14 = ?/14  What is the missing numerator?', '4', '1', { topic: 'fractions' }),
        ),
      ).toBe('copied');
    });

    it('wins over power-of-ten when both would match', () => {
      // 415 is both a number in the question and 4.15 × 100. Saying she gave the
      // number back is the more specific reading, and the one that says what to do.
      expect(classifyError(answer('How many metres is 415 centimetres?', '4.15', '415'))).toBe('copied');
    });

    it('does not fire when the copied number is the right answer', () => {
      expect(classifyError(answer('What is 3.86 × 10?', '38.6', '38.6'))).toBeNull();
    });
  });

  describe('power-of-ten', () => {
    it('catches a decimal point moved the wrong number of places', () => {
      expect(classifyError(answer('What is 74.2 ÷ 10?', '7.42', '0.742', { topic: 'decimals' }))).toBe(
        'power-of-ten',
      );
      expect(classifyError(answer('How many millimetres are there in 10 centimetres?', '100', '1000'))).toBe(
        'power-of-ten',
      );
      expect(classifyError(answer('How many millilitres are there in 4 litres?', '4000', '40'))).toBe(
        'power-of-ten',
      );
    });

    it('ignores a ratio that is not a power of ten', () => {
      expect(classifyError(answer('What is 25% of 20?', '5', '10', { topic: 'percentages' }))).not.toBe(
        'power-of-ten',
      );
    });
  });

  describe('sign-dropped', () => {
    it('catches a negative answered as its magnitude', () => {
      expect(classifyError(answer('What is 1 − 10?', '-9', '9', { topic: 'integers' }))).toBe('sign-dropped');
      expect(classifyError(answer('What is 14 − 30?', '-16', '16', { topic: 'integers' }))).toBe(
        'sign-dropped',
      );
    });

    it('catches it on a tapped choice as well as a typed number', () => {
      // Integer questions are multiple choice - the pad has no minus key - so the
      // response is the distractor's own text. It classifies the same way.
      expect(classifyError(answer('The temperature is 3°C. It falls 9°C.', '-6', '6', { topic: 'integers' }))).toBe(
        'sign-dropped',
      );
    });
  });

  describe('added-not-multiplied', () => {
    it('catches an area answered as the sum of the sides', () => {
      expect(
        classifyError(
          answer('A rectangle is 9 cm long and 4 cm wide. What is its area?', '36', '13', {
            topic: 'perimeter and area',
          }),
        ),
      ).toBe('added-not-multiplied');
    });

    it('ignores a wrong answer that is not the sum', () => {
      expect(
        classifyError(
          answer('A rectangle is 19 cm long and 12 cm wide. What is its area?', '228', '12', {
            topic: 'perimeter and area',
          }),
        ),
      ).not.toBe('added-not-multiplied');
    });
  });

  describe('clock-format', () => {
    it('catches a duration answered as a clock time', () => {
      expect(
        classifyError(
          answer('A bus leaves at 9:50 and arrives at 10:45. How many minutes?', '55', '1.45', {
            topic: 'time',
          }),
        ),
      ).toBe('clock-format');
      expect(
        classifyError(
          answer('A bus leaves at 9:55 and arrives at 10:50. How many minutes?', '55', '10.55', {
            topic: 'time',
          }),
        ),
      ).toBe('clock-format');
    });

    it('leaves an ordinary decimal alone', () => {
      expect(
        classifyError(answer('What is 6.95 − 3.97?', '2.98', '10.92', { topic: 'decimals' })),
      ).not.toBe('clock-format');
    });
  });

  it('gives up rather than guessing', () => {
    // A wrong answer with no story the classifier can tell. Reporting `null` is
    // the point: a taxonomy that explains everything explains nothing, and the
    // share of these is how the whole idea gets judged.
    expect(
      classifyError(answer('What is 282 × 7?', '1974', '25', { topic: 'multiplication' })),
    ).toBeNull();
  });
});

describe('errorClusters', () => {
  const conversions = [
    answer('How many metres is 415 centimetres?', '4.15', '415', { index: 0 }),
    answer('How many kilograms is 5150 grams?', '5.15', '5150', { index: 1 }),
    answer('How many metres is 520 centimetres?', '5.2', '520', { index: 2 }),
  ];

  it('gathers the same mistake into one entry, newest example first', () => {
    const [cluster] = errorClusters(conversions);

    expect(cluster.kind).toBe('copied');
    expect(cluster.count).toBe(3);
    expect(cluster.examples[0].prompt).toContain('520');
  });

  it('names every topic the mistake turned up in, which is the whole point', () => {
    const clusters = errorClusters([
      ...conversions,
      answer('How many kilograms is 3200 grams?', '3.2', '3200', { topic: 'measurement', level: '6' }),
      answer('1/4 + 2/8 = ?/8  What is the missing numerator?', '4', '2', { topic: 'fractions' }),
    ]);

    // One misconception, three TopicSkill rows - invisible to a report that
    // groups by topic, which is the reason this module exists.
    expect(clusters[0].topics).toHaveLength(3);
    expect(clusters[0].topics).toContainEqual({ topic: 'measurement', level: '6' });
  });

  it('drops a kind seen too few times to be a pattern', () => {
    const clusters = errorClusters([
      ...conversions,
      answer('What is 1 − 10?', '-9', '9', { topic: 'integers' }),
    ]);

    expect(MIN_CLUSTER).toBeGreaterThan(1);
    expect(clusters.map((cluster) => cluster.kind)).toEqual(['copied']);
  });

  it('ignores right answers and unclassifiable wrong ones', () => {
    expect(
      errorClusters([
        answer('How many millimetres are there in 34 centimetres?', '340', '340'),
        answer('What is 282 × 7?', '1974', '25', { topic: 'multiplication' }),
      ]),
    ).toEqual([]);
  });

  it('orders by how often the mistake was made', () => {
    const clusters = errorClusters([
      ...conversions,
      answer('What is 1 − 10?', '-9', '9', { topic: 'integers' }),
      answer('What is 14 − 30?', '-16', '16', { topic: 'integers' }),
      answer('What is 4 − 20?', '-16', '16', { topic: 'integers' }),
      answer('What is 5 − 21?', '-16', '16', { topic: 'integers' }),
    ]);

    expect(clusters.map((cluster) => cluster.kind)).toEqual(['sign-dropped', 'copied']);
  });
});

describe('regressions found against real history', () => {
  it('does not read a trailing .00 as a clock time', () => {
    // `8.00` where the answer was 7 is an hour out, not a formatting mistake -
    // but every `hh:00` in a prompt supplies a zero for the fractional part to
    // match against, which made this fire on the whole 24-hour template.
    expect(
      classifyError(
        answer('A train leaves at 19:00 in 24-hour time. What is that in the afternoon?', '7', '8.00', {
          topic: 'time',
        }),
      ),
    ).toBeNull();
  });
});
