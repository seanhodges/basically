<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import type { MachineLike } from '../../../../src/components/machinePicker';

/**
 * The porting guide's two machine fields: the IDE's machine picker, mounted in
 * the docs as a React island.
 *
 * Two dynamic hops keep React off every other page - this component is
 * registered with `defineAsyncComponent` (theme/index.ts) and `import()`s
 * react-dom below rather than importing it statically. VitePress emits a
 * `<link rel="modulepreload">` for each *direct* dynamic import of the app
 * entry chunk, so a statically-imported react-dom would be preloaded on every
 * page of the site when one page has a picker. Same reason and same shape as
 * `Mermaid.vue`; the long version is the `markdown.config` note in config.ts.
 *
 * `openField` lives here rather than in either field, because "opening one
 * closes the other" is a fact about the pair. The IDE has one machine and so
 * has no such case - which is why this is the only genuinely new logic the
 * docs side adds to a picker it otherwise only renders.
 */

const props = defineProps<{
  machines: MachineLike[];
  from: string;
  to: string;
}>();

const emit = defineEmits<{
  (e: 'choose', field: 'from' | 'to', id: string): void;
}>();

type Field = 'from' | 'to';

const openField = ref<Field | null>(null);
const fromHost = ref<HTMLElement | null>(null);
const toHost = ref<HTMLElement | null>(null);
/** True once React has taken over, which is when the placeholders come down. */
const ready = ref(false);

/** As much of `react-dom/client`'s Root as this file uses. */
interface ReactRoot {
  render: (node: unknown) => void;
  unmount: () => void;
}

let roots: { field: Field; root: ReactRoot }[] = [];
let renderField: ((field: Field) => void) | null = null;

onMounted(async () => {
  const [{ createRoot }, { createElement }, { MachineField }] =
    await Promise.all([
      import('react-dom/client'),
      import('react'),
      import('./MachineField'),
    ]);

  // <ClientOnly> renders nothing until its own onMounted, so the host elements
  // appear a tick after ours.
  await nextTick();
  if (!fromHost.value || !toHost.value) return;

  roots = [
    { field: 'from', root: createRoot(fromHost.value) },
    { field: 'to', root: createRoot(toHost.value) },
  ];

  renderField = (field: Field) => {
    const entry = roots.find((r) => r.field === field);
    if (!entry) return;
    entry.root.render(
      createElement(MachineField, {
        machines: props.machines,
        selectedId: field === 'from' ? props.from : props.to,
        // "Target machine" is the IDE's phrasing and would be wrong here: one
        // of these two is the machine being ported *from*. The visible labels
        // stay as short as they were; only the accessible name is this full.
        role: field === 'from' ? 'Porting from' : 'Porting to',
        open: openField.value === field,
        onOpen: () => {
          openField.value = field;
        },
        onDismiss: () => {
          openField.value = null;
        },
        onChoose: (id: string) => {
          openField.value = null;
          emit('choose', field, id);
        },
      }),
    );
  };

  ready.value = true;
  renderField('from');
  renderField('to');
});

// A React root does not re-render itself when Vue's state moves, so everything
// the island reads is pushed back into it here.
watch(
  () => [props.from, props.to, props.machines, openField.value] as const,
  () => {
    renderField?.('from');
    renderField?.('to');
  },
);

onUnmounted(() => {
  for (const { root } of roots) root.unmount();
  roots = [];
  renderField = null;
});
</script>

<template>
  <!--
    `display: contents` on the root: the two fields are laid out by the
    comparison's own `.cmp-controls` flex row, alongside the swap and copy-link
    buttons this component does not own. The slot between the fields is where
    the swap button goes, so its markup and its handler stay where they were.
  -->
  <div class="mp-root">
    <div class="mp-field">
      <span>Porting from</span>
      <div class="mp-slot">
        <ClientOnly><div ref="fromHost"></div></ClientOnly>
        <span v-if="!ready" class="mp-placeholder" aria-hidden="true"></span>
      </div>
    </div>

    <slot />

    <div class="mp-field">
      <span>to</span>
      <div class="mp-slot">
        <ClientOnly><div ref="toHost"></div></ClientOnly>
        <span v-if="!ready" class="mp-placeholder" aria-hidden="true"></span>
      </div>
    </div>
  </div>
</template>

<!--
  Unscoped on purpose: React renders the picker's markup, so Vue's scope
  attribute never reaches it. Every selector is `mp-` prefixed instead.
-->
<style>
.mp-root {
  /* The picker's CSS modules are the app's, and between them read six custom
     properties from it. Both surfaces are dark - the docs are
     `appearance: 'force-dark'` and the IDE has no light theme - so redeclaring
     those six here, at the values in src/styles.css, is the whole of the
     theming work. */
  --bg-panel: #1e2128;
  --bg-raised: #262a33;
  --border: #343945;
  --text: #d8dce6;
  --text-dim: #8a91a0;
  --accent: #4f8cff;

  display: contents;
}

/* The field and its label, as the comparison's own controls have always looked
   - this component took the markup over from DialectCompare, so it took the
   look with it. */
.mp-field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

/* Reserves the trigger's height before React mounts, so the picker's absence
   from the pre-rendered HTML costs a paint rather than a layout shift. */
.mp-slot {
  display: flex;
  min-height: 40px;
  /* Sized to the machine it names, rather than to the longest machine in the
     list: these two sit in a row with the swap and copy-link buttons, and a
     pair of controls wide enough for "Spectrum 128" reads as the page's
     heaviest element when it is only its first. The maker and year are on
     every row of the list, one click away, which is where the choosing
     happens. */
  /* The app's typography, not the docs': this is the IDE's picker, and it has
     to look like it wherever it is rendered. `line-height` matters as much as
     the family - VitePress sets an absolute 24px for prose, which stretched
     every trigger and every list row about 15px taller than the same markup in
     the app. The picker's own module sets a line-height where it wants one. */
  font-family: 'Segoe UI', system-ui, sans-serif;
  line-height: normal;
}

/* Roughly the width of a trigger naming a typical machine, so what the reader
   sees before React mounts is the size of what replaces it. */
.mp-placeholder {
  display: block;
  width: 8rem;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-raised);
}

/* The React root's own element, between the field and the trigger. */
.mp-slot > div {
  display: flex;
  flex: 1;
  min-width: 0;
}

/* Matches `.machineTrigger` in NewProjectDialog.module.css, which is the
   surface this one has to be indistinguishable from. Only the container's
   sizing is the caller's; the chrome comes from the picker's own module. */
.mp-trigger {
  flex: 1;
  min-width: 0;
  padding: 7px 10px;
}

/* --- The app's element styles, for the picker's dialog only ---------------
   The dialog renders inside `.vp-doc`, whose heading and button rules are
   written for prose and would give "Choose a machine" a 48px top margin and a
   rule above it. These restate what src/styles.css and the browser defaults
   give the same markup in the app. Confined to the dialog, and to the parts of
   it that carry no CSS-module class of their own - the machine rows and the
   trigger style themselves. */
.mp-slot [role='dialog'] h2 {
  margin: 0 0 4px;
  padding: 0;
  border: 0;
  font-size: 20px;
  font-weight: 600;
  line-height: 1.3;
  letter-spacing: normal;
}

.mp-slot [role='dialog'] button:not([data-machine]) {
  background: var(--bg-raised);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 5px 12px;
  font-size: 13px;
  font-family: inherit;
  line-height: normal;
  cursor: pointer;
}

.mp-slot [role='dialog'] button:not([data-machine]):hover {
  border-color: var(--accent);
}
</style>
