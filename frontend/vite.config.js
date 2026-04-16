import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5002',
      '/login': 'http://localhost:5002',
      '/logout': 'http://localhost:5002',
      '/admin': 'http://localhost:5002',
      '/member': 'http://localhost:5002',
      '/search': 'http://localhost:5002',
      '/events': { target: 'http://localhost:5002', bypass: (req) => {
        if (req.url === '/events' || req.url === '/events/') return req.url
        return null
      }},
      '/static': 'http://localhost:5002',
    }
  },
  build: {
    outDir: '../frontend_dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
      }
    }
  }
})
