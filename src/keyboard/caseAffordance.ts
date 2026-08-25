// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Withdrawing the on-screen keyboard's case affordance.
 *
 * While Strict characters is on and the machine has no lower case, there is no
 * case to shift into, so the shift keycap is not offered - the editor would
 * only refuse what it typed. Nothing else goes with it: this must cost the user
 * no character and no function.
 *
 * Two traps decide the rules here, and both are quiet enough to pass a full
 * green suite:
 *
 *  - **A key drawn like a shift is not necessarily the shift.** The Altair and
 *    the Apple I style their CTRL key as a shift flank, and CTRL-C is the only
 *    way to interrupt a running program on either. So the rule keys off the
 *    modifier a key *is*, never off how it is styled.
 *  - **The symbol page toggle rides the shift flank.** On a machine with a
 *    second SYM page the toggle is welded onto the bottom row's modifier (see
 *    `withSymbolMode` in {@link ./templateRows}), pressing nothing on the
 *    machine. Hiding it there would make a whole page of characters
 *    unreachable, so inside a pinned mode-only layer the keycap stays.
 *
 * The key is replaced by a spacer of its own width rather than removed, so the
 * row keeps its column arithmetic and every geometry test still describes the
 * keyboard the reader sees.
 */
import { letterCaseFor } from '../dialects/letterCase';
import type { EditorModeDef, KeyboardLayout, KeyDef } from './layoutSchema';
import { spacer } from './templateRows';

/**
 * The modifier id every machine here gives its shift key.
 *
 * The same literal the layer rules use (`activeWhen: ['shift']`), and the
 * reason this is a modifier id rather than a style or a label: the Spectrum
 * calls its shift CAPS SHIFT and the Commodores call theirs LEFT SHIFT, while
 * the two machines that draw a CTRL key as a shift flank name it `ctrl`.
 */
export const SHIFT_MODIFIER_ID = 'shift';

/**
 * Whether this machine's keyboard should stop offering letter case.
 *
 * Both halves are needed: the reader has asked to be held to what the machine
 * stores, *and* the machine has no lower-case shape to shift into. On a machine
 * that draws both cases the setting says nothing about the keyboard, however
 * strictly the editor is reading the source.
 */
export function withdrawsCaseKey(dialectId: string, strict: boolean): boolean {
  return strict && letterCaseFor(dialectId)?.lowerCase === 'none';
}

/** Whether this key IS the machine's shift, whatever it is drawn as. */
export function isShiftKey(def: KeyDef): boolean {
  return def.modifier === SHIFT_MODIFIER_ID;
}

/**
 * Whether `mode` pins a layer that owns the keys it labels - a SYM page or a
 * cursor overlay. The shift flank belongs to the pinned layer while one is up,
 * so the case rule keeps its hands off it there.
 */
export function pinsModeOnlyLayer(
  layout: KeyboardLayout,
  mode: EditorModeDef | null,
): boolean {
  if (!mode) return false;
  return layout.layers.find((l) => l.id === mode.layer)?.modeOnly === true;
}

/**
 * `rows` as the renderer should draw them: unchanged, or with the machine's
 * shift keycap standing as a spacer of the same width.
 *
 * Returns the rows themselves when nothing is hidden, so the common case
 * allocates nothing and every memo downstream keeps its identity.
 */
export function rowsWithoutCaseKey(
  rows: KeyDef[][],
  hide: boolean,
): KeyDef[][] {
  if (!hide) return rows;
  return rows.map((row) =>
    row.map((k) => (isShiftKey(k) ? spacer(k.spanX) : k)),
  );
}
