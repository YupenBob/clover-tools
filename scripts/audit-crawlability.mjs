/** Read-only production HTTP audit. It cannot inspect a Search Console property. */
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { auditCrawlability } from './lib/crawlability.mjs';
import { buildSiteUrl } from './lib/build-config.mjs';

const report = await auditCrawlability(buildSiteUrl());
report.commit = process.env.GITHUB_SHA || null;
report.workflowRun = process.env.GITHUB_RUN_ID || null;
await mkdir('output/crawler-audit', { recursive: true });
await writeFile('output/crawler-audit/public-crawlability.json', JSON.stringify(report, null, 2) + '\n');
const summary = { status: report.status, sitemapUrls: report.sitemapUrls || 0, pagesChecked: report.pages.length, agentProbes: report.agentProbes.length, realGoogleIdentity: false, legacyRoutes: report.legacyRoutes.length, hostVariants: report.hostVariants, failures: report.failures, warnings: report.warnings };
console.log('PUBLIC_CRAWLABILITY ' + JSON.stringify(summary));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `\n### Public crawlability\n\nStatus: **${report.status}**\n\nPages: ${report.pages.length}; legacy routes: ${report.legacyRoutes.length}; UA probes: ${report.agentProbes.length}.\n\nUA probes only change a request header. They are not real Google requests or a Search Console live test.\n\n${[...report.failures, ...report.warnings].map(problem => '- ' + problem).join('\n') || 'No HTTP or host canonicalization issues detected.'}\n`);
if (report.failures.length) process.exitCode = 1;
else if (report.warnings.length) console.log('::warning::Public crawlability needs attention; see the audit artifact and summary.');
