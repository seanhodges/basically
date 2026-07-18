// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Engine lookup by CPU. Returns null for CPUs without an engine so callers
 * (the block editor) can fall back to a "not supported" notice - today both
 * supported CPUs have one.
 */

import { m6502Engine } from './m6502';
import type { AsmEngine, Cpu } from './types';
import { z80Engine } from './z80';

export function asmEngineFor(cpu: Cpu): AsmEngine | null {
  switch (cpu) {
    case 'z80':
      return z80Engine;
    case '6502':
      return m6502Engine;
  }
}
