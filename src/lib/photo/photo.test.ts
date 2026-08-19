import { describe, expect, it } from 'vitest';
import { MAX_PHOTO_BYTES, PHOTO_PREFIX, parsePhoto } from './photo';

const photo = (bytes: number) => PHOTO_PREFIX + 'A'.repeat(Math.ceil((bytes * 4) / 3));

describe('parsePhoto', () => {
  it('accepts a webp data url', () => {
    expect(parsePhoto(photo(1000))).toBe(photo(1000));
  });

  it('accepts base64 padding', () => {
    expect(parsePhoto(`${PHOTO_PREFIX}AAAA==`)).toBe(`${PHOTO_PREFIX}AAAA==`);
  });

  it('refuses anything that is not a webp data url', () => {
    expect(parsePhoto('https://example.com/child.jpg')).toBeNull();
    expect(parsePhoto('data:image/jpeg;base64,AAAA')).toBeNull();
    expect(parsePhoto('data:text/html;base64,AAAA')).toBeNull();
    expect(parsePhoto('javascript:alert(1)')).toBeNull();
  });

  it('refuses a payload that is not base64', () => {
    expect(parsePhoto(`${PHOTO_PREFIX}not base64!`)).toBeNull();
    expect(parsePhoto(PHOTO_PREFIX)).toBeNull();
  });

  it('refuses more bytes than a cropped photo can be', () => {
    expect(parsePhoto(photo(MAX_PHOTO_BYTES - 100))).not.toBeNull();
    expect(parsePhoto(photo(MAX_PHOTO_BYTES + 100))).toBeNull();
  });

  it('reads nothing as nothing', () => {
    expect(parsePhoto(null)).toBeNull();
    expect(parsePhoto(undefined)).toBeNull();
    expect(parsePhoto('')).toBeNull();
  });
});
