// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { GRID_COLUMNS } from '../../keyboard/templateRows';

/**
 * The machine's keyboard, shared with the Apple II Plus.
 *
 * No graphics palette: this machine's colour comes from `COLOR=` and memory
 * rather than from characters, so there is nothing for a palette to show.
 */
export const apple2KeyboardLayout: KeyboardLayout = {
  id: 'apple2',
  name: 'Apple II',
  theme: 'vk-theme-apple2',
  gridColumns: GRID_COLUMNS,
  layers: [],
  modifiers: [],
  rows: [],
  glyphs: {},
};
