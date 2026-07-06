/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/',
  server: {
    // In production the VitePress docs build is deployed under /docs/ next to
    // the app; in dev the docs are a separate server (`npm run docs:dev`).
    // Without this proxy the SPA fallback answers /docs/ with the IDE shell
    // itself, so the in-app docs drawer shows the IDE recursively. Proxy
    // /docs to the docs dev server instead (so running `npm run docs:dev`
    // alongside `npm run dev` shows the docs in the drawer during development).
    proxy: {
      '^/docs(/|$)': {
        target: `http://localhost:${process.env.DOCS_PORT ?? 5174}`,
        ws: true,
      },
    },
  },
  plugins: [
    react(),
    // Service worker for the app shell. The docs site ships its own
    // service worker via @vite-pwa/vitepress; the two have nested scopes (/ and
    // /docs/) and each precaches its own build.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        // The emulator cores and a few assets are large; raise the precache
        // size ceiling so the app shell is fully cached.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest,woff2,wasm}'],
        // Third-party ROMs load on demand and cache at runtime.
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
        // Never let the app's SPA navigation fallback answer for docs URLs.
        // Match the bare `/docs` too (no trailing slash) so a visit to
        // ba.sical.ly/docs reaches the server's redirect to /docs/ instead of
        // being served the app shell.
        navigateFallbackDenylist: [/^\/docs(\/|$)/],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'docs/**/*.test.ts'],
  },
});
