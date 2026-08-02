// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type { MemoryMap } from '../types';

/**
 * The Altair's memory map for the memory-map viewer (Stage 5).
 *
 * A throwing factory rather than a `const` because every address in it has to
 * come from a primary source, and a half-invented map is worse than no map -
 * the viewer would draw it as confidently as a correct one.
 *
 * What makes this map unlike the others here: there is **no ROM region** and
 * **no screen region**. The interpreter is RAM-resident (see
 * `emulator/memory.ts`), so the space it occupies is `system` rather than
 * `rom` - it is genuinely writable, and a stray POKE really will corrupt BASIC.
 * And with no video hardware there is nothing to label `screen` or
 * `attributes`; a machine whose display is a serial terminal has no display
 * memory at all. Per the `MemoryRegionKind` docs, the honest answer is to omit
 * those kinds rather than to invent a region for them.
 *
 * Regions must be contiguous, ascending and cover the whole address space;
 * `src/dialects/memoryMap.test.ts` enforces that against every registered
 * dialect.
 */
export function altair8800MemoryMap(): MemoryMap {
  throw new Error('altair8800: not implemented');
}
