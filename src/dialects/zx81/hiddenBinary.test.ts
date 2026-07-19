// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { zx81 } from './index';
import { buildPFile, withAutoStart } from './pfile';
import { buildPImage } from './targets';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgramWithInfo, structuralWarnings } from './detokenizer';
import { formatBinaryDirective } from '../binaryDirective';
import { buildRemRecord } from '../../app/listingBlockEdit';
import { deriveListingBlocks } from '../../app/listingBlocks';
import { zx81ListingLayout } from './listingLayout';
import {
  importRoundTrip,
  isAcceptableImport,
  firstDifference,
} from '../roundTripHarness';

/**
 * The hidden-machine-code trick as found in real .P files: code stashed in
 * REM lines that are invisible to a BASIC listing - line number 0, several
 * duplicate line numbers, bodies with embedded 0x76 (NEWLINE) bytes. These
 * fixtures mirror the two real-world shapes (a single giant line-0 REM, and
 * line 0 plus duplicated line 1s ahead of a normal listing) and must import
 * as opaque `#BIN` directives that round-trip byte-exactly.
 */

const NEWLINE = 0x76;
const REM = 0xea;

/** Assemble a raw line record; `terminator` defaults to NEWLINE. */
function record(
  no: number,
  body: number[],
  terminator: number = NEWLINE,
): number[] {
  const len = body.length + 1;
  return [
    (no >> 8) & 0xff,
    no & 0xff,
    len & 0xff,
    (len >> 8) & 0xff,
    ...body,
    terminator,
  ];
}

/** Machine-code-looking bytes (Z80 opcodes; raw escapes in the charset). */
function machineCode(n: number, withNewlines = false): number[] {
  const opcodes = [0xcd, 0x21, 0xc9, 0xd5, 0xe5, 0xf1, 0xfe, 0x18];
  const out = Array.from({ length: n }, (_, i) => opcodes[i % opcodes.length]!);
  if (withNewlines) {
    out[Math.floor(n / 3)] = NEWLINE;
    out[Math.floor((2 * n) / 3)] = NEWLINE;
  }
  return out;
}

