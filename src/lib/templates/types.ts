/**
 * Question templates are data, authored outside the app (by hand or by an AI) and
 * expanded into concrete questions at runtime.
 *
 * The design goal is that a template never restricts the *shape* of a question:
 * every numeric field is an expression, so bounds can depend on earlier variables,
 * and constraints are arbitrary boolean expressions over the bound variables.
 */

/** A variable the engine binds before rendering the prompt. */
export type VarSpec =
  /** Integer drawn from [min, max]. Bounds are expressions, so `max: "x - 1"` works. */
  | { name: string; kind: 'int'; min: Expr; max: Expr; step?: number }
  /** Decimal drawn from [min, max], rounded to `decimals` places (default 2). */
  | { name: string; kind: 'number'; min: Expr; max: Expr; decimals?: number }
  /** Drawn from a fixed list, optionally weighted. Values may be numbers or strings. */
  | { name: string; kind: 'pick'; from: readonly (string | number)[]; weights?: readonly number[] }
  /** Derived from variables already bound. Never random. */
  | { name: string; kind: 'expr'; expr: Expr };

/** An expression string, evaluated against the variables bound so far. */
export type Expr = string;

export type AnswerType = 'number' | 'text' | 'choice';

export interface ChoiceSpec {
  /** Total options shown, including the correct one. */
  count: number;
  /**
   * Expressions producing plausible wrong answers. Duplicates and values equal to
   * the correct answer are dropped; the engine tops up from `jitter` if short.
   */
  distractors?: readonly Expr[];
  /** Fallback distractor generator: correct answer +/- a random offset in this range. */
  jitter?: { min: Expr; max: Expr };
}

export interface QuestionTemplate {
  id: string;
  subject: string;
  category: string;
  level: number;
  /** Prompt with `{expression}` holes, e.g. "What is {x} + {y}?" */
  prompt: string;
  vars: readonly VarSpec[];
  /** Boolean expressions all bindings must satisfy, e.g. ["x > y", "isInt(x / y)"]. */
  constraints?: readonly Expr[];
  /** Expression producing the correct answer. */
  answer: Expr;
  answerType?: AnswerType;
  choices?: ChoiceSpec;
  /** Optional hint, also supports `{expression}` holes. */
  hint?: string;
  tags?: readonly string[];
}

/** A template expanded into something a child can actually be shown. */
export interface Question {
  templateId: string;
  subject: string;
  category: string;
  level: number;
  prompt: string;
  answer: string | number;
  answerType: AnswerType;
  choices?: (string | number)[];
  hint?: string;
  /** The bound variables, kept for debugging and analytics. */
  vars: Record<string, string | number | boolean>;
}
