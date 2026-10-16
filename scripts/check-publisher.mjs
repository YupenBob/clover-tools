/** Site-side review safeguards; this cannot predict an AdSense approval decision. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { root, buildAdsEnabled } from "./lib/build-config.mjs";
import { walk, relativePath, isVerificationFile } from "./lib/artifacts.mjs";
import {
  isErrorPath,
  stripLanguage,
  languageFromPath,
} from "../config/routes.mjs";
import { getAllTools } from "../src/lib/tools.ts";

const dist = join(root, "dist");
const serving = buildAdsEnabled();
const client = "ca-pub-2739960879713370";
const totalTools = getAllTools().length;
let count = 0,
  detailed = 0;
for (const file of walk(dist).filter(
  (file) =>
    file.endsWith(".html") && !isVerificationFile(relativePath(dist, file)),
)) {
  const path = "/" + relativePath(dist, file).replace(/index\.html$/, "");
  const text = readFileSync(file, "utf8");
  assert(
    text.includes(`name="google-adsense-account" content="${client}"`),
    `${path}: ownership meta missing`,
  );
  const blocked =
    isErrorPath(path) ||
    /^\/(privacy|terms|contact|about)(\/|$)/.test(stripLanguage(path));
  if (!serving || blocked) {
    assert(
      !/\bsrc="[^"]*adsbygoogle\.js/.test(text),
      `${path}: unexpected ad script`,
    );
    assert(
      !/<ins\b[^>]*class="adsbygoogle"/.test(text),
      `${path}: unexpected ad unit`,
    );
  }
  if (
    ["zh", "tw"].includes(languageFromPath(path)) &&
    /<article[^>]*data-tool=/.test(text)
  ) {
    assert(
      text.includes('<section class="tool-guide"'),
      `${path}: full guide missing`,
    );
    assert(
      (text.match(/class="example-card"/g) || []).length >= 2,
      `${path}: examples missing`,
    );
    detailed++;
  }
  if (/\/privacy\/$/.test(path)) {
    assert(
      text.includes("https://policies.google.com/technologies/partner-sites"),
      `${path}: Google disclosure link missing`,
    );
  }
  if (path === "/")
    assert(
      new RegExp(`id="builtCount"[^>]*>${totalTools}<\\/span>`).test(text),
      "home tool count must be server rendered",
    );
  count++;
}
assert.equal(
  detailed,
  totalTools * 2,
  "all tools must have simplified and traditional Chinese guides",
);
assert(
  readFileSync(join(dist, "ads.txt"), "utf8").includes("pub-2739960879713370"),
  "ads.txt account mismatch",
);
console.log(
  `发布商检查通过：${count} 页面；${detailed} 简繁中文工具说明页；广告投放 ${serving ? "开启" : "关闭"}，站点验证保留`,
);
