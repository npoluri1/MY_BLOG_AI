// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://my-blog-nagasiva.netlify.app',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
