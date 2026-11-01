#!/usr/bin/env node
/**
 * 播种选题队列：16 篇旧指南升级 + 20 篇零内容工具新指南。
 * 用法：node scripts/editorial/seed-queue.mjs [--reset]
 * 只追加缺失项，不改动已有状态；--reset 清空后重建（危险，仅初始化用）。
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { ensureStateDirs, loadQueue, saveQueue } from './lib/state.mjs';

const UPGRADES = [
  ['jwt-expiry-and-verification', 92, 'JWT 过期与验签：时间、时钟偏移与常见误解'],
  ['qrcode-safe-publishing', 90, '二维码生成与发布：容错率、内容长度与扫码边界'],
  ['unit-conversion-precision', 88, '单位换算精度：浮点误差、四舍五入与有效数字'],
  ['base64-not-encryption', 86, 'Base64 不是加密：编码、体积与错误用法'],
  ['unix-timestamp-seconds-milliseconds', 84, '10 位与 13 位时间戳：秒毫秒、时区与 2038'],
  ['date-difference-rules', 82, '日期差值怎么算：含首尾、闰日与跨时区'],
  ['hash-vs-encryption', 80, '哈希与加密的区别：单向性、盐值与校验场景'],
  ['random-number-fairness', 78, '随机数怎么才算公平：范围、去重与 crypto'],
  ['text-diff-review', 76, '文本对比怎么审：行级/字符级差异与误读'],
  ['bmi-reference-not-diagnosis', 74, 'BMI 怎么看：参考范围、局限与不构成诊断'],
  ['json-formatting-validation', 72, 'JSON 格式化与校验：从报错定位到可读输出'],
  ['json-to-csv-excel', 70, 'JSON 转 CSV：嵌套字段、缺失值与 Excel 前导零'],
  ['url-encoding-guide', 68, 'URL 编码：保留字符、重复参数与常见误用'],
  ['regex-debugging-method', 66, '正则排错方法：锚点、贪婪与回溯'],
  ['cron-expression-basics', 64, 'Cron 表达式入门：五字段、时区与易错点'],
  ['strong-password-practices', 62, '密码强度与做法：长度、复用与保管'],
];

const NEW_GUIDES = [
  ['uuid-generator', 'uuid 怎么生成', 'UUID v4/v7 差异、批量生成与格式校验', 90],
  ['color-convert', 'hex转rgb怎么算', 'HEX/RGB/HSL 互转：透明度、色差与取色边界', 88],
  ['json-xml-yaml', 'json转yaml怎么弄', 'JSON/XML/YAML 互转：字段丢失、类型与换行边界', 86],
  ['text-transform', '驼峰命名怎么转换', '大小写/驼峰/全半角转换规则与常见误用', 84],
  ['jianfan', '简体转繁体怎么转', '简繁转换：一对多、异体字与地区用词', 82],
  ['url-parse', 'url参数怎么解析', 'URL 参数解析：编码、重复键与相对地址', 80],
  ['password-strength', '密码强度怎么判断', '密码强度判断：熵、字典与长度（不作安全承诺）', 78],
  ['symmetric-encrypt', 'aes加密怎么用', 'AES 加密参数：模式、填充、IV 与常见报错', 76],
  ['html-formatter', 'html格式化怎么弄', 'HTML 格式化：标签、实体与不安全内容边界', 74],
  ['css-formatter', 'css格式化工具', 'CSS 格式化与压缩：空白、单位与兼容性边界', 72],
  ['js-formatter', 'javascript格式化', 'JavaScript 格式化：只改空白、不改变语义', 70],
  ['xml-formatter', 'xml格式化工具', 'XML 格式化：CDATA、命名空间与实体', 68],
  ['world-clock', '世界时钟怎么用', '多时区对照：夏令时、IANA 时区与常见错误', 66],
  ['lunar-converter', '公历农历怎么转换', '公历农历互转：闰月、节气与范围限制', 64],
  ['calendar', '万年历怎么看', '在线万年历：节气、假期数据与边界说明', 62],
  ['ip-lookup', 'ip归属地怎么查', 'IP 归属地查询：精度、隐私与请求去向', 60],
  ['timer', '倒计时怎么用', '倒计时/秒表：后台计时、精度与系统休眠', 58],
  ['calculator', '科学计算器怎么用', '科学计算器：浮点误差、角度制与括号规则', 56],
  ['morse', '摩斯密码怎么对照', '摩斯电码：格式、分隔与不支持字符', 54],
  ['ascii-art', 'ascii艺术字怎么生成', 'ASCII 艺术字：字体、宽度与中文限制', 52],
];

const now = new Date().toISOString();

function seedItems() {
  const items = [];
  for (const [slug, priority, angle] of UPGRADES) {
    items.push({
      id: `seed-upgrade-${slug}`,
      type: 'upgrade-guide',
      status: 'ready',
      priority,
      toolSlug: null,
      slug,
      primaryQuery: null,
      angle,
      source: 'audit',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  for (const [toolSlug, primaryQuery, angle, priority] of NEW_GUIDES) {
    items.push({
      id: `seed-new-${toolSlug}`,
      type: 'new-guide',
      status: 'ready',
      priority,
      toolSlug,
      slug: null,
      primaryQuery,
      angle,
      source: 'audit',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  return items;
}

function main() {
  ensureStateDirs();
  const reset = process.argv.includes('--reset');
  const queue = reset ? { version: 1, items: [] } : loadQueue();
  const existing = new Set(queue.items.map((item) => item.id));
  const seeds = seedItems();
  let added = 0;
  for (const item of seeds) {
    if (existing.has(item.id)) continue;
    queue.items.push(item);
    added += 1;
  }
  saveQueue(queue);
  const summary = {
    added,
    total: queue.items.length,
    ready: queue.items.filter((item) => item.status === 'ready').length,
    byType: queue.items.reduce((acc, item) => {
      acc[item.type] = (acc[item.type] ?? 0) + 1;
      return acc;
    }, {}),
  };
  writeFileSync(join(STATE_PATHS.dir, 'queue-seed.log'), `${now} ${JSON.stringify(summary)}\n`, { flag: 'a' });
  console.log(JSON.stringify(summary, null, 2));
}

main();
