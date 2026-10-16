import test from "node:test";
import assert from "node:assert/strict";
import {
  randomBelow,
  generateRandomIntegers,
} from "../../src/lib/random-integers.ts";

test("rejects the incomplete modulo tail before sampling", () => {
  const values = [0xffffffff, 14];
  assert.equal(
    randomBelow(10, () => values.shift()),
    4,
  );
  assert.equal(values.length, 0);
});
test("bounded unique sampling handles singleton and full ranges", () => {
  assert.deepEqual(generateRandomIntegers(8, 8, 1, true), [8]);
  assert.deepEqual(
    generateRandomIntegers(-4, 4, 9, true),
    [-4, -3, -2, -1, 0, 1, 2, 3, 4],
  );
  const values = generateRandomIntegers(0, 0xffffffff, 1000, true);
  assert.equal(new Set(values).size, 1000);
  assert(values.every((value) => value >= 0 && value <= 0xffffffff));
});
test("rejects unsafe bounds, excessive range, fractions and excessive counts", () => {
  for (const args of [
    [0, 0x100000000, 1, true],
    [0, 10, 1001, false],
    [0, 2, 3.5, false],
    [NaN, 2, 1, false],
    [0, 2, 4, true],
    [Number.MAX_SAFE_INTEGER + 1, Number.MAX_SAFE_INTEGER + 2, 1, false],
  ]) {
    assert.throws(() => generateRandomIntegers(...args), RangeError);
  }
});
