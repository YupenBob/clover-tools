// IP 归属地查询文章（slug: ip-lookup）的截图用例。
// 页面：/tools/dev/ip-lookup/；两张图都用 page.route 拦截 /api/ip 与两个 DoH 端点，
// 用 .editorial/drafts/ip-lookup/fixtures/ 下的固定 JSON 返回，避免截图依赖线上归属地服务。
// 时钟固定在 2026-11-11T03:00:00Z（install 在 goto 之前）；把视口临时加高到 2400px，
// 这样 1232×约 2000 的三面板元素截图不会被粘性站点头遮住顶部。
// 截图逻辑由 scripts/editorial/capture-tool.mjs 调用，本文件不自己启动服务器。
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIX_DIR = join(HERE, '..', '..', '..', '.editorial', 'drafts', 'ip-lookup', 'fixtures');
const fixture = (name) => JSON.parse(readFileSync(join(FIX_DIR, name), 'utf8'));

const FIXTURES = {
  self: fixture('api-ip-self.json'),
  google: fixture('api-ip-8.8.8.8.json'),
  cf4: fixture('api-ip-172.66.147.243.json'),
  dohAli: fixture('doh-alidns-example.com.json'),
  dohEmpty: fixture('doh-empty.json'),
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(fn, label, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await fn()) return;
    await sleep(40);
  }
  throw new Error(`等待超时：${label}`);
}

