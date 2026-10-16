/** CloverTools article companion. Run: node http-repro.mjs, then open http://127.0.0.1:8765 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HTTP 报错 · 本地复现</title>
<style>body{margin:0;background:#f4f2ec;color:#263c32;font:16px/1.8 system-ui,sans-serif}main{max-width:920px;margin:48px auto;padding:32px}small{letter-spacing:.12em;color:#637467}h1{font-size:34px;margin:10px 0}p{color:#54645a}nav{display:flex;gap:10px;flex-wrap:wrap;margin:28px 0}button{font:inherit;padding:10px 18px;border:1px solid #afbfaf;border-radius:8px;background:white;color:inherit;cursor:pointer}button:focus{outline:3px solid #d6b263}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:24px;background:#1d2d26;color:#eef5e8;border-radius:12px;min-height:230px}a{color:inherit}</style>
<main><small>CLOVERTOOLS / 可重复的本地样例</small><h1>HTTP 报错，先看实际响应</h1><p>两个服务均运行在你的电脑上。8766 端口故意不返回 CORS 许可；另两个接口分别返回 HTML 和 429。这里的错误来自浏览器实际请求。</p>
<nav><button id="cors">跨源请求：未允许 CORS</button><button id="html">把 HTML 当作 JSON 读取</button><button id="rate">读取 429 与 Retry-After</button></nav><pre id="out" aria-live="polite">选择一种情形进行复现。</pre><p>示例无须 API 密钥。结束时在终端按 Ctrl+C 关闭两个服务。</p></main>
<script>
const out = document.getElementById('out');
document.getElementById('cors').onclick = async () => {
  out.textContent = 'GET http://127.0.0.1:8766/data\\n';
  try { await fetch('http://127.0.0.1:8766/data'); }
  catch (error) { out.textContent += error.name + ': ' + error.message + '\\n\\n服务器实际返回 200，但未允许此来源。\\n浏览器脚本无法读取状态码、响应头或响应体。\\n请在开发者工具 Console / Network 中核对 CORS 提示。'; }
};
document.getElementById('html').onclick = async () => {
  const response = await fetch('/api/profile');
  const text = await response.text();
  out.textContent = 'GET /api/profile\\nHTTP ' + response.status + '\\nContent-Type: ' + response.headers.get('content-type') + '\\n\\n原始响应：\\n' + text;
  try { JSON.parse(text); }
  catch (error) { out.textContent += '\\n\\n解析结果：\\n' + error.name + ': ' + error.message; }
};
document.getElementById('rate').onclick = async () => {
  const response = await fetch('/api/rate');
  out.textContent = 'GET /api/rate\\nHTTP ' + response.status + '\\nRetry-After: ' + response.headers.get('retry-after') + '\\nContent-Type: ' + response.headers.get('content-type') + '\\n\\n' + await response.text() + '\\n\\nfetch 已取得响应，没有因为 429 自动抛出异常。\\n这次请求应等待至少 3 秒后再决定是否重试。';
};
</script></html>`;

export async function startRepro() {
  const crossOrigin = createServer((_request, response) => {
    response.setHeader('Content-Type', 'application/json');
    response.end('{"ok":true}'); // Intentionally no Access-Control-Allow-Origin.
  });
  const main = createServer((request, response) => {
    if (request.url === '/api/profile') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end('<!doctype html>\n<html><title>Sign in</title><p>Please sign in.</p></html>');
    } else if (request.url === '/api/rate') {
      response.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '3' });
      response.end('{"error":"rate_limited","message":"wait before retrying"}');
    } else if (request.url === '/') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(html);
    } else {
      response.writeHead(404); response.end('Not found');
    }
  });
  await new Promise((resolve, reject) => crossOrigin.once('error', reject).listen(8766, '127.0.0.1', resolve));
  try {
    await new Promise((resolve, reject) => main.once('error', reject).listen(8765, '127.0.0.1', resolve));
  } catch (error) { crossOrigin.close(); throw error; }
  return { main, crossOrigin, close: () => Promise.all([main, crossOrigin].map(server => new Promise(resolve => server.close(resolve)))) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startRepro();
  console.log('Open http://127.0.0.1:8765 — Ctrl+C to stop.');
}
