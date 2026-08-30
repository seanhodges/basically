// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The BlockSettingsDialog's pure edit model: parse and validate the form's
 * draft fields, then build the updated {@link Block}. Kept free of React
 * and store concerns so the tricky parts - address spellings, name
 * collisions, and the move-a-block reassembly - unit-test directly.
 *
 * Moving a code block is more than changing a number: assembled bytes encode
 * absolute label addresses, so when the block has assembly source the apply
 * step rewrites its `ORG` (when present) and re-assembles at the new address.
 * A source that no longer assembles keeps its old bytes - the assembly
 * editor's error dot reports the problem the next time the tab opens.
 */

import type { AsmEngine } from '../asm/types';
import { formatWord } from '../asm/format';
import { maxBlockLength, setLength } from './byteEdit';
import type { Block } from '../dialects/types';
import { isValidBlockName } from '../storage/projectFile';

/** The dialog's editable fields, as the user typed them. */
export interface BlockSettingsDraft {
  name: string;
  /** Address as text: `$9000`, `0x9000`, `&9000` or `36864`. */
  address: string;
  kind: Block['kind'];
  /** Optional entry address, same spellings; blank = none. */
  entry: string;
  /** Optional free-text comment; blank = none. */
  comment: string;
  /** How many bytes the block holds, as text. A count, so decimal only. */
  size: string;
}

/** Per-field validation messages; a field is absent when it is fine. */
export interface BlockSettingsErrors {
  name?: string;
  address?: string;
  entry?: string;
  size?: string;
}

/**
 * How a block's extent reads: the address of its first byte to the address of
 * its last. A block holding no bytes occupies no range at all - `$8000 - $7FFF`
 * would be worse than useless - so it reads as its address alone, matching how
 * the lint treats an empty block for overlaps.
 */
export function formatBlockExtent(address: number, byteCount: number): string {
  if (byteCount < 1) return formatWord(address);
  return `${formatWord(address)} - ${formatWord(address + byteCount - 1)}`;
}

/** Parse a `$`/`0x`/`&`-prefixed hex or plain-decimal 16-bit address. */
export function parseAddressInput(text: string): number | null {
  const trimmed = text.trim();
  const hex = /^(\$|0x|&)([0-9a-f]+)$/i.exec(trimmed);
  const value = hex
    ? parseInt(hex[2]!, 16)
    : /^[0-9]+$/.test(trimmed)
      ? parseInt(trimmed, 10)
      : NaN;
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) return null;
  return value;
}

/** Parse a byte count as typed. A count is not an address: decimal only. */
export function parseSizeInput(text: string): number | null {
  const trimmed = text.trim();
  if (!/^[0-9]+$/.test(trimmed)) return null;
  return parseInt(trimmed, 10);
}

/**
 * Whether the block's length is the assembler's to decide rather than the
 * user's. Such a block's settings state its size instead of offering it: a size
 * set here would either be ignored or fight the next re-assembly.
 */
export function sizeIsAssembled(
  draft: BlockSettingsDraft,
  engine: AsmEngine | null,
): boolean {
  return draft.kind === 'code' && engine !== null;
}

/** The draft a block opens with in the dialog. */
export function draftFromBlock(block: Block): BlockSettingsDraft {
  return {
    name: block.name,
    address: formatWord(block.address),
    kind: block.kind,
    entry: block.entry !== undefined ? formatWord(block.entry) : '',
    comment: block.comment ?? '',
    size: String(block.bytes.length),
  };
}

/**
 * Validate a draft against the document. `blocks` is the full set (the edited
 * block included); names must stay unique among the others.
 */
