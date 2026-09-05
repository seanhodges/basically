import { describe, expect, it } from 'vitest';
import {
  candidateProgram,
  classifyBlock,
  extractCodeBlocks,
  extractExpectations,
  isApplicableBlock,
  isProtocolBlock,
  mergeBasicLines,
  mergePlan,
  type CodeBlock,
  extractJudgement,
  extractScreenViews,
} from './codeExtractor';
import { bytesToBase64 } from '../storage/vfs/base64';

/** A source listing of `count` lines numbered 10, 20, 30… */
const listing = (count: number, from = 1) =>
  Array.from({ length: count }, (_, i) => `${(from + i) * 10} PRINT ${i}`).join(
    '\n',
  ) + '\n';

const block = (code: string, declared?: 'full' | 'partial'): CodeBlock => ({
  code,
  language: 'basic',
  ...(declared ? { declared } : {}),
});

const b64 = (bytes: number[]) => bytesToBase64(Uint8Array.from(bytes));

describe('extractCodeBlocks', () => {
  it('extracts fenced blocks with language', () => {
    const md = 'Here you go:\n```basic\n10 PRINT "HI"\n20 GOTO 10\n```\nEnjoy!';
    const blocks = extractCodeBlocks(md);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.language).toBe('basic');
    expect(blocks[0]!.code).toBe('10 PRINT "HI"\n20 GOTO 10');
  });

  it('handles unterminated (still streaming) fences', () => {
    const md = '```basic\n10 PRINT "PART';
    const blocks = extractCodeBlocks(md);
    expect(blocks.length).toBe(1);
    expect(blocks[0]!.code).toContain('PART');
  });

  it('extracts multiple blocks', () => {
    const md = '```basic\n10 CLS\n```\ntext\n```basic\n20 CLS\n```';
    expect(extractCodeBlocks(md).length).toBe(2);
  });

  describe('fence tag declares the kind', () => {
    const declaredOf = (md: string) => extractCodeBlocks(md)[0]!.declared;

    it('reads ```basic as a whole listing', () => {
      expect(declaredOf('```basic\n10 CLS\n```')).toBe('full');
    });

    it('reads ```basic-partial as a fragment', () => {
      expect(declaredOf('```basic-partial\n20 CLS\n```')).toBe('partial');
    });

    it('declares nothing for an untagged fence', () => {
      // The `basic` language default must not read as a declaration.
      const blocks = extractCodeBlocks('```\n10 CLS\n```');
      expect(blocks[0]!.language).toBe('basic');
      expect(blocks[0]!.declared).toBeUndefined();
    });

    it('declares nothing for an unrelated tag', () => {
      expect(declaredOf('```text\n10 CLS\n```')).toBeUndefined();
    });
  });
});

describe('classifyBlock', () => {
  it('calls anything a whole listing when the editor is empty', () => {
    expect(classifyBlock(block('10 CLS\n', 'partial'), '')).toBe('full');
  });

  it('recognises a fragment that starts after the program does', () => {
    const source = listing(40);
    expect(classifyBlock(block('60 PRINT "X"\n'), source)).toBe('partial');
  });

  it('recognises a listing that starts at the top and covers the program', () => {
    const source = listing(40);
    expect(classifyBlock(block(source), source)).toBe('full');
  });

  // The case a subset test gets wrong: a rewrite that shrinks 40 lines to 12
  // has a line-number set that is a subset of the program's, exactly like a
  // genuine fragment. Merging it would resurrect all 28 dropped lines.
  it('does not call a shrinking full rewrite a fragment', () => {
    const source = listing(40);
    const rewrite = listing(12);
    expect(classifyBlock(block(rewrite, 'full'), source)).toBe('full');
    // Even undeclared, the heuristic must not assert `partial` here.
    expect(classifyBlock(block(rewrite), source)).not.toBe('partial');
  });

  it('lets the declaration decide when the line numbers are inconclusive', () => {
    const source = listing(40);
    const rewrite = listing(12);
    expect(classifyBlock(block(rewrite, 'partial'), source)).toBe('partial');
    expect(classifyBlock(block(rewrite, 'full'), source)).toBe('full');
  });

  it('resolves to unknown when a declaration contradicts the line numbers', () => {
    const source = listing(40);
    // Claims to be the whole program, but has no beginning - the case that
    // wipes the program if Replace is offered.
    expect(classifyBlock(block('60 PRINT "X"\n', 'full'), source)).toBe(
      'unknown',
    );
    // Claims to be a fragment, but is plainly the whole listing.
    expect(classifyBlock(block(source, 'partial'), source)).toBe('unknown');
  });

  it('resolves to unknown with no declaration and inconclusive numbers', () => {
    expect(classifyBlock(block(listing(12)), listing(40))).toBe('unknown');
  });

  it('resolves to unknown when the block has no numbered lines', () => {
    expect(classifyBlock(block('PRINT "HI"\n'), listing(40))).toBe('unknown');
  });
});

