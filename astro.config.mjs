import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://clovertools.cn',
  output: 'static',
  build: {
    format: 'directory',
  },
  compressHTML: true,
  integrations: [sitemap()],
});
