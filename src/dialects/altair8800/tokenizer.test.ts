// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { altair8800Keywords } from './keywords';
import { PROGRAM_BASE } from './addresses';

/** Program bytes as a lower-case hex string, for readable failures. */
const hex = (bytes: Uint8Array): string =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');

/** The tokenized body of the first (or only) line of `source`. */
function body(source: string): number[] {
  const { program } = tokenizeProgram(source);
  const end = program.indexOf(0x00, 4);
  return [...program.slice(4, end)];
}

/**
 * The expected-byte cases below are not derived from this tokenizer: each was
 * typed at a real Altair 8K BASIC 4.0 console and read back out of the
 * interpreter's program text (see `addresses.ts` for which image), so they pin
 * agreement with the machine rather than with ourselves.
 *
 * The round-trip cases matter most: once the dialect is registered,
 * `src/dialects/roundTrip.test.ts` requires every bundled sample's image to
 * decode to text that re-tokenizes byte-for-byte, so drift shows up there as a
 * whole-suite failure rather than a local one.
 */
describe('altair8800 tokenizer', () => {
  it('tokenizes each 8K keyword to its documented token byte', () => {
    for (const kw of altair8800Keywords) {
      expect(body(`10 ${kw.word}`)[0], kw.word).toBe(kw.token);
    }
    // `?` is the tokenizing-only synonym for PRINT (0x96).
    expect(body('10 ? 1')).toEqual([0x96, 0x20, 0x31]);
  });

  it('stores lines as [u16 link][u16 line number][body][0x00]', () => {
    const { program } = tokenizeProgram('10 PRINT "HI"\n20 END\n');
    // Straight off the machine: the two records plus the null link.
    expect(hex(program)).toBe(
      '44 19 0a 00 96 20 22 48 49 22 00 4a 19 14 00 80 00 00 00',
    );
    // The links are absolute addresses from TXTTAB, not offsets.
    expect(program[0]! | (program[1]! << 8)).toBe(PROGRAM_BASE + 11);
  });

  it('terminates the program with a zero link', () => {
    const { program } = tokenizeProgram('10 END\n');
    expect([...program.slice(-2)]).toEqual([0x00, 0x00]);
    // An empty program is just the terminator.
    expect([...tokenizeProgram('').program]).toEqual([0x00, 0x00]);
  });

  it('crunches keywords with no delimiter, Microsoft-style', () => {
    expect(body('10 FORI=1TO10:PRINTI:NEXTI')).toEqual([
      0x81, 0x49, 0xac, 0x31, 0x9e, 0x31, 0x30, 0x3a, 0x96, 0x49, 0x3a, 0x82,
      0x49,
    ]);
  });

  it('does not skip spaces while matching a keyword', () => {
    // `PR INT 1` is P, R, space, the INT token, space, 1 - the interpreter
    // matches at each character rather than across the gap.
    expect(body('10 PR INT 1')).toEqual([0x50, 0x52, 0x20, 0xaf, 0x20, 0x31]);
  });

  it('folds a-z to upper case outside literals, and only there', () => {
    // The interpreter folds before it crunches, so a lower-case variable is
    // stored upper-case and `def$` comes back as the DEF token plus `$`.
    expect(body('10 abc=1:print abc')).toEqual([
      0x41, 0x42, 0x43, 0xac, 0x31, 0x3a, 0x96, 0x20, 0x41, 0x42, 0x43,
    ]);
    expect(body('10 def$')).toEqual([0x94, 0x24]);
    // Exactly a-z: the neighbouring printables are stored as typed.
    expect(body('10 A=`{|}~')).toEqual([
      0x41, 0xac, 0x60, 0x7b, 0x7c, 0x7d, 0x7e,
    ]);
    // Strings, REM and DATA are verbatim - no folding at all.
    expect(body('10 PRINT "abc"')).toEqual([
      0x96, 0x20, 0x22, 0x61, 0x62, 0x63, 0x22,
    ]);
    expect(body('10 REM abc')).toEqual([0x8e, 0x20, 0x61, 0x62, 0x63]);
    expect(body('10 DATA abc,def')).toEqual([
      0x83, 0x20, 0x61, 0x62, 0x63, 0x2c, 0x64, 0x65, 0x66,
    ]);
  });

  it('leaves keyword text inside strings, REM and DATA untokenized', () => {
    expect(body('20 REM PRINT "X" GOTO')).toEqual([
      0x8e, 0x20, 0x50, 0x52, 0x49, 0x4e, 0x54, 0x20, 0x22, 0x58, 0x22, 0x20,
      0x47, 0x4f, 0x54, 0x4f,
    ]);
    // DATA is verbatim until an *unquoted* ':', which reopens tokenizing.
    expect(body('30 DATA PRINT,GOTO,"A,B":PRINT1')).toEqual([
      0x83, 0x20, 0x50, 0x52, 0x49, 0x4e, 0x54, 0x2c, 0x47, 0x4f, 0x54, 0x4f,
      0x2c, 0x22, 0x41, 0x2c, 0x42, 0x22, 0x3a, 0x96, 0x31,
    ]);
    expect(body('40 PRINT"FOR NEXT":IFA=1THENPRINT2')).toEqual([
      0x96, 0x22, 0x46, 0x4f, 0x52, 0x20, 0x4e, 0x45, 0x58, 0x54, 0x22, 0x3a,
      0x8a, 0x41, 0xac, 0x31, 0xa1, 0x96, 0x32,
    ]);
  });

  it('reports unparseable line structure as a fatal error', () => {
    const missing = tokenizeProgram('PRINT "NO LINE NUMBER"\n');
    expect(missing.errors).toHaveLength(1);
    expect(missing.errors[0]!.message).toMatch(/Missing line number/);
    expect(missing.errors[0]!.fatal).not.toBe(false);

    // 65529 is the highest line the interpreter accepts; 65530 is ?SN ERROR.
    expect(tokenizeProgram('65529 END\n').errors).toEqual([]);
    const tooBig = tokenizeProgram('65530 END\n');
    expect(tooBig.errors[0]!.message).toMatch(/out of range/);
    expect(tooBig.errors[0]!.fatal).not.toBe(false);

    // A character the machine has no code for is fatal too.
    const bad = tokenizeProgram('10 PRINT "café"\n');
    expect(bad.errors[0]!.message).toMatch(/no Altair equivalent/);
    expect(bad.errors[0]!.fatal).not.toBe(false);

    // 0x00 ends a line record, so it cannot be stored inside one - the escape
    // is rejected rather than silently truncating the line.
    const nul = tokenizeProgram('10 PRINT "{0x00}"\n');
    expect(nul.errors[0]!.message).toMatch(/cannot appear in a program line/);
    expect(nul.errors[0]!.fatal).not.toBe(false);
    expect(body('10 PRINT "{0x00}"')).toEqual([0x96, 0x20, 0x22, 0x22]);
  });

  it('marks heuristic statement-shape lint non-fatal', () => {
    // The interpreter stores this line happily and only fails on RUN, so the
    // squiggle must not stop the image being built.
    const { program, errors } = tokenizeProgram('10 XYZZY\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(body('10 XYZZY')).toEqual([0x58, 0x59, 0x5a, 0x5a, 0x59]);
    expect(program.length).toBeGreaterThan(2);

    // Out-of-order line numbers are lint, not a framing error, for the same
    // reason: the bytes are still exactly what the machine would store.
    const unordered = tokenizeProgram('20 END\n10 END\n');
    expect(unordered.errors).toHaveLength(1);
    expect(unordered.errors[0]!.fatal).toBe(false);
    expect(unordered.program.length).toBeGreaterThan(2);
  });

  it('round-trips tokenize -> detokenize -> tokenize byte-exactly', () => {
    const source = [
      '10 FORI=1TO10:PRINTI:NEXTI',
      '20 REM PRINT "X" GOTO',
      '30 DATA PRINT,GOTO,"A,B":PRINT1',
      '40 PRINT"FOR NEXT":IFA=1THENPRINT2',
      '50 A$=CHR$(34)+LEFT$("AB",1)+MID$("CD",1,1)+RIGHT$("EF",1)',
      '60 PRINT TAB(5);SPC(3);NOT 0;1^2;INP(0);OUT 1,2',
      '70 PRINT "{0x07}{0x7F}{0xFF} lower {"',
      '',
    ].join('\n');
    const first = tokenizeProgram(source);
    expect(first.errors.filter((e) => e.fatal !== false)).toEqual([]);
    const text = detokenizeProgram(first.program);
    expect(text).toBe(source);
    expect(hex(tokenizeProgram(text).program)).toBe(hex(first.program));
  });

  it('lists a `?` back as PRINT, the way the interpreter does', () => {
    const { program } = tokenizeProgram('10 ? 1\n');
    expect(detokenizeProgram(program)).toBe('10 PRINT 1\n');
  });
});
