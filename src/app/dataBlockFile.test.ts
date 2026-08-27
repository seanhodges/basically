import { describe, it, expect } from 'vitest';
import { getDialect } from '../dialects/registry';
import { dataBlockFileName, decodeDataText } from './dataBlockFile';

const trs80 = getDialect('trs80').charset;
const spectrum = getDialect('zxspectrum').charset;

/** Machine bytes for ASCII text, which these machines share for the letters. */
const ascii = (text: string) =>
  Uint8Array.from([...text].map((c) => c.charCodeAt(0)));

describe('decodeDataText', () => {
  // What a TRS-80 `PRINT#` writes: each item as characters, a CR after each
  // `PRINT#`, and strings quoted. Read back as text it is the log the program
  // wrote, one line per PRINT.
  it('reads a TRS-80 PRINT# file as the lines the program printed', () => {
    const file = Uint8Array.from([
      ...ascii('"ADA"'),
      0x0d,
      ...ascii(' 1200 '),
      0x0d,
      ...ascii('"BOB"'),
      0x0d,
    ]);
    expect(decodeDataText(file, trs80)).toBe('"ADA"\n 1200 \n"BOB"\n');
  });

  it('reads a CR LF pair as one line ending, and a lone LF as one', () => {
    expect(decodeDataText(Uint8Array.from([65, 0x0d, 0x0a, 66]), trs80)).toBe(
      'A\nB',
    );
    expect(decodeDataText(Uint8Array.from([65, 0x0a, 66]), trs80)).toBe('A\nB');
  });

  // Not ASCII: a byte means whatever the machine's own set says, which is what
  // the byte view's character column shows for the same file.
  it('decodes through the machine character set, not ASCII', () => {
    // 0xFF is a solid block on the TRS-80's graphics range; ASCII has no such
    // character, and `String.fromCharCode` would give ÿ.
    expect(decodeDataText(Uint8Array.from([0xff]), trs80)).toBe(
      trs80.glyph(0xff),
    );
    // The Spectrum's £ sits at 0x60, where ASCII has a backtick.
    expect(decodeDataText(Uint8Array.from([0x60]), spectrum)).toBe(
      spectrum.glyph(0x60),
    );
  });

  it('reads an empty file as empty text', () => {
    expect(decodeDataText(new Uint8Array(), trs80)).toBe('');
  });
});

describe('dataBlockFileName', () => {
  it('names the download after the file the program saved', () => {
    expect(dataBlockFileName('SCORES', '.bin')).toBe('SCORES.bin');
    expect(dataBlockFileName('SCORES', '.txt')).toBe('SCORES.txt');
  });

  // The name is the program's, so it can hold anything the machine allows.
  it('replaces what cannot go in a filename', () => {
    expect(dataBlockFileName('high scores', '.txt')).toBe('high_scores.txt');
    expect(dataBlockFileName('a/b:c', '.bin')).toBe('a_b_c.bin');
    expect(dataBlockFileName('..\\etc', '.bin')).toBe('etc.bin');
  });

  it('falls back to a name when nothing usable is left', () => {
    expect(dataBlockFileName('', '.bin')).toBe('file.bin');
    expect(dataBlockFileName('***', '.txt')).toBe('file.txt');
  });
});
