import { defineConfig } from 'vitepress';
import { withPwa } from '@vite-pwa/vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

// Docs site for Basically, published at https://ba.sical.ly/docs.
// The app (a Vite SPA) is served from the root of the same deployment;
// this site lives under the /docs subpath. `outDir` writes the
// built docs into the app's `dist/` artifact so a single Pages deploy ships
// both. See .github/workflows/deploy.yml.
export default withPwa(
  withMermaid(
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

      // Shiki has no generic "basic" grammar; alias our ```basic fences to the
      // Visual Basic grammar so BASIC keywords/strings still get highlighted.
      markdown: {
        languageAlias: { basic: 'vb' },
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
              // Each dialect page nests its searchable escape-codes sub-page
              // (the "embedded control codes & graphics" reference).
              {
                text: 'ZX81 BASIC',
                link: '/reference/zx81',
                collapsed: true,
                items: [
                  { text: 'Escape codes', link: '/reference/zx81/escapes' },
                  { text: 'File formats', link: '/reference/zx81/formats' },
                ],
              },
              {
                text: 'ZX80 integer BASIC',
                link: '/reference/zx80',
                collapsed: true,
                items: [
                  { text: 'Escape codes', link: '/reference/zx80/escapes' },
                  { text: 'File formats', link: '/reference/zx80/formats' },
                ],
              },
              {
                text: 'ZX Spectrum BASIC',
                link: '/reference/zxspectrum',
                collapsed: true,
                items: [
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
                text: 'BBC BASIC',
                link: '/reference/bbc',
                collapsed: true,
                items: [
                  { text: 'Escape codes', link: '/reference/bbc/escapes' },
                  { text: 'File formats', link: '/reference/bbc/formats' },
                ],
              },
              {
                text: 'Commodore 64 & VIC-20 BASIC',
                link: '/reference/commodore64',
                collapsed: true,
                items: [
                  {
                    text: 'Escape codes',
                    link: '/reference/commodore64/escapes',
                  },
                  {
                    text: 'File formats',
                    link: '/reference/commodore64/formats',
                  },
                ],
              },
              {
                text: 'Commodore PET BASIC 4.0',
                link: '/reference/pet',
              },
              {
                text: 'Acorn Atom BASIC',
                link: '/reference/atom',
                collapsed: true,
                items: [
                  { text: 'Escape codes', link: '/reference/atom/escapes' },
                  { text: 'File formats', link: '/reference/atom/formats' },
                ],
              },
              {
                text: 'TRS-80 Level II BASIC',
                link: '/reference/trs80',
                collapsed: true,
                items: [
                  { text: 'Escape codes', link: '/reference/trs80/escapes' },
                  { text: 'File formats', link: '/reference/trs80/formats' },
                ],
              },
            ],
          },
          {
            // The assembler is per-CPU, not per-dialect, so machine-code blocks
            // share one instruction reference per processor.
            text: 'Assembly reference',
            items: [
              { text: 'Z80 assembly', link: '/reference/z80-assembly' },
              { text: '6502 assembly', link: '/reference/6502-assembly' },
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
          pattern:
            'https://github.com/seanhodges/basically/edit/main/docs/:path',
          text: 'Edit this page on GitHub',
        },

        search: { provider: 'local' },

        footer: {
          message:
            'Released under GNU GPL v3.0. Some ROM images are third-party copyrighted works, separate to this project, strictly for personal/educational purposes.',
        },
      },

      // Make the docs an installable, fully-offline PWA. The service worker
      // precaches every built page plus the local search index and images, so
      // search and screenshots work offline too. Scope is /docs/ (the site's
      // base), nested under the app's root service worker. Icons are reused from
      // the app build (same origin) to avoid duplicating files into docs/public.
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
          // Precache pages, assets, the minisearch index, and images so the whole
          // site (including search) is available offline after first load.
          globPatterns: ['**/*.{js,css,html,json,png,jpg,svg,ico,woff2}'],
          maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          // Strip the context-aware help's `?q=` keyword param and the escape
          // tables' `?cat=` category param (alongside the workbox defaults)
          // before matching a request against the precache. Without this, a
          // deep link like `reference/commodore64?q=poke` misses the precached
          // `reference/commodore64.html`, so the SPA NavigationRoute falls
          // back to the precached home `index.html` - rendering the home hero
          // above the reference page until VitePress client-routes over it.
          ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^q$/, /^cat$/],
        },
      },
    }),
  ),
);
