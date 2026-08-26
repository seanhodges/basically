// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The byte editor's pure edit model: every way a block's bytes change from that
 * surface, as functions over an array rather than commands against a view.
 * `blockEdit.ts` is the same idea for a block's metadata.
 *
 * Two rules shape all of it. Editing a block's *interior* is overwrite-only -
 * nothing is inserted or removed there, so the addresses of the bytes already
 * present never shift under the BASIC that references them. A block's *length*
 * is not covered by that rule: a value entered past the last byte appends, and
 * removing the last byte truncates, because neither moves a byte that is
 * already there.
 *
 * Every operation returns an outcome rather than throwing, so a caller never
 * handles an exception. `CharsetMapping.toMachine` signals an unrepresentable
 * character by throwing `CharsetError`; that is caught here specifically and
 * anything else rethrown (the catch in `src/dialects/sourceUnits.ts` is the
 * reference), and comes back as a refusal the surface can show.
 */

import {
  CharsetError,
  type CharsetMapping,
  type ListingLayout,
} from '../dialects/types';
import { containsTerminator } from './listingBlockEdit';

/** The highest address a byte can occupy, one past the 64K ceiling. */
const ADDRESS_SPACE = 0x10000;

/** Which half of a byte the next hex digit lands in. */
export type NibblePos = 'high' | 'low';

/** Where the caret is: a byte index, and the nibble hex entry writes next. */
export interface ByteCaret {
  index: number;
  nibble: NibblePos;
}

/** The block being edited - its bytes, and the address they start at. */
export interface ByteTarget {
  bytes: Uint8Array;
  address: number;
}

/** New bytes and where the caret ends up. */
export interface ByteEdit {
  bytes: Uint8Array;
  caret: ByteCaret;
}

export type ByteEditOutcome =
  | { ok: true; edit: ByteEdit }
  | { ok: false; message: string };

/** How long the block at `address` can grow before it runs off the top of memory. */
export function maxBlockLength(address: number): number {
  return Math.max(0, ADDRESS_SPACE - address);
}

/** A copy of `bytes` long enough to hold `index`, zero-padded if it grows. */
function withCapacity(bytes: Uint8Array, index: number): Uint8Array {
  const length = Math.max(bytes.length, index + 1);
  const out = new Uint8Array(length);
  out.set(bytes);
  return out;
}

/** Parse a `$`/`0x`/`&` hex or plain decimal byte value (`0`-`255`). */
export function parseByteValue(text: string): number | null {
  const trimmed = text.trim();
  const hex = /^(\$|0x|&)([0-9a-f]+)$/i.exec(trimmed);
  const value = hex
    ? parseInt(hex[2]!, 16)
    : /^[0-9]+$/.test(trimmed)
      ? parseInt(trimmed, 10)
      : NaN;
  if (!Number.isInteger(value) || value < 0 || value > 0xff) return null;
  return value;
}

/** Whether `key` is a single hex digit - the only key the hex view accepts. */
export function isHexDigit(key: string): boolean {
  return /^[0-9a-f]$/i.test(key);
}

/**
 * Write one hex digit at the caret. The high nibble keeps the byte's low half
 * and leaves the caret on the same byte; the low nibble completes it and
 * advances. At the append position the byte starts from zero, so entering a
 * value there grows the block by one.
 */
export function applyHexDigit(
  target: ByteTarget,
  caret: ByteCaret,
  digit: string,
): ByteEditOutcome {
  if (!isHexDigit(digit)) {
    return { ok: false, message: `"${digit}" is not a hex digit.` };
  }
  const { bytes, address } = target;
  const index = caret.index;
  if (index < 0 || index > bytes.length) {
    return { ok: false, message: 'The caret is not on a byte.' };
  }
  if (index >= maxBlockLength(address)) {
    return {
      ok: false,
      message: 'A block cannot grow past the top of memory.',
    };
  }
  const value = parseInt(digit, 16);
  const current = index < bytes.length ? bytes[index]! : 0;
  const next =
    caret.nibble === 'high'
      ? ((value << 4) | (current & 0x0f)) & 0xff
      : ((current & 0xf0) | value) & 0xff;
  const out = withCapacity(bytes, index);
  out[index] = next;
  return {
    ok: true,
    edit: {
      bytes: out,
      caret:
        caret.nibble === 'high'
          ? { index, nibble: 'low' }
          : { index: index + 1, nibble: 'high' },
    },
  };
}

/**
 * Write one typed character at the caret, encoded through the machine's own
 * character set. A character that machine has no code for is refused rather
 * than stored as something else.
 */
