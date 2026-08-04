import { describe, it, expect } from 'vitest';
import {
  buildContinuationRequest,
  readPartialProgram,
  splitAtLastCompleteLine,
  stitchContinuation,
} from './continuation';

describe('splitAtLastCompleteLine', () => {
  it('drops the fragment generation stopped in the middle of', () => {
    expect(splitAtLastCompleteLine('10 CLS\n20 PRINT "HAL')).toBe('10 CLS');
  });

  it('keeps every line when the text already ends on a boundary', () => {
    expect(splitAtLastCompleteLine('10 CLS\n20 PRINT "HI"\n')).toBe(
      '10 CLS\n20 PRINT "HI"',
    );
  });

  it('has nothing to keep when the first line never finished', () => {
    expect(splitAtLastCompleteLine('10 PRI')).toBe('');
  });
});

describe('readPartialProgram', () => {
  const cutOff = 'Here you go:\n\n```basic\n10 CLS\n20 PRINT "HAL';

  it('recovers the complete lines, the fence tag and the preamble', () => {
    const partial = readPartialProgram(cutOff);
    expect(partial).not.toBeNull();
    expect(partial!.code).toBe('10 CLS');
    expect(partial!.tag).toBe('basic');
    expect(partial!.preamble).toBe('Here you go:');
    // 20 never finished, so 10 is the line to resume after.
    expect(partial!.lastLineNumber).toBe(10);
  });

  it('is null when nothing survives the incomplete line', () => {
    expect(readPartialProgram('```basic\n10 CL')).toBeNull();
  });

  it('is null when the answer carries no program at all', () => {
    expect(
      readPartialProgram('I was about to write something when'),
    ).toBeNull();
  });
});

describe('buildContinuationRequest', () => {
  it('names the line to resume after, so the join lands on the same boundary', () => {
    const partial = readPartialProgram('```basic\n10 CLS\n20 LET A=1\n30 GOT')!;
    const req = buildContinuationRequest(partial);
    expect(req).toContain('line 20');
    expect(req).toContain('```basic');
    // Re-sending the whole program would be stitched onto itself.
    expect(req).toMatch(/do NOT repeat/i);
  });
});

describe('stitchContinuation', () => {
  const partial = readPartialProgram(
    'Here:\n\n```basic\n10 CLS\n20 PRINT "HAL',
  )!;

  it('joins the rest onto the partial as one block', () => {
    const joined = stitchContinuation(
      partial,
      '```basic\n20 PRINT "HELLO"\n30 GOTO 20\n```',
    );
    expect(joined).toBe(
      'Here:\n\n```basic\n10 CLS\n20 PRINT "HELLO"\n30 GOTO 20\n```',
    );
  });

  it('keeps the partial intact when the continuation adds nothing', () => {
    expect(stitchContinuation(partial, '```basic\n```')).toBe(
      'Here:\n\n```basic\n10 CLS\n```',
    );
  });

  it('drops a line the continuation restates, rather than duplicating it', () => {
    const twoLines = readPartialProgram('```basic\n10 CLS\n20 LET A=1\n30 PR')!;
    const joined = stitchContinuation(
      twoLines,
      // Restates 10 and 20 despite being asked not to.
      '```basic\n10 CLS\n20 LET A=1\n30 PRINT A\n```',
    );
    expect(joined).toBe('```basic\n10 CLS\n20 LET A=1\n30 PRINT A\n```');
  });

  it('preserves the declared kind, so a fragment stays a fragment', () => {
    const fragment = readPartialProgram(
      '```basic-partial\n30 PRINT "A"\n40 PR',
    )!;
    const joined = stitchContinuation(
      fragment,
      '```basic-partial\n40 PRINT "B"\n```',
    );
    expect(joined).toContain('```basic-partial');
    expect(joined).toContain('40 PRINT "B"');
  });

  it('survives a continuation that carried no block at all', () => {
    expect(stitchContinuation(partial, 'sorry, I have nothing to add')).toBe(
      'Here:\n\n```basic\n10 CLS\n```',
    );
  });
});
