#!/usr/bin/env node
/**
 * Deterministically keep README tool counts in sync with the registry.
 *
 *   node scripts/tool-pipeline/update-tool-counts.mjs --check
 *   node scripts/tool-pipeline/update-tool-counts.mjs --write
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const readmePath = join(root, 'README.md');
const { getAllTools, TOOLS } = await import(new URL('../../src/lib/tools.ts', import.meta.url));

const total = getAllTools().length;
const dev = TOOLS.dev.length;
const daily = TOOLS.daily.length;
const fun = TOOLS.fun.length;
const original = readFileSync(readmePath, 'utf8');

let text = original;
const replacements = [
  [/\btools-\d+-gold\b/g, `tools-${total}-gold`],
  [/\balt="\d+ tools"/g, `alt="${total} tools"`],
  [/\b\d+ 个逐一手写/g, `${total} 个逐一手写`],
  [/\b\d+ 个手写工具/g, `${total} 个手写工具`],
  [/\b\d+ 个手写工具页/g, `${total} 个手写工具页`],
  [/\b\d+ 份工具深度说明/g, `${total} 份工具深度说明`],
  [
    /\| 工具总数 \| \d+（开发实用 \d+ · 日常实用 \d+ · 趣味工具 \d+） \|/g,
    `| 工具总数 | ${total}（开发实用 ${dev} · 日常实用 ${daily} · 趣味工具 ${fun}） |`,
  ],
];

for (const [pattern, value] of replacements) {
  text = text.replace(pattern, value);
}

const changed = text !== original;
if (process.argv.includes('--check')) {
  if (changed) {
    console.error(`README 工具计数已过期：registry=${total}（${dev}/${daily}/${fun}）`);
    const before = original.split('\n');
    const after = text.split('\n');
    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      if (before[index] !== after[index]) {
        console.error(`  L${index + 1}\n    - ${before[index] ?? ''}\n    + ${after[index] ?? ''}`);
      }
    }
    process.exit(1);
  }
  console.log(`README 工具计数一致：${total}（${dev}/${daily}/${fun}）`);
  process.exit(0);
}

if (process.argv.includes('--write')) {
  if (changed) {
    writeFileSync(readmePath, text);
    console.log(`README 工具计数已更新：${total}（${dev}/${daily}/${fun}）`);
  } else {
    console.log(`README 工具计数无需更新：${total}（${dev}/${daily}/${fun}）`);
  }
  process.exit(0);
}

console.log(JSON.stringify({ total, dev, daily, fun, changed }, null, 2));
