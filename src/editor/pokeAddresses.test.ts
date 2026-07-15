import { describe, it, expect } from 'vitest';
import { pokeAddresses } from './pokeAddresses';

describe('pokeAddresses', () => {
  it('extracts literal POKE addresses, sorted and de-duplicated', () => {
    const src = [
      '10 POKE 22528,2',
      '20 POKE 16384,255',
      '30 POKE 22528,4',
    ].join('\n');
    expect(pokeAddresses(src)).toEqual([16384, 22528]);
  });

  it('ignores POKE inside strings and REM comments', () => {
    const src = [
      '10 PRINT "POKE 5"',
      '20 REM POKE 6 does nothing',
      '30 POKE 23606,1',
    ].join('\n');
    expect(pokeAddresses(src)).toEqual([23606]);
  });

  it('skips computed (non-literal) POKE addresses', () => {
    const src = ['10 POKE X,1', '20 POKE A+1,2', '30 POKE 40000,3'].join('\n');
    expect(pokeAddresses(src)).toEqual([40000]);
  });

  it('is case-insensitive and tolerates spacing', () => {
    const src = ['10 poke16384,0', '20 Poke  32768 ,1'].join('\n');
    expect(pokeAddresses(src)).toEqual([16384, 32768]);
  });

  it('returns an empty list when there are no POKEs', () => {
    expect(pokeAddresses('10 PRINT "HELLO"\n20 GOTO 10')).toEqual([]);
  });
});
