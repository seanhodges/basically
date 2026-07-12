import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * TODO (pet Stage 3): the PET graphics keyboard as layout data - letters with
 * shifted-graphics legends (shared graphics.ts tables), numeric-pad column,
 * no Commodore key; key tokens must match petMachine.setKey.
 * See docs/contributing/dialect-plans/pet.md.
 */
export const petKeyboardLayout: KeyboardLayout = {
  id: 'pet',
  name: 'Commodore PET',
  theme: 'vk-theme-pet',
  gridColumns: 40,
  layers: [],
  modifiers: [],
  rows: [],
  glyphs: {},
};
