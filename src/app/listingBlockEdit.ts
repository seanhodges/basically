// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The write side of the listing-backed blocks model: regenerate, insert and
 * remove the `#BIN` REM records that back ZX80/ZX81 blocks (the read side is
 * `./listingBlocks.ts`). Editing a block's bytes rewrites its one physical
 * `#BIN` source line in place; the tokenizer then splices the new record into
 * the monolithic `.P`/`.O` image byte-for-byte. Pure and dialect-agnostic via
 * {@link ListingLayout}.
 */

import {
  formatBinaryDirective,
  isBinaryDirective,
  parseBinaryDirective,
} from '../dialects/binaryDirective';
import type { ListingLayout } from '../dialects/types';

/** The return opcode used for a fresh code block's stub (Z80 `RET`). */
const RET = 0xc9;

/**
 * Assemble a program-area line record `[lineNo BE][len LE?][REM][code][term]`
 * for a hidden-code REM - the inverse of `listingBlocks.ts`'s code slice. ZX81
 * records carry a u16 LE length field describing `REM + code + terminator`;
 * ZX80 records omit it and are terminator-delimited, so their code must not
 * contain the terminator byte (0x76, e.g. Z80 `HALT`) or it would end the line
 * early on real hardware.
 */
export function buildRemRecord(
  lineNo: number,
  code: Uint8Array,
  layout: ListingLayout,
): Uint8Array {
  if (!layout.hasLengthField && containsTerminator(code, layout)) {
    throw new Error(
      `This machine stores code in NEWLINE-terminated REM lines, so a code ` +
        `byte of 0x${layout.terminator.toString(16)} (e.g. HALT) can't be held here.`,
    );
  }
  const head = [(lineNo >> 8) & 0xff, lineNo & 0xff];
  const body = [layout.remToken, ...code, layout.terminator];
  if (!layout.hasLengthField) {
    return Uint8Array.from([...head, ...body]);
  }
  const len = body.length; // REM + code + terminator
  return Uint8Array.from([...head, len & 0xff, (len >> 8) & 0xff, ...body]);
}

/** Whether the code bytes contain the record terminator (a ZX80 hazard). */
export function containsTerminator(
  code: Uint8Array,
  layout: ListingLayout,
): boolean {
  return code.includes(layout.terminator);
}

/** Physical-line indices of every well-formed `#BIN` line, in document order. */
function binLineIndices(lines: string[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (!isBinaryDirective(trimmed)) continue;
    const parsed = parseBinaryDirective(trimmed);
    if (parsed && 'record' in parsed) out.push(i);
  }
  return out;
}

/** The embedded line number (u16 BE) of a record. */
function recordLineNo(record: Uint8Array): number {
  return ((record[0] ?? 0) << 8) | (record[1] ?? 0);
}

/**
 * Regenerate the `ordinal`-th `#BIN` line from new code bytes, preserving its
 * embedded line number, and return the new source. The physical line is
 * replaced wholesale with the canonical `#BIN <base64>` text.
 */
export function writeBackListingBlock(
  source: string,
  ordinal: number,
  newCode: Uint8Array,
  layout: ListingLayout,
): string {
  const lines = source.split('\n');
  const indices = binLineIndices(lines);
  const lineIdx = indices[ordinal];
  if (lineIdx === undefined) return source;
  const parsed = parseBinaryDirective(lines[lineIdx]!.trim());
  if (!parsed || !('record' in parsed)) return source;
  const lineNo = recordLineNo(parsed.record);
  lines[lineIdx] = formatBinaryDirective(
    buildRemRecord(lineNo, newCode, layout),
  );
  return lines.join('\n');
}

/** The next line number above every line in the source (for a new record). */
function nextLineNo(source: string): number {
  let max = 0;
  for (const raw of source.split('\n')) {
    const trimmed = raw.trim();
    if (trimmed === '') continue;
    const parsed = parseBinaryDirective(trimmed);
    if (parsed && 'record' in parsed) {
      max = Math.max(max, recordLineNo(parsed.record));
      continue;
    }
    const m = /^(\d+)/.exec(trimmed);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return max + 1;
}

/**
 * Append a new `#BIN` code block (a REM holding a single return opcode) at the
 * end of the program, above the highest line number. Returns the new source and
 * the new block's ordinal (its index among `#BIN` lines, document order). A
 * fresh block lands at the highest address; its `#BIN` line can then be moved in
 * the editor to change where it loads.
 */
export function insertListingBlock(
  source: string,
  layout: ListingLayout,
  code: Uint8Array = Uint8Array.of(RET),
): { source: string; ordinal: number } {
  const record = buildRemRecord(nextLineNo(source), code, layout);
  const line = formatBinaryDirective(record);
  const trimmedEnd = source.replace(/\n+$/, '');
  const newSource = (trimmedEnd === '' ? '' : trimmedEnd + '\n') + line + '\n';
  const ordinal = binLineIndices(newSource.split('\n')).length - 1;
  return { source: newSource, ordinal };
}

/** Remove the `ordinal`-th `#BIN` line, returning the new source. */
export function removeListingBlock(source: string, ordinal: number): string {
  const lines = source.split('\n');
  const indices = binLineIndices(lines);
  const lineIdx = indices[ordinal];
  if (lineIdx === undefined) return source;
  lines.splice(lineIdx, 1);
  return lines.join('\n');
}
