import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { GRID_COLUMNS } from '../../keyboard/templateRows';

/**
 * The SAM Coupé's 72-key board. Geometry comes from the shared template - the
 * layout authors legends, tokens and modifiers, never a width - and the ten
 * programmable function keys sit in the top strip.
 */
export const samcoupeKeyboardLayout: KeyboardLayout = {
  id: 'samcoupe',
  name: 'SAM Coupé',
  theme: 'vk-theme-samcoupe',
  gridColumns: GRID_COLUMNS,
  layers: [],
  modifiers: [],
  rows: [],
  glyphs: {},
};
