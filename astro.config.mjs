// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://nagasivapoluri.netlify.app',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
