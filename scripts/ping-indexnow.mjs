/** Submit only URLs in the live production sitemap; no local build is required. */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { root, buildSiteUrl } from './lib/build-config.mjs';
import { indexNowBatches, liveSitemap, request, writeReport } from './lib/search-submission.mjs';

try {
  const keys = [];
  for (const name of (await readdir(join(root, 'public'))).sort()) {
    if (!/^[0-9a-f]{32}\.txt$/.test(name)) continue;
    const value = (await readFile(join(root, 'public', name), 'utf8')).trim();
    if (value === name.slice(0, -4)) keys.push(value);
  }
  if (keys.length !== 1) throw new Error('Expected one valid public IndexNow key file');
  const site = await liveSitemap(buildSiteUrl());
  const keyResponse = await request(`${site.origin}/${keys[0]}.txt`);
  if ((await keyResponse.text()).trim() !== keys[0]) throw new Error('Published IndexNow key file does not match this repository');
  const batches = [];
  for (const payload of indexNowBatches(site.origin, keys[0], site.urls)) {
    const response = await request('https://api.indexnow.org/indexnow', {
      method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload),
    });
    if (![200, 202].includes(response.status)) throw new Error(`Unexpected IndexNow response: HTTP ${response.status}`);
    batches.push({ urlCount: payload.urlList.length, httpStatus: response.status });
  }
  const status = batches.some(batch => batch.httpStatus === 202) ? 'accepted_pending_validation' : 'submitted';
  await writeReport(root, 'bing-indexnow', { engine: 'Bing / IndexNow', status, sitemap: site.sitemap, urlCount: site.urls.length, batches });
  console.log(`IndexNow accepted ${site.urls.length} published URLs; status: ${status}`);
} catch (error) {
  await writeReport(root, 'bing-indexnow', { engine: 'Bing / IndexNow', status: 'failed', error: error.message });
  console.error(error.message);
  process.exitCode = 1;
}
