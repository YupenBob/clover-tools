import { mkdir, writeFile } from 'node:fs/promises';
import { ensureBotFightModeOff } from './lib/cloudflare-bots.mjs';
import { ensureWwwCanonical } from './lib/cloudflare-www.mjs';

await mkdir('output/crawler-audit', { recursive: true });
try {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const domain = 'clovertools.cn';
  const zone = await ensureBotFightModeOff({ token, domain, accountId: process.env.CLOUDFLARE_ACCOUNT_ID, zoneId: process.env.CLOUDFLARE_ZONE_ID });
  const report = await ensureWwwCanonical({ token, zoneId: zone.zoneId, domain });
  await writeFile('output/crawler-audit/cloudflare-www.json', JSON.stringify(report, null, 2) + '\n');
  console.log('CLOUDFLARE_WWW ' + JSON.stringify(report));
} catch (error) {
  await writeFile('output/crawler-audit/cloudflare-www.json', JSON.stringify({ verified: false, error: error.message }, null, 2) + '\n');
  console.error(error.message);
  process.exitCode = 1;
}
