/** Bounded, lossless JSON parser. Offsets and columns use UTF-16 units. */
export interface SourceRange {
  offset: number;
  endOffset: number;
  line: number;
  column: number;
  path: string;
}
export interface SqlError extends Partial<SourceRange> {
  code: string;
  field?: string;
  params?: Record<string, string | number>;
  first?: SourceRange;
}
export type Result<T> = { ok: true; value: T } | { ok: false; error: SqlError };
export interface JsonNode extends SourceRange {
  kind: "object" | "array" | "string" | "number" | "boolean" | "null";
  value?: string | boolean;
  entries?: { key: string; source: SourceRange; node: JsonNode }[];
  items?: JsonNode[];
}
export const bytes = (s: string): number => new TextEncoder().encode(s).length;
export const pointer = (parts: string[]): string =>
  parts.length
    ? "/" +
      parts.map((p) => p.replaceAll("~", "~0").replaceAll("/", "~1")).join("/")
    : "";
export function sourceRange(
  text: string,
  offset: number,
  endOffset = offset + 1,
  path = "",
): SourceRange {
  let line = 1,
    column = 1;
  for (let i = 0; i < offset; i++) {
    if (text[i] === "\r") {
      if (text[i + 1] === "\n" && i + 1 < offset) i++;
      line++;
      column = 1;
    } else if (text[i] === "\n") {
      line++;
      column = 1;
    } else column++;
  }
  return {
    offset,
    endOffset: Math.min(text.length, endOffset),
    line,
    column,
    path,
  };
}
export function invalidUnicode(s: string): boolean {
  return /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(
    s,
  );
}
export function parseJson(text: string): Result<JsonNode> {
  let i = 0,
    nodes = 0;
  // Compute locations in O(log n) per node, including large multi-line samples.
  const starts = [0];
  for (let j = 0; j < text.length; j++) {
    if (text[j] === "\r") {
      if (text[j + 1] === "\n") j++;
      starts.push(j + 1);
    } else if (text[j] === "\n") starts.push(j + 1);
  }
  const range = (start: number, end: number, path: string): SourceRange => {
    let l = 0,
      r = starts.length;
    while (l + 1 < r) {
      const m = (l + r) >> 1;
      if (starts[m] <= start) l = m;
      else r = m;
    }
    return {
      offset: start,
      endOffset: Math.min(text.length, end),
      line: l + 1,
      column: start - starts[l] + 1,
      path,
    };
  };
  const fail = (
    code: string,
    path: string,
    start = i,
    end = start + 1,
    extra = {},
  ): never => {
    throw { code, ...range(start, end, path), ...extra };
  };
  const ws = () => {
    while (/[\x20\t\r\n]/.test(text[i] ?? "\uFFFF")) i++;
  };
  const string = (path: string): string => {
    const start = i++;
    let escaped = false;
    while (i < text.length) {
      const c = text[i++];
      if (!escaped && c === '"') {
        let s: string;
        try {
          s = JSON.parse(text.slice(start, i));
        } catch {
          return fail("SYNTAX", path, start, i);
        }
        if (invalidUnicode(s)) fail("UNICODE", path, start, i);
        return s;
      }
      if (!escaped && c.charCodeAt(0) < 32) fail("SYNTAX", path, i - 1);
      if (escaped) {
        if (!'"\\/bfnrtu'.includes(c)) fail("SYNTAX", path, i - 1);
        if (c === "u") {
          if (!/^[0-9a-fA-F]{4}$/.test(text.slice(i, i + 4)))
            fail("SYNTAX", path, i, i + 4);
          i += 4;
        }
        escaped = false;
      } else escaped = c === "\\";
    }
    return fail("SYNTAX", path, i);
  };
  const read = (parts: string[], depth: number): JsonNode => {
    ws();
    const start = i,
      path = pointer(parts);
    if (++nodes > 200000) fail("NODE_LIMIT", path);
    if (depth > 32) fail("DEPTH_LIMIT", path);
    const c = text[i];
    let node: Partial<JsonNode>;
    if (c === "{") {
      i++;
      ws();
      const entries: NonNullable<JsonNode["entries"]> = [],
        keys = new Map<string, SourceRange>();
      if (text[i] !== "}")
        while (true) {
          ws();
          if (text[i] !== '"') fail("SYNTAX", path);
          const k = i,
            key = string(path),
            kp = pointer([...parts, key]),
            source = range(k, i, kp);
          if (keys.has(key))
            fail("DUPLICATE_KEY", kp, k, i, { first: keys.get(key) });
          keys.set(key, source);
          ws();
          if (text[i++] !== ":") fail("SYNTAX", kp, i - 1);
          entries.push({ key, source, node: read([...parts, key], depth + 1) });
          ws();
          if (text[i] === "}") break;
          if (text[i++] !== ",") fail("SYNTAX", path, i - 1);
        }
      i++;
      node = { kind: "object", entries };
    } else if (c === "[") {
      i++;
      ws();
      const items: JsonNode[] = [];
      if (text[i] !== "]")
        while (true) {
          items.push(read([...parts, String(items.length)], depth + 1));
          ws();
          if (text[i] === "]") break;
          if (text[i++] !== ",") fail("SYNTAX", path, i - 1);
        }
      i++;
      node = { kind: "array", items };
    } else if (c === '"') node = { kind: "string", value: string(path) };
    else if (c === "-" || /[0-9]/.test(c ?? "")) {
      const token = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
        text.slice(i),
      )?.[0];
      if (!token) fail("SYNTAX", path);
      const raw = token!;
      if (raw.length > 256) fail("NUMBER_LENGTH", path, i, i + raw.length);
      i += raw.length;
      node = { kind: "number", value: raw };
    } else {
      const word = ["true", "false", "null"].find((w) => text.startsWith(w, i));
      if (!word) fail("SYNTAX", path);
      i += word!.length;
      node =
        word === "null"
          ? { kind: "null" }
          : { kind: "boolean", value: word === "true" };
    }
    return { ...node, ...range(start, i, path) } as JsonNode;
  };
  try {
    if (bytes(text) > 1048576) fail("INPUT_LIMIT", "", 0, text.length);
    if (!text.trim()) fail("EMPTY_INPUT", "", 0, 0);
    const node = read([], 0);
    ws();
    if (i !== text.length) fail("SYNTAX", "", i);
    return { ok: true, value: node };
  } catch (error) {
    return { ok: false, error: error as SqlError };
  }
}
export function compactJson(node: JsonNode): string {
  if (node.kind === "object")
    return (
      "{" +
      node
        .entries!.map((e) => JSON.stringify(e.key) + ":" + compactJson(e.node))
        .join(",") +
      "}"
    );
  if (node.kind === "array")
    return "[" + node.items!.map(compactJson).join(",") + "]";
  if (node.kind === "number") return node.value as string;
  if (node.kind === "null") return "null";
  return JSON.stringify(node.value);
}
