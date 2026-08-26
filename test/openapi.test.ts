import { readFile } from 'node:fs/promises';
import { dump } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = buildServer();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe('the OpenAPI document', () => {
  it('describes every route the clients depend on', async () => {
    const response = await app.inject({ method: 'GET', url: '/openapi.json' });
    expect(response.statusCode).toBe(200);

    const paths = Object.keys(response.json().paths);

    expect(paths).toEqual(
      expect.arrayContaining([
        '/auth/redeem',
        '/me',
        '/sessions',
        '/sessions/{id}/attempts',
        '/sessions/{id}/award-round',
        '/children',
        '/children/{id}/report',
        '/speed/runs',
      ]),
    );
  });

  // The contract is the artifact the web client and the Swift Codable types are
  // generated from. A committed copy that has drifted from the routes is worse
  // than none: every client would be generated against a shape the server no
  // longer serves.
  it('matches the copy committed to contract/openapi.yaml', async () => {
    const committed = await readFile('contract/openapi.yaml', 'utf8');

    expect(dump(app.swagger())).toBe(committed);
  });
});
