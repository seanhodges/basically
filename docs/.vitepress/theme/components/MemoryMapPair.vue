<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { MemoryMap } from '../../../../src/dialects/types';
import type { MapWriteSite } from '../../../../src/components/MemoryMapView';
// Pure arithmetic, and deliberately not from MemoryMapView itself: that module
// is React, and importing it here statically would put React on every page of
// the site - the thing the dynamic import below exists to prevent.
import { zoomToFit } from '../../../../src/components/memoryScale';

/**
 * The porting guide's memory-layout section: both machines' maps, drawn against
 * one shared address scale, as a React island.
 *
 * Two dynamic hops keep React off every other page, exactly as MachinePicker.vue
 * does it - this component is registered with `defineAsyncComponent`
 * (theme/index.ts) and `import()`s react-dom below rather than importing it
 * statically, so VitePress does not emit a modulepreload for the React chunk on
 * every page of the site.
 *
 * Everything that decides how the maps are read lives here rather than in either
 * pane, because it belongs to the pair: two panes at different zooms are two
 * pictures, not one comparison. That includes the scroll offset, which is what
 * makes the tabbed layout worth having - flipping between the machines shows the
 * same addresses on the other one rather than starting again at the top.
 */

const props = defineProps<{
  fromName: string;
  toName: string;
  fromMap: MemoryMap;
  toMap: MemoryMap;
  fromByIndirection?: boolean;
  toByIndirection?: boolean;
  /** Addresses the open program writes to, resolved for the source machine. */
  sites: MapWriteSite[];
  /** The source machine's own notation, which the section opens in. */
  notation: 'hex' | 'dec';
}>();

/** The zoom control's range, in multiples of the fitted zoom: 1 is the whole
 *  map at the height of its pane, 24 is twenty-four times that. */
const MIN_ZOOM = 1;
const MAX_ZOOM = 24;

/**
 * The zoom at which the map being ported *from* is exactly the height of the
 * pane holding it, measured once the panes have been drawn.
 *
 * The source map is what it is measured against - the target follows the same
 * zoom, as it must for the two to be one comparison, and every map covers the
 * same address space (`src/dialects/memoryMap.test.ts`), so fitting one fits
 * both. Until the measurement arrives it is 1, the zoom the maps were drawn at
 * before they were fitted to anything, so a pane that never lays out (a
 * pre-rendered page, a hidden tab) still draws a whole map.
 */
const fitZoom = ref(1);

/**
 * The zoom, counted in fitted panes rather than in pixels-per-byte: level 1
 * fills the pane exactly, level 3 draws three panes' worth of column.
 *
 * It is the reader's setting, and the fit is the pane's - keeping them apart is
 * what lets the maps be re-fitted when the section is resized without moving
 * the reader off the addresses they were looking at.
 */
const zoomLevel = ref(MIN_ZOOM);

/** What the maps are actually drawn at. */
const zoom = computed(() => zoomLevel.value * fitZoom.value);

const notation = ref<'hex' | 'dec'>(props.notation);
const showDetails = ref(false);
const scrollTop = ref(0);
const active = ref<'from' | 'to'>('from');
const selectedFrom = ref<string | null>(null);
const selectedTo = ref<string | null>(null);

/** True while there is not enough width for two columns; the panes become tabs. */
const tabbed = ref(false);

const host = ref<HTMLElement | null>(null);
const ready = ref(false);

