import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  generateSql,
  parseJson,
  exactNumber,
  quoteIdentifier,
  stringLiteral,
  bytes,
} from "../../src/lib/json-to-sql.ts";
const good = (input, options = {}) => {
  const r = generateSql(input, options);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.value;
};
const bad = (input, code, options = {}) => {
  const r = generateSql(input, options);
  assert.equal(r.ok, false);
  assert.equal(r.error.code, code, JSON.stringify(r));
  assert.equal("value" in r, false);
  return r.error;
};
const model = (input, options = {}) => {
  const r = analyze(input, options);
  assert.equal(r.ok, true, JSON.stringify(r));
  return r.value;
};

test("single-object-and-column-order", () => {
  assert.equal(
    good('{"id":1}').sql,
    '-- SQL\nINSERT INTO "records" ("id") VALUES\n  (1);',
  );
  const r = good('[{"b":2,"a":1},{"c":3,"a":4}]');
  assert.deepEqual(
    r.analysis.columns.map((c) => c.name),
    ["b", "a", "c"],
  );
  assert.equal(
    r.sql,
    '-- SQL\nINSERT INTO "records" ("b", "a", "c") VALUES\n  (2, 1, NULL),\n  (NULL, 4, 3);',
  );
  assert.equal(r.rows, 2);
  assert.equal(r.columns, 3);
  assert.equal(r.bytes, bytes(r.sql));
});
test("insert-batches-preserve-record-order", () => {
  const r = good(
    JSON.stringify(Array.from({ length: 201 }, (_, i) => ({ id: i }))),
    { batchSize: 100 },
  );
  assert.equal(r.statements, 3);
  assert.equal((r.sql.match(/INSERT INTO/g) || []).length, 3);
  const groups = r.sql
    .slice(7)
    .split(";")
    .filter((s) => s.trim());
  assert.deepEqual(
    groups.map((s) => (s.match(/^  \(/gm) || []).length),
    [100, 100, 1],
  );
  assert.deepEqual(
    [...r.sql.matchAll(/^  \((\d+)\)/gm)].map((m) => +m[1]),
    Array.from({ length: 201 }, (_, i) => i),
  );
  assert.equal((r.sql.match(/\("id"\) VALUES/g) || []).length, 3);
});
test("missing-and-null-insert", () => {
  const r = good('[{"id":1,"n":null},{"id":2},{"id":3,"n":"A"}]');
  assert.match(r.sql, /\(1, NULL\),\n  \(2, NULL\),\n  \(3, E'A'\)/);
  assert.equal(r.analysis.columns[1].missing, 1);
  assert.equal(r.analysis.columns[1].nulls, 1);
});
test("update-missing-skips-null-clears", () => {
  const r = good(
    '[{"id":1,"name":"A","active":true},{"id":2,"active":false},{"id":3,"name":null}]',
    { mode: "update", primaryKey: "id" },
  );
  assert.equal(
    r.sql,
    '-- SQL\nUPDATE "records" SET "name" = E\'A\', "active" = TRUE WHERE "id" = 1;\n\nUPDATE "records" SET "active" = FALSE WHERE "id" = 2;\n\nUPDATE "records" SET "name" = NULL WHERE "id" = 3;',
  );
  assert.equal(r.statements, 3);
  assert.equal((r.sql.match(/ WHERE "id" = /g) || []).length, 3);
  assert.doesNotMatch(r.sql, /SET "id"/);
});
test("update-primary-key-validation", () => {
  assert.match(
    good('{"id":"2024-02-29","n":1}', {
      mode: "update",
      primaryKey: "id",
      dates: true,
    }).sql,
    /WHERE "id" = E'2024-02-29';/,
  );
  assert.match(
    good('{"id":"2024-02-29"}', {
      mode: "create",
      dialect: "mysql",
      primaryKey: "id",
      dates: true,
    }).sql,
    /`id` VARCHAR\(255\) NOT NULL/,
  );
  assert.match(good('{"n":1}', { primaryKey: "removed" }).sql, /INSERT INTO/);
  bad('{"id":1,"n":2}', "PRIMARY_REQUIRED", { mode: "update" });
  for (const [data, code] of [
    ['[{"id":1,"n":2},{"n":3}]', "PRIMARY_MISSING"],
    ['{"id":null,"n":2}', "PRIMARY_NULL"],
    ['[{"id":1,"n":2},{"id":1e0,"n":3}]', "PRIMARY_DUPLICATE"],
    ['{"id":true,"n":2}', "PRIMARY_TYPE"],
    ['{"id":1.2,"n":2}', "PRIMARY_TYPE"],
    ['{"id":1}', "NO_UPDATE_FIELDS"],
  ])
    bad(data, code, { mode: "update", primaryKey: "id" });
  assert.equal(
    good('[{"id":"A","n":1},{"id":"a","n":2},{"id":" A","n":3}]', {
      mode: "update",
      primaryKey: "id",
    }).statements,
    3,
  );
  bad(
    '[{"id":9007199254740993,"n":1},{"id":900719925474099300e-2,"n":2}]',
    "PRIMARY_DUPLICATE",
    { mode: "update", primaryKey: "id" },
  );
});
test("identifier-quoting", () => {
  assert.equal(quoteIdentifier("select", "postgresql"), '"select"');
  assert.equal(quoteIdentifier("a b", "sqlite"), '"a b"');
  assert.equal(quoteIdentifier('a"b', "postgresql"), '"a""b"');
  assert.equal(quoteIdentifier("a`b", "mysql"), "`a``b`");
  assert.match(
    good('{"x":1}', { table: "schema.table" }).sql,
    /INTO "schema.table"/,
  );
  for (const name of ["", " x", "x\n", "中".repeat(22)]) {
    const e = bad('{"x":1}', "TABLE_NAME", { table: name });
    assert.equal(e.field, "jtsTable");
    assert.equal(e.line, undefined);
  }
  bad('{"a":1,"A":2}', "COLUMN_COLLISION");
  bad('{" x":1}', "IDENTIFIER");
});
test("string-literals-by-dialect", () => {
  const value = "'\"\\\r\n\t中文한국어日本語😀";
  assert.equal(
    stringLiteral(value, "postgresql"),
    "E'''\"\\\\\\r\\n\\t中文한국어日本語😀'",
  );
  assert.equal(
    stringLiteral(value, "sqlite"),
    "'''\"\\\r\n\t中文한국어日本語😀'",
  );
  assert.equal(stringLiteral("O'Reilly", "mysql"), "'O''Reilly'");
  for (const dialect of ["postgresql", "mysql", "sqlite"]) {
    const r = good(JSON.stringify({ s: value }), { dialect });
    assert.ok(r.sql.includes(stringLiteral(value, dialect)));
    bad('{"s":"\\u0000"}', "UNICODE", { dialect });
    bad('{"s":"\\ud800"}', "UNICODE", { dialect });
  }
});
test("mysql-backslash-independent-expression", () => {
  assert.equal(
    stringLiteral("C:\\tmp\n\t中", "mysql"),
    "CONVERT(X'433A5C746D700A09E4B8AD' USING utf8mb4)",
  );
  assert.equal(stringLiteral("中文", "mysql"), "'中文'");
});
test("exact-number-tokens", () => {
  const r = good('{"n":9007199254740993,"x":1e3,"z":-0.0e10}');
  assert.match(r.sql, /\(9007199254740993, 1000, 0\)/);
  assert.equal(exactNumber("1.2300e-2").text, "0.0123");
  assert.equal(exactNumber("-1e-3").text, "-0.001");
  assert.equal(exactNumber("100e-2").text, "1");
});
test("decimal-precision-and-sqlite-range", () => {
  const c = model('[{"x":12.34},{"x":0.0001},{"x":100}]').columns[0];
  assert.equal(c.sqlType, "NUMERIC(7,4)");
  assert.equal(c.precision, 7);
  assert.equal(c.scale, 4);
  assert.match(
    good('{"n":9223372036854775808}', { mode: "create", dialect: "mysql" }).sql,
    /DECIMAL\(19,0\)/,
  );
  bad('{"n":9223372036854775808}', "SQLITE_INTEGER", { dialect: "sqlite" });
  assert.equal(
    good('{"n":-9223372036854775808}', { dialect: "sqlite" }).analysis
      .columns[0].sqlType,
    "INTEGER",
  );
  for (const number of [
    "1e999999999",
    "0.0000000000000000001",
    "1" + "0".repeat(38),
  ])
    bad('{"x":' + number + "}", "NUMBER_RANGE");
  assert.ok(
    model('{"x":1.2}', { dialect: "sqlite" }).columns[0].warnings.includes(
      "SQLITE_REAL",
    ),
  );
  bad(
    '[{"x":99999999999999999999999999999999999999},{"x":0.1}]',
    "NUMBER_RANGE",
  );
});
test("ddl-all-rows-nullability", () => {
  const r = good('[{"id":"a","x":null,"y":1},{"id":"b","x":null,"z":2}]', {
    mode: "create",
    dialect: "mysql",
    primaryKey: "id",
  });
  assert.equal(
    r.sql,
    "-- SQL\nCREATE TABLE `records` (\n  `id` VARCHAR(255) NOT NULL,\n  `x` LONGTEXT,\n  `y` BIGINT,\n  `z` BIGINT,\n  PRIMARY KEY (`id`)\n) DEFAULT CHARACTER SET utf8mb4;",
  );
  assert.ok(r.analysis.columns[1].warnings.includes("UNKNOWN_TYPE"));
  bad('[{"id":1},{"id":1}]', "PRIMARY_DUPLICATE", {
    mode: "create",
    primaryKey: "id",
  });
  bad(JSON.stringify({ id: "😀".repeat(256) }), "PRIMARY_LENGTH", {
    mode: "create",
    primaryKey: "id",
    dialect: "mysql",
  });
  assert.match(
    good(JSON.stringify({ id: "😀".repeat(255) }), {
      mode: "create",
      primaryKey: "id",
      dialect: "mysql",
    }).sql,
    /VARCHAR\(255\) NOT NULL/,
  );
  assert.equal(good('{"id":1}', { includeCreate: true }).statements, 2);
  assert.equal(
    good('{"id":1,"n":2}', {
      mode: "update",
      primaryKey: "id",
      includeCreate: true,
    }).statements,
    1,
  );
});
test("nested-json-flatten-reject", () => {
  const data =
    '[{"id":1,"p":{"city":"A"},"arr":[1,2]},{"id":2,"p":null},{"id":3}]';
  assert.match(good(data).sql, /E'\{"city":"A"\}'/);
  const flat = good(data, { nested: "flatten" });
  assert.deepEqual(
    flat.analysis.columns.map((c) => c.name),
    ["id", "p.city", "arr"],
  );
  assert.equal(flat.analysis.columns[1].missing, 1);
  assert.equal(flat.analysis.columns[1].nulls, 1);
  assert.match(flat.sql, /"p.city"/);
  assert.doesNotMatch(flat.sql, /"arr\.0"/);
  bad(data, "NO_UPDATE_FIELDS", {
    nested: "flatten",
    mode: "update",
    primaryKey: "id",
  });
});
test("flatten-null-update-semantics", () => {
  assert.deepEqual(
    model('{"b":null,"a":1}', { nested: "flatten" }).columns.map((c) => c.name),
    ["b", "a"],
  );
  const r = good(
    '[{"id":1,"p":{"city":"A"},"n":1},{"id":2,"p":null},{"id":3,"n":2}]',
    { nested: "flatten", mode: "update", primaryKey: "id" },
  );
  assert.match(r.sql, /SET "p.city" = NULL WHERE "id" = 2/);
  assert.match(r.sql, /SET "n" = 2 WHERE "id" = 3/);
  const e = bad('{"p":{"x":1}}', "NESTED", { nested: "reject" });
  assert.equal(e.path, "/p");
});
test("flatten-collision-and-shape", () => {
  for (const [data, code] of [
    ['{"profile.city":"B","profile":{"city":"A"}}', "COLUMN_COLLISION"],
    ['[{"p":1},{"p":{"x":2}}]', "PATH_SHAPE"],
    ['{"p":{}}', "EMPTY_OBJECT"],
  ]) {
    const e = bad(data, code, { nested: "flatten" });
    assert.ok(e.offset >= 0);
    assert.ok(e.line >= 1);
  }
  assert.equal(
    model('{"a/b":{"~":1}}', { nested: "flatten" }).columns[0].path,
    "/a~1b/~0",
  );
});
test("mixed-types-policy", () => {
  assert.equal(
    bad('[{"x":1},{"x":1.2},{"x":true}]', "TYPE_CONFLICT").path,
    "/2/x",
  );
  assert.equal(
    bad('[{"x":"2024-01-01"},{"x":"other"},{"x":true}]', "TYPE_CONFLICT", {
      dates: true,
    }).path,
    "/2/x",
  );
  const data =
    '[{"x":"a"},{"x":9007199254740993},{"x":true},{"x":null},{"x":{"a":1}}]';
  bad(data, "TYPE_CONFLICT");
  const r = good(data, { mixed: "text" });
  assert.match(r.sql, /E'9007199254740993'/);
  assert.match(r.sql, /E'true'/);
  assert.match(r.sql, /\(NULL\)/);
  assert.match(r.sql, /E'\{"a":1\}'/);
  assert.equal(r.analysis.columns[0].type, "text");
});
test("duplicate-keys-and-prototype-names", () => {
  const e = bad('{"a":1,"\\u0061":2}', "DUPLICATE_KEY");
  assert.equal(e.offset, 7);
  assert.equal(e.first.offset, 1);
  assert.equal(e.path, "/a");
  const r = good('{"__proto__":1,"constructor":2,"prototype":3}');
  assert.equal(r.columns, 3);
  assert.equal({}.polluted, undefined);
});
test("syntax-source-locations", () => {
  const text = '[\r\n {"中文":"😀",}\r\n]';
  const e = bad(text, "SYNTAX");
  assert.equal(e.offset, text.indexOf("}"));
  assert.equal(e.line, 2);
  assert.equal(e.column, 13);
  assert.equal(text.slice(e.offset, e.endOffset), "}");
  for (const sep of ["\r", "\n", "\r\n"]) {
    const value = "{" + sep + '"a":1,' + sep + "}";
    const x = bad(value, "SYNTAX");
    assert.equal(x.line, 3);
    assert.equal(x.column, 1);
    assert.equal(x.offset, value.length - 1);
  }
  for (const data of [
    '{"x":01}',
    '{"x":NaN}',
    "{'x':1}",
    "/*x*/{}",
    '{"x":Infinity}',
    "[1]",
    "[null]",
    "[[1]]",
    "true",
    "null",
  ])
    bad(
      data,
      data === "[1]" || data === "[null]" || data === "[[1]]"
        ? "ROW_TYPE"
        : data === "true" || data === "null"
          ? "ROOT_TYPE"
          : "SYNTAX",
    );
  bad("[]", "EMPTY_ARRAY");
  bad("{}", "NO_COLUMNS");
  bad("[{},{}]", "NO_COLUMNS");
  bad(" ", "EMPTY_INPUT");
});
test("date-policy-is-timezone-independent", () => {
  const input = '{"d":"2024-02-29","t":"2024-03-01T00:00:00.1Z"}';
  assert.equal(model(input).columns[0].type, "text");
  assert.ok(model(input).columns[0].warnings.includes("DATE_HINT"));
  for (const dialect of ["postgresql", "mysql", "sqlite"]) {
    const original = process.env.TZ;
    const outputs = [];
    for (const tz of ["UTC", "Asia/Tokyo", "America/New_York"]) {
      process.env.TZ = tz;
      outputs.push(good(input, { dates: true, dialect }));
    }
    if (original === undefined) delete process.env.TZ;
    else process.env.TZ = original;
    assert.equal(outputs[0].sql, outputs[1].sql);
    assert.equal(outputs[1].sql, outputs[2].sql);
    assert.ok(
      outputs[0].sql.includes(
        dialect === "mysql"
          ? "2024-03-01 00:00:00.100"
          : "2024-03-01T00:00:00.100Z",
      ),
    );
  }
  bad('{"d":"2023-02-29"}', "DATE_INVALID", { dates: true });
  bad('{"d":"0999-01-01"}', "DATE_INVALID", { dates: true });
  bad('{"t":"2024-01-01T00:00:60Z"}', "DATE_INVALID", { dates: true });
  for (const s of ["2024-01-01T00:00:00+09:00", "2024-01-01T00:00:00"])
    assert.equal(
      model(JSON.stringify({ s }), { dates: true }).columns[0].type,
      "text",
    );
  assert.ok(
    model('[{"d":"2024-01-01"},{"d":"other"}]', {
      dates: true,
    }).columns[0].warnings.includes("DATE_MIXED"),
  );
});
test("resource-limits", () => {
  bad('{"s":"' + "a".repeat(1048576) + '"}', "INPUT_LIMIT");
  bad("[".repeat(34) + "0" + "]".repeat(34), "DEPTH_LIMIT");
  bad('{"n":' + "1".repeat(257) + "}", "NUMBER_LENGTH");
  bad(
    JSON.stringify(Array.from({ length: 5001 }, () => ({ id: 1 }))),
    "ROW_LIMIT",
  );
  bad(
    JSON.stringify(
      Object.fromEntries(Array.from({ length: 201 }, (_, i) => ["c" + i, 1])),
    ),
    "COLUMN_LIMIT",
  );
  bad(
    JSON.stringify(
      Array.from({ length: 501 }, () =>
        Object.fromEntries(Array.from({ length: 200 }, (_, i) => ["c" + i, 1])),
      ),
    ),
    "CELL_LIMIT",
  );
  const nodeLimit = parseJson(
    "[" + Array.from({ length: 200001 }, () => 0).join(",") + "]",
  );
  assert.equal(nodeLimit.error.code, "NODE_LIMIT");
  const wide = Object.fromEntries(
    Array.from({ length: 200 }, (_, i) => [
      String(i).padStart(3, "0") + '"'.repeat(60),
      1,
    ]),
  );
  const data = JSON.stringify([
    wide,
    ...Array.from({ length: 499 }, () => ({})),
  ]);
  bad(data, "OUTPUT_LIMIT", { batchSize: 1 });
  for (const n of [0, 1001, 1.5]) {
    const e = bad('{"x":1}', "BATCH_SIZE", { batchSize: n });
    assert.equal(e.field, "jtsBatch");
    assert.equal(e.offset, undefined);
  }
});
test("deterministic-output", () => {
  for (const dialect of ["postgresql", "mysql", "sqlite"])
    for (const mode of ["insert", "update", "create"]) {
      const opts = { dialect, mode, primaryKey: "id" };
      const first = good(
        '[{"id":1,"name":"A","active":true},{"id":2,"name":null,"active":false}]',
        opts,
      );
      assert.deepEqual(
        good(
          '[{"id":1,"name":"A","active":true},{"id":2,"name":null,"active":false}]',
          opts,
        ),
        first,
      );
      assert.equal(
        first.sql.split(";").filter((s) => s.trim()).length,
        first.statements,
      );
    }
});
import "./json-to-sql-presentation.test.mjs";
import "./json-to-sql-i18n.test.mjs";