describe('zx81 hidden binary lines', () => {
  it('imports a giant line-0 REM byte-exactly as one #BIN', () => {
    // The Volcano Dancing shape: everything in a single line-0 REM.
    const program = Uint8Array.from([
      ...record(0, [REM, ...machineCode(600, true)]),
      ...record(1, [0xf8]), // 1 SAVE
    ]);
    const image = buildPFile(program);

    const outcome = importRoundTrip(zx81, image);
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
    expect(outcome.source.match(/^#BIN /gm)?.length).toBe(1);
    expect(outcome.warnings.join(' ')).toMatch(/1 machine-code line /);
  });

  it('imports line 0 plus duplicate line 1s ahead of a listing', () => {
    // The Sprites Demo shape: line 0 and three line-1 REMs, then BASIC.
    const program = Uint8Array.from([
      ...record(0, [REM, ...machineCode(100, true)]),
      ...record(1, [REM, ...machineCode(200, true)]),
      ...record(1, [REM, ...machineCode(200, true)]),
      ...record(1, [REM, ...machineCode(200, true)]),
      ...record(2, [0xf7]), // 2 RUN
      ...record(9955, [0xe3]), // 9955 STOP
    ]);
    const image = buildPFile(program);

    const outcome = importRoundTrip(zx81, image);
    expect(outcome.errors).toEqual([]);
    expect(
      outcome.byteExact,
      `drift (${firstDifference(image, outcome.reImage)}):\n${outcome.source}`,
    ).toBe(true);
    expect(outcome.source.match(/^#BIN /gm)?.length).toBe(4);
    expect(outcome.warnings.join(' ')).toMatch(/4 machine-code lines /);
  });

  it('keeps an NXTLIN-derived auto-start alongside #BIN lines', () => {
    const program = Uint8Array.from([
      ...record(0, [REM, ...machineCode(64, true)]),
      ...record(10, [0xf7]), // 10 RUN
      ...record(20, [0xe3]), // 20 STOP
    ]);
    const image = withAutoStart(buildPFile(program), 20);

    const report = zx81.detokenizeWithReport!(image);
    expect(report.autoStart).toBe(20);
    expect(report.source).toContain('#BIN ');
  });

  it('captures a record with a corrupt terminator byte-exactly', () => {
    const program = Uint8Array.from([
      ...record(10, [0xf7]),
      ...record(20, [REM, 0x26, 0x27], 0x00), // terminator overwritten
      ...record(30, [0xe3]),
    ]);

    expect(structuralWarnings(program)).toEqual([]);
    const { source, binaryLines } = detokenizeProgramWithInfo(program);
    expect(binaryLines).toBe(1);
    const { bytes, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual(Array.from(program));
  });

  it('leaves a truncated final record as text with a warning', () => {
    const complete = record(10, [0xf7]);
    const truncated = record(20, [REM, 0x26, 0x27, 0x28]).slice(0, -3);
    const program = Uint8Array.from([...complete, ...truncated]);

    expect(structuralWarnings(program).join(' ')).toMatch(/truncated/);
    const { binaryLines } = detokenizeProgramWithInfo(program);
    expect(binaryLines).toBe(0);
    const outcome = importRoundTrip(zx81, buildPFile(program));
    expect(isAcceptableImport(outcome)).toBe(true);
  });

  it('leaves an empty REM and readable REMs as text', () => {
    const program = Uint8Array.from([
      ...record(10, [REM]), // 10 REM
      ...record(20, [REM, 0x2d, 0x2e]), // 20 REM HI
    ]);
    const { source, binaryLines } = detokenizeProgramWithInfo(program);
    expect(binaryLines).toBe(0);
    expect(source).toBe('10 REM\n20 REM HI\n');
  });

  describe('listing blocks round-trip through a monolithic .P', () => {
    it('a REM code block survives export → import → re-derive byte-exactly', () => {
      // Author a program with a hidden-code REM block, export the standard .P,
      // re-import it, and confirm the derived block's bytes/address are intact -
      // the whole point of storing blocks inside the listing.
      const code = new Uint8Array([0x3e, 0x2a, 0xc9, 0x76, 0x18, 0xfe]);
      const rem = formatBinaryDirective(
        buildRemRecord(1, code, zx81ListingLayout),
      );
      const source = `${rem}\n10 REM start\n20 RAND USR 16514\n`;

      const before = deriveListingBlocks(source, zx81ListingLayout);
      expect(before).toHaveLength(1);
      expect(before[0]!.address).toBe(0x4082);
      expect(Array.from(before[0]!.bytes)).toEqual(Array.from(code));

      const image = buildPImage(source);
      const { source: reimported } = zx81.detokenizeWithReport!(image);
      const after = deriveListingBlocks(reimported, zx81ListingLayout);
      expect(after).toHaveLength(1);
      expect(after[0]!.address).toBe(0x4082);
      expect(Array.from(after[0]!.bytes)).toEqual(Array.from(code));
    });
  });

  describe('heuristic policy for well-formed machine-code REMs', () => {
    // Structurally valid: ascending line 1, no embedded NEWLINE.
    const valid = Uint8Array.from([
      ...record(1, [REM, ...machineCode(100)]),
      ...record(2, [0xf7]),
    ]);

    it('captures a large mostly-non-printable REM by default', () => {
      const { source, binaryLines } = detokenizeProgramWithInfo(valid);
      expect(binaryLines).toBe(1);
      expect(source).toContain('#BIN ');
      const { bytes, errors } = tokenizeProgram(source);
      expect(errors).toEqual([]);
      expect(Array.from(bytes)).toEqual(Array.from(valid));
    });

    it('leaves it as escape text under the strict policy', () => {
      const { source, binaryLines } = detokenizeProgramWithInfo(
        valid,
        'strict',
      );
      expect(binaryLines).toBe(0);
      expect(source).toContain('\\{CD}');
      const { bytes, errors } = tokenizeProgram(source);
      expect(errors).toEqual([]);
      expect(Array.from(bytes)).toEqual(Array.from(valid));
    });

    it('does not capture a REM below the size threshold', () => {
      const small = Uint8Array.from([...record(1, [REM, ...machineCode(40)])]);
      expect(detokenizeProgramWithInfo(small).binaryLines).toBe(0);
    });
  });
});
