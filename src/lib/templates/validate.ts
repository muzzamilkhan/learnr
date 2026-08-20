import { parse, type Node } from '../expr';
import { isYearLevel, YEAR_LEVELS } from '../curriculum';
import { figureIssues } from '../figures/build';
import { figureKindModule } from '../figures/registry';
import { FIGURE_KINDS } from '../figures/types';
import { createRng } from '../rng';
import { generate, tryBindForced } from './generate';
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
 * The most combinations of `pick` literals the anchoring check will cross
 * before falling back to checking each `pick` var's literals on its own.
 * Two wide picks crossed - fourteen shape names against a five-value pick -
 * is 70, comfortably under this; three wide picks is thousands, and this
 * check runs on every `validateTemplate` call, so the cross product is
 * capped rather than left to grow with however many `pick` vars a template
 * happens to declare. Below the cap every combination is checked, which is
 * what catches a bad pairing reachable only when two picks land on
 * particular values *together*; over it, every literal of every pick is
 * still checked on its own (see the fallback below) - a weaker guarantee,
 * not none.
 */
export const FIGURE_PICK_COMBINATIONS_CAP = 200;

/**
 * How many times a template carrying `choices` is drawn to look for a question
 * that answers itself - the sibling of `FIGURE_DRAWS`, and there for the same
 * reason: a shortcut a child can learn is a shortcut the analytics will then
 * call mastery. Forty is enough that a rank which merely *tends* to repeat
 * will have moved at least once (four options shuffled independently would
 * have to land the same way forty times running), and cheap enough to pay on
 * every validate for the roughly half of shipped templates that are multiple
 * choice.
 */
export const CHOICE_DRAWS = 40;

/**
 * Fewer usable draws than this and neither leakage check says anything. A rank
 * that happened to hold three times, or an answer that took two values because
 * only two draws survived their constraints, is not evidence of a shortcut.
 */
const MIN_CHOICE_DRAWS = 10;

/**
 * The most distinct values the answer may take before the option-set check
 * stops reading disjointness as structure. The leak this catches is a *closed*
 * set - three colours, two units, "morning or afternoon" - where the answer is
 * always drawn from one named list and the wrong options from another, so a
 * child (or a narrator reading the options aloud) can pick the odd one out
 * without doing the maths. A template whose answer takes a hundred-odd distinct
 * numbers has no such list: if its answers happen never to coincide with its
 * distractors, that is arithmetic coincidence, not a tell, and firing on it
 * would block good content. Measured, not guessed - one shipped template with
 * 178 distinct numeric answers is disjoint from its own distractors and must
 * not be flagged.
 */
export const CLOSED_SET_MAX = 8;

/**
 * How many times a single forced combination is retried - with everything
 * not forced redrawn - before it is treated as unsatisfiable and simply not
 * checked. Far fewer than `MAX_ATTEMPTS` in `generate.ts`: that runs once per
 * question, this runs once per combination, up to
 * `FIGURE_PICK_COMBINATIONS_CAP` times, so a bound generous enough that one
 * unlucky draw of an unrelated variable is not mistaken for the combination
 * itself being impossible still has to stay cheap multiplied out that far.
 */
const FORCED_BIND_ATTEMPTS = 20;

/**
 * Every combination of every `pick` var's literals, crossed. `[{}]` is the
 * base the fold starts from, so a spec with a single `pick` var still yields
 * one combination per literal rather than none.
 */
