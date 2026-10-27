import { defineConfig } from 'astro/config';

// Served by GitHub Pages at https://evoryder8-collab.github.io/timeless-spa-website/ while the site is in review.
// When it moves to its own domain, set `site` to that domain and remove `base`.
export default defineConfig({
  site: 'https://evoryder8-collab.github.io',
  base: '/timeless-spa-website',
  trailingSlash: 'always',
  vite: {
    build: { chunkSizeWarningLimit: 1400 },
  },
});
