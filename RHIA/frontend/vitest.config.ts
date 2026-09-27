import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'happy-dom', // Switched from jsdom for performance
    setupFiles: ['./src/vitest.setup.ts'],
    include: ['src/**/__tests__/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 15000,
    hookTimeout: 15000,
    isolate: true,
    threads: true,
    maxThreads: 2,
    minThreads: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
