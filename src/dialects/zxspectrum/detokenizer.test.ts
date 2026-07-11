import { describe, expect, it } from 'vitest';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';

/** Build one program line: u16 BE line number, u16 LE length, body + ENTER. */
function line(no: number, body: number[]): number[] {
  const len = body.length + 1;
  return [
    (no >> 8) & 0xff,
    no & 0xff,
    len & 0xff,
    (len >> 8) & 0xff,
    ...body,
    0x0d,
  ];
}

const PRINT = 0xf5;
const REM = 0xea;
const Q = 0x22;

describe('zxspectrum detokenizer escapes', () => {
  it('renders in-string control sequences as directives', () => {
    // PRINT "<INK 2>X<FLASH 1>Y"
    const prog = Uint8Array.from(
      line(10, [PRINT, Q, 0x10, 0x02, 0x58, 0x12, 0x01, 0x59, Q]),
    );
    expect(detokenizeProgram(prog)).toBe('10 PRINT "{INK 2}X{FLASH 1}Y"\n');
  });

  it('consumes both operand bytes of AT and TAB', () => {
    const prog = Uint8Array.from(
      line(10, [PRINT, Q, 0x16, 0x05, 0x03, 0x17, 0x04, 0x01, Q]),
    );
    expect(detokenizeProgram(prog)).toBe('10 PRINT "{AT 5,3}{TAB 260}"\n');
  });

  it('renders UDG bytes in strings as \\a-\\u escapes', () => {
    const prog = Uint8Array.from(
      line(24, [0xf1, 0x43, 0x24, 0x3d, Q, 0x90, Q]),
    );
    expect(detokenizeProgram(prog)).toBe('24 LET C$="\\a"\n');
  });

  it('drops control sequences outside strings, keeping the statement', () => {
    // <PAPER 6><INK 0> PRINT "X"
    const prog = Uint8Array.from(
      line(10, [0x11, 0x06, 0x10, 0x00, PRINT, Q, 0x58, Q]),
    );
    expect(detokenizeProgram(prog)).toBe('10 PRINT "X"\n');
  });

  it('drops other unrepresentable bytes outside strings', () => {
    const prog = Uint8Array.from(line(10, [PRINT, 0x90, 0x31]));
    expect(detokenizeProgram(prog)).toBe('10 PRINT 1\n');
  });

  it('escapes an in-string number marker and its 5-byte form', () => {
    const prog = Uint8Array.from(
      line(10, [PRINT, Q, 0x0e, 0x00, 0x00, 0x2a, 0x00, 0x00, Q]),
    );
    expect(detokenizeProgram(prog)).toBe(
      '10 PRINT "{0x0E}{0x00}{0x00}*{0x00}{0x00}"\n',
    );
  });

  it('preserves control sequences and binary in REM bodies', () => {
    const prog = Uint8Array.from(
      line(1, [REM, 0x12, 0x01, 0x48, 0x49, 0x03, 0x9c]),
    );
    expect(detokenizeProgram(prog)).toBe('1 REM {FLASH 1}HI{0x03}\\m\n');
  });

  it('renders a control byte with truncated operands as a raw escape', () => {
    const prog = Uint8Array.from(line(10, [PRINT, Q, 0x58, 0x10]));
    expect(detokenizeProgram(prog)).toBe('10 PRINT "X{0x10}\n');
  });

  it('never swallows the closing quote as a control operand', () => {
    // "X<0x10>" — the quote terminates the string on real hardware, so the
    // lone control byte is a raw escape and the quotes stay balanced.
    const one = Uint8Array.from(line(10, [PRINT, Q, 0x58, 0x10, Q]));
    expect(detokenizeProgram(one)).toBe('10 PRINT "X{0x10}"\n');
    // Same for a two-operand control with only one operand before the quote.
    const two = Uint8Array.from(line(10, [PRINT, Q, 0x16, 0x05, Q]));
    expect(detokenizeProgram(two)).toBe('10 PRINT "{0x16}{0x05}"\n');
    for (const prog of [one, two]) {
      const round = tokenizeProgram(detokenizeProgram(prog));
      expect(round.errors).toEqual([]);
      expect(Array.from(round.bytes)).toEqual(Array.from(prog));
    }
  });

  it('recomputes the quote cap across doubled quotes', () => {
    // "<0x10>""<0x02>" — a doubled quote splits segments; the 0x02 in the
    // second segment is plain data, and the leading control is still capped.
    const prog = Uint8Array.from(line(10, [PRINT, Q, 0x10, Q, Q, 0x02, Q]));
    expect(detokenizeProgram(prog)).toBe('10 PRINT "{0x10}""{0x02}"\n');
    const round = tokenizeProgram(detokenizeProgram(prog));
    expect(round.errors).toEqual([]);
    expect(Array.from(round.bytes)).toEqual(Array.from(prog));
  });

  it('preserves an interior ENTER inside a string as {0x0D}', () => {
    const prog = Uint8Array.from(line(10, [PRINT, Q, 0x41, 0x0d, 0x42, Q]));
    expect(detokenizeProgram(prog)).toBe('10 PRINT "A{0x0D}B"\n');
    const round = tokenizeProgram(detokenizeProgram(prog));
    expect(round.errors).toEqual([]);
    expect(Array.from(round.bytes)).toEqual(Array.from(prog));
  });

  it('keeps the blank graphic 0x80 byte-exact in strings', () => {
    const prog = Uint8Array.from(line(10, [PRINT, Q, 0x80, 0x20, Q]));
    expect(detokenizeProgram(prog)).toBe('10 PRINT "{0x80} "\n');
    const round = tokenizeProgram(detokenizeProgram(prog));
    expect(Array.from(round.bytes)).toEqual(Array.from(prog));
  });

  it('round-trips escape-bearing bytes through tokenize(detokenize())', () => {
    const prog = Uint8Array.from([
      ...line(10, [PRINT, Q, 0x10, 0x02, 0x90, 0xa4, 0x16, 0x01, 0x02, Q]),
      ...line(20, [REM, 0x14, 0x01, 0x9c, 0x7b, 0x58, 0x7d]),
    ]);
    const round = tokenizeProgram(detokenizeProgram(prog));
    expect(round.errors).toEqual([]);
    expect(Array.from(round.bytes)).toEqual(Array.from(prog));
  });

  it('round-trips escape syntax from source through both directions', () => {
    const src =
      '10 PRINT "{INK 2}\\a{AT 5,3}ok"\n20 REM sprites \\m{FLASH 1}\n';
    const first = tokenizeProgram(src);
    expect(first.errors).toEqual([]);
    const round = tokenizeProgram(detokenizeProgram(first.bytes));
    expect(Array.from(round.bytes)).toEqual(Array.from(first.bytes));
  });
});
