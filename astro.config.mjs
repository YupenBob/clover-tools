import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://clovertools.cn',
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
      lastmod: new Date(),
    }),
  ],
});
