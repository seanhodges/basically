// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { hasFatalErrors } from '../types';
import { MAX_ENTRY_BYTES, MAX_LINE } from './addresses';

/**
 * Every construct, against the bytes the machine itself stores for it.
 *
 * The right-hand column is not authored. Each program was typed at the `]`
 * prompt of `public/roms/apple2plus/apple2plus.rom` booted on the vendored 6502 core, and
 * the program area between TXTTAB and VARTAB was read back out - so a
 * disagreement here means the tokenizer is wrong, not that the corpus is stale.
 * (VARTAB sits one byte past the zero link on this interpreter, which is why
 * the captured rows stop one short of it; `basicImage.test.ts` pins that.)
 *
 * The corpus reaches every token in the table and, more to the point, every way
 * the scanner can surprise someone: the crunched forms (`PR INT 1`,
 * `FORI=1TO10`), the three verbatim regions (string, REM, DATA) and what ends
 * them, `?` for PRINT in both positions, and the whole AT/ATN/TO family -
 * including `LATCH`, `CATALOG` and `IF A THEN 20`, which are broken on the real
 * machine and are broken here in the same way.
 */
const CORPUS: [source: string, stored: string][] = [
  ['10 PRINT', '07 08 0A 00 BA 00 00 00'],
  ['10 PRINT 1', '08 08 0A 00 BA 31 00 00 00'],
  ['10 PRINT   1', '08 08 0A 00 BA 31 00 00 00'],
  [
    '10 PRINT "HELLO, WORLD!"',
    '16 08 0A 00 BA 22 48 45 4C 4C 4F 2C 20 57 4F 52 4C 44 21 22 00 00 00',
  ],
  ['10 PRINT "A  B"', '0D 08 0A 00 BA 22 41 20 20 42 22 00 00 00'],
  ['10 A=1', '09 08 0A 00 41 D0 31 00 00 00'],
  ['10 A = 1', '09 08 0A 00 41 D0 31 00 00 00'],
  ['10 LET A=1', '0A 08 0A 00 AA 41 D0 31 00 00 00'],
  ['10 A$="X"', '0C 08 0A 00 41 24 D0 22 58 22 00 00 00'],
  ['10 A%=1', '0A 08 0A 00 41 25 D0 31 00 00 00'],
  ['10 A(3)=4', '0C 08 0A 00 41 28 33 29 D0 34 00 00 00'],
  ['10 A$(1)="Q"', '0F 08 0A 00 41 24 28 31 29 D0 22 51 22 00 00 00'],
  ['10 PR INT 1', '08 08 0A 00 BA 31 00 00 00'],
  ['10 FORI=1TO10', '0D 08 0A 00 81 49 D0 31 C1 31 30 00 00 00'],
  ['10 FOR I=1 TO 5:NEXT', '0E 08 0A 00 81 49 D0 31 C1 35 3A 82 00 00 00'],
  [
    '10 FOR I=1 TO 9 STEP 2:NEXT I',
    '11 08 0A 00 81 49 D0 31 C1 39 C7 32 3A 82 49 00 00 00',
  ],
  [
    '10 IF A>1 THEN PRINT "Y"',
    '0F 08 0A 00 AD 41 CF 31 C4 BA 22 59 22 00 00 00',
  ],
  [
    '10 IF B THEN 20\n20 END',
    '0B 08 0A 00 AD 42 C4 32 30 00 11 08 14 00 80 00 00 00',
  ],
  [
    '10 IF A THEN 20\n20 END',
    '0D 08 0A 00 AD C5 48 45 4E 32 30 00 13 08 14 00 80 00 00 00',
  ],
  [
    '10 IF A<>0 THEN 20\n20 END',
    '0E 08 0A 00 AD 41 D1 CF 30 C4 32 30 00 14 08 14 00 80 00 00 00',
  ],
  [
    '10 A=1+2-3*4/5^6',
    '13 08 0A 00 41 D0 31 C8 32 C9 33 CA 34 CB 35 CC 36 00 00 00',
  ],
  ['10 A=1 AND 2 OR 3', '0D 08 0A 00 41 D0 31 CD 32 CE 33 00 00 00'],
  ['10 A=NOT 1', '0A 08 0A 00 41 D0 C6 31 00 00 00'],
  ['10 ? 1', '08 08 0A 00 BA 31 00 00 00'],
  ['10 A=1:?2', '0C 08 0A 00 41 D0 31 3A BA 32 00 00 00'],
  ['10 GO TO 20\n20 END', '09 08 0A 00 AB 32 30 00 0F 08 14 00 80 00 00 00'],
  ['10 A TO B', '09 08 0A 00 41 C1 42 00 00 00'],
  ['10 ATO B', '09 08 0A 00 41 C1 42 00 00 00'],
  ['10 A T O B', '09 08 0A 00 C5 4F 42 00 00 00'],
  ['10 A=ATN(1)', '0C 08 0A 00 41 D0 E1 28 31 29 00 00 00'],
  ['10 A=AT N(1)', '0D 08 0A 00 41 D0 C5 4E 28 31 29 00 00 00'],
  ['10 XATOB=1', '0C 08 0A 00 58 41 C1 42 D0 31 00 00 00'],
  ['10 XATNY=1', '0B 08 0A 00 58 E1 59 D0 31 00 00 00'],
  ['10 QAT=1', '0A 08 0A 00 51 C5 D0 31 00 00 00'],
  ['10 LATCH=1', '0C 08 0A 00 4C C5 43 48 D0 31 00 00 00'],
  ['10 CATALOG', '0A 08 0A 00 43 C5 41 DC 00 00 00'],
  ['10 ATN=1', '09 08 0A 00 E1 D0 31 00 00 00'],
  ['10 PRINT AT', '08 08 0A 00 BA C5 00 00 00'],
  ['10 PRINT ATN', '08 08 0A 00 BA E1 00 00 00'],
  ['10 A=1 TO 2', '0B 08 0A 00 41 D0 31 C1 32 00 00 00'],
  ['10 A=1:AT=2', '0D 08 0A 00 41 D0 31 3A C5 D0 32 00 00 00'],
  ['10 REM  HI THERE', '11 08 0A 00 B2 20 20 48 49 20 54 48 45 52 45 00 00 00'],
  [
    '10 PRINT 1:REM X:PRINT 2',
    '14 08 0A 00 BA 31 3A B2 20 58 3A 50 52 49 4E 54 20 32 00 00 00',
  ],
  ['10 DATA 1, 2 ,3', '0F 08 0A 00 83 20 31 2C 20 32 20 2C 33 00 00 00'],
  ['10 DATA 1,2:PRINT 3', '0E 08 0A 00 83 20 31 2C 32 3A BA 33 00 00 00'],
  [
    '10 DATA "A:B",C:PRINT 1',
    '12 08 0A 00 83 20 22 41 3A 42 22 2C 43 3A BA 31 00 00 00',
  ],
  [
    '10 DATA "X Y",Z:REM Q',
    '13 08 0A 00 83 20 22 58 20 59 22 2C 5A 3A B2 20 51 00 00 00',
  ],
  ['10 A=1:DATA 5', '0D 08 0A 00 41 D0 31 3A 83 20 35 00 00 00'],
  ['10 PRINT 1, 2', '0A 08 0A 00 BA 31 2C 32 00 00 00'],
  ['10 PRINT 1,2;3', '0C 08 0A 00 BA 31 2C 32 3B 33 00 00 00'],
  ['10 PRINT A;', '09 08 0A 00 BA 41 3B 00 00 00'],
  ['10 PRINT A,', '09 08 0A 00 BA 41 2C 00 00 00'],
  ['10 PRINT:PRINT', '09 08 0A 00 BA 3A BA 00 00 00'],
  ['10 PRINT"X"', '0A 08 0A 00 BA 22 58 22 00 00 00'],
  ['10 PRINT "UNTERM', '0E 08 0A 00 BA 22 55 4E 54 45 52 4D 00 00 00'],
  ['10 & "X"', '0A 08 0A 00 AF 22 58 22 00 00 00'],
  ['10 HOME', '07 08 0A 00 97 00 00 00'],
  [
    '10 GR:COLOR=13:PLOT 5,5',
    '10 08 0A 00 88 3A A0 31 33 3A 8D 35 2C 35 00 00 00',
  ],
  [
    '10 HGR:HCOLOR=3:HPLOT 0,0 TO 279,159',
    '17 08 0A 00 91 3A 92 33 3A 93 30 2C 30 C1 32 37 39 2C 31 35 39 00 00 00',
  ],
  ['10 HGR2', '07 08 0A 00 90 00 00 00'],
  ['10 HLIN 0,39 AT 20', '0E 08 0A 00 8E 30 2C 33 39 C5 32 30 00 00 00'],
  ['10 VLIN 0,39 AT 20', '0E 08 0A 00 8F 30 2C 33 39 C5 32 30 00 00 00'],
  ['10 ONERR GOTO 100', '0B 08 0A 00 A5 AB 31 30 30 00 00 00'],
  ['10 DEF FN A(X)=X*2', '10 08 0A 00 B8 C2 41 28 58 29 D0 58 CA 32 00 00 00'],
  [
    '10 PRINT SPC(3);TAB(5);"Z"',
    '12 08 0A 00 BA C3 33 29 3B C0 35 29 3B 22 5A 22 00 00 00',
  ],
  ['10 POKE -16368,0', '0F 08 0A 00 B9 C9 31 36 33 36 38 2C 30 00 00 00'],
  [
    '10 A=PEEK(-16384)',
    '11 08 0A 00 41 D0 E2 28 C9 31 36 33 38 34 29 00 00 00',
  ],
  [
    '10 PRINT MID$("ABC",1,2)',
    '13 08 0A 00 BA EA 28 22 41 42 43 22 2C 31 2C 32 29 00 00 00',
  ],
  [
    '10 PRINT LEFT$(A$,1);RIGHT$(A$,2)',
    '16 08 0A 00 BA E8 28 41 24 2C 31 29 3B E9 28 41 24 2C 32 29 00 00 00',
  ],
  [
    '10 PRINT CHR$(7);STR$(1);VAL("2");ASC("A");LEN(A$)',
    '24 08 0A 00 BA E7 28 37 29 3B E4 28 31 29 3B E5 28 22 32 22 29 3B E6 28 22 41 22 29 3B E3 28 41 24 29 00 00 00',
  ],
  [
    '10 PRINT SGN(-5);INT(1.5);ABS(-5)',
    '19 08 0A 00 BA D2 28 C9 35 29 3B D3 28 31 2E 35 29 3B D4 28 C9 35 29 00 00 00',
  ],
  [
    '10 PRINT SQR(2);RND(1);LOG(2);EXP(1);COS(0);SIN(0);TAN(0)',
    '29 08 0A 00 BA DA 28 32 29 3B DB 28 31 29 3B DC 28 32 29 3B DD 28 31 29 3B DE 28 30 29 3B DF 28 30 29 3B E0 28 30 29 00 00 00',
  ],
  [
    '10 PRINT FRE(0);POS(0);PDL(0);USR(0)',
    '1A 08 0A 00 BA D6 28 30 29 3B D9 28 30 29 3B D8 28 30 29 3B D5 28 30 29 00 00 00',
  ],
  ['10 PRINT SCRN(1,2)', '0C 08 0A 00 BA D7 31 2C 32 29 00 00 00'],
  ['10 GET A$', '09 08 0A 00 BE 41 24 00 00 00'],
  ['10 INPUT "NAME";N$', '10 08 0A 00 84 22 4E 41 4D 45 22 3B 4E 24 00 00 00'],
  [
    '10 ON A GOTO 10,20\n20 END',
    '0E 08 0A 00 B4 41 AB 31 30 2C 32 30 00 14 08 14 00 80 00 00 00',
  ],
  [
    '10 WAIT -16384,128',
    '11 08 0A 00 B5 C9 31 36 33 38 34 2C 31 32 38 00 00 00',
  ],
  ['10 TEXT:NORMAL:INVERSE:FLASH', '0D 08 0A 00 89 3A 9D 3A 9E 3A 9F 00 00 00'],
  ['10 TRACE:NOTRACE', '09 08 0A 00 9B 3A 9C 00 00 00'],
  ['10 HTAB 5:VTAB 10', '0C 08 0A 00 96 35 3A A2 31 30 00 00 00'],
  [
    '10 SPEED= 100:ROT= 0:SCALE= 1',
    '10 08 0A 00 A9 31 30 30 3A 98 30 3A 99 31 00 00 00',
  ],
  [
    '10 DRAW 1 AT 10,10:XDRAW 1 AT 20,20',
    '17 08 0A 00 94 31 C5 31 30 2C 31 30 3A 95 31 C5 32 30 2C 32 30 00 00 00',
  ],
  ['10 IN# 0:PR# 0', '0B 08 0A 00 8B 30 3A 8A 30 00 00 00'],
  ['10 HIMEM: 16384', '0C 08 0A 00 A3 31 36 33 38 34 00 00 00'],
  ['10 LOMEM: 4096', '0B 08 0A 00 A4 34 30 39 36 00 00 00'],
  ['10 CALL -936', '0B 08 0A 00 8C C9 39 33 36 00 00 00'],
  ['10 STOP', '07 08 0A 00 B3 00 00 00'],
  ['10 CONT', '07 08 0A 00 BB 00 00 00'],
  ['10 CLEAR', '07 08 0A 00 BD 00 00 00'],
  ['10 POP', '07 08 0A 00 A1 00 00 00'],
  ['10 RESTORE:READ A', '0A 08 0A 00 AE 3A 87 41 00 00 00'],
  ['10 GOSUB 100:RETURN', '0C 08 0A 00 B0 31 30 30 3A B1 00 00 00'],
  ['10 RESUME', '07 08 0A 00 A6 00 00 00'],
  ['10 STORE A:RECALL A', '0B 08 0A 00 A8 41 3A A7 41 00 00 00'],
  ['10 SHLOAD', '07 08 0A 00 9A 00 00 00'],
  ['10 DEL 1,2', '0A 08 0A 00 85 31 2C 32 00 00 00'],
  ['10 LIST', '07 08 0A 00 BC 00 00 00'],
  ['10 RUN', '07 08 0A 00 AC 00 00 00'],
  ['10 NEW', '07 08 0A 00 BF 00 00 00'],
  ['10 LOAD', '07 08 0A 00 B6 00 00 00'],
  ['10 SAVE', '07 08 0A 00 B7 00 00 00'],
  ['10 END', '07 08 0A 00 80 00 00 00'],
  ['0 END', '07 08 00 00 80 00 00 00'],
  ['63999 END', '07 08 FF F9 80 00 00 00'],
  [
    '10 END\n20 END\n30 END',
    '07 08 0A 00 80 00 0D 08 14 00 80 00 13 08 1E 00 80 00 00 00',
  ],
  ['10 STORE A', '08 08 0A 00 A8 41 00 00 00'],
  ['10 STOP', '07 08 0A 00 B3 00 00 00'],
  ['10 STEP', '07 08 0A 00 C7 00 00 00'],
  [
    '10 PRINT 1\n20 PRINT 2\n30 PRINT 3',
    '08 08 0A 00 BA 31 00 0F 08 14 00 BA 32 00 16 08 1E 00 BA 33 00 00 00',
  ],
  [
    '10 X=INT(RND(1)*10)+1',
    '14 08 0A 00 58 D0 D3 28 DB 28 31 29 CA 31 30 29 C8 31 00 00 00',
  ],
  ['10 A$=""', '0B 08 0A 00 41 24 D0 22 22 00 00 00'],
  ['10 A=007', '0B 08 0A 00 41 D0 30 30 37 00 00 00'],
];

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');

