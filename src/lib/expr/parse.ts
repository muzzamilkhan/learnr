import { tokenize, type Token } from './tokenize';

export type Node =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'var'; name: string }
  | { kind: 'unary'; op: string; operand: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'ternary'; test: Node; then: Node; other: Node }
  | { kind: 'call'; name: string; args: Node[] };

/** Binding power per binary operator. Higher binds tighter. */
const BINARY_PRECEDENCE: Record<string, number> = {
  '||': 1,
  '&&': 2,
  '==': 3,
  '!=': 3,
  '<': 4,
  '<=': 4,
  '>': 4,
  '>=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
  '^': 7,
};

const RIGHT_ASSOCIATIVE = new Set(['^']);

/** Literals that are keywords rather than variables. */
const KEYWORDS: Record<string, Node> = Object.assign(Object.create(null), {
  true: { kind: 'bool', value: true },
  false: { kind: 'bool', value: false },
});

export function parse(src: string): Node {
  const tokens = tokenize(src);
  let i = 0;

  const peek = () => tokens[i];
  const next = () => tokens[i++];

  const fail = (message: string, token: Token = peek()): never => {
    throw new Error(`${message} at position ${token.pos} in ${JSON.stringify(src)}`);
  };

  const expect = (value: string) => {
    const token = peek();
    if (token.value !== value || token.type === 'eof') {
      fail(`Expected ${JSON.stringify(value)}`);
    }
    return next();
  };

  function parsePrimary(): Node {
    const token = peek();

    if (token.type === 'eof') return fail('Unexpected end of expression');

    if (token.type === 'number') {
      next();
      return { kind: 'num', value: Number(token.value) };
    }

    if (token.type === 'string') {
      next();
      return { kind: 'str', value: token.value };
    }

    if (token.type === 'ident') {
      next();
      if (peek().value === '(' && peek().type === 'punc') {
        next(); // consume '('
        const args: Node[] = [];
        if (peek().value !== ')') {
          args.push(parseExpression(0));
          while (peek().value === ',') {
            next();
            args.push(parseExpression(0));
          }
        }
        expect(')');
        return { kind: 'call', name: token.value, args };
      }
      if (Object.hasOwn(KEYWORDS, token.value)) return KEYWORDS[token.value];
      return { kind: 'var', name: token.value };
    }

    if (token.value === '(') {
      next();
      const inner = parseExpression(0);
      expect(')');
      return inner;
    }

    if (token.type === 'op' && (token.value === '-' || token.value === '!')) {
      next();
      // Unary binds tighter than every binary operator except '^'.
      return { kind: 'unary', op: token.value, operand: parseExpression(6.5) };
    }

    return fail(`Unexpected token ${JSON.stringify(token.value)}`);
  }

  function parseExpression(minPrecedence: number): Node {
    let left = parsePrimary();

    for (;;) {
      const token = peek();

      if (token.type === 'op' && token.value === '?' && minPrecedence <= 0) {
        next();
        const then = parseExpression(0);
        expect(':');
        const other = parseExpression(0);
        left = { kind: 'ternary', test: left, then, other };
        continue;
      }

      if (token.type !== 'op') break;
      const precedence = BINARY_PRECEDENCE[token.value];
      if (precedence === undefined || precedence < minPrecedence) break;

      next();
      const nextMin = RIGHT_ASSOCIATIVE.has(token.value) ? precedence : precedence + 1;
      const right = parseExpression(nextMin);
      left = { kind: 'binary', op: token.value, left, right };
    }

    return left;
  }

  const ast = parseExpression(0);
  if (peek().type !== 'eof') fail(`Unexpected token ${JSON.stringify(peek().value)}`);
  return ast;
}
