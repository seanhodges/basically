// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { GRID_COLUMNS } from '../../keyboard/templateRows';

/**
 * The Sorcerer's 63-key board, including its dedicated GRAPHIC key. Not
 * populated yet.
 *
 * Geometry comes from `templateRows` and is never authored here. Read
 * `src/keyboard/layoutGeometry.test.ts` while filling this in: it only picks the
 * dialect up once the registry line lands, and what it holds is this file's
 * job - symbols reached only through the SYM pages, the machine's real shifted
 * key faces in this header comment rather than on a SHIFT layer, and cursor keys
 * as a CURSOR mode or a named exception. The Sorcerer has no four-way cursor
 * cluster; the Monitor moves the cursor with Control-Q and Control-Z.
 */
export const sorcererKeyboardLayout: KeyboardLayout = {
  id: 'sorcerer',
  name: 'Sorcerer',
  theme: 'vk-theme-sorcerer',
  gridColumns: GRID_COLUMNS,
  layers: [],
  modifiers: [],
  rows: [],
  glyphs: {},
};
