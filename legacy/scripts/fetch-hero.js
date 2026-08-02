#!/usr/bin/env node
/**
 * Hero image fetcher for CloverTools blog.
 * Uses Picsum.photos (free, no API key).
 * Downloads via curl (proxychains4-aware).
 * 
 * Usage:
 *   node scripts/fetch-hero.js                    # fetch 1 random image
 *   node scripts/fetch-hero.js "technology" 3      # fetch 3 images
 *   node scripts/fetch-hero.js --batch 20         # fetch 20 varied images (auto-skips existing)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const HERO_DIR = path.join(__dirname, '..', 'public', 'heroes');
const SIZES = { hero: { w: 1600, h: 900 }, og: { w: 1200, h: 630 } };

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.includes('--batch')) {
    const n = parseInt(args[args.indexOf('--batch') + 1]) || 10;
    return { keyword: null, count: n };
  }
  const count = parseInt(args[args.length - 1]) || 1;
  const keyword = args[0] || null;
  return { keyword, count };
}

function curlDownload(url, destPath) {
  execSync(`curl -L -f -s -S "${url}" -o "${destPath}"`, { timeout: 20000 });
}

async function fetchHeroImages(keyword, count) {
  if (!fs.existsSync(HERO_DIR)) fs.mkdirSync(HERO_DIR, { recursive: true });

  const results = [];
  const seen = new Set(fs.readdirSync(HERO_DIR).filter(f => f.endsWith('.jpg')));

  if (keyword) {
    console.log(`Fetching ${count} images for "${keyword}"...`);
    let attempts = 0;
    while (results.length < count && attempts < count * 5) {
      const id = Math.floor(Math.random() * 900) + 50;
      attempts++;
      const { hero: { w, h } } = SIZES;
      const filename = `hero-${id}-${w}x${h}.jpg`;
      if (seen.has(filename)) { console.log(`  ⏭️  id=${id} already exists`); continue; }
      seen.add(filename);
      const filepath = path.join(HERO_DIR, filename);
      try {
        curlDownload(`https://picsum.photos/id/${id}/${w}/${h}`, filepath);
        const stats = fs.statSync(filepath);
        if (stats.size < 5000) throw new Error('File too small - likely error image');
        console.log(`  ✅ id=${id} → ${filename} (${(stats.size/1024).toFixed(0)}KB)`);
        results.push({ keyword, picsum_id: id, filename, size: stats.size, date: new Date().toISOString() });
      } catch (e) {
        console.log(`  ⚠️  id=${id}: ${e.message}`);
        seen.delete(filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      }
    }
  } else {
    // Batch: find the highest existing ID and continue from there
    let maxId = 50;
    for (const f of [...seen]) {
      const m = f.match(/hero-(\d+)-/);
      if (m) maxId = Math.max(maxId, parseInt(m[1]));
    }

    console.log(`Fetching ${count} varied images starting from id=${maxId + 10}...`);
    const startId = maxId + 10;
    for (let i = 0; i < count * 3 && results.length < count; i++) {
      const id = startId + i;
      const { hero: { w, h } } = SIZES;
      const filename = `hero-${id}-${w}x${h}.jpg`;
      if (seen.has(filename)) { console.log(`  ⏭️  id=${id} already exists`); continue; }
      seen.add(filename);
      const filepath = path.join(HERO_DIR, filename);
      try {
        curlDownload(`https://picsum.photos/id/${id}/${w}/${h}`, filepath);
        const stats = fs.statSync(filepath);
        if (stats.size < 5000) throw new Error('File too small - error image');
        console.log(`  ✅ id=${id} → ${filename} (${(stats.size/1024).toFixed(0)}KB)`);
        results.push({ picsum_id: id, filename, size: stats.size, date: new Date().toISOString() });
      } catch (e) {
        console.log(`  ⚠️  id=${id}: ${e.message}`);
        seen.delete(filename);
        if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      }
    }
  }

  return results;
}

const { keyword, count } = parseArgs();
console.log(`🖼️  Hero image fetcher (Picsum.photos) — ${count} images, keyword: ${keyword || 'random'}\n`);

fetchHeroImages(keyword, count).then(results => {
  console.log(`\n✅ Done! ${results.length} images → ${HERO_DIR}`);
  if (results.length > 0) {
    console.log('Sample:');
    results.slice(0, 3).forEach(r => console.log(`  https://picsum.photos/id/${r.picsum_id}/1600/900`));
  }
}).catch(e => { console.error('Error:', e.message); process.exit(1); });