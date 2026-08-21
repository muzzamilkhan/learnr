import { describe, it, expect } from 'vitest';
import { POLYGON_SHAPES, type FigureSpec } from '../figures/types';
import { validateSpec, validateTemplate } from './validate';
import type { QuestionTemplate } from './types';

const valid: QuestionTemplate = {
  id: 'sub-basic',
  subject: 'maths',
  topic: 'subtraction',
  level: 'K',
  prompt: 'What is the difference between {x} and {y}?',
  vars: [
    { name: 'x', kind: 'int', min: '5', max: '10' },
    { name: 'y', kind: 'int', min: '5', max: '10' },
  ],
  constraints: ['x > y'],
  answer: 'x - y',
};

const errorsFor = (template: unknown) => validateTemplate(template).errors;

describe('validateTemplate', () => {
  it('accepts a well formed template', () => {
    const result = validateTemplate(valid);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('requires the identifying fields', () => {
    expect(errorsFor({ ...valid, id: '' })).toContainEqual(expect.stringMatching(/id/i));
    expect(errorsFor({ ...valid, subject: '' })).toContainEqual(expect.stringMatching(/subject/i));
    expect(errorsFor({ ...valid, topic: '' })).toContainEqual(expect.stringMatching(/topic/i));
  });

  it('requires level to be a school year, not a number or an invented year', () => {
    expect(errorsFor({ ...valid, level: 1 })).toContainEqual(expect.stringMatching(/level/i));
    expect(errorsFor({ ...valid, level: '13' })).toContainEqual(expect.stringMatching(/level/i));
    expect(errorsFor({ ...valid, level: 'kindy' })).toContainEqual(expect.stringMatching(/level/i));
    expect(errorsFor({ ...valid, level: '6' })).toEqual([]);
  });

  it('rejects duplicate variable names', () => {
    const template = { ...valid, vars: [...valid.vars, { name: 'x', kind: 'int', min: '1', max: '2' }] };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/duplicate variable.*x/i));
  });

  it('rejects expressions that reference unbound variables', () => {
    expect(errorsFor({ ...valid, answer: 'x - z' })).toContainEqual(
      expect.stringMatching(/unknown variable: z/i),
    );
    expect(errorsFor({ ...valid, prompt: 'What is {q}?' })).toContainEqual(
      expect.stringMatching(/unknown variable: q/i),
    );
  });

  it('rejects a variable referencing one declared after it', () => {
    const template = {
      ...valid,
      vars: [
        { name: 'x', kind: 'int', min: '1', max: 'y' },
        { name: 'y', kind: 'int', min: '1', max: '9' },
      ],
    };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/unknown variable: y/i));
  });

  it('rejects malformed expressions', () => {
    expect(errorsFor({ ...valid, answer: 'x -' })).toContainEqual(
      expect.stringMatching(/answer/i),
    );
  });

  it('rejects a pick list that is empty', () => {
    const template = { ...valid, vars: [{ name: 'op', kind: 'pick', from: [] }], answer: '1' };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/op.*empty|empty.*op/i));
  });

  it('accepts a true/false template', () => {
    const template = {
      ...valid,
      prompt: 'Is {x} bigger than {y}?',
      constraints: [],
      answer: 'x > y',
    };
    expect(errorsFor(template)).toEqual([]);
  });

  it('caps multiple choice at four options, which is what the screen fits', () => {
    const choice = (count: number) => ({
      ...valid,
      answerType: 'choice' as const,
      choices: { count, jitter: { min: '1', max: '9' } },
    });

    expect(errorsFor(choice(2))).toEqual([]);
    expect(errorsFor(choice(4))).toEqual([]);
    expect(errorsFor(choice(1))).toContainEqual(expect.stringMatching(/choices\.count/i));
    expect(errorsFor(choice(5))).toContainEqual(expect.stringMatching(/choices\.count/i));
  });

  it('rejects choices on a true/false template, which already has its two options', () => {
    const boolean = { ...valid, constraints: undefined, answer: 'isEven(x)' };
    expect(errorsFor(boolean)).toEqual([]);

    // Caught whether the author declared the type or left it to be inferred.
    expect(
      errorsFor({ ...boolean, answerType: 'boolean', choices: { count: 2, distractors: ['1'] } }),
    ).toContainEqual(expect.stringMatching(/true\/false|boolean/i));
    expect(errorsFor({ ...boolean, choices: { count: 2, distractors: ['1'] } })).toContainEqual(
      expect.stringMatching(/true\/false|boolean/i),
    );
  });

  it('reports an answerType that disagrees with what the answer evaluates to', () => {
    // Generation coerces these so a session never crashes, so validation is the
    // only place an author finds out.
    expect(errorsFor({ ...valid, answerType: 'boolean' })).toContainEqual(
      expect.stringMatching(/answerType/i),
    );
    expect(
      errorsFor({ ...valid, constraints: [], answer: 'x > y', answerType: 'number' }),
    ).toContainEqual(expect.stringMatching(/answerType/i));
    expect(
      errorsFor({
        ...valid,
        constraints: [],
        answer: 'x > y',
        answerType: 'choice',
        choices: { count: 2, distractors: ['1'] },
      }),
    ).toContainEqual(expect.stringMatching(/answerType|true\/false|boolean/i));

    // `choice` and `text` accept a number or a string, so neither is a mismatch.
    expect(errorsFor({ ...valid, answerType: 'text' })).toEqual([]);
  });

  it('rejects a multiple choice template with nothing to choose from', () => {
    expect(errorsFor({ ...valid, answerType: 'choice' })).toContainEqual(
      expect.stringMatching(/choice.*requires choices/i),
    );
  });

  it('catches templates whose constraints can never be satisfied', () => {
    const template = { ...valid, constraints: ['x > 1000'] };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/constraint/i));
  });

  it('reports every problem at once rather than stopping at the first', () => {
    const errors = errorsFor({ ...valid, id: '', subject: '', answer: 'nope' });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('rejects values that are not templates at all', () => {
    expect(errorsFor(null).length).toBeGreaterThan(0);
    expect(errorsFor('a string').length).toBeGreaterThan(0);
    expect(errorsFor({ ...valid, vars: 'not an array' }).length).toBeGreaterThan(0);
  });
});

