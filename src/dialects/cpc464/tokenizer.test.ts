import { describe, expect, it } from 'vitest';
import { hasFatalErrors } from '../types';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram, detokenizeWithReport } from './detokenizer';
import { decodeLocoFloat, encodeLocoFloat, formatLocoFloat } from './numbers';
import type { LocoBasicVariant } from './keywords';

/** Tokenize expecting no fatal errors; returns the full program bytes. */
function cleanBytes(
  source: string,
  variant: LocoBasicVariant = 'basic10',
): Uint8Array {
  const { bytes, errors } = tokenizeProgram(source, variant);
  expect(errors.filter((e) => e.fatal !== false)).toEqual([]);
  return bytes;
}

/** The tokenized body of the first line (between header and terminator). */
function bodyOf(
  source: string,
  variant: LocoBasicVariant = 'basic10',
): number[] {
  const bytes = cleanBytes(source, variant);
  const len = bytes[0]! | (bytes[1]! << 8);
  return Array.from(bytes.subarray(4, len - 1));
}

/** detokenize(tokenize(src)) must re-tokenize byte-for-byte. */
function roundTrip(source: string, variant: LocoBasicVariant = 'basic10') {
  const first = cleanBytes(source, variant);
  const text = detokenizeProgram(first, variant);
  const second = cleanBytes(text, variant);
  expect(Array.from(second), `via:\n${text}`).toEqual(Array.from(first));
  return text;
}

describe('cpc464 line records', () => {
  it('emits [u16 LE length][u16 LE line no][tokens][0x00] + 0x0000 end', () => {
    const bytes = cleanBytes('10 CLS');
    expect(Array.from(bytes)).toEqual([
      0x06,
      0x00, // length: 2 + 2 + 1 token + terminator
      0x0a,
      0x00, // line 10
      0x8a, // CLS
      0x00, // end of line
      0x00,
      0x00, // end of program
    ]);
  });

  it('stores typed spaces verbatim, as the machine LISTs them back', () => {
    expect(bodyOf('10 PRINT  "X"')).toEqual([
      0xbf, 0x20, 0x20, 0x22, 0x58, 0x22,
    ]);
    roundTrip('10 PRINT  "X"');
  });

  it('requires 1-65535 strictly ascending line numbers', () => {
    expect(tokenizeProgram('0 CLS').errors[0]!.message).toMatch(/out of range/);
    expect(tokenizeProgram('70000 CLS').errors[0]!.message).toMatch(
      /out of range/,
    );
    expect(tokenizeProgram('20 CLS\n10 CLS').errors[0]!.message).toMatch(
      /not greater/,
    );
  });
});

