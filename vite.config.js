import { defineConfig } from 'vite';

// Root is pinned to the real (long) path: the dev server may be launched via
// the 8.3 short path (spaces in the user dir), and the mismatch between the
// short-path cwd and realpath'd module ids breaks Vite's transform pipeline.
export default defineConfig({
  root: 'C:/Users/Keshav Gowda/OneDrive/Desktop/Projects/Triam/cosmochute-website',
  server: { fs: { strict: false } },
});
