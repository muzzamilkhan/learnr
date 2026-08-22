import { describe, it, expect } from 'vitest';
import { splitFractions } from './fractions';

describe('splitFractions', () => {
  it('leaves a text with no slash in one piece', () => {
    expect(splitFractions('What is 7 + 3?')).toEqual([{ kind: 'text', text: 'What is 7 + 3?' }]);
  });

  it('pulls a fraction out from the words around it', () => {
    expect(splitFractions('What is 2/3 of 12?')).toEqual([
      { kind: 'text', text: 'What is ' },
      { kind: 'fraction', numerator: '2', denominator: '3' },
      { kind: 'text', text: ' of 12?' },
    ]);
  });

  it('keeps every digit of a multi-digit numerator and denominator', () => {
    expect(splitFractions('11/16')).toEqual([
      { kind: 'fraction', numerator: '11', denominator: '16' },
    ]);
  });

  it('finds every fraction in a sentence, not only the first', () => {
    expect(splitFractions('1/8 + 7/16 = ?/16')).toEqual([
      { kind: 'fraction', numerator: '1', denominator: '8' },
      { kind: 'text', text: ' + ' },
      { kind: 'fraction', numerator: '7', denominator: '16' },
      { kind: 'text', text: ' = ' },
      { kind: 'fraction', numerator: '?', denominator: '16' },
    ]);
  });

  // The gap marker is a numerator like any other: "?/12" is a fraction with its
  // top missing, which is a better picture of what is being asked than a slash.
  it('takes the gap marker as a numerator', () => {
    expect(splitFractions('?/12')).toEqual([
      { kind: 'fraction', numerator: '?', denominator: '12' },
    ]);
  });

  it('drops the spaces a written fraction may carry around its slash', () => {
    expect(splitFractions('3 / 4')).toEqual([
      { kind: 'fraction', numerator: '3', denominator: '4' },
    ]);
  });

  // Not every slash is a fraction in general - it is only a fraction in *this*
  // content, and only because division is written with a division sign. A slash
  // with a word on either side of it is left as it was.
  it('leaves a slash that is not between numbers alone', () => {
    expect(splitFractions('red/blue')).toEqual([{ kind: 'text', text: 'red/blue' }]);
    expect(splitFractions('and/9')).toEqual([{ kind: 'text', text: 'and/9' }]);
  });

  it('returns one empty piece for an empty text', () => {
    expect(splitFractions('')).toEqual([{ kind: 'text', text: '' }]);
  });
});
