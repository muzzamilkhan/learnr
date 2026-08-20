import { parse, type Node } from '../expr';
import { isYearLevel, YEAR_LEVELS } from '../curriculum';
import { figureIssues } from '../figures/build';
import { FIGURE_KINDS } from '../figures/types';
import { createRng } from '../rng';
import { generate } from './generate';
import { MAX_CHOICES, type QuestionSpec, type QuestionTemplate, type VarSpec } from './types';

/**
 * How many times a figure template is drawn to enforce the anchoring rule (see
 * "The anchoring rule" in the design doc): the same template, on distinct
 * seeds, grouped by the answer it produced - and an answer whose every drawing
 * came out byte-identical is the failure this whole feature exists to catch.
 * Fifty is enough that a coin-flip choice inside the builder (which of two axis
 * bands, which side a rectangle lays down on) is vanishingly unlikely to land
 * the same way every time by chance, while staying cheap enough that 200
 * shipped templates - the great majority with no figure at all, and paying
 * nothing for this - can still be validated on every test run.
 */
export const FIGURE_DRAWS = 50;

/**
 * Templates are authored outside the app, so they are untrusted input. Validation
 * runs at author/import time - never mid-session with a child waiting.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VAR_KINDS = new Set(['int', 'number', 'pick', 'expr']);
const ANSWER_TYPES = new Set(['number', 'text', 'choice', 'boolean']);

/** Collect every identifier an expression reads. */
function referencedVars(node: Node, into: Set<string> = new Set()): Set<string> {
  switch (node.kind) {
    case 'var':
      into.add(node.name);
      break;
    case 'unary':
      referencedVars(node.operand, into);
      break;
    case 'binary':
      referencedVars(node.left, into);
      referencedVars(node.right, into);
      break;
    case 'ternary':
      referencedVars(node.test, into);
      referencedVars(node.then, into);
      referencedVars(node.other, into);
      break;
    case 'call':
      node.args.forEach((arg) => referencedVars(arg, into));
      break;
  }
  return into;
}

/**
 * The half of validation that is about the question itself. Split out because a
 * speed-run mode is a spec with no course around it and must be held to exactly
 * the same standard as shipped content - unbound variables, out-of-order
 * references, malformed expressions and unsatisfiable constraints are all caught
 * by the thing that already catches them.
 */