describe('cpc464 numeric constants', () => {
  it('encodes each binary numeric form', () => {
    expect(bodyOf('10 PRINT 0')).toEqual([0xbf, 0x20, 0x0e]);
    expect(bodyOf('10 PRINT 9')).toEqual([0xbf, 0x20, 0x17]);
    // 10 is past the single-byte 0-9 range, so it uses the 8-bit form.
    expect(bodyOf('10 PRINT 10')).toEqual([0xbf, 0x20, 0x19, 0x0a]);
    expect(bodyOf('10 PRINT 11')).toEqual([0xbf, 0x20, 0x19, 0x0b]);
    expect(bodyOf('10 PRINT 255')).toEqual([0xbf, 0x20, 0x19, 0xff]);
    expect(bodyOf('10 PRINT 256')).toEqual([0xbf, 0x20, 0x1a, 0x00, 0x01]);
    expect(bodyOf('10 PRINT 40000')).toEqual([0xbf, 0x20, 0x1a, 0x40, 0x9c]);
    expect(bodyOf('10 PRINT &X101')).toEqual([0xbf, 0x20, 0x1b, 0x05, 0x00]);
    expect(bodyOf('10 PRINT &7F00')).toEqual([0xbf, 0x20, 0x1c, 0x00, 0x7f]);
    expect(bodyOf('10 PRINT &H1F')).toEqual([0xbf, 0x20, 0x1c, 0x1f, 0x00]);
    expect(bodyOf('10 GOTO 100')).toEqual([0xa0, 0x20, 0x1e, 0x64, 0x00]);
    expect(bodyOf('10 PRINT 1.5')).toEqual([
      0xbf, 0x20, 0x1f, 0x00, 0x00, 0x00, 0x40, 0x81,
    ]);
  });

  it("encodes pi's 5-byte real exactly as the ROM's own constant", () => {
    // SOFT968's PI: A2 DA 0F 49 82.
    expect(encodeLocoFloat(Math.PI)).toEqual([0xa2, 0xda, 0x0f, 0x49, 0x82]);
    expect(decodeLocoFloat([0xa2, 0xda, 0x0f, 0x49, 0x82], 0)).toBeCloseTo(
      Math.PI,
      9,
    );
  });

  it('reformats reals losslessly in display form', () => {
    for (const text of ['3.14', '0.5', '123.456', '1E+20', '6.25E-2']) {
      const value = parseFloat(text);
      const bytes = encodeLocoFloat(value);
      const shown = formatLocoFloat(decodeLocoFloat(bytes, 0));
      expect(encodeLocoFloat(parseFloat(shown)), `${text} -> ${shown}`).toEqual(
        bytes,
      );
    }
    expect(formatLocoFloat(decodeLocoFloat(encodeLocoFloat(3.14), 0))).toBe(
      '3.14',
    );
    expect(formatLocoFloat(decodeLocoFloat(encodeLocoFloat(1e20), 0))).toBe(
      '1E+20',
    );
  });

  it('overflows to a real above 65535 and errors past the format', () => {
    expect(bodyOf('10 PRINT 65535')).toEqual([0xbf, 0x20, 0x1a, 0xff, 0xff]);
    expect(bodyOf('10 PRINT 65536')).toContain(0x1f);
    const { errors } = tokenizeProgram('10 PRINT 1E40');
    expect(errors[0]!.message).toMatch(/out of range/);
  });

  it('keeps line-number mode through lists and ranges', () => {
    expect(bodyOf('10 ON X GOSUB 100,200')).toEqual([
      0xb2, 0x20, 0x0d, 0x00, 0x00, 0xd8, 0x20, 0x9f, 0x20, 0x1e, 0x64, 0x00,
      0x2c, 0x1e, 0xc8, 0x00,
    ]);
    expect(bodyOf('10 LIST 10-20')).toEqual([
      0xa7, 0x20, 0x1e, 0x0a, 0x00, 0xf5, 0x1e, 0x14, 0x00,
    ]);
  });
});

