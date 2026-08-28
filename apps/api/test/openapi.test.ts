import { readFile } from 'node:fs/promises';
import { dump } from 'js-yaml';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { buildServer } from '../src/server.js';
import * as common from '../src/schemas/common.js';
import * as account from '../src/schemas/account.js';
import * as play from '../src/schemas/play.js';
import * as dto from '../src/schemas/dto.js';

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

  /**
   * **Every boundary schema is named, so a generator can share it.**
   *
   * A schema without a registry id is inlined at each use site, and the two
   * copies generate as two unrelated types - `ChildProfile` from
   * `GET /children` with no relation to the identical shape from
   * `GET /children/viewable`. Nothing else goes red when that happens: the
   * document still validates, still serializes, and still describes the right
   * shape. It is only the generated client that gets worse.
   *
   * `registerComponents` derives the ids from the export names precisely so
   * this cannot be forgotten per schema - this holds it to that.
   */
  it('names every boundary schema in components/schemas', () => {
    const unregistered = Object.entries({ ...common, ...account, ...play, ...dto })
      .filter(([name, value]) => name.endsWith('Schema') && value instanceof z.ZodType)
      .filter(([, value]) => !z.globalRegistry.get(value as z.ZodType)?.id)
      .map(([name]) => name);

    expect(unregistered).toEqual([]);
  });

  /**
   * **Nothing dangling, and nothing dead.**
   *
   * Two failures with one shape. A `$ref` to a schema that is not there is a
   * generator crash; a schema nothing refs is a Swift type generated for a
   * shape the API never sends, which is what the `Input` twins would be if the
   * prune in `src/openapi.ts` stopped working. Reachability catches both ends
   * at once, and neither shows up anywhere else - a document can be wrong in
   * both these ways and still serve every request correctly.
   */
  it('leaves no reference dangling and no schema unreachable', () => {
    const document = app.swagger() as unknown as {
      paths: unknown;
      components: { schemas: Record<string, unknown> };
    };
    const schemas = document.components.schemas;

    const refs = (value: unknown): string[] => {
      if (Array.isArray(value)) return value.flatMap(refs);
      if (value === null || typeof value !== 'object') return [];
      return Object.entries(value).flatMap(([key, child]) =>
        key === '$ref' && typeof child === 'string'
          ? [child.replace('#/components/schemas/', '')]
          : refs(child),
      );
    };

    const reached = new Set<string>();
    const pending = refs(document.paths);
    while (pending.length > 0) {
      const name = pending.pop() as string;
      if (reached.has(name)) continue;
      reached.add(name);
      pending.push(...refs(schemas[name]));
    }

    expect([...reached].filter((name) => !(name in schemas))).toEqual([]);
    expect(Object.keys(schemas).filter((name) => !reached.has(name))).toEqual([]);
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
