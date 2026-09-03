<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  MAX_SCALE,
  MIN_SCALE,
  ZOOM_STEP,
  clampPan,
  clampScale,
  distance,
  initialView,
  midpoint,
  zoomAbout,
  type Point,
  type Size,
  type ViewTransform,
} from '../diagramZoom';

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
//
// The inline diagram is a button rather than a picture, because a diagram drawn
// wider than the column it lands in is scaled down to fit and its labels go
// with it: the widest flowchart here renders its 16px text at 4px in a desktop
// article and 2px on a phone. Activating it opens the viewer below, which is
// the only place those diagrams can actually be read.
const props = defineProps<{
  id: string;
  graph: string;
  class?: string;
}>();

const svg = ref<string | null>(null);
/** The diagram's own drawn size, read from the SVG's viewBox once rendered. */
const naturalSize = ref<Size | null>(null);

onMounted(async () => {
  const { default: mermaid } = await import('mermaid');
  // The site is `appearance: 'force-dark'`, so there is no theme toggle to
  // follow - render once, in the dark theme.
  mermaid.initialize({
    securityLevel: 'loose',
    startOnLoad: false,
    theme: 'dark',
    // Sequence diagrams are laid out from fixed per-actor widths rather than
    // from their content, and mermaid's defaults are generous enough that a
    // six-actor diagram is drawn ~1900px wide - which in a 688px article column
    // is a 0.35 downscale before a phone is even considered. Tightening the
    // actor spacing costs nothing legible and buys back most of that width.
    sequence: {
      actorMargin: 28,
      width: 110,
      boxMargin: 8,
      messageFontSize: 15,
      noteFontSize: 14,
    },
  });
  const rendered = await mermaid.render(
    props.id,
    decodeURIComponent(props.graph),
  );
  svg.value = rendered.svg;
  naturalSize.value = viewBoxSize(rendered.svg);
});

/**
 * The diagram's drawn size, taken from the rendered SVG's viewBox.
 *
 * Parsed from the markup rather than measured from the element: the inline copy
 * is scaled to its column, so measuring it reports the column's width, not the
 * diagram's. The viewBox is the size mermaid laid the diagram out at, which is
 * the size the viewer has to scale from.
 */
function viewBoxSize(markup: string): Size | null {
  const match = /viewBox="([\d.\s-]+)"/.exec(markup);
  if (!match) return null;
  const [, , width, height] = match[1].trim().split(/\s+/).map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

// ---------------------------------------------------------------------------
// The enlarged viewer
// ---------------------------------------------------------------------------

const expanded = ref(false);
const surface = ref<HTMLElement | null>(null);
const view = ref<ViewTransform>({ scale: 1, x: 0, y: 0 });

/** Live pointers on the surface, so a second one can turn a drag into a pinch. */
const pointers = new Map<number, Point>();
/** The pinch in progress: the span and scale it started from. */
let pinchStart: { span: number; scale: number } | null = null;
/** The last position a one-finger drag was seen at. */
let dragFrom: Point | null = null;

const transform = computed(
  () =>
    `translate(${view.value.x}px, ${view.value.y}px) scale(${view.value.scale})`,
);

const zoomPercent = computed(() => Math.round(view.value.scale * 100));

function surfaceSize(): Size {
  const el = surface.value;
  if (!el) return { width: 0, height: 0 };
  const r = el.getBoundingClientRect();
  return { width: r.width, height: r.height };
}

/** Viewport coordinates for a pointer, relative to the surface's top-left. */
function localPoint(e: { clientX: number; clientY: number }): Point {
  const el = surface.value;
  if (!el) return { x: e.clientX, y: e.clientY };
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}

function settle(next: ViewTransform) {
  const size = naturalSize.value;
  if (!size) return;
  view.value = clampPan(next, size, surfaceSize());
}

function open() {
  if (!naturalSize.value) return;
  expanded.value = true;
  // The surface has no size until it is in the document, so the opening
  // transform waits for the frame that lays it out.
  requestAnimationFrame(() => {
    const size = naturalSize.value;
    if (!size) return;
    view.value = initialView(size, surfaceSize());
    surface.value?.focus();
  });
  document.addEventListener('keydown', onKeyDown, true);
  // The page behind must not scroll under the viewer - on a phone a drag that
  // missed the diagram would otherwise carry the article away beneath it.
  document.documentElement.style.overflow = 'hidden';
}

function close() {
  expanded.value = false;
  pointers.clear();
  pinchStart = null;
  dragFrom = null;
  document.removeEventListener('keydown', onKeyDown, true);
  document.documentElement.style.overflow = '';
}

onBeforeUnmount(close);

/**
 * Escape closes the viewer and stops there.
 *
 * Captured rather than bubbled, and marked handled, because these docs also run
 * inside the IDE's documentation drawer, whose own Escape handler (Layout.vue)
 * closes the drawer and stands down only for a keypress something else has
 * already claimed. Without the capture phase the drawer would close out from
 * under a reader who only meant to put the diagram down.
 */
function onKeyDown(e: KeyboardEvent) {
  if (!expanded.value) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopPropagation();
    close();
    return;
  }
  const step = e.shiftKey ? 120 : 40;
  const pan: Record<string, Point> = {
    ArrowLeft: { x: step, y: 0 },
    ArrowRight: { x: -step, y: 0 },
    ArrowUp: { x: 0, y: step },
    ArrowDown: { x: 0, y: -step },
  };
  if (pan[e.key]) {
    e.preventDefault();
    settle({
      ...view.value,
      x: view.value.x + pan[e.key].x,
      y: view.value.y + pan[e.key].y,
    });
    return;
  }
  if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    zoomBy(ZOOM_STEP);
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault();
    zoomBy(1 / ZOOM_STEP);
  }
}

