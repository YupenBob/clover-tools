/** A bounded arithmetic grammar; expressions are never executed as JavaScript. */
export type ArithmeticErrorCode =
  "syntax" | "division" | "domain" | "range" | "limit";

export class ArithmeticError extends Error {
  code: ArithmeticErrorCode;
  constructor(code: ArithmeticErrorCode) {
    super(code);
    this.name = "ArithmeticError";
    this.code = code;
  }
}

type Token = { kind: string; value?: number };

export function evaluateArithmetic(expression: string): number {
  if (expression.length > 2000) throw new ArithmeticError("limit");
  const source = expression
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/−/g, "-");
  const tokens: Token[] = [];
  for (let i = 0; i < source.length;) {
    if (/\s/.test(source[i])) {
      i++;
      continue;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(
      source.slice(i),
    );
    if (number) {
      const value = Number(number[0]);
      if (!Number.isFinite(value)) throw new ArithmeticError("range");
      tokens.push({ kind: "number", value });
      i += number[0].length;
    } else {
      const kind = source[i++];
      if (!"+-*/^()!%√".includes(kind)) throw new ArithmeticError("syntax");
      tokens.push({ kind });
    }
    if (tokens.length > 1024) throw new ArithmeticError("limit");
  }
  if (!tokens.length) throw new ArithmeticError("syntax");
  let position = 0;
  let depth = 0;
  const peek = () => tokens[position]?.kind;
  const take = (kind: string) => {
    if (peek() !== kind) return false;
    position++;
    return true;
  };
  const finite = (value: number) => {
    if (Number.isNaN(value)) throw new ArithmeticError("domain");
    if (!Number.isFinite(value)) throw new ArithmeticError("range");
    return value;
  };
  const nested = (parse: () => number) => {
    if (++depth > 128) throw new ArithmeticError("limit");
    try {
      return parse();
    } finally {
      depth--;
    }
  };
  function primary(): number {
    if (peek() === "number") return tokens[position++].value!;
    if (take("(")) {
      const value = nested(sum);
      if (!take(")")) throw new ArithmeticError("syntax");
      return value;
    }
    throw new ArithmeticError("syntax");
  }
  function postfix(): number {
    let value = primary();
    while (peek() === "!" || peek() === "%") {
      if (take("%")) value /= 100;
      else {
        position++;
        if (!Number.isInteger(value) || value < 0)
          throw new ArithmeticError("domain");
        if (value > 170) throw new ArithmeticError("range");
        let factorial = 1;
        for (let i = 2; i <= value; i++) factorial *= i;
        value = factorial;
      }
    }
    return value;
  }
  function power(): number {
    const value = postfix();
    return take("^") ? finite(Math.pow(value, nested(unary))) : value;
  }
  function unary(): number {
    if (take("+")) return nested(unary);
    if (take("-")) return -nested(unary);
    if (take("√")) return finite(Math.sqrt(nested(unary)));
    return power();
  }
  function product(): number {
    let value = unary();
    while (peek() === "*" || peek() === "/") {
      const operator = tokens[position++].kind;
      const right = unary();
      if (operator === "/" && right === 0)
        throw new ArithmeticError("division");
      value = finite(operator === "*" ? value * right : value / right);
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (peek() === "+" || peek() === "-") {
      const operator = tokens[position++].kind;
      const right = product();
      value = finite(operator === "+" ? value + right : value - right);
    }
    return value;
  }
  const value = finite(sum());
  if (position !== tokens.length) throw new ArithmeticError("syntax");
  return Object.is(value, -0) ? 0 : value;
}

export function formatArithmetic(value: number): string {
  return String(Number(value.toPrecision(12)));
}
