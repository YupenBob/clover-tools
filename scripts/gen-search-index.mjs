/**
 * 生成首页搜索索引 public/search-index.json（供首页 loadIndex 使用）。
 * 用法：node scripts/gen-search-index.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';
const { s2t } = (await import('chinese-s2t')).default;

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = readFileSync(join(root, 'src', 'lib', 'tools.ts'), 'utf8');

const ALIASES = {
  'json-formatter': ['json格式化', 'json压缩', 'json校验', '格式化'],
  'json-convert': ['json转csv', 'json转excel', 'csv', '表格'],
  'json-xml-yaml': ['json转xml', 'json转yaml', 'yaml', 'xml转json'],
  'json-codegen': ['json转ts', 'json转java', 'json转go', '实体类'],
  jsonpath: ['jsonpath', 'json查询'],
  diff: ['diff', '对比', '比较'],
  base64: ['base64', '编码'],
  'url-encode': ['urlencode', 'url编码'],
  'html-formatter': ['html格式化', 'html压缩', '实体编码'],
  'css-formatter': ['css格式化', 'css压缩'],
  'js-formatter': ['js格式化', 'javascript', 'js压缩'],
  'sql-formatter': ['sql', 'sql美化'],
  'xml-formatter': ['xml格式化', 'xml压缩'],
  markdown: ['md', 'markdown', 'markdown转html', 'markdown编辑器', '在线编辑器'],
  'regex-tester': ['正则', 'regex', '正则表达式'],
  'text-transform': ['大小写', '驼峰', '全角', '半角', '下划线'],
  'text-toolbox': ['去重', '排序', '空行', '文本处理'],
  jianfan: ['简繁', '繁体', '简体', '繁简'],
  pinyin: ['拼音', 'pinyin', 'piny', '汉字转拼音'],
  timestamp: ['时间戳', 'unix', '毫秒'],
  cron: ['cron', '定时任务', '调度', '表达式'],
  'base-converter': ['进制', '二进制', '十六进制', '八进制'],
  'unicode-converter': ['unicode', 'ascii码', '\\u', '转义'],
  hash: ['md5', 'sha', 'sha1', 'sha256', '哈希', '摘要', '文件哈希'],
  'symmetric-encrypt': ['aes', 'des', 'rc4', 'rabbit', '对称加密', '加密'],
  'rsa-encrypt': ['rsa', '公钥', '私钥', '非对称'],
  bcrypt: ['bcrypt', '密码哈希'],
  'jwt-decoder': ['jwt', 'token', '令牌', '验签'],
  'password-strength': ['密码强度', '强密码', '弱口令'],
  'password-generator': ['密码', '随机密码'],
  'uuid-generator': ['uuid', 'nanoid', 'id生成'],
  qrcode: ['二维码', 'qr', '条形码'],
  'http-tester': ['http', '接口', 'api', '请求'],
  'ip-lookup': ['ip', 'ip地址', '归属地'],
  'ua-parser': ['ua', 'user-agent'],
  'url-parse': ['url解析', '链接', '参数'],
  'color-convert': ['颜色', 'hex', 'rgb', 'hsl', '取色'],
  'image-to-base64': ['图片base64', 'img2base64'],
  calendar: ['日历', '万年历', '节假日', '节气'],
  'lunar-converter': ['农历', '公历', '阴历'],
  'world-clock': ['世界时钟', '时区', '时钟'],
  'date-diff': ['日期', '间隔', '天数'],
  workday: ['工作日', '考勤'],
  'age-calculator': ['年龄', '周岁'],
  timer: ['倒计时', '秒表', '计时', '专注'],
  bmi: ['bmi', '体重指数', '体重'],
  salary: ['工资', '五险一金', '税后', '个税'],
  finance: ['贷款', '复利', '理财', '百分比'],
  calculator: ['计算器', '数学', '科学计算'],
  'unit-converter': ['单位换算', '换算', '温度', '存储'],
  'rmb-uppercase': ['人民币大写', '金额', '大写'],
  fuel: ['油耗', '百公里'],
  expiry: ['保质期', '到期'],
  'keyboard-test': ['键盘', '按键', '键盘测试'],
  'grid-splitter': ['九宫格', '切图', '朋友圈'],
  'sensitive-check': ['敏感词', '审核'],
  zodiac: ['生肖', '星座', '五行'],
  'ascii-art': ['ascii', '艺术字', '字符画'],
  'click-speed': ['手速', '点击', 'apm'],
  'reaction-test': ['反应', '反应力'],
  lottery: ['抽奖', '摇号', '转盘'],
  'meme-generator': ['表情包', 'meme'],
  'nickname-text': ['火星文', '花字', '昵称', '网名', '个性签名'],
  'random-number': ['随机数', '抽签', '随机'],
  'palette-generator': ['色板', '配色', '色卡'],
  'browser-info': ['浏览器信息', '设备信息'],
  'image-filter': ['滤镜', '照片'],
  morse: ['摩斯', 'morse', '电码'],
};

function pyOf(text) {
  return pinyin(text, { toneType: 'none', type: 'array' })
    .join('')
    .toLowerCase()
    .replace(/[\s\u3000，。、！？；：（）【】""''·\-—_]/g, '');
}

function initialsOf(text) {
  return pinyin(text, { toneType: 'none', pattern: 'first', type: 'array' })
    .join('')
    .toLowerCase()
    .replace(/[\s\u3000，。、！？；：（）【】""''·\-—_]/g, '');
}

const categories = { dev: '开发实用', daily: '日常实用', fun: '趣味工具' };
const entries = [];
const slugByCategory = {};

for (const [catKey] of Object.entries(categories)) {
  const section = manifest.split(`${catKey}: [`)[1].split(/\n  (?:dev|daily|fun): \[/)[0];
  const blocks = section.split('\n    {');
  slugByCategory[catKey] = [];
  for (const block of blocks) {
    const slug = block.match(/slug: '([^']+)'/)?.[1];
    const name = block.match(/name: '([^']+)'/)?.[1];
    const oneLiner = block.match(/oneLiner: '([^']+)'/)?.[1];
    const description = block.match(/description: '([^']+)'/)?.[1];
    const keywords = [...(block.match(/keywords: \[([^\]]*)\]/)?.[1] || '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
    if (!slug) continue;
    slugByCategory[catKey].push(slug);
    const text = `${name || ''} ${oneLiner || ''} ${description || ''} ${keywords.join(' ')}`;
    entries.push({
      slug,
      text,
      py: pyOf(text),
      initials: initialsOf(text),
      aliases: ALIASES[slug] || [],
      built: true,
    });
  }
}

mkdirSync(join(root, 'public'), { recursive: true });
writeFileSync(join(root, 'public', 'search-index.json'), JSON.stringify(entries), 'utf8');
console.log(`已生成 search-index.json（${entries.length} 条）`);

// ── 英文 / 韩语 / 日语搜索索引：从 src/lib/i18n/{lang}.json 生成 public/{lang}/search-index.json ──
function genLangEntries(langData) {
  const langEntries = [];
  for (const [, slugs] of Object.entries(slugByCategory)) {
    for (const slug of slugs) {
      const t = langData.tools?.[slug];
      if (!t) continue;
      const text = `${t.name || ''} ${t.oneLiner || ''} ${t.description || ''} ${(t.keywords || []).join(' ')}`;
      const py = text.toLowerCase().replace(/[^a-z0-9]+/g, '');
      const initials = text
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => w[0]?.toLowerCase() || '')
        .join('');
      langEntries.push({
        slug,
        text,
        py,
        initials,
        aliases: t.keywords || [],
        built: true,
      });
    }
  }
  return langEntries;
}

for (const lang of ['en', 'ko', 'ja']) {
  const langData = JSON.parse(readFileSync(join(root, 'src', 'lib', 'i18n', lang + '.json'), 'utf8'));
  const langEntries = genLangEntries(langData);
  mkdirSync(join(root, 'public', lang), { recursive: true });
  writeFileSync(join(root, 'public', lang, 'search-index.json'), JSON.stringify(langEntries), 'utf8');
  console.log(`已生成 ${lang}/search-index.json（${langEntries.length} 条）`);
}

// ── 繁体搜索索引：由中文条目简转繁生成 public/zh-hant/search-index.json ──
const twEntries = entries.map((e) => {
  const text = s2t(e.text);
  return {
    ...e,
    text,
    py: pyOf(text),
    initials: initialsOf(text),
    aliases: (e.aliases || []).map((a) => s2t(a)),
  };
});
mkdirSync(join(root, 'public', 'zh-hant'), { recursive: true });
writeFileSync(join(root, 'public', 'zh-hant', 'search-index.json'), JSON.stringify(twEntries), 'utf8');
console.log(`已生成 zh-hant/search-index.json（${twEntries.length} 条）`);
