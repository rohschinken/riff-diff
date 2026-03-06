import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
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
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
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
