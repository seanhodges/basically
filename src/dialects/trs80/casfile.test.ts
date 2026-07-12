import { describe, expect, it } from 'vitest';
import {
  buildCasImage,
  casNameByte,
  isCasImage,
  parseCasImage,
  programByteLength,
  BASIC_MARKER,
  SYNC_BYTE,
} from './casfile';
import { tokenizeProgram, PROG_START } from './tokenizer';
import { detokenizeProgram } from './detokenizer';

const SOURCE = '10 PRINT "HI"\n20 GOTO 10\n';

describe('trs80 cassette image', () => {
  it('lays out leader, sync, BASIC marker, filename then program', () => {
    const { program } = tokenizeProgram(SOURCE);
    const cas = buildCasImage(program, 'BREAKOUT', 8);

    // 8-byte leader of zeros.
    expect(Array.from(cas.subarray(0, 8))).toEqual(Array(8).fill(0));
    expect(cas[8]).toBe(SYNC_BYTE);
    expect(Array.from(cas.subarray(9, 12))).toEqual([
      BASIC_MARKER,
      BASIC_MARKER,
      BASIC_MARKER,
    ]);
    // One-character filename: the first letter of the title.
    expect(cas[12]).toBe('B'.charCodeAt(0));
    expect(Array.from(cas.subarray(13))).toEqual(Array.from(program));
  });

  it('round-trips name and program through parseCasImage', () => {
    const { program } = tokenizeProgram(SOURCE);
    const cas = buildCasImage(program, 'MAZE');
    const parsed = parseCasImage(cas);
    expect(parsed.programName).toBe('M');
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
  });

  it('trims trailing junk after the program via the linked-list length', () => {
    const { program } = tokenizeProgram(SOURCE);
    const cas = buildCasImage(program, 'A', 4);
    const noisy = new Uint8Array(cas.length + 5);
    noisy.set(cas);
    noisy.fill(0xff, cas.length); // garbage past the end (e.g. tape run-out)
    const parsed = parseCasImage(noisy);
    expect(Array.from(parsed.program)).toEqual(Array.from(program));
  });

  it('detokenizes a raw .cas image (Import path) back to source', () => {
    const { program } = tokenizeProgram(SOURCE);
    const cas = buildCasImage(program, 'P');
    expect(detokenizeProgram(cas)).toBe(SOURCE);
  });

  it('isCasImage recognises a block with or without a leader', () => {
    const { program } = tokenizeProgram(SOURCE);
    expect(isCasImage(buildCasImage(program, 'A', 32))).toBe(true);
    expect(isCasImage(buildCasImage(program, 'A', 0))).toBe(true);
    expect(isCasImage(program)).toBe(false); // a bare program is not a cas block
  });

  it('rejects a non-cassette buffer', () => {
    expect(() => parseCasImage(Uint8Array.of(1, 2, 3))).toThrow(/0xA5/);
  });

  it('casNameByte folds to a single A–Z/0–9, defaulting to A', () => {
    expect(casNameByte('breakout')).toBe('B'.charCodeAt(0));
    expect(casNameByte('  ')).toBe('A'.charCodeAt(0));
    expect(casNameByte('9lives')).toBe('9'.charCodeAt(0));
  });

  it('programByteLength stops at the 0x0000 link', () => {
    const { program } = tokenizeProgram(SOURCE);
    expect(programByteLength(program)).toBe(program.length);
  });

  it('lays out link pointers on the real TXTTAB base 0x42E9', () => {
    expect(PROG_START).toBe(0x42e9);
    const { program } = tokenizeProgram(SOURCE);
    // The first link is an absolute address = base + first record length.
    const firstLink = program[0]! | (program[1]! << 8);
    // 10 PRINT "HI": body = B2 20 22 48 49 22 (6) -> record 2+2+6+1 = 11.
    expect(firstLink).toBe(PROG_START + 11);
    // The chain walks on the real base and trims tape run-out noise past it.
    const noisy = new Uint8Array(program.length + 6);
    noisy.set(program);
    noisy.fill(0xff, program.length);
    expect(programByteLength(noisy)).toBe(program.length);
  });
});
