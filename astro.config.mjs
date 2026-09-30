import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { buildSiteUrl } from './scripts/lib/build-config.mjs';
import { isIndexablePath } from './config/routes.mjs';

const siteUrl = buildSiteUrl();

export default defineConfig({
  site: siteUrl,
  output: 'static',
  vite: {
    optimizeDeps: {
      include: ['chinese-s2t', 'marked', 'dompurify'],
    },
  },
  build: {
    format: 'directory',
  },
  compressHTML: true,
  prefetch: {
    prefetchAll: true,
    defaultStrategy: 'hover',
  },
  integrations: [
    sitemap({
      filter: (page) => isIndexablePath(new URL(page).pathname),
    }),
  ],
});
