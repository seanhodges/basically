import { describe, expect, it } from 'vitest';
import {
  ATM_HEADER_SIZE,
  ATOM_TEXT_START,
  atmName,
  buildAtm,
  stripAtmHeader,
} from './atm';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';

const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .join('\n');

function image(src: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  return bytes;
}

describe('Atom .atm native binary', () => {
  it('wraps an image in a 22-byte header with load/exec #2900', () => {
    const img = image('10 PRINT "HI"\n');
    const atm = buildAtm(img, 'hello');
    expect(atm.length).toBe(ATM_HEADER_SIZE + img.length);
    // Filename field, NUL-padded and upper-cased.
    expect(atmName(atm)).toBe('HELLO');
    expect(atm[5]).toBe(0x00); // padding past the 5-char name
    // Load and exec are both #2900, little-endian.
    expect(atm[16]! | (atm[17]! << 8)).toBe(ATOM_TEXT_START);
    expect(atm[18]! | (atm[19]! << 8)).toBe(ATOM_TEXT_START);
    // Length word matches the data.
    expect(atm[20]! | (atm[21]! << 8)).toBe(img.length);
    // The payload is the image verbatim.
    expect(Array.from(atm.slice(ATM_HEADER_SIZE))).toEqual(Array.from(img));
  });

  it('falls back to PROGRAM when the name has no usable characters', () => {
    expect(atmName(buildAtm(image('10 END\n'), '...'))).toBe('PROGRAM');
  });

  it('stripAtmHeader recovers the image from an .atm', () => {
    const img = image('10 PRINT "HI"\n20 GOTO 10\n');
    const atm = buildAtm(img, 'P');
    expect(Array.from(stripAtmHeader(atm))).toEqual(Array.from(img));
  });

  it('stripAtmHeader passes a bare image through unchanged', () => {
    const img = image('10 PRINT "HI"\n');
    expect(stripAtmHeader(img)).toBe(img);
  });

  it('round-trips source → .atm → source via detokenize', () => {
    const src = '10 PRINT "HELLO ATOM"\n20 GOTO 10\n';
    const atm = buildAtm(image(src), 'DEMO');
    // detokenize is what the Import dialog calls on the opened file bytes.
    expect(normalize(detokenizeProgram(atm))).toBe(normalize(src));
  });
});
