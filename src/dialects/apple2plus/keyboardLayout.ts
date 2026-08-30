// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { apple2KeyboardLayout } from '../apple2/keyboardLayout';

/**
 * The sibling's keyboard under this machine's own identity and theme: the two
 * machines have the same keyboard, and the II Plus's one real change - the
 * autostart ROM's handling of RESET - is not a keycap.
 */
export const apple2plusKeyboardLayout: KeyboardLayout = {
  ...apple2KeyboardLayout,
  id: 'apple2plus',
  name: 'Apple II Plus',
  theme: 'vk-theme-apple2plus',
};