const clamp = (level: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
const setLevel = (level: number) => {
  zoomLevel.value = clamp(level);
};
const nudge = (delta: number) => setLevel(zoomLevel.value + delta);

/**
 * Fit the maps to the pane they are drawn in.
 *
 * The pane's height is a matter of layout - it depends on the CSS, on whether
 * the panes are tabbed, and inside the IDE on how wide the reader has dragged
 * the documentation drawer - so it is measured rather than assumed. The
 * scrolling column is the view's own element and carries a CSS-module class, so
 * it is matched by substring the way `MemoryMapPanel` matches it in the app.
 *
 * A hidden pane (the inactive tab) measures zero and is skipped: it has no
 * layout to read, and the fit it would produce is not one.
 */
function fitToPane() {
  const column = host.value?.querySelector<HTMLElement>('[class*="mapScroll"]');
  const px = column?.clientHeight ?? 0;
  if (px <= 0) return;
  const fit = zoomToFit(props.fromMap.addressSpace, px);
  if (Math.abs(fit - fitZoom.value) > 0.001) fitZoom.value = fit;
}

/** The source machine's notation is what the section opens in; a machine chosen
 *  later re-seeds it, unless the reader has already made the choice their own. */
const notationTouched = ref(false);
watch(
  () => props.notation,
  (next) => {
    if (!notationTouched.value) notation.value = next;
  },
);

const setNotation = (next: 'hex' | 'dec') => {
  notationTouched.value = true;
  notation.value = next;
};

/** Tabs, in reading order: the machine being ported from comes first. */
const tabs = computed(
  () =>
    [
      { side: 'from' as const, name: props.fromName },
      { side: 'to' as const, name: props.toName },
    ] satisfies { side: 'from' | 'to'; name: string }[],
);

/** Left/right arrows move between the tabs, as a tablist is expected to. */
function onTabKey(e: KeyboardEvent) {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  e.preventDefault();
  active.value = active.value === 'from' ? 'to' : 'from';
  nextTick(() => {
    document.getElementById(`mm-tab-${active.value}`)?.focus();
  });
}

interface ReactRoot {
  render: (node: unknown) => void;
  unmount: () => void;
}

let root: ReactRoot | null = null;
let renderPair: (() => void) | null = null;
let media: MediaQueryList | null = null;
let onMedia: (() => void) | null = null;
let sizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  // Measured in this frame, which inside the IDE is the documentation drawer -
  // so the same query answers "narrow phone" and "narrow drawer".
  media = window.matchMedia('(max-width: 640px)');
  tabbed.value = media.matches;
  onMedia = () => {
    tabbed.value = !!media?.matches;
  };
  media.addEventListener('change', onMedia);

  const [{ createRoot }, { createElement }, { MemoryMapPair }] =
    await Promise.all([
      import('react-dom/client'),
      import('react'),
      import('./MemoryMapPair'),
    ]);

  // <ClientOnly> renders nothing until its own onMounted, so the host element
  // appears a tick after ours.
  await nextTick();
  if (!host.value) return;
  root = createRoot(host.value);

  renderPair = () => {
    root?.render(
      createElement(MemoryMapPair, {
        from: {
          name: props.fromName,
          map: props.fromMap,
          byIndirection: props.fromByIndirection,
        },
        to: {
          name: props.toName,
          map: props.toMap,
          byIndirection: props.toByIndirection,
        },
        zoom: zoom.value,
        notation: notation.value,
        showDetails: showDetails.value,
        scrollTop: scrollTop.value,
        sites: props.sites,
        active: active.value,
        tabbed: tabbed.value,
        selectedFrom: selectedFrom.value,
        selectedTo: selectedTo.value,
        onSelect: (side: 'from' | 'to', key: string) => {
          if (side === 'from') selectedFrom.value = key;
          else selectedTo.value = key;
        },
        onScrollChange: (top: number) => {
          scrollTop.value = top;
        },
        // Pinch and Ctrl-wheel arrive as a new absolute zoom, which is the
        // reader's level once the pane's own fit is divided back out of it.
        onZoomGesture: (next: (z: number) => number) => {
          setLevel(next(zoom.value) / fitZoom.value);
        },
      }),
    );
  };

  ready.value = true;
  renderPair();

  // The maps open at the height of the pane holding them, and that height is
  // only known once React has drawn them - so the fit is taken from the DOM,
  // and taken again whenever the section is resized (the drawer dragged wider,
  // the panes becoming tabs). Observing the host covers the first draw too: it
  // is empty when the observation starts and has the panes in it a frame later.
  if (typeof ResizeObserver !== 'undefined') {
    sizeObserver = new ResizeObserver(fitToPane);
    sizeObserver.observe(host.value);
  }
  fitToPane();
});

// A React root does not re-render itself when Vue's state moves, so everything
// the island reads is pushed back into it here.
watch(
  () =>
    [
      props.fromName,
      props.toName,
      props.fromMap,
      props.toMap,
      props.sites,
      zoom.value,
      notation.value,
      showDetails.value,
      scrollTop.value,
      active.value,
      tabbed.value,
      selectedFrom.value,
      selectedTo.value,
    ] as const,
  () => renderPair?.(),
);

// Tabbing moves each machine's name out of its pane and into a tab, so the pane
// holds a taller column than it did: re-fit once the island has redrawn, which
// React does a frame after the state that caused it moved.
watch([tabbed, active], () => requestAnimationFrame(fitToPane));