describe('mergeBasicLines', () => {
  it('replaces matching line numbers and inserts new ones in order', () => {
    const existing = '10 PRINT "A"\n20 GOTO 10\n';
    const fragment = '15 PRINT "B"\n20 GOTO 15\n';
    expect(mergeBasicLines(existing, fragment)).toBe(
      '10 PRINT "A"\n15 PRINT "B"\n20 GOTO 15\n',
    );
  });

  it('ignores non-numbered junk lines in the fragment', () => {
    const merged = mergeBasicLines('10 CLS\n', 'note:\n20 PRINT "X"\n');
    expect(merged).toBe('10 CLS\n20 PRINT "X"\n');
  });

  describe('#BIN directive lines', () => {
    // Records: lineNo BE, len LE, body, 0x76 - two distinct line-1 payloads
    // and a line-0 payload, as real machine-code .P imports produce.
    const bin0 = `#BIN ${b64([0x00, 0x00, 0x03, 0x00, 0xea, 0xcd, 0x76])}`;
    const bin1a = `#BIN ${b64([0x00, 0x01, 0x03, 0x00, 0xea, 0xaf, 0x76])}`;
    const bin1b = `#BIN ${b64([0x00, 0x01, 0x03, 0x00, 0xea, 0xc9, 0x76])}`;

    it('preserves existing directives in embedded-number order', () => {
      const existing =
        [bin0, bin1a, bin1b, '2 CLS', '3 STOP'].join('\n') + '\n';
      const merged = mergeBasicLines(existing, '3 GOTO 2\n');
      expect(merged).toBe(
        [bin0, bin1a, bin1b, '2 CLS', '3 GOTO 2'].join('\n') + '\n',
      );
    });

    it('does not duplicate directives echoed back by the model', () => {
      const existing = [bin0, '2 CLS'].join('\n') + '\n';
      const fragment = [bin0, '2 CLS', '3 STOP'].join('\n') + '\n';
      expect(mergeBasicLines(existing, fragment)).toBe(
        [bin0, '2 CLS', '3 STOP'].join('\n') + '\n',
      );
    });

    it('keeps fragment directives when the existing source has none', () => {
      const merged = mergeBasicLines('', [bin0, '2 CLS'].join('\n') + '\n');
      expect(merged).toBe([bin0, '2 CLS'].join('\n') + '\n');
    });

    it('orders a directive ahead of an equal-numbered text line', () => {
      const existing = [bin1a, '1 CLS'].join('\n') + '\n';
      expect(mergeBasicLines(existing, '2 STOP\n')).toBe(
        [bin1a, '1 CLS', '2 STOP'].join('\n') + '\n',
      );
    });
  });

  describe('deleting with a bare line number', () => {
    const existing = '10 CLS\n20 PAUSE 50\n30 STOP\n';

    it('removes the line when merging a fragment', () => {
      expect(mergeBasicLines(existing, '20\n', { allowDeletes: true })).toBe(
        '10 CLS\n30 STOP\n',
      );
    });

    it('leaves every other line untouched', () => {
      expect(
        mergeBasicLines(existing, '20\n30 GOTO 10\n', { allowDeletes: true }),
      ).toBe('10 CLS\n30 GOTO 10\n');
    });

    it('does not delete from a whole listing', () => {
      // A stray bare number in a full listing must not destroy a line.
      const merged = mergeBasicLines(existing, '20\n');
      expect(merged).toContain('20');
      expect(merged.split('\n').filter(Boolean).length).toBe(3);
    });

    it('ignores a delete for a line that is not there', () => {
      expect(mergeBasicLines(existing, '99\n', { allowDeletes: true })).toBe(
        existing,
      );
    });

    it('leaves an empty program when every line is deleted', () => {
      expect(
        mergeBasicLines(existing, '10\n20\n30\n', { allowDeletes: true }),
      ).toBe('');
    });

    it('cannot reach a #BIN record', () => {
      const bin1 = `#BIN ${b64([0x00, 0x01, 0x03, 0x00, 0xea, 0xaf, 0x76])}`;
      const withBin = [bin1, '1 CLS', '2 STOP'].join('\n') + '\n';
      // Line 1 is both a directive's embedded number and a text line; the
      // delete takes the text line and leaves the record alone.
      expect(mergeBasicLines(withBin, '1\n', { allowDeletes: true })).toBe(
        [bin1, '2 STOP'].join('\n') + '\n',
      );
    });
  });
});

