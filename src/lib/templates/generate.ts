import { evaluate, type Scope, type Value } from '../expr';
import type { Rng } from '../rng';
import { MAX_CHOICES, type AnswerType, type ChoiceSpec, type Expr, type Question, type QuestionTemplate, type VarSpec } from './types';

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
function tryBind(template: QuestionTemplate, rng: Rng): Record<string, Value> | null {
  const scope: Record<string, Value> = Object.create(null);

  for (const spec of template.vars) {
    scope[spec.name] = bindVar(spec, scope, rng);
  }

  for (const constraint of template.constraints ?? []) {
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
  if (spec.count < 2 || spec.count > MAX_CHOICES) {
    throw new Error(
      `Multiple choice must offer between 2 and ${MAX_CHOICES} options, got ${spec.count}`,
    );
  }

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
    if (options.length >= spec.count) break;
    add(evaluate(expr, scope));
  }

  // Top up with jittered values when the authored distractors collide or run out.
  if (options.length < spec.count && spec.jitter && typeof answer === 'number') {
    const min = num(spec.jitter.min, scope, 'jitter.min');
    const max = num(spec.jitter.max, scope, 'jitter.max');
    for (let guard = 0; options.length < spec.count && guard < 100; guard++) {
      const offset = rng.int(min, max) * (rng.next() < 0.5 ? -1 : 1);
      add(answer + offset);
    }
  }

  if (options.length < spec.count) {
    throw new Error(
      `Template could not produce ${spec.count} distinct choices (got ${options.length}); ` +
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

export function generateQuestion(template: QuestionTemplate, rng: Rng): Question {
  let scope: Record<string, Value> | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS && scope === null; attempt++) {
    scope = tryBind(template, rng);
  }

  if (scope === null) {
    throw new Error(
      `Template ${template.id} failed to satisfy its constraints after ${MAX_ATTEMPTS} attempts: ` +
        `[${(template.constraints ?? []).join(', ')}]`,
    );
  }

  const answerValue = evaluate(template.answer, scope);
  const inferred: AnswerType =
    typeof answerValue === 'boolean' ? 'boolean' : typeof answerValue === 'number' ? 'number' : 'text';
  const answerType = template.answerType ?? inferred;

  // A declared answerType that disagrees with the answer would render the wrong
  // input, so it is an authoring error rather than something to paper over.
  if (answerType === 'boolean' || inferred === 'boolean') {
    if (answerType !== inferred) {
      throw new Error(
        `Template ${template.id} declares answerType ${JSON.stringify(answerType)} but its answer is a ${inferred === 'boolean' ? 'boolean' : typeof answerValue}`,
      );
    }
  } else if (answerType === 'number' && inferred !== 'number') {
    throw new Error(
      `Template ${template.id} declares answerType "number" but its answer is a ${typeof answerValue}`,
    );
  }

  if (answerType === 'boolean' && template.choices) {
    throw new Error(
      `Template ${template.id} is true/false and must not declare choices; it renders its own buttons`,
    );
  }

  return {
    templateId: template.id,
    subject: template.subject,
    topic: template.topic,
    level: template.level,
    prompt: renderTemplateString(template.prompt, scope),
    answer: answerValue,
    answerType,
    // Narrowed by the boolean check above: a choice question never has a boolean answer.
    choices: template.choices
      ? buildChoices(template.choices, answerValue as string | number, scope, rng)
      : undefined,
    hint: template.hint ? renderTemplateString(template.hint, scope) : undefined,
    vars: { ...scope },
  };
}
