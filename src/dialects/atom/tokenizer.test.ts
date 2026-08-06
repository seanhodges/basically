import { describe, it, expect } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { atomCharset } from './charset';
import { atom } from './index';

/** Convenience: tokenize and assert there were no errors, returning the bytes. */
function bytesOf(source: string): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  return bytes;
}

describe('atom tokenizer', () => {
  it('emits the #2900 line-record layout: 0D, big-endian line, ascii body', () => {
    const bytes = bytesOf('10 PRINT "HI"\n');
    // 0D, line 10 = 00 0A, then ' PRINT "HI"' as ASCII, then 0D FF.
    const body = ' PRINT "HI"';
    const expected = [
      0x0d,
      0x00,
      0x0a,
      ...[...body].map((c) => c.charCodeAt(0)),
      0x0d,
      0xff,
    ];
    expect([...bytes]).toEqual(expected);
  });

  it('terminates an empty program with just the 0D FF marker', () => {
    expect([...bytesOf('')]).toEqual([0x0d, 0xff]);
  });

  it('round-trips a program through tokenize → detokenize', () => {
    const source = '10 PRINT "HELLO ATOM"\n20 GOTO 10\n';
    expect(detokenizeProgram(bytesOf(source))).toBe(source);
  });

  it('preserves spacing verbatim in the body', () => {
    const source = '5  REM   wide  spaces\n';
    expect(detokenizeProgram(bytesOf(source))).toBe(source);
  });

  it('stores an astral Semigraphics-6 sextant in a literal as one byte', () => {
    // 🬀 (U+1FB00, the top-left cell) is a surrogate pair in the editor and
    // must reach the image as the single byte 0xC0.
    const source = '10 PRINT "🬀"\n';
    const bytes = bytesOf(source);
    expect([...bytes]).toEqual([
      0x0d,
      0x00,
      0x0a,
      ...[...' PRINT "'].map((c) => c.charCodeAt(0)),
      0xc0,
      0x22,
      0x0d,
      0xff,
    ]);
    // Two code units of source, one byte of image.
    expect(bytes.length).toBe(3 + ' PRINT "🬀"'.length - 1 + 2);
    expect(tokenizeProgram(source).errors).toEqual([]);
  });

  it('round-trips a sextant back out of the image as one character', () => {
    const source = '10 PRINT "🬀█🬞"\n';
    expect(detokenizeProgram(bytesOf(source))).toBe(source);
  });

  it('reports a whole sextant, not half a surrogate pair', () => {
    const { errors } = tokenizeProgram('10 🬀\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toContain("'🬀'");
    expect(errors[0]!.endColumn! - errors[0]!.column).toBe(2);
  });

  it('is idempotent: re-tokenizing detokenized output is byte-identical', () => {
    const source = '10 DIM A(10)\n20 FOR I=0 TO 10\n30 NEXT I\n40 END\n';
    const first = bytesOf(source);
    const second = bytesOf(detokenizeProgram(first));
    expect([...second]).toEqual([...first]);
  });

  it('keeps the top-of-text pointer consistent (end marker at start+length)', () => {
    const bytes = bytesOf('10 PRINT 1\n20 PRINT 2\n');
    // The image ends with the 0D FF marker, so "top of text" = #2900 + length
    // lands exactly one byte past FF - what loadProgram pokes into #0D/#0E.
    expect([...bytes.slice(-2)]).toEqual([0x0d, 0xff]);
    // Walking the records must consume the whole image with nothing left over.
    let p = 0;
    while (p + 2 < bytes.length && bytes[p] === 0x0d && bytes[p + 1] !== 0xff) {
      let end = p + 3;
      while (end < bytes.length && bytes[end] !== 0x0d) end++;
      p = end;
    }
    expect(p).toBe(bytes.length - 2); // sitting on the final 0D FF
  });

  it('reports a missing line number without throwing', () => {
    const { errors } = tokenizeProgram('PRINT "no line"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 1, column: 0 });
    expect(errors[0]!.message).toMatch(/line number/i);
  });

  it('reports an out-of-range line number', () => {
    const { errors } = tokenizeProgram('40000 END\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/out of range/i);
  });

  it('reports non-ascending line numbers', () => {
    const { errors } = tokenizeProgram('20 PRINT 1\n10 PRINT 2\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ line: 2 });
    expect(errors[0]!.message).toMatch(/not greater/i);
  });

  it('reports an unmappable character with its column, without throwing', () => {
    const { errors } = tokenizeProgram('10 PRINT "€"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(1);
    // The € sits inside the quotes, after '10 PRINT "'.
    expect(errors[0]!.column).toBe('10 PRINT "'.length);
  });
});

describe('atom tokenizer statement validation', () => {
  it('flags a misspelled keyword at the start of a statement', () => {
    const { errors } = tokenizeProgram('10 PRNT "HI"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(1);
    expect(errors[0]!.message).toMatch(/must start with/i);
  });

  it('flags a bad statement after a semicolon', () => {
    const { errors } = tokenizeProgram('10 X=1;PRNT 2\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.message).toMatch(/PRNT/);
  });

  it('accepts semicolon-separated assignments', () => {
    expect(tokenizeProgram('10 X=1;Y=2\n').errors).toEqual([]);
  });

  it('accepts indirection, string pokes and the @ variable', () => {
    const src = [
      '10 ?#DE=0',
      '20 ?(#8000+U*32+V)=#20',
      '30 !#80=1',
      '40 INPUT $#7000',
      '50 $#7000="HI"',
      '60 @=5',
      '70 A(1)=2',
    ].join('\n');
    expect(tokenizeProgram(src).errors).toEqual([]);
  });

  it('accepts dot-abbreviations and crunched keywords', () => {
    const src = [
      '10 P."HI"',
      '20 G.10',
      '30 PRINTA',
      '40 IF A=1 THEN X=2',
    ].join('\n');
    expect(tokenizeProgram(src).errors).toEqual([]);
  });

  it('does not look inside REM or assembler blocks', () => {
    const src = ['10 REM PRNT; NOT CHECKED', '20 [', '30 LDA #5', '40 ]'].join(
      '\n',
    );
    expect(tokenizeProgram(src).errors).toEqual([]);
  });

  it('marks statement-shape lint non-fatal (the ROM stores such lines)', () => {
    const { errors } = tokenizeProgram('10 PRNT "HI"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fatal).toBe(false);
  });

  it('keeps framing errors fatal', () => {
    const { errors } = tokenizeProgram('99999 PRINT "HI"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fatal).not.toBe(false);
  });

  it('accepts * COS commands and % FP-variable statement heads', () => {
    const src = ['10 *CAT', '20 *LOAD"X"', '30 %A=1.5', '40 FPRINT %A'].join(
      '\n',
    );
    expect(tokenizeProgram(src).errors).toEqual([]);
  });

  it('lets a * command and a PRINT keep the ";" in what follows them', () => {
    // ';' separates statements, but it is also what a `*` command hands to the
    // OS and what PRINT uses between items ("no gap"). Neither is a statement
    // break, and reporting one as a bad statement would flag correct programs.
    const src = [
      '10 *LOAD"X";3',
      '20 *FS 3;12',
      '30 PRINT "A";B',
      '40 PRINT $A;3',
      '50 P."HI";3',
    ].join('\n');
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    // The body is stored verbatim either way - the scan never moves a byte.
    expect(detokenizeProgram(bytes)).toBe(src + '\n');
  });

  it('does not flag the function words COUNT/PTR/EXT as bad variable names', () => {
    // The Atom lints variables in strict single-letter mode; these multi-letter
    // words are exempt only because they are in the keyword table, so a program
    // using them must lint clean rather than reporting "single letter" errors.
    for (const src of ['10 X=COUNT', '10 P=PTR H', '10 E=EXT H']) {
      const errors = atom.lint(src);
      expect(errors, src).toEqual([]);
    }
  });

  it('still flags a real multi-letter variable name', () => {
    const errors = atom.lint('10 XY=1');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /single letter/i.test(e.message))).toBe(true);
  });

  it('warns (non-fatally) on a lower-case keyword', () => {
    const { errors } = tokenizeProgram('10 print "hi"\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(errors[0]!.message).toMatch(/lower-case keyword/i);
  });

  it('still builds a runnable image when only statement lint fires', () => {
    // Dialect-level: hasFatalErrors gates the image, so a hardware-storable
    // line (e.g. a misspelled keyword) keeps its squiggle but stays runnable.
    const { image, errors } = atom.tokenize('10 PRNT "HI"\n');
    expect(errors.length).toBeGreaterThan(0);
    expect(image.length).toBeGreaterThan(0);
  });

  it('builds no image for framing errors', () => {
    const { image } = atom.tokenize('99999 PRINT "HI"\n');
    expect(image.length).toBe(0);
  });
});

describe('atom charset', () => {
  it('maps printable ASCII to itself', () => {
    expect([...atomCharset.toMachine('AZ09 ?')]).toEqual([
      0x41, 0x5a, 0x30, 0x39, 0x20, 0x3f,
    ]);
  });

  it('round-trips printable ASCII back to unicode', () => {
    expect(atomCharset.toUnicode(atomCharset.toMachine('HELLO!'))).toBe(
      'HELLO!',
    );
  });

  it('throws CharsetError on an unrepresentable character', () => {
    expect(() => atomCharset.toMachine('A€B')).toThrowError(/Atom/);
  });

  it('is total: every byte 0x00–0xFF round-trips decode → parse', () => {
    for (let b = 0; b <= 0xff; b++) {
      const text = atomCharset.toUnicode([b]);
      expect(
        Array.from(atomCharset.toMachine(text)),
        `byte 0x${b.toString(16)} via ${JSON.stringify(text)}`,
      ).toEqual([b]);
    }
  });

  it('escapes control codes and the top-bit bytes with no character', () => {
    expect(atomCharset.toUnicode([0x00])).toBe('{0x00}');
    expect(atomCharset.toUnicode([0x0d])).toBe('{0x0D}');
    expect(atomCharset.toUnicode([0x7f])).toBe('{0x7F}');
    expect(atomCharset.toUnicode([0x80])).toBe('{0x80}'); // inverse space
    expect(atomCharset.toUnicode([0x9f])).toBe('{0x9F}'); // inverse '?'
    expect(atomCharset.toUnicode([0xa0])).toBe('{0xA0}'); // the blank cell
    expect(atomCharset.toUnicode([0xe0])).toBe('{0xE0}'); // other colour set
    expect(atomCharset.toUnicode([0xff])).toBe('{0xFF}');
  });

  it('gives every Semigraphics-6 byte 0xA1–0xDF a sextant character', () => {
    // 0xA0 + p draws SG6 pattern p, and the MC6847 numbers the cells the
    // reverse of Unicode: 0xDF is the full 0x3F pattern, 0xA0 + 0b100000 the
    // top-left cell alone.
    expect(atomCharset.toUnicode([0xdf])).toBe('█');
    expect(atomCharset.toUnicode([0xa0 + 0b100000])).toBe('🬀'); // top-left
    expect(atomCharset.toUnicode([0xa0 + 0b000001])).toBe('🬞'); // bottom-right
    for (let code = 0xa1; code <= 0xdf; code++) {
      const text = atomCharset.toUnicode([code]);
      expect(text, `byte 0x${code.toString(16)}`).not.toMatch(/^\{/);
      expect([...text]).toHaveLength(1);
      expect(Array.from(atomCharset.toMachine(text))).toEqual([code]);
    }
  });

  it('gives each sextant to exactly one byte', () => {
    const seen = new Map<string, number>();
    for (let code = 0xa1; code <= 0xdf; code++) {
      const text = atomCharset.toUnicode([code]);
      expect(
        seen.has(text),
        `${text} already used by 0x${seen.get(text)}`,
      ).toBe(false);
      seen.set(text, code);
    }
  });

  it('still loads the {0xNN} spelling of a graphics byte', () => {
    for (const code of [0xa1, 0xbe, 0xc1, 0xdf]) {
      const escape = `{0x${code.toString(16).toUpperCase()}}`;
      expect(Array.from(atomCharset.toMachine(escape))).toEqual([code]);
    }
  });

  it('keeps % literal (it names an FP variable) and parses raw escapes', () => {
    // %A must stay two literal bytes, not become an inverse-video byte.
    expect(Array.from(atomCharset.toMachine('%A'))).toEqual([0x25, 0x41]);
    expect(Array.from(atomCharset.toMachine('{0x0D}'))).toEqual([0x0d]);
  });
});
