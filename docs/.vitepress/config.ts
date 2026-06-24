import { defineConfig } from 'vitepress';

// Docs site for Basically, published at https://ba.sical.ly/docs.
// The app (a Vite SPA) is served from the root of the same GitHub Pages
// deployment; this site lives under the /docs subpath. `outDir` writes the
// built docs into the app's `dist/` artifact so a single Pages deploy ships
// both. See .github/workflows/deploy.yml.
export default defineConfig({
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
    /dialect-plans\/.+/, // per-dialect plans are generated on demand by the
    // adding-a-target-system skill and may not be checked in (e.g. the roadmap
    // links to a plan whose file was removed once the dialect shipped).
  ],

  themeConfig: {
    logo: { light: '/logo-light.png', dark: '/logo-dark.png' },

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/file-formats' },
      { text: 'Contributing', link: '/adding-a-dialect' },
      { text: 'Open the IDE ↗', link: 'https://ba.sical.ly/' },
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
          { text: 'File formats', link: '/file-formats' },
          { text: 'Serial bridge protocol', link: '/serial-protocol' },
          { text: 'Dialect roadmap', link: '/dialect-roadmap' },
        ],
      },
      {
        text: 'Contributing',
        items: [
          { text: 'Adding a dialect', link: '/adding-a-dialect' },
          {
            text: 'Adding a virtual keyboard',
            link: '/adding-a-virtual-keyboard',
          },
          { text: 'Dialect plans', link: '/dialect-plans/README' },
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
        'Released under the GNU GPL v3.0 or later. ROM images are third-party copyrighted works.',
      copyright: 'Basically — a web IDE for microcomputer BASIC.',
    },
  },
});
