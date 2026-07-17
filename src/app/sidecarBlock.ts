// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Sidecar block files: a `<name>-<addr>.bin` file whose raw bytes are a memory
 * block and whose load address is encoded in the file name. This is how a
 * machine whose native program format can't carry fixed-address code/data - the
 * ZX81/ZX80 `.P`/`.O` snapshot (which spans only the used BASIC RAM) and the
 * BBC `.bbc` (BASIC program only) - still imports a block: the address the
 * bytes alone don't describe rides in the file name instead.
 *
 * The convention: the name portion becomes the block name (sanitized to the
 * required pattern), and the address is `0x8000`/`$8000`/`&8000` (hex) or a
 * bare decimal like `32768`. Dropping `sprite-0x8000.bin` onto a document adds
 * a `sprite` block at 0x8000; unlike importing a program file, it augments the
 * open document rather than replacing it. Handled in `openDroppedFile`
 * (`src/app/fileCommands.ts`), gated on the dialect declaring `memoryBlocks`.
 */

import type { MemoryBlock } from '../dialects/types';

/**
 * A `<name>-<addr>` base name (without the `.bin` extension): a name part, then
 * `-`, then an address as hex (`0x`/`$`/`&` prefixed) or plain decimal. The
 * name part is greedy so a name may itself contain hyphens (`my-code-0x8000`).
 */
const SIDECAR_RE = /^(.+)-(0x[0-9a-f]+|\$[0-9a-f]+|&[0-9a-f]+|\d+)$/i;

const INVALID_NAME_CHARS = /[^A-Za-z0-9_]/g;

/**
 * Sanitize a raw name into one matching {@link MemoryBlock.name}'s pattern
 * (`/^[A-Za-z][A-Za-z0-9_]*$/`): disallowed characters become `_`, and a
 * result that doesn't start with a letter is prefixed with `b_` (empty falls
 * back to `block`).
 */
function sanitizeName(raw: string): string {
  const cleaned = raw.replace(INVALID_NAME_CHARS, '_');
  if (cleaned === '') return 'block';
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `b_${cleaned}`;
}

/** Parse an `0x`/`$`/`&`-prefixed hex or plain-decimal address string. */
function parseAddress(raw: string): number | null {
  const hex = /^(0x|\$|&)/i.test(raw);
  const value = hex
    ? parseInt(raw.replace(/^(0x|\$|&)/i, ''), 16)
    : Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) return null;
  return value;
}

/**
 * Parse a dropped file's name as a sidecar block descriptor, or `null` when it
 * isn't one (wrong extension, no `-<addr>` suffix, or an out-of-range address).
 * The `.bin` extension is matched case-insensitively.
 */
export function parseSidecarFileName(
  fileName: string,
): { name: string; address: number } | null {
  const dot = fileName.lastIndexOf('.');
  if (dot < 0 || fileName.slice(dot).toLowerCase() !== '.bin') return null;
  const base = fileName.slice(0, dot);
  const match = SIDECAR_RE.exec(base);
  if (!match) return null;
  const address = parseAddress(match[2]!);
  if (address === null) return null;
  return { name: sanitizeName(match[1]!), address };
}

/**
 * A copy of `base` that doesn't collide with any name in `existing`, appending
 * `_2`, `_3`… until it's unique - so dropping two sidecars with the same name
 * doesn't fail the document's unique-name rule.
 */
function uniqueName(base: string, existing: ReadonlySet<string>): string {
  if (!existing.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}_${n}`;
    if (!existing.has(candidate)) return candidate;
  }
}

/**
 * Build a {@link MemoryBlock} for a dropped sidecar `.bin`, given the parsed
 * name/address, the raw bytes, and the document's current blocks (so the new
 * block's name and id don't collide). Returns a block ready for `upsertBlock`.
 */
export function sidecarBlock(
  parsed: { name: string; address: number },
  bytes: Uint8Array,
  currentBlocks: readonly MemoryBlock[],
): MemoryBlock {
  const taken = new Set(currentBlocks.map((b) => b.name));
  const name = uniqueName(parsed.name, taken);
  return {
    id: `sidecar-${name}`,
    name,
    address: parsed.address,
    bytes,
    kind: 'code',
  };
}
