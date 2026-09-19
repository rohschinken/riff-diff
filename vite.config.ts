import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/riff-diff/' : '/',
  clearScreen: false,

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
    watch: {
      // symlinks (e.g. in flatpak/ build dirs can make chokidar throw ELOOP and crash the dev server.
      followSymlinks: false
    },
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
