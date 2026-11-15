import { join } from 'node:path';
import { TEMPLATES_DIR } from './paths.mjs';
import { expandPattern, readText } from './util.mjs';

function template(name) {
  const text = readText(join(TEMPLATES_DIR, `${name}.md`), '');
  if (!text.trim()) throw new Error(`missing prompt template: ${name}.md`);
  return text;
}

export function render(name, vars) {
  return template(name).replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key) => {
    if (!(key in vars)) throw new Error(`prompt template ${name}.md missing variable ${key}`);
    return String(vars[key]);
  });
}

export function commonVars({ item, config, base }) {
  const vars = { cat: item.category, slug: item.slug, tool: item.slug };
  const apiFile = item.apiFile ?? `functions/api/${item.slug}.ts`;
  const apiPath = item.apiPath ?? `/api/${item.slug}`;
  const expand = (patterns) =>
    (patterns ?? [])
      .map((pattern) => {
        try {
          return expandPattern(pattern, vars);
        } catch {
          return pattern;
        }
      })
      .join('\n');
  return {
    TOOL_JSON: JSON.stringify(item, null, 2),
    SLUG: item.slug,
    CATEGORY: item.category,
    TITLE: item.title ?? item.slug,
    SCOPE: item.scope ?? 'medium',
    RUN_KEY: item.__runKey ?? '',
    BASE_SHA: base,
    ALLOWED_PATHS: expand(config.diff.allowed),
    FORBIDDEN_PATHS: expand(config.diff.forbidden),
    PUBLISH_MODE: config.publishMode,
    API_FILE: apiFile,
    API_PATH: apiPath,
  };
}

export function architectPrompt({ item, config, base }) {
  return render('architect', {
    ...commonVars({ item, config, base }),
    NETWORK_RULES: item.network ? networkRules(item) : '本工具不新增网络请求。',
  });
}

export function builderPrompt({ item, config, base, spec }) {
  return render('builder', {
    ...commonVars({ item, config, base }),
    SPEC: spec,
    NETWORK_RULES: item.network ? networkRules(item) : '本工具不新增网络请求。',
  });
}

export function repairPrompt({ item, config, base, spec, failure, kind }) {
  return render('repair', {
    ...commonVars({ item, config, base }),
    SPEC: spec,
    FAILURE: failure,
    REPAIR_KIND: kind,
    NETWORK_RULES: item.network ? networkRules(item) : '本工具不新增网络请求。',
  });
}

export function verifierPrompt({ item, config, base, spec, gatesSummary }) {
  return render('verifier', {
    ...commonVars({ item, config, base }),
    SPEC: spec,
    GATES_SUMMARY: gatesSummary,
    NETWORK_RULES: item.network ? networkRules(item) : '本工具不新增网络请求。',
  });
}

export function networkRules(item) {
  return `网络工具强制契约（slug：${item.slug}）：
- 服务端代码只放 ${item.apiFile ?? `functions/api/${item.slug}.ts`}，纯逻辑放 functions/lib/*.ts；前端只调 ${item.apiPath ?? `/api/${item.slug}`}。
- 不允许任意 URL 代理；服务可达性类工具只允许固定 host 白名单，禁止 localhost/私网/链路本地/元数据地址/非 http(s)。
- 超时 <=5s，响应体 <=256KB，重定向 <=2 次，失败返回结构化错误；上游结果缓存 15-60s。
- 密钥只从 context.env 读取，禁止出现在客户端、响应、日志或仓库。
- 页面必须说明请求由谁发起、是否记录 IP、无密钥/上游失败时如何降级。
- 不得写“会不会封号”“保证安全”等结论；只写测量结果、时间与来源。
- 本地 astro preview 不运行 Pages Functions；浏览器用例必须用 page.route('**${item.apiPath ?? '/api/' + item.slug}', …) mock 成功/失败/超时并断言降级，真实 API 由生产 --verify 检查。`;
}

const REQUIRED_SECTIONS = [
  ['用户与场景', ['用户与场景', 'user', 'scenario']],
  ['核心功能', ['核心功能', 'feature']],
  ['边界与错误', ['边界与错误', 'edge case', 'error']],
  ['文件清单', ['文件清单', 'file list', 'files']],
  ['测试计划', ['测试计划', 'test plan', 'tests']],
  ['验收标准', ['验收标准', 'acceptance']],
  ['i18n', ['i18n', '国际化', 'language']],
  ['SEO', ['seo']],
];

export function lintSpec(text, item) {
  const issues = [];
  const source = String(text ?? '');
  if (source.trim().length < 1200) issues.push('spec 太短（<1200 字符）');
  const lower = source.toLowerCase();
  for (const [label, needles] of REQUIRED_SECTIONS) {
    if (!needles.some((needle) => lower.includes(needle.toLowerCase()))) {
      issues.push(`spec 缺少章节：${label}`);
    }
  }
  if (item.network) {
    const security = ['隐私与安全', 'privacy', 'security', 'ssrf', 'allowlist'];
    if (!security.some((needle) => lower.includes(needle))) {
      issues.push('网络工具 spec 缺少隐私与安全章节');
    }
  }
  if (/^\s*(?:TODO|TBD|FIXME)\b/m.test(source)) {
    issues.push('spec 含 TODO/TBD/FIXME 占位行');
  }
  return { ok: issues.length === 0, issues };
}

export function parseVerifierJson(text) {
  const raw = String(text ?? '').trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const candidate = fenced ? fenced[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return {
      verdict: 'fail',
      confidence: 0,
      blockingIssues: ['verifier 未返回 JSON'],
      nonBlocking: [],
      rubric: {},
      raw,
    };
  }
  try {
    const parsed = JSON.parse(candidate.slice(start, end + 1));
    const blockingIssues = Array.isArray(parsed.blockingIssues)
      ? parsed.blockingIssues.map(String)
      : [];
    const rubric = parsed.rubric && typeof parsed.rubric === 'object' ? parsed.rubric : {};
    const lowRubric = Object.entries(rubric).filter(
      ([, value]) => typeof value === 'number' && value < 0.6,
    );
    if (lowRubric.length) {
      blockingIssues.push(
        `rubric 低于 0.6：${lowRubric.map(([key, value]) => `${key}=${value}`).join(', ')}`,
      );
    }
    const confidence = Number(parsed.confidence ?? 0);
    const verdict =
      parsed.verdict === 'pass' && blockingIssues.length === 0 && confidence >= 0.8
        ? 'pass'
        : 'fail';
    return {
      verdict,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      blockingIssues,
      nonBlocking: Array.isArray(parsed.nonBlocking) ? parsed.nonBlocking.map(String) : [],
      rubric,
      notes: parsed.notes ?? '',
      raw,
    };
  } catch (error) {
    return {
      verdict: 'fail',
      confidence: 0,
      blockingIssues: [`verifier JSON 解析失败：${error.message}`],
      nonBlocking: [],
      rubric: {},
      raw,
    };
  }
}

export const VERIFIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'confidence', 'blockingIssues', 'nonBlocking', 'rubric'],
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fail'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    blockingIssues: { type: 'array', items: { type: 'string' } },
    nonBlocking: { type: 'array', items: { type: 'string' } },
    rubric: {
      type: 'object',
      additionalProperties: { type: 'number', minimum: 0, maximum: 1 },
    },
    notes: { type: 'string' },
  },
};
