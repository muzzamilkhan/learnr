import { parse, type Node } from './parse';

export type Value = number | string | boolean;
export type Scope = Record<string, unknown>;

const gcd2 = (a: number, b: number): number => {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
};

type Fn = (args: Value[]) => Value;

const numeric = (name: string, fn: (...n: number[]) => Value): Fn => {
  return (args) => {
    const nums = args.map((a, index) => {
      if (typeof a !== 'number') {
        throw new Error(`${name}() expects numbers, got ${typeof a} at argument ${index + 1}`);
      }
      return a;
    });
    return fn(...nums);
  };
};

// Null prototype: keeps `constructor`, `toString` etc. from resolving as functions.
export const FUNCTIONS: Record<string, Fn> = Object.assign(Object.create(null), {
  abs: numeric('abs', Math.abs),
  min: numeric('min', (...n) => Math.min(...n)),
  max: numeric('max', (...n) => Math.max(...n)),
  floor: numeric('floor', Math.floor),
  ceil: numeric('ceil', Math.ceil),
  round: numeric('round', Math.round),
  trunc: numeric('trunc', Math.trunc),
  sign: numeric('sign', Math.sign),
  sqrt: numeric('sqrt', Math.sqrt),
  pow: numeric('pow', (a, b) => a ** b),
  mod: numeric('mod', (a, b) => ((a % b) + b) % b),
  gcd: numeric('gcd', (...n) => n.reduce(gcd2)),
  lcm: numeric('lcm', (...n) => n.reduce((a, b) => Math.abs(a * b) / gcd2(a, b))),
  isInt: numeric('isInt', (n) => Number.isInteger(n)),
  isEven: numeric('isEven', (n) => n % 2 === 0),
  isOdd: numeric('isOdd', (n) => Math.abs(n % 2) === 1),
});

function truthy(value: Value): boolean {
  return typeof value === 'boolean' ? value : Boolean(value);
}

function requireNumber(value: Value, op: string): number {
  if (typeof value !== 'number') {
    throw new Error(`Operator ${op} expects numbers, got ${typeof value}`);
  }
  return value;
}

function evaluateNode(node: Node, scope: Scope): Value {
  switch (node.kind) {
    case 'num':
    case 'str':
    case 'bool':
      return node.value;

    case 'var': {
      if (!Object.hasOwn(scope, node.name)) {
        throw new Error(`Unknown variable: ${node.name}`);
      }
      const value = scope[node.name];
      if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') {
        throw new Error(`Variable ${node.name} is not a number, string or boolean`);
      }
      return value;
    }

    case 'unary': {
      const operand = evaluateNode(node.operand, scope);
      if (node.op === '!') return !truthy(operand);
      return -requireNumber(operand, '-');
    }

    case 'ternary':
      return truthy(evaluateNode(node.test, scope))
        ? evaluateNode(node.then, scope)
        : evaluateNode(node.other, scope);

    case 'call': {
      if (!Object.hasOwn(FUNCTIONS, node.name)) {
        throw new Error(`Unknown function: ${node.name}`);
      }
      const fn = FUNCTIONS[node.name];
      return fn(node.args.map((arg) => evaluateNode(arg, scope)));
    }

    case 'binary': {
      // Short-circuit before evaluating the right side.
      if (node.op === '&&') {
        return truthy(evaluateNode(node.left, scope)) && truthy(evaluateNode(node.right, scope));
      }
      if (node.op === '||') {
        return truthy(evaluateNode(node.left, scope)) || truthy(evaluateNode(node.right, scope));
      }

      const left = evaluateNode(node.left, scope);
      const right = evaluateNode(node.right, scope);

      switch (node.op) {
        case '==':
          return left === right;
        case '!=':
          return left !== right;
        case '+':
          if (typeof left === 'string' || typeof right === 'string') {
            return `${left}${right}`;
          }
          return requireNumber(left, '+') + requireNumber(right, '+');
        case '-':
          return requireNumber(left, '-') - requireNumber(right, '-');
        case '*':
          return requireNumber(left, '*') * requireNumber(right, '*');
        case '/':
          return requireNumber(left, '/') / requireNumber(right, '/');
        case '%':
          return requireNumber(left, '%') % requireNumber(right, '%');
        case '^':
          return requireNumber(left, '^') ** requireNumber(right, '^');
        case '<':
          return requireNumber(left, '<') < requireNumber(right, '<');
        case '<=':
          return requireNumber(left, '<=') <= requireNumber(right, '<=');
        case '>':
          return requireNumber(left, '>') > requireNumber(right, '>');
        case '>=':
          return requireNumber(left, '>=') >= requireNumber(right, '>=');
        default:
          throw new Error(`Unknown operator: ${node.op}`);
      }
    }
  }
}

/** Parse once, evaluate many times. Prefer this on hot paths. */
export function compile(src: string): (scope: Scope) => Value {
  const ast = parse(src);
  return (scope: Scope) => evaluateNode(ast, scope);
}

export function evaluate(src: string, scope: Scope = {}): Value {
  return compile(src)(scope);
}

/** Evaluate to a boolean, for constraint checks. */
export function evaluateCondition(src: string, scope: Scope = {}): boolean {
  return truthy(evaluate(src, scope));
}