export function applyCharacter(
  target: ByteTarget,
  index: number,
  text: string,
  charset: CharsetMapping,
): ByteEditOutcome {
  const { bytes, address } = target;
  if (index < 0 || index > bytes.length) {
    return { ok: false, message: 'The caret is not on a byte.' };
  }
  if (index >= maxBlockLength(address)) {
    return {
      ok: false,
      message: 'A block cannot grow past the top of memory.',
    };
  }
  let codes: Uint8Array;
  try {
    codes = charset.toMachine(text);
  } catch (e) {
    if (!(e instanceof CharsetError)) throw e;
    return {
      ok: false,
      message: `This machine has no character for "${text}".`,
    };
  }
  if (codes.length !== 1) {
    return {
      ok: false,
      message: `"${text}" is not a single character on this machine.`,
    };
  }
  const out = withCapacity(bytes, index);
  out[index] = codes[0]!;
  return {
    ok: true,
    edit: { bytes: out, caret: { index: index + 1, nibble: 'high' } },
  };
}

/** Drop the block's last byte. An empty block has nothing to drop. */
export function truncateLast(target: ByteTarget): ByteEditOutcome {
  const { bytes } = target;
  if (bytes.length === 0) {
    return { ok: false, message: 'The block is already empty.' };
  }
  const out = bytes.slice(0, bytes.length - 1);
  return {
    ok: true,
    edit: { bytes: out, caret: { index: out.length, nibble: 'high' } },
  };
}

/**
 * Resize the block: growing pads with `$00`, shrinking truncates from the end.
 * Clamped to what fits above the block's address, and to zero below - a
 * zero-length block is legal, and `blockRange` already treats one as occupying
 * nothing.
 */
export function setLength(target: ByteTarget, length: number): ByteEditOutcome {
  if (!Number.isInteger(length)) {
    return { ok: false, message: 'Enter a whole number of bytes.' };
  }
  const capped = Math.max(0, Math.min(maxBlockLength(target.address), length));
  const out = new Uint8Array(capped);
  out.set(target.bytes.subarray(0, capped));
  return {
    ok: true,
    edit: {
      bytes: out,
      caret: { index: Math.min(capped, target.bytes.length), nibble: 'high' },
    },
  };
}

/**
 * Fill an address range with one byte value. The range is named rather than
 * swept, and clamped to the block's current extent - fill changes values, not
 * length, now that growing a block goes through the document.
 */
export function fillRange(
  target: ByteTarget,
  from: number,
  to: number,
  value: number,
): ByteEditOutcome {
  const { bytes, address } = target;
  if (bytes.length === 0) {
    return { ok: false, message: 'The block holds no bytes to fill.' };
  }
  if (value < 0 || value > 0xff || !Number.isInteger(value)) {
    return { ok: false, message: 'Enter a byte value between $00 and $FF.' };
  }
  if (to < from) {
    return { ok: false, message: 'The range ends before it starts.' };
  }
  const start = Math.max(from, address);
  const end = Math.min(to, address + bytes.length - 1);
  if (end < start) {
    return { ok: false, message: 'That range lies outside this block.' };
  }
  const out = bytes.slice();
  out.fill(value, start - address, end - address + 1);
  return {
    ok: true,
    edit: { bytes: out, caret: { index: start - address, nibble: 'high' } },
  };
}

/**
 * Why a machine that carries its blocks inside the BASIC listing cannot hold
 * these bytes, or `null` when it can. A ZX80 record is NEWLINE-terminated
 * rather than length-prefixed, so a code byte equal to the terminator (0x76,
 * Z80 `HALT`) would end the line early on real hardware - `buildRemRecord`
 * refuses the same bytes when the write-back reaches it. Checked before the
 * edit is made so nothing has to be unwound after the store declines it.
 */
export function listingByteRefusal(
  bytes: Uint8Array,
  layout: ListingLayout | null | undefined,
): string | null {
  if (!layout || layout.hasLengthField) return null;
  if (!containsTerminator(bytes, layout)) return null;
  const code = layout.terminator.toString(16).toUpperCase().padStart(2, '0');
  return (
    `This machine stores code in NEWLINE-terminated REM lines, so a byte ` +
    `of $${code} cannot be held here.`
  );
}

/** Replace the block's contents wholesale - the inbound half of `.bin`. */
export function loadBytes(
  target: ByteTarget,
  incoming: Uint8Array,
): ByteEditOutcome {
  const cap = maxBlockLength(target.address);
  if (incoming.length > cap) {
    return {
      ok: false,
      message: `That file holds ${incoming.length} bytes, and only ${cap} fit above ${target.address}.`,
    };
  }
  return {
    ok: true,
    edit: { bytes: incoming.slice(), caret: { index: 0, nibble: 'high' } },
  };
}
