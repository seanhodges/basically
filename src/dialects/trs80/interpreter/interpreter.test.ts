import { describe, expect, it } from 'vitest';
import { tokenizeProgram } from '../tokenizer';
import { COLS, ROWS } from '../emulator/display';
import { Interpreter } from './interpreter';

/** Tokenize, load and run a program to completion (or a frame cap). */
function run(src: string, frames = 500): Interpreter {
  const { program, errors } = tokenizeProgram(src);
  expect(errors).toEqual([]);
  const interp = new Interpreter();
  interp.load(program);
  for (let i = 0; i < frames && interp.state === 'running'; i++) {
    interp.runBudget(5000);
  }
  return interp;
}

/** Type a line (ending in Enter) into a program paused at INPUT. */
function type(interp: Interpreter, text: string): void {
  for (const ch of text) {
    interp.input.handleEvent({ key: ch } as KeyboardEvent, true);
  }
  interp.input.handleEvent({ key: 'Enter' } as KeyboardEvent, true);
  for (let i = 0; i < 100 && interp.state !== 'ended'; i++) {
    interp.runBudget(5000);
  }
}

/** One screen row as trimmed ASCII text. */
function row(interp: Interpreter, r: number): string {
  let s = '';
  for (let c = 0; c < COLS; c++) {
    const code = interp.screen.video[r * COLS + c]!;
    s += code >= 0x20 && code < 0x80 ? String.fromCharCode(code) : ' ';
  }
  return s.replace(/\s+$/, '');
}

/** First non-empty row, trimmed both ends. */
function firstText(interp: Interpreter): string {
  for (let r = 0; r < ROWS; r++) {
    const t = row(interp, r).trim();
    if (t !== '') return t;
  }
  return '';
}

describe('trs80 interpreter - output & expressions', () => {
  it('prints a string literal', () => {
    expect(firstText(run('10 PRINT "HELLO"\n'))).toBe('HELLO');
  });

  it('formats numbers Level II style (leading space, dropped zero)', () => {
    expect(row(run('10 PRINT 1+2\n'), 0)).toBe(' 3');
    expect(row(run('10 PRINT 1/4\n'), 0)).toBe(' .25');
    expect(row(run('10 PRINT -5\n'), 0)).toBe('-5');
  });

  it('honours arithmetic precedence and the ↑ power operator', () => {
    expect(firstText(run('10 PRINT 2+3*4\n'))).toBe('14');
    expect(firstText(run('10 PRINT 2↑3\n'))).toBe('8');
    expect(firstText(run('10 PRINT -2↑2\n'))).toBe('-4');
    // Left to right, like every operator of equal precedence in Microsoft
    // BASIC: (2↑3)↑2, not 2↑(3↑2). The Commodore ROMs answer 64 to the same
    // expression, and operatorBattery.test.ts holds the two together.
    expect(firstText(run('10 PRINT 2↑3↑2\n'))).toBe('64');
    // The exponent still carries a sign of its own.
    expect(firstText(run('10 PRINT 2↑-2\n'))).toBe('.25');
  });

  it('evaluates relational and logical operators to -1/0', () => {
    expect(firstText(run('10 PRINT (3>2) AND (1<2)\n'))).toBe('-1');
    expect(firstText(run('10 PRINT 5<=4\n'))).toBe('0');
  });

  it('concatenates strings and runs string functions', () => {
    expect(firstText(run('10 PRINT "AB"+"CD"\n'))).toBe('ABCD');
    expect(firstText(run('10 PRINT LEFT$("HELLO",2)\n'))).toBe('HE');
    expect(firstText(run('10 PRINT MID$("HELLO",2,3)\n'))).toBe('ELL');
    expect(firstText(run('10 PRINT LEN("HELLO")\n'))).toBe('5');
  });

  it('PRINT comma advances to the next print zone', () => {
    // "A" at col 0, "B" at the next 16-col zone.
    const r = row(run('10 PRINT "A","B"\n'), 0);
    expect(r[0]).toBe('A');
    expect(r[16]).toBe('B');
  });

  it('PRINT TAB(n) pads to an absolute column', () => {
    const r = row(run('10 PRINT TAB(5);"A";TAB(20);"B"\n'), 0);
    expect(r[5]).toBe('A');
    expect(r[20]).toBe('B');
  });
});

