export type TokenType = 'number' | 'string' | 'ident' | 'op' | 'punc' | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const OPERATORS = [
  '&&',
  '||',
  '==',
  '!=',
  '<=',
  '>=',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '!',
  '?',
  ':',
];

const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string) => /[A-Za-z0-9_]/.test(c);

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const c = src[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      const start = i;
      while (i < src.length && isDigit(src[i])) i++;
      if (src[i] === '.') {
        i++;
        while (i < src.length && isDigit(src[i])) i++;
      }
      tokens.push({ type: 'number', value: src.slice(start, i), pos: start });
      continue;
    }

    if (c === '"' || c === "'") {
      const start = i;
      const quote = c;
      i++;
      let value = '';
      while (i < src.length && src[i] !== quote) {
        if (src[i] === '\\' && i + 1 < src.length) {
          value += src[i + 1];
          i += 2;
        } else {
          value += src[i];
          i++;
        }
      }
      if (i >= src.length) {
        throw new Error(`Unterminated string starting at position ${start}`);
      }
      i++; // closing quote
      tokens.push({ type: 'string', value, pos: start });
      continue;
    }

    if (isIdentStart(c)) {
      const start = i;
      while (i < src.length && isIdentPart(src[i])) i++;
      tokens.push({ type: 'ident', value: src.slice(start, i), pos: start });
      continue;
    }

    if (c === '(' || c === ')' || c === ',') {
      tokens.push({ type: 'punc', value: c, pos: i });
      i++;
      continue;
    }

    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (op) {
      tokens.push({ type: 'op', value: op, pos: i });
      i += op.length;
      continue;
    }

    throw new Error(`Unexpected character ${JSON.stringify(c)} at position ${i}`);
  }

  tokens.push({ type: 'eof', value: '', pos: src.length });
  return tokens;
}
