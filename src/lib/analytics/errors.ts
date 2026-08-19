import type { YearLevel } from '../curriculum';
import type { AnsweredQuestion } from './report';

/**
 * What a wrong answer says about the child who gave it.
 *
 * `topicReports` measures *how often* a topic goes wrong; this measures *how*.
 * The two are not the same question and the second is the one a parent sits
 * down with: "23% on measurement" says a topic is hard, and "she gives the
 * number back without converting the unit, and did it in measurement, decimals
 * and fractions" says what to do about it on Saturday morning.
 *
 * That last part is why this is not a column on `TopicSkill`. A misconception
 * is not a property of a topic - the same one turns up across several, and
 * grouping by topic is exactly what hides it. So this groups by the mistake and
 * lists the topics underneath, the other way up from every other read here.
 *
 * Pure like the rest of `lib`: it is handed answers and returns findings. It
 * reads no clock - a mistake does not stop being that mistake next week - and
 * nothing that decides what to ask next may read it. The selector is driven by
 * correctness alone, and a taxonomy of wrong answers is a rich, plausible and
 * completely untested basis for steering a child's practice; it is reported to
 * the grown-up who can judge it, which is the whole scope of this module.
 */

export type ErrorKind =
  | 'copied'
  | 'power-of-ten'
  | 'sign-dropped'
  | 'added-not-multiplied'
  | 'clock-format';

/**
 * The order the kinds are tried in, and it is deliberate rather than incidental.
 *
 * A single wrong answer can satisfy two tests - `415` for "how many metres is
 * 415 centimetres" is both a number copied out of the question and the right
 * answer times a hundred - and the first match wins. `copied` leads because it
 * is the more specific reading: "she gave the number back" tells a parent she
 * did not attempt the conversion at all, where "the decimal point is in the
 * wrong place" says she tried and slipped. Reordering these two changes what
 * the report says about a child, so it is a decision and not an array literal.
 */
const ORDER: readonly ErrorKind[] = [
  'copied',
  'sign-dropped',
  'clock-format',
  'added-not-multiplied',
  'power-of-ten',
];

/** How the report says each one in words. Written to describe the child's move, never to judge it. */
export const ERROR_LABELS: Record<ErrorKind, string> = {
  copied: 'Gave back a number from the question',
  'power-of-ten': 'Decimal point in the wrong place',
  'sign-dropped': 'Right size, wrong sign',
  'added-not-multiplied': 'Added where the question needed multiplying',
  'clock-format': 'Answered a duration as a clock time',
};

/** What to do about each one - the reason a parent opened the report at all. */
export const ERROR_ADVICE: Record<ErrorKind, string> = {
  copied:
    'The number in the question is being read as the answer. Worth checking she knows what the question is asking for before working on the method.',
  'power-of-ten':
    'The method is there and the place value is not. Practising ×10 and ÷10 on their own is likely to fix several topics at once.',
  'sign-dropped':
    'She can do the subtraction - what is missing is how to write a number below zero. A number line is the usual way in.',
  'added-not-multiplied':
    'Area and perimeter are being mixed up, or the words are. Drawing the rectangle out in squares makes the difference visible.',
  'clock-format':
    'She has worked out the right time and written it as a clock reading. This is about what to type, not about time.',
};

/** A number as it appears in a prompt, sign and decimals included. */
const NUMBER = /-?\d+(?:\.\d+)?/g;

const numeric = (text: string): number | null => {
  const value = Number(text.trim());
  return Number.isFinite(value) ? value : null;
};

const promptNumbers = (prompt: string): number[] =>
  (prompt.match(NUMBER) ?? []).map(Number).filter(Number.isFinite);

/** Equality that survives floating point, at the scale school arithmetic works in. */
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-9;

/**
 * Which mistake this answer looks like, or `null` when it looks like no
 * particular one.
 *
 * `null` is a real and common result, and it is deliberately easy to return.
 * Every kind here has a narrow, checkable test behind it; a classifier that
 * stretched to explain `282 × 7 → 25` would be guessing, and a guess printed
 * next to a child's name reads exactly as confidently as a finding. The share
 * of answers that come back `null` is the honest measure of how much this
 * module is worth, which is why the lab screen puts that number at the top.
 */
export function classifyError(answer: AnsweredQuestion): ErrorKind | null {
  if (answer.correct) return null;

  const expected = numeric(answer.expected);
  const response = numeric(answer.response);
  const numbers = promptNumbers(answer.prompt);

  for (const kind of ORDER) {
    if (matches(kind, { answer, expected, response, numbers })) return kind;
  }

  return null;
}

interface Candidate {
  answer: AnsweredQuestion;
  expected: number | null;
  response: number | null;
  numbers: readonly number[];
}

