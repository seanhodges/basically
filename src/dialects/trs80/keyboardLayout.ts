import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * Stub — filled in by Stage 3 of docs/dialect-plans/trs80.md. The Model I
 * keyboard is a straightforward QWERTY with SHIFT, ENTER, BREAK, CLEAR and the
 * arrow keys (no keyword mode), built on src/keyboard/templateRows.ts. The key
 * tokens (`emits`) must match the emulator's `setKey` matrix names from Stage 2.
 */
export const trs80KeyboardLayout: KeyboardLayout = {
  id: 'trs80',
  name: 'TRS-80 Model I',
  theme: 'vk-theme-trs80',
  gridColumns: 40,
  layers: [{ id: 'base', position: 'center', activeWhen: [] }],
  modifiers: [],
  rows: [],
  glyphs: {},
};
