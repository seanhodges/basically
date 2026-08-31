// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { GRID_COLUMNS } from '../../keyboard/templateRows';

/**
 * The HB-10P's international QWERTY keyboard.
 *
 * Geometry comes entirely from the shared template: a keycap here is the same
 * size as one on any other machine, and a board wider than the template moves
 * what does not fit to the bottom row rather than widening the grid.
 */
export const hb10pKeyboardLayout: KeyboardLayout = {
  id: 'hb10p',
  name: 'Sony HB-10P',
  theme: 'vk-theme-hb10p',
  gridColumns: GRID_COLUMNS,
  layers: [{ id: 'base', position: 'center', activeWhen: [] }],
  modifiers: [],
  rows: [],
  glyphs: {},
};
