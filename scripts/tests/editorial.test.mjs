/** 自动化内容流水线的纯函数与状态回归测试（不需要构建产物、不联网）。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 状态目录隔离，避免污染仓库 .editorial/
const stateDir = mkdtempSync(join(tmpdir(), 'clover-editorial-test-'));
process.env.DSH_EDITORIAL_STATE_DIR = stateDir;

const quality = await import('../editorial/lib/quality.mjs');
const state = await import('../editorial/lib/state.mjs');
const configMod = await import('../editorial/lib/config.mjs');
const gsc = await import('../editorial/lib/gsc.mjs');
const report = await import('../editorial/lib/report.mjs');
const { buildAutoIndexSource } = await import('../editorial/build-auto-index.mjs');

const FILLER = '工具按输入顺序逐项处理，并在页面上展示可以直接核对的输出结果与适用范围。';

function makeContent({ sections = 5, repeat = 10 } = {}) {
  const paragraphs = FILLER.repeat(repeat);
  let content = '<p>直接回答：JSON 格式化用于把压缩的 JSON 展开为可读结构，并同时校验语法错误的位置。</p>';
  for (let index = 0; index < sections; index += 1) {
    content += `<h2>第 ${index + 1} 节：处理与核对</h2><p>${paragraphs}</p>`;
  }
  content += '<ul><li>先校验语法</li><li>再格式化</li></ul>';
  content += '<table><thead><tr><th>输入</th><th>结果</th></tr></thead><tbody><tr><td>{"a":1}</td><td>格式化成功</td></tr></tbody></table>';
  content += '<p>相关工具：<a href="/tools/dev/json-formatter/">JSON 格式化</a> 与 <a href="/tools/dev/json-convert/">JSON 转 CSV</a>。</p>';
  return content;
}

function makeGuide(overrides = {}) {
  const content = overrides.content ?? makeContent();
  const cjk = quality.cjkCount(quality.stripHtml(content));
  return {
    slug: 'json-formatting-check',
    title: 'JSON 格式化与校验：从报错到可读输出',
    description:
      '演示 JSON 格式化的排查顺序、语法校验与压缩边界，说明输入示例、输出结果和工具限制，避免把格式化当成字段校验。',
    seoDescription:
      '这篇指南演示 JSON 格式化的排查顺序、语法校验与压缩边界，先给出可以直接对照的输入示例与期望输出，再说明缩进、键顺序和转义字符的处理方式，以及格式化不能替代字段校验、类型校验和业务校验的原因，最后列出常见报错的定位步骤与工具限制，并说明哪些字段问题需要回到接口文档、日志或调用方排查，避免只靠格式化结果下结论。',
    category: '开发实用',
    toolSlug: 'json-formatter',
    published: '2026-11-01',
    updated: '2026-11-01',
    readingMinutes: quality.expectedReadingMinutes(cjk),
    content,
    faqs: [{ q: '格式化会改变字段含义吗？', a: '不会，格式化只调整空白与缩进。' }],
    sources: [
      { title: 'MDN：JSON', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON' },
      { title: 'RFC 8259', url: 'https://www.rfc-editor.org/rfc/rfc8259' },
    ],
    ...overrides,
  };
}

function makeCtx(overrides = {}) {
  return {
    mode: 'new-guide',
    config: structuredClone(configMod.DEFAULT_CONFIG),
    today: '2026-11-01',
    toolIndex: {
      slugs: new Set(['json-formatter', 'json-convert']),
      hrefs: new Map([
        ['json-formatter', '/tools/dev/json-formatter/'],
        ['json-convert', '/tools/dev/json-convert/'],
      ]),
    },
    categories: ['开发实用'],
    corpus: [],
    csdnCorpus: [],
    imageRegistry: new Map(),
    fileExists: () => true,
    ...overrides,
  };
}

test('基础文本工具：HTML 清洗、CJK 计数与结构统计', () => {
  const html = '<p>你好&nbsp;世界</p><h2>标题</h2><ul><li>a</li></ul><table></table>';
  assert.equal(quality.stripHtml(html), '你好 世界 标题 a');
  assert.equal(quality.cjkCount('abc 中文 123'), 2);
  const structure = quality.analyzeStructure(html);
  assert.equal(structure.h2, 1);
  assert.equal(structure.ul, 1);
  assert.equal(structure.table, 1);
  assert.equal(quality.expectedReadingMinutes(800), 2);
  assert.equal(quality.expectedReadingMinutes(1500), 4);
});

test('相似度：相同文本为 1，无关文本接近 0', () => {
  const a = quality.shingleSet(FILLER.repeat(3));
  assert.equal(quality.jaccard(a, quality.shingleSet(FILLER.repeat(3))), 1);
  const unrelated = quality.shingleSet('完全不同的一段中文内容用于比较两个文本之间的相似程度。');
  assert.ok(quality.jaccard(a, unrelated) < 0.1);
  const corpus = [{ slug: 'other', text: FILLER.repeat(3) }];
  const result = quality.maxSimilarity(FILLER.repeat(3), corpus);
  assert.equal(result.slug, 'other');
  assert.equal(result.max, 1);
});

test('合规文章通过静态校验', () => {
  const guide = makeGuide();
  const result = quality.validateGuideStatic(guide, makeCtx());
  assert.deepEqual(result.errors, []);
  assert.ok(result.metrics.cjk >= 1500);
  assert.equal(result.metrics.internalToolLinks, 2);
  assert.equal(result.metrics.primarySources, 2);
});

test('缺来源、内链与篇幅的草稿被拒绝', () => {
  const guide = makeGuide({
    content: '<p>太短了。</p><h2>一</h2><p>没有列表和表格。</p>',
    sources: [],
  });
  const result = quality.validateGuideStatic(guide, makeCtx());
  const text = result.errors.join('\n');
  assert.match(text, /少于硬性下限/);
  assert.match(text, /来源数量/);
  assert.match(text, /至少需要一个/);
  assert.match(text, /工具内链/);
});

test('标题/描述/日期/站内来源与禁用词会被拦截', () => {
  const longTitle = '这是一个非常长的标题'.repeat(6);
  const guide = makeGuide({
    title: longTitle,
    description: '太短',
    seoDescription: '还是太短',
    published: '2026-13-01',
    sources: [
      { title: '本站', url: 'https://clovertools.cn/guides/x/' },
      { title: 'MDN', url: 'https://developer.mozilla.org/en-US/docs/Web/API' },
    ],
  });
  guide.content = guide.content.replace('<p>直接回答', '<p>我实测这个工具，直接回答');
  const result = quality.validateGuideStatic(guide, makeCtx());
  const text = result.errors.join('\n');
  assert.match(text, /标题汉字数/);
  assert.match(text, /description 汉字数/);
  assert.match(text, /seoDescription 长度/);
  assert.match(text, /published 不是合法日期/);
  assert.match(text, /不得把本站作为来源/);
  assert.match(text, /禁用表述/);
});

test('证据包校验：来源需实际抓取、代码行号需有效、运行需 exit 0', () => {
  const config = structuredClone(configMod.DEFAULT_CONFIG);
  const verifiedSources = new Map([
    ['https://developer.mozilla.org/en-US/docs/Web/API', { status: 200 }],
    ['https://www.rfc-editor.org/rfc/rfc8259', { status: 200 }],
  ]);
  const evidence = {
    claims: [
      { id: 'c1', text: 'MDN 说明 JSON.parse 会在语法错误时抛出异常。', type: 'source', ref: 'https://developer.mozilla.org/en-US/docs/Web/API' },
      { id: 'c2', text: 'RFC 8259 规定 JSON 文本必须是 UTF-8。', type: 'source', ref: 'https://www.rfc-editor.org/rfc/rfc8259' },
      { id: 'c3', text: '工具在 src/lib/tools.ts 中登记。', type: 'code', ref: 'src/lib/tools.ts:1' },
      { id: 'c4', text: '运行脚本得到的输出与正文示例一致。', type: 'run', ref: 'r1' },
      { id: 'c5', text: '压缩示例来自 RFC 8259 的空白规则说明。', type: 'source', ref: 'https://www.rfc-editor.org/rfc/rfc8259' },
    ],
    runs: [{ id: 'r1', command: 'node -e "console.log(1)"', exitCode: 0, outputPath: 'outputs/r1.log', ranAt: '2026-11-01T00:00:00Z' }],
  };
  const ctx = {
    config,
    verifiedSources,
    verifiedRuns: new Map([['r1', { ...evidence.runs[0] }]]),
    fileExists: (path) => path === 'src/lib/tools.ts',
    readLineCount: () => 100,
  };
  assert.deepEqual(quality.validateEvidence(evidence, ctx).errors, []);
  const missing = quality.validateEvidence(
    {
      claims: [
        { id: 'x1', text: '未抓取的来源断言在这里。', type: 'source', ref: 'https://example.com' },
        { id: 'x2', text: '代码行号越界的断言在这里。', type: 'code', ref: 'src/lib/tools.ts:999' },
        { id: 'x3', text: '运行记录不存在的断言在这里。', type: 'run', ref: 'rX' },
      ],
    },
    { ...ctx, verifiedRuns: new Map() },
  );
  const text = missing.errors.join('\n');
  assert.match(text, /来源未实际抓取/);
  assert.match(text, /行号越界/);
  assert.match(text, /运行记录未登记/);
  assert.match(text, /少于 5/);
});

test('槽位选择与幂等锁', () => {
  const config = structuredClone(configMod.DEFAULT_CONFIG);
  assert.equal(state.currentSlot(new Date('2026-11-01T05:00:00Z'), config).slot, '12'); // 13:00 Asia/Shanghai
  assert.equal(state.currentSlot(new Date('2026-11-01T21:30:00Z'), config).slot, '06'); // 次日 05:30 归入首槽
  state.ensureStateDirs();
  const first = state.acquireSlotLock('2099-01-01T06');
  assert.equal(first.ok, true);
  const second = state.acquireSlotLock('2099-01-01T06');
  assert.equal(second.ok, false);
  utimesSync(first.path, new Date(0), new Date(0));
  const third = state.acquireSlotLock('2099-01-01T06');
  assert.equal(third.ok, true);
  rmSync(join(stateDir, 'locks', '2099-01-01T06'), { recursive: true, force: true });
});

test('队列状态机与任务配比', () => {
  const config = structuredClone(configMod.DEFAULT_CONFIG);
  const queue = {
    version: 1,
    items: [
      { id: 'a', type: 'upgrade-guide', status: 'ready', priority: 90, createdAt: '2026-01-01' },
      { id: 'b', type: 'new-guide', status: 'ready', priority: 80, createdAt: '2026-01-02' },
      { id: 'c', type: 'new-guide', status: 'published', priority: 99, createdAt: '2026-01-03' },
    ],
  };
  const picked = state.pickNextItem(queue, config);
  assert.equal(picked.id, 'b'); // 无 in_progress 时优先 taskMix 中占比更高的 new-guide
  const pickedAfter = (() => {
    const next = structuredClone(queue);
    next.items[0].status = 'in_progress';
    return state.pickNextItem(next, config);
  })();
  assert.equal(pickedAfter.id, 'b');
  assert.equal(state.pickNextItem({ version: 1, items: [] }, config), null);
});

test('GSC CSV 解析与候选生成', () => {
  const queriesCsv = '\uFEFF查询,点击次数,展示次数,点击率,平均排名\njson 格式化报错,12,340,3.5%,8.2\nclovertools 首页,30,90,33%,1.1\n';
  const parsed = gsc.parseGscCsv(queriesCsv);
  assert.equal(parsed.kind, 'queries');
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].impressions, 340);
  assert.ok(Math.abs(parsed.rows[0].ctr - 0.035) < 1e-9);
  const pagesCsv = 'Page,Clicks,Impressions,CTR,Position\nhttps://clovertools.cn/tools/dev/json-formatter/,5,200,2.5%,6\n';
  const parsedPages = gsc.parseGscCsv(pagesCsv);
  assert.equal(parsedPages.kind, 'pages');
  assert.equal(parsedPages.rows[0].page, 'https://clovertools.cn/tools/dev/json-formatter/');
  const toolIndex = {
    tools: [{ slug: 'json-formatter', name: 'JSON 格式化与校验', keywords: ['json格式化', 'json校验'] }],
    hrefs: new Map([['json-formatter', '/tools/dev/json-formatter/']]),
  };
  const guides = [{ slug: 'json-formatting-validation', title: 'JSON 格式化与校验', toolSlug: 'json-formatter', text: '' }];
  const candidates = gsc.buildCandidates(parsed.rows.concat(parsedPages.rows), { toolIndex, guides, existingQueue: { items: [] } });
  assert.ok(candidates.length > 0);
  const fromQuery = candidates.find((item) => item.primaryQuery?.includes('json'));
  assert.equal(fromQuery.type, 'upgrade-guide');
  assert.ok(fromQuery.priority > 0);
});

test('auto index 生成器输出显式 import 与类型断言', () => {
  const source = buildAutoIndexSource([
    { name: 'demo-guide.json', slug: 'demo-guide' },
    { name: 'other.json', slug: 'other' },
  ]);
  assert.match(source, /import guide0 from '\.\.\/\.\.\/data\/editorial-guides\/demo-guide\.json' with \{ type: 'json' \};/);
  assert.match(source, /guide0 as unknown as Guide,/);
  assert.match(source, /export const AUTO_GUIDES: Guide\[\] = \[/);
});

test('运行摘要包含状态、篇幅与推送信息', () => {
  const digest = report.formatDigest({
    runKey: '2026-11-01T06',
    status: 'published',
    title: '示例文章',
    slug: 'demo',
    metrics: { cjk: 1800, h2: 6, sources: 3, internalToolLinks: 2, maxSimilarity: 0.12 },
    reviewer: { verdict: 'pass', confidence: 0.82 },
    push: { ok: true, sha: 'abcdef0123456789' },
    deploy: { status: 'pending' },
    steps: [{ name: 'verify', ok: true, durationMs: 1200 }],
  });
  assert.match(digest, /内容流水线/);
  assert.match(digest, /1800 汉字/);
  assert.match(digest, /独立复核：pass/);
  assert.match(digest, /abcdef01/);
});

test('搜索建议聚合、排序与导航词过滤', async () => {
  const suggest = await import('../editorial/lib/suggest.mjs');
  const batches = [
    { seed: 'uuid生成', results: { bing: ['uuid生成规则', 'uuid生成器'], google: ['uuid生成规则'], baidu: [] }, errors: {} },
    { seed: '颜色转换', results: { bing: ['颜色转换器'], google: ['颜色转换原理', '颜色转换器'], baidu: ['颜色转换原理'] }, errors: {} },
  ];
  const aggregated = suggest.aggregateSuggestions(batches);
  const rule = aggregated.find((entry) => entry.text === 'uuid生成规则');
  assert.equal(rule.providers.size, 2);
  assert.equal(rule.bestRank, 1);
  const strong = suggest.suggestionPriority({ providers: new Set(['bing', 'google', 'baidu']), bestRank: 1 }, { informational: true, gap: true });
  const weak = suggest.suggestionPriority({ providers: new Set(['bing']), bestRank: 8 }, { informational: false, gap: false });
  assert.ok(strong > weak);
  const tool = { slug: 'xml-formatter', name: 'XML 格式化与压缩', keywords: ['xml格式化', 'xml压缩'] };
  assert.equal(suggest.looksToolPageQuery('xml格式化在线', tool), true);
  assert.equal(suggest.looksToolPageQuery('XML格式化工具', tool), true);
  assert.equal(suggest.looksToolPageQuery('xml格式化原理', tool), false);
  const clustered = suggest.clusterByTool(
    [
      { toolSlug: 'a', priority: 3, id: '1' },
      { toolSlug: 'a', priority: 2, id: '2' },
      { toolSlug: 'a', priority: 1, id: '3' },
      { toolSlug: 'b', priority: 9, id: '4' },
    ],
    2,
  );
  assert.equal(clustered.kept.length, 3);
  assert.equal(clustered.dropped, 1);
  assert.deepEqual(clustered.kept.map((item) => item.id), ['4', '1', '2']);
});

test('文章意图识别区分导航词与可写成指南的问法', async () => {
  const gscLib = await import('../editorial/lib/gsc.mjs');
  assert.equal(gscLib.looksArticleIntent('uuid 怎么生成'), true);
  assert.equal(gscLib.looksArticleIntent('json 格式化报错怎么解决'), true);
  assert.equal(gscLib.looksArticleIntent('uuid生成算法'), true);
  assert.equal(gscLib.looksArticleIntent('在线工具箱'), false);
});

test.after(() => {
  rmSync(stateDir, { recursive: true, force: true });
});
