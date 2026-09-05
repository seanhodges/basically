/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { chunkFor } from './src/build/chunks';

export default defineConfig({
  base: '/',
  server: {
    // In production the VitePress docs build is deployed under /docs/ next to
    // the app; in dev the docs are a separate server (`npm run docs:dev`).
    // Without this proxy the SPA fallback answers /docs/ with the IDE shell
    // itself, the in-app docs drawer will show the IDE.
    proxy: {
      '^/docs(/|$)': {
        target: `http://localhost:${process.env.DOCS_PORT ?? 5174}`,
        ws: true,
      },
    },
  },
  // `vite preview` serves the built artifact, where /docs/ is real files under
  // dist/docs - but Vite falls preview's proxy back to the dev server's, which
  // would send those requests to a VitePress dev server that is not running.
  // An explicit empty map stops that inheritance.
  preview: { proxy: {} },
  build: {
    // Rollup's own limit is 500kB, which the app has been over for long enough
    // that the warning stopped meaning anything. Lower it once the chunks below
    // are named, so the next thing to cross it is news.
    chunkSizeWarningLimit: 400,
    rollupOptions: { output: { manualChunks: chunkFor } },
  },
  plugins: [
    react(),
    // Service worker for the app shell. The docs site ships its own
    // service worker via @vite-pwa/vitepress; the two have nested scopes (/ and
    // /docs/) and each precaches its own build.
    //
    // Left out of the build the e2e suite runs against. A dev server never
    // registers this - vite-plugin-pwa needs `devOptions` for that - so the
    // browser the specs drive has never had a service worker, and giving them
    // one along with a production build would be a behaviour change smuggled in
    // with a speed change: every test opens a fresh context, so each would
    // install and precache the whole shell from scratch, and an install racing
    // the first assertions is a flake nobody asked for. The service worker is
    // real behaviour and deserves its own test, not a side effect of this one.
    ...(process.env.E2E === '1'
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            manifest: false,
            workbox: {
              // The emulator cores and a few assets are large; raise the precache
              // maximum file size so the app shell is fully cached.
              maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
              globPatterns: [
                '**/*.{js,css,html,png,svg,ico,webmanifest,woff2,wasm}',
              ],
              // Third-party ROMs cache at runtime, and so does what only the
              // assistant reaches: three provider SDKs ship and a user picks
              // one, and the machine and porting prose is built for a question
              // most visits never ask. Each is reached through an `import()`
              // and nothing else, so leaving them out costs a first visit
              // nothing; they still cache on first use. The trade is the one
              // the ROMs already make, and it stays inside what the offline
              // guarantee covers, which exempts the inherently networked
              // features.
              globIgnores: [
                '**/roms/**',
                '**/assets/{anthropic,openai,gemini}-*.js',
                '**/assets/{machineDescription,portDescription}-*.js',
              ],
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
                {
                  urlPattern: ({ url }) =>
                    /\/assets\/(anthropic|openai|gemini|machineDescription|portDescription)-[^/]*\.js$/.test(
                      url.pathname,
                    ),
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'assistant',
                    expiration: { maxEntries: 64 },
                    cacheableResponse: { statuses: [0, 200] },
                  },
                },
              ],
              // Never let the app's SPA navigation fallback answer for docs URLs.
              // Match the bare `/docs` too (no trailing slash) so a visit to
              // ba.sical.ly/docs reaches the server's redirect to /docs/.
              navigateFallbackDenylist: [/^\/docs(\/|$)/],
            },
          }),
        ]),
  ],
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'docs/**/*.test.ts',
      'eslint-rules/**/*.test.ts',
    ],
    /**
     * Vitest's default is 5s, which suits unit tests and does not suit this
     * suite: a large part of it boots a real ROM and emulates hundreds of
     * frames of machine time, and those cases legitimately take seconds. What
     * makes 5s a *flaky* budget rather than a tight one is that the tests run
     * in parallel workers - a case that takes 2s on an idle machine can take
     * three times that on a loaded CI box, so the same test passes locally and
     * times out in CI without anything about it having changed.
     *
     * Ten-odd files had already reached for their own 20-60s per-test budget
     * (`BOOT_TIMEOUT_MS` in the C64 tests, the `}, 60000)` on the sample-run
     * suites); this makes that the floor for every file, so the next
     * emulator-backed test is not born flaky and only genuinely unusual cases
     * need to say anything. Those explicit per-test budgets still stand where
     * they are longer.
     *
     * 30s comes from measurement rather than superstition: with the whole
     * suite running in parallel on a 4-core box the slowest case is ~12s and
     * the slowest dozen are 5-10s, so a CI runner with half the cores has
     * room and a genuine hang is still cut off quickly. This is a ceiling on a
     * hang, not a target - a test that comes near it has become slow enough to
     * be worth looking at.
     */
    testTimeout: 30_000,
  },
});
