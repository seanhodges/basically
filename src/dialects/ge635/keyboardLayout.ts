// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';

/**
 * The Teletype Model 33 ASR keyboard, which is what the manual's Appendix A
 * describes a user sitting at (models 33 and 35 alike).
 *
 * Not written yet. Its geometry comes from the shared template rather than
 * being authored here, and its symbols are reached through the SYM pages
 * rather than a shift layer.
 */
export const ge635KeyboardLayout: KeyboardLayout = {
  id: 'ge635',
  name: 'GE-635',
  theme: 'vk-theme-ge635',
  gridColumns: 1,
  layers: [],
  modifiers: [],
  rows: [],
  glyphs: {},
};
