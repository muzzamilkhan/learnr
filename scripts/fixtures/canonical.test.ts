import { describe, expect, it } from 'vitest';
import type { Figure, Mark } from '../../src/lib/figures/types';
import type { GeneratedQuestion } from '../../src/lib/templates/types';
import {
  canonicaliseCase,
  canonicalFigure,
  canonicalMark,
  canonicalQuestion,
  digest,
  FIELD_SEP,
  MARK_FIELDS,
  NAME_SEP,
  QUESTION_FIELDS,
} from './canonical';

const question = (over: Partial<GeneratedQuestion> = {}): GeneratedQuestion => ({
  prompt: 'What is 7 - 3?',
  answer: 4,
  answerType: 'number',
  vars: { x: 7, y: 3 },
  ...over,
});

describe('canonicalQuestion', () => {
  it('names every field and stringifies with JavaScript semantics', () => {
    expect(canonicalQuestion(question())).toEqual([
      ['prompt', 'What is 7 - 3?'],
      ['answer', '4'],
      ['answerType', 'number'],
      ['vars.x', '7'],
      ['vars.y', '3'],
    ]);
  });

  it('writes a whole number without a decimal point, which is the port trap', () => {
    const [, answer] = canonicalQuestion(question({ answer: 4 / 2 }))[1];
    expect(answer).toBe('2');
  });

  it('sorts vars by name, because a Swift dictionary has no order to borrow', () => {
    const fields = canonicalQuestion(question({ vars: { z: 1, a: 2, m: 3 } }));
    expect(fields.filter(([n]) => n.startsWith('vars.')).map(([n]) => n)).toEqual([
      'vars.a',
      'vars.m',
      'vars.z',
    ]);
  });

  it('omits an absent optional field rather than emitting it empty', () => {
    const names = canonicalQuestion(question()).map(([n]) => n);
    expect(names).not.toContain('choices');
    expect(names).not.toContain('hint');
    expect(names.some((n) => n.startsWith('figure.'))).toBe(false);
  });

  it('carries choices and hint when they are there', () => {
    const fields = canonicalQuestion(
      question({ answerType: 'choice', choices: [4, 5, 6], hint: 'Count back from 7.' }),
    );
    expect(fields).toContainEqual(['choices', '4|5|6']);
    expect(fields).toContainEqual(['hint', 'Count back from 7.']);
  });
});

describe('canonicalMark', () => {
  it('writes each of the four kinds', () => {
    expect(
      canonicalMark({
        kind: 'path',
        points: [
          [12.5, 80],
          [45, 80],
        ],
        closed: true,
        fill: false,
        dashed: false,
      }),
    ).toBe('path|12.5,80 45,80|true|false|false');

    expect(canonicalMark({ kind: 'arc', at: [50, 50], radius: 12, from: 0, to: 90 })).toBe(
      'arc|50,50|12|0|90',
    );
    expect(canonicalMark({ kind: 'dot', at: [1, 2] })).toBe('dot|1,2');
    expect(canonicalMark({ kind: 'label', at: [1, 2], text: '3 cm' })).toBe(
      'label|1,2|3 cm',
    );
  });
});

describe('canonicalFigure', () => {
  it('flattens to width, height and one field per mark in emitted order', () => {
    const figure: Figure = {
      width: 100,
      height: 100,
      marks: [
        { kind: 'dot', at: [1, 2] },
        { kind: 'label', at: [3, 4], text: 'A' },
      ],
    };
    expect(canonicalFigure(figure)).toEqual([
      ['figure.width', '100'],
      ['figure.height', '100'],
      ['figure.mark.0', 'dot|1,2'],
      ['figure.mark.1', 'label|3,4|A'],
    ]);
  });
});

describe('canonicaliseCase', () => {
  it('joins name to value and field to field', () => {
    expect(
      canonicaliseCase([
        ['prompt', 'Hi'],
        ['answer', '4'],
      ]),
    ).toBe(`prompt${NAME_SEP}Hi${FIELD_SEP}answer${NAME_SEP}4`);
  });

  it('refuses a value carrying a separator, so the assumption is checked', () => {
    expect(() => canonicaliseCase([['prompt', `a${FIELD_SEP}b`]])).toThrow(/separator/);
    expect(() => canonicaliseCase([['prompt', `a${NAME_SEP}b`]])).toThrow(/separator/);
    expect(() => canonicaliseCase([['prompt', 'a\nb']])).toThrow(/separator/);
  });
});