describe('mergePlan', () => {
  const existing = '10 CLS\n20 PAUSE 50\n30 STOP\n';

  it('reports each kind of change', () => {
    const plan = mergePlan(existing, '20 PAUSE 10\n25 BEEP\n30\n', {
      allowDeletes: true,
    });
    expect(plan).toEqual([
      { kind: 'context', lineNo: 10, text: '10 CLS', before: '10 CLS' },
      {
        kind: 'changed',
        lineNo: 20,
        text: '20 PAUSE 10',
        before: '20 PAUSE 50',
      },
      { kind: 'added', lineNo: 25, text: '25 BEEP' },
      { kind: 'removed', lineNo: 30, before: '30 STOP' },
    ]);
  });

  it('reports no changes for a fragment that changes nothing', () => {
    const plan = mergePlan(existing, '20 PAUSE 50\n', { allowDeletes: true });
    expect(plan.every((row) => row.kind === 'context')).toBe(true);
  });

  it('shows #BIN records as context and never as changes', () => {
    const bin0 = `#BIN ${b64([0x00, 0x00, 0x03, 0x00, 0xea, 0xcd, 0x76])}`;
    const withBin = [bin0, '2 CLS'].join('\n') + '\n';
    const plan = mergePlan(withBin, '3 STOP\n', { allowDeletes: true });
    const binRows = plan.filter((row) => row.text === bin0);
    expect(binRows).toEqual([{ kind: 'context', lineNo: 0, text: bin0 }]);
  });

  // The preview is built from the plan, so this pins the two together: if
  // mergeBasicLines is ever reimplemented independently they must still agree.
  it('reproduces the merged text when applied', () => {
    const cases: Array<[string, string]> = [
      [existing, '20 PAUSE 10\n25 BEEP\n30\n'],
      [existing, '5 REM TOP\n'],
      [existing, '10\n20\n30\n'],
      ['', '10 CLS\n'],
      [existing, ''],
    ];
    for (const [before, fragment] of cases) {
      const rows = mergePlan(before, fragment, { allowDeletes: true });
      const applied = rows
        .filter((row) => row.kind !== 'removed')
        .map((row) => row.text!);
      const expected = applied.length === 0 ? '' : applied.join('\n') + '\n';
      expect(mergeBasicLines(before, fragment, { allowDeletes: true })).toBe(
        expected,
      );
    }
  });
});

describe('expectation blocks', () => {
  const reply = [
    'Here is the program:',
    '',
    '```basic',
    '10 LET T=6*7',
    '20 PRINT T',
    '```',
    '',
    'It should end with:',
    '',
    '```basic-expect',
    'VAR T = 42',
    'SCREEN CONTAINS "42"',
    '```',
  ].join('\n');

  it('marks the block without declaring a kind', () => {
    const blocks = extractCodeBlocks(reply);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ declared: 'full' });
    expect(blocks[0]!.expectations).toBeUndefined();
    expect(blocks[1]!.expectations).toBe(true);
    // The whole point: it declares nothing, so nothing can resolve it to a
    // listing or a fragment.
    expect(blocks[1]!.declared).toBeUndefined();
  });

  it('is never classified as a listing or a fragment it could replace', () => {
    const block = extractCodeBlocks(reply)[1]!;
    // classifyBlock only ever speaks about code; an expectation block must not
    // reach it, which is what isApplicableBlock guarantees.
    expect(isApplicableBlock(block)).toBe(false);
    expect(isApplicableBlock(extractCodeBlocks(reply)[0]!)).toBe(true);
  });

  it('is the IDE’s to read, not the user’s to look at', () => {
    const [code, expectations] = extractCodeBlocks(reply);
    expect(isProtocolBlock(expectations!)).toBe(true);
    // The answer itself still is theirs.
    expect(isProtocolBlock(code!)).toBe(false);
  });

  it('leaves only the code appliable when a reply carries both', () => {
    const appliable = extractCodeBlocks(reply).filter(isApplicableBlock);
    expect(appliable).toHaveLength(1);
    expect(appliable[0]!.code).toContain('10 LET T=6*7');
    expect(appliable[0]!.code).not.toContain('VAR T = 42');
  });

  it('picks the code even when the expectations come last', () => {
    // The failure this guards: "the last block" would be the expectations.
    const blocks = extractCodeBlocks(reply);
    const last = blocks[blocks.length - 1]!;
    expect(last.expectations).toBe(true);
    const applied = blocks.filter(isApplicableBlock).at(-1)!;
    expect(applied.code).toContain('20 PRINT T');
  });

  it('extracts the stated expectations from a whole reply', () => {
    // In the earlier spelling, which is still read: this reply could as
    // easily have come back out of a saved conversation.
    expect(extractExpectations(reply)).toEqual([
      {
        kind: 'expect',
        expectation: { kind: 'variable', name: 'T', value: '42' },
        line: 1,
        source: 'VAR T = 42',
      },
      {
        kind: 'expect',
        expectation: { kind: 'text', needle: '42', negated: false },
        line: 2,
        source: 'SCREEN CONTAINS "42"',
      },
    ]);
  });

  it('returns nothing for a reply that states none', () => {
    expect(extractExpectations('```basic\n10 PRINT 1\n```')).toEqual([]);
    expect(extractExpectations('just prose')).toEqual([]);
  });

  it('gathers expectations from more than one block', () => {
    const two = [
      '```basic-expect',
      'VAR A = 1',
      '```',
      'and',
      '```basic-expect',
      'VAR B = 2',
      '```',
    ].join('\n');
    expect(extractExpectations(two).map((e) => e.source)).toEqual([
      'VAR A = 1',
      'VAR B = 2',
    ]);
  });
});