describe('trs80 interpreter - PRINT @', () => {
  it('positions output at a screen cell', () => {
    expect(row(run('10 PRINT @0,"TOP"\n'), 0)).toBe('TOP');
    // Cell 512 is the start of row 8 on the 64-column screen.
    const mid = run('10 PRINT @512,"MID"\n');
    expect(row(mid, 8)).toBe('MID');
    // A cell part-way along a row keeps its column.
    const off = run('10 PRINT @70,"X"\n');
    expect(row(off, 1)[6]).toBe('X');
  });

  it('prints at the last cell, scrolling as the line wraps', () => {
    const interp = run('10 PRINT @1023,"Z"\n');
    // The final cell holds "Z" until the trailing newline scrolls it up a row.
    expect(row(interp, ROWS - 2)[COLS - 1]).toBe('Z');
  });

  it('accepts either separator after the cell number', () => {
    expect(row(run('10 PRINT @64;"A"\n'), 1)).toBe('A');
  });

  it('does not zone-tab on the separator that follows the cell', () => {
    // A "," here belongs to the @ syntax, so "A" lands at cell 3, not col 16.
    expect(row(run('10 PRINT @3,"A"\n'), 0)).toBe('   A');
  });

  it('rejects a cell outside the screen with ?FC', () => {
    const interp = run('10 PRINT @1024,"X"\n');
    expect(interp.state).toBe('error');
    expect(interp.getReport()?.code).toBe('FC');
  });

  it('rejects @ part-way through the item list', () => {
    const interp = run('10 PRINT "A";@100,"B"\n');
    expect(interp.state).toBe('error');
    expect(interp.getReport()?.code).toBe('SN');
  });
});

describe('trs80 interpreter - PRINT USING', () => {
  it('formats numbers against a template', () => {
    expect(row(run('10 PRINT USING "###.##";3.14159\n'), 0)).toBe('  3.14');
    expect(row(run('10 PRINT USING "$$###.##";12.5\n'), 0)).toBe('  $12.50');
  });

  it('reuses the template across the item list without zone tabs', () => {
    // ";" and "," are both plain separators in USING mode.
    expect(row(run('10 PRINT USING "##";1;2,3\n'), 0)).toBe(' 1 2 3');
  });

  it('emits the literal text around the fields', () => {
    expect(row(run('10 PRINT USING "<##.#>";4.26\n'), 0)).toBe('< 4.3>');
  });

  it('marks an overflowing value with %', () => {
    expect(row(run('10 PRINT USING "##";1234\n'), 0)).toBe('% 1234');
  });

  it('formats a string variable through a % % field', () => {
    const src = '10 A$="BASIC"\n20 PRINT USING "[%  %]";A$\n';
    expect(row(run(src), 0)).toBe('[BASI]');
  });

  it('reports a type mismatch against a numeric field', () => {
    const interp = run('10 PRINT USING "##";"A"\n');
    expect(interp.state).toBe('error');
    expect(interp.getReport()?.code).toBe('TM');
  });

  it('works after a PRINT @ position', () => {
    expect(row(run('10 PRINT @64,USING "##.#";2.5\n'), 1)).toBe(' 2.5');
  });
});

