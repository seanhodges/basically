// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  buildAtariImage,
  HEADER_BYTES,
  IMMEDIATE_LINE,
  parseAtariImage,
  TOKEN_BUFFER_BYTES,
  variableNameBytes,
  variableSpelling,
  type AtariProgram,
} from './basfile';

/** END, then the end-of-statement token. */
const END = Uint8Array.from([0x15, 0x16]);

const program: AtariProgram = {
  variables: [
    { name: 'A', kind: 'number' },
    { name: 'NAME', kind: 'string' },
    { name: 'GRID', kind: 'array' },
  ],
  lines: [
    { number: 10, statements: [END] },
    { number: 20, statements: [END, END] },
  ],
};

describe('the tokenized image', () => {
  it('round-trips a program through build and parse', () => {
    const parsed = parseAtariImage(buildAtariImage(program));
    expect(parsed.variables).toEqual(program.variables);
    expect(parsed.lines.map((l) => l.number)).toEqual([10, 20]);
    expect(parsed.lines[0]!.statements.map((s) => [...s])).toEqual([[...END]]);
    expect(parsed.lines[1]!.statements).toHaveLength(2);
    expect(parsed.warnings).toEqual([]);
  });

  describe('the pointer header', () => {
    it('states every pointer as an offset from LOMEM, so the first is zero', () => {
      const image = buildAtariImage(program);
      expect([image[0], image[1]]).toEqual([0, 0]);
    });

    // The 256 bytes between LOMEM and VNTP are the buffer BASIC parses a typed
    // line into. They are not saved, which is why the data starts at VNTP while
    // the pointers are still measured from LOMEM.
    it('leaves the token buffer’s gap between LOMEM and VNTP', () => {
      const { header } = parseAtariImage(buildAtariImage(program));
      expect(header.vntp).toBe(TOKEN_BUFFER_BYTES);
    });

    it('sizes the file as the header plus VNTP to STARP', () => {
      const image = buildAtariImage(program);
      const { header } = parseAtariImage(image);
      expect(image.length).toBe(HEADER_BYTES + header.starp - header.vntp);
    });

    it('puts one dummy byte between the name table and the value table', () => {
      const { header } = parseAtariImage(buildAtariImage(program));
      expect(header.vvtp).toBe(header.vntd + 1);
    });

    it('gives the value table eight bytes per variable', () => {
      const { header } = parseAtariImage(buildAtariImage(program));
      expect(header.stmtab - header.vvtp).toBe(8 * program.variables.length);
    });

    it('ends with the immediate-mode line, past STMCUR', () => {
      const image = buildAtariImage(program);
      const { header } = parseAtariImage(image);
      expect(header.starp).toBeGreaterThan(header.stmcur);
      const immediate = image[HEADER_BYTES + header.stmcur - header.vntp]!;
      const high = image[HEADER_BYTES + header.stmcur - header.vntp + 1]!;
      expect(immediate | (high << 8)).toBe(IMMEDIATE_LINE);
    });
  });

  describe('the variable name table', () => {
    // The table has no separators: the high bit on a name's last character is
    // the only thing that says where it ends, and which of the three shapes it
    // is depends on what that last character turns out to be.
    it('marks a name’s end with the high bit on its last character', () => {
      expect([...variableNameBytes({ name: 'A', kind: 'number' })]).toEqual([
        0xc1,
      ]);
      expect([...variableNameBytes({ name: 'NAME', kind: 'string' })]).toEqual([
        0x4e, 0x41, 0x4d, 0x45, 0xa4,
      ]);
      expect([...variableNameBytes({ name: 'GRID', kind: 'array' })]).toEqual([
        0x47, 0x52, 0x49, 0x44, 0xa8,
      ]);
    });

    it('spells each shape the way a listing does', () => {
      expect(variableSpelling({ name: 'A', kind: 'number' })).toBe('A');
      expect(variableSpelling({ name: 'A', kind: 'string' })).toBe('A$');
      expect(variableSpelling({ name: 'A', kind: 'array' })).toBe('A(');
    });
  });

  describe('the statement table', () => {
    // Both offsets are measured from the start of the line record, which is
    // what lets the interpreter reach the next line or the next statement
    // without reading the tokens in between.
    it('offsets a line’s length and its statements from the line’s start', () => {
      const image = buildAtariImage({
        variables: [],
        lines: [{ number: 10, statements: [END, END] }],
      });
      const { header } = parseAtariImage(image);
      const at = HEADER_BYTES + header.stmtab - header.vntp;
      expect(image[at + 2]).toBe(3 + 2 * (END.length + 1));
      expect(image[at + 3]).toBe(3 + 1 + END.length);
    });

    it('reports a line whose length runs off the end rather than throwing', () => {
      const image = buildAtariImage(program);
      const { header } = parseAtariImage(image);
      image[HEADER_BYTES + header.stmtab - header.vntp + 2] = 0xff;
      const parsed = parseAtariImage(image);
      expect(parsed.warnings[0]).toContain('runs past the end');
    });
  });
});
