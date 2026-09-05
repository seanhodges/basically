import { describe, it, expect } from 'vitest';
import {
  parseLines,
  computeNewLineNumber,
  makeSpace,
  makeSpaceN,
  rewriteReferences,
  renumberLine,
  renumberProgram,
  numberLineInPlace,
  applyRenumberMap,
  insertNumberedLineBelow,
  planConstructNumbering,
  MAX_LINE_NO,
} from './lineNumbering';
import { bytesToBase64 } from '../storage/vfs/base64';

const b64 = (bytes: number[]) => bytesToBase64(Uint8Array.from(bytes));

describe('parseLines', () => {
  it('parses numbered lines and skips blanks and unnumbered lines', () => {
    const lines = parseLines('10 PRINT\n\n  20 GOTO 10\nHELLO\n30');
    expect(lines).toEqual([
      { lineNo: 10, body: 'PRINT', raw: '10 PRINT' },
      { lineNo: 20, body: 'GOTO 10', raw: '20 GOTO 10' },
      { lineNo: 30, body: '', raw: '30' },
    ]);
  });
});

describe('computeNewLineNumber', () => {
  it('starts an empty file at the increment', () => {
    expect(computeNewLineNumber(null, null, 10)).toEqual({
      lineNo: 10,
      makeSpace: false,
    });
    expect(computeNewLineNumber(null, null, 100)).toEqual({
      lineNo: 100,
      makeSpace: false,
    });
  });

  it('appends at the end of file', () => {
    expect(computeNewLineNumber(20, null, 10)).toEqual({
      lineNo: 30,
      makeSpace: false,
    });
  });

  it('uses the rounded-down midpoint between two lines', () => {
    expect(computeNewLineNumber(10, 15, 10)).toEqual({
      lineNo: 12,
      makeSpace: false,
    });
  });

  it('signals makeSpace when adjacent lines leave no gap', () => {
    expect(computeNewLineNumber(12, 13, 10)).toEqual({
      lineNo: 13,
      makeSpace: true,
    });
  });

  it('handles inserting at the top of the file', () => {
    expect(computeNewLineNumber(null, 20, 10)).toEqual({
      lineNo: 10,
      makeSpace: false,
    });
    expect(computeNewLineNumber(null, 1, 10)).toEqual({
      lineNo: 1,
      makeSpace: true,
    });
  });
});

describe('makeSpace', () => {
  it('cascades a run of adjacent lines until a gap', () => {
    const lines = parseLines('10 A\n11 B\n12 C\n20 D');
    expect(makeSpace(lines, 10, 10)).toEqual(
      new Map([
        [11, 12],
        [12, 13],
      ]),
    );
  });

  it('shifts only the single colliding line', () => {
    const lines = parseLines('10 A\n11 B\n30 C');
    expect(makeSpace(lines, 10, 10)).toEqual(new Map([[11, 12]]));
  });

  it('returns an empty map when the cascade would overflow the max line number', () => {
    const lines = parseLines(
      `${MAX_LINE_NO - 2} A\n${MAX_LINE_NO - 1} B\n${MAX_LINE_NO} C`,
    );
    expect(makeSpace(lines, MAX_LINE_NO - 2, 10)).toEqual(new Map());
  });
});

