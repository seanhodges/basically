<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { MemoryMap } from '../../../../src/dialects/types';
// Pure arithmetic, and deliberately not from MemoryMapView itself: that module
// is React, and importing it here statically would put React on every page of
// the site - the thing the dynamic import below exists to prevent.
import { zoomToFit } from '../../../../src/components/memoryScale';
import { machines } from '../../../../src/reference/machines';
import { portingFacts } from '../../../../src/reference/facts';
import { writesByIndirection } from '../../../../src/reference/types';

/**
 * One machine's memory layout, in that machine's own reference documentation, as
 * a React island.
 *
 * Two dynamic hops keep React off every other page, exactly as MemoryMapPair.vue
 * does it - this component is registered with `defineAsyncComponent`
 * (theme/index.ts) and `import()`s react-dom below rather than importing it
 * statically, so VitePress does not emit a modulepreload for the React chunk on
 * every page of the site.
 *
 * Everything that decides how the map is read lives in this instance, so a page
 * showing several machines shows several accounts rather than one comparison:
 * zooming the C64's layout leaves the VIC-20's where the reader left it. That is
 * the opposite of the pair, where one setting governing both is the whole point.
 */

const props = defineProps<{
  /** Dialect id, e.g. "commodore64". Names the map and picks its notation. */
  machine: string;
  map: MemoryMap;
}>();

/** The zoom control's range, in multiples of the fitted zoom: 1 is the whole
 *  map at the height of its box, 24 is twenty-four times that. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;

/** The machine's display name, and how it writes and reads addresses. Both come
 *  from the modules the porting guide reads, which their crosscheck tests pin to
 *  the dialect registry - so a page never repeats a per-machine constant. */
const name = computed(
  () => machines.find((m) => m.id === props.machine)?.name ?? props.machine,
);
const facts = computed(() => portingFacts.find((f) => f.id === props.machine));
const byIndirection = computed(() => {
  const f = facts.value;
  return f ? writesByIndirection(f) : false;
});

/**
 * The zoom at which the map is exactly the height of the box holding it,
 * measured once it has been drawn.
 *
 * Until the measurement arrives it is 1, the zoom the map was drawn at before it
 * was fitted to anything, so a box that never lays out still draws a whole map.
 */
const fitZoom = ref(1);

/**
 * The zoom, counted in fitted boxes rather than in pixels-per-byte: level 1 fills
 * the box exactly, level 3 draws three boxes' worth of column.
 *
 * It is the reader's setting, and the fit is the box's - keeping them apart is
 * what lets the map be re-fitted when the page is resized without moving the
 * reader off the addresses they were looking at.
 */
const zoomLevel = ref(MIN_ZOOM);

/** What the map is actually drawn at. */
const zoom = computed(() => zoomLevel.value * fitZoom.value);

/** The machine's own notation is what the map opens in. */
const notation = ref<'hex' | 'dec'>(facts.value?.addressNotation ?? 'hex');
const showDetails = ref(false);
const selectedKey = ref<string | null>(null);

const host = ref<HTMLElement | null>(null);
const ready = ref(false);

