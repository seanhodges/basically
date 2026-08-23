import type { EditorKeyAction, KeyDef, KeyLabel } from './layoutSchema';
import { KEY_SPAN } from './templateRows';

/**
 * Shared building blocks for the *legends* a virtual-keyboard layout prints on
 * its keys, completing the geometry `./templateRows` fixes.
 *
 * Every machine describes its keycaps the same way - a tuple of legends, one
 * per layer of the layout, index-aligned with its `layers` - and only
 * the legend text, the layer count and the matrix tokens differ. These builders
 * hold that shape so a dialect's `keyboardLayout.ts` carries its machine's data
 * and nothing else, and so a cross-cutting change to what a legend can do is
 * one edit rather than one per machine.
 *
 * A layout whose keys need a shape of their own (an id that differs from the
 * matrix token, a fifth positional argument) wraps these rather than restating
 * them: an adapter built on {@link Legend} still receives whatever a legend
 * gains here.
 */

/** Every editing action a legend can be bound to (see {@link EditorKeyAction}). */
export type LegendAction = Extract<
  EditorKeyAction,
  { action: string }
>['action'];

/** The four caret moves - the subset a CURSOR-layer legend carries. */
export type CursorAction = Extract<
  LegendAction,
  'left' | 'right' | 'up' | 'down'
>;

/**
 * One layer's marking on a keycap: a bare string for a legend that just types
 * itself under the layer's `editorInsertStyle`, an object where it does
 * something else (an editing action, a different insert, its own matrix
 * tokens), or null where the layer leaves the key blank.
 */
export type Legend =
  | string
  | { text: string; editor: EditorKeyAction | null; emits?: string[] }
  | null;

/** A key's legends, index-aligned with the layout's layers (three to five). */
export type Legends = readonly Legend[];

/** A keyword legend: inserts itself plus the trailing space a keyword wants. */
export const word = (text: string): Legend => ({
  text,
  editor: { insert: `${text} ` },
});

/** A legend bound to an editing action rather than an insert. */
export const act = (text: string, action: LegendAction): Legend => ({
  text,
  editor: { action },
});

/** A legend that inserts different text than it shows. */
export const ins = (text: string, insert: string): Legend => ({
  text,
  editor: { insert },
});

/**
 * A CURSOR-layer legend: it moves the editor caret, and on the machine it
 * presses `emits` instead of the key's own cell - the real cursor key on a
 * machine that has one, or the modifier + digit pair on a machine (the
 * Sinclairs) that reads its arrows that way.
 */
export const cursorKey = (
  text: string,
  action: CursorAction,
  emits: string | readonly string[],
): Legend => ({
  text,
  editor: { action },
  emits: typeof emits === 'string' ? [emits] : [...emits],
});

/** Expand one legend into the {@link KeyLabel} the layout schema carries. */
export const lbl = (legend: Legend): KeyLabel | null =>
  legend === null
    ? null
    : typeof legend === 'string'
      ? { text: legend }
      : {
          text: legend.text,
          editor: legend.editor,
          ...(legend.emits ? { emits: legend.emits } : {}),
        };

/**
 * A standard key: one matrix token, one keycap-width slot, and one legend per
 * layer. `emits` and `spanX` are the exceptions machines need - a key whose id
 * is not its matrix token, or a wide key on a typing row.
 */
export function key(
  token: string,
  legends: Legends,
  opts: { emits?: string[]; spanX?: number } = {},
): KeyDef {
  return {
    id: token,
    spanX: opts.spanX ?? KEY_SPAN,
    emits: opts.emits ?? [token],
    labels: legends.map(lbl),
  };
}

/**
 * Add or replace one layer's legend on an already-built key - how a key picks
 * up a marking that only some keys carry, such as the CURSOR overlay on WASD.
 * Layers between the key's existing legends and `layer` are left blank.
 */
export function withLegend(def: KeyDef, layer: number, legend: Legend): KeyDef {
  const labels = [...def.labels];
  while (labels.length < layer) labels.push(null);
  labels[layer] = lbl(legend);
  return { ...def, labels };
}
