import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLEFILE=1 inlines all JS/CSS into one self-contained index.html — an offline,
// double-click-to-run tool. Otherwise a normal multi-file build for hosting.
const single = process.env.SINGLEFILE === '1';

export default defineConfig({
  plugins: [react(), ...(single ? [viteSingleFile()] : [])],
  base: './',
  build: {
    outDir: single ? 'offline' : 'dist',
    ...(single
      ? { assetsInlineLimit: 100000000, chunkSizeWarningLimit: 100000, cssCodeSplit: false }
      : {}),
  },
});