const clamp = (level: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
const setLevel = (level: number) => {
  zoomLevel.value = clamp(level);
};
const nudge = (delta: number) => setLevel(zoomLevel.value + delta);

/**
 * Fit the map to the box it is drawn in.
 *
 * The box's height is a matter of layout - it depends on the CSS and, inside the
 * IDE, on how wide the reader has dragged the documentation drawer - so it is
 * measured rather than assumed. The scrolling column is the view's own element
 * and carries a CSS-module class, so it is matched by substring the way
 * `MemoryMapPanel` matches it in the app.
 */
function fitToBox() {
  const column = host.value?.querySelector<HTMLElement>('[class*="mapScroll"]');
  const px = column?.clientHeight ?? 0;
  if (px <= 0) return;
  const fit = zoomToFit(props.map.addressSpace, px);
  if (Math.abs(fit - fitZoom.value) > 0.001) fitZoom.value = fit;
}

interface ReactRoot {
  render: (node: unknown) => void;
  unmount: () => void;
}

let root: ReactRoot | null = null;
let renderMap: (() => void) | null = null;
let sizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  const [{ createRoot }, { createElement }, { MemoryMapSingle }] =
    await Promise.all([
      import('react-dom/client'),
      import('react'),
      import('./MemoryMapSingle'),
    ]);

  // <ClientOnly> renders nothing until its own onMounted, so the host element
  // appears a tick after ours.
  await nextTick();
  if (!host.value) return;
  root = createRoot(host.value);

  renderMap = () => {
    root?.render(
      createElement(MemoryMapSingle, {
        name: name.value,
        map: props.map,
        byIndirection: byIndirection.value,
        zoom: zoom.value,
        notation: notation.value,
        showDetails: showDetails.value,
        selectedKey: selectedKey.value,
        onSelect: (key: string) => {
          selectedKey.value = key;
        },
        // Pinch and Ctrl-wheel arrive as a new absolute zoom, which is the
        // reader's level once the box's own fit is divided back out of it.
        onZoomGesture: (next: (z: number) => number) => {
          setLevel(next(zoom.value) / fitZoom.value);
        },
      }),
    );
  };

  ready.value = true;
  renderMap();

  // The map opens at the height of the box holding it, and that height is only
  // known once React has drawn it - so the fit is taken from the DOM, and taken
  // again whenever the page is resized (the drawer dragged wider). Observing the
  // host covers the first draw too: it is empty when the observation starts and
  // has the map in it a frame later.
  if (typeof ResizeObserver !== 'undefined') {
    sizeObserver = new ResizeObserver(fitToBox);
    sizeObserver.observe(host.value);
  }
  fitToBox();
});

// A React root does not re-render itself when Vue's state moves, so everything
// the island reads is pushed back into it here.
watch(
  () =>
    [
      props.map,
      zoom.value,
      notation.value,
      showDetails.value,
      selectedKey.value,
    ] as const,
  () => renderMap?.(),
);

onUnmounted(() => {
  root?.unmount();
  root = null;
  renderMap = null;
  sizeObserver?.disconnect();
  sizeObserver = null;
});
</script>

<template>
  <!-- Every control names its machine: a page covering three of them has three
       of these strips, and "Zoom level" three times over says nothing about
       which map moves. -->
  <div class="mm-root mm-single">
    <div class="mm-controls">
      <button
        type="button"
        class="mm-details"
        :class="{ 'mm-on': showDetails }"
        :aria-pressed="showDetails"
        @click="showDetails = !showDetails"
      >
        Show region details
      </button>

      <div
        class="mm-notation"
        role="group"
        :aria-label="`Address notation for the ${name}`"
      >
        <button
          type="button"
          :class="{ 'mm-on': notation === 'hex' }"
          :aria-pressed="notation === 'hex'"
          @click="notation = 'hex'"
        >
          Hex
        </button>
        <button
          type="button"
          :class="{ 'mm-on': notation === 'dec' }"
          :aria-pressed="notation === 'dec'"
          @click="notation = 'dec'"
        >
          Int
        </button>
      </div>

      <div class="mm-zoom">
        <button
          type="button"
          class="mm-zoom-btn"
          :disabled="zoomLevel <= MIN_ZOOM"
          :aria-label="`Zoom out of the ${name} memory map`"
          @click="nudge(-2)"
        >
          −
        </button>
        <input
          type="range"
          class="mm-zoom-slider"
          :min="MIN_ZOOM"
          :max="MAX_ZOOM"
          :step="1"
          :value="zoomLevel"
          :aria-label="`Zoom level for the ${name} memory map`"
          @input="setLevel(Number(($event.target as HTMLInputElement).value))"
        />
        <button
          type="button"
          class="mm-zoom-btn"
          :disabled="zoomLevel >= MAX_ZOOM"
          :aria-label="`Zoom into the ${name} memory map`"
          @click="nudge(2)"
        >
          +
        </button>
      </div>
    </div>

    <div class="mm-slot">
      <ClientOnly><div ref="host"></div></ClientOnly>
      <p v-if="!ready" class="mm-placeholder" aria-hidden="true"></p>
    </div>
  </div>
</template>

<!-- The tokens and the control strip, shared with the porting guide's pair. -->
<style src="./memoryMap.css"></style>

<!--
  Unscoped on purpose: React renders the map's markup, so Vue's scope attribute
  never reaches it. Every selector is `mm-` prefixed instead.
-->
<style>
.mm-single {
  margin: 0 0 1.5rem;
}

.mm-single-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* Tall enough that the 64K column is worth scrolling, short enough that the
     map does not push the section's prose off the page. */
  height: 420px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
</style>
