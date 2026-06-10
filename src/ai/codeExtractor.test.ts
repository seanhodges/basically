import { describe, expect, it } from 'vitest';
import { extractCodeBlocks, mergeBasicLines } from './codeExtractor';

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
});