describe('rewriteReferences', () => {
  it('rewrites GOTO and GOSUB targets', () => {
    expect(rewriteReferences('20 GOTO 10', new Map([[10, 15]]))).toBe(
      '20 GOTO 15',
    );
    expect(rewriteReferences('20 GOSUB 10', new Map([[10, 15]]))).toBe(
      '20 GOSUB 15',
    );
  });

  it('rewrites THEN GOTO / THEN GOSUB', () => {
    expect(
      rewriteReferences('20 IF A=1 THEN GOTO 10', new Map([[10, 15]])),
    ).toBe('20 IF A=1 THEN GOTO 15');
  });

  it('rewrites RUN / LIST / LLIST targets', () => {
    expect(rewriteReferences('20 RUN 10', new Map([[10, 15]]))).toBe(
      '20 RUN 15',
    );
    expect(rewriteReferences('20 LIST 10', new Map([[10, 15]]))).toBe(
      '20 LIST 15',
    );
    expect(rewriteReferences('20 LLIST 10', new Map([[10, 15]]))).toBe(
      '20 LLIST 15',
    );
  });

  it('leaves numbers inside strings untouched', () => {
    expect(rewriteReferences('30 PRINT "GOTO 10"', new Map([[10, 15]]))).toBe(
      '30 PRINT "GOTO 10"',
    );
  });

  it('leaves REM comments untouched', () => {
    expect(rewriteReferences('40 REM GOTO 10', new Map([[10, 15]]))).toBe(
      '40 REM GOTO 10',
    );
  });

  it('leaves computed targets untouched', () => {
    expect(rewriteReferences('50 GOTO X+1', new Map([[10, 15]]))).toBe(
      '50 GOTO X+1',
    );
  });

  it('rewrites the Sinclair-spaced GO TO / GO SUB spellings', () => {
    expect(rewriteReferences('20 GO TO 10', new Map([[10, 15]]))).toBe(
      '20 GO TO 15',
    );
    expect(rewriteReferences('20 GO SUB 10', new Map([[10, 15]]))).toBe(
      '20 GO SUB 15',
    );
  });

  it('rewrites THEN / ELSE line targets but not statements', () => {
    expect(rewriteReferences('20 IF A=1 THEN 10', new Map([[10, 15]]))).toBe(
      '20 IF A=1 THEN 15',
    );
    expect(
      rewriteReferences('20 IF A=1 THEN 10 ELSE 30', new Map([[10, 15]])),
    ).toBe('20 IF A=1 THEN 15 ELSE 30');
    expect(
      rewriteReferences('20 IF A=1 THEN PRINT 10', new Map([[10, 15]])),
    ).toBe('20 IF A=1 THEN PRINT 10');
  });

  it('rewrites RESTORE targets', () => {
    expect(rewriteReferences('20 RESTORE 10', new Map([[10, 15]]))).toBe(
      '20 RESTORE 15',
    );
  });

  it('rewrites every target in an ON X GOTO / GOSUB list', () => {
    expect(
      rewriteReferences(
        '20 ON X GOTO 10, 30 ,40',
        new Map([
          [10, 15],
          [30, 35],
          [40, 45],
        ]),
      ),
    ).toBe('20 ON X GOTO 15, 35 ,45');
    expect(rewriteReferences('20 ON X GOSUB 10,30', new Map([[30, 35]]))).toBe(
      '20 ON X GOSUB 10,35',
    );
  });
});

describe('renumberProgram', () => {
  it('renumbers to start + increment steps and remaps references', () => {
    const src = '5 PRINT\n15 GOTO 5\n17 GOSUB 15';
    expect(renumberProgram(src, 10, 10)).toBe(
      '10 PRINT\n20 GOTO 10\n30 GOSUB 20',
    );
  });

  it('follows a custom increment', () => {
    const src = '5 PRINT\n15 GOTO 5';
    expect(renumberProgram(src, 5, 5)).toBe('5 PRINT\n10 GOTO 5');
  });

  it('remaps ON X GOTO lists across the whole file', () => {
    const src = '5 ON X GOTO 15,25\n15 PRINT\n25 PRINT';
    expect(renumberProgram(src, 10, 10)).toBe(
      '10 ON X GOTO 20,30\n20 PRINT\n30 PRINT',
    );
  });

  it('returns the source unchanged for an empty program', () => {
    expect(renumberProgram('', 10, 10)).toBe('');
    expect(renumberProgram('   \n\n', 10, 10)).toBe('   \n\n');
  });

  it('returns null when the highest number would exceed MAX_LINE_NO', () => {
    // Start at the ceiling so a second line already overflows, whatever the
    // dialect's MAX_LINE_NO happens to be.
    expect(renumberProgram('1 A\n2 B', MAX_LINE_NO, 10)).toBeNull();
  });

  it('numbers text lines that lacked a line number', () => {
    const src = '10 PRINT\nPRINT "HI"\n20 GOTO 10';
    expect(renumberProgram(src, 10, 10)).toBe(
      '10 PRINT\n20 PRINT "HI"\n30 GOTO 10',
    );
  });

  it('drops blank lines but keeps unnumbered text lines', () => {
    const src = '10 A\n\nB\n20 C';
    expect(renumberProgram(src, 10, 10)).toBe('10 A\n20 B\n30 C');
  });

  it('remaps references when an unnumbered line shifts a target', () => {
    // The unnumbered line takes slot 20, pushing old 20 to 30; GOTO 20 must
    // follow the old line to its new number (30), not the freshly-numbered line.
    const src = '10 GOTO 20\nPRINT\n20 END';
    expect(renumberProgram(src, 10, 10)).toBe('10 GOTO 30\n20 PRINT\n30 END');
  });
});

