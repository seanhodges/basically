// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it } from 'vitest';

/** Stage 3 fills these in, alongside the ASR-33 row data. */
describe('altair8800 keyboard layout', () => {
  it.todo('emits a token for every key the serial adapter can translate');
  it.todo('offers only base and SHIFT layers - no keyword or graphics layer');
  it.todo('declares no graphics palette, so it stays out of paletteMachines');
  it.todo('produces CTRL-C (0x03) for breaking a running program');
  it.todo('types only upper case, as the ASR-33 did');
});