/** Zoom about the middle of the surface - what a button press should do. */
function zoomBy(factor: number) {
  const size = surfaceSize();
  settle(
    zoomAbout(view.value, factor, {
      x: size.width / 2,
      y: size.height / 2,
    }),
  );
}

function onWheel(e: WheelEvent) {
  e.preventDefault();
  // One notch per step whichever way the device reports it; a trackpad pinch
  // arrives here as ctrl+wheel and means the same thing.
  const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
  settle(zoomAbout(view.value, factor, localPoint(e)));
}

function onPointerDown(e: PointerEvent) {
  (e.target as Element).setPointerCapture?.(e.pointerId);
  pointers.set(e.pointerId, localPoint(e));
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinchStart = { span: distance(a, b), scale: view.value.scale };
    dragFrom = null;
  } else if (pointers.size === 1) {
    dragFrom = localPoint(e);
  }
}

function onPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return;
  e.preventDefault();
  pointers.set(e.pointerId, localPoint(e));

  if (pointers.size >= 2 && pinchStart) {
    const [a, b] = [...pointers.values()];
    const span = distance(a, b);
    if (span <= 0) return;
    // Rebase each move off the pinch's starting span and scale, so the diagram
    // tracks the fingers instead of accumulating rounding as they move.
    const target = clampScale(pinchStart.scale * (span / pinchStart.span));
    settle(zoomAbout(view.value, target / view.value.scale, midpoint(a, b)));
    return;
  }

  if (dragFrom) {
    const at = localPoint(e);
    settle({
      ...view.value,
      x: view.value.x + (at.x - dragFrom.x),
      y: view.value.y + (at.y - dragFrom.y),
    });
    dragFrom = at;
  }
}

function onPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) pinchStart = null;
  // Lifting one of two fingers hands the drag back to the one still down,
  // rather than jumping the diagram by the gap between them.
  dragFrom = pointers.size === 1 ? [...pointers.values()][0] : null;
}
</script>

<template>
  <figure class="diagram">
    <button
      type="button"
      class="diagram__preview"
      :class="props.class"
      title="Enlarge diagram"
      aria-label="Enlarge diagram"
      :disabled="!svg"
      @click="open"
    >
      <span class="diagram__svg" v-html="svg"></span>
      <span class="diagram__hint" aria-hidden="true">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        Enlarge
      </span>
    </button>

    <div
      v-if="expanded"
      class="diagram-viewer"
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged diagram"
      @pointerdown.self="close"
    >
      <div class="diagram-viewer__bar">
        <span class="diagram-viewer__zoom">{{ zoomPercent }}%</span>
        <button
          type="button"
          title="Zoom out"
          aria-label="Zoom out"
          :disabled="view.scale <= MIN_SCALE"
          @click="zoomBy(1 / ZOOM_STEP)"
        >
          &minus;
        </button>
        <button
          type="button"
          title="Zoom in"
          aria-label="Zoom in"
          :disabled="view.scale >= MAX_SCALE"
          @click="zoomBy(ZOOM_STEP)"
        >
          +
        </button>
        <button
          type="button"
          title="Close the enlarged diagram"
          aria-label="Close the enlarged diagram"
          @click="close"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div
        ref="surface"
        class="diagram-viewer__surface"
        tabindex="0"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <!-- Sized to the diagram's own dimensions so the SVG has a concrete
             box to fill: mermaid writes `width: 100%` onto its root element,
             which collapses to nothing inside a shrink-wrapped absolute box.
             It also makes the scaled size the pan arithmetic assumes true. -->
        <div
          class="diagram-viewer__content"
          :style="{
            transform,
            width: `${naturalSize?.width ?? 0}px`,
            height: `${naturalSize?.height ?? 0}px`,
          }"
          v-html="svg"
        ></div>
      </div>

      <p class="diagram-viewer__help">Drag to move, pinch or scroll to zoom</p>
    </div>
  </figure>
</template>