describe('trs80 interpreter - control flow', () => {
  it('sums a FOR/NEXT loop', () => {
    const src = '10 S=0\n20 FOR I=1 TO 5\n30 S=S+I\n40 NEXT\n50 PRINT S\n';
    expect(firstText(run(src))).toBe('15');
  });

  it('honours STEP and descending loops', () => {
    const src =
      '10 N=0\n20 FOR I=10 TO 1 STEP -1\n30 N=N+1\n40 NEXT\n50 PRINT N\n';
    expect(firstText(run(src))).toBe('10');
  });

  it('takes IF/THEN and ELSE branches', () => {
    expect(firstText(run('10 IF 1>0 THEN PRINT "Y" ELSE PRINT "N"\n'))).toBe(
      'Y',
    );
    expect(firstText(run('10 IF 0>1 THEN PRINT "Y" ELSE PRINT "N"\n'))).toBe(
      'N',
    );
  });

  it('calls and returns from GOSUB', () => {
    const src =
      '10 GOSUB 100\n20 PRINT "B"\n30 END\n100 PRINT "A"\n110 RETURN\n';
    const interp = run(src);
    expect(row(interp, 0)).toBe('A');
    expect(row(interp, 1)).toBe('B');
  });

  it('dispatches ON..GOTO', () => {
    const src =
      '10 X=2\n20 ON X GOTO 100,200\n100 PRINT "ONE":END\n200 PRINT "TWO"\n';
    expect(firstText(run(src))).toBe('TWO');
  });

  it('reports an undefined line as ?UL', () => {
    const interp = run('10 GOTO 999\n');
    expect(interp.state).toBe('error');
    expect(interp.getReport()?.code).toBe('UL');
  });

  it('RUN with a line number restarts there', () => {
    const src =
      '10 A=1\n20 IF A=1 THEN A=2:RUN 40\n30 PRINT "SKIPPED"\n40 PRINT "AT40"\n';
    // RUN clears variables, so line 20 does not loop on the second pass.
    expect(firstText(run(src))).toBe('AT40');
  });

  it('STOP halts and reports the line it broke on', () => {
    const interp = run('10 PRINT "A"\n20 STOP\n30 PRINT "B"\n');
    expect(interp.state).toBe('ended');
    expect(interp.getReport()).toEqual({
      isError: false,
      message: 'BREAK IN 20',
    });
    expect(firstText(interp)).toBe('A');
  });
});

describe('trs80 interpreter - keyboard LINE INPUT', () => {
  it('takes the whole typed line, commas and all', () => {
    const interp = run('10 LINE INPUT A$\n20 PRINT "["+A$+"]"\n');
    expect(interp.state).toBe('input');
    type(interp, 'ONE, TWO');
    // Row 0 is the echoed input; the program's own output follows it.
    expect(row(interp, 1)).toBe('[ONE, TWO]');
  });

  it('prints the prompt without adding a ? marker', () => {
    const interp = run('10 LINE INPUT "NAME";A$\n20 PRINT A$\n');
    type(interp, 'ADA');
    expect(row(interp, 0)).toBe('NAMEADA');
  });

  it('rejects a numeric target', () => {
    const interp = run('10 LINE INPUT A\n');
    expect(interp.state).toBe('error');
    expect(interp.getReport()?.code).toBe('TM');
  });
});

describe('trs80 interpreter - Disk BASIC conversions', () => {
  it('round-trips integers through MKI$/CVI', () => {
    expect(firstText(run('10 PRINT CVI(MKI$(1234))\n'))).toBe('1234');
    expect(firstText(run('10 PRINT CVI(MKI$(-2))\n'))).toBe('-2');
  });

  it('stores MKI$ as two little-endian bytes', () => {
    expect(firstText(run('10 PRINT ASC(MKI$(258))\n'))).toBe('2');
    expect(firstText(run('10 PRINT LEN(MKI$(0))\n'))).toBe('2');
  });

  it('round-trips singles and doubles through MKS$/CVS and MKD$/CVD', () => {
    expect(firstText(run('10 PRINT CVS(MKS$(0))\n'))).toBe('0');
    expect(firstText(run('10 PRINT CVD(MKD$(3.5))\n'))).toBe('3.5');
    expect(firstText(run('10 PRINT CVD(MKD$(-1.25))\n'))).toBe('-1.25');
    expect(firstText(run('10 PRINT LEN(MKS$(1))+LEN(MKD$(1))\n'))).toBe('12');
  });

  it('measures a byte string by its bytes, not its UTF-16 units', () => {
    // 0x81-0xBF are block-graphics characters that take two UTF-16 units each.
    expect(firstText(run('10 PRINT LEN(CHR$(129)+CHR$(130))\n'))).toBe('2');
    expect(firstText(run('10 PRINT ASC(LEFT$(CHR$(129)+"A",1))\n'))).toBe(
      '129',
    );
    expect(firstText(run('10 PRINT ASC(RIGHT$("A"+CHR$(160),1))\n'))).toBe(
      '160',
    );
    expect(firstText(run('10 PRINT ASC(MID$(CHR$(129)+"AB",2,1))\n'))).toBe(
      '65',
    );
    expect(firstText(run('10 PRINT INSTR(CHR$(129)+"AB","B")\n'))).toBe('3');
  });

  it('rejects a string too short for the conversion', () => {
    const interp = run('10 PRINT CVI("A")\n');
    expect(interp.state).toBe('error');
    expect(interp.getReport()?.code).toBe('FC');
  });
});

