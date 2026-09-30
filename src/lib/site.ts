import { SITE_DEFAULTS, resolveSiteUrl } from '../../config/site.mjs';

export const SITE = {
  ...SITE_DEFAULTS,
  url: resolveSiteUrl(import.meta.env.SITE || SITE_DEFAULTS.url),
} as const;
