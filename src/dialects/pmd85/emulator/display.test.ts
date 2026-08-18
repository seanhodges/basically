// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it } from 'vitest';

describe('pmd85 display', () => {
  it.todo('reads each scanline at 0xC000 + 0x40 * y');
  it.todo('draws six pixels from the low bits of each of the 48 shown bytes');
  it.todo('applies the four-level attribute from the top two bits of a cell');
});
