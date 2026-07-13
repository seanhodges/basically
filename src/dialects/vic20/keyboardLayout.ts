import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * TODO (vic20 Stage 3): start from c64KeyboardLayout (the key set and C=/SHIFT
 * graphics legends are the same) rethemed as vk-theme-vic20; key tokens must
 * match vic20Machine.setKey. See docs/contributing/dialect-plans/vic20.md.
 */
export const vic20KeyboardLayout: KeyboardLayout = {
  id: 'vic20',
  name: 'Commodore VIC-20',
  theme: 'vk-theme-vic20',
  gridColumns: 40,
  layers: [],
  modifiers: [],
  rows: [],
  glyphs: {},
};