describe('numberLineInPlace', () => {
  it('numbers an unnumbered line between its neighbours', () => {
    const r = numberLineInPlace(['10 A', 'B', '20 C'], 1, 10)!;
    expect(r).toEqual({ lines: ['10 A', '15 B', '20 C'], lineNo: 15 });
  });

  it('appends after the last line at end of file', () => {
    const r = numberLineInPlace(['10 A', 'B'], 1, 10)!;
    expect(r).toEqual({ lines: ['10 A', '20 B'], lineNo: 20 });
  });

  it('cascades following lines and rewrites references when there is no gap', () => {
    const r = numberLineInPlace(['10 A', 'B', '11 GOTO 11'], 1, 10)!;
    expect(r).toEqual({
      lines: ['10 A', '11 B', '12 GOTO 12'],
      lineNo: 11,
    });
  });

  it('bootstraps the first line of a file', () => {
    const r = numberLineInPlace(['PRINT "HI"'], 0, 10)!;
    expect(r).toEqual({ lines: ['10 PRINT "HI"'], lineNo: 10 });
  });

  it('leaves an already-numbered line untouched', () => {
    const r = numberLineInPlace(['10 A', '20 B'], 1, 10)!;
    expect(r).toEqual({ lines: ['10 A', '20 B'], lineNo: 20 });
  });

  it('returns null for a blank line', () => {
    expect(numberLineInPlace(['10 A', '', '20 B'], 1, 10)).toBeNull();
  });
});

describe('applyRenumberMap', () => {
  it('applies a cascade without double-applying', () => {
    const src = '10 A\n12 GOTO 13\n13 GOTO 12';
    const result = applyRenumberMap(
      src,
      new Map([
        [12, 13],
        [13, 14],
      ]),
    );
    expect(result).toBe('10 A\n13 GOTO 14\n14 GOTO 13');
  });
});

describe('renumberLine', () => {
  it('renames a line and rewrites references, re-sorting ascending', () => {
    const src = '10 PRINT\n20 GOTO 10\n30 GOSUB 10';
    expect(renumberLine(src, 10, 25)).toBe('20 GOTO 25\n25 PRINT\n30 GOSUB 25');
  });

  it('is a no-op when the target equals the source', () => {
    expect(renumberLine('10 PRINT', 10, 10)).toBe('10 PRINT');
  });
});

describe('insertNumberedLineBelow', () => {
  it('numbers the first line of an empty file and adds the next line', () => {
    const r = insertNumberedLineBelow(['PRINT "HI"'], 0, 10)!;
    expect(r.lines).toEqual(['10 PRINT "HI"', '20 ']);
    expect(r.cursorLine).toBe(1);
  });

  it('appends with the increment at the end of file', () => {
    const r = insertNumberedLineBelow(['10 PRINT', '20 PRINT'], 1, 10)!;
    expect(r.lines).toEqual(['10 PRINT', '20 PRINT', '30 ']);
  });

  it('uses a midpoint between interior lines', () => {
    const r = insertNumberedLineBelow(['10 PRINT', '15 PRINT'], 0, 10)!;
    expect(r.lines).toEqual(['10 PRINT', '12 ', '15 PRINT']);
    expect(r.cursorLine).toBe(1);
  });

  it('cascades adjacent lines and fixes references when there is no gap', () => {
    const r = insertNumberedLineBelow(['12 PRINT', '13 GOTO 12'], 0, 10)!;
    expect(r.lines).toEqual(['12 PRINT', '13 ', '14 GOTO 12']);
  });

  it('respects a custom increment', () => {
    const r = insertNumberedLineBelow(['100 PRINT'], 0, 100)!;
    expect(r.lines).toEqual(['100 PRINT', '200 ']);
  });

  it('skips a blank current line', () => {
    expect(insertNumberedLineBelow([''], 0, 10)).toBeNull();
  });
});

