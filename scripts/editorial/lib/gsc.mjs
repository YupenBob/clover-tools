/** Search Console 导出解析与选题候选生成。 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** 通用 CSV 解析（支持引号、逗号转义、CRLF、BOM）。 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = String(text ?? '').replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field);
      if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (char === '\r') continue;
    field += char;
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim() !== '')) rows.push(row);
  return rows;
}

const HEADER_ALIASES = {
  query: ['query', 'top queries', '查询', '搜索查询', '热门查询'],
  page: ['page', 'top pages', '网页', '页面', '热门网页', '网址', 'landing page'],
  clicks: ['clicks', '点击次数', '点击'],
  impressions: ['impressions', '展示次数', '展示'],
  ctr: ['ctr', '点击率'],
  position: ['position', '平均排名', '排名'],
};

function normalizeCell(cell) {
  return String(cell ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function detectHeader(row) {
  const cells = row.map(normalizeCell);
  const columns = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const index = cells.findIndex((cell) => aliases.includes(cell));
    if (index >= 0) columns[key] = index;
  }
  return columns.query !== undefined || columns.page !== undefined ? columns : null;
}

function numberCell(value) {
  const cleaned = String(value ?? '').replace(/[%\s,]/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

/** 解析单个 GSC CSV；返回 { kind, rows }，kind 为 queries / pages / unknown。 */
export function parseGscCsv(text) {
  const table = parseCsv(text);
  for (let index = 0; index < Math.min(table.length, 6); index += 1) {
    const columns = detectHeader(table[index]);
    if (!columns) continue;
    const kind = columns.page !== undefined && columns.query === undefined ? 'pages' : 'queries';
    const rows = [];
    for (const raw of table.slice(index + 1)) {
      const get = (key) => (columns[key] === undefined ? undefined : raw[columns[key]]);
      const ctr = numberCell(get('ctr'));
      rows.push({
        kind,
        query: (get('query') ?? '').trim(),
        page: (get('page') ?? '').trim(),
        clicks: numberCell(get('clicks')),
        impressions: numberCell(get('impressions')),
        ctr: ctr > 1 ? ctr / 100 : ctr,
        position: numberCell(get('position')),
      });
    }
    return { kind, rows };
  }
  return { kind: 'unknown', rows: [] };
}

export function readGscDir(dir) {
  if (!existsSync(dir)) return { rows: [], files: [] };
  const files = readdirSync(dir).filter((name) => /\.csv$/i.test(name));
  const rows = [];
  for (const name of files) {
    const text = readFileSync(join(dir, name), 'utf8');
    const parsed = parseGscCsv(text);
    for (const row of parsed.rows) rows.push({ ...row, file: name });
  }
  return { rows, files };
}

const BRAND_PATTERN = /clovertools|clover工具|四叶草工具/i;

export function looksBranded(query) {
  return BRAND_PATTERN.test(String(query ?? ''));
}

const INFORMATIONAL_PATTERN =
  /(怎么|如何|为什么|为何|报错|错误|失败|无法|不能|区别|对比|教程|用法|使用|是什么|哪些|多久|多少|格式|转换|校验|安全|注意|规范|原理|解决|排查|问题|技巧|指南|方法|规则|算法|机制|结构|组成|长度|几位|多少位|重复|唯一|冲突|碰撞|性能|速度|限制|边界|场景|示例|例子|兼容|浏览器|java|python|javascript|node\.js|go 语言|typescript)/i;

/** 文章意图：可支撑一篇指南的问法（比纯导航词更具体）。 */
export function looksArticleIntent(query) {
  const text = String(query ?? '');
  if (INFORMATIONAL_PATTERN.test(text)) return true;
  return /(怎么|如何|为什么|为何|区别|对比|原理|规则|算法|格式|校验|边界|注意|安全)/.test(text);
}

export function looksInformational(query) {
  return INFORMATIONAL_PATTERN.test(String(query ?? ''));
}

/** 排名权重：4–20 名最有优化空间。 */
export function positionWeight(position) {
  const rank = Number(position);
  if (!Number.isFinite(rank) || rank <= 0) return 0.6;
  if (rank <= 3) return 0.4;
  if (rank <= 10) return 1;
  if (rank <= 20) return 0.9;
  if (rank <= 40) return 0.5;
  return 0.2;
}

export function scoreGscRow(row) {
  const impressions = Math.max(0, Number(row.impressions) || 0);
  const ctr = Math.max(0, Math.min(1, Number(row.ctr) || 0));
  return Number((impressions * (1 - ctr) * positionWeight(row.position)).toFixed(2));
}

function normalizeQuery(query) {
  return String(query ?? '').toLowerCase().replace(/\s+/g, '');
}

/** 把查询映射到工具：关键词命中打分。 */
export function matchQueryToTool(query, tools) {
  const target = normalizeQuery(query);
  let best = { tool: null, score: 0 };
  for (const tool of tools ?? []) {
    let score = 0;
    const name = normalizeQuery(tool.name);
    if (name && target.includes(name)) score += 6;
    for (const keyword of tool.keywords ?? []) {
      const key = normalizeQuery(keyword);
      if (!key) continue;
      if (target.includes(key)) score += Math.min(6, 1 + key.length / 2);
    }
    const slugParts = String(tool.slug ?? '').split('-').filter((part) => part.length > 2 && !/^\d+$/.test(part));
    for (const part of slugParts) if (target.includes(part)) score += 0.5;
    if (score > best.score) best = { tool, score: Number(score.toFixed(2)) };
  }
  return best;
}

