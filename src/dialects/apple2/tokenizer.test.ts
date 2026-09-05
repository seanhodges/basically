// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from './tokenizer';
import { detokenizeProgram } from './detokenizer';
import { MAX_ENTRY_BYTES } from './addresses';

/**
 * Every construct, against the bytes the machine itself stores for it.
 *
 * The right-hand column is not authored. Each line was typed at the `>` prompt
 * of `public/roms/apple2/apple2.rom` booted on the vendored 6502 core, and the program
 * area between the zero-page pointers PP and HIMEM was read back out - so a
 * disagreement here means the tokenizer is wrong, not that the table is stale.
 *
 * The corpus is chosen to reach every token the grammar can produce: all three
 * PRINTs and all six of its separators, both THENs, both DIMs, all three
 * INPUTs, every `(` and `,` variant, the crunched forms (`FORI=1TO10`,
 * `PR INT 1`, `COLOR = 13`) and the three functions that carry their own
 * parenthesis.
 */
const CORPUS: [source: string, stored: string][] = [
  ['10 PRINT', '05 0A 00 63 01'],
  [
    '10 PRINT "HELLO, WORLD!"',
    '14 0A 00 61 28 C8 C5 CC CC CF AC A0 D7 CF D2 CC C4 A1 29 01',
  ],
  ['10 PRINT 42', '08 0A 00 62 B4 2A 00 01'],
  ['10 PRINT 1,2;3', '10 0A 00 62 B1 01 00 49 B2 02 00 46 B3 03 00 01'],
  [
    '10 PRINT "A",1;"B";2',
    '14 0A 00 61 28 C1 29 49 B1 01 00 45 28 C2 29 46 B2 02 00 01',
  ],
  ['10 PRINT A;', '07 0A 00 62 C1 47 01'],
  ['10 PRINT A,', '07 0A 00 62 C1 4A 01'],
  ['10 PRINT A$,B$;C$', '0D 0A 00 61 C1 40 48 C2 40 45 C3 40 01'],
  ['10 A=1', '09 0A 00 C1 71 B1 01 00 01'],
  ['10 A=007', '09 0A 00 C1 71 B0 07 00 01'],
  ['10 LET A=1', '0A 0A 00 5E C1 71 B1 01 00 01'],
  ['10 A$="X"', '0A 0A 00 C1 40 70 28 D8 29 01'],
  ['10 A$=""', '09 0A 00 C1 40 70 28 29 01'],
  ['10 A$(1)="Q"', '0F 0A 00 C1 40 42 B1 01 00 72 70 28 D1 29 01'],
  ['10 A(3)=4', '0E 0A 00 C1 2D B3 03 00 72 71 B4 04 00 01'],
  ['10 A1=2', '0A 0A 00 C1 B1 71 B2 02 00 01'],
  ['10 LONGNAME=3', '10 0A 00 CC CF CE C7 CE C1 CD C5 71 B3 03 00 01'],
  [
    '10 A=1+2-3*4/5^6',
    '1D 0A 00 C1 71 B1 01 00 12 B2 02 00 13 B3 03 00 14 B4 04 00 15 B5 05 00 20 B6 06 00 01',
  ],
  [
    '10 A=1 MOD 2 AND 3 OR 4',
    '15 0A 00 C1 71 B1 01 00 1F B2 02 00 1D B3 03 00 1E B4 04 00 01',
  ],
  ['10 A=NOT 1', '0A 0A 00 C1 71 37 B1 01 00 01'],
  ['10 A=NOT NOT 1', '0B 0A 00 C1 71 37 37 B1 01 00 01'],
  ['10 A=- -1', '0B 0A 00 C1 71 36 36 B1 01 00 01'],
  ['10 A=+1', '0A 0A 00 C1 71 35 B1 01 00 01'],
  ['10 A=-(-1)', '0D 0A 00 C1 71 36 38 36 B1 01 00 72 01'],
  ['10 A=(1+2)*3', '13 0A 00 C1 71 38 B1 01 00 12 B2 02 00 72 14 B3 03 00 01'],
  ['10 A=PEEK(-16384)', '0D 0A 00 C1 71 2E 3F 36 B1 00 40 72 01'],
  ['10 A=RND(100)', '0C 0A 00 C1 71 2F 3F B1 64 00 72 01'],
  ['10 A=SGN(-5)', '0D 0A 00 C1 71 30 3F 36 B5 05 00 72 01'],
  ['10 A=ABS(-5)', '0D 0A 00 C1 71 31 3F 36 B5 05 00 72 01'],
  ['10 A=PDL(0)', '0C 0A 00 C1 71 32 3F B0 00 00 72 01'],
  ['10 A=LEN(B$)', '0A 0A 00 C1 71 3B C2 40 72 01'],
  ['10 A=LEN("XY")', '0C 0A 00 C1 71 3B 28 D8 D9 29 72 01'],
  ['10 A=ASC(B$)', '0A 0A 00 C1 71 3C C2 40 72 01'],
  ['10 A=SCRN(1,2)', '0F 0A 00 C1 71 3D B1 01 00 3E B2 02 00 72 01'],
  ['10 A=B(1)', '0C 0A 00 C1 71 C2 2D B1 01 00 72 01'],
  ['10 A$=B$(1)', '0E 0A 00 C1 40 70 C2 40 2A B1 01 00 72 01'],
  ['10 A$=B$(1,2)', '12 0A 00 C1 40 70 C2 40 2A B1 01 00 23 B2 02 00 72 01'],
  ['10 A=PEEKX', '0B 0A 00 C1 71 D0 C5 C5 CB D8 01'],
  ['10 A=LENX', '0A 0A 00 C1 71 CC C5 CE D8 01'],
  ['10 IF A=1 THEN 20', '0E 0A 00 60 C1 16 B1 01 00 24 B2 14 00 01'],
  ['10 IF A#1 THEN PRINT 1', '0F 0A 00 60 C1 17 B1 01 00 25 62 B1 01 00 01'],
  ['10 IF A>=1 THEN GOTO 20', '0F 0A 00 60 C1 18 B1 01 00 25 5F B2 14 00 01'],
  ['10 IF A<>1 THEN 1', '0E 0A 00 60 C1 1B B1 01 00 24 B1 01 00 01'],
  ['10 IF A<=1 THEN 1', '0E 0A 00 60 C1 1A B1 01 00 24 B1 01 00 01'],
  ['10 IF A<1 THEN 1', '0E 0A 00 60 C1 1C B1 01 00 24 B1 01 00 01'],
  ['10 IF A>1 THEN 1', '0E 0A 00 60 C1 19 B1 01 00 24 B1 01 00 01'],
  ['10 IF A$="X" THEN 1', '0F 0A 00 60 C1 40 39 28 D8 29 24 B1 01 00 01'],
  ['10 IF A$#"X" THEN 1', '0F 0A 00 60 C1 40 3A 28 D8 29 24 B1 01 00 01'],
  [
    '10 IF A$(1)="X" THEN 1',
    '14 0A 00 60 C1 40 2A B1 01 00 72 39 28 D8 29 24 B1 01 00 01',
  ],
  ['10 FOR I=1 TO 10', '0E 0A 00 55 C9 56 B1 01 00 57 B1 0A 00 01'],
  [
    '10 FOR I=1 TO 10 STEP 2',
    '12 0A 00 55 C9 56 B1 01 00 57 B1 0A 00 58 B2 02 00 01',
  ],
  ['10 FORI=1TO10', '0E 0A 00 55 C9 56 B1 01 00 57 B1 0A 00 01'],
  ['10 NEXT I', '06 0A 00 59 C9 01'],
  ['10 NEXT I,J', '08 0A 00 59 C9 5A CA 01'],
  ['10 GOTO 100', '08 0A 00 5F B1 64 00 01'],
  ['10 GOTO A', '06 0A 00 5F C1 01'],
  ['10 GOSUB 100', '08 0A 00 5C B1 64 00 01'],
  ['10 RETURN', '05 0A 00 5B 01'],
  ['10 END', '05 0A 00 51 01'],
  [
    '10 REM  A COMMENT: WITH ; STUFF',
    '1E 0A 00 5D A0 A0 C1 A0 C3 CF CD CD C5 CE D4 BA A0 D7 C9 D4 C8 A0 BB A0 D3 D4 D5 C6 C6 01',
  ],
  ['10 DIM A(10)', '0B 0A 00 4F C1 34 B1 0A 00 72 01'],
  ['10 DIM A$(10)', '0C 0A 00 4E C1 40 22 B1 0A 00 72 01'],
  [
    '10 DIM A(1),B$(2),C(3)',
    '1A 0A 00 4F C1 34 B1 01 00 72 43 C2 40 22 B2 02 00 72 44 C3 34 B3 03 00 72 01',
  ],
  ['10 INPUT A', '06 0A 00 54 C1 01'],
  ['10 INPUT A$', '07 0A 00 52 C1 40 01'],
  ['10 INPUT "NAME",N$', '0E 0A 00 53 28 CE C1 CD C5 29 26 CE 40 01'],
  ['10 INPUT "N",A,B$', '0D 0A 00 53 28 CE 29 27 C1 26 C2 40 01'],
  ['10 INPUT A,B$,C', '0B 0A 00 54 C1 26 C2 40 27 C3 01'],
  ['10 POKE -16368,0', '0D 0A 00 64 36 B1 F0 3F 65 B0 00 00 01'],
  ['10 CALL -936', '09 0A 00 4D 36 B9 A8 03 01'],
  ['10 TAB 5', '08 0A 00 50 B5 05 00 01'],
  ['10 VTAB 5', '08 0A 00 6F B5 05 00 01'],
  ['10 TEXT', '05 0A 00 4B 01'],
  ['10 GR', '05 0A 00 4C 01'],
  ['10 COLOR=13', '08 0A 00 66 B1 0D 00 01'],
  ['10 COLOR = 13', '08 0A 00 66 B1 0D 00 01'],
  ['10 PLOT 10,20', '0C 0A 00 67 B1 0A 00 68 B2 14 00 01'],
  ['10 HLIN 0,39 AT 20', '10 0A 00 69 B0 00 00 6A B3 27 00 6B B2 14 00 01'],
  ['10 VLIN 0,39 AT 20', '10 0A 00 6C B0 00 00 6D B3 27 00 6E B2 14 00 01'],
  ['10 POP', '05 0A 00 77 01'],
  ['10 TRACE', '05 0A 00 7D 01'],
  ['10 NOTRACE', '05 0A 00 7A 01'],
  ['10 DSP A', '06 0A 00 7C C1 01'],
  ['10 DSP A$', '07 0A 00 7B C1 40 01'],
  ['10 NODSP A', '06 0A 00 79 C1 01'],
  ['10 NODSP A$', '07 0A 00 78 C1 40 01'],
  ['10 PR#1', '08 0A 00 7E B1 01 00 01'],
  ['10 IN#0', '08 0A 00 7F B0 00 00 01'],
  ['10 LIST', '05 0A 00 76 01'],
  ['10 LIST 10', '08 0A 00 74 B1 0A 00 01'],
  ['10 LIST 10,20', '0C 0A 00 74 B1 0A 00 75 B2 14 00 01'],
  [
    '10 A=1:B=2:PRINT A',
    '12 0A 00 C1 71 B1 01 00 03 C2 71 B2 02 00 03 62 C1 01',
  ],
  ['10 TEXT:GR:END', '09 0A 00 4B 03 4C 03 51 01'],
  ['10 PR INT 1', '08 0A 00 62 B1 01 00 01'],
  ['10 A = 1 + 2', '0D 0A 00 C1 71 B1 01 00 12 B2 02 00 01'],
  ['10 IFA=1THENPRINT2', '0F 0A 00 60 C1 16 B1 01 00 25 62 B2 02 00 01'],
];

