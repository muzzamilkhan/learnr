import { describe, expect, it } from 'vitest';
import { googleConfigured, sessionsReadable } from './auth-config';

// The bug this task exists for: no Google credentials, but a secret and a
// database - a password session is written, and must still be read.
describe('sessionsReadable', () => {
  it('is true without Google credentials', () => {
    expect(sessionsReadable({ secret: 'x', database: true, googleId: null, googleSecret: null }))
      .toBe(true);
  });

  it('is false with no secret', () => {
    expect(sessionsReadable({ secret: null, database: true, googleId: 'a', googleSecret: 'b' }))
      .toBe(false);
  });

  it('is false with no database, since a session is a row', () => {
    expect(sessionsReadable({ secret: 'x', database: false, googleId: 'a', googleSecret: 'b' }))
      .toBe(false);
  });
});

describe('googleConfigured', () => {
  it('needs both Google variables and the secret', () => {
    expect(googleConfigured({ secret: 'x', database: true, googleId: 'a', googleSecret: 'b' }))
      .toBe(true);
    expect(googleConfigured({ secret: 'x', database: true, googleId: 'a', googleSecret: null }))
      .toBe(false);
    expect(googleConfigured({ secret: null, database: true, googleId: 'a', googleSecret: 'b' }))
      .toBe(false);
  });
});
