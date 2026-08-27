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
}

/** Per-field validation messages; a field is absent when it is fine. */
export interface BlockSettingsErrors {
  name?: string;
  address?: string;
  entry?: string;
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

/** The draft a block opens with in the dialog. */
export function draftFromBlock(block: Block): BlockSettingsDraft {
  return {
    name: block.name,
    address: formatWord(block.address),
    kind: block.kind,
    entry: block.entry !== undefined ? formatWord(block.entry) : '',
    comment: block.comment ?? '',
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
