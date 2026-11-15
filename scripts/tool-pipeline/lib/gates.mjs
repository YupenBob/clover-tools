import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { changedPaths } from './git.mjs';
import { ensureDir, fileSize, nowIso, readJson, readText, stripAnsi } from './util.mjs';

function commandEnv(extra = {}) {
  return {
    ...process.env,
    ASTRO_TELEMETRY_DISABLED: '1',
    GIT_TERMINAL_PROMPT: '0',
    ...extra,
  };
}

export function runCommand({ label, command, args = [], cwd, logFile, timeoutMs, env = {} }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const stream = createWriteStream(logFile, { flags: 'w' });
    const tail = [];
    let timedOut = false;
    const child = spawn(command, args, {
      cwd,
      env: commandEnv(env),
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    });
    const killTree = (signal) => {
      try {
        process.kill(-child.pid, signal);
      } catch {
        try {
          child.kill(signal);
        } catch {
          /* already gone */
        }
      }
    };
    const append = (chunk) => {
      const text = stripAnsi(chunk.toString());
      stream.write(text);
      tail.push(text);
      if (tail.length > 400) tail.splice(0, tail.length - 400);
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => {
      timedOut = true;
      killTree('SIGTERM');
      setTimeout(() => killTree('SIGKILL'), 10000).unref?.();
    }, timeoutMs);
    timer.unref?.();
    const finish = (code) => {
      clearTimeout(timer);
      stream.end();
      const durationMs = Date.now() - startedAt;
      const text = tail.join('');
      const result = {
        label,
        command: [command, ...args].join(' '),
        ok: code === 0 && !timedOut,
        code,
        timedOut,
        durationMs,
        logFile,
        tail: text.length > 12000 ? text.slice(-12000) : text,
        finishedAt: nowIso(),
      };
      resolve(result);
    };
    child.on('error', (error) => {
      stream.write(`spawn error: ${error.message}\n`);
      finish(127);
    });
    child.on('close', (code) => finish(code ?? 1));
  });
}

function distPath(worktree, locale, item) {
  const prefix =
    locale === 'zh' ? '' : locale === 'tw' ? 'zh-hant/' : `${locale}/`;
  return join(worktree, 'dist', prefix, 'tools', item.category, item.slug, 'index.html');
}

const HTML_LANG = { zh: 'zh-CN', tw: 'zh-Hant', en: 'en', ko: 'ko', ja: 'ja' };

function checkBuiltPage({ worktree, item, locale, issues }) {
  const file = distPath(worktree, locale, item);
  if (!existsSync(file)) {
    issues.push(`${locale}: 缺少构建产物 ${file.replace(worktree + '/', '')}`);
    return;
  }
  const html = readFileSync(file, 'utf8');
  const lang = /<html[^>]*\blang="([^"]+)"/i.exec(html)?.[1];
  if (lang !== HTML_LANG[locale]) {
    issues.push(`${locale}: html lang=${lang ?? '<missing>'}，期望 ${HTML_LANG[locale]}`);
  }
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  if (!title) issues.push(`${locale}: <title> 为空`);
  const description =
    /<meta[^>]+name="description"[^>]+content="([^"]*)"/i.exec(html)?.[1] ??
    /<meta[^>]+content="([^"]*)"[^>]+name="description"/i.exec(html)?.[1] ??
    '';
  if (!description) issues.push(`${locale}: meta description 为空`);
  const canonical =
    /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i.exec(html)?.[1] ??
    /<link[^>]+href="([^"]+)"[^>]+rel="canonical"/i.exec(html)?.[1] ??
    '';
  if (!canonical) issues.push(`${locale}: canonical 缺失`);
  if (/<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html)) {
    issues.push(`${locale}: 新工具页不应 noindex`);
  }
}

function pathnameOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function checkSitemap({ worktree, item, issues }) {
  const file = join(worktree, 'dist', 'sitemap-0.xml');
  if (!existsSync(file)) {
    issues.push('缺少 dist/sitemap-0.xml');
    return;
  }
  const xml = readFileSync(file, 'utf8');
  const paths = new Set(
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => pathnameOf(match[1])),
  );
  const expected = [
    `/tools/${item.category}/${item.slug}/`,
    `/zh-hant/tools/${item.category}/${item.slug}/`,
    `/en/tools/${item.category}/${item.slug}/`,
    `/ko/tools/${item.category}/${item.slug}/`,
    `/ja/tools/${item.category}/${item.slug}/`,
  ];
  for (const path of expected) {
    if (!paths.has(path)) issues.push(`sitemap 缺少 ${path}`);
  }
}