export function validateSpec(input: unknown, label = 'spec'): ValidationResult {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, errors: ['Template must be an object'] };
  }

  const spec = input as Partial<QuestionSpec>;
  const bound = new Set<string>();

  /** Parse an expression and confirm it only reads variables bound so far. */
  const checkExpr = (expr: unknown, exprLabel: string, scope: Set<string>) => {
    if (typeof expr !== 'string' || expr.trim() === '') {
      errors.push(`${exprLabel} must be a non-empty expression string`);
      return;
    }
    try {
      for (const name of referencedVars(parse(expr))) {
        if (!scope.has(name)) errors.push(`${exprLabel}: unknown variable: ${name}`);
      }
    } catch (error) {
      errors.push(`${exprLabel}: ${(error as Error).message}`);
    }
  };

  /** Check the `{expression}` holes inside a prompt or hint. */
  const checkTemplateString = (text: unknown, textLabel: string) => {
    if (typeof text !== 'string' || text.trim() === '') {
      errors.push(`${textLabel} must be a non-empty string`);
      return;
    }
    for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
      checkExpr(match[1], `${textLabel} placeholder {${match[1]}}`, bound);
    }
  };

  if (!Array.isArray(spec.vars)) {
    errors.push('vars must be an array');
  } else {
    for (const [index, varSpec] of (spec.vars as VarSpec[]).entries()) {
      const varLabel = `vars[${index}]`;

      if (typeof varSpec !== 'object' || varSpec === null) {
        errors.push(`${varLabel} must be an object`);
        continue;
      }
      if (typeof varSpec.name !== 'string' || varSpec.name.trim() === '') {
        errors.push(`${varLabel}.name must be a non-empty string`);
        continue;
      }
      if (bound.has(varSpec.name)) {
        errors.push(`${varLabel}: duplicate variable name: ${varSpec.name}`);
        continue;
      }
      if (!VAR_KINDS.has(varSpec.kind)) {
        errors.push(`${varLabel} (${varSpec.name}): unknown kind ${JSON.stringify(varSpec.kind)}`);
        continue;
      }

      // Bounds may only reference variables declared before this one.
      if (varSpec.kind === 'int' || varSpec.kind === 'number') {
        checkExpr(varSpec.min, `${varLabel} (${varSpec.name}).min`, bound);
        checkExpr(varSpec.max, `${varLabel} (${varSpec.name}).max`, bound);
      } else if (varSpec.kind === 'expr') {
        checkExpr(varSpec.expr, `${varLabel} (${varSpec.name}).expr`, bound);
      } else if (varSpec.kind === 'pick') {
        if (!Array.isArray(varSpec.from) || varSpec.from.length === 0) {
          errors.push(`${varLabel} (${varSpec.name}): pick list is empty`);
        } else if (varSpec.weights && varSpec.weights.length !== varSpec.from.length) {
          errors.push(`${varLabel} (${varSpec.name}): weights length must match the pick list`);
        }
      }

      bound.add(varSpec.name);
    }
  }

  checkTemplateString(spec.prompt, 'prompt');
  if (spec.hint !== undefined) checkTemplateString(spec.hint, 'hint');
  checkExpr(spec.answer, 'answer', bound);

  if (spec.constraints !== undefined) {
    if (!Array.isArray(spec.constraints)) {
      errors.push('constraints must be an array');
    } else {
      spec.constraints.forEach((c, i) => checkExpr(c, `constraints[${i}]`, bound));
    }
  }

  if (spec.answerType !== undefined && !ANSWER_TYPES.has(spec.answerType)) {
    errors.push(`answerType must be one of ${[...ANSWER_TYPES].join(', ')}`);
  }

  // Without them there is nothing to draw buttons from, and the child would be
  // handed a number pad for a question written to be tapped.
  if (spec.answerType === 'choice' && spec.choices === undefined) {
    errors.push('answerType "choice" requires choices');
  }

  if (spec.choices !== undefined) {
    const { count, distractors, jitter } = spec.choices;
    if (typeof count !== 'number' || count < 2 || count > MAX_CHOICES) {
      errors.push(`choices.count must be between 2 and ${MAX_CHOICES}`);
    }
    // True/false renders two fixed buttons, so authored choices would be dropped.
    if (spec.answerType === 'boolean') {
      errors.push('choices cannot be combined with a true/false answer');
    }
    distractors?.forEach((d, i) => checkExpr(d, `choices.distractors[${i}]`, bound));
    if (jitter) {
      checkExpr(jitter.min, 'choices.jitter.min', bound);
      checkExpr(jitter.max, 'choices.jitter.max', bound);
    }
  }

  // Check 1 of 3 for a figure: `kind` is one of `FIGURE_KINDS`, and every
  // parameter it declares is a non-empty expression that parses and reads only
  // variables bound above - reusing `checkExpr` and `bound` exactly as every
  // other expression on this spec is checked. This is deliberately narrower
  // than an authored `FigureSpec`: the input is untrusted, so every field is
  // read as `unknown` and re-checked at runtime rather than trusted from the
  // (unenforced) static type. A figure is checked once every variable exists -
  // unlike `vars`, which enforces a declaration order on itself, a figure's
  // parameters may reference any of them, in any order, because none of them
  // declare each other.
  if (spec.figure !== undefined) {
    const rawFigure = spec.figure as unknown;
    if (typeof rawFigure !== 'object' || rawFigure === null || Array.isArray(rawFigure)) {
      errors.push('figure must be an object');
    } else {
      const figure = rawFigure as { kind?: unknown } & Record<string, unknown>;
      if (
        typeof figure.kind !== 'string' ||
        !(FIGURE_KINDS as readonly string[]).includes(figure.kind)
      ) {
        errors.push(
          `figure.kind: ${JSON.stringify(figure.kind)} is not a figure kind` +
            ` (expected ${FIGURE_KINDS.join(' or ')})`,
        );
      } else {
        const params: readonly [string, unknown, boolean][] =
          figure.kind === 'polygon'
            ? [
                ['figure.shape', figure.shape, true],
                ['figure.rotation', figure.rotation, false],
                ['figure.mirror', figure.mirror, false],
                ['figure.rightAngles', figure.rightAngles, false],
              ]
            : [
                ['figure.degrees', figure.degrees, true],
                ['figure.rotation', figure.rotation, false],
                ['figure.armLength', figure.armLength, false],
                ['figure.arc', figure.arc, false],
              ];

        for (const [paramLabel, expr, required] of params) {
          // Omitted is what asks for jitter on an optional parameter, and is
          // fine; `checkExpr` itself reports an omitted *required* one.
          if (expr === undefined && !required) continue;
          checkExpr(expr, paramLabel, bound);
        }
      }
    }
  }

  // Static checks passed - prove it can actually produce questions. `answerType`
  // is usually inferred, so this is also the only place that can tell what kind of
  // question the spec really is.
  if (errors.length === 0) {
    for (let i = 0; i < 5; i++) {
      try {
        const question = generate(spec as QuestionSpec, createRng(`validate-${label}-${i}`), label);

        if (question.answerType === 'boolean' && spec.choices !== undefined) {
          errors.push('choices cannot be combined with a true/false answer');
          break;
        }
        // Generation is deliberately forgiving about a declared type that
        // disagrees with the answer, so that a session never crashes. Saying so
        // here is the whole point of validating. Only the types that decide which
        // pad the child gets matter: `choice` and `text` both accept any answer.
        const declared = spec.answerType;
        if (declared === 'boolean' && typeof question.answer !== 'boolean') {
          errors.push(`answerType is "boolean" but the answer is a ${typeof question.answer}`);
          break;
        }
        if (declared === 'number' && typeof question.answer !== 'number') {
          errors.push(`answerType is "number" but the answer is a ${typeof question.answer}`);
          break;
        }
        if (declared !== undefined && declared !== 'boolean' && typeof question.answer === 'boolean') {
          errors.push(`answerType is ${JSON.stringify(declared)} but the answer is a boolean`);
          break;
        }
      } catch (error) {
        errors.push(`generation failed: ${(error as Error).message}`);
        break;
      }
    }
  }

  // Checks 2 and 3 of 3 for a figure: it has to build clean, and it has to vary.
  // Both need a bound scope, so they wait for everything above to have passed -
  // there is no point judging a figure against a scope that never bound.
  if (errors.length === 0 && spec.figure !== undefined) {
    const figureSpec = spec.figure;
    const seenIssues = new Set<string>();
    const byAnswer = new Map<string, { count: number; figures: Set<string> }>();
    let lastScope: Record<string, string | number | boolean> | undefined;

    for (let i = 0; i < FIGURE_DRAWS; i++) {
      let question;
      try {
        question = generate(
          spec as QuestionSpec,
          createRng(`validate-${label}-figure-${i}`),
          label,
        );
      } catch (error) {
        // Every earlier draw of this same spec succeeded (the loop above
        // proved it), so a failure here would be a template whose constraints
        // are satisfiable often but not always - worth reporting, not crashing
        // validation over.
        errors.push(`figure: generation failed: ${(error as Error).message}`);
        break;
      }

      lastScope = question.vars;
      for (const issue of figureIssues(figureSpec, question.vars)) seenIssues.add(issue);

      // `JSON.stringify`, not `String`: `String(true)` and `String('true')`
      // are both `"true"`, which would fold a boolean answer and a text answer
      // that happens to spell the same word into one group and let a rotation
      // pinned on only one branch of the answer go unflagged. It also doubles
      // as the exact text the message below names the answer with, so the two
      // can never drift apart the way a separately-carried sample could.
      const key = JSON.stringify(question.answer);
      const entry = byAnswer.get(key) ?? { count: 0, figures: new Set<string>() };
      entry.count++;
      entry.figures.add(JSON.stringify(question.figure));
      byAnswer.set(key, entry);
    }

    // A `pick` var's whole vocabulary is a short list of literals sitting
    // right in the spec, not a distribution to sample and hope covers itself.
    // `FIGURE_DRAWS` seeds give each one only roughly a `1/n` chance per seed,
    // so a wide pick can go fifty draws without ever trying its worst value -
    // and because those seeds are keyed off the template's own id, that is not
    // flakiness a re-run washes out, it is a permanent silent pass for that
    // template. So every literal of every `pick` var is checked directly
    // instead: take the last scope the loop above bound and force that one
    // var to the literal in turn. That is exact coverage of every value the
    // figure's own parameters could ever be asked to draw - not a chance of
    // eventually trying it - at the cost of one more `figureIssues` call per
    // literal, which is cheap because `figureIssues` takes no `Rng` and does
    // no generation of its own.
    if (lastScope) {
      for (const varSpec of spec.vars as VarSpec[]) {
        if (varSpec.kind !== 'pick') continue;
        for (const literal of varSpec.from) {
          const scope = { ...lastScope, [varSpec.name]: literal };
          for (const issue of figureIssues(figureSpec, scope)) seenIssues.add(issue);
        }
      }
    }

    seenIssues.forEach((issue) => errors.push(`figure: ${issue}`));

    // An answer drawn only once has nothing to compare against and is skipped,
    // not passed - it is simply untested by this run. An answer drawn more than
    // once with every one of its figures serialising identically is the
    // anchoring rule's failure case: the picture, not the property, would be
    // what a child learns to recognise.
    for (const [key, entry] of byAnswer) {
      if (entry.count > 1 && entry.figures.size === 1) {
        errors.push(
          `figure: the answer ${key} always drew the same picture - unpin ` +
            'figure.rotation, or choose a shape or angle that still has something ' +
            'left to vary, so the diagram itself does not become the answer',
        );
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function validateTemplate(input: unknown): ValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, errors: ['Template must be an object'] };
  }

  const template = input as Partial<QuestionTemplate>;
  const errors: string[] = [];

  if (typeof template.id !== 'string' || template.id.trim() === '') {
    errors.push('id must be a non-empty string');
  }
  if (typeof template.subject !== 'string' || template.subject.trim() === '') {
    errors.push('subject must be a non-empty string');
  }
  if (typeof template.topic !== 'string' || template.topic.trim() === '') {
    errors.push('topic must be a non-empty string');
  }
  if (!isYearLevel(template.level)) {
    errors.push(`level must be a school year, one of ${YEAR_LEVELS.join(', ')}`);
  }

  errors.push(...validateSpec(input, template.id).errors);

  return { valid: errors.length === 0, errors };
}

/** Validate a batch, e.g. an AI-authored course file. */
export function validateTemplates(inputs: unknown[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const ids = new Set<string>();

  inputs.forEach((input, index) => {
    const result = validateTemplate(input);
    result.errors.forEach((error) => errors.push(`[${index}] ${error}`));

    const id = (input as QuestionTemplate)?.id;
    if (typeof id === 'string' && id !== '') {
      if (ids.has(id)) errors.push(`[${index}] duplicate template id: ${id}`);
      ids.add(id);
    }
  });

  return { valid: errors.length === 0, errors };
}
