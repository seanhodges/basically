import { describe, expect, it } from 'vitest';
import { extractCodeBlocks, mergeBasicLines } from './codeExtractor';
import { bytesToBase64 } from '../storage/vfs/base64';

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
});