const hex = (bytes: Uint8Array): string =>
  [...bytes]
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

describe('apple2 tokenizer', () => {
  it.each(CORPUS)('stores %s as the machine does', (source, stored) => {
    const { program, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    expect(hex(program)).toBe(stored);
  });

  it('round-trips every construct through the detokenizer', () => {
    for (const [source] of CORPUS) {
      // A constant's introducing byte is the first digit as typed, so `007`
      // stores B0 and lists back as `7`, which stores B7. The machine loses the
      // same thing on its own LIST; nothing else in the corpus is lossy.
      if (source.includes('007')) continue;
      const first = tokenizeProgram(source).program;
      const listing = detokenizeProgram(first);
      const again = tokenizeProgram(listing);
      expect(`${source} -> ${listing} -> ${hex(again.program)}`).toBe(
        `${source} -> ${listing} -> ${hex(first)}`,
      );
      expect(again.errors).toEqual([]);
    }
  });

  it('reaches most of the token table, and nothing outside it', () => {
    // A token the corpus never produces is one this tokenizer has never been
    // checked on; the count is here so a token added without a case shows up.
    const seen = new Set<number>();
    for (const [source] of CORPUS)
      for (const b of tokenizeProgram(source).program)
        if (b < 0x80) seen.add(b);
    expect(seen.size).toBeGreaterThanOrEqual(70);
  });

  it('reports an unparseable line without throwing', () => {
    const { program, errors } = tokenizeProgram('10 PRINT "UNTERMINATED');
    expect(program).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.line).toBe(1);
    expect(errors[0]!.message).toMatch(/Unterminated/);
  });

  it('refuses a prompt command inside a program line', () => {
    for (const word of ['RUN', 'NEW', 'CLR', 'HIMEM:4096']) {
      const { errors } = tokenizeProgram(`10 ${word}`);
      expect(errors.map((e) => e.message).join()).toMatch(/prompt command/);
    }
  });

  it('lets a name merely open with a prompt command', () => {
    // `RUNS`, `DELTA` and `LOADS` are all variables on the machine: those words
    // are not in the deferred grammar, so nothing there competes with the name.
    for (const name of ['RUNS', 'DELTA', 'LOADS', 'SAVED', 'CLRX'])
      expect(`${name}: ${tokenizeProgram(`10 ${name}=1`).errors.length}`).toBe(
        `${name}: 0`,
      );
    // `NEWTON` is not one of them, and not because of NEW: it carries TO.
    expect(tokenizeProgram('10 NEWTON=2').errors).not.toEqual([]);
  });

  it('ends a name at one of the seven words that may follow an expression', () => {
    // `ATOM` is `A TO M` on the machine, and the M has nowhere to go.
    expect(tokenizeProgram('10 ATOM=1').errors).not.toEqual([]);
    expect(tokenizeProgram('10 SCORE=1').errors).not.toEqual([]);
    // ...but the same word at the first character is part of the name.
    expect(tokenizeProgram('10 TOTAL=1').errors).toEqual([]);
    expect(tokenizeProgram('10 ANDY=1').errors).toEqual([]);
  });

  it('refuses an integer the machine cannot hold', () => {
    const { errors } = tokenizeProgram('10 A=32768');
    expect(errors[0]!.message).toMatch(/over 32767/);
    expect(tokenizeProgram('10 A=32767').errors).toEqual([]);
  });

  it('refuses an ordering comparison between strings', () => {
    expect(tokenizeProgram('10 IF A$<B$ THEN 1').errors[0]!.message).toMatch(
      /only with = and #/,
    );
  });

  it('limits a line by what the entry buffer holds of both forms at once', () => {
    // The machine takes 118 characters of name (123 typed, 126 stored) and
    // answers *** TOO LONG ERR at 124 of them.
    const fits = `10 ${'A'.repeat(118)}=1`;
    expect(tokenizeProgram(fits).errors).toEqual([]);
    const over = `10 ${'A'.repeat(124)}=1`;
    const { errors, program } = tokenizeProgram(over);
    expect(program).toHaveLength(0);
    expect(errors[0]!.message).toMatch(
      new RegExp(`entry buffer holds ${MAX_ENTRY_BYTES}`),
    );
  });

  it('keeps the workspace a listing asks for, and refuses one it cannot have', () => {
    expect(tokenizeProgram('HIMEM:16384\n10 END').workspace).toEqual({
      lomem: 0x0800,
      himem: 16384,
      declared: true,
    });
    // Written the way the machine takes it: constants stop at 32767, so all 48K
    // is HIMEM:-16384.
    expect(tokenizeProgram('HIMEM:-16384\n10 END').workspace.himem).toBe(
      0xc000,
    );
    const low = tokenizeProgram('LOMEM:768\n10 END');
    expect(low.errors[0]!.message).toMatch(/below \$0800/);
    expect(low.workspace.declared).toBe(false);
  });

  it('accepts the prompt lines a listing is written with', () => {
    const { errors, program } = tokenizeProgram('NEW\n10 END\nRUN');
    expect(errors).toEqual([]);
    expect(hex(program)).toBe('05 0A 00 51 01');
  });

  it('refuses a video-mode escape inside a program line', () => {
    // {INVA} is byte $01, which the execute loop reads as the end of the line.
    const { errors } = tokenizeProgram('10 PRINT "{INVA}"');
    expect(errors[0]!.message).toMatch(/below \$80 is a token/);
    // The raw-byte escapes for the normal-video duplicates are fine.
    expect(tokenizeProgram('10 PRINT "{0x81}"').errors).toEqual([]);
  });

  it('reports a line with no number and no command', () => {
    expect(tokenizeProgram('PRINT 1').errors[0]!.message).toBe(
      'Missing line number',
    );
  });
});
