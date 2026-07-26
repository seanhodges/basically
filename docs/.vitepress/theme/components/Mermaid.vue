<script setup lang="ts">
import { onMounted, ref } from 'vue';

// Renders one ```mermaid fence. The markdown-it rule wired up in
// .vitepress/config.ts (MermaidMarkdown) replaces each fence with one of these,
// wrapped in <Suspense>, passing the graph source URI-encoded.
//
// mermaid is import()ed here at mount rather than imported statically, and this
// component is itself registered with defineAsyncComponent (theme/index.ts).
// Those two dynamic hops are what keep mermaid off every other page: VitePress
// emits a <link rel="modulepreload"> for each *direct* dynamic import of the app
// entry chunk, so a statically-imported mermaid drags its 38 diagram types and
// katex - ~2.1MB raw - into the preload list of all 39 pages, only one of which
// has a diagram.
const props = defineProps<{
  id: string;
  graph: string;
  class?: string;
}>();

const svg = ref<string | null>(null);

onMounted(async () => {
  const { default: mermaid } = await import('mermaid');
  // The site is `appearance: 'force-dark'`, so there is no theme toggle to
  // follow - render once, in the dark theme.
  mermaid.initialize({
    securityLevel: 'loose',
    startOnLoad: false,
    theme: 'dark',
  });
  const rendered = await mermaid.render(
    props.id,
    decodeURIComponent(props.graph),
  );
  svg.value = rendered.svg;
});
</script>

<template>
  <div :class="props.class" v-html="svg"></div>
</template>
