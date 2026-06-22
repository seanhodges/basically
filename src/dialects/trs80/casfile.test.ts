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
import { tokenizeProgram } from './tokenizer';
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
});
