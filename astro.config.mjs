// @ts-check
import { readdirSync, readFileSync } from 'node:fs';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

// Fecha de última modificación de cada artículo (updatedDate o pubDate) para el <lastmod> del sitemap.
const postDir = new URL('./src/content/blog/', import.meta.url);
const lastmod = new Map(
  readdirSync(postDir)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => {
      const fm = readFileSync(new URL(f, postDir), 'utf8').split('---')[1] ?? '';
      const date = (key) => fm.match(new RegExp(`^${key}:\\s*["']?([^"'\\n]+)`, 'm'))?.[1];
      return [`/blog/${f.replace(/\.mdx?$/, '')}/`, new Date(date('updatedDate') ?? date('pubDate') ?? Date.now())];
    }),
);

export default defineConfig({
  site: 'https://blog.jelopez.link',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) => !page.includes('/404'),
      serialize(item) {
        const date = lastmod.get(new URL(item.url).pathname);
        if (date && !isNaN(date.valueOf())) item.lastmod = date.toISOString();
        return item;
      },
    }),
  ],
  markdown: {
    shikiConfig: { theme: 'github-dark-dimmed', wrap: false },
  },
  // Scripts siempre como fichero externo: la CSP de public/_headers no permite scripts inline.
  vite: { build: { assetsInlineLimit: 0 } },
});
