#!/usr/bin/env node
/**
 * CloverTools Quality Upgrade Script
 * Runs 06:30 daily:
 *  1. Upgrade one low-quality tool to high quality
 *  2. Generate one new high-quality tool
 * Then: git commit + vercel deploy + output result summary
 */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const CLOVER = '/home/yock/clover-tools-v2';
const TOOLS_JSON = `${CLOVER}/tools.json`;
const AUTO_ARTICLES = '/root/.openclaw/workspace/projects/clover-tools-v2/auto-articles.json';
const GENERATOR = `${CLOVER}/generator.js`;

function log(msg) { console.log(`[QU] ${msg}`); }

function exec(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: CLOVER, timeout: 50, ...opts });
    let out = '', err = '';
    p.stdout.on('data', d => out += d);
    p.stderr.on('data', d => err += d);
    p.on('close', code => code === 0 ? resolve(out) : reject(new Error(`${cmd} ${args.join(' ')} failed: ${err}`)));
  });
}

function execSync(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { cwd: CLOVER, ...opts });
  let out = '', err = '';
  p.stdout.on('data', d => out += d);
  p.stderr.on('data', d => err += d);
  p.on('close', code => code === 0 || undefined);
  return out;
}

// ─── Step 1: Find a low-quality tool to upgrade ──────────────────────────────
function findLowQualityTool(cats) {
  const all = cats.flatMap(c => c.tools);
  // Score: shorter desc = worse, no example = worse
  const scored = all.map(t => ({
    tool: t,
    score: (t.description||'').length < 10 ? 0 : (t.description||'').length,
    hasExample: !!(t.example || t.code),
  }));
  // Sort by score asc (worst first), prefer tools without examples
  scored.sort((a, b) => a.score - b.score || (a.hasExample ? 1 : -1));
  return scored[0]?.tool;
}

// ─── Step 2: Generate a new tool from auto-articles ───────────────────────────
function findNewToolKeyword(cats, autoArticles) {
  const all = cats.flatMap(c => c.tools);
  const existingPaths = new Set(all.map(t => t.path));
  const existingNames = new Set(all.map(t => t.name.toLowerCase()));

  for (const art of autoArticles) {
    const kw = art.keyword || art.title;
    if (!kw) continue;
    const slug = kw.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const path = `develop/${slug}.html`; // put in develop category
    if (!existingPaths.has(path) && !existingNames.has(kw.toLowerCase())) {
      return art;
    }
  }
  return null;
}

// ─── Step 3: Upgrade a tool ────────────────────────────────────────────────────
const UPGRADE_TEMPLATES = {
  'format-conversion/file-analyzer.html': {
    description: '上传文件获取详细分析报告 — 文件大小、类型、行数、字符统计、编码检测，支持 TXT/CSV/JSON/代码文件',
    keywords: ['文件分析器', '文件大小', '文件类型', '编码检测', '统计行数'],
    template: 'upload', // uses upload template with analyzer logic
  },
  'format-conversion/image-resize.html': {
    description: '在线调整图片尺寸，支持批量上传、自由缩放、按比例裁剪，实时预览输出效果，下载压缩后的图片',
    keywords: ['图片压缩', '调整图片大小', '批量压缩图片', '图片尺寸'],
    template: 'image-resize',
  },
};

function upgradeTool(tool) {
  const tpl = UPGRADE_TEMPLATES[tool.path];
  if (!tpl) {
    // Generic upgrade: improve description and add keywords
    tool.description = tool.description || `${tool.name}在线工具`;
    if (!tool.keywords || tool.keywords.length === 0) {
      tool.keywords = [
        tool.name,
        tool.name.replace(/在线|工具/g, '').trim(),
        `${tool.name}使用方法`,
      ];
    }
    return;
  }
  Object.assign(tool, tpl);
  return;
}

// ─── Step 4: Generate a new tool entry ────────────────────────────────────────
function makeNewTool(article) {
  const kw = article.keyword || article.title;
  const slug = kw.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  return {
    name: kw,
    path: `develop/${slug}.html`,
    category: '开发工具',
    description: article.description || `在线${kw}工具 - ${article.content?.slice(0,50)||'高效便捷'}`,
    keywords: article.keywords || [kw, `${kw}工具`, `在线${kw}`],
    type: 'generic', // will be routed via TOOL_TYPE_REGISTRY
    tags: ['开发工具', '在线工具'],
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('Starting quality upgrade...');

  // Load data
  const cats = JSON.parse(fs.readFileSync(TOOLS_JSON));
  let autoArticles = [];
  try {
    autoArticles = JSON.parse(fs.readFileSync(AUTO_ARTICLES));
  } catch(e) { log('No auto-articles, skipping new tool step'); }

  // Step A: Upgrade one low-quality tool
  const lowTool = findLowQualityTool(cats);
  log(`Upgrading: ${lowTool?.path} — ${lowTool?.name}`);
  if (lowTool) {
    upgradeTool(lowTool);
    log(`  description → "${(lowTool.description||'').slice(0,60)}"`);
  }

  // Step B: Add one new tool
  let newArt = null;
  if (autoArticles.length > 0) {
    newArt = findNewToolKeyword(cats, autoArticles);
    if (newArt) {
      const newTool = makeNewTool(newArt);
      // Find or create 'develop' category
      let devCat = cats.find(c => c.category === '开发工具');
      if (!devCat) {
        cats.push({ category: '开发工具', tools: [] });
        devCat = cats[cats.length - 1];
      }
      devCat.tools.push(newTool);
      log(`Adding new tool: ${newTool.path} — ${newTool.name}`);
    } else {
      log('No new keyword available, skipping new tool step');
    }
  }

  // Save tools.json
  fs.writeFileSync(TOOLS_JSON, JSON.stringify(cats, null, 2));
  log('Saved tools.json');

  // Step C: Run generator
  await exec('node', [GENERATOR], { stdio: 'inherit' });
  log('generator.js done');

  // Step D: Git commit
  const msg = lowTool && newArt
    ? `upgrade: improve ${lowTool.path} + add ${newArt.keyword||newArt.title}`
    : lowTool
    ? `upgrade: improve ${lowTool.path}`
    : `chore: daily quality run`;
  execSync('git', ['add', 'tools.json', 'dist/']);
  try {
    execSync('git', ['commit', '-m', msg]);
    execSync('git', ['push', 'origin', 'main']);
    log('git push done');
  } catch(e) { log('git push note: ' + e.message); }

  // Step E: Vercel deploy
  const env = Object.fromEntries(
    fs.readFileSync('/root/.openclaw/workspace/.env', 'utf8')
      .split('\n')
      .filter(l => l && !l.startsWith('#'))
      .map(l => { const [k,...v]=l.split('='); return [k,v.join('=')]; })
  );
  process.env.VERCEL_TOKEN = env.VERCEL_TOKEN;

  const vercelOut = execSync('npx', ['vercel', '--prod', '--yes'], {
    env: { ...process.env, ...env },
  });
  log('Vercel: ' + (vercelOut.includes('Completing') ? 'deployed' : vercelOut.slice(-100)));

  // Summary
  console.log('\n✅ Quality Upgrade Complete');
  console.log(`   Upgraded: ${lowTool?.path}`);
  if (newArt) console.log(`   New: ${newArt.keyword || newArt.title}`);
  console.log(`   Commit: ${msg}`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
