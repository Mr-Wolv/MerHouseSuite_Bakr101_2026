import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 650,
  },
  server: {
    proxy: {
      '/api': process.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8081',
    },
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
})
