// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Hidden numeric-payload override for ZX Spectrum constants (mirrors the
 * ZX81 `\{=...}` design).
 *
 * A numeric constant is stored as its printed digits followed by the number
 * marker 0x0E and a 5-byte form (small-integer or floating point, see
 * numbers.ts). The 5-byte form is the authoritative value the ROM runs; the
 * digits are only how LIST shows it. "Protection" tricks store a 5-byte form
 * that disagrees with the digits (LIST shows `20`, the code jumps to line
 * 9999). To keep such programs byte-exact the detokenizer emits an override
 * notation right after the digits that the tokenizer honours instead of
 * re-encoding the digits:
 *
 *   `{=9999}`        - the 5-byte form is the canonical encoding of 9999
 *   `{=$008400...}`  - a non-canonical form, given as its raw 5 bytes
 *
 * `{=...}` reuses the Spectrum's `{...}` escape convention; it only ever
 * appears immediately after a numeric literal's digits.
 */

import { decodeSpectrumNumber, encodeSpectrumNumber } from './numbers';

function bytesEqual(a: ArrayLike<number>, b: ArrayLike<number>): boolean {
  if (a.length < 5 || b.length < 5) return false;
  for (let k = 0; k < 5; k++)
    if ((a[k]! & 0xff) !== (b[k]! & 0xff)) return false;
  return true;
}

/**
 * The `{=...}` override for a stored 5-byte form: the decimal value when it
 * re-encodes exactly, otherwise the raw five bytes as `$HHHHHHHHHH`.
 */
export function floatOverrideNotation(stored: ArrayLike<number>): string {
  const value = decodeSpectrumNumber(stored);
  const decimal = Number.isInteger(value) ? String(value) : String(value);
  try {
    if (bytesEqual(encodeSpectrumNumber(value), stored)) {
      return `{=${decimal}}`;
    }
  } catch {
    // fall through to the raw-byte form
  }
  let hex = '';
  for (let k = 0; k < 5; k++)
    hex += (stored[k]! & 0xff).toString(16).padStart(2, '0');
  return `{=$${hex.toUpperCase()}}`;
}

/**
 * Parse a `{=...}` numeric override (see {@link floatOverrideNotation}) starting
 * at index i (which must point at the `{`). Returns the 5 stored form bytes and
 * the index just past the closing brace, or null if it is not a valid override.
 */
export function parseFloatOverride(
  text: string,
  i: number,
): { bytes: number[]; end: number } | null {
  if (text[i] !== '{' || text[i + 1] !== '=') return null;
  const close = text.indexOf('}', i + 2);
  if (close === -1) return null;
  const content = text.slice(i + 2, close);
  const end = close + 1;
  if (content.startsWith('$')) {
    const hex = content.slice(1);
    if (!/^[0-9A-Fa-f]{10}$/.test(hex)) return null;
    const bytes: number[] = [];
    for (let k = 0; k < 10; k += 2)
      bytes.push(parseInt(hex.slice(k, k + 2), 16));
    return { bytes, end };
  }
  const value = Number(content);
  if (!Number.isFinite(value)) return null;
  try {
    return { bytes: Array.from(encodeSpectrumNumber(value)), end };
  } catch {
    return null;
  }
}
