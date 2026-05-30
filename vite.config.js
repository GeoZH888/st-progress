import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// PWA wiring is added now so the install/offline shell works from the start.
// Final app icons can be dropped into /public/icons later (see public/icons/README).
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Milestones of Human Progress',
        short_name: 'Progress',
        description:
          'A trilingual guide to the great discoveries, inventions and the people behind them — explore by era, by field, or on a world map.',
        theme_color: '#1f3a5f',
        background_color: '#f5f1e6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ]
})