function matches(kind: ErrorKind, { answer, expected, response, numbers }: Candidate): boolean {
  switch (kind) {
    /**
     * The response is a number the question already contained. It covers the
     * child who answers "415 centimetres in metres" with 415 and the one who
     * answers "3/8 + 7/16 = ?/16" with 7, which look like different mistakes
     * and are the same one: a number was taken from the question rather than
     * made from it. Two detectors with one body would only be two names for
     * this line.
     */
    case 'copied':
      return (
        response !== null &&
        expected !== null &&
        !near(response, expected) &&
        numbers.some((value) => near(value, response))
      );

    /** The magnitude is right and only the sign is missing. */
    case 'sign-dropped':
      return expected !== null && response !== null && expected < 0 && near(response, -expected);

    /**
     * A duration written as a clock reading: `1.45` and `10.55` were both given
     * for 55 minutes, on questions asking how long a bus took.
     *
     * The test is not that the digits after the point are the answer - in the
     * first of those they are not. It is that they are a *minutes figure the
     * question itself contained* (`10:45` and `9:55` respectively), on a
     * question whose answer is a whole number of minutes. That is what tells
     * this apart from an answer that is merely decimal and merely wrong: the
     * child has read a time off the question and typed it in clock form, which
     * is a mistake about what to type rather than one about time.
     */
    case 'clock-format': {
      const shape = /^\s*\d{1,2}[.:](\d{2})\s*$/.exec(answer.response);
      if (shape === null || expected === null || !Number.isInteger(expected)) return false;
      const minutes = Number(shape[1]);
      // `.00` is excluded because it says nothing: every `hh:00` in a prompt
      // supplies a zero, so `8.00` for an answer of 7 matched this rule while
      // actually being an hour out. A trailing `.00` is a child typing a whole
      // number with a decimal point, which is not this mistake.
      if (minutes === 0 || minutes >= 60) return false;
      return near(minutes, expected) || numbers.some((value) => near(value, minutes));
    }

    /** The answer wanted a product of two of the question's numbers and got their sum. */
    case 'added-not-multiplied':
      return (
        expected !== null &&
        response !== null &&
        numbers.some((a, i) =>
          numbers.slice(i + 1).some((b) => near(a * b, expected) && near(a + b, response)),
        )
      );

    /**
     * Out by a factor of ten, a hundred, a thousand - in either direction. The
     * ratio has to be an exact power of ten, so `10` answered for `5` is not
     * this and `1000` answered for `100` is.
     */
    case 'power-of-ten': {
      if (expected === null || response === null) return false;
      if (expected === 0 || response === 0) return false;
      const exponent = Math.log10(Math.abs(expected / response));
      return Math.abs(exponent - Math.round(exponent)) < 1e-9 && Math.round(exponent) !== 0;
    }
  }
}

/** One mistake, everywhere the child made it. */
export interface ErrorCluster {
  kind: ErrorKind;
  count: number;
  /** Every topic and level it turned up in - the cross-topic reach that makes it worth naming. */
  topics: { topic: string; level: YearLevel }[];
  /** The answers themselves, newest first, so a parent can check the finding against the questions. */
  examples: AnsweredQuestion[];
}

/**
 * Below this many, it is a slip and not a pattern.
 *
 * The same bar `MIN_OBSERVATIONS` sets for calling a topic hard, and set here
 * for the same reason: one wrong answer that happens to fit a rule is noise,
 * and telling a parent their child has a misconception on that basis is worse
 * than telling them nothing. Two is enough to be worth a look because a cluster
 * is a prompt to go and read the examples, not a diagnosis on its own.
 */
export const MIN_CLUSTER = 2;

/** How many answers a cluster carries for the parent to check it against. */
export const CLUSTER_EXAMPLES = 4;

/**
 * The mistakes worth naming, most-made first.
 *
 * Ordered by count rather than by anything about the topics, because the
 * argument this module makes is that the mistake outranks the topic: a slip
 * made nine times across three topics is one thing to teach, and three topic
 * bars at 30% are three things to worry about.
 */
export function errorClusters(
  answers: readonly AnsweredQuestion[],
  minimum = MIN_CLUSTER,
): ErrorCluster[] {
  const clusters = new Map<ErrorKind, ErrorCluster>();

  for (const answer of answers) {
    const kind = classifyError(answer);
    if (kind === null) continue;

    const cluster = clusters.get(kind) ?? { kind, count: 0, topics: [], examples: [] };
    cluster.count += 1;
    if (!cluster.topics.some((seen) => seen.topic === answer.topic && seen.level === answer.level)) {
      cluster.topics.push({ topic: answer.topic, level: answer.level });
    }
    cluster.examples.push(answer);
    clusters.set(kind, cluster);
  }

  return [...clusters.values()]
    .filter((cluster) => cluster.count >= minimum)
    .map((cluster) => ({
      ...cluster,
      examples: [...cluster.examples]
        .sort((a, b) => b.answeredAt - a.answeredAt)
        .slice(0, CLUSTER_EXAMPLES),
    }))
    .sort((a, b) => b.count - a.count || ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
}

/** What share of wrong answers the taxonomy could name - the number this idea is judged on. */
export function classifiedShare(answers: readonly AnsweredQuestion[]): {
  wrong: number;
  classified: number;
} {
  const wrong = answers.filter((answer) => !answer.correct);
  return {
    wrong: wrong.length,
    classified: wrong.filter((answer) => classifyError(answer) !== null).length,
  };
}
