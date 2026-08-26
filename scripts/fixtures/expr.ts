import { evaluate } from '../../src/lib/expr';
import { createRng } from '../../src/lib/rng';
import { generateQuestion } from '../../src/lib/templates/generate';
import type { QuestionTemplate } from '../../src/lib/templates/types';
import { canonicaliseCase, canonicalScope, digest } from './canonical';
import { seedFor } from './corpus';
import type { DigestSet } from './digests';
import { EXPR_TRAPS } from './expr-traps';

/** How many real scopes each of a template's expressions is evaluated against. */
const SCOPES_PER_TEMPLATE = 5;

/**
 * Every expression string a template holds, deduplicated and in a stable order.
 *
 * This reaches the language as content actually uses it, which is the half the
 * hand-written traps cannot: 1,453 distinct strings across the shipped corpus. It
 * is also exactly why the traps exist beside it - content uses `^` not once and
 * never uses `ceil`, `trunc`, `sign`, `sqrt` or `isInt`.
 */
export function expressionsOf(template: QuestionTemplate): string[] {
  const found: string[] = [];
  const add = (expr: unknown): void => {
    if (typeof expr === 'string' && expr.length > 0) found.push(expr);
  };

  add(template.answer);
  for (const constraint of template.constraints ?? []) add(constraint);

  for (const spec of template.vars) {
    if (spec.kind === 'int' || spec.kind === 'number') {
      add(spec.min);
      add(spec.max);
    } else if (spec.kind === 'expr') {
      add(spec.expr);
    }
  }

  for (const text of [template.prompt, template.hint]) {
    for (const hole of String(text ?? '').matchAll(/\{([^}]*)\}/g)) add(hole[1]);
  }

  for (const distractor of template.choices?.distractors ?? []) add(distractor);

  // A figure's parameters are expressions too, evaluated against this same
  // bound scope by `buildFigure`. Every `FigureSpec` field is a single `Expr`
  // apart from the `kind` discriminant, so walking the object is exhaustive
  // and stays exhaustive when a twelfth kind is added - which is the reason it
  // is written as a walk rather than a list of field names.
  if (template.figure) {
    for (const [field, value] of Object.entries(template.figure)) {
      if (field !== 'kind') add(value);
    }
  }

  // The `jitter` bounds, used when authored distractors run short. No shipped
  // template carries one today, so this collects nothing yet; it is here so
  // that the first one to use it is covered rather than silently uncovered.
  if (template.choices?.jitter) {
    add(template.choices.jitter.min);
    add(template.choices.jitter.max);
  }

  return [...new Set(found)];
}

/**
 * The expression set: one group per template for what content uses, plus
 * `traps` for the hand-authored cases.
 *
 * **An expression needs a scope, and this needs no engine instrumentation.**
 * `q.vars` is the bound scope and is already exposed on `GeneratedQuestion`, so
 * five draws supply five real bindings and each expression is seen against
 * several rather than one lucky one. Evaluating a variable's *bound* against the
 * final scope rather than the partial one it was drawn under is sound: the final
 * scope is a superset, and a variable may only reference ones declared before
 * it.
 *
 * An expression that throws under a given scope records the throw rather than
 * being skipped. A port that fails to throw where this one does has diverged
 * just as surely as one returning a different number.
 */
export function exprSet(templates: readonly QuestionTemplate[]): DigestSet {
  const groups = new Map<string, string>();

  groups.set(
    'traps',
    digest(
      EXPR_TRAPS.map(({ expr, scope, expect }) =>
        canonicaliseCase([
          ['expr', expr],
          ...canonicalScope('scope', scope ?? {}),
          ['value', String(expect)],
        ]),
      ),
    ),
  );

  for (const template of templates) {
    const expressions = expressionsOf(template);
    if (expressions.length === 0) continue;

    const cases: string[] = [];
    for (let draw = 0; draw < SCOPES_PER_TEMPLATE; draw++) {
      const scope = generateQuestion(template, createRng(seedFor(template.id, draw))).vars;
      for (const expr of expressions) {
        let value: string;
        try {
          value = String(evaluate(expr, scope));
        } catch (error) {
          value = `throws: ${(error as Error).message}`;
        }
        cases.push(
          canonicaliseCase([
            ['expr', expr],
            ...canonicalScope('scope', scope),
            ['value', value],
          ]),
        );
      }
    }
    groups.set(template.id, digest(cases));
  }

  return { name: 'expr', groups, draws: SCOPES_PER_TEMPLATE };
}
