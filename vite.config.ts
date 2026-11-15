import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/our-icon.svg'],
      manifest: {
        name: 'OUR — Personal & Couple OS',
        short_name: 'OUR',
        description: 'Sua vida pessoal e a vida a dois, em um só lugar.',
        theme_color: '#090B12',
        background_color: '#090B12',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: '/icons/our-icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      }
    })
  ]
})
