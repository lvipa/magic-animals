import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
const musicSite = process.env.VITE_GAME_ENTRY === 'sing';

export default defineConfig({
  // Review HTML templates contain build placeholders; scan the app entry only.
  optimizeDeps: { entries: ['index.html'] },
  server: { proxy: { '/tv-socket': { target: 'http://127.0.0.1:8080', ws: true } } },
  plugins: [
    react(),
    ...(musicSite
      ? [
          {
            name: 'sing-page-title',
            transformIndexHtml: (html: string) =>
              html.replace('<title>Magic Animals</title>', '<title>Sing with Milo</title>'),
          },
        ]
      : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/apple-touch-icon.png',
        'icons/favicon.png',
        'markers/milo-v2/targets.mind',
      ],
      manifest: {
        name: musicSite ? 'Sing with Milo' : 'Magic Animals',
        short_name: musicSite ? 'Milo Music' : 'Animals',
        description: musicSite
          ? 'Sing English songs with Milo.'
          : 'A little paper card becomes a friend.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#122536',
        theme_color: '#122536',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        // The current CAT and tracking targets have immutable/versioned URLs.
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^v$/],
        globPatterns: ['**/*.{js,wasm,css,html,png,svg,mind,mp3,aac,ogg,wav,txt,json,pdf}'],
        // Production review renders are optional online documentation.
        globIgnores: [
          '**/review/**',
          'music/twinkle-v*/*.mp3',
          'music/studio-v3/**/*.mp3',
          'music/full-v4/**/*.mp3',
          'markers/milo-v2/*.svg',
          'models/cat.glb',
          'models/cat-studio.glb',
          'models/foxy.glb',
          'models/dog.glb',
          'models/lion.glb',
          'models/bunny.glb',
          'models/bear.glb',
          'models/panda.glb',
          'models/elephant.glb',
          'markers/cat.*',
          'markers/dog.*',
          'markers/lion.*',
          'markers/targets.mind',
        ],
        // A release must not wait for 51 MB of optional character downloads.
        // HTML checks the network; immutable character URLs remain cache first.
        navigateFallback: null,
        directoryIndex: null,
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              /^\/music\/full-v4\/.*\.mp3$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'milo-music-full-v4',
              cacheableResponse: { statuses: [200] },
              rangeRequests: true,
              expiration: { maxEntries: 12, purgeOnQuotaError: true },
            },
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'animals-pages-v1',
              networkTimeoutSeconds: 3,
              fetchOptions: { cache: 'no-store' },
              precacheFallback: { fallbackURL: '/index.html' },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              /^\/models\/.*-milo.*\.glb$/.test(url.pathname),
            handler: 'CacheFirst',
            options: {
              cacheName: 'animals-models-v1',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 16, purgeOnQuotaError: true },
            },
          },
        ],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  build: { target: 'es2020' },
});
