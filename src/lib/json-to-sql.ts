import {
  parseJson,
  bytes,
  compactJson,
  invalidUnicode,
  pointer,
} from "./json-to-sql-parser.ts";
import type {
  JsonNode,
  Result,
  SourceRange,
  SqlError,
} from "./json-to-sql-parser.ts";
export { parseJson, bytes } from "./json-to-sql-parser.ts";
export type { Result, SqlError, JsonNode } from "./json-to-sql-parser.ts";
export type Dialect = "postgresql" | "mysql" | "sqlite";
export type Mode = "insert" | "update" | "create";
export interface Options {
  dialect: Dialect;
  mode: Mode;
  table: string;
  batchSize: number;
  nested: "json" | "flatten" | "reject";
  mixed: "error" | "text";
  dates: boolean;
  primaryKey: string;
  includeCreate: boolean;
}
export const DEFAULT_OPTIONS: Options = {
  dialect: "postgresql",
  mode: "insert",
  table: "records",
  batchSize: 100,
  nested: "json",
  mixed: "error",
  dates: false,
  primaryKey: "",
  includeCreate: false,
};
export type DataType =
  "integer" | "decimal" | "boolean" | "text" | "json" | "date" | "timestamp";
export interface Column {
  name: string;
  path: string;
  parts: string[];
  type: DataType;
  sqlType: string;
  missing: number;
  nulls: number;
  nullable: boolean;
  precision: number;
  scale: number;
  asText: boolean;
  warnings: string[];
  source: SourceRange;
}
export interface Cell {
  node?: JsonNode;
  missing: boolean;
}
export interface Row {
  source: SourceRange;
  cells: Cell[];
}
export interface Analysis {
  columns: Column[];
  rows: Row[];
  warnings: string[];
  options: Options;
}
export interface Output {
  sql: string;
  statements: number;
  rows: number;
  columns: number;
  bytes: number;
  analysis: Analysis;
}
const err = (
  code: string,
  source?: SourceRange,
  params?: SqlError["params"],
): never => {
  throw { code, ...(source ?? {}), ...(params ? { params } : {}) };
};
const setting = (code: string, field: string): never => {
  throw { code, field };
};
const guard = <T>(fn: () => T): Result<T> => {
  try {
    return { ok: true, value: fn() };
  } catch (error) {
    return { ok: false, error: error as SqlError };
  }
};
export interface ExactNumber {
  text: string;
  integer: boolean;
  integerDigits: number;
  scale: number;
  int64: boolean;
}
export function exactNumber(raw: string, source?: SourceRange): ExactNumber {
  if (raw.length > 256) err("NUMBER_LENGTH", source);
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(raw);
  if (!m) return err("SYNTAX", source);
  let digits = m[2] + (m[3] ?? ""),
    position = m[2].length;
  // Zero has no exponent expansion cost, and is always canonical 0.
  if (!/[1-9]/.test(digits))
    return {
      text: "0",
      integer: true,
      integerDigits: 1,
      scale: 0,
      int64: true,
    };
  const exp = BigInt(m[4] ?? "0");
  if (exp > 256n || exp < -256n) err("NUMBER_RANGE", source);
  position += Number(exp);
  let text =
    position <= 0
      ? "0." + "0".repeat(-position) + digits
      : position >= digits.length
        ? digits + "0".repeat(position - digits.length)
        : digits.slice(0, position) + "." + digits.slice(position);
  text = text
    .replace(/^0+(?=\d)/, "")
    .replace(/(\.\d*?)0+$/, "$1")
    .replace(/\.$/, "");
  const [whole, fraction = ""] = text.split("."),
    integerDigits = whole === "0" ? 0 : whole.length,
    scale = fraction.length;
  if (Math.max(1, integerDigits + scale) > 38 || scale > 18)
    err("NUMBER_RANGE", source);
  if (m[1]) text = "-" + text;
  const integer = scale === 0,
    int64 =
      integer &&
      BigInt(text) >= -9223372036854775808n &&
      BigInt(text) <= 9223372036854775807n;
  return { text, integer, integerDigits, scale, int64 };
}
function identifierError(name: string): boolean {
  return (
    !name ||
    name.trim() !== name ||
    /[\x00-\x1f\x7f-\x9f]/u.test(name) ||
    invalidUnicode(name) ||
    bytes(name) > 63
  );
}
export function quoteIdentifier(name: string, dialect: Dialect): string {
  if (identifierError(name)) return err("IDENTIFIER");
  const q = dialect === "mysql" ? "`" : '"';
  return q + name.replaceAll(q, q + q) + q;
}
export function stringLiteral(
  text: string,
  dialect: Dialect,
  source?: SourceRange,
): string {
  if (invalidUnicode(text)) err("UNICODE", source);
  if (dialect === "mysql" && /[\\\x00-\x1f\x7f-\x9f]/u.test(text))
    return (
      "CONVERT(X'" +
      Array.from(new TextEncoder().encode(text), (b) =>
        b.toString(16).padStart(2, "0"),
      )
        .join("")
        .toUpperCase() +
      "' USING utf8mb4)"
    );
  if (dialect === "postgresql")
    return (
      "E'" +
      text
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "''")
        .replace(
          /[\x01-\x1f\x7f-\x9f]/g,
          (c) =>
            ({
              "\n": "\\n",
              "\r": "\\r",
              "\t": "\\t",
              "\b": "\\b",
              "\f": "\\f",
            })[c] ?? "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"),
        ) +
      "'"
    );
  return "'" + text.replaceAll("'", "''") + "'";
}
function dateValue(
  text: string,
  source: SourceRange,
  enabled: boolean,
): { type: "date" | "timestamp"; text: string } | undefined {
  const m =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z)?$/.exec(
      text,
    );
  if (!m) return;
  const y = +m[1],
    month = +m[2],
    day = +m[3],
    leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0),
    days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    y < 1000 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    (m[4] !== undefined && (+m[4] > 23 || +m[5] > 59 || +m[6] > 59))
  ) {
    if (enabled) err("DATE_INVALID", source);
    return;
  }
  return {
    type: m[4] === undefined ? "date" : "timestamp",
    text:
      m[4] === undefined
        ? text
        : text.slice(0, 19) + "." + (m[7] ?? "").padEnd(3, "0") + "Z",
  };
}
function typeOf(node: JsonNode, options: Options): DataType | "null" {
  if (node.kind === "number")
    return exactNumber(node.value as string, node).integer
      ? "integer"
      : "decimal";
  if (node.kind === "object" || node.kind === "array") return "json";
  if (node.kind === "string")
    return options.dates
      ? (dateValue(node.value as string, node, true)?.type ?? "text")
      : "text";
  return node.kind;
}
export function sqlType(c: Column, o: Options, primary = false): string {
  if (
    primary &&
    o.dialect === "mysql" &&
    ["text", "date", "timestamp"].includes(c.type)
  )
    return "VARCHAR(255)";
  if (c.type === "integer")
    return o.dialect === "sqlite" ? "INTEGER" : "BIGINT";
  if (c.type === "decimal")
    return o.dialect === "sqlite"
      ? "REAL"
      : `${o.dialect === "mysql" ? "DECIMAL" : "NUMERIC"}(${c.precision},${c.scale})`;
  if (c.type === "boolean")
    return o.dialect === "sqlite" ? "INTEGER" : "BOOLEAN";
  if (c.type === "date") return o.dialect === "sqlite" ? "TEXT" : "DATE";
  if (c.type === "timestamp")
    return o.dialect === "sqlite"
      ? "TEXT"
      : o.dialect === "mysql"
        ? "DATETIME(3)"
        : "TIMESTAMP(3) WITH TIME ZONE";
  return o.dialect === "mysql" ? "LONGTEXT" : "TEXT";
}
export function analyzeJson(
  root: JsonNode,
  partial: Partial<Options> = {},
): Result<Analysis> {
  return guard(() => {
    const options = { ...DEFAULT_OPTIONS, ...partial },
      records =
        root.kind === "object"
          ? [root]
          : root.kind === "array"
            ? root.items!
            : err("ROOT_TYPE", root);
    if (!records.length) err("EMPTY_ARRAY", root);
    if (records.length > 5000) err("ROW_LIMIT", records[5000]);
    const columns: Column[] = [],
      byName = new Map<string, number>(),
      shapes = new Map<string, { kind: string; source: SourceRange }>();
    const rowMaps: Map<string, JsonNode>[] = [];
    // Discover path shapes before emitting columns, so null-only fields retain
    // their first occurrence order and null parents can inherit all descendants.
    if (options.nested === "flatten")
      for (const record of records) {
        if (record.kind !== "object") err("ROW_TYPE", record);
        const scan = (node: JsonNode, parts: string[]) => {
          const id = JSON.stringify(parts),
            kind =
              node.kind === "null"
                ? ""
                : node.kind === "object"
                  ? "object"
                  : "scalar",
            old = shapes.get(id);
          if (kind && old && kind !== old.kind)
            err("PATH_SHAPE", node, {
              firstPath: old.source.path,
              secondPath: node.path,
            });
          if (kind && !old) shapes.set(id, { kind, source: node });
          if (node.kind === "object") {
            if (!node.entries!.length) err("EMPTY_OBJECT", node);
            for (const e of node.entries!) scan(e.node, [...parts, e.key]);
          }
        };
        for (const e of record.entries!) scan(e.node, [e.key]);
      }
    const add = (
      parts: string[],
      node: JsonNode,
      source: SourceRange,
      map: Map<string, JsonNode>,
    ) => {
      const name = parts.join("."),
        identity = JSON.stringify(parts),
        fold = name.replace(/[A-Z]/g, (c) => c.toLowerCase());
      if (identifierError(name)) err("IDENTIFIER", source);
      const oldIndex = byName.get(fold);
      if (oldIndex !== undefined) {
        const old = columns[oldIndex];
        if (old.name !== name || JSON.stringify(old.parts) !== identity)
          err("COLUMN_COLLISION", source, {
            firstPath: old.path,
            secondPath: pointer(parts),
          });
      } else {
        if (columns.length >= 200) err("COLUMN_LIMIT", source);
        byName.set(fold, columns.length);
        columns.push({
          name,
          parts,
          path: pointer(parts),
          type: "text",
          sqlType: "",
          missing: 0,
          nulls: 0,
          nullable: false,
          precision: 1,
          scale: 0,
          asText: false,
          warnings: [],
          source,
        });
      }
      map.set(identity, node);
    };
    for (const record of records) {
      if (record.kind !== "object") err("ROW_TYPE", record);
      const map = new Map<string, JsonNode>();
      rowMaps.push(map);
      const visit = (node: JsonNode, parts: string[], source: SourceRange) => {
        const container = node.kind === "object" || node.kind === "array";
        if (options.nested === "reject" && container) err("NESTED", node);
        if (options.nested === "flatten") {
          const shape =
              node.kind === "null"
                ? ""
                : node.kind === "object"
                  ? "object"
                  : "scalar",
            id = JSON.stringify(parts),
            old = shapes.get(id);
          if (shape && old && old.kind !== shape)
            err("PATH_SHAPE", node, {
              firstPath: old.source.path,
              secondPath: node.path,
            });
          if (shape) shapes.set(id, { kind: shape, source: node });
          if (node.kind === "object") {
            if (!node.entries!.length) err("EMPTY_OBJECT", node);
            for (const e of node.entries!)
              visit(e.node, [...parts, e.key], e.source);
            return;
          }
        }
        // Null parents become cells for known descendants after the union is complete.
        if (
          options.nested === "flatten" &&
          node.kind === "null" &&
          shapes.get(JSON.stringify(parts))?.kind === "object"
        ) {
          map.set(JSON.stringify(parts), node);
          return;
        }
        add(parts, node, source, map);
      };
      for (const entry of record.entries!)
        visit(entry.node, [entry.key], entry.source);
    }
    if (!columns.length) err("NO_COLUMNS", records[0]);
    if (records.length * columns.length > 100000) err("CELL_LIMIT", root);
    const rows: Row[] = records.map((record, rowIndex) => ({
      source: record,
      cells: columns.map((c) => {
        const map = rowMaps[rowIndex];
        let node = map.get(JSON.stringify(c.parts));
        if (!node && options.nested === "flatten")
          for (let i = c.parts.length - 1; i > 0; i--) {
            const parent = map.get(JSON.stringify(c.parts.slice(0, i)));
            if (parent?.kind === "null") {
              node = parent;
              break;
            }
          }
        return { node, missing: !node };
      }),
    }));
    columns.forEach((c, ci) => {
      const types = new Set<DataType>();
      let maxInt = 0,
        maxScale = 0,
        over64 = false,
        dateHint = false;
      for (const row of rows) {
        const cell = row.cells[ci],
          node = cell.node;
        if (!node) {
          c.missing++;
          continue;
        }
        if (node.kind === "null") {
          c.nulls++;
          continue;
        }
        types.add(typeOf(node, options) as DataType);
        if (node.kind === "number") {
          const n = exactNumber(node.value as string, node);
          maxInt = Math.max(maxInt, n.integerDigits);
          maxScale = Math.max(maxScale, n.scale);
          if (n.integer && !n.int64) {
            over64 = true;
            if (options.dialect === "sqlite") err("SQLITE_INTEGER", node);
          }
        }
        if (
          node.kind === "string" &&
          !options.dates &&
          dateValue(node.value as string, node, false)
        )
          dateHint = true;
      }
      if (types.has("integer") && types.has("decimal")) types.delete("integer");
      const stringTypes: DataType[] = ["date", "timestamp", "text"];
      const mergeStrings =
        [...types].filter((t) => stringTypes.includes(t)).length > 1;
      if (mergeStrings) {
        for (const t of stringTypes) types.delete(t);
        types.add("text");
        c.warnings.push("DATE_MIXED");
      }
      if (types.size > 1) {
        if (options.mixed !== "text") {
          const normalized = (node: JsonNode) => {
            const type = typeOf(node, options) as DataType;
            return type === "integer" && types.has("decimal")
              ? "decimal"
              : mergeStrings && stringTypes.includes(type)
                ? "text"
                : type;
          };
          const supplied = rows
            .map((r) => r.cells[ci].node)
            .filter((node): node is JsonNode => !!node && node.kind !== "null");
          const firstType = normalized(supplied[0]);
          const node = supplied.find((node) => normalized(node) !== firstType)!;
          err("TYPE_CONFLICT", node, { column: c.name });
        }
        c.asText = true;
        c.type = "text";
        c.warnings.push("MIXED_TEXT");
      } else c.type = [...types][0] ?? "text";
      if (!types.size) c.warnings.push("UNKNOWN_TYPE");
      if (dateHint) c.warnings.push("DATE_HINT");
      if (over64 && c.type === "integer") c.type = "decimal";
      c.precision = Math.max(1, maxInt + maxScale);
      c.scale = maxScale;
      if (!c.asText && c.type === "decimal" && c.precision > 38)
        err("NUMBER_RANGE", c.source);
      if (options.dialect === "sqlite" && c.type === "decimal")
        c.warnings.push("SQLITE_REAL");
      if (options.dialect === "mysql" && c.type === "timestamp")
        c.warnings.push("UTC_DATETIME");
      c.nullable = c.missing + c.nulls > 0;
      c.sqlType = sqlType(
        c,
        options,
        c.name === options.primaryKey &&
          (options.mode === "create" ||
            (options.mode === "insert" && options.includeCreate)),
      );
    });
    return {
      columns,
      rows,
      options,
      warnings: [...new Set(columns.flatMap((c) => c.warnings))],
    };
  });
}
export function analyze(
  text: string,
  options: Partial<Options> = {},
): Result<Analysis> {
  const parsed = parseJson(text);
  return parsed.ok ? analyzeJson(parsed.value, options) : parsed;
}
function validatePrimary(model: Analysis, required: boolean): number {
  const { options: o, rows, columns } = model;
  if (!o.primaryKey)
    return required ? setting("PRIMARY_REQUIRED", "jtsPrimaryKey") : -1;
  const ci = columns.findIndex((c) => c.name === o.primaryKey);
  if (ci < 0) return setting("PRIMARY_REQUIRED", "jtsPrimaryKey");
  const c = columns[ci];
  if (c.asText) err("PRIMARY_TYPE", c.source);
  const values = new Set<string>();
  let keyKind = "";
  for (const row of rows) {
    const node = row.cells[ci].node;
    if (!node) err("PRIMARY_MISSING", row.source);
    if (node!.kind === "null") err("PRIMARY_NULL", node);
    if (node!.kind !== "string" && node!.kind !== "number")
      err("PRIMARY_TYPE", node);
    if (keyKind && keyKind !== node!.kind) err("PRIMARY_TYPE", node);
    keyKind = node!.kind;
    let value = node!.value as string;
    if (node!.kind === "number") {
      const n = exactNumber(value, node);
      if (!n.integer) err("PRIMARY_TYPE", node);
      value = n.text;
    }
    if (
      o.dialect === "mysql" &&
      (o.mode === "create" || (o.mode === "insert" && o.includeCreate)) &&
      node!.kind === "string" &&
      [...value].length > 255
    )
      err("PRIMARY_LENGTH", node);
    if (values.has(value)) err("PRIMARY_DUPLICATE", node);
    values.add(value);
  }
  return ci;
}
function literal(cell: Cell, c: Column, o: Options): string {
  const n = cell.node;
  if (!n || n.kind === "null") return "NULL";
  if (c.asText)
    return stringLiteral(
      n.kind === "string"
        ? (n.value as string)
        : n.kind === "number"
          ? exactNumber(n.value as string, n).text
          : compactJson(n),
      o.dialect,
      n,
    );
  if (n.kind === "number") return exactNumber(n.value as string, n).text;
  if (n.kind === "boolean")
    return o.dialect === "postgresql"
      ? n.value
        ? "TRUE"
        : "FALSE"
      : n.value
        ? "1"
        : "0";
  let text = n.kind === "string" ? (n.value as string) : compactJson(n);
  if (c.type === "date" || c.type === "timestamp") {
    text = dateValue(text, n, true)!.text;
    if (o.dialect === "mysql" && c.type === "timestamp")
      text = text.replace("T", " ").slice(0, -1);
  }
  return stringLiteral(text, o.dialect, n);
}
export function generateModel(model: Analysis): Result<Output> {
  return guard(() => {
    const { options: o, rows, columns } = model;
    if (identifierError(o.table)) setting("TABLE_NAME", "jtsTable");
    if (
      o.mode === "insert" &&
      (!Number.isInteger(o.batchSize) || o.batchSize < 1 || o.batchSize > 1000)
    )
      setting("BATCH_SIZE", "jtsBatch");
    const pk =
        o.mode !== "insert" || o.includeCreate
          ? validatePrimary(model, o.mode === "update")
          : -1,
      q = (s: string) => quoteIdentifier(s, o.dialect),
      table = q(o.table);
    const statements: string[] = [];
    let length = bytes("-- SQL\n");
    const append = (s: string) => {
      length += bytes(s) + (statements.length ? 2 : 0);
      if (length > 8388608) err("OUTPUT_LIMIT", rows[0].source);
      statements.push(s);
    };
    if (o.mode === "create" || (o.mode === "insert" && o.includeCreate))
      append(
        `CREATE TABLE ${table} (\n${columns
          .map(
            (c, i) =>
              `  ${q(c.name)} ${sqlType(c, o, i === pk)}${!c.nullable || i === pk ? " NOT NULL" : ""}`,
          )
          .concat(pk < 0 ? [] : [`  PRIMARY KEY (${q(columns[pk].name)})`])
          .join(
            ",\n",
          )}\n)${o.dialect === "mysql" ? " DEFAULT CHARACTER SET utf8mb4" : ""};`,
      );
    if (o.mode === "insert") {
      const header = `INSERT INTO ${table} (${columns.map((c) => q(c.name)).join(", ")}) VALUES\n`;
      for (let i = 0; i < rows.length; i += o.batchSize)
        append(
          header +
            rows
              .slice(i, i + o.batchSize)
              .map(
                (row) =>
                  "  (" +
                  row.cells
                    .map((v, ci) => literal(v, columns[ci], o))
                    .join(", ") +
                  ")",
              )
              .join(",\n") +
            ";",
        );
    } else if (o.mode === "update")
      for (const row of rows) {
        const set = columns.flatMap((c, ci) =>
          ci === pk || row.cells[ci].missing
            ? []
            : [`${q(c.name)} = ${literal(row.cells[ci], c, o)}`],
        );
        if (!set.length) err("NO_UPDATE_FIELDS", row.source);
        append(
          `UPDATE ${table} SET ${set.join(", ")} WHERE ${q(columns[pk].name)} = ${literal(row.cells[pk], columns[pk], o)};`,
        );
      }
    const sql = "-- SQL\n" + statements.join("\n\n");
    if (bytes(sql) > 8388608) err("OUTPUT_LIMIT", rows[0].source);
    return {
      sql,
      statements: statements.length,
      rows: rows.length,
      columns: columns.length,
      bytes: bytes(sql),
      analysis: model,
    };
  });
}
export function generateSql(
  text: string,
  options: Partial<Options> = {},
): Result<Output> {
  const model = analyze(text, options);
  return model.ok ? generateModel(model.value) : model;
}
