// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Turn a sample's bundled {@link SampleBlockDef}s into real
 * {@link MemoryBlock}s by assembling their source with the dialect's CPU
 * engine. Samples ship assembly text, not bytes, so the routines stay
 * readable (and editable in the block's tab once loaded); the per-dialect
 * samples tests pin that every bundled block assembles clean, making a throw
 * here a programming error rather than a user-facing state.
 */

import { asmEngineFor } from '../asm/registry';
import type { Dialect, MemoryBlock, SampleFile } from '../dialects/types';

export function materializeSampleBlocks(
  dialect: Dialect,
  sample: SampleFile,
): MemoryBlock[] {
  const defs = sample.blocks ?? [];
  if (defs.length === 0) return [];
  const support = dialect.memoryBlocks;
  if (!support) {
    throw new Error(
      `Sample "${sample.name}" bundles memory blocks but ${dialect.name} has no memoryBlocks capability`,
    );
  }
  const engine = asmEngineFor(support.cpu);
  if (!engine) {
    throw new Error(`No assembler engine for CPU "${support.cpu}"`);
  }
  return defs.map((def) => {
    const result = engine.assemble(def.asmSource, def.address);
    if (!result.ok) {
      const first = result.errors[0];
      throw new Error(
        `Sample block "${def.name}" failed to assemble: line ${first?.line}: ${first?.message}`,
      );
    }
    return {
      id: `sample-${def.name}`,
      name: def.name,
      address: def.address,
      bytes: result.bytes,
      kind: def.kind,
      asmSource: def.asmSource,
      ...(def.entry !== undefined ? { entry: def.entry } : {}),
    };
  });
}
