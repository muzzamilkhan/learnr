import { evaluate, type Scope, type Value } from '../expr';
import { buildFigure } from '../figures/build';
import type { Rng } from '../rng';
import {
  MAX_CHOICES,
  type AnswerType,
  type ChoiceSpec,
  type Expr,
  type GeneratedQuestion,
  type Question,
  type QuestionSpec,
  type QuestionTemplate,
  type VarSpec,
} from './types';

/** How many times to redraw before giving up on a template's constraints. */
const MAX_ATTEMPTS = 200;

const num = (expr: Expr, scope: Scope, label: string): number => {
  const value = evaluate(expr, scope);
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${label} must evaluate to a number, got ${JSON.stringify(value)}`);
  }
  return value;
};

function bindVar(spec: VarSpec, scope: Scope, rng: Rng): Value {
  switch (spec.kind) {
    case 'int': {
      const min = Math.ceil(num(spec.min, scope, `${spec.name}.min`));
      const max = Math.floor(num(spec.max, scope, `${spec.name}.max`));
      if (max < min) {
        throw new Error(`Variable ${spec.name} has an empty range [${min}, ${max}]`);
      }
      if (spec.step && spec.step > 1) {
        const steps = Math.floor((max - min) / spec.step);
        return min + rng.int(0, steps) * spec.step;
      }
      return rng.int(min, max);
    }

    case 'number': {
      const min = num(spec.min, scope, `${spec.name}.min`);
      const max = num(spec.max, scope, `${spec.name}.max`);
      if (max < min) {
        throw new Error(`Variable ${spec.name} has an empty range [${min}, ${max}]`);
      }
      const decimals = spec.decimals ?? 2;
      const raw = min + rng.next() * (max - min);
      const factor = 10 ** decimals;
      return Math.round(raw * factor) / factor;
    }

    case 'pick': {
      if (spec.from.length === 0) {
        throw new Error(`Variable ${spec.name} has no values to pick from`);
      }
      if (!spec.weights) return spec.from[rng.int(0, spec.from.length - 1)];

      const weights = spec.weights;
      if (weights.length !== spec.from.length) {
        throw new Error(`Variable ${spec.name} has ${weights.length} weights for ${spec.from.length} values`);
      }
      const total = weights.reduce((a, b) => a + b, 0);
      let roll = rng.next() * total;
      for (let i = 0; i < spec.from.length; i++) {
        roll -= weights[i];
        if (roll <= 0) return spec.from[i];
      }
      return spec.from[spec.from.length - 1];
    }

    case 'expr':
      return evaluate(spec.expr, scope);
  }
}

/** One attempt at binding every variable. Returns null if a constraint fails. */
function tryBind(spec: QuestionSpec, rng: Rng): Record<string, Value> | null {
  const scope: Record<string, Value> = Object.create(null);

  for (const varSpec of spec.vars) {
    scope[varSpec.name] = bindVar(varSpec, scope, rng);
  }

  for (const constraint of spec.constraints ?? []) {
    if (!evaluate(constraint, scope)) return null;
  }

  return scope;
}

/**
 * `tryBind`, except one or more variables are *forced* to a given value
 * rather than drawn - the mechanism the anchoring check's `pick`-literal
 * coverage needs (see `validate.ts`). Overwriting a value in an
 * already-finished scope leaves anything derived from it stale: an `expr`
 * variable further down `spec.vars` that reads a forced pick would still see
 * whatever that pick drew the first time. Walking `spec.vars` in the same
 * declared order `tryBind` does, and substituting only at the point a forced
 * variable is bound, is what lets every variable declared after it see the
 * forced value instead - exactly as it would if that value had genuinely
 * been drawn.
 *
 * Returns null exactly as `tryBind` does when a constraint rejects the
 * binding. A forced combination the spec's own constraints refuse is a
 * combination no child would ever be asked, so a caller checking a figure
 * against it has nothing to check - not an error of its own.
 */
export function tryBindForced(
  spec: QuestionSpec,
  rng: Rng,
  forced: Readonly<Record<string, Value>>,
): Record<string, Value> | null {
  const scope: Record<string, Value> = Object.create(null);

  for (const varSpec of spec.vars) {
    scope[varSpec.name] = Object.hasOwn(forced, varSpec.name)
      ? forced[varSpec.name]
      : bindVar(varSpec, scope, rng);
  }

  for (const constraint of spec.constraints ?? []) {
    if (!evaluate(constraint, scope)) return null;
  }

  return scope;
}

/** Replace `{expression}` holes with their evaluated values. */
export function renderTemplateString(text: string, scope: Scope): string {
  return text.replace(/\{([^{}]+)\}/g, (_match, expr: string) => String(evaluate(expr, scope)));
}

function buildChoices(
  spec: ChoiceSpec,
  answer: string | number,
  scope: Scope,
  rng: Rng,
): (string | number)[] {
  // Clamped rather than rejected: `validateTemplate` is the gate for authoring
  // mistakes, and this runs mid-session with a child waiting. Four options that
  // include the answer beat a thrown error.
  const count = Math.min(spec.count, MAX_CHOICES);

  const options: (string | number)[] = [answer];
  const seen = new Set<string>([String(answer)]);

  const add = (value: Value) => {
    if (typeof value === 'boolean') return;
    const key = String(value);
    if (seen.has(key)) return;
    seen.add(key);
    options.push(value);
  };

  for (const expr of spec.distractors ?? []) {
    if (options.length >= count) break;
    add(evaluate(expr, scope));
  }

  // Top up with jittered values when the authored distractors collide or run out.
  if (options.length < count && spec.jitter && typeof answer === 'number') {
    const min = num(spec.jitter.min, scope, 'jitter.min');
    const max = num(spec.jitter.max, scope, 'jitter.max');
    for (let guard = 0; options.length < count && guard < 100; guard++) {
      const offset = rng.int(min, max) * (rng.next() < 0.5 ? -1 : 1);
      add(answer + offset);
    }
  }

  if (options.length < count) {
    throw new Error(
      `Template could not produce ${count} distinct choices (got ${options.length}); ` +
        'add more distractors or a jitter range',
    );
  }

  // Fisher-Yates so the answer is not always first.
  for (let i = options.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [options[i], options[j]] = [options[j], options[i]];
  }
  return options;
}

export function generate(spec: QuestionSpec, rng: Rng, label = 'spec'): GeneratedQuestion {
  let scope: Record<string, Value> | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && scope === null; attempt++) {
    scope = tryBind(spec, rng);
  }

  if (scope === null) {
    throw new Error(
      `Template ${label} failed to satisfy its constraints after ${MAX_ATTEMPTS} attempts: ` +
        `[${(spec.constraints ?? []).join(', ')}]`,
    );
  }

  const answerValue = evaluate(spec.answer, scope);

  // `buildFigure` is total by construction - an unknown shape or an unbound
  // parameter degrades to something drawable rather than throwing, exactly like
  // the rest of this function - so there is nothing here for `generate` to
  // guard. Drawn from the same scope and the same `rng` the rest of the
  // question uses, which is what makes a figure reproduce from its seed the way
  // everything else here does, and what lets a fixed `rotation` on a regular
  // polygon draw the same picture every time - the anchoring check in
  // `validate.ts` is what catches that, not this function.
  const figure = spec.figure ? buildFigure(spec.figure, scope, rng) : undefined;

  /**
   * A boolean answer is a true/false question whatever the spec declared: its
   * two options are implied, so any `choices` are meaningless and are dropped.
   *
   * Nothing here throws on an authoring mistake. This runs mid-session with a
   * child waiting, so a disagreement between `answerType` and the actual answer
   * degrades to something playable; `validateTemplate` is where it is reported.
   */
  const isBoolean = typeof answerValue === 'boolean';
  const answerType: AnswerType = isBoolean
    ? 'boolean'
    : (spec.answerType ?? (typeof answerValue === 'number' ? 'number' : 'text'));

  return {
    prompt: renderTemplateString(spec.prompt, scope),
    answer: answerValue,
    answerType,
    choices:
      spec.choices && !isBoolean
        ? buildChoices(spec.choices, answerValue as string | number, scope, rng)
        : undefined,
    hint: spec.hint ? renderTemplateString(spec.hint, scope) : undefined,
    vars: { ...scope },
    figure,
  };
}

/**
 * A generated question, placed in a course. Every field the engine needs to make
 * one lives on the spec; these four say who was asked, and are carried straight
 * through.
 */
export function generateQuestion(template: QuestionTemplate, rng: Rng): Question {
  return {
    templateId: template.id,
    subject: template.subject,
    topic: template.topic,
    level: template.level,
    ...generate(template, rng, template.id),
  };
}
