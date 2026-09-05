// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// Which machines a program can be shared to: the ids of every registered
// dialect whose tokenizer accepts the source with
// zero errors. Purely syntactic - a program may tokenize on a machine yet rely
// on hardware it lacks - but cheap, client-side, and always includes the
// authoring dialect for a program that lints clean there.

import type { Dialect, Block } from '../dialects/types';
import { dialects } from '../dialects/registry';
import { readMachineDirective } from '../dialects/machineDirective';

/**
 * Registry-ordered dialect ids on which `source` tokenizes without errors. A
 * `#MACHINE` declaration is stripped once before the check, since it is
 * dialect-agnostic and would otherwise fail every dialect's tokenizer alike
 * rather than the one it names. When `blocks` is non-empty the target must
 * additionally declare {@link Dialect.memoryBlocks} - a machine with no block
 * support can't receive a document's memory blocks, so it's dropped from the
 * compatible set even if the BASIC tokenizes cleanly. `candidates` defaults to
 * the whole registry and is injectable for tests.
 */
export function computeCompatibleDialects(
  source: string,
  blocks: readonly Block[] = [],
  candidates: readonly Dialect[] = dialects,
): string[] {
  const stripped = readMachineDirective(source).source;
  const requireBlocks = blocks.length > 0;
  return candidates
    .filter((d) => d.tokenize(stripped).errors.length === 0)
    .filter((d) => !requireBlocks || d.memoryBlocks !== undefined)
    .map((d) => d.id);
}
