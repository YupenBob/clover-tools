import test from "node:test";
import assert from "node:assert/strict";
import {
  beadMaterialsCsv,
  gridSize,
  makeBeadPattern,
  parseBeadPalette,
} from "../../src/lib/bead-pattern.ts";
import {
  QUESTION_RULES,
  PERSONALITY_AXES,
  scorePersonality,
} from "../../src/lib/personality.ts";
import { avatarRandom, createAvatar } from "../../src/lib/avatar.ts";
import { funText } from "../../src/lib/fun-tool-i18n.ts";

const rgba = (...pixels) => Uint8ClampedArray.from(pixels.flat());
const opaque = (r, g, b) => [r, g, b, 255];
const avatar = {
  seed: "Clover",
  style: "orbit",
  accent: "#E6AD62",
  background: "#F6EDDD",
  shape: "round",
  transparent: false,
};

test("bead grids preserve aspect ratio, with a minimum one-cell short side", () => {
  assert.deepEqual(gridSize(200, 100, 32), [32, 16]);
  assert.deepEqual(gridSize(100, 200, 96), [48, 96]);
  assert.deepEqual(gridSize(10000, 1, 32), [32, 1]);
});
test("bead grids reject non-finite dimensions and unsupported grid sizes", () => {
  for (const values of [
    [0, 1, 32],
    [1, NaN, 32],
    [Infinity, 1, 32],
    [1, 1, 97],
    [1, 1, 15.5],
  ])
    assert.throws(() => gridSize(...values), RangeError);
});
test("small exact bead palettes preserve color assignment and material totals", () => {
  const chart = makeBeadPattern(
    rgba(
      opaque(255, 0, 0),
      opaque(0, 0, 255),
      opaque(255, 0, 0),
      opaque(0, 255, 0),
    ),
    2,
    2,
    4,
  );
  assert.equal(chart.total, 4);
  assert.equal(chart.palette.length, 3);
  assert.equal(
    chart.palette.reduce((n, p) => n + p.count, 0),
    4,
  );
  assert.equal(chart.palette[chart.cells[0]].hex, "#FF0000");
  assert.equal(chart.palette[chart.cells[1]].hex, "#0000FF");
  assert.equal(chart.cells[0], chart.cells[2]);
});
test("bead transparency uses the specified alpha threshold and white compositing", () => {
  const chart = makeBeadPattern(
    rgba([0, 0, 0, 0], [255, 0, 0, 127], [255, 0, 0, 128], opaque(0, 0, 0)),
    4,
    1,
    4,
  );
  assert.equal(chart.total, 2);
  assert.deepEqual([...chart.cells.slice(0, 2)], [-1, -1]);
  assert.equal(chart.palette[chart.cells[2]].hex, "#FF7F7F");
});
test("a fully transparent bead image produces an empty chart without invented colors", () => {
  const chart = makeBeadPattern(new Uint8Array(4 * 4), 2, 2, 8);
  assert.equal(chart.total, 0);
  assert.deepEqual(chart.palette, []);
  assert.deepEqual([...chart.cells], [-1, -1, -1, -1]);
});
test("bead color reduction stays within the limit and counts every occupied cell once", () => {
  const pixels = Array.from({ length: 256 }, (_, i) =>
    opaque(i, 255 - i, (i * 7) % 256),
  );
  const chart = makeBeadPattern(rgba(...pixels), 16, 16, 5);
  assert.ok(chart.palette.length <= 5 && chart.palette.length > 1);
  assert.equal(chart.total, 256);
  chart.palette.forEach((color, index) =>
    assert.equal(
      color.count,
      [...chart.cells].filter((cell) => cell === index).length,
    ),
  );
  assert.deepEqual(makeBeadPattern(rgba(...pixels), 16, 16, 5), chart);
});
test("custom bead palettes omit unused colors and remap grid codes consistently", () => {
  const chart = makeBeadPattern(
    rgba(opaque(255, 0, 0), opaque(255, 0, 0)),
    2,
    1,
    2,
    ["#000000", "#FF0000", "#FFFFFF"],
  );
  assert.deepEqual(chart.palette, [{ hex: "#FF0000", count: 2 }]);
  assert.deepEqual([...chart.cells], [0, 0]);
});
test("bead palettes normalize valid HEX colors and reject incomplete or executable input", () => {
  assert.deepEqual(parseBeadPalette("ff0000， #aAbBcC; FF0000"), [
    "#FF0000",
    "#AABBCC",
  ]);
  for (const value of [
    "",
    "#fff, #000000",
    "#FFFFFF,#FFFFFF",
    "#12345G #000000",
    "#000000;url(x)",
    Array(33).fill("#FFFFFF").join(","),
  ])
    assert.throws(() => parseBeadPalette(value), RangeError);
});
test("bead data validates shape, dimensions, channel values and palette limits", () => {
  for (const action of [
    () => makeBeadPattern([0, 0, 0], 1, 1),
    () => makeBeadPattern([0, 0, 0, 256], 1, 1),
    () => makeBeadPattern([0, NaN, 0, 255], 1, 1),
    () => makeBeadPattern(new Uint8Array(97 * 4), 97, 1),
    () => makeBeadPattern(rgba(opaque(0, 0, 0)), 1, 1, 1),
  ])
    assert.throws(action, RangeError);
});
test("bead materials CSV follows the same numbered palette and excludes empty cells", () => {
  const chart = makeBeadPattern(rgba(opaque(255, 0, 0), [0, 0, 0, 0]), 2, 1, 2);
  assert.equal(beadMaterialsCsv(chart), "code,hex,beads\r\n01,#FF0000,1\r\n");
});
test("preference dimensions contain six prompts with three of each direction", () => {
  assert.equal(QUESTION_RULES.length, 24);
  for (const axis of PERSONALITY_AXES) {
    const rules = QUESTION_RULES.filter((rule) => rule.axis === axis);
    assert.equal(rules.length, 6);
    assert.equal(rules.filter((rule) => rule.sign === 1).length, 3);
  }
});
test("neutral preference answers remain valid and produce explicit ties", () => {
  const result = scorePersonality(Array(24).fill(0));
  assert.equal(result.code, "XXXX");
  assert.ok(
    result.axes.every(
      (axis) => axis.score === 0 && axis.left === 50 && axis.right === 50,
    ),
  );
});
test("reverse preference prompts score in the opposite direction", () => {
  const left = scorePersonality(QUESTION_RULES.map((rule) => 2 * rule.sign));
  const right = scorePersonality(QUESTION_RULES.map((rule) => -2 * rule.sign));
  assert.equal(left.code, "ESTJ");
  assert.equal(right.code, "INFP");
  assert.ok(left.axes.every((axis) => axis.left === 100 && axis.right === 0));
  assert.ok(right.axes.every((axis) => axis.left === 0 && axis.right === 100));
  assert.equal(scorePersonality(Array(24).fill(2)).code, "XXXX");
});
test("editing one preference answer changes only its dimension and complements to 100", () => {
  const answers = QUESTION_RULES.map((rule) => 2 * rule.sign);
  const before = scorePersonality(answers);
  answers[0] = -2;
  const after = scorePersonality(answers);
  assert.equal(after.axes[0].left, 83);
  assert.equal(after.axes[0].right, 17);
  assert.deepEqual(after.axes.slice(1), before.axes.slice(1));
  assert.deepEqual(
    answers,
    QUESTION_RULES.map((rule, i) => (i === 0 ? -2 : 2 * rule.sign)),
  );
});
test("preference reports reject unfinished, malformed and out-of-range responses", () => {
  for (const answers of [
    Array(24),
    Array(23).fill(0),
    Array(25).fill(0),
    [null, ...Array(23).fill(0)],
    [undefined, ...Array(23).fill(0)],
    [3, ...Array(23).fill(0)],
    [0.5, ...Array(23).fill(0)],
    [NaN, ...Array(23).fill(0)],
  ])
    assert.throws(() => scorePersonality(answers), RangeError);
});
test("every language supplies all original prompts and their response options", () => {
  for (const lang of ["zh", "tw", "en", "ko", "ja"]) {
    const copy = funText(lang);
    assert.equal(copy.quiz.questions.length, QUESTION_RULES.length);
    assert.equal(new Set(copy.quiz.questions).size, 24);
    assert.equal(copy.quiz.choices.length, 5);
    assert.ok(
      copy.quiz.questions.every(
        (question) =>
          typeof question === "string" && question.trim().length > 5,
      ),
    );
    assert.equal(copy.quiz.axes.length, 4);
    assert.equal(copy.quiz.descriptions.length, 4);
  }
});
test("avatar seeds produce deterministic bounded random sequences", () => {
  const a = avatarRandom("Clover"),
    b = avatarRandom("Clover"),
    c = avatarRandom("Other");
  const sequence = Array.from({ length: 100 }, a);
  assert.deepEqual(sequence, Array.from({ length: 100 }, b));
  assert.ok(
    sequence.every(
      (value) => Number.isFinite(value) && value >= 0 && value < 1,
    ),
  );
  assert.notDeepEqual(sequence, Array.from({ length: 100 }, c));
});
test("all original avatar styles reproduce the same seed and change with another seed", () => {
  for (const style of ["orbit", "pixel", "tile"]) {
    const svg = createAvatar({ ...avatar, style });
    assert.equal(svg, createAvatar({ ...avatar, style }));
    assert.notEqual(
      svg,
      createAvatar({ ...avatar, style, seed: "Other seed" }),
    );
    assert.ok(svg.length > 600 && svg.length < 40_000);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  }
});
test("avatar NFC normalization reproduces composed and decomposed Unicode names", () => {
  assert.equal(
    createAvatar({ ...avatar, seed: "caf\u00e9" }),
    createAvatar({ ...avatar, seed: "cafe\u0301" }),
  );
  assert.notEqual(
    createAvatar({ ...avatar, seed: "𐐷" }),
    createAvatar({ ...avatar, seed: "𐐸" }),
  );
});
test("robot ears stay symmetric and inside the frame for different head sizes", () => {
  for (const seed of ["Clover", "small", "wide", "你好", "orbit-42"]) {
    const svg = createAvatar({ ...avatar, seed });
    const ears = svg.match(/<path d="M([\d.]+) 153v36M([\d.]+) 153v36"/);
    assert.ok(ears, "both ear positions must use absolute coordinates");
    const left = Number(ears[1]),
      right = Number(ears[2]);
    assert.equal(left + right, 320);
    assert.ok(left > 0 && right < 320);
  }
});
test("avatar SVG hashes user text instead of inserting markup or attributes", () => {
  const seed = '</svg><script>alert(1)</script><img onerror="x">';
  const svg = createAvatar({ ...avatar, seed });
  assert.ok(!svg.includes(seed));
  assert.doesNotMatch(svg, /script|onerror|alert|<img|javascript:/);
});
test("avatar validation excludes invalid colors, styles, frames and seed lengths", () => {
  for (const changes of [
    { seed: "" },
    { seed: "   " },
    { seed: "a".repeat(81) },
    { accent: "red" },
    { background: "#fff" },
    { accent: '#FFFFFF" onload="x' },
    { style: "external" },
    { shape: "triangle" },
  ])
    assert.throws(() => createAvatar({ ...avatar, ...changes }), RangeError);
});
test("transparent avatars remove only the background and retain a clipped frame", () => {
  const solid = createAvatar(avatar),
    transparent = createAvatar({ ...avatar, transparent: true });
  assert.match(solid, /fill="#F6EDDD"/);
  assert.doesNotMatch(transparent, /fill="#F6EDDD"/);
  assert.match(transparent, /clipPath id="frame"/);
  assert.match(transparent, /fill="#E6AD62"/);
  assert.equal(
    (solid.match(/<rect width="320" height="320"/g) || []).length,
    2,
  );
  assert.equal(
    (transparent.match(/<rect width="320" height="320"/g) || []).length,
    1,
  );
});
