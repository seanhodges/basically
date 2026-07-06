<script setup lang="ts">
import DefaultTheme, { VPHomeHero, VPHomeFeatures } from 'vitepress/theme';
import { useData } from 'vitepress';
import { onMounted, ref } from 'vue';

const { Layout } = DefaultTheme;

// The home page (index.md) drops `layout: home` so it gets the default `doc`
// layout - and thus the sidebar - like every other page. We re-render its hero
// and features from frontmatter via the #doc-before slot below. These VitePress
// components read `hero`/`features` from frontmatter themselves.
const { frontmatter } = useData();

// The IDE hosts these docs in an iframe (see src/components/DocsDrawer.tsx); a
// standalone visit is top-level. Only then do we show the drawer close button
// and suppress the nav hamburger (see custom.css `.in-ide-drawer`). Detection is
// client-only so the SSR/standalone build is unaffected.
const embedded = ref(false);

onMounted(() => {
  if (window.parent !== window.self) {
    embedded.value = true;
    document.documentElement.classList.add('in-ide-drawer');
  }
});

// Ask the host IDE to close the drawer. The IDE listens for this on `window`
// (DocsDrawer.tsx) and calls its store's `closeDocs()`. Same-origin, so we can
// target the exact origin rather than '*'.
function closeDrawer() {
  window.parent.postMessage(
    { type: 'basically:docs-close' },
    window.location.origin,
  );
}
</script>

<template>
  <Layout>
    <!-- Home page hero + features, rendered above the doc content so the page
         keeps the sidebar/`doc` layout while retaining its landing sections. -->
    <template #doc-before>
      <div
        v-if="frontmatter.hero || frontmatter.features"
        class="home-sections"
      >
        <VPHomeHero v-if="frontmatter.hero" />
        <VPHomeFeatures v-if="frontmatter.features" />
      </div>
    </template>
    <template #nav-bar-content-after>
      <button
        v-if="embedded"
        class="ide-drawer-close"
        type="button"
        title="Close documentation"
        aria-label="Close documentation"
        @click="closeDrawer"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </template>
  </Layout>
</template>
