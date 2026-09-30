import { loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { SITE_DEFAULTS, resolveSiteUrl } from '../../config/site.mjs';

export const root = fileURLToPath(new URL('../../', import.meta.url));

export function buildSiteUrl() {
  const env = loadEnv(process.env.NODE_ENV || 'production', root, 'PUBLIC_');
  return resolveSiteUrl(
    process.env.PUBLIC_SITE_URL ?? env.PUBLIC_SITE_URL ?? SITE_DEFAULTS.url,
  );
}
