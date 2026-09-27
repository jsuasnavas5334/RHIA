import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
      mangle: true,
    },
    rollupOptions: {
      output: {
        // Forma función: la forma objeto dejaba react/react-dom dentro del chunk
        // "router" (react-vendor quedaba vacío, 30 bytes).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor'
          if (/[\\/]node_modules[\\/](react-router|react-router-dom|@remix-run)[\\/]/.test(id)) return 'router'
          if (/[\\/]node_modules[\\/]axios[\\/]/.test(id)) return 'http'
          if (/[\\/]node_modules[\\/]zustand[\\/]/.test(id)) return 'state'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 300,
    cssCodeSplit: true,
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'axios', 'zustand'],
  },
})
