import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Local-dev middleware that mirrors api/ai.js (the Vercel serverless function).
// Why: during `npm run dev` Vite does not execute /api/*.js files. This plugin
// adds a /api/ai endpoint so voice/text input can be tested locally with an
// Anthropic key in .env.local. In production, the real api/ai.js handles it.
// The key is read from the Node process — it is never bundled into client code.
function devAiProxy(env) {
  return {
    name: 'tracked-dev-ai-proxy',
    configureServer(server) {
      server.middlewares.use('/api/ai', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }
        const apiKey = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'API key not configured. Add ANTHROPIC_API_KEY to .env.local and restart `npm run dev`.' }))
          return
        }
        try {
          const chunks = []
          for await (const c of req) chunks.push(c)
          const body = Buffer.concat(chunks).toString('utf8')
          const upstream = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
            body,
          })
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('content-type', 'application/json')
          res.end(text)
        } catch (err) {
          console.error('[tracked dev ai proxy]', err)
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'Failed to call AI service' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // loadEnv reads .env.local without the VITE_ prefix so the key stays server-side.
  const env = loadEnv(mode, process.cwd(), '')
  return {
  plugins: [
    react(),
    devAiProxy(env),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tracked',
        short_name: 'Tracked',
        description: 'Track what you take. Know what works.',
        theme_color: '#9E6B52',
        background_color: '#FAFAFA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true,
  },
  }
})
