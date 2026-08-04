// 诊断脚本：查看指定素材的 legacy 正文结构与推广痕迹（开发用，不参与发布管线）
import fs from 'node:fs';
import path from 'node:path';

const links = JSON.parse(fs.readFileSync('csdn/tool-links.json', 'utf-8')).articles;
const dir = 'legacy/article_contents';
const files = fs.readdirSync(dir);
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, '');
const legacySet = new Map(files.map((f) => [norm(f.replace(/\.html$/, '')), f]));

for (const item of links) {
  const lf = legacySet.get(norm(item.slug));
  if (!lf) {
    console.log(`\n===== ${item.slug} | LEGACY MISSING =====`);
    continue;
  }
  const html = fs.readFileSync(path.join(dir, lf), 'utf-8');
  const isFull = /<html|<body/i.test(html);
  const clover = (html.match(/CloverTools|clovertools/gi) || []).length;
  const h2 = html.indexOf('<h2');
  const body = isFull ? html.slice(Math.max(0, h2), html.length) : html;
  const clean = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const head = clean(body.slice(0, 400));
  const tail = clean(body.slice(-600));
  const promo = /CloverTools|在线工具|访问|更多|推荐|免费/.test(body);
  console.log(`\n===== ${item.slug} | ${lf} | ${isFull ? 'FULL' : 'FRAG'} | ${html.length}B | CloverTools x${clover} =====`);
  console.log(`HEAD: ${head.slice(0, 180)}`);
  console.log(`TAIL: ${tail.slice(-240)}`);
  if (promo) console.log('PROMO-FLAG: 正文含在线工具/访问/推荐等痕迹');
}
