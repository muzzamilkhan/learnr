import { describe, expect, it } from 'vitest';

import { collapseNullableUnions } from '../src/openapi.js';

/**
 * The collapse is arithmetic on a document rather than anything the server
 * does, so it is tested here directly - the document-level guard in
 * `openapi.test.ts` says the real contract carries no union left to collapse,
 * and this says the rewrite is faithful where it fires and keeps its hands off
 * where it does not.
 */
describe('collapseNullableUnions', () => {
  it('collapses a two-member union into a type array', () => {
    expect(
      collapseNullableUnions({ anyOf: [{ type: 'string' }, { type: 'null' }] }),
    ).toEqual({ type: ['string', 'null'] });
  });

  it('keeps the member\'s own keywords', () => {
    // `targetValue`: the bounds are the whole of what the schema says beyond
    // the type, and dropping them would widen the contract silently.
    expect(
      collapseNullableUnions({
        anyOf: [{ type: 'integer', exclusiveMinimum: 0, maximum: 60 }, { type: 'null' }],
      }),
    ).toEqual({ type: ['integer', 'null'], exclusiveMinimum: 0, maximum: 60 });
  });

  /**
   * The one that is not equivalent by inspection. `enum` restricts the value
   * whatever `type` allows, so `type: ['string','null']` beside
   * `enum: ['questions','minutes']` is a schema that rejects null - the
   * opposite of what the union it replaced meant, and exactly the silent
   * narrowing this whole change exists to undo.
   */
  it('adds null to an enum, or the collapse would stop permitting it', () => {
    expect(
      collapseNullableUnions({
        anyOf: [{ type: 'string', enum: ['questions', 'minutes'] }, { type: 'null' }],
      }),
    ).toEqual({ type: ['string', 'null'], enum: ['questions', 'minutes', null] });
  });

  it('collapses inside arrays, properties and nested schemas alike', () => {
    expect(
      collapseNullableUnions({
        components: {
          schemas: {
            Report: {
              type: 'object',
              properties: {
                rows: {
                  anyOf: [
                    { type: 'array', items: { anyOf: [{ type: 'number' }, { type: 'null' }] } },
                    { type: 'null' },
                  ],
                },
              },
            },
          },
        },
      }),
    ).toEqual({
      components: {
        schemas: {
          Report: {
            type: 'object',
            properties: {
              rows: {
                type: ['array', 'null'],
                items: { type: ['number', 'null'] },
              },
            },
          },
        },
      },
    });
  });

  /**
   * The rewrite that loses something, and the only one there is. A sibling
   * keyword beside `$ref` is ignored by design, so there is no 3.1 encoding
   * that keeps both the null and the reference - and the two that keep the
   * null (`anyOf`, `oneOf`) are the ones the generator throws the property
   * away for. `allOf: [{$ref}]` is what it accepts, measured on the Mac
   * against the generator itself: optional, `null` decoding to `nil`, and the
   * shared `Role` rather than a copy inlined per site.
   */
  it('wraps a nullable $ref in a lone-member allOf', () => {
    expect(
      collapseNullableUnions({
        anyOf: [{ $ref: '#/components/schemas/Role' }, { type: 'null' }],
      }),
    ).toEqual({
      description: expect.stringContaining('May be null'),
      allOf: [{ $ref: '#/components/schemas/Role' }],
    });
  });

  /**
   * The null is gone from the schema, so the description is the whole of what
   * a reader has left - which makes it worth saying that an authored one wins.
   * Somebody explaining what a null *means* here must not be overwritten by
   * the boilerplate explaining that there is one.
   */
  it('lets an authored description outrank the note about the null', () => {
    expect(
      collapseNullableUnions({
        description: 'Unclaimed until the first sign-in',
        anyOf: [{ $ref: '#/components/schemas/Role' }, { type: 'null' }],
      }),
    ).toEqual({
      description: 'Unclaimed until the first sign-in',
      allOf: [{ $ref: '#/components/schemas/Role' }],
    });
  });

  it('leaves a $ref carrying anything else alone', () => {
    // Not the shape zod's nullable emits, so whatever put a keyword beside the
    // ref meant something this transform has no way to preserve.
    const union = {
      anyOf: [{ $ref: '#/components/schemas/Role', description: 'a role' }, { type: 'null' }],
    };

    expect(collapseNullableUnions(union)).toEqual(union);
  });

  it('leaves unions that are not about null alone', () => {
    const union = { anyOf: [{ type: 'string' }, { type: 'number' }] };

    expect(collapseNullableUnions(union)).toEqual(union);
  });

  it('leaves a three-member union alone', () => {
    // Not this transform's business: collapsing two of three members would
    // change what the third sits beside.
    const union = {
      anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }],
    };

    expect(collapseNullableUnions(union)).toEqual(union);
  });

  it('leaves a null member carrying anything else alone', () => {
    // `{type:'null', description:...}` is a schema with something to say, and
    // the collapse has nowhere to put it.
    const union = {
      anyOf: [{ type: 'string' }, { type: 'null', description: 'absent' }],
    };

    expect(collapseNullableUnions(union)).toEqual(union);
  });

  it('keeps what sits beside the union', () => {
    // Nothing in the contract puts a `description` on a nullable today, so
    // this is a net rather than a case: the collapse must not be the thing
    // that eats one when something does.
    expect(
      collapseNullableUnions({
        description: 'What a parent set',
        anyOf: [{ type: 'string' }, { type: 'null' }],
      }),
    ).toEqual({ description: 'What a parent set', type: ['string', 'null'] });
  });

  it('does not mutate what it is given', () => {
    const document = { anyOf: [{ type: 'string' }, { type: 'null' }] };
    const before = structuredClone(document);

    collapseNullableUnions(document);

    expect(document).toEqual(before);
  });
});
