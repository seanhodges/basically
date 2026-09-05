import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { decodeSpectrumNumber, encodeSpectrumNumber } from './numbers';
import { hasFatalErrors } from '../types';

function bytes(src: string): number[] {
  const { bytes, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  return Array.from(bytes);
}

describe('zxspectrum tokenizer', () => {
  it('emits line number (BE), length (LE), body and ENTER', () => {
    // 10 PRINT "HI" -> 00 0A | 06 00 | F5 22 48 49 22 | 0D
    expect(bytes('10 PRINT "HI"\n')).toEqual([
      0x00, 0x0a, 0x06, 0x00, 0xf5, 0x22, 0x48, 0x49, 0x22, 0x0d,
    ]);
  });

  it('stores numeric literals as digits + 0x0E + 5-byte form', () => {
    const b = bytes('10 LET x=42\n');
    const marker = b.indexOf(0x0e);
    expect(marker).toBeGreaterThan(0);
    // The printable digits "42" precede the marker.
    expect(b[marker - 2]).toBe('4'.charCodeAt(0));
    expect(b[marker - 1]).toBe('2'.charCodeAt(0));
    expect(decodeSpectrumNumber(b.slice(marker + 1, marker + 6))).toBe(42);
  });

  it('tokenizes both GO TO and the glued GOTO to the same token', () => {
    const a = bytes('10 GO TO 20\n');
    const c = bytes('10 GOTO 20\n');
    expect(a).toEqual(c);
    expect(a[4]).toBe(0xec); // GO TO token
  });

  it('reports a line-leading non-command like any other statement', () => {
    expect(bytes('10 PRINT "abc"\n').slice(4)).toEqual([
      0xf5, 0x22, 0x61, 0x62, 0x63, 0x22, 0x0d,
    ]);
    // Reported once, non-fatally, and the line is still stored: the ROM would
    // hold it and object only at RUN, exactly as for a statement after a colon.
    const { errors, bytes: image } = tokenizeProgram('10 x=5\n');
    expect(errors.length).toBe(1);
    expect(errors[0]).toMatchObject({ column: 3, endColumn: 4, fatal: false });
    expect(errors[0]!.message).toContain('LET');
    expect(image.length).toBeGreaterThan(0);
  });

  it('reports each bad statement opener once, first or later', () => {
    // The same typo either side of a colon reads the same way round.
    for (const src of ['10 PRNT 1\n', '10 SIN(1)\n', '10 "hi"\n']) {
      const { errors, bytes: image } = tokenizeProgram(src);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.fatal).toBe(false);
      expect(image.length).toBeGreaterThan(0);
    }
    const { errors } = tokenizeProgram('10 a=1: b=2\n');
    expect(errors).toHaveLength(2);
    expect(errors.map((e) => e.column)).toEqual([3, 8]);
  });

  it('handles multi-statement lines with colons', () => {
    const b = bytes('10 LET a=1: PRINT a\n');
    expect(b).toContain(0x3a); // the ':' separator
    expect(b).toContain(0xf1); // LET
    expect(b).toContain(0xf5); // PRINT
  });

  it('round-trips through the detokenizer', () => {
    const src =
      '10 REM demo\n20 FOR i=1 TO 10 STEP 2\n30 PRINT AT 0,0;"x=";i\n40 IF i>5 THEN GO TO 60\n50 NEXT i\n60 STOP\n';
    const first = tokenizeProgram(src);
    expect(first.errors).toEqual([]);
    const round = tokenizeProgram(detokenizeProgram(first.bytes));
    expect(Array.from(round.bytes)).toEqual(Array.from(first.bytes));
  });

  it('tokenizes UDG escapes and control directives inside strings', () => {
    // 10 PRINT "{INK 2}\a" -> F5 22 10 02 90 22
    expect(bytes('10 PRINT "{INK 2}\\a"\n').slice(4)).toEqual([
      0xf5, 0x22, 0x10, 0x02, 0x90, 0x22, 0x0d,
    ]);
  });

  it('tokenizes escapes in REM bodies', () => {
    // 10 REM {AT 1,2}x -> EA 16 01 02 78
    expect(bytes('10 REM {AT 1,2}x\n').slice(4)).toEqual([
      0xea, 0x16, 0x01, 0x02, 0x78, 0x0d,
    ]);
  });

  it('keeps non-directive braces literal in strings', () => {
    expect(bytes('10 PRINT "{no match}"\n').slice(4)).toEqual([
      0xf5,
      0x22,
      ...Array.from('{no match}', (c) => c.charCodeAt(0)),
      0x22,
      0x0d,
    ]);
  });

  it('reports a charset error for unknown escapes in strings', () => {
    const { errors } = tokenizeProgram('10 PRINT "\\z"\n');
    expect(errors.length).toBe(1);
    expect(errors[0]!.message).toContain('escape');
  });

  it('accepts control directives and UDG escapes outside strings', () => {
    // Embedded colour bytes tokenize outside strings now, so a detokenized
    // listing with leading control codes re-tokenizes byte-exactly.
    expect(bytes('10 {INK 2}PRINT "x"\n').slice(4)).toEqual([
      0x10, 0x02, 0xf5, 0x22, 0x78, 0x22, 0x0d,
    ]);
  });

  it('accepts a lone leading control code as a valid, non-fatal line', () => {
    // Real tapes save lines that are just an embedded control byte with no
    // statement keyword (e.g. `9007 {BRIGHT 0}` in Quicksilva's "Mined Out").
    // The detokenizer reproduces them, so re-tokenizing must not fail: the
    // line is valid and round-trips byte-exactly to its 0x13 0x00 body.
    expect(bytes('9007 {BRIGHT 0}\n')).toEqual([
      0x23, 0x2f, 0x03, 0x00, 0x13, 0x00, 0x0d,
    ]);
    // A colon-separated pair of control codes is equally fine.
    expect(tokenizeProgram('10 {INK 2}:{PAPER 6}\n').errors).toEqual([]);
    // The lint path (same tokenizer) must agree - no error surfaced.
    expect(tokenizeProgram('9007 {BRIGHT 0}\n').errors).toEqual([]);
  });

  it('still reports a leading string or bare number with no statement', () => {
    // Only control-code / graphics escapes are the lone-content exception; a
    // string or numeric literal with no statement keyword stays "nonsense",
    // reported once at the offending character.
    for (const src of ['10 "hi"\n', '10 {=5}\n', '10 {INK 2}"hi"\n']) {
      const { errors } = tokenizeProgram(src);
      expect(errors).toHaveLength(1);
      expect(errors[0]!.fatal).toBe(false);
    }
    // A line of nothing but separators never opens a statement at all, and
    // cannot be framed: that one stays fatal.
    const bare = tokenizeProgram('10 :\n');
    expect(bare.errors).toHaveLength(1);
    expect(hasFatalErrors(bare.errors)).toBe(true);
  });

  it('keeps a non-directive brace a literal outside strings', () => {
    // `{` that is not a directive is still a plain character - an invalid
    // statement start on its own.
    const { errors } = tokenizeProgram('10 {no match} PRINT 1\n');
    expect(errors.length).toBe(1);
  });

  it('flags non-ascending and out-of-range line numbers', () => {
    expect(tokenizeProgram('20 PRINT 1\n10 PRINT 2\n').errors.length).toBe(1);
    expect(tokenizeProgram('99999 PRINT 1\n').errors.length).toBe(1);
  });

  describe('DEF FN parameter reservation', () => {
    // The ROM reserves a hidden 0x0E + five zero bytes after each DEF FN
    // parameter so a later FN call has somewhere to store the argument; without
    // it the program trips a "Q Parameter error". The tokenizer inserts it.
    it('reserves the hidden slot after a single parameter', () => {
      // CE 61('a') 28('(') 69('i') 0E 00*5 29(')') 3D('=') 69('i') 0D
      expect(bytes('1 DEF FN a(i)=i\n').slice(4)).toEqual([
        0xce, 0x61, 0x28, 0x69, 0x0e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x29, 0x3d,
        0x69, 0x0d,
      ]);
    });

    it('reserves a slot after each of several parameters', () => {
      // CE s ( x <slot> , y <slot> ) = x + y
      expect(bytes('1 DEF FN s(x,y)=x+y\n').slice(4)).toEqual([
        0xce, 0x73, 0x28, 0x78, 0x0e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x79,
        0x0e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x29, 0x3d, 0x78, 0x2b, 0x79, 0x0d,
      ]);
    });

    it('reserves no slot for an empty parameter list', () => {
      // CE r ( ) = RND — no 0x0E anywhere.
      const b = bytes('1 DEF FN r()=RND\n');
      expect(b).not.toContain(0x0e);
    });

    it('reserves a slot after a string parameter (name and its $)', () => {
      // CE a $ ( x $ <slot> ) = x $ — exactly one marker, right after `x$`.
      const b = bytes('1 DEF FN a$(x$)=x$\n').slice(4);
      expect(b).toEqual([
        0xce, 0x61, 0x24, 0x28, 0x78, 0x24, 0x0e, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x29, 0x3d, 0x78, 0x24, 0x0d,
      ]);
      expect(b.filter((x) => x === 0x0e)).toHaveLength(1);
    });

    it('treats the manual {=0} hack as identical to the plain form', () => {
      // The old workaround still works and produces byte-identical output (no
      // double slot), so existing programs/imports keep round-tripping.
      expect(bytes('1 DEF FN a(i{=0})=i\n')).toEqual(
        bytes('1 DEF FN a(i)=i\n'),
      );
    });

    it('round-trips through the detokenizer without a {=0} splodge', () => {
      const src = '1 DEF FN a(i)=i\n2 DEF FN s(x,y)=x+y\n3 PRINT FN a(42)\n';
      const first = tokenizeProgram(src);
      expect(first.errors).toEqual([]);
      const listing = detokenizeProgram(first.bytes);
      expect(listing).not.toContain('{=');
      const round = tokenizeProgram(listing);
      expect(round.errors).toEqual([]);
      expect(Array.from(round.bytes)).toEqual(Array.from(first.bytes));
    });
  });

  // Every statement on a line gets the command-keyword check, not just the
  // first, and each offending statement is reported once - see the
  // "reports a line-leading non-command like any other statement" cases above,
  // which must not double up.
  describe('statements after the first on a line', () => {
    it('flags a bad statement after a colon', () => {
      const { errors } = tokenizeProgram('10 PRINT 1: PRNT 2\n');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        line: 1,
        column: 12,
        endColumn: 16,
        fatal: false,
      });
      expect(errors[0]!.message).toContain('PRNT');
    });

    it('flags a bad statement after THEN', () => {
      // Spectrum BASIC has no `IF … THEN <line>` shorthand (the jump is
      // `THEN GO TO n`), so THEN always introduces a statement to check.
      const { errors } = tokenizeProgram('10 IF a=1 THEN PRNT 2\n');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ column: 15, endColumn: 19 });
    });

    it('flags a bare line number after THEN', () => {
      const { errors } = tokenizeProgram('10 IF a=1 THEN 20\n');
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain('20');
    });

    it('names LET when an inline assignment omits it', () => {
      // The likeliest real hit, and the rule is unobvious coming from a BASIC
      // with an implied LET.
      const { errors } = tokenizeProgram('10 PRINT 1: a=5\n');
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toMatch(/LET/);
    });

    it('flags a non-command keyword opening a later statement', () => {
      const { errors } = tokenizeProgram('10 PRINT 1: RND\n');
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain('RND');
    });

    it('flags a string opening a later statement', () => {
      const { errors } = tokenizeProgram('10 PRINT 1: "hi"\n');
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({ column: 12, endColumn: 13 });
    });

    it.each([
      '10 BORDER 0: PAPER 0: INK 7: CLS\n',
      '10 FOR n=1 TO 2: BEEP .12,0: NEXT n\n',
      '10 IF a=1 THEN LET b=2: PRINT b\n',
      '10 GO SUB 100: GO TO 200\n',
      '10 PRINT 1::PRINT 2\n', // an empty statement between two good ones
      '10 PRINT 1:\n', // a trailing empty statement
      '10 :PRINT 1\n', // a leading one, as real tapes carry
      '10 REM a: b: c\n', // REM swallows the rest of the line
      '10 PRINT "a:b": PRINT 2\n', // a colon inside a string is not a separator
      '10 DATA 1,2: PRINT 3\n', // DATA items tokenize normally; the colon ends it
      '10 PRINT 1:{INK 2}PRINT 2\n', // an escape carries bytes, it doesn't open
      '10 PRINT 1: DEF FN a(i)=i\n',
    ])('accepts %j', (src) => {
      expect(tokenizeProgram(src).errors).toEqual([]);
    });

    it('leaves the colon separator byte-identical', () => {
      // The colon used to reach the generic character path; it now has its own
      // branch, which must emit the same byte and leave the same state.
      expect(bytes('10 PRINT 1: PRINT 2\n').slice(4)).toEqual([
        0xf5,
        0x31,
        0x0e,
        ...encodeSpectrumNumber(1),
        0x3a,
        0xf5,
        0x32,
        0x0e,
        ...encodeSpectrumNumber(2),
        0x0d,
      ]);
    });

    it('is non-fatal, so the program still builds', () => {
      const { errors, bytes: image } = tokenizeProgram('10 PRINT 1: PRNT 2\n');
      expect(hasFatalErrors(errors)).toBe(false);
      expect(image.length).toBeGreaterThan(0);
    });

    it('round-trips multi-statement lines through the detokenizer', () => {
      const src =
        '10 BORDER 0: PAPER 0: INK 7: CLS\n20 IF a=1 THEN LET b=2: PRINT b\n30 PRINT 1::PRINT 2\n40 REM x: y\n';
      const first = tokenizeProgram(src);
      expect(first.errors).toEqual([]);
      const round = tokenizeProgram(detokenizeProgram(first.bytes));
      expect(round.errors).toEqual([]);
      expect(Array.from(round.bytes)).toEqual(Array.from(first.bytes));
    });
  });

  describe('diagnostic columns on indented lines', () => {
    // Columns are offsets into the physical editor line, so they owe the indent.
    it('offsets a body error by the indent', () => {
      expect(tokenizeProgram('10 x=5\n').errors[0]).toMatchObject({
        column: 3,
      });
      expect(tokenizeProgram('   10 x=5\n').errors[0]).toMatchObject({
        column: 6,
      });
      expect(tokenizeProgram('  10 PRINT 1: PRNT 2\n').errors[0]).toMatchObject(
        { column: 14, endColumn: 18 },
      );
    });

    it('offsets a line-number error by the indent', () => {
      const { errors } = tokenizeProgram('   PRINT 1\n');
      expect(errors[0]).toMatchObject({
        column: 3,
        message: 'Missing line number',
      });
    });
  });
});
