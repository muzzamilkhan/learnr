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
 * What is said about a nullable `$ref` in place of the null the encoding cannot
 * carry. Prose because there is nowhere else to put it: see below.
 */
const NULLABLE_REF_NOTE =
  'May be null. The null is not expressible beside a $ref in OpenAPI 3.1, so it is said here instead.';

/**
 * Every nullable union rewritten into a form a generator does not throw away.
 *
 * **This is for the generator alone, and nothing else can see it.** Validation
 * and serialization here run off the zod schemas rather than off this document
 * - so no request is accepted or refused differently, and no response changes
 * shape. What changes is what `swift-openapi-generator` makes of it: handed
 * `anyOf: [X, {type: 'null'}]` it **silently drops the property**, so
 * `Account.role` and `Account.parentId` simply do not appear on the generated
 * Swift type, with no warning and nothing red. 45 of them, across 16 component
 * schemas, `learnr-ios`'s `L18`.
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
 * **There are two rewrites, because the two halves have different remedies**,
 * and both were measured on the Mac against the generator itself rather than
 * argued from the spec (`L18`, `L19`):
 *
 * - **`X` is a type**: `type: [X, 'null']`, the canonical 3.1 spelling and
 *   exactly equivalent. `null` still decodes to `nil`, and nothing warns.
 * - **`X` is a `$ref`**: `allOf: [{$ref}]`, the ref alone, with the null member
 *   **dropped**. A keyword beside `$ref` is ignored by design, so there is no
 *   3.1 encoding that keeps the null *and* the reference - `oneOf`, `anyOf` and
 *   3.0's `nullable: true` were each measured and each lose the property or the
 *   shared type. The lone-member `allOf` is the one form that generates
 *   `role: rolePayload?` - optional, decoding an explicit `null` to `nil`, and
 *   wrapping the **shared** `Role` rather than a per-site copy of it.
 *
 * **The second rewrite drops something true, which is why it says so in
 * prose.** `allOf: [{$ref: Role}]` asserts a `Role`, and a validator reading
 * this document would refuse the `null` that `viewerKind`'s fourth answer is
 * made of. Nothing here validates against the document, so the cost is to a
 * reader rather than to a request - and a reader is exactly who a `description`
 * is for. It rides into the generated Swift as a doc comment, which is where
 * the person who needs it is looking. An authored description outranks it, so
 * this can never overwrite something someone meant.
 *
 * **And the second rewrite is only half a remedy on its own, which is the third
 * thing this does**: a rewritten `$ref` is dropped from its object's `required`
 * as well. Having just asserted a `Role` where a null can arrive, leaving the
 * name in `required` makes the generator emit a **non-optional** property, and
 * a real `null` then throws at decode rather than landing as `nil` - the same
 * property lost as before, now noisily and on a device. The two are one change
 * and are written as one, in the same walk off the same test, because a
 * document carrying the `allOf` without the drop is strictly worse than the
 * `anyOf` it replaced: `swift-openapi-generator` at least *dropped* the
 * property quietly, where this would fail the whole response. `learnr-ios`'s
 * `L24` measured all three cases against the generator - an explicit `null`, a
 * value, and an absent key - and only this pair passes all three.
 *
 * **It widens the document by exactly one case the server never produces.**
 * `required` is what says a key is always sent, and these six always are: the
 * zod schemas are untouched and still declare them `.nullable()` rather than
 * `.optional()`, so Fastify still refuses to serialize a response missing one.
 * That is the reason this lives here and not in `dto.ts` - as a zod change it
 * would have loosened the serializer, which is the one thing `Mirrored` exists
 * to keep exact, and the compiler said so.
 */
export function collapseNullableUnions<T>(value: T): T {
  if (Array.isArray(value)) return value.map(collapseNullableUnions) as T;
  if (value === null || typeof value !== 'object') return value;

  const walked = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, collapseNullableUnions(child)]),
  );

  const pruned = withoutNullableRefsInRequired(value, walked);

  const { anyOf, ...rest } = pruned as { anyOf?: unknown };
  const other = nullableMember(anyOf);
  if (!other) return pruned as T;

  if ('$ref' in other) {
    return {
      description: NULLABLE_REF_NOTE,
      // Whatever sat beside the union outranks what is invented here.
      ...rest,
      allOf: [other],
    } as T;
  }

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
 * The object's `required` with every property this walk rewrote into a nullable
 * `$ref` taken out of it - see the third bullet on `collapseNullableUnions`.
 *
 * Decided off the **original** property rather than off the rewritten one, so
 * the test is "zod emitted a nullable `$ref` here" rather than "this ended up
 * looking like one". An authored `allOf` of a single `$ref` is a thing someone
 * may legitimately write, and it is not this and must keep its `required`.
 */
function withoutNullableRefsInRequired(
  original: object,
  walked: Record<string, unknown>,
): Record<string, unknown> {
  const { properties, required } = original as {
    properties?: Record<string, unknown>;
    required?: unknown;
  };
  if (!properties || typeof properties !== 'object' || !Array.isArray(required)) return walked;

  const isNullableRef = (name: unknown) => {
    if (typeof name !== 'string') return false;
    const property = properties[name] as { anyOf?: unknown } | undefined;
    const other = property ? nullableMember(property.anyOf) : undefined;
    return other !== undefined && '$ref' in other;
  };

  const kept = required.filter((name) => !isNullableRef(name));
  return kept.length === required.length ? walked : { ...walked, required: kept };
}

/**
 * The non-null half of `anyOf: [X, {type: 'null'}]`, where that is what this
 * is and `X` is one of the two shapes with a remedy.
 *
 * Deliberately narrow. A third member, a null member carrying anything else, a
 * `$ref` with a sibling keyword, or an `X` that is already a type array all
 * mean this is not the shape zod's nullable emits, and guessing at those is how
 * a transform for a generator starts changing what the document says.
 */
function nullableMember(
  anyOf: unknown,
): ({ type: string } & Record<string, unknown>) | { $ref: string } | undefined {
  if (!Array.isArray(anyOf) || anyOf.length !== 2) return undefined;

  const isNull = (member: unknown) =>
    typeof member === 'object' &&
    member !== null &&
    Object.keys(member).length === 1 &&
    (member as { type?: unknown }).type === NULL_SCHEMA;

  const nulls = anyOf.filter(isNull);
  if (nulls.length !== 1) return undefined;

  const other = anyOf.find((member) => !isNull(member));
  if (typeof other !== 'object' || other === null) return undefined;

  const keys = Object.keys(other);
  if (keys.length === 1 && typeof (other as { $ref?: unknown }).$ref === 'string') {
    return other as { $ref: string };
  }

  return typeof (other as { type?: unknown }).type === 'string'
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
