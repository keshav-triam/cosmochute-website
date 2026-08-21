import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { realpathSync } from 'node:fs';
import { dirname } from 'node:path';

// Root is resolved via realpath of this config file rather than a hardcoded
// path: on Windows the dev server may be launched via the 8.3 short path
// (spaces in the user dir), and the mismatch between the short-path cwd and
// realpath'd module ids breaks Vite's transform pipeline. realpathSync
// canonicalizes short paths to long paths on Windows and is a harmless
// no-op (just resolves symlinks) on Linux/macOS CI, so this works both for
// local dev and for portable builds (e.g. Vercel).
const root = dirname(realpathSync(fileURLToPath(import.meta.url)));

export default defineConfig({
  root,
  server: { fs: { strict: false } },
  build: {
    rollupOptions: {
      input: {
        main: `${root}/index.html`,
        careers: `${root}/careers.html`,
        about: `${root}/about.html`,
        news: `${root}/news.html`,
        partners: `${root}/partners.html`,
      },
    },
  },
});
