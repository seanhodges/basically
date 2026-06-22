import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * Acorn Atom virtual keyboard. STUB — Stage 3 builds the real layout (key tokens
 * matching the AtomPPIA matrix in jsbeeb's `utils_atom.js`, on the shared
 * `templateRows` grid). A minimal, type-valid empty layout keeps the build green
 * until then; the dialect is unregistered so it is never rendered.
 */
export const atomKeyboardLayout: KeyboardLayout = {
  id: 'atom',
  name: 'Acorn Atom',
  theme: 'vk-theme-atom',
  gridColumns: 40,
  layers: [{ id: 'base', position: 'center', activeWhen: [] }],
  modifiers: [],
  rows: [],
  glyphs: {},
};
