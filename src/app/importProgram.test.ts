// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  importFidelityWarnings,
  importProgram,
  importStatusMessage,
} from './importProgram';
import { getDialect } from '../dialects/registry';
import { buildTap, tapFromPayloads } from '../dialects/zxspectrum/tapfile';

const commodore64 = getDialect('commodore64');
const atom = getDialect('atom');
const zxspectrum = getDialect('zxspectrum');

describe('importProgram', () => {
  it('returns the detokenized source with no warnings for a clean image', () => {
    const image = commodore64.tokenize('10 PRINT "HI"\n').image;
    const { source, warnings } = importProgram(commodore64, image);
    expect(source).toBe('10 PRINT "HI"\n');
    expect(warnings).toEqual([]);
  });

  it('warns when the decoded text will not re-tokenize', () => {
    // A hand-built .prg whose line number (65000) is storable on hardware but
    // beyond the tokenizer's range: the text decodes fine, re-tokenizing errors.
    const image = Uint8Array.from([
      0x01,
      0x08, // load address $0801
      0x0b,
      0x08, // link to next line
      0xe8,
      0xfd, // line 65000
      0x41,
      0x3d,
      0x31, // A=1
      0x00, // end of line
      0x00,
      0x00, // end of program
    ]);
    const { warnings } = importProgram(commodore64, image);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/1 error/);
    expect(warnings[0]).toMatch(/cannot represent/);
  });

  it('warns when a file decodes to no program lines at all', () => {
    // Machine code, not a BASIC image: the Atom importer rejects it outright
    // (too short to be a #2900 image or .atm) and yields empty text with a
    // single, specific reason rather than a vague "no lines" fallback.
    const ml = Uint8Array.from([0xa9, 0x05, 0x8d, 0x00, 0x80, 0x60]);
    const { source, warnings } = importProgram(atom, ml);
    expect(source.trim()).toBe('');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/BASIC program/i);
  });

  it('plumbs a .TAP CODE file through as a memory block', () => {
    const program = zxspectrum.tokenize('10 PRINT "HI"\n').programBytes;
    const header = new Uint8Array(17);
    header[0] = 0x03; // CODE
    header[11] = 0x02; // declared length
    header[13] = 0x00; // load address 0x8000 low
    header[14] = 0x80; // load address 0x8000 high
    const image = new Uint8Array([
      ...buildTap(program),
      ...tapFromPayloads(header, Uint8Array.from([0xc9, 0x00])),
    ]);

    const { blocks } = importProgram(zxspectrum, image);
    expect(blocks).toHaveLength(1);
    expect(blocks![0]!.address).toBe(0x8000);
    expect(Array.from(blocks![0]!.bytes)).toEqual([0xc9, 0x00]);
  });

  it('omits blocks entirely for a dialect/image with none', () => {
    const image = commodore64.tokenize('10 PRINT "HI"\n').image;
    const { blocks } = importProgram(commodore64, image);
    expect(blocks).toBeUndefined();
  });

  it("carries a .TAP header's auto-start line through as autoStart", () => {
    const program = zxspectrum.tokenize(
      '10 PRINT "HI"\n20 GO TO 10\n',
    ).programBytes;
    // buildTap defaults the auto-start line to the first line (10).
    const { autoStart } = importProgram(zxspectrum, buildTap(program));
    expect(autoStart).toBe(10);
  });

  it('omits autoStart for a load-only .TAP (no auto-run line)', () => {
    const program = zxspectrum.tokenize('10 PRINT "HI"\n').programBytes;
    const { autoStart } = importProgram(
      zxspectrum,
      buildTap(program, { autoStart: null }),
    );
    expect(autoStart).toBeUndefined();
  });

  it('omits autoStart for a dialect that reports none', () => {
    const image = commodore64.tokenize('10 PRINT "HI"\n').image;
    const { autoStart } = importProgram(commodore64, image);
    expect(autoStart).toBeUndefined();
  });

  it('reports nothing for clean text and formats the status line', () => {
    expect(importFidelityWarnings(commodore64, '10 PRINT "OK"\n')).toEqual([]);
    expect(importStatusMessage('demo.prg', [])).toBe('Imported demo.prg.');
    expect(importStatusMessage('demo.prg', ['Something was lost.'])).toBe(
      'Imported demo.prg, but: Something was lost.',
    );
  });
});