describe('makeSpaceN', () => {
  it('returns an empty map when enough room already exists', () => {
    const lines = parseLines('10 PRINT\n20 PRINT');
    expect(makeSpaceN(lines, 10, 2)!.size).toBe(0);
  });

  it('cascades the run of colliding lines up by the reserved count', () => {
    const lines = parseLines('10 A\n11 B\n12 C\n40 D');
    const map = makeSpaceN(lines, 10, 2);
    // Reserve slots 11 and 12: 11→13, 12→14, then 40 already clears.
    expect([...map!.entries()]).toEqual([
      [11, 13],
      [12, 14],
    ]);
  });

  it('returns null when the cascade would overflow', () => {
    const lines = parseLines(
      `${MAX_LINE_NO - 2} A\n${MAX_LINE_NO - 1} B\n${MAX_LINE_NO} C`,
    );
    expect(makeSpaceN(lines, MAX_LINE_NO - 2, 2)).toBeNull();
  });
});

describe('planConstructNumbering', () => {
  it('numbers continuation lines by the increment at the end of file', () => {
    const plan = planConstructNumbering(['10 FOR'], 0, 10, 2)!;
    expect(plan.currentLineNo).toBeNull();
    expect(plan.continuationNos).toEqual([20, 30]);
    expect(plan.cascade.size).toBe(0);
  });

  it('bootstraps a number for an unnumbered current line', () => {
    const plan = planConstructNumbering(['FOR'], 0, 10, 2)!;
    expect(plan.currentLineNo).toBe(10);
    expect(plan.continuationNos).toEqual([20, 30]);
  });

  it('falls back to unit spacing and cascades when the gap is tight', () => {
    const plan = planConstructNumbering(['10 FOR', '11 PRINT'], 0, 10, 2)!;
    expect(plan.continuationNos).toEqual([11, 12]);
    // 11 must move up past the two reserved slots.
    expect([...plan.cascade.entries()]).toEqual([[11, 13]]);
  });

  it('uses unit spacing without a cascade when a small gap suffices', () => {
    const plan = planConstructNumbering(['10 FOR', '20 PRINT'], 0, 10, 2)!;
    expect(plan.continuationNos).toEqual([11, 12]);
    expect(plan.cascade.size).toBe(0);
  });

  it('returns an empty plan when no continuation lines are needed', () => {
    const plan = planConstructNumbering(['10 IF'], 0, 10, 0)!;
    expect(plan.continuationNos).toEqual([]);
  });
});

describe('#BIN directive lines', () => {
  // Records: lineNo BE, len LE, body, 0x76 - base64-encoded.
  // bin0: line 0; bin1a/bin1b: two distinct line-1 records.
  const bin0 = `#BIN ${b64([0x00, 0x00, 0x03, 0x00, 0xea, 0xcd, 0x76])}`;
  const bin1a = `#BIN ${b64([0x00, 0x01, 0x03, 0x00, 0xea, 0xaf, 0x76])}`;
  const bin1b = `#BIN ${b64([0x00, 0x01, 0x03, 0x00, 0xea, 0xc9, 0x76])}`;

  it('renumberProgram keeps directives in place, unrenumbered', () => {
    const src = [bin0, bin1a, bin1b, '2 CLS', '3 GOTO 2'].join('\n');
    expect(renumberProgram(src, 10, 10)).toBe(
      [bin0, bin1a, bin1b, '10 CLS', '20 GOTO 10'].join('\n'),
    );
  });

  it('rewriteReferences never touches a payload', () => {
    // This payload's base64 happens to contain "RUN" + digits patterns; the
    // simplest guarantee is that the whole line survives any remap verbatim.
    const line = `#BIN RUN9GoTo10AA==`;
    expect(
      rewriteReferences(
        line,
        new Map([
          [9, 99],
          [10, 100],
        ]),
      ),
    ).toBe(line);
  });

  it('renumberLine preserves directives, ordered by embedded number', () => {
    const src = [bin1a, '2 CLS', '3 STOP'].join('\n');
    expect(renumberLine(src, 3, 9000)).toBe(
      [bin1a, '2 CLS', '9000 STOP'].join('\n'),
    );
  });

  it('a directive sorts ahead of an equal-numbered text line', () => {
    // Text line 1 alongside a binary line 1: directive first, like the file.
    const src = [bin1a, '1 CLS', '2 STOP'].join('\n');
    expect(renumberLine(src, 2, 3)).toBe([bin1a, '1 CLS', '3 STOP'].join('\n'));
  });

  it('numberLineInPlace refuses to number a directive', () => {
    expect(numberLineInPlace([bin0], 0, 10)).toBeNull();
  });

  it('insertNumberedLineBelow falls back to a plain newline on a directive', () => {
    expect(insertNumberedLineBelow([bin0, '10 CLS'], 0, 10)).toBeNull();
  });

  it('planConstructNumbering refuses a directive line', () => {
    expect(planConstructNumbering([bin0, '10 FOR'], 0, 10, 2)).toBeNull();
  });
});

