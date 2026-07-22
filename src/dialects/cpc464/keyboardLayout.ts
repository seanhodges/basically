import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * The CPC 464 keyboard as pure layout data: main block + cursor cluster +
 * numeric keypad f0–f9 (as functionKeys), coloured 464 keycaps via
 * `vk-theme-cpc464`, controller bindings onto joystick matrix row 9. The
 * CPC 6128 re-exports these rows with its own grey theme. Stage 3 fills
 * this in; placeholder shape so the unregistered dialect stub typechecks.
 */
export const cpc464KeyboardLayout: KeyboardLayout = {
  id: 'cpc464',
  name: 'CPC 464',
  theme: 'vk-theme-cpc464',
  gridColumns: 40,
  layers: [],
  modifiers: [],
  rows: [],
  glyphs: {},
};
