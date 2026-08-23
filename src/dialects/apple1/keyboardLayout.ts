// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * The Apple I's ASCII keyboard. Geometry comes from templateRows; the CLEAR
 * SCREEN and RESET buttons are wired to hardware rather than to the keyboard
 * port, so they belong on the function-key strip.
 */
export const apple1KeyboardLayout: KeyboardLayout = {
  id: 'apple1',
  name: 'Apple I',
  theme: 'vk-theme-apple1',
  gridColumns: 0,
  layers: [],
  modifiers: [],
  rows: [],
  glyphs: {},
};
