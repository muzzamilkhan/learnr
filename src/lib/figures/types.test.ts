import { describe, expect, it } from 'vitest';
import { MAX_MARKS, parseFigure } from './types';

const triangle = {
  width: 100,
  height: 100,
  marks: [
    { kind: 'path', points: [[10, 10], [90, 10], [50, 90]], closed: true, fill: false, dashed: false },
    { kind: 'dot', at: [50, 90] },
    { kind: 'label', at: [50, 5], text: '60°' },
    { kind: 'arc', at: [50, 90], radius: 8, from: 20, to: 160 },
  ],
};

describe('parseFigure', () => {
  it('reads nothing as nothing', () => {
    expect(parseFigure(null)).toBeNull();
    expect(parseFigure(undefined)).toBeNull();
  });

  it('refuses junk that is not shaped like a figure at all', () => {
    expect(parseFigure('a figure')).toBeNull();
    expect(parseFigure(42)).toBeNull();
    expect(parseFigure([])).toBeNull();
    expect(parseFigure({})).toBeNull();
    expect(parseFigure({ width: 100, height: 100 })).toBeNull();
    expect(parseFigure({ width: 0, height: 100, marks: [] })).toBeNull();
    expect(parseFigure({ width: 100, height: 100, marks: 'nope' })).toBeNull();
  });

  it('accepts a well-formed figure, one mark of each kind', () => {
    expect(parseFigure(triangle)).toEqual(triangle);
  });

  it('drops the whole figure when one mark is bad, rather than the mark alone', () => {
    const withBadDot = {
      ...triangle,
      marks: [...triangle.marks, { kind: 'dot', at: [50, 'ninety'] }],
    };
    expect(parseFigure(withBadDot)).toBeNull();

    const unknownKind = {
      ...triangle,
      marks: [...triangle.marks, { kind: 'sparkle', at: [1, 1] }],
    };
    expect(parseFigure(unknownKind)).toBeNull();

    const missingField = {
      ...triangle,
      marks: [{ kind: 'path', points: [[0, 0], [1, 1]], closed: true, fill: false }],
    };
    expect(parseFigure(missingField)).toBeNull();
  });

  it('refuses more marks than a real figure ever has, a hand-rolled call the only way to reach it', () => {
    const dot = { kind: 'dot', at: [1, 1] };
    const atCap = { width: 100, height: 100, marks: Array(MAX_MARKS).fill(dot) };
    const overCap = { width: 100, height: 100, marks: Array(MAX_MARKS + 1).fill(dot) };

    expect(parseFigure(atCap)).not.toBeNull();
    expect(parseFigure(overCap)).toBeNull();
  });
});
