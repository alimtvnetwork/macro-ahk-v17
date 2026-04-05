import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Vite build config for standalone XPath utilities script.
 *
 * Compiles TypeScript source → single IIFE JS bundle exposing window.XPathUtils.
 * Output: standalone-scripts/xpath/dist/xpath.js
 *
 * Usage: npm run build:xpath
 *
 * Production mode (default): minified, no sourcemap
 * Development mode (--mode development): unminified, inline sourcemap
 */
export default defineConfig(({ mode }) => ({
  publicDir: false,
  build: {
    outDir: 'standalone-scripts/xpath/dist',
    emptyOutDir: false,
    sourcemap: mode === 'development' ? 'inline' : false,
    minify: mode !== 'development' ? 'esbuild' : false,
    lib: {
      entry: resolve(__dirname, 'standalone-scripts/xpath/src/index.ts'),
      name: 'XPathUtils',
      formats: ['iife'],
      fileName: () => 'xpath.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  resolve: {
    alias: {
      '@xpath': resolve(__dirname, 'standalone-scripts/xpath/src'),
    },
  },
}));
