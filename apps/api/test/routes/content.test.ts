import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { startDatabase, stopDatabase } from '../helpers/db.js';
import { buildServer } from '../../src/server.js';

let app: FastifyInstance;

beforeAll(async () => {
  await startDatabase();
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await stopDatabase();
});

const packDir = join(import.meta.dirname, '../../../../src/content/packs');
const committed = (name: string) => JSON.parse(readFileSync(join(packDir, name), 'utf8'));

describe('GET /content/manifest', () => {
  it('answers a reader with no session at all', async () => {
    const response = await app.inject({ method: 'GET', url: '/content/manifest' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(committed('manifest.json'));
  });

  it('carries the version as an ETag and answers 304 to it', async () => {
    const first = await app.inject({ method: 'GET', url: '/content/manifest' });
    const etag = first.headers.etag as string;
    expect(etag).toBe(`"${committed('manifest.json').version}"`);

    const second = await app.inject({
      method: 'GET', url: '/content/manifest', headers: { 'if-none-match': etag },
    });
    expect(second.statusCode).toBe(304);
    // 304 must be genuinely bodyless - see the doc comment on the route's
    // response schema for why that depends on `.send()` taking no argument.
    expect(second.body).toBe('');
    expect(second.headers['content-type']).toBeUndefined();
    expect(second.headers['content-length']).toBeUndefined();
  });
});

describe('GET /content/:subject/:level', () => {
  /**
   * The strongest guard in this file: a response schema strips what it does
   * not declare, so serving the pack and comparing it against the committed
   * bytes is what proves nothing was lost between the two.
   */
  it('serves a pack exactly as it was committed', async () => {
    const response = await app.inject({ method: 'GET', url: '/content/maths/3' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(committed('maths.3.json'));
  });

  it('keeps every figure and every constraint on the way out', async () => {
    const pack = (await app.inject({ method: 'GET', url: '/content/maths/5' })).json();
    const source = committed('maths.5.json');

    expect(pack.templates.filter((t: { figure?: unknown }) => t.figure))
      .toEqual(source.templates.filter((t: { figure?: unknown }) => t.figure));
    expect(pack.templates.filter((t: { constraints?: unknown }) => t.constraints))
      .toEqual(source.templates.filter((t: { constraints?: unknown }) => t.constraints));
  });

  it('normalises the level the way every other boundary does', async () => {
    const lower = await app.inject({ method: 'GET', url: '/content/maths/k' });

    expect(lower.statusCode).toBe(200);
    expect(lower.json().level).toBe('K');
  });

  it('answers 304 to a matching ETag', async () => {
    const first = await app.inject({ method: 'GET', url: '/content/english/2' });
    const second = await app.inject({
      method: 'GET', url: '/content/english/2',
      headers: { 'if-none-match': first.headers.etag as string },
    });

    expect(second.statusCode).toBe(304);
    // Same requirement as the manifest's 304: no body, no content headers.
    expect(second.body).toBe('');
    expect(second.headers['content-type']).toBeUndefined();
    expect(second.headers['content-length']).toBeUndefined();
  });

  it('is a 404 for a year that is not one', async () => {
    const response = await app.inject({ method: 'GET', url: '/content/maths/9' });
    expect(response.statusCode).toBe(404);
  });

  it('is a 404 for a subject nobody ships', async () => {
    const response = await app.inject({ method: 'GET', url: '/content/history/3' });
    expect(response.statusCode).toBe(404);
  });
});