// A new pair is a new comparison: the reader's place in the old one says nothing
// about this one, so selection goes back to nothing. Zoom, notation and scroll
// are how the reader is reading, not what they are reading, and stay.
watch(
  () => [props.fromMap, props.toMap] as const,
  () => {
    selectedFrom.value = null;
    selectedTo.value = null;
  },
);

onUnmounted(() => {
  root?.unmount();
  root = null;
  renderPair = null;
  sizeObserver?.disconnect();
  sizeObserver = null;
  if (media && onMedia) media.removeEventListener('change', onMedia);
});
</script>

<template>
  <div class="mm-root">
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

      <div class="mm-notation" role="group" aria-label="Address notation">
        <button
          type="button"
          :class="{ 'mm-on': notation === 'hex' }"
          :aria-pressed="notation === 'hex'"
          @click="setNotation('hex')"
        >
          Hex
        </button>
        <button
          type="button"
          :class="{ 'mm-on': notation === 'dec' }"
          :aria-pressed="notation === 'dec'"
          @click="setNotation('dec')"
        >
          Int
        </button>
      </div>

      <div class="mm-zoom">
        <button
          type="button"
          class="mm-zoom-btn"
          :disabled="zoomLevel <= MIN_ZOOM"
          aria-label="Zoom out"
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
          aria-label="Zoom level"
          @input="setLevel(Number(($event.target as HTMLInputElement).value))"
        />
        <button
          type="button"
          class="mm-zoom-btn"
          :disabled="zoomLevel >= MAX_ZOOM"
          aria-label="Zoom in"
          @click="nudge(2)"
        >
          +
        </button>
      </div>
    </div>

    <!-- Only when there is no room for both. The two names are the tabs: which
         machine you are looking at is the whole question a tab has to answer. -->
    <div
      v-if="tabbed"
      class="mm-tabs"
      role="tablist"
      aria-label="Machine to show the memory layout for"
    >
      <button
        v-for="tab in tabs"
        :id="`mm-tab-${tab.side}`"
        :key="tab.side"
        type="button"
        role="tab"
        class="mm-tab"
        :class="{ 'mm-on': active === tab.side }"
        :aria-selected="active === tab.side"
        :tabindex="active === tab.side ? 0 : -1"
        :aria-controls="`mm-panel-${tab.side}`"
        @click="active = tab.side"
        @keydown="onTabKey"
      >
        {{ tab.name }}
      </button>
    </div>

    <div class="mm-slot">
      <ClientOnly><div ref="host"></div></ClientOnly>
      <p v-if="!ready" class="mm-placeholder" aria-hidden="true"></p>
    </div>

    <!-- Only the program's own marks are explained: nothing else on the maps
         needs words, and a hint that describes the picture is one more thing to
         read before looking at it. -->
    <p v-if="sites.length" class="mm-hint">
      Each amber line marks an address your program writes to — on
      {{ fromName }} where the program put it, and on {{ toName }} where it
      would land.
    </p>
  </div>
</template>

<!-- The tokens and the control strip, shared with the hardware pages' maps. -->
<style src="./memoryMap.css"></style>

<!--
  Unscoped on purpose: React renders the panes' markup, so Vue's scope attribute
  never reaches it. Every selector is `mm-` prefixed instead.
-->
<style>
.mm-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.mm-tab {
  padding: 6px 12px;
  font-size: 13px;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid transparent;
  border-bottom: none;
  border-radius: 5px 5px 0 0;
  cursor: pointer;
}

.mm-tab.mm-on {
  color: var(--text);
  background: var(--bg-panel);
  border-color: var(--border);
  margin-bottom: -1px;
}

/* Two columns of equal width, so the same address sits at the same height in
   both and the comparison can be read straight across. */
.mm-panes {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  align-items: start;
}

/* Tabbed: one pane at a time, taking the full width. */
.mm-panes-tabbed {
  grid-template-columns: 1fr;
}

.mm-pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* Tall enough that the 64K column is worth scrolling, short enough that the
     section does not push the rest of the comparison off the page. */
  height: 460px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}

.mm-pane[hidden] {
  display: none;
}

.mm-pane-name {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  margin: 0;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
}

.mm-pane-role {
  font-size: 11px;
  font-weight: normal;
  color: var(--text-dim);
}

.mm-hint {
  margin: 0.75rem 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-dim);
}
</style>
