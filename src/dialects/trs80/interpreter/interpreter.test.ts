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

describe('trs80 interpreter — output & expressions', () => {
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
});

describe('trs80 interpreter — control flow', () => {
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
});

describe('trs80 interpreter — data, arrays, graphics', () => {
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
