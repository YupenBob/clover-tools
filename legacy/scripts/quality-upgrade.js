#!/usr/bin/env node
/**
 * CloverTools Quality Upgrade Script
 * Runs 06:30 daily:
 *  1. Upgrade one low-quality tool (internal logic)
 *  2. Generate one new high-quality tool (via Claude Code)
 * Then: git commit + vercel deploy
 */
const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const CLOVER = '/home/yock/clover-tools-v2';
const TOOLS_JSON = `${CLOVER}/tools.json`;
const AUTO_ARTICLES = '/root/.openclaw/workspace/projects/clover-tools-v2/auto-articles.json';
const GENERATOR = `${CLOVER}/generator.js`;

function log(msg) { console.log(`[QU] ${msg}`); }

function exec(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd: CLOVER, timeout: 120, stdio: 'inherit', ...opts });
    p.on('close', code => code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`)));
  });
}

function execOut(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { cwd: CLOVER, ...opts });
  let out = '';
  p.stdout.on('data', d => out += d);
  p.on('close', code => { /* resolve even on non-0 */ });
  return out;
}

// Load .env
function loadEnv() {
  const env = {};
  try {
    fs.readFileSync('/root/.openclaw/workspace/.env', 'utf8')
      .split('\n')
      .filter(l => l && !l.startsWith('#'))
      .forEach(l => { const [k,...v]=l.split('='); env[k]=v.join('='); });
  } catch(e) {}
  return env;
}

// ─── Step 1: Upgrade one low-quality tool ────────────────────────────────────
function findLowQualityTool(cats) {
  const all = cats.flatMap(c => c.tools);
  const scored = all.map(t => ({
    tool: t,
    score: (t.description||'').length,
    hasExample: !!(t.example || t.code),
  }));
  scored.sort((a, b) => a.score - b.score || (a.hasExample ? 1 : -1));
  return scored[0]?.tool;
}

const TEMPLATE_UPGRADES = {
  'format-conversion/file-analyzer.html': {
    description: '上传文件获取详细分析报告 — 文件大小、类型、行数、字符统计、编码检测，支持 TXT/CSV/JSON/代码文件',
    keywords: ['文件分析器', '文件大小', '文件类型', '编码检测', '统计行数'],
  },
  'format-conversion/image-resize.html': {
    description: '在线调整图片尺寸，支持批量上传、自由缩放、按比例裁剪，实时预览输出效果，下载压缩后的图片',
    keywords: ['图片压缩', '调整图片大小', '批量压缩图片', '图片尺寸'],
  },
  'format-conversion/jpg2pdf.html': {
    description: '在线将 JPG/PNG/BMP 图片转换为 PDF 文档，支持多图合并、自定义页面尺寸，下载即用无需注册',
    keywords: ['图片转PDF', 'JPG转PDF', 'PNG转PDF', '批量转PDF'],
  },
  'format-conversion/jpg2webp.html': {
    description: '在线将 JPG/PNG 图片转换为 WebP 格式，大幅压缩体积同时保持清晰度，提升网页加载速度',
    keywords: ['图片转WebP', 'JPG转WebP', 'PNG转WebP', 'WebP压缩'],
  },
  'format-conversion/pdf-compress.html': {
    description: '在线压缩 PDF 文件体积，减小文件大小以便快速传输和存储，支持自定义压缩级别',
    keywords: ['PDF压缩', '减小PDF体积', 'PDF文件压缩'],
  },
};

function upgradeTool(tool) {
  const tpl = TEMPLATE_UPGRADES[tool.path];
  if (tpl) {
    Object.assign(tool, tpl);
    log(`Applied template upgrade: ${tool.path}`);
  } else {
    // Generic upgrade
    if (!(tool.description || '').trim()) {
      tool.description = `${tool.name}在线工具 - 高效便捷，快速完成您的工作`;
    }
    if (!tool.keywords || tool.keywords.length === 0) {
      tool.keywords = [tool.name, tool.name.replace(/在线|工具/g, '').trim()];
    }
    log(`Applied generic upgrade: ${tool.path} (desc: "${(tool.description||'').slice(0,40)}")`);
  }
}

// ─── Step 2: Generate new tool via Claude Code ────────────────────────────────
async function claudeGenerateTool(toolName, category) {
  const prompt = `为 CloverTools 工具站生成一个新工具。

工具站使用 HTML + Vanilla JS 构建，无框架。generator.js 从 tools.json 读取工具元信息（name, path, category, description, keywords, type）并生成静态 HTML 页面。

工具类型通过 TOOL_TYPE_REGISTRY 决定渲染模板：
- tool-static: 纯静态工具（HTML + 内联JS）
- tool-formatter: 格式化工具（输入 + 处理 + 格式化输出）
- tool-upload: 上传文件处理工具
- format-convert: 格式转换工具
- calculator/calculate: 计算器
- time: 时间工具
- encoder: 编码/加密工具
- dev-tools: 开发工具
- life: 生活工具
- http-test: HTTP 测试工具

请生成一个新的、高质量的、实用工具：

工具名：${toolName}
分类：${category}

要求：
1. 工具必须是一个真实有用的、开发者或用户经常需要的在线工具
2. 描述要详细（50字以上），包含功能说明和使用场景
3. keywords 要丰富（5个以上），覆盖同义词、相关搜索词
4. type 要正确匹配工具类型
5. 提供 code（工具的实际实现代码）或 example（使用示例）

请直接输出 JSON，格式如下：
{
  "name": "工具名",
  "path": "category/tool-name.html",
  "category": "分类名",
  "description": "详细描述（50字以上）",
  "keywords": ["关键词1","关键词2","关键词3","关键词4","关键词5"],
  "type": "tool类型",
  "code": "工具实现代码（HTML+JS）",
  "example": "使用示例"
}

只输出 JSON，不要有其他文字。`;

  const env = loadEnv();
  const key = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  const base = env.ANTHROPIC_BASE_URL || 'https://api.minimaxi.com/anthropic';

  return new Promise((resolve, reject) => {
    const p = spawn('sudo', ['-u', 'yock', 'bash', '-c',
      `cd ${CLOVER} && ANTHROPIC_API_KEY='${key}' ANTHROPIC_BASE_URL='${base}' claude -p ${JSON.stringify(prompt)} --dangerously-skip-permissions`
    ], { timeout: 60 });
    let out = '';
    p.stdout.on('data', d => { out += d; process.stdout.write(d); });
    p.stderr.on('data', d => process.stderr.write(d));
    p.on('close', code => {
      if (code === 0) resolve(out);
      else reject(new Error(`claude exited ${code}`));
    });
  });
}

function parseClaudeOutput(output) {
  // Extract JSON from Claude's output
  const lines = output.trim().split('\n');
  // Find the JSON block
  let jsonStart = -1, jsonEnd = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === '{' || lines[i].trim().startsWith('{')) { jsonStart = i; break; }
  }
  if (jsonStart === -1) return null;
  // Try to find matching close brace
  let depth = 0;
  for (let i = jsonStart; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth === 0 && i >= jsonStart) { jsonEnd = i; break; }
    }
    if (jsonEnd !== -1) break;
  }
  if (jsonEnd === -1) return null;
  const jsonStr = lines.slice(jsonStart, jsonEnd + 1).join('\n');
  try {
    return JSON.parse(jsonStr);
  } catch(e) {
    // Try whole output
    try {
      return JSON.parse(output.trim());
    } catch(e2) {
      return null;
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('Starting quality upgrade...');
  const env = loadEnv();
  process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

  const cats = JSON.parse(fs.readFileSync(TOOLS_JSON));
  const autoArticles = JSON.parse(fs.readFileSync(AUTO_ARTICLES));

  // Step A: Upgrade a low-quality tool
  const lowTool = findLowQualityTool(cats);
  log(`Step 1: Upgrading ${lowTool?.path}`);
  if (lowTool) {
    upgradeTool(lowTool);
  }

  // Step B: Generate new tool via Claude Code
  let newTool = null;
  if (autoArticles.length > 0) {
    // Find first unused keyword
    const all = cats.flatMap(c => c.tools);
    const existingPaths = new Set(all.map(t => t.path));

    for (const art of autoArticles) {
      const kw = art.keyword || art.title;
      if (!kw) continue;
      const slug = kw.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const testPath = `develop/${slug}.html`;
      if (!existingPaths.has(testPath)) {
        log(`Step 2: Claude generating "${kw}"...`);
        try {
          const output = await claudeGenerateTool(kw, art.category || '开发工具');
          newTool = parseClaudeOutput(output);
          if (newTool && newTool.name) {
            // Normalize path
            if (!newTool.path) newTool.path = testPath;
            log(`Claude generated: ${newTool.name}`);
            log(`  desc: ${(newTool.description||'').slice(0,60)}`);
            break;
          }
        } catch(e) {
          log(`Claude error: ${e.message}`);
        }
        break; // only try one
      }
    }
  }

  // Add new tool to tools.json
  if (newTool) {
    let devCat = cats.find(c => c.category === '开发工具');
    if (!devCat) {
      cats.push({ category: '开发工具', tools: [] });
      devCat = cats[cats.length - 1];
    }
    devCat.tools.push(newTool);
    log(`Added new tool: ${newTool.path}`);
  }

  // Save and build
  fs.writeFileSync(TOOLS_JSON, JSON.stringify(cats, null, 2));
  log('Saved tools.json');

  await exec('node', [GENERATOR]);

  // Git commit & push
  const msg = newTool
    ? `upgrade: ${lowTool?.path} + add ${newTool.name}`
    : `upgrade: ${lowTool?.path}`;
  execOut('git', ['add', 'tools.json', 'dist/']);
  try {
    execOut('git', ['commit', '-m', msg]);
    execOut('git', ['push', 'origin', 'main']);
    log('git push done');
  } catch(e) { log('git note: ' + e.message); }

  // Vercel
  try {
    const vercelOut = execOut('npx', ['vercel', '--prod', '--yes'], {
      env: { ...process.env, ...env },
    });
    log('Vercel: ' + (vercelOut.includes('Completing') ? 'deployed ✓' : 'queued'));
  } catch(e) { log('Vercel: ' + e.message); }

  console.log('\n✅ Quality Upgrade Complete');
  if (lowTool) console.log(`   Upgraded: ${lowTool.path}`);
  if (newTool) console.log(`   New: ${newTool.name} (${newTool.path})`);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
