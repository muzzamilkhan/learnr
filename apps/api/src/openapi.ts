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
  if (!schemas) return collapseNullableUnions(document) as ReturnType<SwaggerTransformObject>;

  return collapseNullableUnions({
    ...document,
    components: { ...document.components, schemas: reachable(schemas, document.paths) },
  }) as ReturnType<SwaggerTransformObject>;
};

/** The two-member union a nullable comes out as, and what it collapses to. */
const NULL_SCHEMA = 'null';

/**
 * Every `anyOf: [X, {type: 'null'}]` rewritten as `type: [X, 'null']`.
 *
 * **This is for the generator alone, and nothing else can see it.** The two
 * forms are exactly equivalent in JSON Schema, and validation and serialization
 * here run off the zod schemas rather than off this document - so no request is
 * accepted or refused differently, and no response changes shape. What changes
 * is what `swift-openapi-generator` makes of it: handed the union it **silently
 * drops the property**, so `Account.role` and `Account.parentId` simply do not
 * appear on the generated Swift type, with no warning and nothing red. 45 of
 * them, across 16 component schemas, `learnr-ios`'s `L18`.
 *
 * The union is not a mistake on the way in - it is what
 * `fastify-type-provider-zod` must emit, because `server.ts` declares
 * `openapi: 3.1.0` and zod's nullable processor has two branches: `nullable:
 * true` under `openapi-3.0` and the null union under everything else. 3.1
 * deleted `nullable`, so the output is spec-correct and generator-hostile at
 * once.
 *
 * **Dropping the document to 3.0 to get `nullable: true` back is the one-line
 * fix, and it is refused.** The same target switch makes zod emit a tuple as an
 * `items` array rather than `prefixItems`, which OAS 3.0 does not allow -  and
 * the tuples are `Mark.points` and the three `Mark.at`, the coordinates every
 * figure is drawn from. That trades a dropped null for droppable geometry, on
 * the one shape a parent's report draws a picture out of.
 *
 * Seven nullable `$ref`s are left as they are (`Account.role`, two `Avatar`s,
 * three `DailyTarget`s, `SpeedOutcome.standing`): a keyword beside `$ref` is
 * ignored by design, so there is no 3.1 encoding to collapse them into. That is
 * a fact about the spec rather than about this repo, and what to do instead -
 * inline the shape, or hand-write the Swift - depends on a measurement only the
 * Mac can take.
 */
export function collapseNullableUnions<T>(value: T): T {
  if (Array.isArray(value)) return value.map(collapseNullableUnions) as T;
  if (value === null || typeof value !== 'object') return value;

  const walked = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, collapseNullableUnions(child)]),
  );

  const { anyOf, ...rest } = walked as { anyOf?: unknown };
  const other = nullableMember(anyOf);
  if (!other) return walked as T;

  return {
    ...other,
    // Whatever sat beside the union outranks the member's own copy of it: it
    // was written about the nullable as a whole.
    ...rest,
    type: [other.type, NULL_SCHEMA],
    // `enum` restricts the value whatever `type` permits, so a collapse that
    // left it alone would produce a schema refusing the null the union allowed
    // - the same silent narrowing, wearing the fix's clothes.
    ...(Array.isArray(other.enum) ? { enum: [...other.enum, null] } : {}),
  } as T;
}

/**
 * The non-null half of `anyOf: [X, {type: 'null'}]`, where that is what this
 * is and `X` is collapsible.
 *
 * Deliberately narrow. A third member, a null member carrying anything else, or
 * an `X` that is a `$ref` or already a type array all mean this is not the
 * shape zod's nullable emits, and guessing at those is how a transform for a
 * generator starts changing what the document says.
 */
function nullableMember(
  anyOf: unknown,
): ({ type: string } & Record<string, unknown>) | undefined {
  if (!Array.isArray(anyOf) || anyOf.length !== 2) return undefined;

  const isNull = (member: unknown) =>
    typeof member === 'object' &&
    member !== null &&
    Object.keys(member).length === 1 &&
    (member as { type?: unknown }).type === NULL_SCHEMA;

  const nulls = anyOf.filter(isNull);
  if (nulls.length !== 1) return undefined;

  const other = anyOf.find((member) => !isNull(member));
  return typeof other === 'object' && other !== null && typeof (other as { type?: unknown }).type === 'string'
    ? (other as { type: string } & Record<string, unknown>)
    : undefined;
}

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
