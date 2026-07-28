import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { encodeZxFloat } from './zxfloat';
import { formatBinaryDirective } from '../binaryDirective';

const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trim().replace(/\s+/g, ' '))
    .filter((l) => l !== '')
    .join('\n');

describe('tokenizeProgram', () => {
  it('produces the exact bytes for 10 PRINT "HELLO"', () => {
    const { bytes, errors } = tokenizeProgram('10 PRINT "HELLO"\n');
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual([
      0x00,
      0x0a, // line 10, big-endian
      0x09,
      0x00, // length 9, little-endian (body 8 + NEWLINE)
      0xf5, // PRINT
      0x0b, // "
      0x2d,
      0x2a,
      0x31,
      0x31,
      0x34, // H E L L O
      0x0b, // "
      0x76, // NEWLINE
    ]);
  });

  it('encodes numeric literals with the 0x7E float marker', () => {
    const { bytes, errors } = tokenizeProgram('10 GOTO 10\n');
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual([
      0x00,
      0x0a,
      0x0a,
      0x00, // GOTO + "10" + 0x7E + 5 float bytes + NEWLINE = 10
      0xec, // GOTO
      0x1d,
      0x1c, // "1" "0"
      0x7e,
      0x84,
      0x20,
      0x00,
      0x00,
      0x00, // marker + float 10
      0x76,
    ]);
  });

  it('does not tokenize keywords inside strings or REM', () => {
    const { bytes, errors } = tokenizeProgram(
      '10 PRINT "STOP"\n20 REM RUN FOR FUN\n',
    );
    expect(errors).toEqual([]);
    const arr = Array.from(bytes);
    expect(arr).not.toContain(0xe3); // STOP token
    expect(arr.filter((b) => b === 0xf7)).toEqual([]); // RUN token
  });

  it('does not match keywords glued to identifiers', () => {
    // ATOL: AT and TO must not fire inside it
    const { errors } = tokenizeProgram('10 LET ATOL=1\n');
    expect(errors).toEqual([]);
    const { bytes } = tokenizeProgram('10 LET ATOL=1\n');
    const arr = Array.from(bytes);
    expect(arr).not.toContain(0xc1); // AT
    expect(arr).not.toContain(0xdf); // TO
  });

  it('treats digits in identifiers as characters, not literals', () => {
    const { bytes, errors } = tokenizeProgram('10 LET A1=2\n');
    expect(errors).toEqual([]);
    const arr = Array.from(bytes);
    // exactly one float marker (for the 2)
    expect(arr.filter((b) => b === 0x7e).length).toBe(1);
  });

  it('handles "" as the quote-image inside strings', () => {
    const { bytes } = tokenizeProgram('10 PRINT "A""B"\n');
    expect(Array.from(bytes)).toContain(0xc0);
  });

  it('honours a \\{=N} float override (printed digits differ from the value)', () => {
    const { bytes, errors } = tokenizeProgram('10 GOTO 20\\{=9999}\n');
    expect(errors).toEqual([]);
    const arr = Array.from(bytes);
    const marker = arr.indexOf(0x7e);
    expect(marker).toBeGreaterThan(-1);
    // The 5 float bytes after the marker encode 9999, not the printed 20.
    const float = arr.slice(marker + 1, marker + 6);
    const nine = Array.from(encodeZxFloat(9999));
    expect(float).toEqual(nine);
    // The printed digits "20" are still stored before the marker.
    expect(arr.slice(marker - 2, marker)).toEqual([0x1e, 0x1c]);
  });

  it('rejects lines that do not start with a statement keyword', () => {
    const { errors } = tokenizeProgram('10 A=5\n');
    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toMatch(/statement keyword/);
  });

  it('rejects out-of-order and out-of-range line numbers', () => {
    expect(tokenizeProgram('20 CLS\n10 CLS\n').errors.length).toBe(1);
    expect(tokenizeProgram('0 CLS\n').errors.length).toBe(1);
    expect(tokenizeProgram('10000 CLS\n').errors.length).toBe(1);
  });

  it('reports unterminated strings', () => {
    const { errors } = tokenizeProgram('10 PRINT "OOPS\n');
    expect(errors[0]!.message).toMatch(/Unterminated/);
  });

  it('round-trips a representative program', () => {
    const src = [
      '10 REM SIMPLE GAME',
      '20 LET S=0',
      '30 LET X=15',
      '40 PRINT AT 10,X;"*"',
      '50 IF INKEY$="8" THEN LET X=X+1',
      '60 IF INKEY$="5" THEN LET X=X-1',
      '70 IF X<0 OR X>31 THEN GOTO 100',
      '80 LET S=S+1',
      '90 GOTO 40',
      '100 PRINT AT 0,0;"SCORE ";S',
      '110 PAUSE 100',
      '120 RUN',
    ].join('\n');
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    expect(normalize(detokenizeProgram(bytes))).toBe(normalize(src));
  });

  it('round-trips graphics and inverse video', () => {
    // \!. is the chequered upper half; it detokenizes to its unicode character
    // now, so the source is written that way here. The escape-spelling path is
    // covered below.
    const src = '10 PRINT "▌▀█ %A%B \u{1FB8E} OK"';
    const { bytes, errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
    expect(normalize(detokenizeProgram(bytes))).toBe(normalize(src));
  });

  it('still accepts the old grey-block escape spellings', () => {
    // A program saved before the chequered graphics gained unicode characters
    // must keep loading, and must produce the same bytes as the character does.
    const viaEscape = tokenizeProgram('10 PRINT "\\!."');
    const viaChar = tokenizeProgram('10 PRINT "\u{1FB8E}"');
    expect(viaEscape.errors).toEqual([]);
    expect([...viaEscape.bytes]).toEqual([...viaChar.bytes]);
  });
});

describe('tokenizeProgram #BIN directives', () => {
  /** Raw record: lineNo BE, len LE (body+1), body, 0x76. */
  const record = (lineNo: number, body: number[]): Uint8Array =>
    Uint8Array.from([
      (lineNo >> 8) & 0xff,
      lineNo & 0xff,
      (body.length + 1) & 0xff,
      ((body.length + 1) >> 8) & 0xff,
      ...body,
      0x76,
    ]);

  it('splices the record bytes verbatim', () => {
    const rec = record(0, [0xea, 0x76, 0x00, 0xff]); // embedded NEWLINE in body
    const { bytes, errors } = tokenizeProgram(
      `${formatBinaryDirective(rec)}\n10 CLS\n`,
    );
    expect(errors).toEqual([]);
    const clsLine = tokenizeProgram('10 CLS\n').bytes;
    expect(Array.from(bytes)).toEqual([
      ...Array.from(rec),
      ...Array.from(clsLine),
    ]);
  });

  it('allows line 0 and duplicate binary line numbers', () => {
    const src = [
      formatBinaryDirective(record(0, [0xea, 0x01])),
      formatBinaryDirective(record(1, [0xea, 0x02])),
      formatBinaryDirective(record(1, [0xea, 0x03])),
      '2 CLS',
    ].join('\n');
    const { errors } = tokenizeProgram(src);
    expect(errors).toEqual([]);
  });

  it('still rejects a text line at or below a binary line number', () => {
    const src = [formatBinaryDirective(record(5, [0xea])), '5 CLS'].join('\n');
    const { errors } = tokenizeProgram(src);
    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toMatch(/not greater than previous line 5/);
  });

  it('rejects malformed payloads with the directive line number', () => {
    const { errors } = tokenizeProgram('10 CLS\n#BIN not-base64!\n');
    expect(errors.length).toBe(1);
    expect(errors[0]!.line).toBe(2);
    expect(errors[0]!.message).toMatch(/Invalid base64/);
  });

  it('rejects records that are too short', () => {
    const { errors } = tokenizeProgram('#BIN AAAA\n'); // 3 bytes
    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toMatch(/too short/);
  });

  // Columns are offsets into the physical editor line, so an indented line's
  // diagnostics owe the indent width.
  it('offsets diagnostic columns by a line indent', () => {
    expect(tokenizeProgram('10 X=5\n').errors[0]).toMatchObject({ column: 3 });
    expect(tokenizeProgram('   10 X=5\n').errors[0]).toMatchObject({
      column: 6,
    });
    expect(tokenizeProgram('   PRINT 1\n').errors[0]).toMatchObject({
      column: 3,
      message: 'Missing line number',
    });
    expect(tokenizeProgram('  #BIN not-base64!\n').errors[0]).toMatchObject({
      column: 7,
    });
  });

  it('rejects records whose length field disagrees with the payload', () => {
    const rec = record(1, [0xea, 0x00]);
    rec[2] = 9; // lie about the length
    const { errors } = tokenizeProgram(formatBinaryDirective(rec));
    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toMatch(/length field \(9\)/);
  });

  it('accepts a record whose final byte is not a NEWLINE terminator', () => {
    // Damaged files can corrupt the trailing 0x76; the record still splices.
    const rec = Uint8Array.from([0x00, 0x01, 0x02, 0x00, 0xea, 0x00]);
    const { bytes, errors } = tokenizeProgram(formatBinaryDirective(rec));
    expect(errors).toEqual([]);
    expect(Array.from(bytes)).toEqual(Array.from(rec));
  });

  it('tokenizes a directive-only program', () => {
    const rec = record(0, [0xea, 0xaf, 0xc9]);
    const { bytes, errors } = tokenizeProgram(formatBinaryDirective(rec));
    expect(errors).toEqual([]);
    expect(bytes.length).toBe(rec.length);
  });
});
