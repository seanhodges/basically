// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { GraphicEntry } from '../../keyboard/layoutSchema';

/**
 * The machine's block and box graphics: one entry per character, carrying the
 * keycap it is printed on, the GRAPH combination that reaches it, the text it
 * inserts and the byte that text stands for.
 *
 * Read by both the keyboard palette and the charset, so the legends and the
 * byte mapping cannot drift apart.
 */
export const hb10pGraphics: GraphicEntry[] = [];