describe('apple2plus tokenizer', () => {
  it('stores what the machine stores, for every construct', () => {
    for (const [source, stored] of CORPUS) {
      const { program, errors } = tokenizeProgram(source);
      expect(hasFatalErrors(errors), `${source}: ${errors[0]?.message}`).toBe(
        false,
      );
      expect(hex(program), source).toBe(stored);
    }
  });

  it('round-trips every construct through the detokenizer', () => {
    for (const [source] of CORPUS) {
      const first = tokenizeProgram(source).program;
      const again = tokenizeProgram(detokenizeProgram(first)).program;
      expect(hex(again), source).toBe(hex(first));
    }
  });

  /**
   * The machine's own listing, near enough. The IDE drops the space LIST leaves
   * between the line number and the first token, and the one it leaves after
   * REM and DATA (which would become a byte of what those hold), and keeps
   * every other space - because those are what make `A TO B` and `AT OB`
   * different programs.
   */
  it('lists a line the way the machine lists it', () => {
    expect(detokenizeProgram(tokenizeProgram('10 FORI=1TO10').program)).toBe(
      '10 FOR I = 1 TO 10\n',
    );
    expect(
      detokenizeProgram(tokenizeProgram('10 X=INT(RND(1)*10)+1').program),
    ).toBe('10 X =  INT ( RND (1) * 10) + 1\n');
    expect(
      detokenizeProgram(tokenizeProgram('10 A=1:REM HI THERE').program),
    ).toBe('10 A = 1: REM HI THERE\n');
  });

  it('keeps the links consistent after a re-tokenize', () => {
    const source = '10 PRINT "A"\n20 GOSUB 100\n30 END\n';
    const program = tokenizeProgram(source).program;
    // Each link is the absolute address of the next line, from $0801.
    let pos = 0;
    let address = 0x0801;
    const seen: number[] = [];
    while (pos + 1 < program.length) {
      const link = program[pos]! | (program[pos + 1]! << 8);
      if (link === 0) break;
      let end = pos + 4;
      while (program[end] !== 0x00) end++;
      expect(link).toBe(address + (end + 1 - pos));
      seen.push(program[pos + 2]! | (program[pos + 3]! << 8));
      address = link;
      pos = end + 1;
    }
    expect(seen).toEqual([10, 20, 30]);
    expect(Array.from(program.subarray(-2))).toEqual([0, 0]);
  });

  it('reports an unparseable line without throwing', () => {
    const { program, errors } = tokenizeProgram('PRINT 1\n20 END\n');
    expect(errors[0]?.message).toMatch(/Missing line number/);
    expect(hasFatalErrors(errors)).toBe(true);
    // The line is dropped and the rest still assembles, so the editor has
    // something to squiggle against rather than an exception.
    expect(hex(program)).toBe('07 08 14 00 80 00 00 00');
  });

  it('flags what the machine would refuse but can still hold', () => {
    // Accepted at the prompt only up to 63999, but a higher line stores and
    // runs once it is in memory, so this warns rather than dropping the line.
    const high = tokenizeProgram(`${MAX_LINE + 1} END`);
    expect(high.errors.map((e) => e.fatal)).toEqual([false]);
    expect(high.program.length).toBeGreaterThan(2);

    // The line field is two bytes; there is nothing to store this in.
    const impossible = tokenizeProgram('70000 END');
    expect(hasFatalErrors(impossible.errors)).toBe(true);

    const backwards = tokenizeProgram('20 END\n10 END');
    expect(backwards.errors.map((e) => e.fatal)).toEqual([false]);

    const long = tokenizeProgram(`10 REM ${'A'.repeat(MAX_ENTRY_BYTES)}`);
    expect(long.errors.map((e) => e.fatal)).toEqual([false]);
    expect(long.errors[0]?.message).toMatch(/drops the rest/);
  });

  it('refuses a character the machine has no key for', () => {
    const { errors } = tokenizeProgram('10 PRINT "café"');
    expect(hasFatalErrors(errors)).toBe(true);
    expect(errors[0]?.message).toMatch(/no lower case/);
  });

  it('carries a byte nobody can type through the {0xNN} escape', () => {
    const { program } = tokenizeProgram('10 PRINT "{0x8D}"');
    expect(hex(program)).toContain('22 8D 22');
    expect(detokenizeProgram(program)).toBe('10 PRINT "{0x8D}"\n');
  });
});
