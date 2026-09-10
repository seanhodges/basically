// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { GraphicEntry } from '../../keyboard/layoutSchema';

/**
 * The Sorcerer's graphics characters, not populated yet, read by *both* the keyboard
 * layout and the charset so the two cannot drift.
 *
 * The Sorcerer printed its graphics on the keycaps and reaches them with
 * SHIFT + GRAPHIC, so these entries carry `key` and `modifier` rather than
 * falling back to the character code. Derive the shapes from the generator
 * bitmaps the Monitor writes into RAM, not from a guessed table.
 */
export const sorcererGraphics: readonly GraphicEntry[] = [];
