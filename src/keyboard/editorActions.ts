import type {
  EditorKeyAction,
  EditorModeDef,
  KeyDef,
  KeyboardLayout,
  LayerDef,
} from './layoutSchema';

/**
 * Resolve what a key does when the keyboard targets the text editor, on the
 * given layer. Pure data lookup - all machine specifics live in the layout.
 *
 * Resolution order:
 *  1. modifier keys never produce editor actions (the engine handles them);
 *  2. an explicit KeyLabel.editor wins (null = forced no-op);
 *  3. a text label on a layer with editorInsertStyle derives an insert
 *     ('char' = verbatim, 'word' = text + trailing space);
 *  4. glyph-only labels have no default - glyph inserts must be explicit;
 *  5. otherwise fall back to the base layer (so digits, SPACE, NEW LINE…
 *     keep working in keyword/function/graphics modes, like the real ZX81).
 */
export function resolveEditorAction(
  layout: KeyboardLayout,
  key: KeyDef,
  layerId: string,
): EditorKeyAction | null {
  if (key.modifier) return null;
  const baseLayer =
    layout.layers.find((l) => l.activeWhen.length === 0) ?? layout.layers[0];
  const resolved = resolveOnLayer(layout, key, layerId);
  if (resolved !== undefined) return resolved;
  if (baseLayer && baseLayer.id !== layerId) {
    const fallback = resolveOnLayer(layout, key, baseLayer.id);
    if (fallback !== undefined) return fallback;
  }
  return null;
}

/** undefined = nothing usable on this layer (caller may fall back). */
function resolveOnLayer(
  layout: KeyboardLayout,
  key: KeyDef,
  layerId: string,
): EditorKeyAction | null | undefined {
  const layerIdx = layout.layers.findIndex((l) => l.id === layerId);
  if (layerIdx < 0) return undefined;
  const label = key.labels[layerIdx];
  if (!label) return undefined;
  if (label.editor !== undefined) return label.editor;
  const style = layout.layers[layerIdx]!.editorInsertStyle;
  if (label.text !== undefined && style !== undefined) {
    return { insert: style === 'word' ? `${label.text} ` : label.text };
  }
  return undefined;
}

/** Actions that auto-repeat while the key is held (editor target only). */
export function isRepeatable(action: EditorKeyAction): boolean {
  return 'action' in action && action.action !== 'newline';
}

/**
 * The layer a non-base editor mode pins, or null when the mode's layer is the
 * base layer (there the engaged modifier drives the layer instead). A mode
 * with a `shiftedLayer` carries two legend sets: pinning a `modeOnly` layer
 * (the SYM pages), the flip is the UI page toggle - `pageTwo` - because the
 * second page's legends carry their own machine combinations and holding the
 * real shift would corrupt them; otherwise the flip follows the engaged SHIFT
 * modifier (the layer the machine is really in).
 */
export function modePinnedLayerId(
  layout: KeyboardLayout,
  mode: EditorModeDef | null,
  baseLayerId: string,
  activeLayer: LayerDef,
  pageTwo: boolean,
): string | null {
  if (!mode || mode.layer === baseLayerId) return null;
  if (mode.shiftedLayer) {
    const pinned = layout.layers.find((l) => l.id === mode.layer);
    const flipped = pinned?.modeOnly
      ? pageTwo
      : activeLayer.activeWhen.includes('shift');
    if (flipped) return mode.shiftedLayer;
  }
  return mode.layer;
}

/**
 * The machine tokens a key presses on the given layer: the layer's legend may
 * carry its own (a cursor legend over a letter key), otherwise the key's own.
 * Pure data lookup, like {@link resolveEditorAction} - the tokens themselves
 * are opaque to everything above the machine.
 *
 * No base-layer fallback: `key.emits` already is the unmodified meaning, so a
 * layer that says nothing about tokens leaves them alone.
 */
export function resolveEmits(
  layout: KeyboardLayout,
  key: KeyDef,
  layerId: string,
): string[] {
  const layerIdx = layout.layers.findIndex((l) => l.id === layerId);
  const label = layerIdx >= 0 ? key.labels[layerIdx] : undefined;
  return label?.emits ?? key.emits;
}
