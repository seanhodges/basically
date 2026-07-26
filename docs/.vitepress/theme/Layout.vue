<script setup lang="ts">
import DefaultTheme, { VPHomeHero, VPHomeFeatures } from 'vitepress/theme';
import { useData, useRouter, withBase } from 'vitepress';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { DEEP_LINK_EVENT } from './deepLinkParams';

const { Layout } = DefaultTheme;

// The home page (index.md) drops `layout: home` so it gets the default `doc`
// layout - and thus the sidebar - like every other page. We re-render its hero
// and features from frontmatter via the #doc-before slot below. These VitePress
// components read `hero`/`features` from frontmatter themselves.
const { frontmatter } = useData();

// Message types exchanged with the host IDE (src/components/DocsDrawer.tsx),
// kept in sync with that file by string. `docs-ready` tells the host our
// listener is attached; `docs-navigate` asks us to route to a new topic.
const DOCS_READY_MESSAGE = 'basically:docs-ready';
const DOCS_NAVIGATE_MESSAGE = 'basically:docs-navigate';

// The IDE hosts these docs in an iframe (see src/components/DocsDrawer.tsx); a
// standalone visit is top-level. Only then do we show the drawer close button
// and suppress the nav hamburger (see custom.css `.in-ide-drawer`). Detection is
// client-only so the SSR/standalone build is unaffected.
const embedded = ref(false);

const router = useRouter();

/**
 * Route this frame on the host's behalf. The drawer used to re-point the
 * iframe's `src` for each new topic, which reloaded the whole docs document -
 * and its service worker registration - every time context-aware help opened.
 * Client-routing instead keeps the loaded app alive.
 */
async function onHostMessage(e: MessageEvent) {
  if (e.origin !== window.location.origin) return;
  const data = e.data;
  if (!data || typeof data !== 'object') return;
  if (data.type !== DOCS_NAVIGATE_MESSAGE || typeof data.path !== 'string') {
    return;
  }
  // The host sends a base-relative topic ('reference/zx81?q=PRINT'); withBase
  // only prefixes the site base onto a rooted path, so root it first.
  await router.go(withBase(`/${data.path.replace(/^\/+/, '')}`));
  // A VitePress route tracks only the path, so a same-page topic change (a new
  // `?q=`) re-uses the page component and never remounts it. Nudge the
  // param-seeded tables to re-read the query string.
  window.dispatchEvent(new CustomEvent(DEEP_LINK_EVENT));
}

onMounted(() => {
  if (window.parent === window.self) return;
  embedded.value = true;
  document.documentElement.classList.add('in-ide-drawer');
  window.addEventListener('message', onHostMessage);
  window.parent.postMessage(
    { type: DOCS_READY_MESSAGE },
    window.location.origin,
  );
});

onBeforeUnmount(() => window.removeEventListener('message', onHostMessage));

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