export function validateBlockSettings(
  draft: BlockSettingsDraft,
  blockId: string,
  blocks: readonly Block[],
): BlockSettingsErrors {
  const errors: BlockSettingsErrors = {};
  const name = draft.name.trim();
  if (!isValidBlockName(name)) {
    errors.name =
      'Names start with a letter and contain only letters, digits or underscores.';
  } else if (blocks.some((b) => b.id !== blockId && b.name === name)) {
    errors.name = `Another block is already called "${name}".`;
  }
  if (parseAddressInput(draft.address) === null) {
    errors.address = 'Enter an address like $9000 or 36864 (0-$FFFF).';
  }
  if (draft.entry.trim() !== '' && parseAddressInput(draft.entry) === null) {
    errors.entry = 'Enter an address like $9000 or 36864, or leave blank.';
  }
  const size = parseSizeInput(draft.size);
  if (size === null) {
    errors.size = 'Enter a whole number of bytes.';
  } else {
    // Against the address the block is being saved with, not the one it is
    // leaving: a move and a resize together are bounded by where it lands.
    const address = parseAddressInput(draft.address);
    const ceiling = address === null ? null : maxBlockLength(address);
    if (ceiling !== null && size > ceiling) {
      errors.size = `A block can hold ${ceiling} bytes at this address.`;
    }
  }
  return errors;
}

/** Replace the operand of a leading `ORG` directive, when the source has one. */
function rewriteOrg(asmSource: string, address: number): string {
  return asmSource.replace(
    /^(\s*(?:[A-Za-z_][A-Za-z0-9_]*:)?\s*ORG\s+)\S+/im,
    `$1${formatWord(address)}`,
  );
}

/**
 * Build the updated block from a validated draft. When the address moved and
 * the block carries assembly source, the source's `ORG` is rewritten and the
 * routine re-assembled at the new address (absolute label references must
 * follow the move); if it no longer assembles the old bytes are kept and the
 * assembly editor will surface the errors. Byte-identical reassembly reuses
 * the existing bytes array so an open editor doesn't re-seed its text.
 *
 * The size is applied after the move, so it is clamped against the address the
 * block lands at - and only where it was the user's to set: a block the
 * assembler sizes keeps whatever length the re-assembly gave it.
 */
export function applyBlockSettings(
  block: Block,
  draft: BlockSettingsDraft,
  engine: AsmEngine | null,
): Block {
  const name = draft.name.trim();
  const address = parseAddressInput(draft.address)!;
  const entryText = draft.entry.trim();
  const entry = entryText === '' ? undefined : parseAddressInput(entryText)!;
  const comment = draft.comment.trim();

  let bytes = block.bytes;
  let asmSource = block.asmSource;
  if (address !== block.address && asmSource !== undefined && engine) {
    asmSource = rewriteOrg(asmSource, address);
    const result = engine.assemble(asmSource, address);
    if (result.ok && !bytesEqual(result.bytes, bytes)) bytes = result.bytes;
  }

  const size = parseSizeInput(draft.size);
  if (
    !sizeIsAssembled(draft, engine) &&
    size !== null &&
    size !== bytes.length
  ) {
    // The same pad-with-zero, truncate-from-the-end, clamp-to-memory rule the
    // editor's own last byte follows.
    const outcome = setLength({ bytes, address }, size);
    if (outcome.ok) bytes = outcome.edit.bytes;
  }

  const updated: Block = {
    ...block,
    name,
    address,
    kind: draft.kind,
    bytes,
  };
  if (asmSource !== undefined) updated.asmSource = asmSource;
  if (entry !== undefined) updated.entry = entry;
  else delete updated.entry;
  if (comment !== '') updated.comment = comment;
  else delete updated.comment;
  return updated;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * A block name derived from the name a program gave a file it saved. The two
 * alphabets barely overlap: a block name is an identifier (letter first, then
 * letters, digits and underscores, unique per document), while a file name is
 * whatever the machine's character set allows - spaces, punctuation, graphics
 * characters. So drop what a block name cannot hold, drop what is left before
 * the first letter, and fall back to a stem when nothing usable remains.
 *
 * `taken` is the names already in the document; the result is the first free
 * one, the same first-free rule `addBlock` applies to `block<n>`.
 *
 * Not the download-name helper: that one targets filenames, whose alphabet
 * includes `.`, `_` and `-`, so it can return a name a block may not have.
 */
export function blockNameFromFileName(
  fileName: string,
  taken: Iterable<string>,
): string {
  const stem =
    fileName.replace(/[^A-Za-z0-9_]+/g, '').replace(/^[^A-Za-z]+/, '') ||
    'data';
  const used = new Set(taken);
  if (!used.has(stem)) return stem;
  let n = 2;
  while (used.has(`${stem}${n}`)) n++;
  return `${stem}${n}`;
}
