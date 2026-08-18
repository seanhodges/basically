// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * The on-screen PMD 85 keyboard, with no keys on it yet. The real machine adds
 * a K0-K11 function-key row above the alphanumerics, and every key token here
 * has to match one the emulator's `setKey` accepts.
 */
export const pmd85KeyboardLayout: KeyboardLayout = {
  id: 'pmd85',
  name: 'PMD 85-2',
  theme: 'vk-theme-pmd85',
  gridColumns: 40,
  layers: [],
  modifiers: [],
  rows: [],
  glyphs: {},
};