function checkI18n({ worktree, item, issues }) {
  for (const lang of ['en', 'ja', 'ko']) {
    const file = join(worktree, 'src', 'lib', 'i18n', `${lang}.json`);
    const data = readJson(file, null);
    if (!data) {
      issues.push(`${lang}.json 解析失败`);
      continue;
    }
    if (!data.tools?.[item.slug]) issues.push(`${lang}.json 缺少 tools.${item.slug}`);
    if (!data.content?.[item.slug]) issues.push(`${lang}.json 缺少 content.${item.slug}`);
    if (!data.tools?.[item.slug]?.name) issues.push(`${lang}.json 缺少 tool name`);
    if (!data.tools?.[item.slug]?.description) issues.push(`${lang}.json 缺少 description`);
  }
  const manifest = readJson(join(worktree, 'data', 'i18n-tool-pages.json'), null);
  const langs = manifest?.tools?.[item.slug]?.langs ?? [];
  for (const lang of ['zh', 'tw', 'en', 'ko', 'ja']) {
    if (!langs.includes(lang)) issues.push(`data/i18n-tool-pages.json 缺少 ${lang}`);
  }
}

function checkIntegration({ worktree, item, issues }) {
  const tools = readText(join(worktree, 'src/lib/tools.ts'));
  if (!tools.includes(`slug: '${item.slug}'`) && !tools.includes(`slug: "${item.slug}"`)) {
    issues.push('src/lib/tools.ts 未登记工具');
  }
  const seo = readText(join(worktree, 'src/lib/tool-seo', `${item.category}.ts`));
  if (!seo.includes(item.slug)) issues.push(`src/lib/tool-seo/${item.category}.ts 未登记`);
  for (const file of ['src/lib/tool-content.ts', 'src/lib/tool-details.ts']) {
    const text = readText(join(worktree, file));
    if (!text.includes(item.slug)) issues.push(`${file} 未登记 ${item.slug}`);
  }
  const aliases = readText(join(worktree, 'scripts/gen-search-index.mjs'));
  if (!aliases.includes(item.slug)) issues.push('scripts/gen-search-index.mjs 缺少搜索别名');
  const tsconfig = readText(join(worktree, 'tsconfig.tools.json'));
  if (!tsconfig.includes(item.slug)) issues.push('tsconfig.tools.json 未纳入新文件');
  const searchIndex = readText(join(worktree, 'public/search-index.json'));
  if (!searchIndex.includes(item.slug)) issues.push('public/search-index.json 缺少新工具');
  if (item.network) {
    const apiRelative = item.apiFile ?? `functions/api/${item.slug}.ts`;
    const api = join(worktree, apiRelative);
    if (!existsSync(api)) issues.push(`缺少 ${apiRelative}`);
    else if (!/onRequest/.test(readText(api))) issues.push(`${apiRelative} 缺少 onRequest`);
  }
}

