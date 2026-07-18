// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://nagasivapoluri.github.io',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