describe('validateSpec', () => {
  it('accepts a spec with no id, subject, topic or level', () => {
    expect(
      validateSpec({
        prompt: '{x} + {y}',
        vars: [
          { name: 'x', kind: 'int', min: '1', max: '9' },
          { name: 'y', kind: 'int', min: '1', max: '9' },
        ],
        answer: 'x + y',
      }).valid,
    ).toBe(true);
  });

  it('still catches an unbound variable', () => {
    const result = validateSpec({
      prompt: '{x} + {z}',
      vars: [{ name: 'x', kind: 'int', min: '1', max: '9' }],
      answer: 'x + z',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('z');
  });

  it('still catches constraints that can never be satisfied', () => {
    const result = validateSpec({
      prompt: '{x}',
      vars: [{ name: 'x', kind: 'int', min: '1', max: '9' }],
      constraints: ['x > 100'],
      answer: 'x',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('generation failed');
  });
});

describe('validateTemplate figures', () => {
  // A regular shape has no free proportion, so a fixed name and a jittered
  // rotation are the whole story - which is exactly what should pass.
  const hexagon: QuestionTemplate = {
    ...valid,
    id: 'hexagon',
    prompt: 'What shape is this?',
    vars: [],
    constraints: [],
    answer: "'hexagon'",
    figure: { kind: 'polygon', shape: "'hexagon'" },
  };

  it('accepts a well formed figure template', () => {
    expect(errorsFor(hexagon)).toEqual([]);
  });

  it('rejects an unknown figure kind', () => {
    const template = { ...hexagon, figure: { kind: 'triangle', shape: "'hexagon'" } };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/figure\.kind.*not a figure kind/i));
  });

  it('rejects a figure parameter that references an unbound variable', () => {
    const template = { ...hexagon, figure: { kind: 'polygon', shape: 'q' } };
    expect(errorsFor(template)).toContainEqual(expect.stringMatching(/figure\.shape.*unknown variable: q/i));
  });

  it('rejects a figure parameter that figureIssues would clamp', () => {
    const template = {
      ...hexagon,
      answer: "'reflex'",
      figure: { kind: 'angle', degrees: '500' },
    };
    expect(errorsFor(template)).toContainEqual(
      expect.stringMatching(/figure\.degrees.*500.*outside 1-359/i),
    );
  });

  // A regular hexagon's proportions are fixed by its name; pinning rotation
  // too leaves nothing left to vary, so every draw is byte-identical.
  const pinned = { ...hexagon, figure: { ...hexagon.figure, rotation: '0' } };

  it('catches a pinned rotation on a regular polygon as an anchored diagram', () => {
    expect(errorsFor(pinned)).toContainEqual(
      expect.stringMatching(/the answer "hexagon" always drew the same picture/i),
    );
  });

  it('passes the same template once the pin is removed', () => {
    // Derived from `pinned` itself, not `hexagon` freshly: the point of the
    // pair is that removing exactly the field the first test blamed is what
    // clears the error, not that some other unpinned template happens to pass.
    const unpinnedFigure = Object.fromEntries(
      Object.entries(pinned.figure).filter(([key]) => key !== 'rotation'),
    );
    expect(errorsFor({ ...pinned, figure: unpinnedFigure })).toEqual([]);
  });

  // The 50 seeds the anchoring check draws are not the only thing standing
  // between a bad literal and a clean validation: a `pick` over many names
  // draws each one with only roughly a 1/n chance per seed, so a wide pick
  // can go fifty draws without ever trying its worst value. This must catch
  // that regardless of luck, which is why it does not lean on a template id
  // that happens to dodge the bad name under the current seeds - it enumerates
  // every literal a `pick` can produce and asks `figureIssues` about each one
  // directly. If `figureIssues` goes back to being called only on the draws
  // the anchoring loop happens to make, this is the test that catches it.
  it('checks every literal a pick can produce, not just the ones fifty seeds happened to draw', () => {
    const shapes = POLYGON_SHAPES.map((shape) => (shape === 'rectangle' ? 'bogus' : shape));
    const template: QuestionTemplate = {
      ...valid,
      // This id is not arbitrary: under the seeds `validate-${label}-figure-${i}`
      // derives, 'bogus' is never once the value fifty draws pick for this
      // particular id - confirmed by simulating `createRng` directly. A test
      // that instead trusted the first id it tried would have quietly proven
      // nothing, exactly as the reviewer's own repro warns.
      id: 'wide-pick-bad-shape-1',
      prompt: 'What shape is this?',
      vars: [{ name: 's', kind: 'pick', from: shapes }],
      constraints: [],
      answer: 's',
      figure: { kind: 'polygon', shape: 's' },
    };
    expect(errorsFor(template)).toContainEqual(
      expect.stringMatching(/figure\.shape.*bogus.*not a known shape/i),
    );
  });

  it('does not fold a boolean and a same-spelled text answer into one anchoring group', () => {
    // `t == 1` pins the hexagon's rotation - an anchored diagram, by itself -
    // but only on the branch whose answer is the boolean `true`. The other
    // branch answers the *text* `'true'` and varies its rotation freely. If
    // the two answers were grouped by `String(answer)` they would collide
    // (`String(true) === String('true')`) and the varying branch's figures
    // would hide the pinned branch's failure inside the same group.
    const template: QuestionTemplate = {
      ...valid,
      id: 'boolean-vs-text-answer',
      prompt: 'What shape is this?',
      vars: [
        { name: 't', kind: 'pick', from: [1, 2] },
        { name: 'j', kind: 'int', min: '0', max: '359' },
      ],
      constraints: [],
      answer: "t == 1 ? true : 'true'",
      figure: { kind: 'polygon', shape: "'hexagon'", rotation: 't == 1 ? 0 : j' },
    };
    expect(errorsFor(template)).toContainEqual(
      expect.stringMatching(/the answer true always drew the same picture/i),
    );
  });

  it('derives a figure parameter routed through an expr var, not just one bound directly', () => {
    // `shapeName` is an `expr` var reading the pick, not the pick itself -
    // and `figure.shape` reads `shapeName`. Forcing `s` by patching a
    // finished scope (the mechanism this replaced) leaves `shapeName` at
    // whatever value the scope it was copied from already had, so the forced
    // literal never actually reaches the figure. `tryBindForced` walks
    // `spec.vars` in order instead, so `shapeName` is recomputed against the
    // forced `s` the way it would be for a real draw.
    const shapes = POLYGON_SHAPES.map((shape) => (shape === 'rectangle' ? 'bogus' : shape));
    const template: QuestionTemplate = {
      ...valid,
      // Confirmed by simulating `createRng` directly, the same way as above:
      // 'bogus' is never the value any of this id's fifty draws pick.
      id: 'expr-pick-bad-shape-105',
      prompt: 'What shape is this?',
      vars: [
        { name: 's', kind: 'pick', from: shapes },
        { name: 'shapeName', kind: 'expr', expr: 's' },
      ],
      constraints: [],
      answer: 's',
      figure: { kind: 'polygon', shape: 'shapeName' },
    };
    expect(errorsFor(template)).toContainEqual(
      expect.stringMatching(/figure\.shape.*bogus.*not a known shape/i),
    );
  });

  it('crosses two pick vars rather than forcing them one at a time', () => {
    // `mirror: true` on a scalene triangle is the bad case `figureIssues`
    // flags - a scalene has no line of symmetry - and it only arises when
    // `shape` and `wantMirror` land on `'scalene'` and `true` *together*.
    // Forcing one pick var while the other sits at whatever a single earlier
    // draw happened to bind (the mechanism this replaced) only reaches that
    // pairing if the earlier draw already half-matched it by chance; this id
    // was confirmed by simulation to dodge the pairing both in the fifty
    // draws themselves and in that one-at-a-time fallback.
    // `from` is `readonly (string | number)[]` on a `pick` var, so the two
    // "want a mirror" states are `0`/`1` rather than `false`/`true` - the
    // index a `pick` draws (and therefore the RNG calls it costs) is the same
    // either way, so the simulation used to pick this id still applies.
    const shapes = ['equilateral', 'scalene', 'square', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'kite'];
    const template: QuestionTemplate = {
      ...valid,
      id: 'two-pick-bad-pair-51',
      prompt: 'Is the dashed line a line of symmetry?',
      vars: [
        { name: 'shape', kind: 'pick', from: shapes },
        { name: 'wantMirror', kind: 'pick', from: [0, 1] },
      ],
      constraints: [],
      answer: 'wantMirror == 1',
      figure: { kind: 'polygon', shape: 'shape', mirror: 'wantMirror == 1' },
    };
    expect(errorsFor(template)).toContainEqual(
      expect.stringMatching(/figure\.mirror.*scalene.*no line of symmetry/i),
    );
  });

  // `array`'s `orientation` jitters which of `rows` and `columns` is drawn as
  // which - see `array-kind.ts`'s module comment for why the 50-seed
  // anchoring check above cannot see a template whose answer reads one of
  // them directly. `answerIssues` on `arrayModule` (dispatched here with no
  // kind name in the call, per `registry.ts`) is the one static, heuristic
  // check that can - and it is exactly that, a heuristic: the next two
  // `describe`s cover the case it is built to catch and the two ways it can
  // fire on a template that was never actually broken.
  describe('array orientation', () => {
    const ORIENTATION_MESSAGE = /answer is written as exactly figure\.(rows|columns)/i;

    const arrayTemplate = (overrides: Partial<QuestionTemplate> = {}): QuestionTemplate => ({
      ...valid,
      id: 'array-rows',
      prompt: 'How many rows are there?',
      vars: [
        { name: 'r', kind: 'int', min: '2', max: '5' },
        { name: 'c', kind: 'int', min: '2', max: '5' },
      ],
      constraints: ['r != c'],
      answer: 'r',
      figure: { kind: 'array', rows: 'r', columns: 'c' },
      ...overrides,
    });

    it('rejects an answer that reads figure.rows directly with orientation left open', () => {
      expect(errorsFor(arrayTemplate())).toContainEqual(expect.stringMatching(ORIENTATION_MESSAGE));
    });

    it('rejects an answer that reads figure.columns directly with orientation left open', () => {
      const template = arrayTemplate({
        prompt: 'How many columns are there?',
        answer: 'c',
      });
      expect(errorsFor(template)).toContainEqual(expect.stringMatching(ORIENTATION_MESSAGE));
    });

    it('passes the same template once orientation is pinned', () => {
      // `toEqual([])` rather than `not.toContainEqual` - the point is not
      // merely that this one message is gone, it is that pinning orientation
      // makes the template fully shippable.
      const template = arrayTemplate({
        figure: { kind: 'array', rows: 'r', columns: 'c', orientation: "'rows'" },
      });
      expect(errorsFor(template)).toEqual([]);
    });

    it('says nothing about an answer that is not a dimension, orientation left open', () => {
      const template = arrayTemplate({
        prompt: 'How many dots are there altogether?',
        answer: 'r * c',
      });
      expect(errorsFor(template)).not.toContainEqual(expect.stringMatching(ORIENTATION_MESSAGE));
    });

    // The check is textual, not semantic, so it can fire on a template that
    // was never actually broken - see `array-kind.ts`'s "Two ways
    // `answerIssues` can be wrong about intent". Both are real, both unblock
    // by pinning `orientation` regardless of why they fired, and the message
    // says only what was detected rather than asserting either is a bug.
    describe('coincidental matches', () => {
      it('fires on a literal answer that happens to equal a literal rows by chance', () => {
        // A decorative array beside an unrelated arithmetic question - the
        // figure illustrates nothing about "1 + 2", it just happens to have
        // three rows.
        const template: QuestionTemplate = {
          ...valid,
          id: 'array-decoration',
          prompt: 'What is 1 + 2?',
          vars: [],
          constraints: [],
          answer: '3',
          figure: { kind: 'array', rows: '3', columns: '5' },
        };
        expect(errorsFor(template)).toContainEqual(expect.stringMatching(ORIENTATION_MESSAGE));
      });

      it('fires on rows and columns kept equal by a constraint, where the transpose is a no-op', () => {
        const template = arrayTemplate({ constraints: ['r == c'] });
        expect(errorsFor(template)).toContainEqual(expect.stringMatching(ORIENTATION_MESSAGE));
      });

      it('is fully unblocked by pinning orientation, even though the transpose was always a no-op', () => {
        // The remedy the message above gives is sound regardless of *why* it
        // fired: pinning `orientation` never breaks a template that did not
        // need it. This also confirms `array-kind.ts`'s "no free proportion"
        // refusal does not then re-block it - `rows`/`columns` here are `r`
        // and `c`, not closed expressions, so that check has nothing to say
        // about a grid whose actual size still varies draw to draw.
        const template = arrayTemplate({
          constraints: ['r == c'],
          figure: { kind: 'array', rows: 'r', columns: 'c', orientation: "'rows'" },
        });
        expect(errorsFor(template)).toEqual([]);
      });
    });
  });

  // Finding 3: a fully pinned array's only lever is a cell-aspect wobble too
  // small for a child to see (`array-kind.ts`'s "Refusing the no-lever
  // case") - the identical situation `CLAUDE.md` already refuses for a
  // regular polygon's pinned rotation, applied explicitly here because the
  // wobble keeps every draw byte-different, which is what stops the generic
  // 50-seed check from ever seeing this one on its own.
  describe('array with no free proportion left', () => {
    const literalArray = (
      overrides: Partial<Extract<FigureSpec, { kind: 'array' }>> = {},
    ): QuestionTemplate => ({
      ...valid,
      id: 'array-literal',
      prompt: 'How many dots altogether?',
      vars: [],
      constraints: [],
      answer: '16',
      figure: { kind: 'array', rows: '4', columns: '4', ...overrides },
    });

    it('refuses a literal square array, orientation omitted', () => {
      expect(errorsFor(literalArray())).toContainEqual(
        expect.stringMatching(/no free proportion left/i),
      );
    });

    it('refuses a literal square array, orientation pinned', () => {
      expect(errorsFor(literalArray({ orientation: "'rows'" }))).toContainEqual(
        expect.stringMatching(/no free proportion left/i),
      );
    });

    it('refuses a literal, non-square array with orientation pinned', () => {
      expect(
        errorsFor(literalArray({ rows: '3', columns: '5', orientation: "'columns'" })),
      ).toContainEqual(expect.stringMatching(/no free proportion left/i));
    });

    it('does not refuse a literal, non-square array with orientation left open', () => {
      // The real lever here is the transpose, which actually varies - this
      // is legitimate content, not the no-lever trap.
      expect(errorsFor(literalArray({ rows: '3', columns: '5' }))).toEqual([]);
    });

    it('does not refuse rows and columns kept equal by a var and a constraint', () => {
      // Not a literal square - `r` and `c` vary in real, visible size across
      // draws even though a constraint keeps them equal to each other on
      // every one. Refusing this would be exactly the false positive the
      // "closed expression" guard in `array-kind.ts` exists to avoid.
      const template: QuestionTemplate = {
        ...valid,
        id: 'array-var-square',
        prompt: 'How many dots altogether?',
        vars: [
          { name: 'r', kind: 'int', min: '2', max: '5' },
          { name: 'c', kind: 'int', min: '2', max: '5' },
        ],
        constraints: ['r == c'],
        answer: 'r * c',
        figure: { kind: 'array', rows: 'r', columns: 'c', orientation: "'rows'" },
      };
      expect(errorsFor(template)).toEqual([]);
    });
  });
});

describe('choice leakage', () => {
  // The shipped shape that fails: place-value distractors always sort into the
  // same order, so the answer sits at a fixed rank every single draw.
  it('rejects a choice question whose answer is always the same sorted rank', () => {
    const result = validateTemplate({
      id: 'maths.6.measurement.leaky',
      subject: 'maths', topic: 'measurement', level: '6',
      prompt: 'How many kilograms is {g} grams?',
      vars: [
        { name: 'n', kind: 'int', min: '3', max: '199' },
        { name: 'g', kind: 'expr', expr: 'n * 50' },
      ],
      answer: 'n * 50 / 1000',
      answerType: 'choice',
      choices: { count: 4, distractors: ['n * 50 / 100', 'n * 50 / 10000', 'n * 50'] },
      tags: ['AC9M6M01'],
    });

    expect(result.errors.join(' ')).toMatch(/rank/i);
  });

  // Finding the largest IS the question, so a fixed rank is honest here - but
  // only because the template says so.
  it('accepts a fixed rank when the template declares that is the question', () => {
    const spec = {
      id: 'maths.5.decimals.largest',
      subject: 'maths', topic: 'decimals', level: '5',
      prompt: 'Which of these is the largest: {a}, {b} or {c}?',
      vars: [
        { name: 'a', kind: 'number', min: '0.1', max: '9.9', decimals: '1' },
        { name: 'b', kind: 'number', min: '0.1', max: '9.9', decimals: '1' },
        { name: 'c', kind: 'number', min: '0.1', max: '9.9', decimals: '1' },
      ],
      constraints: ['a != b', 'b != c', 'a != c'],
      answer: 'max(a, max(b, c))',
      answerType: 'choice',
      tags: ['AC9M5N01'],
    } as const;

    const leaky = validateTemplate({ ...spec, choices: { count: 3, distractors: ['a', 'b', 'c'] } });
    expect(leaky.errors.join(' ')).toMatch(/rank/i);

    const declared = validateTemplate({
      ...spec,
      choices: { count: 3, distractors: ['a', 'b', 'c'], rankIsTheQuestion: true },
    });
    expect(declared.errors).toEqual([]);
  });

  // The Kindergarten pattern shape: three colours from three disjoint pick
  // lists, and the answer is always the one from the middle list. Narration
  // reads the options aloud, so this is beatable without reading at all.
  it('rejects a choice question whose answer never appears as a wrong option', () => {
    const result = validateTemplate({
      id: 'maths.K.patterns.leaky',
      subject: 'maths', topic: 'patterns', level: 'K',
      prompt: 'What comes next? {a}, {b}, {c}, {a}, {b}, {c}, {a}, ?',
      vars: [
        { name: 'a', kind: 'pick', from: ['red', 'blue'] },
        { name: 'b', kind: 'pick', from: ['yellow', 'orange'] },
        { name: 'c', kind: 'pick', from: ['green', 'purple'] },
      ],
      answer: 'b',
      answerType: 'choice',
      choices: { count: 3, distractors: ['a', 'c'] },
      tags: ['AC9MFA01'],
    });

    expect(result.errors.join(' ')).toMatch(/option set|never a distractor|announces/i);
  });

  // "Which of these is even?" is disjoint by definition - an odd distractor
  // can never be an even answer - so the usual remedy is arithmetically
  // impossible, and there is no shortcut: the magnitudes overlap, so parity is
  // the only thing telling the buttons apart. `e` is small here on purpose;
  // that is the K-3 scale of this question, and the scale the check fires at.
  const evenAndOdd = {
    id: 'maths.2.even-and-odd.which',
    subject: 'maths', topic: 'even and odd', level: '2',
    prompt: 'Which of these numbers is even?',
    vars: [
      { name: 'e', kind: 'int', min: '1', max: '6' },
      { name: 'o', kind: 'int', min: '0', max: '8' },
      { name: 'p', kind: 'int', min: '0', max: '8' },
    ],
    constraints: ['o != p'],
    answer: 'e * 2',
    answerType: 'choice',
    tags: ['AC9M2N01'],
  } as const;

  const evenChoices = { count: 3, distractors: ['o * 2 + 1', 'p * 2 + 1'] };

  it('accepts a disjoint option set when the template declares the property is the question', () => {
    const undeclared = validateTemplate({ ...evenAndOdd, choices: evenChoices });
    expect(undeclared.errors.join(' ')).toMatch(/option set/i);

    const declared = validateTemplate({
      ...evenAndOdd,
      choices: { ...evenChoices, propertyIsTheQuestion: true },
    });
    expect(declared.errors).toEqual([]);
  });

  it('keeps the two opt-outs apart', () => {
    // Declaring the property does not excuse a fixed rank.
    const rankLeak = validateTemplate({
      id: 'maths.6.measurement.leaky',
      subject: 'maths', topic: 'measurement', level: '6',
      prompt: 'How many kilograms is {g} grams?',
      vars: [
        { name: 'n', kind: 'int', min: '3', max: '199' },
        { name: 'g', kind: 'expr', expr: 'n * 50' },
      ],
      answer: 'n * 50 / 1000',
      answerType: 'choice',
      choices: {
        count: 4,
        distractors: ['n * 50 / 100', 'n * 50 / 10000', 'n * 50'],
        propertyIsTheQuestion: true,
      },
      tags: ['AC9M6M01'],
    });
    expect(rankLeak.errors.join(' ')).toMatch(/rank/i);

    // And declaring the rank does not excuse a disjoint option set.
    const optionSetLeak = validateTemplate({
      ...evenAndOdd,
      choices: { ...evenChoices, rankIsTheQuestion: true },
    });
    expect(optionSetLeak.errors.join(' ')).toMatch(/option set/i);
  });

  it('says nothing about an option set that was still growing when the draws ran out', () => {
    // Eight possible answers is exactly `CLOSED_SET_MAX`, so the size guard
    // cannot be what silences this - a new answer value was still turning up
    // in the last third of the draws, which means the draws ran out before the
    // answer's range did. Whether nine possible answers show eight or nine in
    // forty draws is a fact about the seeds, and a gate must not turn on it.
    const result = validateTemplate({
      ...evenAndOdd,
      id: 'maths.2.even-and-odd.wider',
      vars: [
        { name: 'e', kind: 'int', min: '1', max: '8' },
        { name: 'o', kind: 'int', min: '0', max: '8' },
        { name: 'p', kind: 'int', min: '0', max: '8' },
      ],
      choices: evenChoices,
    });

    expect(result.errors).toEqual([]);
  });

  // The shipped shape that neither check above can see: five solid names, the
  // distractors stepped a fixed 1, 2 and 3 along the list. The rank check
  // stands down because the options are words, and the closed-set check
  // because every name is an answer sometimes and a distractor other times -
  // and yet the four names on screen are always the answer's four successors,
  // so which name is *missing* names the answer. Five option sets, five
  // answers, one to one.
  const solid = (i: string) =>
    `${i} == 0 ? 'cube' : ${i} == 1 ? 'sphere' : ${i} == 2 ? 'cone' : ` +
    `${i} == 3 ? 'cylinder' : 'pyramid'`;
  const solidSpec = {
    id: 'maths.1.shapes.leaky-solid',
    subject: 'maths', topic: 'shapes', level: '1',
    prompt: 'What is this called?',
    answer: solid('i'),
    answerType: 'choice',
    tags: ['AC9M1SP01'],
  } as const;

  it('rejects a choice question whose option set predicts the answer', () => {
    const result = validateTemplate({
      ...solidSpec,
      vars: [{ name: 'i', kind: 'int', min: '0', max: '4' }],
      choices: {
        count: 4,
        distractors: [solid('mod(i + 1, 5)'), solid('mod(i + 2, 5)'), solid('mod(i + 3, 5)')],
      },
    });

    // Specifically this check and not one of its two special cases: the rank
    // and closed-set checks are both silent on this template, which is the
    // whole reason it needed a third.
    expect(result.errors.join(' ')).toMatch(/distinct option sets/i);
    expect(result.errors.join(' ')).not.toMatch(/rank/i);
  });

  it('accepts the same options once which of them is left out varies', () => {
    const result = validateTemplate({
      ...solidSpec,
      vars: [
        { name: 'i', kind: 'int', min: '0', max: '4' },
        { name: 'gap', kind: 'pick', from: [1, 2, 3, 4] },
        { name: 'a', kind: 'expr', expr: 'gap == 1 ? 2 : 1' },
        { name: 'b', kind: 'expr', expr: 'gap <= 2 ? 3 : 2' },
        { name: 'c', kind: 'expr', expr: 'gap == 4 ? 3 : 4' },
      ],
      choices: {
        count: 4,
        distractors: [solid('mod(i + a, 5)'), solid('mod(i + b, 5)'), solid('mod(i + c, 5)')],
      },
    });

    expect(result.errors).toEqual([]);
  });

  it('says nothing when the option set almost never turns up twice', () => {
    // One answer per option set here too - but only because a set is never
    // seen a second time. Two hundred sums against jittered distractors give
    // very nearly a fresh set every draw, and refusing that would be refusing
    // a template for not repeating itself. `OPTION_SET_REPEATS` is what tells
    // the two apart.
    const result = validateTemplate({
      id: 'maths.3.addition.wide',
      subject: 'maths', topic: 'addition', level: '3',
      prompt: 'What is {x} + {y}?',
      vars: [
        { name: 'x', kind: 'int', min: '100', max: '899' },
        { name: 'y', kind: 'int', min: '100', max: '899' },
      ],
      answer: 'x + y',
      answerType: 'choice',
      choices: { count: 4, jitter: { min: '1', max: '99' } },
      tags: ['AC9M3N01'],
    });

    expect(result.errors).toEqual([]);
  });

  it('accepts a choice question whose options genuinely mix', () => {
    const result = validateTemplate({
      id: 'maths.2.addition.sound',
      subject: 'maths', topic: 'addition', level: '2',
      prompt: 'What is {x} + {y}?',
      vars: [
        { name: 'x', kind: 'int', min: '10', max: '40' },
        { name: 'y', kind: 'int', min: '10', max: '40' },
      ],
      answer: 'x + y',
      answerType: 'choice',
      choices: { count: 4, jitter: { min: '1', max: '9' } },
      tags: ['AC9M2N01'],
    });

    expect(result.errors).toEqual([]);
  });
});
