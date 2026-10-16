/** Neighbouring tasks; prevents every page linking to the same first six tools. */
export const RELATED_TOOL_GROUPS = [
  [
    "json-formatter",
    "json-convert",
    "json-codegen",
    "json-xml-yaml",
    "jsonpath",
    "diff",
  ],
  [
    "html-formatter",
    "css-formatter",
    "js-formatter",
    "sql-formatter",
    "xml-formatter",
    "markdown",
    "diff",
  ],
  [
    "base64",
    "url-encode",
    "unicode-converter",
    "base-converter",
    "image-to-base64",
    "url-parse",
  ],
  [
    "text-transform",
    "text-toolbox",
    "jianfan",
    "pinyin",
    "regex-tester",
    "markdown",
  ],
  [
    "hash",
    "symmetric-encrypt",
    "rsa-encrypt",
    "bcrypt",
    "jwt-decoder",
    "password-strength",
    "password-generator",
    "uuid-generator",
  ],
  ["http-tester", "ip-lookup", "ua-parser", "url-parse", "url-encode"],
  ["qrcode", "color-convert", "image-to-base64", "css-formatter"],
  [
    "calendar",
    "lunar-converter",
    "world-clock",
    "date-diff",
    "timestamp",
    "workday",
    "age-calculator",
    "expiry",
    "zodiac",
  ],
  [
    "salary",
    "finance",
    "calculator",
    "unit-converter",
    "rmb-uppercase",
    "fuel",
    "bmi",
  ],
  ["timer", "world-clock", "date-diff"],
  ["keyboard-test", "grid-splitter", "sensitive-check"],
  [
    "focus-flight",
    "click-speed",
    "reaction-test",
    "schulte-trainer",
    "ball-tracker",
    "fps-aim-trainer",
  ],
  [
    "perler-beads",
    "avatar-generator",
    "ascii-art",
    "meme-generator",
    "nickname-text",
    "palette-generator",
    "image-filter",
  ],
  ["lottery", "random-number", "morse", "browser-info", "personality-test"],
] as const;

export function relatedScore(slug: string, candidate: string): number {
  return RELATED_TOOL_GROUPS.filter(
    (group) =>
      (group as readonly string[]).includes(slug) &&
      (group as readonly string[]).includes(candidate),
  ).length;
}
