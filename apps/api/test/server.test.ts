import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

const ORIGIN = 'https://learnr.muzza.tech';
const before = process.env.LEARNR_WEB_ORIGINS;

afterEach(() => {
  if (before === undefined) delete process.env.LEARNR_WEB_ORIGINS;
  else process.env.LEARNR_WEB_ORIGINS = before;
});

describe('the server', () => {
  it('answers a health check', async () => {
    const app = buildServer();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    await app.close();
  });
});

/**
 * The browser calls this API directly now, from a different origin to its own,
 * and it has to send the session cookie with the call. That needs the two
 * headers below together - a wildcard origin is refused by every browser once
 * credentials are involved, which is why the allowlist is exact.
 */
describe('cross-origin calls from the web app', () => {
  const serverAllowing = async (origins: string) => {
    process.env.LEARNR_WEB_ORIGINS = origins;
    const app = buildServer();
    await app.ready();
    return app;
  };

  it('lets the web app through, with credentials', async () => {
    const app = await serverAllowing(ORIGIN);
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: ORIGIN },
    });

    expect(response.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    await app.close();
  });

  it('says nothing to an origin that is not on the list', async () => {
    const app = await serverAllowing(ORIGIN);
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://not-learnr.example' },
    });

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('allows more than one origin, so a local web app can reach a real API', async () => {
    const app = await serverAllowing(`${ORIGIN},http://localhost:3000`);
    const response = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    });

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    await app.close();
  });

  /**
   * A JSON POST is never a simple request, so every recorded answer would cost a
   * preflight *and* the call - two round trips where the whole point of moving
   * the browser onto this API was to spend one. `max-age` is what stops that:
   * the browser asks once and reuses the answer.
   */
  it('answers a preflight and lets the browser cache it', async () => {
    const app = await serverAllowing(ORIGIN);
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/sessions',
      headers: {
        origin: ORIGIN,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.statusCode).toBeLessThan(300);
    expect(response.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(Number(response.headers['access-control-max-age'])).toBeGreaterThan(0);
    await app.close();
  });
});