describe('a verdict on a screen', () => {
  const reply =
    'Looking at it:\n\n```basic-judge\nPASS a circle\nFAIL there is no paddle\n```\n\n```basic\n10 PLOT 1,1\n```\n';

  it('is never offered for applying to the editor', () => {
    const [judge, code] = extractCodeBlocks(reply);
    expect(judge!.verdict).toBe(true);
    expect(isApplicableBlock(judge!)).toBe(false);
    // The program in the same reply still is.
    expect(isApplicableBlock(code!)).toBe(true);
  });

  it('is shown to the user, unlike the blocks the IDE addresses itself', () => {
    // A judgement that finds nothing wrong is nothing but this block, and the
    // IDE asked the question in the thread where the user can see it - so
    // hiding the answer would leave that question hanging.
    const [judge] = extractCodeBlocks(reply);
    expect(isProtocolBlock(judge!)).toBe(false);
  });

  it('is read back as verdicts, in order', () => {
    expect(extractJudgement(reply)).toEqual([
      { held: true, detail: 'a circle' },
      { held: false, detail: 'there is no paddle' },
    ]);
  });

  it('is empty when the reply carries none', () => {
    expect(extractJudgement('```basic\n10 PRINT\n```')).toEqual([]);
  });
});

describe('a request to be shown the screen', () => {
  const reply =
    'Here you go:\n\n```basic\n10 PLOT 1,1\n```\n\n```basic-view\nSCREEN IMAGE\n```\n';

  it('is never offered for applying to the editor', () => {
    const view = extractCodeBlocks(reply).find((b) => b.view === true);
    expect(view).toBeDefined();
    expect(isApplicableBlock(view!)).toBe(false);
  });

  it('is the IDE’s to read, not the user’s to look at', () => {
    const view = extractCodeBlocks(reply).find((b) => b.view === true);
    expect(isProtocolBlock(view!)).toBe(true);
  });

  it('is read back as the views the assistant asked for', () => {
    expect(extractScreenViews(reply)).toEqual({
      image: true,
      text: false,
      drive: false,
      unknown: [],
    });
  });

  it('asks for nothing when the reply names no views', () => {
    expect(extractScreenViews('```basic\n10 PRINT\n```')).toEqual({
      image: false,
      text: false,
      drive: false,
      unknown: [],
    });
  });
});

