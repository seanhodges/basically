// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * The `#BIN <base64>` source directive: one physical line standing in for a
 * program-area line record that cannot be expressed as BASIC text (the
 * hidden-machine-code-in-REM trick - line number 0, duplicate line numbers,
 * bodies with embedded newline bytes). The payload is the verbatim raw record
 * slice from the native binary, so re-tokenizing splices the original bytes
 * back byte-for-byte. Dialect-agnostic: what counts as a valid record is the
 * dialect tokenizer's business; this module only carries the bytes.
 */

import { bytesToBase64, base64ToBytes } from '../storage/vfs/base64';

/** `#BIN` (any case) at line start, after optional indent, as a whole word. */
const PREFIX_RE = /^[ \t]*#bin(?![^\s])/i;

/** Strict RFC 4648 base64: full quads with optional final padding. */
const BASE64_RE =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export type ParsedBinaryDirective =
  | { record: Uint8Array }
  | { error: string; column: number };

/** Whether this physical line is a `#BIN` directive (well-formed or not). */
export function isBinaryDirective(lineText: string): boolean {
  return PREFIX_RE.test(lineText);
}

/**
 * Parse a physical line as a `#BIN` directive. Returns null when the line is
 * not a directive at all, the decoded record on success, or an error message
 * with the 0-based column of the offending payload.
 */
export function parseBinaryDirective(
  lineText: string,
): ParsedBinaryDirective | null {
  const m = PREFIX_RE.exec(lineText);
  if (!m) return null;
  const rest = lineText.slice(m[0].length);
  const column = m[0].length + (rest.length - rest.trimStart().length);
  const payload = rest.trim();
  if (payload === '') {
    return { error: 'Missing base64 payload after #BIN', column };
  }
  if (/\s/.test(payload) || !BASE64_RE.test(payload)) {
    return { error: 'Invalid base64 in #BIN directive', column };
  }
  const record = base64ToBytes(payload);
  if (record.length === 0) {
    return { error: 'Empty #BIN payload', column };
  }
  return { record };
}

/** Render a raw line record as its canonical `#BIN <base64>` source line. */
export function formatBinaryDirective(record: Uint8Array): string {
  return `#BIN ${bytesToBase64(record)}`;
}

/**
 * The embedded line number (u16 big-endian, the Sinclair record convention)
 * and total record size - what the editor chip displays and what merge/sort
 * tools order by.
 */
export function binaryRecordInfo(record: Uint8Array): {
  lineNo: number;
  recordBytes: number;
} {
  const lineNo = ((record[0] ?? 0) << 8) | (record[1] ?? 0);
  return { lineNo, recordBytes: record.length };
}
