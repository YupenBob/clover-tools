#!/usr/bin/env node
/**
 * keyword-scraper.js
 * Scrape Google Suggest keywords for CloverTools SEO automation.
 *
 * Usage:
 *   node scripts/keyword-scraper.js                    # use seeds from keywords.json (first 10)
 *   node scripts/keyword-scraper.js "excel技巧"       # custom seed only
 *   node scripts/keyword-scraper.js --all            # use all keywords.json seeds
 *   node scripts/keyword-scraper.js "pdf工具" --all  # custom + all from keywords.json
 *
 * Network: Requires Google access. In China, run via proxychains4:
 *   proxychains4 -q node scripts/keyword-scraper.js --all
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

function fetch(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    const mod = isHttps ? https : http;
    const req = mod.request({
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      timeout: 15000,
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

/**
 * Parse Google Suggest JSONP response.
 * Google Suggest returns: window.google.ac.h([[["kw1",0,[512],"kw2",0,[512]]],{meta})
 * Pattern: "keyword",0,[digits] — simple regex beats JSON.parse for nested arrays.
 */
function parseSuggestResponse(body) {
  const matches = [...body.matchAll(/"([^"]+)",0,\[([\d,]+)\]/g)].map(m => m[1]);
  if (matches.length === 0) {
    throw new Error('Could not parse: ' + body.slice(0, 100));
  }
  return matches;
}

/**
 * Fetch suggestions for a single query.
 */
async function getSuggestions(query) {
  const encoded = encodeURIComponent(query);
  const charCount = encoded.length;
  const url = `https://www.google.com/complete/search?q=${encoded}&cp=${charCount}&client=gws-wiz`;
  const body = await fetch(url);
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
        process.stdout.write(`  Scraping "${query}"... `);
        const suggestions = await getSuggestions(query);

        let newCount = 0;
        for (const kw of suggestions) {
          if (!seen.has(kw)) {
            seen.add(kw); allKeywords.push(kw); newCount++;
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
    console.error('   In China: run with "proxychains4 -q node scripts/keyword-scraper.js --all"');
    console.error('   Keywords already collected are still saved.\n');
  }

  /**
 * Merge new keywords into the main keywords.json (dedup).
 */
function mergeIntoMain(results) {
  if (results.length === 0) return;
  try {
    const existing = JSON.parse(fs.readFileSync(KEYWORDS_FILE, 'utf8'));
    const existingKws = new Set(existing.map(item => item.keyword));
    let added = 0;
    for (const kw of results) {
      if (!existingKws.has(kw)) {
        existing.push({ keyword: kw, source: 'google-suggest' });
        existingKws.add(kw);
        added++;
      }
    }
    fs.writeFileSync(KEYWORDS_FILE, JSON.stringify(existing, null, 2), 'utf8');
    console.log(`  Merged ${added} new keywords into keywords.json (total now ${existing.length})`);
  } catch (e) {
    console.error('  Warning: could not merge into keywords.json:', e.message);
  }
}

const outPath = saveResults(allKeywords);
  mergeIntoMain(allKeywords);
  console.log(`\nDone! Saved ${allKeywords.length} keywords to ${outPath}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
