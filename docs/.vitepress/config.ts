import { defineConfig } from 'vitepress';
import { withPwa } from '@vite-pwa/vitepress';
import { MermaidMarkdown } from 'vitepress-plugin-mermaid';
import react from '@vitejs/plugin-react';

// Docs site for Basically, published at https://ba.sical.ly/docs.
// The app (a Vite SPA) is served from the root of the same deployment;
// this site lives under the /docs subpath. `outDir` writes the
// built docs into the app's `dist/` artifact so a single Pages deploy ships
// both. See .github/workflows/deploy.yml.
export default withPwa(
  defineConfig({
    title: 'Basically',
    description:
      'A web IDE for microcomputer BASIC - write, run and ship games for real retro hardware from your browser.',
    base: '/docs/',
    outDir: '../dist/docs',
    lang: 'en-GB',
    cleanUrls: true,
    lastUpdated: true,
    appearance: 'force-dark',

    // The porting guide renders the IDE's own machine picker - React
    // components, imported from src/ - as an island inside the Vue page (see
    // theme/components/MachinePicker.vue). This gives the docs build the JSX
    // transform for them; the .module.css they bring is handled by Vite
    // natively. Scoped to .tsx so nothing else in the docs is touched: the two
    // island files are the only JSX here, and react-refresh has no business
    // rewriting the theme's plain TypeScript.
    vite: {
      plugins: [react({ include: [/\.tsx$/] })],
    },

    markdown: {
      // Shiki has no generic "basic" grammar; alias our ```basic fences to the
      // Visual Basic grammar so BASIC keywords/strings still get highlighted.
      languageAlias: { basic: 'vb' },

      // Turn ```mermaid fences into <Mermaid> elements. We use only this
      // markdown-it rule, NOT the package's withMermaid() wrapper: that also
      // installs a Vite plugin which injects a *static* import of mermaid into
      // VitePress's client entry. VitePress emits a <link rel="modulepreload">
      // for every dynamic import of the app chunk, so mermaid's 38
      // lazily-registered diagram types plus katex - ~2.1MB raw, ~612KB gzipped
      // - were preloaded on every page of the site, including the 38 pages with
      // no diagram at all. The <Mermaid> component is registered lazily in
      // theme/index.ts instead, and pulls mermaid in only when a diagram
      // actually mounts. Dropping the wrapper also drops its optimizeDeps
      // prebundling of cytoscape (unused here) from the dev-server cold start.
      config: (md) => MermaidMarkdown(md, {}),
    },

    // Links that point outside the docs tree (repo files, source paths) can't be
    // resolved by VitePress; allow those while still catching real in-docs dead
    // links. Source-code references like `src/...` are written as inline code,
    // not links, so they are never checked.
    ignoreDeadLinks: [
      /^\.\.\//, // ../LICENSE, ../public/roms/ATTRIBUTION.md, etc.
      /^\/(?!docs\/)/, // absolute links back into the app (e.g. the IDE itself)
      /contributing\/dialect-plans\/.+/, // per-dialect plans are generated on demand by the
      // adding-a-target-system skill and may not be checked in (e.g. the roadmap
      // links to a plan whose file was removed once the dialect shipped).
    ],

    themeConfig: {
      siteTitle: false,

      nav: [
        {
          text: 'Guide',
          activeMatch: '/guide/',
          link: '/guide/getting-started',
        },
        {
          text: 'Languages',
          activeMatch: '/reference/',
          link: '/reference/',
        },
        {
          text: 'Contributing',
          activeMatch: '/contributing/',
          link: '/contributing/contributing',
        },
      ],

      sidebar: [
        { text: 'Welcome', link: '/' },
        {
          text: 'Guide',
          items: [
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Writing BASIC', link: '/guide/writing-basic' },
            { text: 'Testing your code', link: '/guide/testing-programs' },
            { text: 'Running on real hardware', link: '/guide/hardware' },
            {
              text: 'Programming the Z80/6502',
              link: '/guide/machine-code',
            },
            { text: 'Publish to Web', link: '/guide/publishing' },
            {
              text: 'Keyboard shortcuts (desktop)',
              link: '/guide/keyboard-shortcuts',
            },
          ],
        },
        {
          text: 'Language reference',
          items: [
            { text: 'Overview', link: '/reference/' },
            {
              text: 'Altair 8K BASIC',
              link: '/reference/altair8800',
              collapsed: true,
              items: [
                { text: 'Hardware', link: '/reference/altair8800/hardware' },
                { text: 'Escape codes', link: '/reference/altair8800/escapes' },
                { text: 'File formats', link: '/reference/altair8800/formats' },
              ],
            },
            {
              text: 'Atom BASIC',
              link: '/reference/atom',
              collapsed: true,
              items: [
                { text: 'Hardware', link: '/reference/atom/hardware' },
                { text: 'Escape codes', link: '/reference/atom/escapes' },
                { text: 'File formats', link: '/reference/atom/formats' },
              ],
            },
            {
              text: 'BBC BASIC',
              link: '/reference/bbc',
              collapsed: true,
              items: [
                { text: 'Hardware', link: '/reference/bbc/hardware' },
                { text: 'Escape codes', link: '/reference/bbc/escapes' },
                { text: 'File formats', link: '/reference/bbc/formats' },
              ],
            },
            {
              // One page covers V2 (C64/VIC-20) and 4.0 (PET); the 4.0 disk
              // commands are tagged on the shared table.
              text: 'Commodore BASIC',
              link: '/reference/commodore',
              collapsed: true,
              items: [
                {
                  text: 'Hardware',
                  link: '/reference/commodore/hardware',
                },
                {
                  text: 'Escape codes',
                  link: '/reference/commodore/escapes',
                },
                {
                  text: 'File formats',
                  link: '/reference/commodore/formats',
                },
              ],
            },
            {
              text: 'Locomotive BASIC',
              link: '/reference/cpc',
              collapsed: true,
              items: [
                { text: 'Hardware', link: '/reference/cpc/hardware' },
                { text: 'Escape codes', link: '/reference/cpc/escapes' },
                { text: 'File formats', link: '/reference/cpc/formats' },
              ],
            },
            {
              text: 'TRS-80 Level II BASIC',
              link: '/reference/trs80',
              collapsed: true,
              items: [
                { text: 'Hardware', link: '/reference/trs80/hardware' },
                { text: 'Escape codes', link: '/reference/trs80/escapes' },
                { text: 'File formats', link: '/reference/trs80/formats' },
              ],
            },
            {
              text: 'ZX Spectrum BASIC',
              link: '/reference/zxspectrum',
              collapsed: true,
              items: [
                { text: 'Hardware', link: '/reference/zxspectrum/hardware' },
                {
                  text: 'Escape codes',
                  link: '/reference/zxspectrum/escapes',
                },
                {
                  text: 'File formats',
                  link: '/reference/zxspectrum/formats',
                },
              ],
            },
            {
              text: 'ZX80 BASIC',
              link: '/reference/zx80',
              collapsed: true,
              items: [
                { text: 'Hardware', link: '/reference/zx80/hardware' },
                { text: 'Escape codes', link: '/reference/zx80/escapes' },
                { text: 'File formats', link: '/reference/zx80/formats' },
              ],
            },
            {
              text: 'ZX81 BASIC',
              link: '/reference/zx81',
              collapsed: true,
              items: [
                { text: 'Hardware', link: '/reference/zx81/hardware' },
                { text: 'Escape codes', link: '/reference/zx81/escapes' },
                { text: 'File formats', link: '/reference/zx81/formats' },
              ],
            },
            {
              text: 'Assembly reference',
              items: [
                { text: 'Z80 assembly', link: '/reference/z80-assembly' },
                { text: '6502 assembly', link: '/reference/6502-assembly' },
              ],
            },
            {
              text: 'Porting guide',
              link: '/reference/compare',
              collapsed: true,
              items: [{ text: 'Basics', link: '/reference/porting-basics' }],
            },
          ],
        },
        {
          text: 'Formats & protocols',
          items: [
            { text: 'File formats', link: '/reference/file-formats' },
            {
              text: 'Memory management',
              link: '/reference/memory-management',
            },
            {
              text: 'Serial bridge protocol',
              link: '/reference/serial-protocol',
            },
          ],
        },
        {
          text: 'Contributing',
          items: [
            {
              text: 'Contributing guide',
              link: '/contributing/contributing',
            },
            {
              text: 'Community',
              link: '/contributing/community',
            },
            {
              text: 'Architecture',
              link: '/contributing/architecture',
            },
            {
              text: 'Adding a dialect',
              link: '/contributing/adding-a-dialect',
            },
            {
              text: 'Dialect roadmap',
              link: '/contributing/dialect-roadmap',
            },
          ],
        },
      ],

      editLink: {
        pattern: 'https://github.com/seanhodges/basically/edit/main/docs/:path',
        text: 'Edit this page on GitHub',
      },

      search: { provider: 'local' },

      footer: {
        message:
          'Released under GNU GPL v3.0. Some ROM images are third-party copyrighted works, separate to this project, strictly for personal/educational purposes.',
      },
    },

    // Make the docs an installable, offline PWA. The service worker precaches
    // every built page plus the local search index, so reading and search work
    // offline from first load; screenshots and non-latin glyphs cache on first
    // view instead (see the workbox block). Scope is /docs/ (the site's base),
    // nested under the app's root service worker. Icons are reused from the
    // app build (same origin) to avoid duplicating files into docs/public.
    pwa: {
      registerType: 'autoUpdate',
      outDir: '../dist/docs',
      includeAssets: [],
      manifest: {
        name: 'Basically Docs',
        short_name: 'Basically Docs',
        description: 'Offline documentation for the Basically BASIC web IDE.',
        id: '/docs/',
        scope: '/docs/',
        start_url: '/docs/',
        display: 'standalone',
        background_color: '#16181d',
        theme_color: '#16181d',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache the pages, the minisearch index, CSS and JS so the whole
        // site (including search) reads offline from first load. Screenshots
        // are deliberately NOT precached: docs/public/ is 2.6MB of PNG/JPG
        // (real-machine.png alone is 857KB), and pulling that down in the
        // background on first load competes with the navigation the reader is
        // waiting for. They cache at runtime on first view instead - the same
        // trade the app makes for ROM images (see the `roms` route in the
        // repo-root vite.config.ts). Same for the Cyrillic/Greek/Vietnamese
        // Inter subsets: most of the font bytes, and an English-language site
        // never requests them (their @font-face rules are unicode-range
        // gated, so the browser only fetches a subset a page actually needs).
        // The bundled character-graphics faces need no entry of their own: both
        // subsets are small enough (~3KB together) that Vite inlines them into
        // the stylesheet as data URIs, so the `**/*.css` pattern already carries
        // them - and the reference pages draw a machine's block graphics rather
        // than missing-glyph boxes offline too.
        globPatterns: ['**/*.{js,css,html,json,svg,ico}', '**/*-latin.*.woff2'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'docs-images',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: {
              cacheName: 'docs-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Strip the reference tables' deep-link params - the context-aware
        // help's `?q=` keyword search, the row-level `?name=` anchor, and the
        // escape tables' `?cat=` category - (alongside the workbox defaults)
        // before matching a request against the precache. Without this, a
        // deep link like `reference/commodore?q=poke` misses the precached
        // `reference/commodore.html`, so the SPA NavigationRoute falls
        // back to the precached home `index.html` - rendering the home hero
        // above the reference page until VitePress client-routes over it.
        ignoreURLParametersMatching: [
          /^utm_/,
          /^fbclid$/,
          /^q$/,
          /^cat$/,
          /^name$/,
          // The compare page's source/target selection (?from=&to=), so a
          // shared comparison deep link still matches the precached page.
          /^from$/,
          /^to$/,
        ],
      },
    },
  }),
);
