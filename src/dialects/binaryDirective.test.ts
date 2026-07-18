// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  binaryRecordInfo,
  formatBinaryDirective,
  isBinaryDirective,
  parseBinaryDirective,
} from './binaryDirective';

/** A ZX81-shaped record: lineNo BE, len LE, body, 0x76 terminator. */
function record(lineNo: number, body: number[]): Uint8Array {
  const len = body.length + 1;
  return Uint8Array.from([
    (lineNo >> 8) & 0xff,
    lineNo & 0xff,
    len & 0xff,
    (len >> 8) & 0xff,
    ...body,
    0x76,
  ]);
}

describe('isBinaryDirective', () => {
  it('matches the prefix in any case, with indent', () => {
    expect(isBinaryDirective('#BIN AAAA')).toBe(true);
    expect(isBinaryDirective('#bin AAAA')).toBe(true);
    expect(isBinaryDirective('  #Bin AAAA')).toBe(true);
    expect(isBinaryDirective('#BIN')).toBe(true); // malformed, but a directive
  });

  it('rejects non-directives', () => {
    expect(isBinaryDirective('10 PRINT "#BIN"')).toBe(false);
    expect(isBinaryDirective('#BINARY AAAA')).toBe(false);
    expect(isBinaryDirective('REM #BIN AAAA')).toBe(false);
    expect(isBinaryDirective('')).toBe(false);
  });
});

describe('parseBinaryDirective', () => {
  it('returns null for non-directive lines', () => {
    expect(parseBinaryDirective('10 PRINT')).toBeNull();
    expect(parseBinaryDirective('')).toBeNull();
  });

  it('decodes a well-formed payload', () => {
    const rec = record(1, [0xea, 0x00, 0x76, 0xff]);
    const parsed = parseBinaryDirective(formatBinaryDirective(rec));
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty('error');
    if (parsed && 'record' in parsed) {
      expect(Array.from(parsed.record)).toEqual(Array.from(rec));
    }
  });

  it('is case-insensitive on the prefix but not the payload', () => {
    const rec = record(0, [0xea]);
    const line = formatBinaryDirective(rec).replace('#BIN', '#bin');
    const parsed = parseBinaryDirective(line);
    if (parsed && 'record' in parsed) {
      expect(Array.from(parsed.record)).toEqual(Array.from(rec));
    } else {
      throw new Error('expected a record');
    }
  });

  it('reports a missing payload with its column', () => {
    expect(parseBinaryDirective('#BIN')).toEqual({
      error: 'Missing base64 payload after #BIN',
      column: 4,
    });
    expect(parseBinaryDirective('#BIN   ')).toEqual({
      error: 'Missing base64 payload after #BIN',
      column: 7,
    });
  });

  it('rejects malformed base64', () => {
    for (const bad of [
      '#BIN not-base64!',
      '#BIN AAA',
      '#BIN A===',
      '#BIN AA=A',
    ]) {
      const parsed = parseBinaryDirective(bad);
      expect(parsed).toEqual({
        error: 'Invalid base64 in #BIN directive',
        column: 5,
      });
    }
  });

  it('rejects payloads with internal whitespace', () => {
    expect(parseBinaryDirective('#BIN AAAA BBBB')).toEqual({
      error: 'Invalid base64 in #BIN directive',
      column: 5,
    });
  });
});

describe('formatBinaryDirective', () => {
  it('round-trips every byte value', () => {
    const rec = Uint8Array.from(Array.from({ length: 256 }, (_, i) => i));
    const parsed = parseBinaryDirective(formatBinaryDirective(rec));
    if (parsed && 'record' in parsed) {
      expect(Array.from(parsed.record)).toEqual(Array.from(rec));
    } else {
      throw new Error('expected a record');
    }
  });
});

describe('binaryRecordInfo', () => {
  it('reads the big-endian line number and size', () => {
    const rec = record(9955, [0xea, 0x00]);
    expect(binaryRecordInfo(rec)).toEqual({ lineNo: 9955, recordBytes: 7 });
  });

  it('is safe on short records', () => {
    expect(binaryRecordInfo(Uint8Array.from([0x01]))).toEqual({
      lineNo: 0x0100,
      recordBytes: 1,
    });
  });
});
