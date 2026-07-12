// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  importFidelityWarnings,
  importProgram,
  importStatusMessage,
} from './importProgram';
import { getDialect } from '../dialects/registry';

const commodore64 = getDialect('commodore64');
const atom = getDialect('atom');

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

  it('reports nothing for clean text and formats the status line', () => {
    expect(importFidelityWarnings(commodore64, '10 PRINT "OK"\n')).toEqual([]);
    expect(importStatusMessage('demo.prg', [])).toBe('Imported demo.prg.');
    expect(importStatusMessage('demo.prg', ['Something was lost.'])).toBe(
      'Imported demo.prg, but: Something was lost.',
    );
  });
});