/**
 * Lines a dialect takes without a line number, the Apple I's prompt commands
 * being the ones that exist. The predicate is a local stub rather than the real
 * dialect's: what is under test is that these functions honour whatever they
 * are given, and this module has no business knowing any machine's syntax.
 */
describe('lines the dialect takes unnumbered', () => {
  const keep = (line: string) =>
    /^\s*(SCR|CLR|OFF|RUN|LIST|DEL|AUTO|LOMEM=|HIMEM=)\b/i.test(line.trim());

  it('renumberProgram leaves a preamble and a trailing RUN in place', () => {
    const src = ['SCR', 'LOMEM=768', '5 CLS', '7 STOP', 'RUN'].join('\n');
    expect(renumberProgram(src, 10, 10, keep)).toBe(
      ['SCR', 'LOMEM=768', '10 CLS', '20 STOP', 'RUN'].join('\n'),
    );
  });

  /**
   * A kept line keeps its text but not its stale references: `RUN 5` names a
   * line that renumbering moved, and a listing that still said 5 afterwards
   * would start somewhere else.
   */
  it('renumberProgram still rewrites the references a kept line carries', () => {
    const src = ['5 CLS', '7 STOP', 'RUN 5'].join('\n');
    expect(renumberProgram(src, 10, 10, keep)).toBe(
      ['10 CLS', '20 STOP', 'RUN 10'].join('\n'),
    );
  });

  it('renumberLine keeps a preamble above the program and RUN below it', () => {
    const src = ['LOMEM=768', '2 CLS', '3 STOP', 'RUN'].join('\n');
    expect(renumberLine(src, 3, 9000, keep)).toBe(
      ['LOMEM=768', '2 CLS', '9000 STOP', 'RUN'].join('\n'),
    );
  });

  it('a preamble rides with the line it sits above', () => {
    // The preamble anchors to line 2; renumbering 2 to 50 carries it along
    // rather than stranding it below the line that used to follow it.
    const src = ['SCR', '2 CLS', '3 STOP'].join('\n');
    expect(renumberLine(src, 2, 50, keep)).toBe(
      ['3 STOP', 'SCR', '50 CLS'].join('\n'),
    );
  });

  it('applyRenumberMap carries them through a shift', () => {
    const src = ['SCR', '10 CLS', '20 GOTO 10', 'RUN'].join('\n');
    expect(applyRenumberMap(src, new Map([[20, 30]]), keep)).toBe(
      ['SCR', '10 CLS', '30 GOTO 10', 'RUN'].join('\n'),
    );
  });

  it('numberLineInPlace refuses to number one', () => {
    expect(numberLineInPlace(['LOMEM=768'], 0, 10, keep)).toBeNull();
  });

  it('insertNumberedLineBelow falls back to a plain newline on one', () => {
    expect(insertNumberedLineBelow(['SCR', '10 CLS'], 0, 10, keep)).toBeNull();
  });

  it('planConstructNumbering refuses one', () => {
    expect(
      planConstructNumbering(['RUN', '10 FOR'], 0, 10, 2, keep),
    ).toBeNull();
  });

  /**
   * The cross-dialect guarantee. With no predicate - which is every machine
   * whose source is numbered lines and nothing else - the same text is numbered
   * exactly as it always was, so a ZX81 user typing `PRINT 1` on row 1 still
   * gets a line number for it.
   */
  it('numbers the very same lines when no predicate is given', () => {
    const src = ['SCR', 'LOMEM=768', '5 CLS'].join('\n');
    expect(renumberProgram(src, 10, 10)).toBe(
      ['10 SCR', '20 LOMEM=768', '30 CLS'].join('\n'),
    );
    expect(numberLineInPlace(['RUN'], 0, 10)).toEqual({
      lines: ['10 RUN'],
      lineNo: 10,
    });
    expect(insertNumberedLineBelow(['SCR'], 0, 10)).not.toBeNull();
    expect(planConstructNumbering(['RUN', '10 FOR'], 0, 10, 2)).not.toBeNull();
  });
});