export default async function ({ page, base, shot }) {
  await page.setViewportSize({ width: 1280, height: 2400 });
  await page.clock.install({ time: new Date('2026-11-11T03:00:00Z') });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const fulfill = (body, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (url.pathname === '/api/ip') {
      const ip = url.searchParams.get('ip');
      if (!ip) return fulfill(FIXTURES.self);
      if (ip === '8.8.8.8') return fulfill(FIXTURES.google);
      if (ip === '172.66.147.243') return fulfill(FIXTURES.cf4);
      return fulfill(FIXTURES.self);
    }
    const name = url.searchParams.get('name');
    const known = ['example.com'].includes(name);
    if (url.hostname === 'dns.alidns.com') return fulfill(known ? FIXTURES.dohAli : FIXTURES.dohEmpty);
    if (url.hostname === 'cloudflare-dns.com') return fulfill(FIXTURES.dohEmpty);
    return route.continue();
  });

  await page.goto(`${base}/tools/dev/ip-lookup/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ipInput');
  await waitFor(async () => (await page.locator('#ipSelfValue').innerText()).trim() !== '--', '本机 IP');
  // astro dev 会注入开发工具栏，固定在视口边缘；只记录站点自身 UI。
  await page.addStyleTag({ content: 'astro-dev-toolbar{display:none!important}' });

  const workspace = page.locator('.tool-workspace');

  // 1) 输入 8.8.8.8：本地解析 + 默认 /24 网段 + /api/ip?ip=8.8.8.8 的归属地面板
  await page.fill('#ipInput', '8.8.8.8');
  await page.clock.runFor(1700);
  await waitFor(async () => (await page.locator('#ipGeoStatus').innerText()).includes('查询完成：8.8.8.8'), '8.8.8.8 归属地');
  await shot(workspace, 'parse-and-geo.jpg', {
    alt: '在线 IP 地址查询工具的完整工作区截图，自上而下三个面板。第一个面板标题「本机 IP」，右上角「复制」「刷新」两个按钮，下面「当前网络出口 IP」与 170.9.8.210，小字「San Jose · US · Oracle Corporation · AS31898」，绿色状态条「已获取本机 IP（Cloudflare 边缘）」。第二个面板「IP 地址解析」，输入框内是 8.8.8.8，按钮「解析并查询」「粘贴」「示例」「清空」，提示「地址解析完全在浏览器本地完成；输入有效地址后稍候会自动查询归属地，也可随时点击按钮。」，摘要行徽标「公网 IPv4」加 8.8.8.8；「地址信息」各行：地址类型 IPv4、地址分类 公网 IPv4（0.0.0.0/0）、说明 全球可路由的公网地址、参考标准 IANA 全球单播地址空间、十进制 134744072、十六进制 0x08080808、二进制 00001000.00001000.00001000.00001000、IPv6 映射 ::ffff:8.8.8.8；「网段信息」右侧前缀选择器 /24，行：网段 CIDR 8.8.8.0/24、网络地址 8.8.8.0、广播地址 8.8.8.255、可用范围 8.8.8.1 – 8.8.8.254、地址数量 共 256 个，可用 254 个。第三个面板「归属地信息」，绿色状态条「查询完成：8.8.8.8」，行：国家/地区 美国国旗 United States (US)、大洲 NA、省份/州 California、城市 Mountain View、邮编 94035、时区 America/Los_Angeles、ASN ASAS15169、运营商 Google LLC、经纬度 37.3860, -122.0838；底部左「在地图中查看」，右「数据来源：Cloudflare 边缘」。',
    caption:
      '输入 8.8.8.8 后的完整结果（假时钟 2026-11-11T03:00:00Z）：本地解析给出公网 IPv4、进制与 ::ffff 映射，默认 /24 网段，ASN 一栏是 ASAS15169（代理路径把 ipapi 的 AS15169 又拼了一次 AS）；「本机 IP」与「归属地信息」用固定 fixture 模拟 /api/ip 返回，字段与生产一致。',
    source: '/tools/dev/ip-lookup/',
    purpose: '展示输入 8.8.8.8 后本地解析、默认 /24 网段与归属地面板同屏组合',
  });

  // 2) 输入 example.com：DoH 固定 fixture 返回 2 个 A + 2 个 AAAA，chips、首个 A 的解析与归属地
  await page.fill('#ipInput', 'example.com');
  await page.clock.runFor(600);
  await waitFor(async () => (await page.locator('.ip-chip').count()) === 4, 'example.com chips');
  await waitFor(async () => (await page.locator('#ipGeoStatus').innerText()).includes('查询完成：172.66.147.243'), 'example.com 归属地');
  await shot(workspace, 'domain-and-requests.jpg', {
    alt: '同一工作区的域名查询结果：第一个面板仍是本机 IP 170.9.8.210 与「San Jose · US · Oracle Corporation · AS31898」，绿色状态条「已获取本机 IP（Cloudflare 边缘）」；第二个面板输入框是 example.com，摘要行是徽标「公网 IPv4」、172.66.147.243、灰字「example.com 解析出 4 个地址」，右侧 4 个 chip：172.66.147.243、104.20.23.154、2606:4700:10::ac42:93f3、2606:4700:10::6814:179a；地址信息各行：地址类型 IPv4、地址分类 公网 IPv4（0.0.0.0/0）、说明 全球可路由的公网地址、参考标准 IANA 全球单播地址空间、十进制 2890044403、十六进制 0xac4293f3、二进制 10101100.01000010.10010011.11110011、IPv6 映射 ::ffff:172.66.147.243；网段信息 /24，网段 CIDR 172.66.147.0/24、网络地址 172.66.147.0、广播地址 172.66.147.255、可用范围 172.66.147.1 – 172.66.147.254、地址数量 共 256 个，可用 254 个；第三个面板状态条「查询完成：172.66.147.243」，国家/地区 美国国旗 United States (US)、大洲 NA、省份/州 California、城市 San Francisco、邮编 94107、时区 America/Los_Angeles、ASN ASAS13335、运营商 Cloudflare, Inc.、经纬度 37.7749, -122.4194，底部左「在地图中查看」、右「数据来源：Cloudflare 边缘」。',
    caption:
      '输入 example.com 后的结果（同一假时钟）：DoH fixture 返回 2 个 A 与 2 个 AAAA，摘要行出现 4 个可点击 chip，解析取第一个 A 记录 172.66.147.243，网段与归属地随之更新；域名解析与归属地面板均用固定 fixture 模拟 DoH 与 /api/ip 返回，字段与生产一致。',
    source: '/tools/dev/ip-lookup/',
    purpose: '展示域名经 DoH 解析出的 chips、首个 A 记录的解析与归属地更新',
  });
}
