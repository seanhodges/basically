// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyDef, KeyboardLayout } from './layoutSchema';
import { resolveEditorAction, resolveEmits } from './editorActions';
import { indexKeyDefs } from './controllerConfig';

/**
 * One vocabulary of key names, resolved per machine from what its keyboard
 * layout declares.
 *
 * `MachineEmulator.setKey` takes an opaque machine-defined token, and those
 * tokens are genuinely not uniform - one machine's `KeyA` is another's bare
 * `A`, and some map to raw matrix positions. So a caller who wants to press a
 * letter needs a name that means the same thing everywhere, and each machine
 * needs to say what its own cell for that name is.
 *
 * Everything here is derived from what a layout *declares*: `KeyLabel.editor`
 * through {@link resolveEditorAction} for what a key means, `KeyDef.modifier`
 * for the modifier roles, and {@link resolveEmits} for the tokens the same
 * legend presses. Two tempting shortcuts are deliberately absent, because both
 * silently press the wrong key rather than failing:
 *
 *  - **Stripping a `Key`/`Digit` prefix off an id.** The PMD 85 is a QWERTZ
 *    board whose DOM `KeyboardEvent.code` tokens are positional, so the key
 *    that types `Z` emits `KeyY`. Resolving `Z` off the id would press the key
 *    that types `Y`.
 *  - **Matching a legend glyph.** The left arrow is cursor-left on most
 *    machines and the rub-out on the TRS-80 and the Apple II, where the very
 *    same arrow is the delete key.
 *
 * Nothing here boots a machine: this reads the `Dialect`'s layout alone, which
 * is what lets the assistant's system prompt carry the names without
 * constructing an emulator.
 */

/**
 * Spellings accepted for a canonical name but never listed.
 *
 * Listing every spelling would triple the key line in every system prompt and
 * teach a model three names for one key; accepting them costs nothing and makes
 * a hand-written schedule forgiving.
 *
 * `DEL` is deliberately absent. The PMD 85's `Del` key is a *forward* delete
 * (`act('DEL', 'delete')`), so `DEL` would mean rub-out on most machines and
 * delete-forward on that one - the one thing a shared vocabulary must not do.
 */
const ALIASES: Record<string, string> = {
  RETURN: 'ENTER',
  NEWLINE: 'ENTER',
  BACKSPACE: 'DELETE',
  RUBOUT: 'DELETE',
  ESC: 'ESCAPE',
};

/** The name each declared editing action is offered under. */
const ACTION_NAMES: Record<string, string> = {
  newline: 'ENTER',
  backspace: 'DELETE',
  left: 'LEFT',
  right: 'RIGHT',
  up: 'UP',
  down: 'DOWN',
};

/**
 * The concepts that declare nothing to key on, and the ids and legends that
 * find them.
 *
 * Escape and break do nothing to an editor - they interrupt the machine - so
 * neither carries a `KeyLabel.editor` any rule could read. Both are keyed by
 * the id first because a legend is what is drawn: the Altair's escape keycap
 * reads `ALT`.
 */
const BY_KEYCAP: Record<string, { ids: string[]; legends: string[] }> = {
  ESCAPE: { ids: ['Escape'], legends: ['ESC', 'ESCAPE'] },
  BREAK: { ids: ['Break'], legends: ['BREAK'] },
};

/** A key's own legend text on `layerId`, or undefined where it carries none. */
function labelText(
  layout: KeyboardLayout,
  key: KeyDef,
  layerId: string,
): string | undefined {
  const idx = layout.layers.findIndex((l) => l.id === layerId);
  return idx >= 0 ? key.labels[idx]?.text : undefined;
}

function baseLayerId(layout: KeyboardLayout): string {
  const base =
    layout.layers.find((l) => l.activeWhen.length === 0) ?? layout.layers[0];
  return base?.id ?? '';
}

/**
 * Every distinct token list each name resolves to on this layout.
 *
 * More than one list for a name is genuine ambiguity - two keys claiming the
 * same concept and pressing different cells - and the resolver does not choose
 * between them: `keyNames.test.ts` fails naming the machine and the name, and
 * the layout is fixed. Two keys yielding the *same* tokens is the common case
 * and not ambiguity at all: the CPCs and the MSX declare their cursor cells
 * twice, once as a non-rendered `controllerKeys` entry and once as a CURSOR
 * legend.
 */
