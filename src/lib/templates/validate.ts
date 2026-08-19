import { parse, type Node } from '../expr';
import { isYearLevel, YEAR_LEVELS } from '../curriculum';
import { createRng } from '../rng';
import { generate } from './generate';
import { MAX_CHOICES, type QuestionSpec, type QuestionTemplate, type VarSpec } from './types';

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
