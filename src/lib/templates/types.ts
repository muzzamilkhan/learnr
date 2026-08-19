import type { YearLevel } from '../curriculum';

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

/**
 * How the child answers. `boolean` is true/false - the answer expression evaluates
 * to a boolean and the play screen renders two fixed buttons, so it needs no
 * `choices` of its own.
 */
export type AnswerType = 'number' | 'text' | 'choice' | 'boolean';

/** Four is the most options that stay legible and thumb-sized on an iPad. */
export const MAX_CHOICES = 4;

export interface ChoiceSpec {
  /** Total options shown, including the correct one. At most `MAX_CHOICES`. */
  count: number;
  /**
   * Expressions producing plausible wrong answers. Duplicates and values equal to
   * the correct answer are dropped; the engine tops up from `jitter` if short.
   */
  distractors?: readonly Expr[];
  /** Fallback distractor generator: correct answer +/- a random offset in this range. */
  jitter?: { min: Expr; max: Expr };
}

/**
 * Everything it takes to make a question, and nothing about who is being asked.
 *
 * The split exists because a speed run has no school year and no curriculum
 * topic. Giving one a nominal year would be a lie told in the type system - the
 * one place a level is guaranteed to be a real Australian school year - so the
 * parts that make a question are separated from the parts that place it in a
 * course, and a speed run uses only the first half.
 */
export interface QuestionSpec {
  /** Prompt with `{expression}` holes, e.g. "What is {x} + {y}?" */
  prompt: string;
  vars: readonly VarSpec[];
  /** Boolean expressions all bindings must satisfy, e.g. ["x > y", "isInt(x / y)"]. */
  constraints?: readonly Expr[];
  /** Expression producing the correct answer. A boolean result makes it true/false. */
  answer: Expr;
  /** Defaults to what `answer` evaluates to: number, boolean, or otherwise text. */
  answerType?: AnswerType;
  choices?: ChoiceSpec;
  /** Optional hint, also supports `{expression}` holes. */
  hint?: string;
}

/** A spec placed in a course: who is being asked, and what it practises. */
export interface QuestionTemplate extends QuestionSpec {
  id: string;
  subject: string;
  /**
   * What this question practises, e.g. "counting numbers". Topics are shared
   * across years - the same topic reappears at a harder level - so a topic is a
   * tag on the template, never a property of the level.
   */
  topic: string;
  /** The Australian school year this template was written for. */
  level: YearLevel;
  tags?: readonly string[];
}

/** A spec expanded, with nothing yet saying who was asked. */
export interface GeneratedQuestion {
  prompt: string;
  answer: string | number | boolean;
  answerType: AnswerType;
  /** Only for `choice` questions; true/false renders its own buttons. */
  choices?: (string | number)[];
  hint?: string;
  /** The bound variables, kept for debugging and analytics. */
  vars: Record<string, string | number | boolean>;
}

/** A template expanded into something a child can actually be shown. */
export interface Question extends GeneratedQuestion {
  templateId: string;
  subject: string;
  topic: string;
  level: YearLevel;
}
