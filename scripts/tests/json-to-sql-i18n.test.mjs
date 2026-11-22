import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEV_TOOL_SEO } from "../../src/lib/tool-seo/dev.ts";
import { jsonToSqlCopy } from "../../src/lib/json-to-sql-i18n.ts";
const keys = (value) =>
  Object.entries(value)
    .flatMap(([k, v]) =>
      typeof v === "string" ? [k] : keys(v).map((p) => k + "." + p),
    )
    .sort();
const flatten = (value) =>
  Object.values(value).flatMap((v) =>
    typeof v === "string" ? [v] : flatten(v),
  );
test("json-to-sql five dictionaries have identical complete keys", () => {
  const zh = jsonToSqlCopy("zh");
  for (const lang of ["zh", "tw", "en", "ko", "ja"]) {
    const d = jsonToSqlCopy(lang);
    assert.deepEqual(keys(d), keys(zh));
    assert.ok(flatten(d).every((v) => v.trim().length > 0));
  }
  const contract = JSON.parse(
    readFileSync(
      new URL("../../data/tool-presentation/json-to-sql.json", import.meta.url),
    ),
  );
  for (const key of contract.i18n.requiredKeys)
    assert.equal(typeof zh[key], "string");
  for (const lang of ["en", "ko", "ja"]) {
    const joined = flatten(jsonToSqlCopy(lang)).join(" ");
    assert.doesNotMatch(
      joined,
      /字段|对象|数据|字符串|下载|生成 SQL|主键|样本/,
    );
  }
  const tw = jsonToSqlCopy("tw");
  assert.equal(tw.generate, "產生 SQL");
  assert.equal(tw.primaryKey, "比對主鍵");
  assert.equal(tw.flatten, "展開物件");
  assert.equal(tw.missing, "缺少欄位");
  assert.equal(tw.download, "下載 SQL");
});
test("json-to-sql localized metadata and deep content", () => {
  const seo = DEV_TOOL_SEO["json-to-sql"];
  assert.ok(seo.title.endsWith(" - CloverTools"));
  assert.ok([...seo.title].length >= 50 && [...seo.title].length <= 60);
  assert.ok(
    [...seo.description].length >= 150 && [...seo.description].length <= 160,
  );
  for (const lang of ["en", "ko", "ja"]) {
    const d = JSON.parse(
      readFileSync(new URL(`../../src/lib/i18n/${lang}.json`, import.meta.url)),
    );
    const tool = d.tools["json-to-sql"],
      content = d.content["json-to-sql"];
    for (const k of ["name", "oneLiner", "description"])
      assert.ok(tool[k].length > 10);
    assert.ok(tool.keywords.length >= 4);
    assert.ok(content.features.length >= 3);
    assert.ok(content.detail.steps.length >= 3);
    assert.ok(content.detail.examples.length >= 2);
    assert.ok(content.detail.faqs.length >= 4);
    assert.doesNotMatch(
      JSON.stringify(content),
      /字段|对象数组|数据不会|主键|下载|生成 SQL/,
    );
    assert.equal(
      content.detail.examples[0].output,
      '-- SQL\nINSERT INTO "records" ("id", "active") VALUES\n  (1, TRUE);',
    );
  }
});
