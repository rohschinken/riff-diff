import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// AlphaTexExporter/AlphaTexImporter are only present in alphaTab's "core" build
// (dist/alphaTab.core.mjs). The default ESM entry tree-shakes them out, so the
// AlphaTex diff engine imports them via this alias in both app and tests.
const alphaTabCore = fileURLToPath(
  new URL('./node_modules/@coderline/alphatab/dist/alphaTab.core.mjs', import.meta.url),
)

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/riff-diff/' : '/',
  clearScreen: false,

  resolve: {
    alias: [{ find: '@coderline/alphatab/core', replacement: alphaTabCore }],
  },

  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },

  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
  },

  optimizeDeps: {
    exclude: ['@coderline/alphatab'],
  },

  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
