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

  /**
   * **Every operation is named, and no two share a name.**
   *
   * `operationId` is what a generator turns into a method name.
   * `swift-openapi-generator` synthesises one from the path when it is missing,
   * so `POST /sessions/{id}/attempts` becomes
   * `post_sol_sessions_sol__lcub_id_rcub__sol_attempts` - which compiles, reads
   * as line noise, and moves the moment a path does. Naming them here means the
   * iOS client's call sites are stable against a path change and legible
   * without one.
   *
   * Uniqueness is the half a generator cannot recover from: two operations
   * sharing an id collide into one method, and which one survives is the
   * generator's business rather than ours.
   */
  it('names every operation, uniquely', async () => {
    const paths = app.swagger().paths ?? {};
    const ids = Object.entries(paths).flatMap(([path, item]) =>
      Object.entries(item as Record<string, { operationId?: string }>).map(
        ([method, operation]) => ({ where: `${method.toUpperCase()} ${path}`, id: operation.operationId }),
      ),
    );

    expect(ids.filter((o) => !o.id).map((o) => o.where)).toEqual([]);
    expect(new Set(ids.map((o) => o.id)).size).toBe(ids.length);
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
