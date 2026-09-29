import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { proxy: { '/tv-socket': { target: 'http://127.0.0.1:8080', ws: true } } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/apple-touch-icon.png',
        'icons/favicon.png',
        'markers/targets.mind',
        'markers/cat.png',
        'markers/dog.png',
        'markers/lion.png',
      ],
      manifest: {
        name: 'Magic Animals',
        short_name: 'Animals',
        description: 'A little paper card becomes a friend.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'landscape',
        background_color: '#122536',
        theme_color: '#122536',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // The CAT revision query bypasses old workers during an online update;
        // the current worker still serves its matching precached model offline.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
        globPatterns: ['**/*.{js,wasm,css,html,png,svg,mind,mp3,aac,ogg,wav,glb,txt,json,pdf}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/audio\//, /^\/markers\//, /^\/models\//],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  build: { target: 'es2020' },
});