describe('digest', () => {
  it('is twelve hex characters, stable, and moves with the content', () => {
    expect(digest(['a', 'b'])).toMatch(/^[0-9a-f]{12}$/);
    expect(digest(['a', 'b'])).toBe(digest(['a', 'b']));
    expect(digest(['a', 'b'])).not.toBe(digest(['a', 'c']));
  });

  it('does not confuse one case with two, because cases join on a newline', () => {
    expect(digest(['ab'])).not.toBe(digest(['a', 'b']));
  });
});

/**
 * `CanonicalCovers` only proves `QUESTION_FIELDS` and `MARK_FIELDS` name every
 * key the types have - the compiler holds the *list* against the type. It
 * proves nothing about whether `canonicalQuestion` and `canonicalMark` actually
 * *emit* a field once it is on the list: a name added to `QUESTION_FIELDS` (or
 * `MARK_FIELDS`) with no corresponding line in the function typechecks clean
 * and every digest stays byte-identical. These hold the emission against the
 * list, at runtime, against a value with every optional field present.
 */
describe('field emission matches the declared field lists', () => {
  it('canonicalQuestion emits every field QUESTION_FIELDS declares', () => {
    const fullyPopulated: GeneratedQuestion = {
      prompt: 'What is 7 - 3?',
      answer: 4,
      answerType: 'choice',
      choices: [4, 5, 6],
      hint: 'Count back from 7.',
      vars: { x: 7, y: 3 },
      figure: {
        width: 100,
        height: 100,
        marks: [{ kind: 'dot', at: [1, 2] }],
      },
    };

    const names = canonicalQuestion(fullyPopulated).map(([n]) => n);

    for (const declared of QUESTION_FIELDS) {
      if (declared === 'vars') {
        expect(names.some((n) => n.startsWith('vars.'))).toBe(true);
      } else if (declared === 'figure') {
        expect(names.some((n) => n.startsWith('figure.'))).toBe(true);
      } else {
        expect(names).toContain(declared);
      }
    }
  });

  it('canonicalMark emits a value that carries every field MARK_FIELDS declares, for every kind', () => {
    const marks: Record<Mark['kind'], Mark> = {
      path: {
        kind: 'path',
        points: [
          [12.5, 80],
          [45, 80],
        ],
        closed: true,
        fill: true,
        dashed: true,
      },
      arc: { kind: 'arc', at: [50, 50], radius: 12, from: 0, to: 90 },
      dot: { kind: 'dot', at: [1, 2] },
      label: { kind: 'label', at: [1, 2], text: '3 cm' },
    };

    const contributionOf: Record<string, (mark: Mark) => string> = {
      kind: (mark) => mark.kind,
      points: (mark) => (mark.kind === 'path' ? mark.points.map((p) => `${p[0]},${p[1]}`).join(' ') : ''),
      closed: (mark) => (mark.kind === 'path' ? String(mark.closed) : ''),
      fill: (mark) => (mark.kind === 'path' ? String(mark.fill) : ''),
      dashed: (mark) => (mark.kind === 'path' ? String(mark.dashed) : ''),
      at: (mark) => (mark.kind !== 'path' ? `${mark.at[0]},${mark.at[1]}` : ''),
      radius: (mark) => (mark.kind === 'arc' ? String(mark.radius) : ''),
      from: (mark) => (mark.kind === 'arc' ? String(mark.from) : ''),
      to: (mark) => (mark.kind === 'arc' ? String(mark.to) : ''),
      text: (mark) => (mark.kind === 'label' ? mark.text : ''),
    };

    for (const kind of Object.keys(MARK_FIELDS) as (keyof typeof MARK_FIELDS)[]) {
      const mark = marks[kind];
      const value = canonicalMark(mark);
      for (const field of MARK_FIELDS[kind]) {
        const contribution = contributionOf[field](mark);
        expect(value).toContain(contribution);
      }
    }
  });
});
