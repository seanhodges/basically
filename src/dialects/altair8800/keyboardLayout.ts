// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * The on-screen keyboard for the Altair (Stage 3) - which, strictly, the Altair
 * did not have. The machine's own front panel is toggle switches and LEDs; you
 * typed at a Teletype ASR-33 wired to the serial board, so that is the keyboard
 * modelled here.
 *
 * Consequences for the layout data, all of them simplifications:
 *
 * - **Two layers, base and SHIFT.** No keyword layer (Altair BASIC is typed out
 *   in full, unlike Sinclair's one-key entry) and no graphics layer.
 * - **No `graphicsPalette`, and no `palette: 'graphics'` editor mode.** The
 *   machine has no block graphics, so this dialect must *not* be added to
 *   `e2e/paletteMachines.ts` - `src/dialects/graphicsPalette.test.ts` asserts
 *   that list matches exactly the dialects that have a palette.
 * - **Upper case only.** The ASR-33 had no lower case at all, which matches 8K
 *   BASIC's own uppercase-only parser.
 * - **CTRL matters.** The teletype's CTRL key produced the control codes BASIC
 *   depends on - above all CTRL-C to break a running program - so it is a real
 *   modifier here rather than decoration.
 *
 * Each key's `emits` token must match what `emulator/keyboard.ts` translates,
 * and `keyboardLayout.test.ts` checks the two agree.
 */
export const altair8800KeyboardLayout: KeyboardLayout = {
  id: 'altair8800',
  name: 'Altair 8800',
  theme: 'vk-theme-altair8800',
  gridColumns: 40,
  layers: [
    {
      id: 'base',
      position: 'center',
      activeWhen: [],
      editorInsertStyle: 'char',
    },
    {
      id: 'shift',
      name: 'SHIFT',
      position: 'tr',
      activeWhen: ['shift'],
      editorInsertStyle: 'char',
    },
  ],
  modifiers: [
    { id: 'shift', emits: ['Shift'], sticky: true, lockable: true },
    { id: 'ctrl', emits: ['Control'], sticky: true, lockable: false },
  ],
  // Stage 3 fills in the ASR-33 rows.
  rows: [],
  glyphs: {},
  options: { minHoldFrames: 1 },
};
