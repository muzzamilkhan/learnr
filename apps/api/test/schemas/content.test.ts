import { describe, expect, it } from 'vitest';
import { CONTENT_MANIFEST, PACKS } from '@learnr/core/content/packs';
import { FIGURE_KINDS } from '@learnr/core/figures/types';
import { figureKindModule } from '@learnr/core/figures/registry';
import {
  choiceSpecSchema,
  contentManifestSchema,
  figureSpecSchema,
  questionTemplateSchema,
  varSpecSchema,
} from '../../src/schemas/dto.js';

const templates = PACKS.flatMap((pack) => pack.templates);

describe('questionTemplateSchema', () => {
  /**
   * A response schema is a serializer: a zod object strips what it does not
   * declare, so a field left out of the schema does not fail - it vanishes
   * from the response and a client parses a smaller object happily. Leaving
   * `rightAngles` off the polygon arm would take the right-angle ticks off
   * every polygon question on the way to iOS, with nothing to see.
   *
   * This is the whole corpus rather than a sample, which is what makes it a
   * guard rather than a spot check.
   */
  it('round-trips all 507 shipped templates without losing a field', () => {
    expect(templates).toHaveLength(507);
    for (const template of templates) {
      expect(questionTemplateSchema.parse(template)).toEqual(template);
    }
  });

  it('is exercised by every figure kind', () => {
    const used = new Set(templates.map((t) => t.figure?.kind).filter(Boolean));
    expect([...used].sort()).toEqual([...FIGURE_KINDS].sort());
  });

  it('is exercised by every variable kind', () => {
    const used = new Set(templates.flatMap((t) => t.vars.map((v) => v.kind)));
    expect([...used].sort()).toEqual(['expr', 'int', 'number', 'pick']);
  });

  /**
   * The round-trip above is total over shipped *content*, which is not the
   * same as total over the *schema*: most of what a figure can pin is
   * deliberately left to jitter, so no shipped template sets `polygon.rotation`
   * or `angle.arc` at all. The registry's own `fields` table is what each kind
   * really has, so holding the schema to it covers the fields content does not
   * reach, and keeps covering them when a kind gains one.
   */
  it('declares exactly the fields the registry says each kind has', () => {
    for (const kind of FIGURE_KINDS) {
      const declared = Object.keys(figureKindModule(kind)!.fields).sort();
      const arm = figureSpecSchema.options.find((option) => option.shape.kind.value === kind);

      expect(arm, `no schema arm for ${kind}`).toBeDefined();
      expect(Object.keys(arm!.shape).filter((key) => key !== 'kind').sort()).toEqual(declared);
    }
  });

  /**
   * `CheckEachArm` iterates the *DTO's* discriminants, so an extra schema arm
   * under a `kind` the DTO never takes is never visited by it - the schema
   * could carry a stray thirteenth figure kind or a fifth var kind and the
   * compile-time check would stay green. Pinning the arm count is what makes
   * that structurally impossible rather than merely unobserved.
   */
  it('has exactly one figure schema arm per figure kind, and no more', () => {
    expect(figureSpecSchema.options).toHaveLength(FIGURE_KINDS.length);
  });

  it('has exactly one var schema arm per var kind, and no more', () => {
    expect(varSpecSchema.options).toHaveLength(4);
  });

  /**
   * Two `ChoiceSpec` fields no shipped template uses - `jitter`, the fallback
   * distractor generator, and `propertyIsTheQuestion`, which no template needs
   * yet. `Mirrored` holds them by key set, and this holds them through an
   * actual serialization, which is the half key comparison cannot do.
   */
  it('keeps the choice fields shipped content never uses', () => {
    const spec = {
      count: 4,
      distractors: ['x + 1'],
      jitter: { min: '1', max: '5' },
      rankIsTheQuestion: true,
      propertyIsTheQuestion: true,
    };

    expect(choiceSpecSchema.parse(spec)).toEqual(spec);
  });
});

describe('contentManifestSchema', () => {
  /**
   * The manifest schemas had no runtime exercise at all before this - a
   * schema that only ever meets the compiler's structural check can still
   * throw on real bytes (an `integer` where a count is fractional, say), and
   * that gap is exactly why the earlier `templateCount` break surprised the
   * plan: nothing here parsed the manifest to notice. This is the same shape
   * as the template round-trip above, against the one manifest that ships.
   */
  it('round-trips the shipped manifest without losing a field', () => {
    expect(contentManifestSchema.parse(CONTENT_MANIFEST)).toEqual(CONTENT_MANIFEST);
  });
});
