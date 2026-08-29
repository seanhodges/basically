import { describe, expect, it } from 'vitest';
import { cpc664 } from './index';
import { cpc464 } from '../cpc464';
import { cpc6128 } from '../cpc6128';
import { cpc664Keywords } from './keywords';

/**
 * The 664 delegates its whole language layer to the 464 behind the same BASIC
 * variant seam the 6128 uses, so the delta worth testing here is not the
 * keyword list a second time - `cpc6128.test.ts` already pins what 1.1 adds -
 * but that this machine really is the 6128's language on the 464's hardware:
 * identical bytes out of the tokenizer, and its own ROM, model and containers.
 */

/** Source using only keywords all three CPCs have. */
const SHARED = [
  '10 MODE 1',
  '20 INK 1,24',
  '30 FOR I=1 TO 10',
  '40 PRINT "HELLO";I',
  '50 NEXT I',
  '60 PLOT 100,100:DRAW 500,300',
  '70 IF I>1 THEN GOTO 30',
  '80 END',
  '',
].join('\n');

/** One line per BASIC 1.1 addition, in a form the tokenizer will accept. */
const USES_11 = [
  '10 CLEAR INPUT',
  '10 A$=COPYCHR$(#0)',
  '10 CURSOR 1,1',
  '10 PRINT DEC$(1,"##")',
  '10 PRINT DERR',
  '10 FILL 3',
  '10 FRAME',
  '10 GRAPHICS PAPER 1',
  '10 GRAPHICS PEN 2',
  '10 MASK 170',
  '10 ON BREAK CONT',
];

describe('cpc664 dialect', () => {
  it('offers exactly the 6128 keyword table - 1.1 shipped on this machine first', () => {
    expect(cpc664Keywords).toEqual(cpc6128.keywords);
  });

  it('tokenizes BASIC 1.1 the 464 rejects, byte-for-byte as the 6128 does', () => {
    for (const line of USES_11) {
      const source = `${line}\n`;
      const on664 = cpc664.tokenize(source);
      expect(on664.errors, line).toEqual([]);
      expect(Array.from(on664.programBytes), line).toEqual(
        Array.from(cpc6128.tokenize(source).programBytes),
      );
      expect(cpc664.detokenize(on664.image), line).toBe(source);
    }
    // The 464 is the machine that cannot have these.
    expect(cpc464.lint('10 FRAME\n').length).toBeGreaterThan(0);
  });

  it('round-trips shared BASIC 1.0 source identically to the 464', () => {
    const on664 = cpc664.tokenize(SHARED);
    const on464 = cpc464.tokenize(SHARED);
    expect(on664.errors).toEqual([]);
    expect(Array.from(on664.programBytes)).toEqual(
      Array.from(on464.programBytes),
    );
    expect(cpc664.detokenize(on664.image)).toBe(SHARED);
  });

  it('is a 64K machine with its own firmware, not the 6128 under another name', () => {
    expect(cpc664.romUrl).toContain('cpc664.rom');
    expect(cpc664.romUrl).not.toBe(cpc6128.romUrl);
    // 64K flat, like the 464: the disc drive is what the 664 added, not memory.
    expect(cpc664.programRamBytes).toBe(cpc464.programRamBytes);
    expect(cpc664.memoryBlocks).toBe(cpc464.memoryBlocks);
  });

  it('exports the same tape and disc containers as the 464', () => {
    expect(cpc664.buildTargets.map((t) => t.fileExtension)).toEqual(
      cpc464.buildTargets.map((t) => t.fileExtension),
    );
    // Target ids are per-dialect so the three machines' exports stay distinct.
    for (const t of cpc664.buildTargets) expect(t.id).toMatch(/^cpc664-/);
  });

  it('lints every statement on a line, not just the first', () => {
    const errors = cpc664.lint('10 PRINT 1:SIN(1)\n');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.fatal).toBe(false);
    expect(errors[0]!.message).toContain('SIN');
    expect(cpc664.lint('10 MODE 1:FRAME\n')).toEqual([]);
  });
});
