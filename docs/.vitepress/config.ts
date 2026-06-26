import { defineConfig } from 'vitepress';
import { withPwa } from '@vite-pwa/vitepress';

// Docs site for Basically, published at https://ba.sical.ly/docs.
// The app (a Vite SPA) is served from the root of the same GitHub Pages
// deployment; this site lives under the /docs subpath. `outDir` writes the
// built docs into the app's `dist/` artifact so a single Pages deploy ships
// both. See .github/workflows/deploy.yml.
export default withPwa(
  defineConfig({
    title: 'Basically',
    description:
      'A web IDE for microcomputer BASIC — write, run and ship games for real retro hardware from your browser.',
    base: '/docs/',
    outDir: '../dist/docs',
    lang: 'en-GB',
    cleanUrls: true,
    lastUpdated: true,

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
      logo: { light: '/logo-light.png', dark: '/logo-dark.png' },
      // The logo image already includes the word "Basically", so hide the
      // redundant title text next to it in the nav (see theme/custom.css for the
      // matching logo size bump).
      siteTitle: false,

      nav: [
        { text: 'Guide', link: '/guide/getting-started' },
        { text: 'Reference', link: '/reference/file-formats' },
        { text: 'Languages', link: '/reference/' },
        { text: 'Contributing', link: '/contributing/contributing' },
        { text: 'Open the IDE', link: 'https://ba.sical.ly/' },
      ],

      sidebar: [
        {
          text: 'Guide',
          items: [
            { text: 'Welcome', link: '/' },
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Writing BASIC', link: '/guide/writing-basic' },
            { text: 'Running on real hardware', link: '/guide/hardware' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'File formats', link: '/reference/file-formats' },
            {
              text: 'Serial bridge protocol',
              link: '/reference/serial-protocol',
            },
          ],
        },
        {
          text: 'Language reference',
          items: [
            { text: 'Overview', link: '/reference/' },
            { text: 'ZX81 BASIC', link: '/reference/zx81' },
            { text: 'ZX80 integer BASIC', link: '/reference/zx80' },
            { text: 'ZX Spectrum BASIC', link: '/reference/zxspectrum' },
            { text: 'BBC BASIC', link: '/reference/bbc' },
            { text: 'Commodore BASIC', link: '/reference/commodore64' },
            { text: 'Acorn Atom BASIC', link: '/reference/atom' },
            { text: 'TRS-80 Level II BASIC', link: '/reference/trs80' },
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
              text: 'Adding a dialect',
              link: '/contributing/adding-a-dialect',
            },
            { text: 'Dialect roadmap', link: '/contributing/dialect-roadmap' },
          ],
        },
      ],

      socialLinks: [
        { icon: 'github', link: 'https://github.com/seanhodges/basically' },
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
      },
    },
  }),
);
