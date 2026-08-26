import { describe, expect, it } from 'vitest';
import { PACKS } from '@learnr/core/content/packs';
import { FIGURE_KINDS } from '@learnr/core/figures/types';
import '@learnr/core/figures/build';
import { figureKindModule } from '@learnr/core/figures/registry';
import {
  choiceSpecSchema,
  figureSpecSchema,
  questionTemplateSchema,
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
  it('round-trips all 505 shipped templates without losing a field', () => {
    expect(templates).toHaveLength(505);
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
