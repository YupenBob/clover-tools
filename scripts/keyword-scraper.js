#!/usr/bin/env node
/**
 * keyword-scraper.js
 * Scrape Google Suggest keywords for CloverTools SEO automation.
 *
 * Usage:
 *   node scripts/keyword-scraper.js                    # use seeds from keywords.json
 *   node scripts/keyword-scraper.js "excel技巧"       # custom seed only
 *   node scripts/keyword-scraper.js --all            # use all keywords.json seeds
 *   node scripts/keyword-scraper.js "pdf工具" --all  # custom + all from keywords.json
 *
 * Note: Requires network access to Google. May not work in China without proxy/VPN.
 * If you see ETIMEDOUT errors, enable a proxy or VPN first.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// --- Proxy configuration ---
const PROXY_HOST = '47.118.40.73';
const PROXY_PORT = 33001;

// --- Configuration ---
const PROJECT_ROOT = path.join(__dirname, '..');
const KEYWORDS_FILE = path.join(PROJECT_ROOT, 'keywords.json');
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const RATE_LIMIT_MS = 200;

// Variation suffixes appended to each seed keyword
const VARIATIONS = [
  '',
  '怎么用',
  '是什么',
  '工具',
  '网站',
  '在线',
  '免费',
  '2025',
  '2026',
  'app',
  '软件',
  '教程',
];

// --- Helpers ---

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetch(url, proxyHost, proxyPort) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const opts = {
      host: proxyHost,
      port: proxyPort,
      path: url,
      method: 'GET',
      headers: {
        'Host': parsedUrl.host,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

/**
 * Parse Google Suggest JSONP response.
 * The API returns window.google.ac.h && window.google.ac.h([...]) with an inner
 * keyword array at parsed[0][0].
 */
function parseSuggestResponse(body) {
  const patterns = [
    /window\.google\.ac\.h\s*&&\s*window\.google\.ac\.h\s*(\[[\s\S]*?\]\))/,
    /window\.google\.ac\.h\s*(\[[\s\S]*?\]\))/,
    /window\.google\.ac\.core_chars\s*(\[[\s\S]*?\]\))/,
  ];

  let jsonStr = null;
  for (const pattern of patterns) {
    const match = body.match(pattern);
    if (match) { jsonStr = match[1]; break; }
  }

  if (!jsonStr) {
    throw new Error('Could not parse Google Suggest response: ' + body.slice(0, 200));
  }

  try {
    const parsed = JSON.parse(jsonStr);
    // Structure: [[["kw1","kw2",...], ["desc1",...], ["b1",...], ["a1",...]]]
    if (Array.isArray(parsed) && Array.isArray(parsed[0]) && Array.isArray(parsed[0][0])) {
      return parsed[0][0];
    }
    return [];
  } catch (e) {
    throw new Error('JSON parse failed: ' + e.message + ' | raw: ' + jsonStr.slice(0, 200));
  }
}

/**
 * Fetch suggestions for a single query.
 */
async function getSuggestions(query) {
  const encoded = encodeURIComponent(query);
  const charCount = encoded.length;
  const url = `https://www.google.com/complete/search?q=${encoded}&cp=${charCount}&client=gws-wiz`;
  const body = await fetch(url, PROXY_HOST, PROXY_PORT);
  return parseSuggestResponse(body);
}

/**
 * Load keywords from keywords.json.
 */
function loadSeedKeywords() {
  if (!fs.existsSync(KEYWORDS_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8'));
    if (Array.isArray(data)) return data.map(item => item.keyword || item).filter(Boolean);
    return [];
  } catch (e) {
    console.error('Failed to load keywords.json:', e.message);
    return [];
  }
}

/**
 * Save results to data/keywords-{date}.json.
 */
function saveResults(results) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const date = new Date().toISOString().slice(0, 10);
  const outPath = path.join(DATA_DIR, `keywords-${date}.json`);
  const output = {
    date: new Date().toISOString(),
    total: results.length,
    results: results.map(kw => ({ keyword: kw, source: 'google-suggest' })),
  };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
  return outPath;
}

// --- Main ---

async function main() {
  const args = process.argv.slice(2);
  const useAllSeeds = args.includes('--all');
  const customSeeds = args.filter(a => !a.startsWith('--'));

  let seedKeywords = [];

  if (customSeeds.length > 0) {
    seedKeywords = customSeeds;
    if (useAllSeeds) {
      seedKeywords = [...new Set([...seedKeywords, ...loadSeedKeywords()])];
    }
  } else {
    seedKeywords = useAllSeeds ? loadSeedKeywords() : loadSeedKeywords().slice(0, 10);
  }

  // Deduplicate seeds too
  seedKeywords = [...new Set(seedKeywords)];

  if (seedKeywords.length === 0) {
    console.error('No seed keywords found. Provide custom seeds or ensure keywords.json exists.');
    process.exit(1);
  }

  console.log(`Starting keyword scrape with ${seedKeywords.length} seed(s)...\n`);

  const seen = new Set();
  const allKeywords = [];
  let networkErrors = 0;

  for (const seed of seedKeywords) {
    for (const suffix of VARIATIONS) {
      const query = seed + suffix;
      if (!query.trim()) continue;

      try {
        process.stdout.write(`[proxy:${PROXY_HOST}:${PROXY_PORT}] Scraping variation "${query}"... `);
        const suggestions = await getSuggestions(query);

        let newCount = 0;
        for (const kw of suggestions) {
          if (typeof kw === 'string' && !seen.has(kw)) {
            seen.add(kw); allKeywords.push(kw); newCount++;
          } else if (Array.isArray(kw) && kw[0] && !seen.has(kw[0])) {
            seen.add(kw[0]); allKeywords.push(kw[0]); newCount++;
          }
        }
        console.log(`got ${suggestions.length}, ${newCount} new`);
      } catch (err) {
        const msg = err.message;
        if (msg.includes('timeout') || msg.includes('ETIMEDOUT') || msg.includes('ENETUNREACH') || msg.includes('ECONNREFUSED')) {
          console.error(`\n  NETWORK ERROR (skipping): ${msg.split('\n')[0]}`);
          networkErrors++;
        } else {
          console.error(`\n  ERROR: ${err.message}`);
        }
      }

      await sleep(RATE_LIMIT_MS);
    }
  }

  if (networkErrors > 0) {
    console.error(`\n⚠️  ${networkErrors} request(s) failed due to network issues.`);
    console.error('   Google is not reachable from this machine (likely need proxy/VPN in China).');
    console.error('   Keywords already collected are still saved.\n');
  }

  const outPath = saveResults(allKeywords);
  console.log(`\nDone! Saved ${allKeywords.length} keywords to ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});