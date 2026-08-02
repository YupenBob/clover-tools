#!/usr/bin/env node
/**
 * GitHub Proxy for Vercel
 * Deploy to Vercel as api/index.js or api/github-proxy/index.js
 * Then configure git: git config url."https://[your-vercel-app].vercel.app/".insteadOf https://github.com/
 * 
 * Environment: GITHUB_TOKEN
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const ALLOWED_HOSTS = ['github.com'];

function parseGitUrl(pathname) {
  // pathname: /{owner}/{repo}/git-upload-pack or /{owner}/{repo}/info/refs?service=git-upload-pack
  const match = pathname.match(/^\/([^\/]+)\/([^\/]+)(\/.*)?$/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], path: match[3] || '' };
}

async function proxyGit(req, res, token) {
  const url = new URL(req.url, 'https://placeholder');
  const pathname = url.pathname.replace(/^\//, ''); // remove leading /
  
  // Build target GitHub URL
  const targetPath = pathname + url.search;
  const targetUrl = `https://github.com/${targetPath}`;
  
  const headers = {
    'User-Agent': 'git/2.0',
    'Accept': '*/*',
    'Authorization': `Bearer ${token}`,
  };

  try {
    let body;
    if (req.body) {
      body = Buffer.from(req.body, 'base64');
    }
    
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      ...(body ? { body } : {}),
    });

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const data = await response.arrayBuffer();
    
    res.status(response.status);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(Buffer.from(data));
  } catch (err) {
    res.status(502).json({ error: 'Proxy error: ' + err.message });
  }
}

async function proxyApi(req, res, token) {
  const url = new URL(req.url, 'https://placeholder');
  let path = url.searchParams.get('path') || '/';
  if (path.startsWith('/')) path = path.slice(1);
  const targetUrl = `https://api.github.com/${path}`;
  
  try {
    const response = await fetch(targetUrl, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'CloverTools-Proxy/1.0',
        ...(req.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(req.method === 'POST' && req.body ? { body: JSON.stringify(req.body) } : {}),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}

module.exports = async (req, res) => {
  const token = GITHUB_TOKEN || req.headers.authorization?.replace('Bearer ', '') || '';
  
  if (!token) {
    return res.status(401).json({ error: 'No GitHub token configured' });
  }

  const url = new URL(req.url, 'https://placeholder');
  const pathname = url.pathname;

  // Route: /api/github-proxy?path=... (GET/POST for GitHub API)
  if (pathname.startsWith('/api/') || pathname === '/api') {
    return proxyApi(req, res, token);
  }
  
  // Route: /* (git protocol proxy)
  return proxyGit(req, res, token);
};
