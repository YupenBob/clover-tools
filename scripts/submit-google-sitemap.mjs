import { root, buildSiteUrl } from './lib/build-config.mjs';
import { liveSitemap, submitGoogle, writeReport } from './lib/search-submission.mjs';

try {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) throw new Error('Configure the GOOGLE_SERVICE_ACCOUNT_JSON Actions secret first');
  let credentials;
  try { credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON); }
  catch { throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON'); }
  const site = await liveSitemap(buildSiteUrl());
  const result = await submitGoogle(credentials, site, process.env.GSC_SITE_URL);
  await writeReport(root, 'google-sitemap', result);
  console.log(`Google accepted the production sitemap (${result.urlCount} published URLs)`);
} catch (error) {
  await writeReport(root, 'google-sitemap', { engine: 'Google Search Console', status: 'failed', error: error.message });
  console.error(error.message);
  process.exitCode = 1;
}
