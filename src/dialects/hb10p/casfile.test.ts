// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import {
  ASCII_MARKER,
  BINARY_MARKER,
  CAS_BLOCK_ALIGN,
  CAS_BLOCK_MARKER,
  MARKER_COUNT,
  NAME_BYTES,
  TOKENIZED_MARKER,
  TRAILER_BYTES,
  buildCasImage,
  buildHeaderBlock,
  buildTokenizedBlocks,
  casToTapeStream,
  isCasImage,
  readTapeFile,
  readTapeStream,
} from './casfile';
import { tokenizeProgram } from './tokenizer';

const SOURCE = '10 PRINT "HELLO"\n20 GOTO 10';

function program(src = SOURCE): Uint8Array {
  const { bytes, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  return bytes;
}

describe('hb10p tape blocks', () => {
  it('opens a file with ten marker bytes and a six-byte padded name', () => {
    const [header] = buildTokenizedBlocks(program(), 'Hi');
    expect(header).toBeDefined();
    expect(Array.from(header!.slice(0, MARKER_COUNT))).toEqual(
      new Array(MARKER_COUNT).fill(TOKENIZED_MARKER),
    );
    expect(String.fromCharCode(...header!.slice(MARKER_COUNT))).toBe('HI    ');
    expect(header).toHaveLength(MARKER_COUNT + NAME_BYTES);
  });

  it('repeats the program area last byte seven times behind it', () => {
    const bytes = program();
    const [, data] = buildTokenizedBlocks(bytes, 'TEST');
    expect(data).toHaveLength(bytes.length + TRAILER_BYTES);
    expect(Array.from(data!.slice(0, bytes.length))).toEqual(Array.from(bytes));
    // The program ends in the zero link, so the writer's repeat is zeros - and
    // that is why a .cas in the wild carries a tail of them.
    expect(Array.from(data!.slice(bytes.length))).toEqual(
      new Array(TRAILER_BYTES).fill(0),
    );
  });
});

describe('hb10p .cas image', () => {
  it('frames each tape block behind an aligned eight-byte marker', () => {
    const blocks = buildTokenizedBlocks(program(), 'TEST');
    const image = buildCasImage(blocks);

    expect(isCasImage(image)).toBe(true);
    let at = 0;
    for (const block of blocks) {
      expect(at % CAS_BLOCK_ALIGN, 'marker is not aligned').toBe(0);
      expect(Array.from(image.slice(at, at + CAS_BLOCK_MARKER.length))).toEqual(
        Array.from(CAS_BLOCK_MARKER),
      );
      at += CAS_BLOCK_MARKER.length + block.length;
    }
    expect(at).toBe(image.length);
  });

  it('reads its blocks back as the byte stream the tape carries', () => {
    const blocks = buildTokenizedBlocks(program(), 'TEST');
    const flat = Uint8Array.from(blocks.flatMap((b) => Array.from(b)));
    expect(Array.from(casToTapeStream(buildCasImage(blocks)))).toEqual(
      Array.from(flat),
    );
  });

  it('recovers the program and its name from the stream', () => {
    const image = buildCasImage(buildTokenizedBlocks(program(), 'GAME'));
    const file = readTapeStream(casToTapeStream(image));
    expect(file?.kind).toBe('tokenized');
    expect(file?.name).toBe('GAME');
    expect(readTapeFile(file!).source).toBe(SOURCE);
  });

  it('finds the header run past a lead-in of noise', () => {
    const blocks = buildTokenizedBlocks(program(), 'TEST');
    const noisy = Uint8Array.from([
      0x12,
      0xd3,
      0x00,
      0xff,
      ...blocks.flatMap((b) => Array.from(b)),
    ]);
    expect(readTapeFile(readTapeStream(noisy)!).source).toBe(SOURCE);
  });

  it('reads a listing saved as ASCII', () => {
    const text = Uint8Array.from(`${SOURCE}\r\n\x1a`, (c) => c.charCodeAt(0));
    const image = buildCasImage([buildHeaderBlock(ASCII_MARKER, 'TEST'), text]);
    const file = readTapeStream(casToTapeStream(image));
    expect(file?.kind).toBe('ascii');
    const { source, warnings } = readTapeFile(file!);
    expect(source).toBe(SOURCE);
    expect(warnings.join(' ')).toContain('ASCII listing');
  });

  it('says so rather than pasting a BSAVE file into the editor', () => {
    const image = buildCasImage([
      buildHeaderBlock(BINARY_MARKER, 'CODE'),
      Uint8Array.of(0xfe, 0x00, 0xc0, 0x05, 0xc0, 0x00, 0xc0, 0xc9),
    ]);
    const { source, warnings } = readTapeFile(
      readTapeStream(casToTapeStream(image))!,
    );
    expect(source).toBe('');
    expect(warnings.join(' ')).toContain('machine-code file');
  });
});
