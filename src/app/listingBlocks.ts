// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Project the `#BIN` REM records embedded in a ZX80/ZX81 BASIC listing to
 * {@link MemoryBlock}s - the read side of the "blocks are a view over the
 * listing" model (see {@link MemoryBlocksSupport.inListing}). `source` is the
 * single source of truth; these blocks are derived, their addresses fixed by
 * where each record sits in the tokenized program, and they ride inside the
 * monolithic `.P`/`.O` image with no RAM injection.
 *
 * Pure and dialect-agnostic: the record layout arrives as a {@link ListingLayout}.
 * The write side (regenerate a `#BIN` line from edited bytes) lives in
 * `./listingBlockEdit.ts`.
 */

import { parseBinaryDirective } from '../dialects/binaryDirective';
import type { ListingLayout, MemoryBlock } from '../dialects/types';

/**
 * User-assigned overrides for a derived listing block, keyed by ordinal (its
 * index among the `#BIN` lines, document order). Since a `#BIN` record carries
 * no name/kind/comment, these ride in the document's project metadata instead
 * (see the store's `listingBlockMeta`) and are overlaid onto the derived
 * blocks. Best-effort: a structural edit that reorders `#BIN` lines can shift
 * which block an override lands on.
 */
export interface ListingBlockMeta {
  name?: string;
  kind?: 'code' | 'data';
  comment?: string;
  /**
   * The block editor's last-assembled source. A `#BIN` record holds only raw
   * bytes, so re-disassembling them can't tell code from a `DB` data section (a
   * data byte like 0x21 decodes back as `LD HL,...`). Persisting the text lets
   * a reload restore it verbatim - data sections, labels and comments included.
   * Honored only when it still assembles to the block's bytes (see the store's
   * `overlayListingAsmSource`), so the bytes stay the source of truth.
   */
  asmSource?: string;
}

/** Overlay a user override onto a derived block (absent fields keep defaults). */
export function applyListingMeta(
  block: MemoryBlock,
  meta: ListingBlockMeta | undefined,
): MemoryBlock {
  if (!meta) return block;
  return {
    ...block,
    ...(meta.name ? { name: meta.name } : {}),
    ...(meta.kind ? { kind: meta.kind } : {}),
    ...(meta.comment ? { comment: meta.comment } : {}),
  };
}

/** One program-area line record with its byte offset from the program base. */
export interface WalkedRecord {
  /** Byte offset of the record from the start of the program area. */
  start: number;
  /** Embedded line number (u16 BE). */
  lineNo: number;
  /** The full record bytes: `[lineNo][len?][body…][terminator?]`. */
  record: Uint8Array;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Walk a tokenized program into its line records, in order. ZX81 records carry
 * a u16 LE length field (`hasLengthField`); ZX80 records are delimited by the
 * terminator byte. A final record that runs past the buffer (truncated) ends
 * the walk rather than producing a bad slice.
 */
export function walkRecords(
  bytes: Uint8Array,
  layout: ListingLayout,
): WalkedRecord[] {
  const out: WalkedRecord[] = [];
  let p = 0;
  while (p + 2 <= bytes.length) {
    const lineNo = (bytes[p]! << 8) | bytes[p + 1]!;
    let recordEnd: number;
    if (layout.hasLengthField) {
      if (p + 4 > bytes.length) break;
      const len = bytes[p + 2]! | (bytes[p + 3]! << 8);
      recordEnd = p + 4 + len;
      if (recordEnd > bytes.length) break; // truncated final record
    } else {
      let e = p + 2;
      while (e < bytes.length && bytes[e] !== layout.terminator) e++;
      recordEnd = e < bytes.length ? e + 1 : e; // include the terminator
    }
    if (recordEnd <= p) break; // defensive: never stall
    out.push({ start: p, lineNo, record: bytes.slice(p, recordEnd) });
    p = recordEnd;
  }
  return out;
}

/**
 * The code payload of a record: the body after an optional leading REM token,
 * up to (but excluding) a trailing terminator byte when present. This is what a
 * block's `bytes` hold and what its `address` points at.
 */
function codeSlice(
  record: Uint8Array,
  layout: ListingLayout,
): { code: Uint8Array; codeOffset: number } {
  const hasRem = record[layout.headerLen] === layout.remToken;
  const codeOffset = layout.headerLen + (hasRem ? 1 : 0);
  const end =
    record[record.length - 1] === layout.terminator
      ? record.length - 1
      : record.length;
  return {
    code: record.slice(codeOffset, Math.max(codeOffset, end)),
    codeOffset,
  };
}

/**
 * Derive the listing-backed blocks from a program's source. Each well-formed
 * `#BIN` physical line becomes one `code` block, in document order, with its
 * address computed from where its record lands in the tokenized program
 * (`base + recordStart + codeOffset`). Names/kinds/comments the user assigned
 * are overlaid by the store layer (this stays pure and metadata-free).
 *
 * Addresses need the tokenized offsets, so records are matched to the walked
 * program in order (tolerating interspersed text records and duplicate `#BIN`
 * payloads). When a match can't be found - a program with tokenizer errors that
 * shifts offsets - that block falls back to the program base rather than a
 * wrong address; run/export is already gated on those errors elsewhere.
 */
export function deriveListingBlocks(
  source: string,
  layout: ListingLayout,
): MemoryBlock[] {
  const binRecords: Uint8Array[] = [];
  for (const line of source.split('\n')) {
    const parsed = parseBinaryDirective(line.trim());
    if (parsed && 'record' in parsed) binRecords.push(parsed.record);
  }
  if (binRecords.length === 0) return [];

  const { bytes } = layout.tokenize(source);
  const records = walkRecords(bytes, layout);

  const blocks: MemoryBlock[] = [];
  let ptr = 0;
  binRecords.forEach((rec, i) => {
    let start: number | null = null;
    for (let j = ptr; j < records.length; j++) {
      if (bytesEqual(records[j]!.record, rec)) {
        start = records[j]!.start;
        ptr = j + 1;
        break;
      }
    }
    const { code, codeOffset } = codeSlice(rec, layout);
    const address = (layout.base + (start ?? 0) + codeOffset) & 0xffff;
    blocks.push({
      id: `listing-${i}`,
      name: `bin${i + 1}`,
      address,
      bytes: code,
      kind: 'code',
    });
  });
  return blocks;
}
