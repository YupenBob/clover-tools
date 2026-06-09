#!/usr/bin/env node
// GitHub API proxy via Vercel - deploy this as Vercel serverless function
// Then configure: git config url.https://github-proxy.vercel.app/.insteadOf https://github.com
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
module.exports = async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  // Strip /{owner}/{repo} prefix - this proxy is mounted at /{owner}/{repo} via vercel.json
  const pathname = url.pathname;
  // Route: /{owner}/{repo}/info/refs?service=git-upload-pack → github API
  try {
    const targetUrl = `https://github.com${pathname}${url.search}`;
    const headers = {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'User-Agent': 'Git-Client/2.0',
      'Accept': '*/*',
    };
    if (req.method === 'POST') {
      const body = Buffer.from(req.body || '', 'base64');
      const r = await fetch(targetUrl, { method: 'POST', headers, body });
      const data = await r.arrayBuffer();
      res.status(r.status).set({
        'Content-Type': r.headers.get('content-type') || 'application/x-git-upload-pack-result',
        'Cache-Control': 'no-cache',
      }).send(Buffer.from(data));
    } else {
      const r = await fetch(targetUrl, { method: 'GET', headers });
      const contentType = r.headers.get('content-type') || 'application/x-git-upload-pack-advertisement';
      const data = await r.arrayBuffer();
      res.status(r.status).set({
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      }).send(Buffer.from(data));
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
