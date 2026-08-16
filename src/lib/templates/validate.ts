import { parse, type Node } from '../expr';
import { createRng } from '../rng';
import { generateQuestion } from './generate';
import type { QuestionTemplate, VarSpec } from './types';

/**
 * Templates are authored outside the app, so they are untrusted input. Validation
 * runs at author/import time — never mid-session with a child waiting.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VAR_KINDS = new Set(['int', 'number', 'pick', 'expr']);

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

export function validateTemplate(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { valid: false, errors: ['Template must be an object'] };
  }

  const template = input as Partial<QuestionTemplate>;
  const bound = new Set<string>();

  /** Parse an expression and confirm it only reads variables bound so far. */
  const checkExpr = (expr: unknown, label: string, scope: Set<string>) => {
    if (typeof expr !== 'string' || expr.trim() === '') {
      errors.push(`${label} must be a non-empty expression string`);
      return;
    }
    try {
      for (const name of referencedVars(parse(expr))) {
        if (!scope.has(name)) errors.push(`${label}: unknown variable: ${name}`);
      }
    } catch (error) {
      errors.push(`${label}: ${(error as Error).message}`);
    }
  };

  /** Check the `{expression}` holes inside a prompt or hint. */
  const checkTemplateString = (text: unknown, label: string) => {
    if (typeof text !== 'string' || text.trim() === '') {
      errors.push(`${label} must be a non-empty string`);
      return;
    }
    for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
      checkExpr(match[1], `${label} placeholder {${match[1]}}`, bound);
    }
  };

  if (typeof template.id !== 'string' || template.id.trim() === '') {
    errors.push('id must be a non-empty string');
  }
  if (typeof template.subject !== 'string' || template.subject.trim() === '') {
    errors.push('subject must be a non-empty string');
  }
  if (typeof template.category !== 'string' || template.category.trim() === '') {
    errors.push('category must be a non-empty string');
  }
  if (typeof template.level !== 'number' || !Number.isInteger(template.level) || template.level < 1) {
    errors.push('level must be an integer of 1 or more');
  }

  if (!Array.isArray(template.vars)) {
    errors.push('vars must be an array');
  } else {
    for (const [index, spec] of (template.vars as VarSpec[]).entries()) {
      const label = `vars[${index}]`;

      if (typeof spec !== 'object' || spec === null) {
        errors.push(`${label} must be an object`);
        continue;
      }
      if (typeof spec.name !== 'string' || spec.name.trim() === '') {
        errors.push(`${label}.name must be a non-empty string`);
        continue;
      }
      if (bound.has(spec.name)) {
        errors.push(`${label}: duplicate variable name: ${spec.name}`);
        continue;
      }
      if (!VAR_KINDS.has(spec.kind)) {
        errors.push(`${label} (${spec.name}): unknown kind ${JSON.stringify(spec.kind)}`);
        continue;
      }

      // Bounds may only reference variables declared before this one.
      if (spec.kind === 'int' || spec.kind === 'number') {
        checkExpr(spec.min, `${label} (${spec.name}).min`, bound);
        checkExpr(spec.max, `${label} (${spec.name}).max`, bound);
      } else if (spec.kind === 'expr') {
        checkExpr(spec.expr, `${label} (${spec.name}).expr`, bound);
      } else if (spec.kind === 'pick') {
        if (!Array.isArray(spec.from) || spec.from.length === 0) {
          errors.push(`${label} (${spec.name}): pick list is empty`);
        } else if (spec.weights && spec.weights.length !== spec.from.length) {
          errors.push(`${label} (${spec.name}): weights length must match the pick list`);
        }
      }

      bound.add(spec.name);
    }
  }

  checkTemplateString(template.prompt, 'prompt');
  if (template.hint !== undefined) checkTemplateString(template.hint, 'hint');
  checkExpr(template.answer, 'answer', bound);

  if (template.constraints !== undefined) {
    if (!Array.isArray(template.constraints)) {
      errors.push('constraints must be an array');
    } else {
      template.constraints.forEach((c, i) => checkExpr(c, `constraints[${i}]`, bound));
    }
  }

  if (template.choices !== undefined) {
    const { count, distractors, jitter } = template.choices;
    if (typeof count !== 'number' || count < 2) {
      errors.push('choices.count must be 2 or more');
    }
    distractors?.forEach((d, i) => checkExpr(d, `choices.distractors[${i}]`, bound));
    if (jitter) {
      checkExpr(jitter.min, 'choices.jitter.min', bound);
      checkExpr(jitter.max, 'choices.jitter.max', bound);
    }
  }

  // Static checks passed — prove it can actually produce questions.
  if (errors.length === 0) {
    for (let i = 0; i < 5; i++) {
      try {
        generateQuestion(template as QuestionTemplate, createRng(`validate-${template.id}-${i}`));
      } catch (error) {
        errors.push(`generation failed: ${(error as Error).message}`);
        break;
      }
    }
  }

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
