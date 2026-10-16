/** Supported JSONPath subset. Filters are parsed as data, never evaluated as code. */
function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === "$") {
      tokens.push("$");
      i++;
      continue;
    }
    if (ch === ".") {
      if (expr[i + 1] === ".") {
        tokens.push("..");
        i += 2;
        // 递归下降后可直接跟属性名或通配符：..name / ..*
        if (expr[i] === "*") {
          tokens.push("*");
          i++;
        } else if (/[A-Za-z0-9_]/.test(expr[i] || "")) {
          let j = i;
          while (j < expr.length && /[A-Za-z0-9_\-]/.test(expr[j])) j++;
          tokens.push(expr.slice(i, j));
          i = j;
        }
        continue;
      }
      if (expr[i + 1] === "*") {
        tokens.push("*");
        i += 2;
        continue;
      }
      let j = i + 1;
      while (j < expr.length && /[A-Za-z0-9_\-]/.test(expr[j])) j++;
      if (j === i + 1) throw new Error(`表达式第 ${i + 1} 位缺少属性名`);
      tokens.push(expr.slice(i + 1, j));
      i = j;
      continue;
    }
    if (ch === "[") {
      let depth = 0;
      let j = i;
      while (j < expr.length) {
        if (expr[j] === "[") depth++;
        if (expr[j] === "]") {
          depth--;
          if (depth === 0) break;
        }
        j++;
      }
      if (depth !== 0) throw new Error("中括号未闭合");
      tokens.push(expr.slice(i, j + 1));
      i = j + 1;
      continue;
    }
    throw new Error(`无法识别的字符：${ch}（位置 ${i + 1}）`);
  }
  return tokens;
}

function evalFilter(cond: string, node: unknown): boolean {
  const m = cond.match(
    /^@(?:\.([A-Za-z0-9_]+)|\[['"]([A-Za-z0-9_]+)['"]\])?\s*(==|!=|<=|>=|<|>)?\s*(.+)?$/,
  );
  if (!m) throw new Error("Unsupported JSONPath filter");
  const [, key1, key2, op, raw] = m;
  if (!op && !raw)
    return key1 || key2
      ? Boolean((node as Record<string, unknown>)?.[key1 || key2])
      : node !== null && node !== undefined;
  const val =
    key1 || key2 ? (node as Record<string, unknown>)?.[key1 || key2] : node;
  if (val === undefined) return false;
  if (!op) return Boolean(val);
  let target: unknown = raw.trim();
  if (/^-?\d+(\.\d+)?$/.test(target as string)) target = Number(target);
  else if ((target as string) === "true") target = true;
  else if ((target as string) === "false") target = false;
  else if ((target as string) === "null") target = null;
  else if (/^(?:"[^"]*"|'[^']*')$/.test(String(target)))
    target = String(target).slice(1, -1);
  else
    throw new Error(
      "Filter values must be numbers, booleans, null or quoted strings",
    );
  switch (op) {
    case "==":
      return val === target;
    case "!=":
      return val !== target;
    case "<":
      return (val as number) < (target as number);
    case ">":
      return (val as number) > (target as number);
    case "<=":
      return (val as number) <= (target as number);
    case ">=":
      return (val as number) >= (target as number);
  }
  return false;
}

export function query(json: unknown, expr: string): unknown[] {
  if (!expr.startsWith("$")) throw new Error("JSONPath must start with $");
  const tokens = tokenize(expr);
  for (const token of tokens) {
    if (token.startsWith("[?(")) {
      if (!token.endsWith(")]")) throw new Error("Invalid JSONPath filter");
      const condition = token.slice(3, -2).trim();
      if (
        !/^@(?:\.[A-Za-z0-9_]+|\[['"][A-Za-z0-9_]+['"]\])?(?:\s*(?:==|!=|<=|>=|<|>)\s*(?:-?\d+(?:\.\d+)?|true|false|null|"[^"]*"|'[^']*'))?$/.test(
          condition,
        )
      )
        throw new Error("Unsupported JSONPath filter");
    } else if (
      token.startsWith("[") &&
      !/^\[(?:\*|\d+|'[^']*'|"[^"]*")\]$/.test(token)
    )
      throw new Error("Unsupported JSONPath bracket syntax");
  }
  const results: unknown[] = [];
  function walk(node: unknown, idx: number, isRecursive: boolean): void {
    if (idx >= tokens.length) {
      results.push(node);
      return;
    }
    const token = tokens[idx];
    if (token === "$") {
      walk(node, idx + 1, false);
      return;
    }
    if (token === "..") {
      walk(node, idx + 1, true);
      return;
    }
    if (isRecursive) {
      // 先尝试在当前节点用剩余路径匹配
      walk(node, idx, false);
      // 再深入每个子节点继续匹配（路径段保持不变）
      if (node !== null && typeof node === "object") {
        const entries = Array.isArray(node) ? node : Object.values(node);
        for (const child of entries) walk(child, idx, true);
      }
      return;
    }
    if (token === "*") {
      if (node !== null && typeof node === "object") {
        const entries = Array.isArray(node) ? node : Object.values(node);
        for (const child of entries) walk(child, idx + 1, false);
      }
      return;
    }
    if (token.startsWith("[")) {
      const inner = token.slice(1, -1).trim();
      if (inner === "*") {
        if (node !== null && typeof node === "object") {
          const entries = Array.isArray(node) ? node : Object.values(node);
          for (const child of entries) walk(child, idx + 1, false);
        }
        return;
      }
      if (inner.startsWith("?(")) {
        const cond = inner.slice(2, -1);
        if (Array.isArray(node)) {
          for (const child of node)
            if (evalFilter(cond, child)) walk(child, idx + 1, false);
        }
        return;
      }
      if (/^\d+$/.test(inner)) {
        if (Array.isArray(node) && node[Number(inner)] !== undefined)
          walk(node[Number(inner)], idx + 1, false);
        return;
      }
      if (/^['"].*['"]$/.test(inner)) {
        const key = inner.slice(1, -1);
        if (
          node !== null &&
          typeof node === "object" &&
          Object.hasOwn(node, key)
        )
          walk((node as Record<string, unknown>)[key], idx + 1, false);
        return;
      }
      throw new Error(`暂不支持的中括号语法：${inner}`);
    }
    if (
      node !== null &&
      typeof node === "object" &&
      (node as Record<string, unknown>)[token] !== undefined
    ) {
      walk((node as Record<string, unknown>)[token], idx + 1, false);
    }
  }
  walk(json, 0, false);
  return results;
}
