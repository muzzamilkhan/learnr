import type { Question } from '../templates/types';

/**
 * Turning a question into something worth listening to.
 *
 * A child who cannot read cannot start, and every question here is a sentence.
 * Narration is what makes the question itself as wordless as the door and the
 * lightbulb - but a prompt handed to a synthesiser as it stands is not narration:
 * "What is 7 − 3?" is spoken "What is 7 3?", which is worse than silence.
 *
 * So this is the translation, and it is pure like everything else in `lib` - no
 * browser, no clock, no `speechSynthesis`. The shim that does the speaking lives
 * beside the components in `src/components/speech.ts`.
 *
 * Everything here runs on a *rendered* prompt, with the `{...}` holes already
 * filled, so none of the expression language reaches it. What is left is the
 * arithmetic notation the content is written in.
 */

/** Symbols that stand for a word wherever they appear. */
const SYMBOLS: readonly (readonly [RegExp, string])[] = [
  // Degrees first, and with its C: the content writes "8°C", and "8 degrees C"
  // is a letter left over for the voice to spell out.
  [/°\s*C\b/g, ' degrees '],
  [/°/g, ' degrees '],
  [/\+/g, ' plus '],
  // Both minuses: the content uses U+2212, but a rendered value can carry the
  // keyboard one.
  [/−/g, ' minus '],
  [/×/g, ' times '],
  [/÷/g, ' divided by '],
  [/=/g, ' equals '],
  [/%/g, ' percent '],
  [/\(/g, ' open bracket '],
  [/\)/g, ' close bracket '],
];

/**
 * A hyphen is a minus only when it stands alone. Inside a word it is a hyphen -
 * "two-thirds" is one thing a child is asked about, not a subtraction.
 */
const SPACED_HYPHEN = /(^|\s)-(?=\s|\d)/g;

/**
 * A slash between numbers is a fraction: every one in the shipped content is,
 * because division is written `÷`. The gap marker counts as a number here, so
 * "?/9" reads as a fraction with its top missing.
 */
const FRACTION = /(\d|\?)\s*\/\s*(?=\d)/g;

/** "$5" says its symbol first and its word last, so the amount has to move. */
const AMOUNT = /\$(\d+(?:\.\d+)?)/g;

/** "50c" is fifty cents. Runs after the degrees rule, which eats the only other c. */
const CENTS = /(\d)c\b/g;

/**
 * An amount in front of a coin or a note is describing it rather than counting
 * it, and takes the singular: a "$2 coin", not a "2 dollars coin". Run before
 * the plurals below, which would otherwise get there first.
 */
const COIN = /(?:\$(\d+)|(\d+)c)(?=\s+(?:coins?|notes?)\b)/g;

/**
 * The units the content abbreviates. A synthesiser reads "10 cm" as "ten see em"
 * as often as not, and this is the one place a child is listening rather than
 * reading. Centimetres before metres, or the m would be taken out of the cm.
 */
const UNITS: readonly (readonly [RegExp, string])[] = [
  [/(\d)\s*cm\b/g, '$1 centimetres'],
  [/(\d)\s*mm\b/g, '$1 millimetres'],
  [/(\d)\s*km\b/g, '$1 kilometres'],
  [/(\d)\s*kg\b/g, '$1 kilograms'],
  [/(\d)\s*m\b/g, '$1 metres'],
];

/**
 * A `?` is the gap in "12, 13, ?, 15" when nothing wordlike precedes it, and the
 * sentence's own question mark when something does. That is what tells the two
 * apart in "What goes in the box? 4 + ? = 9", where both are in one prompt.
 */
const GAP = /(^|[^A-Za-z0-9])\?/g;

