import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
import { getSystemMetrics } from './src/server/systemMetrics.js'

const vllmBase = process.env.VITE_VLLM_BASE_URL || 'http://localhost:8000'

function systemInfoPlugin() {
  return {
    name: 'vite-plugin-system-info',
    configureServer(server) {
      server.middlewares.use('/api/system-info', (req, res, next) => {
        if (req.method !== 'GET') return next()
        try {
          const metrics = getSystemMetrics()
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify(metrics))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/system-info', (req, res, next) => {
        if (req.method !== 'GET') return next()
        try {
          const metrics = getSystemMetrics()
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify(metrics))
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [vue(), systemInfoPlugin()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // Proxies /api/* (except /api/system-info which is handled by middleware above) → LLM server
      '/api': {
        target: vllmBase,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
