// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, it } from 'vitest';

/**
 * Stage 2 fills these in. Unlike the other machine tests here, these cannot
 * assert on display memory - there is none - so the boot test asserts on the
 * terminal grid the serial port has written into instead.
 *
 * Every case needs a user-supplied `public/roms/altair8800.rom`, which does not
 * ship. Skip rather than fail when it is absent, so a clean checkout still runs
 * green - the same courtesy `trs80`'s optional ROM accuracy mode gets.
 */
describe('altair8800 machine', () => {
  it.todo('boots the BASIC image and prints its sign-on banner');
  it.todo('answers the MEMORY SIZE and TERMINAL WIDTH prompts');
  it.todo('echoes typed characters back through the serial port');
  it.todo('runs an injected program and prints its output');
  it.todo('breaks a running program on CTRL-C');
  it.todo('scrolls the terminal when output passes the last row');
  it.todo('stays constructible with an empty ROM image');
  it.todo('preserves 8080 parity-flag semantics on the Z80 core');
});
