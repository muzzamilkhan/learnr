import { afterEach, describe, expect, it } from 'vitest';
import { uuid } from './browser-api';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const real = crypto.randomUUID;
afterEach(() => {
  crypto.randomUUID = real;
});

describe('uuid', () => {
  it('is a v4 uuid, which is what the endpoint validates against', () => {
    expect(uuid()).toMatch(V4);
  });

  it('does not repeat itself', () => {
    const many = new Set(Array.from({ length: 500 }, uuid));
    expect(many.size).toBe(500);
  });

  // Safari only grew randomUUID in 15.4, and the device this is built for is an
  // iPad that may be older than that. The fallback has to produce something the
  // endpoint still accepts, or a sitting is lost silently.
  it('still produces one where crypto.randomUUID does not exist', () => {
    // Restored in `afterEach`, so a later test is not left on the fallback.
    // @ts-expect-error - standing in for a browser that never had it.
    crypto.randomUUID = undefined;

    expect(uuid()).toMatch(V4);
    expect(new Set(Array.from({ length: 200 }, uuid)).size).toBe(200);
  });
});
