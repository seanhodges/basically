// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Number formatting and parsing for the assembler/disassembler pair. The
 * formatter side is pinned (it defines the round-trip contract): `$` hex,
 * uppercase, 2 digits for byte operands, 4 for word operands. The parser side
 * is generous: `$NN`, `0xNN`, `NNh` (leading digit), `%NNNN`/`0bNNNN` binary
 * and plain decimal, in any case.
 *
 * `$` is strictly a hex sigil - it never means "current address" - which
 * keeps disassembly (always absolute targets) unambiguous.
 */

/** `$XX` - pinned rendering of a byte value. */
export function formatByte(value: number): string {
  return '$' + (value & 0xff).toString(16).toUpperCase().padStart(2, '0');
}

/** `$XXXX` - pinned rendering of a word value. */
export function formatWord(value: number): string {
  return '$' + (value & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/** `+$XX` / `-$XX` - pinned rendering of a signed index displacement. */
export function formatDisp(value: number): string {
  const sign = value < 0 ? '-' : '+';
  return sign + formatByte(Math.abs(value));
}

/** A parsed numeric literal, with the width its spelling implies. */
export interface ParsedLiteral {
  value: number;
  /**
   * True when the spelling names a byte-sized value: hex with at most two
   * digits, binary with at most eight, or decimal/octal-free decimal below
   * 256. `$00FF` is NOT narrow - the 6502 zero-page/absolute choice hangs on
   * exactly this distinction.
   */
  narrow: boolean;
}

const HEX_SIGIL_RE = /^\$([0-9a-f]+)$/i;
const HEX_0X_RE = /^0x([0-9a-f]+)$/i;
const HEX_SUFFIX_RE = /^([0-9][0-9a-f]*)h$/i;
const BIN_SIGIL_RE = /^%([01]+)$/i;
const BIN_0B_RE = /^0b([01]+)$/i;
const DEC_RE = /^[0-9]+$/;

/**
 * Parse one numeric literal (no sign, no expression). Returns null when the
 * text is not a number - e.g. a label reference.
 */
export function parseLiteral(text: string): ParsedLiteral | null {
  const m = HEX_SIGIL_RE.exec(text) ?? HEX_0X_RE.exec(text);
  if (m) {
    // Width by digit count as written: `$FF` is narrow, `$00FF` is wide.
    return { value: parseInt(m[1], 16), narrow: m[1].length <= 2 };
  }
  const mh = HEX_SUFFIX_RE.exec(text);
  if (mh) {
    // The leading digit is syntax (`0FEh`), so one leading zero is free.
    const digits = mh[1].replace(/^0(?=.)/, '');
    return { value: parseInt(mh[1], 16), narrow: digits.length <= 2 };
  }
  const mb = BIN_SIGIL_RE.exec(text) ?? BIN_0B_RE.exec(text);
  if (mb) {
    return { value: parseInt(mb[1], 2), narrow: mb[1].length <= 8 };
  }
  if (DEC_RE.test(text)) {
    const value = parseInt(text, 10);
    return { value, narrow: value < 256 };
  }
  return null;
}

/** Whether `text` could open a numeric literal (vs a label). */
export function looksNumeric(text: string): boolean {
  return /^[$%0-9]/.test(text) || /^0[xb]/i.test(text);
}
