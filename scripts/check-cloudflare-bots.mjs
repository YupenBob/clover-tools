import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { ensureBotFightModeOff } from './lib/cloudflare-bots.mjs';

const domain = process.env.CLOUDFLARE_ZONE_NAME || 'clovertools.cn';
await mkdir('output/crawler-audit', { recursive: true });
try {
  const result = await ensureBotFightModeOff({ token: process.env.CLOUDFLARE_BOT_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN, accountId: process.env.CLOUDFLARE_ACCOUNT_ID, zoneId: process.env.CLOUDFLARE_ZONE_ID, domain });
  await writeFile('output/crawler-audit/cloudflare-bots.json', JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Cloudflare crawler audit\n\nDomain: ${domain}\n\nBot Fight Mode: **OFF**, confirmed by API read-back.\n\nChanged: ${result.changed}\n\nVerified at: ${result.verifiedAt}\n\nSuper Bot Fight Mode verified-bot action: ${result.verifiedBots ?? 'not configured'}\n`);
} catch (error) {
  const report = { domain, verifiedAt: new Date().toISOString(), verified: false, error: error.message };
  await writeFile('output/crawler-audit/cloudflare-bots.json', JSON.stringify(report, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Cloudflare crawler audit\n\n**Not verified**: ${error.message}\n`);
  console.error(error.message);
  process.exitCode = 1;
}
