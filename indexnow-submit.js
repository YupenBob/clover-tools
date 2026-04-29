#!/usr/bin/env node
/**
 * IndexNow URL Submitter for CloverTools
 * Submits new/updated URLs to Bing's IndexNow API for fast indexing
 * 
 * Usage: node indexnow-submit.js <url1> [url2] [url3] ...
 *   or: node indexnow-submit.js --all   (submit all blog + tool URLs)
 *   or: node indexnow-submit.js --recent (submit recent blog posts only)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE = '/home/yock/clover-tools-v2';
const KEY_FILE = path.join(BASE, 'indexnow-key.txt');
const KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();
const SITE = 'https://tools.xsanye.cn';

// IndexNow endpoints (Bing supports this)
const ENDPOINTS = [
  'https://www.bing.com/indexnow',
  'https://search.msn.com/IndexNow'  // MSN also uses IndexNow
];

function submitToIndexNow(urls) {
  const payload = JSON.stringify({
    host: 'tools.xsanye.cn',
    key: KEY,
    urlList: urls
  });

  const promises = ENDPOINTS.map(endpoint => {
    return new Promise((resolve) => {
      const urlObj = new URL(endpoint);
      const options = {
        hostname: urlObj.hostname,
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          resolve({ endpoint, status: res.statusCode, data: data.slice(0, 100) });
        });
      });
      req.on('error', (e) => resolve({ endpoint, error: e.message }));
      req.write(payload);
      req.end();
    });
  });

  return Promise.all(promises);
}

function getAllBlogUrls() {
  const { execSync } = require('child_process');
  try {
    const files = execSync('ls dist/blog/*.html 2>/dev/null | grep -v index', { cwd: BASE, encoding: 'utf8' });
    return files.trim().split('\n').map(f => {
      const slug = path.basename(f, '.html');
      return `${SITE}/blog/${encodeURIComponent(slug)}`;
    });
  } catch(e) { return []; }
}

function getToolUrls() {
  const { execSync } = require('child_process');
  try {
    const files = execSync('ls dist/tools/*.html 2>/dev/null', { cwd: BASE, encoding: 'utf8' });
    return files.trim().split('\n').map(f => {
      return `${SITE}/tools/${path.basename(f)}`;
    });
  } catch(e) { return []; }
}

// CLI
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node indexnow-submit.js <url1> [url2] ...');
  console.log('       node indexnow-submit.js --all');
  console.log('       node indexnow-submit.js --recent');
  process.exit(1);
}

let urls = [];

if (args[0] === '--all') {
  urls = [...getAllBlogUrls(), ...getToolUrls()];
  console.log(`Submitting ${urls.length} URLs (all blogs + tools)`);
} else if (args[0] === '--recent') {
  const blogs = getAllBlogUrls();
  urls = blogs.slice(0, 20); // only most recent 20
  console.log(`Submitting ${urls.length} recent blog URLs`);
} else {
  urls = args.map(u => u.startsWith('http') ? u : `${SITE}/${u}`);
}

if (urls.length === 0) {
  console.log('No URLs to submit');
  process.exit(0);
}

submitToIndexNow(urls).then(results => {
  results.forEach(r => {
    if (r.error) {
      console.log(`❌ ${r.endpoint}: ERROR ${r.error}`);
    } else {
      console.log(`${r.status === 200 ? '✅' : '⚠️'} ${r.endpoint}: ${r.status} ${r.data}`);
    }
  });
}).catch(e => {
  console.error('Submit failed:', e.message);
  process.exit(1);
});
