import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HIMEM,
  DEFAULT_LOMEM,
  HIMEM,
  LOMEM,
  PP,
  PV,
  ZP_BLOCK_BASE,
  ZP_BLOCK_BYTES,
} from './addresses';
import { buildBasicImage, parseBasicImage } from './basicImage';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';

const word = (image: Uint8Array, address: number): number =>
  image[address - ZP_BLOCK_BASE]! | (image[address - ZP_BLOCK_BASE + 1]! << 8);

const SOURCE = '10 A=1\n20 PRINT A\n30 GOTO 10';

describe('apple1 basicImage', () => {
  it('is the two ranges an ACI dump holds, laid end to end', () => {
    const { program } = tokenizeProgram(SOURCE);
    const image = buildBasicImage(program);
    expect(image).toHaveLength(
      ZP_BLOCK_BYTES + (DEFAULT_HIMEM - DEFAULT_LOMEM),
    );
  });

  it('writes pointers that describe where the program really sits', () => {
    const { program } = tokenizeProgram(SOURCE);
    const image = buildBasicImage(program);
    expect(word(image, LOMEM)).toBe(DEFAULT_LOMEM);
    expect(word(image, HIMEM)).toBe(DEFAULT_HIMEM);
    // The program grows down from HIMEM and the variables up from LOMEM, so PP
    // is below the top by exactly the program's length and PV starts at LOMEM.
    expect(word(image, PP)).toBe(DEFAULT_HIMEM - program.length);
    expect(word(image, PV)).toBe(DEFAULT_LOMEM);
  });

  it('places the program at the top of the workspace, not the bottom', () => {
    const { program } = tokenizeProgram(SOURCE);
    const image = buildBasicImage(program);
    const area = image.subarray(ZP_BLOCK_BYTES);
    expect([...area.subarray(area.length - program.length)]).toEqual([
      ...program,
    ]);
    // Everything below it is the free gap the variables will grow into.
    expect(
      area.subarray(0, area.length - program.length).every((b) => b === 0),
    ).toBe(true);
  });

  it('round-trips a program through build and parse', () => {
    const { program } = tokenizeProgram(SOURCE);
    const parsed = parseBasicImage(buildBasicImage(program));
    expect(parsed.lomem).toBe(DEFAULT_LOMEM);
    expect(parsed.himem).toBe(DEFAULT_HIMEM);
    expect([...parsed.program]).toEqual([...program]);
    expect(detokenizeProgram(parsed.program)).toBe(SOURCE);
  });

  it('honours a workspace moved by LOMEM= / HIMEM=', () => {
    const { program } = tokenizeProgram(SOURCE);
    // `LOMEM=768` is the classic Apple I owner's move: it buys 3328 bytes at
    // the cost of no longer describing a stock machine.
    const image = buildBasicImage(program, { lomem: 0x0300 });
    expect(word(image, LOMEM)).toBe(0x0300);
    const parsed = parseBasicImage(image);
    expect(parsed.lomem).toBe(0x0300);
    expect([...parsed.program]).toEqual([...program]);
  });

  it('refuses a program that does not fit the workspace', () => {
    expect(() => buildBasicImage(new Uint8Array(4096))).toThrow(RangeError);
  });

  it('falls back to the stock layout for a dump with no usable pointers', () => {
    // A truncated tape, or a range captured with BASIC not running: read the
    // whole area as program text rather than returning nothing.
    const junk = new Uint8Array(ZP_BLOCK_BYTES + 64);
    const parsed = parseBasicImage(junk);
    expect(parsed.lomem).toBe(DEFAULT_LOMEM);
    expect(parsed.program).toHaveLength(64);
  });
});
