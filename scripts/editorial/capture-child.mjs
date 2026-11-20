/**
 * 截图用例的**隔离执行体**：在受限环境（独立 PID/mount namespace + Node permission 模型 + 环境变量白名单）里
 * 加载并执行 `scripts/editorial/cases/<slug>.mjs`，把截图写进草稿目录。
 *
 * 只由 `capture-tool.mjs` 以子进程方式启动，不直接对外使用。
 *   node --permission --allow-fs-read=... --allow-child-process capture-child.mjs --slug <slug>
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';
import { loadConfig } from './lib/config.mjs';
import { captureShot, launchBrowser } from './lib/browser.mjs';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--slug') options.slug = argv[++index];
    else if (arg === '--base') options.base = argv[++index];
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.slug) throw new Error('缺少 --slug');
  const slug = options.slug;
  const config = loadConfig();
  const draftDir = join(STATE_PATHS.drafts, slug);
  const imagesDir = join(draftDir, 'images');
  mkdirSync(imagesDir, { recursive: true });
  const casePath = join(ROOT, 'scripts', 'editorial', 'cases', `${slug}.mjs`);
  if (!existsSync(casePath)) throw new Error(`截图用例不存在：scripts/editorial/cases/${slug}.mjs`);

  if (!options.base) throw new Error('缺少 --base（dev server 由 capture-tool 在沙箱外启动）');
  const base = options.base;
  let browser = null;
  let context = null;
  const entries = [];
  try {
    browser = await launchBrowser();
    context = await browser.newContext({
      viewport: config.capture.viewport,
      locale: 'zh-CN',
      colorScheme: 'light',
      acceptDownloads: false,
    });
    await context.addInitScript(() => {
      localStorage.setItem('clover-lang', 'zh');
      localStorage.setItem('clover-theme', 'light');
      localStorage.setItem('ct-sfx', 'off');
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const shot = async (locator, name, meta = {}) => {
      const file = `${slug}-${name}`;
      const filePath = join(imagesDir, file);
      const entry = await captureShot(page, locator, filePath, { file, slug, ...meta });
      entries.push(entry);
      return entry;
    };
    const module = await import(pathToFileURL(casePath).href);
    if (typeof module.default !== 'function') throw new Error(`${casePath} 需要默认导出一个 async 函数`);
    await module.default({ page, browser, base, shot, config });
    if (entries.length === 0) throw new Error('用例未产生任何截图');
    writeFileSync(join(draftDir, 'captures.json'), `${JSON.stringify(entries, null, 2)}\n`);
    writeFileSync(
      join(draftDir, 'capture-log.json'),
      `${JSON.stringify({ ok: true, finishedAt: new Date().toISOString(), captures: entries }, null, 2)}\n`,
    );
    console.log(
      JSON.stringify({ ok: true, slug, captures: entries.map((entry) => ({ file: entry.file, width: entry.width, height: entry.height })) }, null, 2),
    );
  } catch (error) {
    writeFileSync(
      join(draftDir, 'capture-log.json'),
      `${JSON.stringify({ ok: false, finishedAt: new Date().toISOString(), error: String(error.message ?? error) }, null, 2)}\n`,
    );
    throw error;
  } finally {
    try {
      await context?.close();
    } catch {
      // ignore
    }
    try {
      await browser?.close();
    } catch {
      // ignore
    }
  }
}

main().catch((error) => {
  console.error(String(error.message ?? error));
  process.exit(1);
});
