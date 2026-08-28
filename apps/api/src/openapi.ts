import type { SwaggerTransformObject } from '@fastify/swagger';
import { jsonSchemaTransformObject } from 'fastify-type-provider-zod';

const PREFIX = '#/components/schemas/';

/**
 * The document, with every schema named and the unreachable half thrown away.
 *
 * `jsonSchemaTransformObject` emits **two** entries per registered schema - an
 * output variant and an `Input` one - because zod 4 distinguishes what a schema
 * accepts from what it produces, and for a few of these that distinction is
 * real. It emits both whichever the routes actually use, and offers no way to
 * ask for one: for 62 shapes here that is 62 dead twins, and a generator does
 * not know they are dead. `swift-openapi-generator` emits a Swift type per
 * entry in `components/schemas`, referenced or not, so shipping the document as
 * it comes hands iOS a `ChildProfile` and a `ChildProfileInput` with nothing to
 * say which is the one to use.
 *
 * So this keeps what the paths can actually reach. A request body refs the
 * input variant and a response the output one, which makes reachability exactly
 * the right test - it keeps both where both are genuinely used and neither
 * where the schema never crosses in that direction, without a list saying so.
 *
 * It has to run here rather than in `scripts/openapi.ts`, because `swagger()`
 * is what serves `GET /openapi.json` as well as what the script writes: pruning
 * in the script alone would leave the served document and the committed one
 * disagreeing, and a client reading the live endpoint - which is what iOS does,
 * having no clone - would get the unpruned one.
 */
export const transformObject: SwaggerTransformObject = (input) => {
  const document = jsonSchemaTransformObject(input) as {
    paths?: unknown;
    components?: { schemas?: Record<string, unknown> };
  };

  const schemas = document.components?.schemas;
  if (!schemas) return document as ReturnType<SwaggerTransformObject>;

  return {
    ...document,
    components: { ...document.components, schemas: reachable(schemas, document.paths) },
  } as ReturnType<SwaggerTransformObject>;
};

/** The schemas the paths reach, directly or through another schema. */
function reachable(
  schemas: Record<string, unknown>,
  paths: unknown,
): Record<string, unknown> {
  const seen = new Set<string>();
  const pending = referencesIn(paths);

  while (pending.length > 0) {
    const name = pending.pop() as string;
    if (seen.has(name) || !(name in schemas)) continue;
    seen.add(name);
    pending.push(...referencesIn(schemas[name]));
  }

  return Object.fromEntries(Object.entries(schemas).filter(([name]) => seen.has(name)));
}

/**
 * Every `#/components/schemas/...` name inside a value.
 *
 * Walked rather than pattern-matched on the serialized form: a `$ref` is the
 * only thing that makes a schema reachable, and a string that merely looks like
 * one - a description quoting a ref, say - must not keep a dead schema alive.
 */
function referencesIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(referencesIn);
  if (value === null || typeof value !== 'object') return [];

  return Object.entries(value).flatMap(([key, child]) =>
    key === '$ref' && typeof child === 'string' && child.startsWith(PREFIX)
      ? [child.slice(PREFIX.length)]
      : referencesIn(child),
  );
}