describe('cpc464 tokenizer', () => {
  it('round-trips a simple program through tokenize/detokenize', () => {
    roundTrip(
      [
        '10 MODE 1',
        '20 INK 0,1:INK 1,24',
        '30 PRINT "Hello from the Amstrad CPC 464"',
        '40 x=3.14:y%=200:n$="ok"',
        '50 IF x>3 THEN GOTO 70 ELSE PRINT x',
        '60 GOTO 10',
        '70 END',
      ].join('\n'),
    );
  });

  it('round-trips comments, DATA, RSX commands and WHILE loops', () => {
    roundTrip(
      [
        "10 ' leading comment",
        '20 REM another <- comment',
        '30 DATA 1,2,"a:b",word',
        '40 PRINT "q";:\'trailing',
        '50 |DIR',
        '60 WHILE a<10:a=a+1:WEND',
        '70 a$="x"+CHR$(7)+"{0x01}▘"',
      ].join('\n'),
    );
  });

  it('stores variables with their type token, zero offset and bit-7 name end', () => {
    // count% -> &02 tokenized integer variable.
    expect(bodyOf('10 count%=1')).toEqual([
      0x02,
      0x00,
      0x00,
      0x63,
      0x6f,
      0x75,
      0x6e,
      0x74 | 0x80,
      0xef,
      0x0f,
    ]);
    expect(bodyOf('10 a$="x"')[0]).toBe(0x03);
    expect(bodyOf('10 r!=0')[0]).toBe(0x04);
    expect(bodyOf('10 plain=0')[0]).toBe(0x0d);
  });

  it('keeps embedded keywords inside variable names (SCORE, PRINTER)', () => {
    const body = bodyOf('10 score=printer');
    // No OR (&FC) or PRINT (&BF) tokens - both names stay variables.
    expect(body).not.toContain(0xfc);
    expect(body).not.toContain(0xbf);
    roundTrip('10 score=printer');
  });

  it('tokenizes ? as PRINT and GO TO/GO SUB as GOTO/GOSUB', () => {
    expect(bodyOf('10 ?42')).toEqual([0xbf, 0x19, 0x2a]);
    expect(detokenizeProgram(cleanBytes('10 ?42'))).toBe('10 PRINT42\n');
    expect(bodyOf('10 GO TO 20')).toEqual([0xa0, 0x20, 0x1e, 0x14, 0x00]);
    expect(bodyOf('10 GO SUB 20')[0]).toBe(0x9f);
  });

  it('separates PRINT from a glued variable when detokenizing ?A', () => {
    const bytes = cleanBytes('10 ?A');
    expect(detokenizeProgram(bytes)).toBe('10 PRINT A\n');
  });

  it('picks the SQ statement token only after ON', () => {
    expect(bodyOf('10 ON SQ(1) GOSUB 100')).toContain(0xb5);
    const fnBody = bodyOf('10 PRINT SQ(1)');
    expect(fnBody).not.toContain(0xb5);
    expect(fnBody.join(',')).toContain([0xff, 0x17].join(','));
    roundTrip('10 ON SQ(1) GOSUB 100\n100 RETURN');
  });

  it('emits &FF-prefixed function tokens', () => {
    expect(bodyOf('10 PRINT INT(1)')).toEqual([
      0xbf, 0x20, 0xff, 0x0c, 0x28, 0x0f, 0x29,
    ]);
    roundTrip('10 PRINT LEFT$(a$,2);SIN(0.5);MAX(1,2)');
  });

  it('accepts MID$ as an assignment statement', () => {
    const { errors } = tokenizeProgram('10 MID$(a$,2,1)="X"');
    expect(errors).toEqual([]);
    roundTrip('10 MID$(a$,2,1)="X"');
  });

  it('encodes the apostrophe as &01 &C0 mid-statement, bare &C0 opening one', () => {
    expect(bodyOf("10 'note")).toEqual([0xc0, 0x6e, 0x6f, 0x74, 0x65]);
    expect(bodyOf("10 CLS 'note")).toEqual([
      0x8a, 0x20, 0x01, 0xc0, 0x6e, 0x6f, 0x74, 0x65,
    ]);
    roundTrip("10 CLS 'note\n20 'top");
  });

  it('rejects BASIC 1.1-only keywords with a clear TokenizeError', () => {
    for (const line of ['10 FILL 3', '10 FRAME', '10 PRINT DERR']) {
      const { errors } = tokenizeProgram(line, 'basic10');
      expect(errors.length, line).toBeGreaterThan(0);
      expect(errors[0]!.message, line).toMatch(/BASIC 1\.1/);
      expect(errors[0]!.fatal, line).toBe(false); // still a legal 1.0 name
    }
  });

  it('tokenizes the 1.1 additions under the basic11 variant', () => {
    expect(bodyOf('10 FILL 3', 'basic11')).toEqual([0xdd, 0x20, 0x11]);
    expect(bodyOf('10 GRAPHICS PEN 2', 'basic11')).toEqual([
      0xde, 0x20, 0xbb, 0x20, 0x10,
    ]);
    expect(bodyOf('10 PRINT DERR', 'basic11')).toEqual([
      0xbf, 0x20, 0xff, 0x49,
    ]);
    roundTrip('10 GRAPHICS PEN 2:FRAME:FILL 0', 'basic11');
  });

  it('collects errors instead of throwing', () => {
    expect(tokenizeProgram('PRINT "no line number"').errors[0]!.message).toBe(
      'Missing line number',
    );
    const bad = tokenizeProgram('10 PRINT "€"');
    expect(bad.errors[0]!.line).toBe(1);
    expect(bad.errors[0]!.message).toMatch(/no Amstrad CPC equivalent/);
  });

  it('keeps statement-shape lint non-fatal so the image still builds', () => {
    const { bytes, errors } = tokenizeProgram('10 SIN(1)');
    expect(errors.length).toBe(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(hasFatalErrors(errors)).toBe(false);
    expect(bytes.length).toBeGreaterThan(2);
  });

  it('flags a bad statement after a colon', () => {
    // ':' re-arms the statement check, so every statement on the line is
    // checked - not just the first.
    const { bytes, errors } = tokenizeProgram('10 PRINT 1:SIN(1)');
    expect(errors.length).toBe(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(errors[0]!.message).toContain('SIN');
    expect(errors[0]!.endColumn).toBeGreaterThan(errors[0]!.column!);
    expect(bytes.length).toBeGreaterThan(2);
  });

  it('accepts a valid multi-statement line', () => {
    expect(tokenizeProgram('10 CLS:PRINT 1:GOTO 10').errors).toEqual([]);
  });
});

describe('cpc464 detokenizer imports', () => {
  it('reports a missing end marker', () => {
    const bytes = cleanBytes('10 CLS');
    const truncated = bytes.subarray(0, bytes.length - 2);
    const { warnings } = detokenizeWithReport(truncated);
    expect(warnings.some((w) => w.includes('end marker'))).toBe(true);
  });

  it('reports an empty file', () => {
    expect(detokenizeWithReport(new Uint8Array(0)).warnings[0]).toBe(
      'The file is empty.',
    );
  });

  it('resets run-time variable offsets with a warning', () => {
    // 10 A(=1): variable token &0D with a non-zero offset word, name "A".
    const body = [0x0d, 0x34, 0x12, 0xc1, 0xef, 0x0f];
    const record = [body.length + 5, 0, 10, 0, ...body, 0, 0, 0];
    const { source, warnings } = detokenizeWithReport(Uint8Array.from(record));
    expect(source).toBe('10 A=1\n');
    expect(warnings.some((w) => w.includes('variable offset'))).toBe(true);
    // Re-tokenizing writes the offset back as zero.
    expect(bodyOf(source)).toEqual([0x0d, 0x00, 0x00, 0xc1, 0xef, 0x0f]);
  });

  it('converts &1D run-time line pointers back to line numbers', () => {
    const image = Uint8Array.from([
      0x06,
      0x00,
      0x0a,
      0x00,
      0x8a,
      0x00, // 10 CLS (at &170)
      0x09,
      0x00,
      0x14,
      0x00,
      0xa0,
      0x1d,
      0x70,
      0x01,
      0x00, // 20 GOTO ->&170
      0x00,
      0x00,
    ]);
    const { source, warnings } = detokenizeWithReport(image);
    expect(source).toContain('20 GOTO10');
    expect(warnings.some((w) => w.includes('line pointer'))).toBe(true);
  });

  it('flags short-form re-encoding of oversized numeric constants', () => {
    // PRINT 5 stored wastefully as &19 05 (byte form for a small integer).
    const body = [0xbf, 0x20, 0x19, 0x05];
    const record = [body.length + 5, 0, 10, 0, ...body, 0, 0, 0];
    const { source, warnings } = detokenizeWithReport(Uint8Array.from(record));
    expect(source).toBe('10 PRINT 5\n');
    expect(warnings.some((w) => w.includes('short form'))).toBe(true);
  });
});
