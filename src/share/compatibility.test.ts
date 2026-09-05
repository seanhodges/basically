import { describe, expect, it } from 'vitest';
import { computeCompatibleDialects } from './compatibility';
import { dialects } from '../dialects/registry';
import type { Dialect, Block } from '../dialects/types';

/** A block, for exercising the block-aware compatibility gate. */
const aBlock: Block = {
  id: 'b1',
  name: 'code',
  address: 0x8000,
  bytes: new Uint8Array([0]),
  kind: 'code',
};

/**
 * Two stub dialects that both tokenize cleanly - one declaring
 * `memoryBlocks`, one not - so the block gate can be tested in isolation from
 * the real registry (where every dialect happens to support blocks).
 */
const stubDialects = [
  { id: 'withblocks', tokenize: () => ({ errors: [] }), memoryBlocks: {} },
  { id: 'noblocks', tokenize: () => ({ errors: [] }), memoryBlocks: undefined },
] as unknown as Dialect[];

describe('computeCompatibleDialects', () => {
  it('returns every machine but the GE-235 for a lowest-common-denominator program', () => {
    // There is no program every registered machine accepts, and the two ends of
    // the registry are why. Dartmouth BASIC requires END as the last line - its
    // compiler refuses a program without one - and Sinclair BASIC has no END at
    // all, using STOP instead. So the classic PRINT/GOTO pair reaches every
    // machine except the GE-235, and adding the END it wants loses the four
    // Sinclairs. Asserted both ways below, because the shape of the gap is the
    // fact worth keeping.
    expect(computeCompatibleDialects('10 PRINT "HI"\n20 GOTO 10')).toEqual(
      dialects.map((d) => d.id).filter((id) => id !== 'ge235'),
    );
    const withEnd = computeCompatibleDialects(
      '10 PRINT "HI"\n20 GOTO 10\n30 END',
    );
    expect(withEnd).toContain('ge235');
    expect(withEnd).not.toContain('zx81');
  });

  it('keeps ZX81-specific keywords off the other Sinclair machines', () => {
    // FAST/SLOW/UNPLOT are ZX81-only in the Sinclair family. The 6502-era
    // tokenizers are permissive at tokenize time (unknown words become runtime
    // errors, not tokenize errors), so this asserts the strict exclusions only.
    const ids = computeCompatibleDialects('10 FAST\n20 UNPLOT 0,0\n30 SLOW');
    expect(ids).toContain('zx81');
    expect(ids).not.toContain('zx80');
    expect(ids).not.toContain('zxspectrum');
    expect(ids).not.toContain('zxspectrum128');
  });

  it('drops machines whose tokenizer rejects the source', () => {
    // Lowercase long variable names tokenize on the 6502-era machines but not
    // on the Sinclair ones.
    const ids = computeCompatibleDialects('10 total = 42\n20 PRINT total');
    expect(ids).toContain('bbcmicro');
    expect(ids).not.toContain('zx81');
  });

  it('ignores the block gate when the document has no blocks', () => {
    expect(
      computeCompatibleDialects('10 PRINT "HI"', [], stubDialects),
    ).toEqual(['withblocks', 'noblocks']);
  });

  it('requires memoryBlocks support once the document has blocks', () => {
    expect(
      computeCompatibleDialects('10 PRINT "HI"', [aBlock], stubDialects),
    ).toEqual(['withblocks']);
  });
});