function checkTests({ worktree, item, issues }) {
  const testDir = join(worktree, 'scripts', 'tests');
  const mainTest = `${item.slug}.test.mjs`;
  const related = existsSync(testDir)
    ? readdirSync(testDir).filter(
        (name) =>
          name === mainTest ||
          (name.startsWith(`${item.slug}-`) && name.endsWith('.test.mjs')),
      )
    : [];
  if (!related.includes(mainTest)) {
    issues.push('缺少单元测试 scripts/tests/<slug>.test.mjs');
  } else {
    const text = related.map((name) => readText(join(testDir, name))).join('\n');
    const tests = (text.match(/\btest\s*\(/g) ?? []).length;
    const asserts = (text.match(/\bassert\./g) ?? []).length;
    if (tests < 3) issues.push(`单元测试只有 ${tests} 条 test()，至少 3 条`);
    if (asserts < 5) issues.push(`单元测试只有 ${asserts} 条 assert，至少 5 条`);
    if (/\.skip\s*\(|skip:\s*true|\.todo\s*\(/.test(text)) {
      issues.push('单元测试含 skip/todo');
    }
  }
  const caseFile = join(worktree, 'scripts', 'lib', 'tool-cases', `${item.slug}.mjs`);
  if (!existsSync(caseFile)) {
    issues.push('缺少浏览器用例 scripts/lib/tool-cases/<slug>.mjs');
  } else {
    const text = readText(caseFile);
    if (!/export\s+(?:async\s+)?function\s+run|export\s+const\s+run/.test(text)) {
      issues.push('浏览器用例未导出 run()');
    }
    if (text.split('\n').length < 20) issues.push('浏览器用例过短，疑似占位');
  }
}

function checkDocs({ worktree, base, item, issues }) {
  const changed = changedPaths(base, worktree);
  const docs = changed.all.filter(
    (path) => path.startsWith('docs/') && path.endsWith('.md'),
  );
  if (!docs.length) {
    issues.push('缺少 docs/<TOOL>.md 文档');
    return;
  }
  const text = docs.map((path) => readText(join(worktree, path))).join('\n');
  if (!text.toLowerCase().includes(String(item.slug).toLowerCase())) {
    issues.push('docs 文档未提到工具 slug');
  }
}

export function sourceIntegrationIssues({ worktree, base, item }) {
  const issues = [];
  const tools = readText(join(worktree, 'src/lib/tools.ts'));
  if (!tools.includes(`slug: '${item.slug}'`) && !tools.includes(`slug: "${item.slug}"`)) {
    issues.push('src/lib/tools.ts 未登记工具 slug');
  }
  const seo = readText(join(worktree, 'src/lib/tool-seo', `${item.category}.ts`));
  if (!seo.includes(item.slug)) issues.push(`src/lib/tool-seo/${item.category}.ts 未登记`);
  for (const file of ['src/lib/tool-content.ts', 'src/lib/tool-details.ts']) {
    if (!readText(join(worktree, file)).includes(item.slug)) issues.push(`${file} 未登记`);
  }
  for (const lang of ['en', 'ja', 'ko']) {
    const data = readJson(join(worktree, 'src/lib/i18n', `${lang}.json`), null);
    if (!data?.tools?.[item.slug]) issues.push(`src/lib/i18n/${lang}.json 缺少 tools.${item.slug}`);
    if (!data?.content?.[item.slug]) issues.push(`src/lib/i18n/${lang}.json 缺少 content.${item.slug}`);
  }
  if (!readText(join(worktree, 'tsconfig.tools.json')).includes(item.slug)) {
    issues.push('tsconfig.tools.json 未纳入新 lib/scripts');
  }
  if (!readText(join(worktree, 'scripts/gen-search-index.mjs')).includes(item.slug)) {
    issues.push('scripts/gen-search-index.mjs 缺少搜索别名');
  }
  for (const locale of ['zh', 'en', 'ja', 'ko', 'zh-hant']) {
    const prefix = locale === 'zh' ? '' : `${locale}/`;
    const page = join(worktree, 'src/pages', prefix, 'tools', item.category, `${item.slug}.astro`);
    if (!existsSync(page)) issues.push(`缺少页面 src/pages/${prefix}tools/${item.category}/${item.slug}.astro`);
  }
  if (item.network) {
    const apiRelative = item.apiFile ?? `functions/api/${item.slug}.ts`;
    const api = join(worktree, apiRelative);
    if (!existsSync(api)) issues.push(`缺少 ${apiRelative}`);
    else if (!/onRequest/.test(readText(api))) issues.push(`${apiRelative} 缺少 onRequest`);
  }
  const testFile = join(worktree, 'scripts/tests', `${item.slug}.test.mjs`);
  if (!existsSync(testFile)) issues.push(`缺少 scripts/tests/${item.slug}.test.mjs`);
  const caseFile = join(worktree, 'scripts/lib/tool-cases', `${item.slug}.mjs`);
  if (!existsSync(caseFile)) issues.push(`缺少 scripts/lib/tool-cases/${item.slug}.mjs`);
  const docs = changedPaths(base, worktree).all.filter(
    (path) => path.startsWith('docs/') && path.endsWith('.md') && path.toLowerCase().includes(String(item.slug).toLowerCase()),
  );
  if (!docs.length) issues.push('缺少 docs/<TOOL>.md（文件名需包含 slug）');
  return issues;
}

export function verifyStructure({ worktree, base, item, issues: initial = [] }) {
  const issues = [...initial];
  for (const locale of ['zh', 'tw', 'en', 'ko', 'ja']) {
    checkBuiltPage({ worktree, item, locale, issues });
  }
  checkSitemap({ worktree, item, issues });
  checkI18n({ worktree, item, issues });
  checkIntegration({ worktree, item, issues });
  checkTests({ worktree, item, issues });
  checkDocs({ worktree, base, item, issues });
  return { ok: issues.length === 0, issues };
}

export async function runGates({ worktree, base, item, config, runDir, env = {}, skipBrowser = false }) {
  const logs = join(runDir, 'gates');
  ensureDir(logs);
  const results = [];
  const add = (result) => {
    results.push(result);
    return result;
  };

  const integrationIssues = sourceIntegrationIssues({ worktree, base, item });
  add({
    label: 'integration',
    command: 'sourceIntegrationIssues',
    ok: integrationIssues.length === 0,
    code: integrationIssues.length === 0 ? 0 : 1,
    timedOut: false,
    durationMs: 0,
    logFile: null,
    tail: integrationIssues.join('\n'),
    issues: integrationIssues,
    finishedAt: nowIso(),
  });
  if (integrationIssues.length) {
    return { ok: false, failed: 'integration', results };
  }

  const counts = join(worktree, 'scripts/tool-pipeline/update-tool-counts.mjs');
  if (existsSync(counts)) {
    add(
      await runCommand({
        label: 'tool-counts',
        command: process.execPath,
        args: ['scripts/tool-pipeline/update-tool-counts.mjs', '--write'],
        cwd: worktree,
        logFile: join(logs, 'tool-counts.log'),
        timeoutMs: 60_000,
        env,
      }),
    );
    if (!results.at(-1).ok) return { ok: false, failed: 'tool-counts', results };
  }

  const test = config.gates.test ?? { command: ['npm', 'test'], timeoutMinutes: 30 };
  add(
    await runCommand({
      label: 'test',
      command: test.command[0],
      args: test.command.slice(1),
      cwd: worktree,
      logFile: join(logs, 'test.log'),
      timeoutMs: (test.timeoutMinutes ?? 30) * 60 * 1000,
      env,
    }),
  );
  if (!results.at(-1).ok) return { ok: false, failed: 'test', results };

  const build = config.gates.build ?? { command: ['npm', 'run', 'build'], timeoutMinutes: 75 };
  add(
    await runCommand({
      label: 'build',
      command: build.command[0],
      args: build.command.slice(1),
      cwd: worktree,
      logFile: join(logs, 'build.log'),
      timeoutMs: (build.timeoutMinutes ?? 75) * 60 * 1000,
      env,
    }),
  );
  if (!results.at(-1).ok) return { ok: false, failed: 'build', results };

  if (!skipBrowser) {
    const browser = config.gates.browser ?? {
      command: ['node', 'scripts/smoke-tool.mjs'],
      timeoutMinutes: 60,
    };
    add(
      await runCommand({
        label: 'browser',
        command: browser.command[0],
        args: [...browser.command.slice(1), '--slug', item.slug, '--category', item.category, '--artifacts', join(runDir, 'screenshots')],
        cwd: worktree,
        logFile: join(logs, 'browser.log'),
        timeoutMs: (browser.timeoutMinutes ?? 60) * 60 * 1000,
        env,
      }),
    );
    if (!results.at(-1).ok) return { ok: false, failed: 'browser', results };
  }

  const structure = verifyStructure({ worktree, base, item });
  add({
    label: 'structure',
    command: 'verifyStructure',
    ok: structure.ok,
    code: structure.ok ? 0 : 1,
    timedOut: false,
    durationMs: 0,
    logFile: null,
    tail: structure.issues.join('\n'),
    issues: structure.issues,
    finishedAt: nowIso(),
  });
  if (!structure.ok) return { ok: false, failed: 'structure', results, structure };

  const countsCheck = await runCommand({
    label: 'tool-counts-check',
    command: process.execPath,
    args: ['scripts/tool-pipeline/update-tool-counts.mjs', '--check'],
    cwd: worktree,
    logFile: join(logs, 'tool-counts-check.log'),
    timeoutMs: 60_000,
    env,
  });
  add(countsCheck);
  if (!countsCheck.ok) return { ok: false, failed: 'tool-counts-check', results };

  return { ok: true, results, structure };
}

export function summarizeGates(results) {
  return results
    .map((result) => {
      const status = result.ok ? 'PASS' : result.timedOut ? 'TIMEOUT' : 'FAIL';
      const tail = result.tail ? `\n${lastLines(result.tail, 12)}` : '';
      return `- ${result.label}: ${status} (${Math.round((result.durationMs ?? 0) / 1000)}s)${tail}`;
    })
    .join('\n');
}

function lastLines(text, count) {
  const lines = String(text).trim().split('\n');
  return lines.slice(-count).join('\n');
}

export function failedGateText(results) {
  const failed = results.find((result) => !result.ok);
  if (!failed) return '';
  return `门禁 ${failed.label} 失败（exit ${failed.code}${failed.timedOut ? ', timeout' : ''}）\n${lastLines(failed.tail ?? '', 60)}`;
}

export function readGateArtifacts(runDir) {
  const file = join(runDir, 'gates.json');
  return readJson(file, null);
}

export function screenshotFiles(runDir) {
  const dir = join(runDir, 'screenshots');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /\.(png|jpg|jpeg|webp)$/i.test(name))
    .map((name) => join(dir, name));
}

export function statBytes(file) {
  return fileSize(file);
}
