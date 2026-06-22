import { describe, expect, it } from 'vitest';
import {
  atomChecksum,
  buildAtomBlock,
  buildAtomBlocks,
  buildAtomImage,
} from './cassetteEncoder';
import { tokenizeProgram } from '../tokenizer';

const SYNC = 0x2a;

function program(src: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  return bytes;
}

describe('Atom cassette block layout', () => {
  it('frames a single block with sync, header, data and checksum', () => {
    const data = Uint8Array.from([1, 2, 3, 4]);
    const name = Uint8Array.from('HI', (c) => c.charCodeAt(0));
    const block = buildAtomBlock(name, 0, data, true);

    // Four 0x2A sync bytes…
    expect(Array.from(block.slice(0, 4))).toEqual([SYNC, SYNC, SYNC, SYNC]);
    // …then the filename and its 0x0D terminator.
    expect(Array.from(block.slice(4, 6))).toEqual([0x48, 0x49]); // 'HI'
    expect(block[6]).toBe(0x0d);
    // Flag: last block (bit 7 clear) carrying data (bit 6 set).
    expect(block[7]).toBe(0x40);
    // Block number (hi, lo).
    expect(block[8]).toBe(0x00);
    expect(block[9]).toBe(0x00);
    // Data length minus one.
    expect(block[10]).toBe(data.length - 1);
    // Exec (hi, lo) then load (hi, lo) — both #2900 for block 0.
    expect(Array.from(block.slice(11, 15))).toEqual([0x29, 0x00, 0x29, 0x00]);
    // Data, then a checksum over everything from the filename onward.
    expect(Array.from(block.slice(15, 19))).toEqual([1, 2, 3, 4]);
    const body = block.slice(4, block.length - 1);
    expect(block[block.length - 1]).toBe(atomChecksum(body));
  });

  it('sets the not-last flag and bumps the load address per block', () => {
    // A 2-char name keeps the header fields at the same offsets as the
    // single-block test above (sync 0-3, name 4-5, 0x0D 6, flag 7, …).
    const big = new Uint8Array(300).fill(0x20);
    const blocks = buildAtomBlocks(big, 'BG');
    expect(blocks.length).toBe(2);
    // First block: not last (bit 7 set), load #2900.
    expect(blocks[0]![7]! & 0x80).toBe(0x80);
    expect(Array.from(blocks[0]!.slice(13, 15))).toEqual([0x29, 0x00]);
    // Second block: last (bit 7 clear), load #2A00 (#2900 + 256).
    expect(blocks[1]![7]! & 0x80).toBe(0x00);
    expect(Array.from(blocks[1]!.slice(13, 15))).toEqual([0x2a, 0x00]);
  });

  it('builds the loadable image and rejects an empty program', () => {
    const image = buildAtomImage('10 PRINT "HI"\n');
    expect(image[0]).toBe(0x0d); // line marker
    expect(Array.from(image.slice(-2))).toEqual([0x0d, 0xff]); // end marker
    expect(() => buildAtomImage('')).toThrow(/empty/i);
  });

  it('refuses to build a program with tokenizer errors', () => {
    expect(() => buildAtomImage('PRINT "no line number"')).toThrow(/error/i);
  });

  it('matches the tokenizer image for a real program', () => {
    const src = '10 PRINT "HELLO"\n20 GOTO 10\n';
    expect(Array.from(buildAtomImage(src))).toEqual(Array.from(program(src)));
  });
});