export function keyNameCandidates(
  layout: KeyboardLayout,
): Map<string, string[][]> {
  const found = new Map<string, string[][]>();
  const offer = (name: string, tokens: string[]) => {
    // A press that sends nothing is not a key: the CURSOR overlay legitimately
    // blanks the keys it leaves out, and offering one of those would offer a
    // name that silently does nothing.
    if (name === '' || tokens.length === 0) return;
    const lists = found.get(name) ?? [];
    if (!lists.some((t) => t.join(' ') === tokens.join(' ')))
      lists.push(tokens);
    found.set(name, lists);
  };

  const base = baseLayerId(layout);

  for (const key of indexKeyDefs(layout).values()) {
    // The modifier roles, with the shift role normalised so the tokens machines
    // spell it with - Shift, CapsShift, LeftShift, ShiftLeft - are one name.
    // Read off the tokens rather than the modifier id, which is `caps` on the
    // Spectrums and `shift` on everything else.
    if (key.modifier) {
      const shift = key.emits.some((token) => /shift/i.test(token));
      offer(shift ? 'SHIFT' : key.modifier.toUpperCase(), key.emits);
      continue;
    }

    // A character is what the key types unmodified. The declared meaning, not
    // the token: on a QWERTZ board that is the letter on the cap rather than
    // the letter in the id.
    const unmodified = resolveEditorAction(layout, key, base);
    if (unmodified && 'insert' in unmodified) {
      const insert = unmodified.insert;
      if (insert === ' ') offer('SPACE', resolveEmits(layout, key, base));
      else if (/^[A-Za-z0-9]$/.test(insert)) {
        offer(insert.toUpperCase(), resolveEmits(layout, key, base));
      }
    }

    // The declared editing actions, read on the base layer and on the
    // `modeOnly` overlays - where most machines put their arrows - but never on
    // a layer a modifier activates. A modifier layer's legend declares what the
    // key does *while the modifier is held*, and its tokens are the key's own
    // cell alone: the Sinclairs print their arrows on SHIFT+5 to SHIFT+8, so
    // reading that layer would offer LEFT as the cell that types a 5.
    for (const layer of layout.layers) {
      if (layer.activeWhen.length > 0 && !layer.modeOnly) continue;
      const action = resolveEditorAction(layout, key, layer.id);
      if (!action || !('action' in action)) continue;
      const name = ACTION_NAMES[action.action];
      if (name) offer(name, resolveEmits(layout, key, layer.id));
    }

    // Everything else with a word on its cap - the function keys, TAB, START,
    // STOP, RESET - is offered under the name the keycap itself carries, never
    // renumbered: the BBC and the CPCs start at `f0` where the C64 starts at
    // `f1`, so `F1` must not mean "the first function key".
    const legend = labelText(layout, key, base);
    if (legend !== undefined && [...legend].length > 1) {
      offer(legend.toUpperCase(), key.emits);
    }

    for (const [name, { ids, legends }] of Object.entries(BY_KEYCAP)) {
      const matched =
        ids.includes(key.id) ||
        (legend !== undefined && legends.includes(legend.toUpperCase()));
      if (matched) offer(name, key.emits);
    }
  }

  return found;
}

/**
 * The tokens `name` presses on this machine, or undefined where it has no such
 * key.
 *
 * Refusing rather than mapping onto a neighbour is the point: a schedule that
 * asks for a key the machine has not got should be told so, not silently sent
 * somewhere else.
 */
export function resolveKeyName(
  layout: KeyboardLayout,
  name: string,
): string[] | undefined {
  const trimmed = name.trim();
  const found = keyNameCandidates(layout);
  const folded = trimmed.toUpperCase();
  const direct = found.get(folded) ?? found.get(ALIASES[folded] ?? '');
  if (direct?.[0]) return direct[0];
  // The machine's own key id, exact and last, so every name written against a
  // layout before there was a vocabulary keeps working.
  const own = indexKeyDefs(layout).get(trimmed);
  return own && own.emits.length > 0 ? own.emits : undefined;
}

/**
 * The names this machine answers to, sorted.
 *
 * Absence is the honest answer: a machine with no escape key does not list
 * `ESCAPE`, so a caller reading the list finds out what the machine has rather
 * than discovering it by trial. Aliases are accepted but never listed.
 *
 * Derivable without constructing an emulator, which matters: the assistant's
 * system prompt is built from the `Dialect` alone and has to stay byte-stable
 * per dialect for prefix caching. Sorted with a plain `.sort()` and upper-cased
 * with `toUpperCase` rather than their locale-sensitive twins for exactly that
 * reason - the layout's own order is an arrangement of a keyboard, not a
 * promise about iteration.
 *
 * Keys that emit nothing are left out. A key with no tokens presses nothing on
 * the matrix, so offering its name would be offering a key that silently fails.
 */
export function keyVocabulary(layout: KeyboardLayout): string[] {
  return [...keyNameCandidates(layout).keys()]
    .filter((name) => ALIASES[name] === undefined)
    .sort();
}
