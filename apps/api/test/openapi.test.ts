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

  /**
   * **No nullable is left as a union a generator will drop.**
   *
   * The third failure with the shape the two above have: nothing goes red when
   * this breaks. `anyOf: [X, {type: 'null'}]` is what zod must emit under
   * OpenAPI 3.1, it validates, it serializes, it describes the right shape -
   * and `swift-openapi-generator` silently omits the property, so
   * `Account.role` and `Account.parentId` are simply absent from the generated
   * type with nothing to read. `collapseNullableUnions` rewrites them; this is
   * what says it still runs and still reaches everything.
   */
  it('leaves no nullable union a generator would drop', async () => {
    const document = app.swagger();

    const unions = (value: unknown, path: string): string[] => {
      if (Array.isArray(value)) return value.flatMap((child, i) => unions(child, `${path}/${i}`));
      if (value === null || typeof value !== 'object') return [];

      const here =
        'anyOf' in value &&
        Array.isArray(value.anyOf) &&
        value.anyOf.some((member) => (member as { type?: unknown })?.type === 'null')
          ? [path]
          : [];

      return [
        ...here,
        ...Object.entries(value).flatMap(([key, child]) => unions(child, `${path}/${key}`)),
      ];
    };

    expect(unions(document, '')).toEqual([]);
  });

  /**
   * **The nullable `$ref`s, named, because their rewrite loses the null.**
   *
   * The other thirty-eight collapse to `type: [X, 'null']` and say everything
   * they said before. These seven cannot: a keyword beside `$ref` is ignored by design,
   * so `allOf: [{$ref}]` is the only form the generator keeps, and it asserts
   * the referent where the truth is "that, or null". The `description` is what
   * carries the difference, and it is the whole of what a reader gets.
   *
   * **Asserted as a set equality, not an emptiness**, for the reason the
   * divergence lists in `catalog.test.ts` are: a new nullable `$ref` is a new
   * property whose null a client cannot see, and it should have to be looked at
   * rather than joining these quietly.
   *
   * **And none of them may be in its object's `required`**, which is the other
   * half of the same remedy and the half that fails loudly. `allOf: [{$ref}]`
   * plus `required` generates a *non-optional* property, so a real null throws
   * at decode instead of landing as `nil` - worse than the drop it replaced,
   * because it fails the whole response rather than one field. The two are
   * asserted together, off the one list, so neither can be true without the
   * other.
   */
  it('names every nullable $ref, whose null the encoding cannot carry', () => {
    const document = app.swagger();

    const wrapped = (value: unknown, path: string): string[] => {
      if (Array.isArray(value)) return value.flatMap((child, i) => wrapped(child, `${path}/${i}`));
      if (value === null || typeof value !== 'object') return [];

      const here =
        'allOf' in value && Array.isArray(value.allOf)
          ? [path]
          : [];

      return [
        ...here,
        ...Object.entries(value).flatMap(([key, child]) => wrapped(child, `${path}/${key}`)),
      ];
    };

    expect(wrapped(document, '').sort()).toEqual([
      '/components/schemas/Account/properties/avatar',
      '/components/schemas/Account/properties/role',
      '/components/schemas/ChildProfile/properties/target',
      '/components/schemas/FamilyRecord/properties/playerAvatar',
      '/components/schemas/PlayerState/properties/target',
      '/components/schemas/SpeedOutcome/properties/standing',
      '/components/schemas/ViewableChild/properties/target',
    ]);

    const { Account } = (document as unknown as {
      components: { schemas: Record<string, { properties: Record<string, unknown> }> };
    }).components.schemas;

    expect(Account.properties.role).toEqual({
      description: expect.stringContaining('May be null'),
      allOf: [{ $ref: '#/components/schemas/Role' }],
    });

    const schemas = (document as unknown as {
      components: { schemas: Record<string, { required?: string[] }> };
    }).components.schemas;

    const stillRequired = wrapped(document, '')
      .map((path) => path.slice('/components/schemas/'.length).split('/properties/'))
      .filter(([schema, property]) => schemas[schema]?.required?.includes(property))
      .map(([schema, property]) => `${schema}.${property}`);

    expect(stillRequired).toEqual([]);
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
