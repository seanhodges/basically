// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The 400's own memory map - the 800's builder called with the 400's RAM top,
 * per `atari800/memoryMap.ts`'s doc comment. Re-exported from its own file
 * rather than reached through the sibling's, so the map lives at the path
 * every other machine's does (`hardware-memory-map.test.ts` and the porting
 * guide's `docs/reference/atari/hardware.md` both read it from here).
 */
export { atari400MemoryMap } from '../atari800/memoryMap';
