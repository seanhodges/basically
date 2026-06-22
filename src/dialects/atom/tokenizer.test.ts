import { describe, it, expect } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { atomCharset } from './charset';

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

  it('is idempotent: re-tokenizing detokenized output is byte-identical', () => {
    const source = '10 DIM A(10)\n20 FOR I=0 TO 10\n30 NEXT I\n40 END\n';
    const first = bytesOf(source);
    const second = bytesOf(detokenizeProgram(first));
    expect([...second]).toEqual([...first]);
  });

  it('keeps the top-of-text pointer consistent (end marker at start+length)', () => {
    const bytes = bytesOf('10 PRINT 1\n20 PRINT 2\n');
    // The image ends with the 0D FF marker, so "top of text" = #2900 + length
    // lands exactly one byte past FF — what loadProgram pokes into #0D/#0E.
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
});
