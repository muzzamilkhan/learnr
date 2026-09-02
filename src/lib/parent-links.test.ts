import { describe, expect, it } from 'vitest';
import { PROGRESS_HREF, PROGRESS_LAB_HREF, progressHref } from './parent-links';

describe('progressHref', () => {
  it('keeps the screen it was given', () => {
    expect(progressHref(PROGRESS_LAB_HREF, { child: 'kid1', subject: 'english' })).toBe(
      '/progress/lab?child=kid1&subject=english',
    );
  });

  it('falls back to the report for a path that does not read these parameters', () => {
    expect(progressHref('/children', { child: 'kid1' })).toBe('/progress?child=kid1');
    expect(progressHref(null, { child: 'kid1' })).toBe('/progress?child=kid1');
  });

  it('leaves out what it was not told', () => {
    expect(progressHref(PROGRESS_HREF)).toBe('/progress');
    expect(progressHref(PROGRESS_LAB_HREF, { child: null, subject: 'maths' })).toBe(
      '/progress/lab?subject=maths',
    );
  });

  it('escapes what it puts in the query', () => {
    expect(progressHref(PROGRESS_HREF, { child: 'a b&c' })).toBe('/progress?child=a%20b%26c');
  });
});
