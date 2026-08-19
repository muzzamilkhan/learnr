import { describe, expect, it } from 'vitest';
import { isRecord, resultTone } from './records';

describe('isRecord', () => {
  it('is not set by a first run - there is nothing to have beaten', () => {
    expect(isRecord(null, 20)).toBe(false);
  });

  it('is set by beating a previous best', () => {
    expect(isRecord(18, 19)).toBe(true);
  });

  it('is not set by equalling or missing it', () => {
    expect(isRecord(18, 18)).toBe(false);
    expect(isRecord(18, 4)).toBe(false);
  });

  it('is not set by a first run of zero', () => {
    expect(isRecord(null, 0)).toBe(false);
  });
});

describe('resultTone', () => {
  it('tells a first run apart from a beat and from a miss', () => {
    expect(resultTone(null, 20)).toBe('first');
    expect(resultTone(18, 19)).toBe('record');
    expect(resultTone(18, 18)).toBe('short');
    expect(resultTone(18, 2)).toBe('short');
  });
});