/** 从 GSC 页面 URL 解析出工具或指南目标。 */
export function matchPageTarget(pageUrl) {
  let path;
  try {
    path = new URL(pageUrl, 'https://clovertools.cn').pathname;
  } catch {
    return null;
  }
  const normalized = path.endsWith('/') ? path : `${path}/`;
  if (normalized.startsWith('/guides/')) {
    const slug = normalized.split('/')[2];
    return { kind: 'guide', slug };
  }
  if (normalized.startsWith('/tools/')) {
    return { kind: 'tool', href: normalized };
  }
  return null;
}

/**
 * 生成队列候选。
 * @returns {Array} 候选数组（status: candidate）
 */
export function buildCandidates(rows, { toolIndex, guides, existingQueue, intentMatcher = looksInformational, priorityResolver = null }) {
  const now = new Date().toISOString();
  const guideBySlug = new Map((guides ?? []).map((guide) => [guide.slug, guide]));
  const guidesByTool = new Map();
  for (const guide of guides ?? []) {
    const list = guidesByTool.get(guide.toolSlug) ?? [];
    list.push(guide);
    guidesByTool.set(guide.toolSlug, list);
  }
  const toolByHref = new Map();
  for (const tool of toolIndex.tools) toolByHref.set(toolIndex.hrefs.get(tool.slug), tool);

  const merged = new Map();
  const existingKeys = new Set((existingQueue?.items ?? []).map((item) => `${item.type}:${item.toolSlug ?? ''}:${item.primaryQuery ?? ''}`));

  for (const row of rows) {
    if (row.kind === 'queries') {
      const query = row.query;
      if (!query || query.length > 60 || looksBranded(query)) continue;
      const match = matchQueryToTool(query, toolIndex.tools);
      if (!match.tool || match.score < 2) continue;
      const informational = intentMatcher(query);
      if (!informational) continue;
      const toolGuides = guidesByTool.get(match.tool.slug) ?? [];
      const type = toolGuides.length > 0 ? 'upgrade-guide' : 'new-guide';
      const slug = type === 'upgrade-guide' ? toolGuides[0].slug : undefined;
      const key = `queries:${query}`;
      const existing = merged.get(key) ?? {
        id: `gsc-q-${normalizeQuery(query).slice(0, 40)}`,
        type,
        status: 'candidate',
        priority: 0,
        toolSlug: match.tool.slug,
        slug,
        primaryQuery: query,
        angle: type === 'upgrade-guide' ? '现有页面承接该查询，优先扩写提升' : '覆盖零内容工具的查询缺口',
        source: 'gsc',
        score: 0,
        evidence: { rows: [] },
        createdAt: now,
        updatedAt: now,
      };
      existing.priority = Math.max(existing.priority, priorityResolver ? priorityResolver(row) : scoreGscRow(row));
      existing.score = existing.priority;
      existing.evidence.rows.push({ query, clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position, file: row.file });
      merged.set(key, existing);
      continue;
    }
    if (row.kind === 'pages' && row.page) {
      const target = matchPageTarget(row.page);
      if (!target) continue;
      if (target.kind === 'guide') {
        const guide = guideBySlug.get(target.slug);
        if (!guide) continue;
        const key = `pages:${guide.slug}`;
        const existing = merged.get(key) ?? {
          id: `gsc-p-${guide.slug}`,
          type: 'upgrade-guide',
          status: 'candidate',
          priority: 0,
          toolSlug: guide.toolSlug,
          slug: guide.slug,
          primaryQuery: row.query || guide.title,
          angle: '已有页面有曝光，扩写与补证据提升点击',
          source: 'gsc',
          score: 0,
          evidence: { rows: [] },
          createdAt: now,
          updatedAt: now,
        };
        existing.priority = Math.max(existing.priority, priorityResolver ? priorityResolver(row) : scoreGscRow(row));
        existing.score = existing.priority;
        existing.evidence.rows.push({ page: row.page, clicks: row.clicks, impressions: row.impressions, position: row.position, file: row.file });
        merged.set(key, existing);
      } else {
        const tool = toolByHref.get(target.href);
        if (!tool) continue;
        const toolGuides = guidesByTool.get(tool.slug) ?? [];
        const type = toolGuides.length > 0 ? 'upgrade-guide' : 'new-guide';
        const key = `pages:${tool.slug}`;
        const existing = merged.get(key) ?? {
          id: `gsc-t-${tool.slug}`,
          type,
          status: 'candidate',
          priority: 0,
          toolSlug: tool.slug,
          slug: type === 'upgrade-guide' ? toolGuides[0].slug : undefined,
          primaryQuery: row.query || tool.name,
          angle: '工具页有曝光，判断是否需要指南承接信息型查询',
          source: 'gsc',
          score: 0,
          evidence: { rows: [] },
          createdAt: now,
          updatedAt: now,
        };
        existing.priority = Math.max(existing.priority, priorityResolver ? priorityResolver(row) : scoreGscRow(row));
        existing.score = existing.priority;
        existing.evidence.rows.push({ page: row.page, clicks: row.clicks, impressions: row.impressions, position: row.position, file: row.file });
        merged.set(key, existing);
      }
    }
  }

  const candidates = [...merged.values()].filter((item) => item.priority > 0);
  for (const candidate of candidates) {
    candidate.priority = Math.round(Math.min(1000, candidate.priority));
    candidate.duplicate = existingKeys.has(`${candidate.type}:${candidate.toolSlug ?? ''}:${candidate.primaryQuery ?? ''}`);
  }
  return candidates.sort((a, b) => b.priority - a.priority);
}