function pickCombinations(
  pickVars: readonly Extract<VarSpec, { kind: 'pick' }>[],
): Record<string, string | number>[] {
  return pickVars.reduce<Record<string, string | number>[]>(
    (combinations, varSpec) =>
      combinations.flatMap((combination) =>
        varSpec.from.map((literal) => ({ ...combination, [varSpec.name]: literal })),
      ),
    [{}],
  );
}

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
        // Which parameters a kind has is the kind's own to declare
        // (`FigureKindModule.fields`), not a list kept here: this used to be a
        // ternary over the kind, which made every new figure kind an edit to
        // this function as well as to its own file - the third of the three
        // places the registry exists to collapse into one. The guard above has
        // already established the kind is one the vocabulary names, so the
        // module is there; `?? []` is for the type, not for a case that happens.
        const kindModule = figureKindModule(figure.kind);

        for (const [name, requirement] of Object.entries(kindModule?.fields ?? {})) {
          // Read off the untrusted object by name, so it stays `unknown` and is
          // re-checked by `checkExpr` rather than trusted from the static type.
          const expr = figure[name];
          // Omitted is what asks for jitter on an optional parameter, and is
          // fine; `checkExpr` itself reports an omitted *required* one.
          if (expr === undefined && requirement === 'optional') continue;
          checkExpr(expr, `figure.${name}`, bound);
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

  // Everything below here draws the template repeatedly, which is only worth
  // doing - and only meaningful - once the spec is known to bind and generate.
  // Captured rather than re-read as `errors.length === 0` at each block, so
  // that a leak reported by one of them cannot silently switch the next one
  // off: the figure check and the choice check are independent questions about
  // the same template, and a template with both should be told about both.
  const generates = errors.length === 0;

  // Checks 2 and 3 of 3 for a figure: it has to build clean, and it has to vary.
  // Both need a bound scope, so they wait for everything above to have passed -
  // there is no point judging a figure against a scope that never bound.
  if (generates && spec.figure !== undefined) {
    const figureSpec = spec.figure;
    const seenIssues = new Set<string>();
    const byAnswer = new Map<string, { count: number; figures: Set<string> }>();

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
    // template. So every literal of every `pick` var is checked directly,
    // through `tryBindForced` rather than by patching a finished scope:
    // patching only the forced variable would leave any `expr` variable
    // derived from it - a `shape` read through an intermediate variable
    // rather than the pick itself - looking at whatever stale value the scope
    // it was copied from happened to have. And where two `pick` vars both
    // feed the figure, forcing them one at a time while the other sits at
    // whatever a single draw happened to bind never tries the pair
    // *together* - a bad combination reachable only when both land on
    // particular values at once would escape exactly the way a single bad
    // literal used to. So below, every combination of every `pick` var's
    // literals is walked, not each var on its own, bounded by
    // `FIGURE_PICK_COMBINATIONS_CAP` - crossing three wide picks is thousands
    // of combinations for a check that runs on every validate.
    const pickVars = (spec.vars as VarSpec[]).filter(
      (varSpec): varSpec is Extract<VarSpec, { kind: 'pick' }> => varSpec.kind === 'pick',
    );

    if (pickVars.length > 0) {
      const combinationCount = pickVars.reduce((total, varSpec) => total * varSpec.from.length, 1);

      const checkCombination = (forced: Record<string, string | number>) => {
        // A forced combination can still fail the spec's own `constraints` -
        // an angle template might pin two variables such that a comparison
        // between them no longer holds for this particular pairing. Retried a
        // bounded number of times with everything *not* forced redrawn, so a
        // single unlucky draw of an unrelated variable is not mistaken for
        // the combination itself being impossible; if every attempt still
        // fails, it is a combination no child would ever be asked, and there
        // is nothing to check a figure against - not an error of its own, so
        // nothing is reported for it.
        for (let attempt = 0; attempt < FORCED_BIND_ATTEMPTS; attempt++) {
          const scope = tryBindForced(
            spec as QuestionSpec,
            createRng(`validate-${label}-figure-forced-${JSON.stringify(forced)}-${attempt}`),
            forced,
          );
          if (scope) {
            for (const issue of figureIssues(figureSpec, scope)) seenIssues.add(issue);
            return;
          }
        }
      };

      if (combinationCount <= FIGURE_PICK_COMBINATIONS_CAP) {
        // Under the cap: cross every pick's literals with every other pick's -
        // this is what actually closes the two-pick gap described above.
        for (const forced of pickCombinations(pickVars)) checkCombination(forced);
      } else {
        // Over the cap: fall back to forcing one pick var at a time. Still
        // exact per literal - still routed through `tryBindForced`, so still
        // correct for an `expr` derived from the forced pick - just not
        // crossed with any other pick's literals. Degrading to that beats
        // skipping the check.
        for (const varSpec of pickVars) {
          for (const literal of varSpec.from) checkCombination({ [varSpec.name]: literal });
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

  // The anchoring rule's sibling, for multiple choice. A figure that never
  // varies teaches a child to recognise the picture instead of the property;
  // an option set that never varies teaches them to recognise the *button*.
  // Both are the same failure - the child gets it right, the profile calls the
  // topic secure, and the thing they learned was not the maths - so both are
  // caught the same way: draw the template many times and look at what stayed
  // the same. Two shapes are worth reporting.
  if (generates && spec.choices !== undefined) {
    const choiceSpec = spec.choices;
    const ranks = new Set<number>();
    const optionCounts = new Set<number>();
    const answerValues = new Set<string>();
    const wrongValues = new Set<string>();
    let usable = 0;
    // Whether *every* option of *every* draw was a number. A sort is the only
    // thing a rank can mean, and there is no meaningful sort over "red" beside
    // 7, so one mixed or wordy draw takes the rank check off the table.
    let everyOptionNumeric = true;

    for (let i = 0; i < CHOICE_DRAWS; i++) {
      let question;
      try {
        question = generate(spec as QuestionSpec, createRng(`validate-${label}-choice-${i}`), label);
      } catch {
        // Skipped rather than reported: the generation proof above is what
        // reports a template that cannot generate, and a draw that failed is
        // simply not evidence about the options. `usable` is what the two
        // checks below key off, so skipping costs a draw and never a verdict.
        continue;
      }

      // A boolean answer renders two fixed buttons and any authored choices
      // are dropped, so there is no option set here to have leaked.
      const options = question.choices;
      if (!options) continue;
      usable++;

      // Compared as the text a child reads off the button, which is what any
      // shortcut is actually keyed to - and a `choice` answer is never a
      // boolean, so there is no `true`/`"true"` pair for `String` to conflate.
      const answerKey = String(question.answer);
      answerValues.add(answerKey);
      for (const option of options) {
        const key = String(option);
        if (key !== answerKey) wrongValues.add(key);
      }

      if (options.every((option) => typeof option === 'number')) {
        const sorted = [...(options as number[])].sort((a, b) => a - b);
        ranks.add(sorted.indexOf(question.answer as number));
        optionCounts.add(options.length);
      } else {
        everyOptionNumeric = false;
      }
    }

    if (usable >= MIN_CHOICE_DRAWS) {
      // Rank. One rank has to account for *every* usable draw. A rank that
      // holds 90% of the time is a content smell and not a defect - the child
      // who bets on it is wrong often enough to have to look - and a check
      // that blocks a build on a smell blocks legitimate content. So the bar
      // is constancy, not skew.
      if (everyOptionNumeric && ranks.size === 1 && !choiceSpec.rankIsTheQuestion) {
        const rank = [...ranks][0] + 1;
        const count = Math.max(...optionCounts);
        errors.push(
          `choices: sorted smallest to largest, the answer was rank ${rank} of ${count} in ` +
            `every one of ${usable} draws - "never the biggest, never the smallest" beats ` +
            'this question without doing the maths. Vary the distractors so the answer ' +
            'moves, or set choices.rankIsTheQuestion if finding the extreme *is* the question',
        );
      }

      // Option set. The answer is always drawn from one closed list and the
      // wrong options from another, so the answer is the odd one out - which
      // narration reads aloud, making it beatable by a child who cannot read.
      // The size guard is what keeps this about structure: see CLOSED_SET_MAX.
      const disjoint = [...answerValues].every((value) => !wrongValues.has(value));
      if (answerValues.size <= CLOSED_SET_MAX && disjoint) {
        const sample = [...answerValues].sort().slice(0, 4).join(', ');
        errors.push(
          `choices: across ${usable} draws the answer only ever took ${answerValues.size} ` +
            `distinct values (${sample}), and not one of them was ever offered as a wrong ` +
            'option - the option set announces which button is the answer. Draw the ' +
            'distractors from the same values the answer itself can take',
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
