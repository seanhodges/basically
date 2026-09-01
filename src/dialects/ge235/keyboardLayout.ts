// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { KeyboardLayout } from '../../keyboard/layoutSchema';
import { GRID_COLUMNS } from '../../keyboard/templateRows';

/**
 * A Teletype Model 33 ASR, the terminal DTSS users actually sat at - the same
 * machine the Altair's layout models, so that file is the reference.
 *
 * Two constraints the bands have to respect: the ASR-33 has no lower case, and
 * it has no cursor cluster, so this dialect belongs in that battery's
 * `NO_CURSOR_KEYS` rather than gaining a CURSOR mode.
 */
export const ge235KeyboardLayout: KeyboardLayout = {
  id: 'ge235',
  name: 'Teletype Model 33 ASR',
  theme: 'vk-theme-ge235',
  gridColumns: GRID_COLUMNS,
  layers: [{ id: 'base', position: 'center', activeWhen: [] }],
  modifiers: [],
  rows: [],
  glyphs: {},
};
