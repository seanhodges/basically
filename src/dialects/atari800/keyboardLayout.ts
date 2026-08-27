// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * The on-screen keyboard, shared by both Atari dialects.
 *
 * One layout serves both machines: the 400's membrane keyboard has the same
 * keys in the same places as the 800's, and the difference in feel is a theme
 * rather than a geometry. The keys themselves wait on the emulator, because a
 * layout's tokens have to match what the machine's `setKey` accepts and there
 * is nothing yet to match them against.
 */
export const atariKeyboardLayout: KeyboardLayout = {
  id: 'atari',
  name: 'Atari 400/800',
  theme: 'vk-theme-atari',
  gridColumns: 1,
  layers: [{ id: 'base', name: 'Base', position: 'center', activeWhen: [] }],
  modifiers: [],
  rows: [],
  glyphs: {},
};