/** A rendered prompt, hint or label, as it should be read out. */
export function spokenText(text: string): string {
  let out = text;

  // Order matters here, and only between these three. The fraction rule needs the
  // gap still written as `?`, and the gap rule has to run before anything inserts
  // a space of its own: "$3?" ends in punctuation, but " 3 dollars ?" reads as a
  // gap, and a question would be spoken with a "what" on the end of it.
  out = out.replace(FRACTION, '$1 out of ');
  out = out.replace(GAP, '$1what');
  out = out.replace(COIN, (_, dollars?: string, cents?: string) =>
    dollars === undefined ? ` ${cents} cent ` : ` ${dollars} dollar `,
  );
  out = out.replace(AMOUNT, (_, amount: string) =>
    amount === '1' ? ' 1 dollar ' : ` ${amount} dollars `,
  );
  out = out.replace(SPACED_HYPHEN, ' minus ');
  for (const [pattern, word] of SYMBOLS) out = out.replace(pattern, word);
  out = out.replace(CENTS, '$1 cents');
  for (const [pattern, word] of UNITS) out = out.replace(pattern, word);

  // The substitutions leave gaps of their own, and a space before a full stop is
  // a pause the voice would take for nothing.
  return out
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

/**
 * What to say when a question arrives: the prompt, and the options when they are
 * words rather than numbers.
 *
 * A word answer below Year 4 is a `choice` question precisely because the child
 * cannot spell it, so three unread buttons would leave that question exactly as
 * unanswerable as it was. Numbers are left unsaid - a child reads numerals long
 * before words, and four numbers read back is noise over the question. True and
 * false are the same two words on every question that has them, and the prompt
 * has already said them.
 */
export function questionNarration(question: Question): string {
  const prompt = spokenText(question.prompt);
  const choices = question.answerType === 'boolean' ? undefined : question.choices;
  if (!choices || !choices.some((choice) => /[A-Za-z]/.test(String(choice)))) return prompt;

  const labels = choices.map((choice) => spokenText(String(choice)));
  if (alreadyOffered(prompt, labels)) return prompt;

  const last = labels[labels.length - 1];
  const rest = labels.slice(0, -1);
  // Two options are "a or b"; three or more keep the comma before the "or", so
  // the voice pauses between them.
  const list = rest.length === 1 ? `${rest[0]} or ${last}` : `${rest.join(', ')}, or ${last}`;
  // The prompt has lost its question mark when it ended in the gap - "12, 13, ?"
  // - and two sentences with nothing between them are read as one long one.
  const stop = /[.!?]$/.test(prompt) ? '' : '.';
  return `${prompt}${stop} Is it ${list}?`;
}

/**
 * Whether the prompt has already offered these options, so reading them again
 * would only be a repeat before the child can answer: "Which ribbon is longer,
 * red or blue? Is it red or blue?"
 *
 * Naming a word and offering it are not the same thing, which is why finding
 * every label somewhere in the sentence is not enough on its own. "What comes
 * next? red, orange, purple, red, orange, purple, red, ?" contains all three of
 * its options and offers none of them - they are the pattern being asked about.
 * Taking that as "already said" left a Kindergartener with three unread buttons
 * and nothing spoken to tell them apart, which is the whole thing narration is
 * here to prevent.
 *
 * The word that separates the two is "or". A prompt offering a choice says one
 * somewhere between the alternatives, and a prompt using the same words as data
 * has no reason to. So both have to hold: every option named, and named as an
 * alternative to another one.
 */
function alreadyOffered(prompt: string, labels: readonly string[]): boolean {
  const spoken = prompt.toLowerCase();
  if (!labels.every((label) => spoken.includes(label.toLowerCase()))) return false;

  const alternatives = labels.map(escapeForRegExp).join('|');
  // Within one sentence: the "or" has to sit between two of the options rather
  // than anywhere in the prompt, so "Is it more or less than 5? 3, 5, 7" does
  // not count as having offered 3, 5 and 7.
  return new RegExp(`(?:${alternatives})[^.!?]*\\bor\\b[^.!?]*(?:${alternatives})`, 'i').test(
    prompt,
  );
}

const escapeForRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
