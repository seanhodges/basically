/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    // Service worker for the app shell, so the IDE itself works offline once
    // installed. The docs site (built separately under /docs/) ships its own
    // service worker via @vite-pwa/vitepress; the two have nested scopes (/ and
    // /docs/) and each precaches its own build. The existing hand-written
    // public/manifest.webmanifest is kept (manifest: false) and stays linked
    // from index.html.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        // The emulator cores and a few assets are large; raise the precache
        // size ceiling so the app shell is fully cached.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest,woff2,wasm}'],
        // Third-party ROMs are big and only needed when a machine is actually
        // run; let them load on demand and cache at runtime rather than
        // bloating the install.
        globIgnores: ['**/roms/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/roms/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'roms',
              expiration: { maxEntries: 32 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // The docs live under /docs/ with their own service worker; never let
        // the app's SPA navigation fallback answer for docs URLs. Match the
        // bare `/docs` too (no trailing slash) so a visit to ba.sical.ly/docs
        // reaches the server's redirect to /docs/ instead of being served the
        // app shell.
        navigateFallbackDenylist: [/^\/docs(\/|$)/],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'docs/**/*.test.ts'],
  },
});