describe('trs80 interpreter - data, arrays, graphics', () => {
  it('reads DATA into an array', () => {
    const src =
      '10 DIM A(3)\n20 FOR I=0 TO 3\n30 READ A(I)\n40 NEXT\n' +
      '50 DATA 10,20,30,40\n60 PRINT A(2)\n';
    expect(firstText(run(src))).toBe('30');
  });

  it('reads string DATA', () => {
    const src = '10 READ A$,B$\n20 PRINT B$\n30 DATA HELLO,WORLD\n';
    expect(firstText(run(src))).toBe('WORLD');
  });

  it('keeps quoted DATA exact, skipping spaces around the quotes', () => {
    // The space after DATA (and after the comma) must not pad the quoted value.
    const src =
      '10 READ A$,B$\n20 PRINT LEN(A$)+LEN(B$)\n30 DATA "###", "#E#"\n';
    expect(firstText(run(src))).toBe('6');
  });

  it('SET lights a cell that POINT reads back', () => {
    const src =
      '10 SET(10,10)\n20 IF POINT(10,10) THEN PRINT "ON" ELSE PRINT "OFF"\n';
    expect(firstText(run(src))).toBe('ON');
    const off =
      '10 SET(10,10)\n20 RESET(10,10)\n30 IF POINT(10,10) THEN PRINT "ON" ELSE PRINT "OFF"\n';
    expect(firstText(run(off))).toBe('OFF');
  });

  it('INKEY$ returns empty string when no key is waiting', () => {
    expect(firstText(run('10 PRINT "["+INKEY$+"]"\n'))).toBe('[]');
  });

  it('evaluates a user-defined FN', () => {
    const src = '10 DEF FNS(X)=X*X\n20 PRINT FNS(4)\n';
    expect(firstText(run(src))).toBe('16');
  });
});

describe('trs80 interpreter - display-driver runtime fidelity', () => {
  it('lexes a tokenized 1E-5 exponent (the sign is a minus token)', () => {
    // The tokenizer stores the exponent sign as the 0xCE minus token, so the
    // lexer must recognise it as part of the number, not a subtraction (which
    // would evaluate `1E-5` as `1E` (=1) minus 5 = -4).
    expect(firstText(run('10 PRINT 1E-5*100000\n'))).toBe('1');
    expect(firstText(run('10 PRINT 2E+3\n'))).toBe('2000');
  });

  it('accepts ^ as the power operator (alias of ↑)', () => {
    expect(firstText(run('10 PRINT 2^10\n'))).toBe('1024');
  });

  it('routes CHR$/ASC through codes, not glyphs, for every byte', () => {
    // Control codes have no glyph, but ASC(CHR$(n)) must still recover n.
    expect(firstText(run('10 PRINT ASC(CHR$(7))\n'))).toBe('7');
    expect(firstText(run('10 PRINT ASC(CHR$(200))\n'))).toBe('200');
    expect(firstText(run('10 PRINT ASC(CHR$(128))\n'))).toBe('128');
  });

  it('acts on a control code embedded in a printed string', () => {
    // CHR$(28) homes the cursor: the "B" overwrites the "A" at the top-left.
    const interp = run('10 PRINT "A";CHR$(28);"B"\n');
    expect(interp.screen.video[0]).toBe('B'.charCodeAt(0));
  });

  it('prints a space-compression code as N spaces', () => {
    // CHR$(0xC0 + 3) prints three spaces between the digits.
    expect(row(run('10 PRINT "1";CHR$(195);"2"\n'), 0)).toBe('1   2');
  });
});
