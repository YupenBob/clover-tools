import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../../src/lib/jsonpath.ts";
test("extracts nested properties and simple comparisons", () => {
  const value = {
    items: [
      { price: 5, name: "A" },
      { price: 15, name: "B" },
    ],
  };
  assert.deepEqual(query(value, "$.items[?(@.price < 10)].name"), ["A"]);
  assert.deepEqual(query(value, "$..name"), ["A", "B"]);
  assert.deepEqual(query(value, "$.items[0].price"), [5]);
  assert.deepEqual(query(value, "$['missing']"), []);
});
test("rejects unsupported filters even when the target array is empty", () => {
  for (const path of [
    "$[?(@.a && @.b)]",
    "$[?(@.price == nope)]",
    "$[0:2]",
    "items[0]",
  ])
    assert.throws(() => query([], path));
});