describe('candidateProgram', () => {
  const BASE = '10 CLS\n20 GOTO 10\n';
  const only = (markdown: string) => extractCodeBlocks(markdown)[0]!;

  it('takes a whole listing as it stands', () => {
    const block = only('```basic\n10 PRINT "A"\n20 PRINT "B"\n```');
    expect(candidateProgram(block, BASE)).toBe('10 PRINT "A"\n20 PRINT "B"\n');
  });

  it('resolves a fragment to the program it would land in', () => {
    const block = only('```basic-partial\n20 PRINT "X"\n```');
    // Not the one line the assistant wrote: the program that line makes.
    expect(candidateProgram(block, BASE)).toBe('10 CLS\n20 PRINT "X"\n');
  });

  it('refuses a block whose kind cannot be established', () => {
    // Declared whole, but its line numbers cover only part of the program - the
    // panel offers the user both actions rather than guessing, and a check with
    // nobody to ask must not guess either. Replacing a program with a fragment
    // discards every line the fragment did not mention, so the two readings are
    // not close enough to pick one.
    const block = only('```basic\n20 PRINT "X"\n```');
    expect(classifyBlock(block, BASE)).toBe('unknown');
    expect(candidateProgram(block, BASE)).toBeNull();
  });

  it('agrees with what the panel would apply', () => {
    const block = only('```basic-partial\n20 PRINT "X"\n```');
    // The check and the apply must never resolve a block differently, or the
    // user would be offered something other than what was verified.
    expect(candidateProgram(block, BASE)).toBe(
      mergeBasicLines(BASE, block.code, { allowDeletes: true }),
    );
  });
});

/**
 * Lines the machine takes without a line number - the Apple I's `SCR` /
 * `LOMEM=` preamble and a listing's trailing `RUN`.
 *
 * The merge is keyed by line number and these have none, so without carrying
 * them deliberately a fragment would take the user's preamble out of their
 * program. The key is a local stub: what is under test is that the merge
 * honours whatever it is handed.
 */
describe('lines the dialect takes unnumbered', () => {
  const unnumbered = (line: string): string | null => {
    const m = /^\s*(SCR|CLR|OFF|RUN|LIST|LOMEM=|HIMEM=)/i.exec(line.trim());
    return m ? m[1]!.toUpperCase() : null;
  };
  const PROGRAM = ['SCR', 'LOMEM=768', '10 A=1', '20 END', 'RUN'].join('\n');

  it('keeps them where they were through a partial merge', () => {
    expect(mergeBasicLines(PROGRAM, '10 A=2', { unnumbered })).toBe(
      ['SCR', 'LOMEM=768', '10 A=2', '20 END', 'RUN'].join('\n') + '\n',
    );
  });

  it('does not present them as changes', () => {
    const rows = mergePlan(PROGRAM, '10 A=2', { unnumbered });
    const carried = rows.filter((r) => unnumbered(r.text ?? '') !== null);
    expect(carried.map((r) => r.kind)).toEqual([
      'context',
      'context',
      'context',
    ]);
  });

  it('a bare line number cannot delete one', () => {
    const merged = mergeBasicLines(PROGRAM, '20', {
      allowDeletes: true,
      unnumbered,
    });
    expect(merged).toBe(
      ['SCR', 'LOMEM=768', '10 A=1', 'RUN'].join('\n') + '\n',
    );
  });

  it('does not double one the fragment repeats verbatim', () => {
    const merged = mergeBasicLines(PROGRAM, 'LOMEM=768\n10 A=2', {
      unnumbered,
    });
    expect(merged.split('\n').filter((l) => l === 'LOMEM=768')).toHaveLength(1);
  });

  it('shows a different value for the same command as a change', () => {
    const rows = mergePlan(PROGRAM, 'LOMEM=1024\n10 A=2', { unnumbered });
    const row = rows.find((r) => r.text === 'LOMEM=1024')!;
    expect(row.kind).toBe('changed');
    expect(row.before).toBe('LOMEM=768');
    expect(
      mergeBasicLines(PROGRAM, 'LOMEM=1024\n10 A=2', { unnumbered }),
    ).toContain('LOMEM=1024');
  });

  it('adds one the program did not hold', () => {
    const merged = mergeBasicLines('10 A=1', 'HIMEM=2048\n10 A=2', {
      unnumbered,
    });
    expect(merged).toBe(['HIMEM=2048', '10 A=2'].join('\n') + '\n');
  });

  /**
   * A program that is only a preamble is not an empty one: read as empty, any
   * block would classify as a whole listing and replace it outright, throwing
   * the preamble away.
   */
  it('a preamble-only program is not read as nothing to merge into', () => {
    const block = { code: '10 A=1', declared: 'partial' as const };
    expect(classifyBlock(block, 'SCR\nLOMEM=768', unnumbered)).not.toBe('full');
    expect(classifyBlock(block, 'SCR\nLOMEM=768')).toBe('full');
  });

  /** Every machine that has no such lines merges exactly as it did before. */
  it('changes nothing when no key is given', () => {
    expect(mergeBasicLines(PROGRAM, '10 A=2')).toBe(
      ['10 A=2', '20 END'].join('\n') + '\n',
    );
  });
});
