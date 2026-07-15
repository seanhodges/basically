import { describe, it, expect } from 'vitest';
import { pokeAddresses, pokeSites } from './pokeAddresses';

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

  it('reports only bare literals as non-computed addresses', () => {
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

describe('pokeSites', () => {
  it('marks bare-literal addresses as non-computed', () => {
    const [site] = pokeSites('10 POKE 40000,1');
    expect(site).toEqual({
      address: 40000,
      expr: '40000',
      computed: false,
      lineNo: 10,
    });
  });

  it('resolves a variable assigned earlier', () => {
    const src = ['10 LET X=23296', '20 POKE X,1'].join('\n');
    expect(pokeSites(src)).toEqual([
      { address: 23296, expr: 'X', computed: true, lineNo: 20 },
    ]);
  });

  it('tracks assignments in line-number order, not physical order', () => {
    const src = ['20 POKE X,1', '10 LET X=16384'].join('\n');
    expect(pokeSites(src)).toEqual([
      { address: 16384, expr: 'X', computed: true, lineNo: 20 },
    ]);
  });

  it('resolves an arithmetic expression over known variables', () => {
    const src = ['10 A=100', '20 POKE A+1,2'].join('\n');
    expect(pokeSites(src).map((s) => s.address)).toEqual([101]);
  });

  it('uses the FOR start value for a POKE in the loop body', () => {
    const src = ['10 LET B=22528', '20 FOR I=0 TO 7', '30 POKE B+I,7'].join(
      '\n',
    );
    expect(pokeSites(src).map((s) => s.address)).toEqual([22528]);
  });

  it('rounds a fractional computed address', () => {
    const src = ['10 A=100', '20 POKE A/3,1'].join('\n');
    expect(pokeSites(src).map((s) => s.address)).toEqual([33]);
  });

  it('resolves a glued (crunched) POKE argument', () => {
    const src = ['10 LET A=16384', '20 POKEA,1'].join('\n');
    expect(pokeSites(src)).toEqual([
      { address: 16384, expr: 'A', computed: true, lineNo: 20 },
    ]);
  });

  it('resolves assignments within a multi-statement line', () => {
    expect(pokeSites('10 LET A=5:POKE A,1').map((s) => s.address)).toEqual([5]);
  });

  it('skips POKEs to an unknown variable', () => {
    expect(pokeSites('10 POKE Q,1')).toEqual([]);
  });

  it('does not treat IF <var>=<n> as an assignment', () => {
    const src = ['10 IF X=5 THEN PRINT 1', '20 POKE X,1'].join('\n');
    expect(pokeSites(src)).toEqual([]);
  });

  it('keeps string and numeric variables of the same letter distinct', () => {
    const src = ['10 LET A=100', '20 LET A$="hi"', '30 POKE A,1'].join('\n');
    expect(pokeSites(src).map((s) => s.address)).toEqual([100]);
  });

  it('forgets a variable reassigned to something unresolvable', () => {
    const src = ['10 LET A=100', '20 LET A=B', '30 POKE A,1'].join('\n');
    expect(pokeSites(src)).toEqual([]);
  });

  it('cannot resolve function-call addresses', () => {
    expect(pokeSites('10 POKE PEEK(16384),0')).toEqual([]);
  });
});

describe('pokeSites USR "letter" (user-defined graphics)', () => {
  const udgBase = 0xff58; // ZX Spectrum 48K default

  it('resolves POKE USR "a" to the UDG base when udgBase is given', () => {
    expect(pokeSites('10 POKE USR "a",255', { udgBase })).toEqual([
      { address: 0xff58, expr: '65368', computed: false, lineNo: 10 },
    ]);
  });

  it('steps 8 bytes per graphic letter', () => {
    const src = ['10 POKE USR "a",1', '20 POKE USR "b",1', '30 POKE USR "c",1'];
    expect(
      pokeSites(src.join('\n'), { udgBase }).map((s) => s.address),
    ).toEqual([0xff58, 0xff58 + 8, 0xff58 + 16]);
  });

  it('is case-insensitive and tolerates spacing and a glued USR"x"', () => {
    const src = ['10 POKE USR"A",1', '20 POKE  USR  "a" ,1'];
    expect(
      pokeSites(src.join('\n'), { udgBase }).map((s) => s.address),
    ).toEqual([0xff58, 0xff58]);
  });

  it('resolves USR "a" inside a larger address expression', () => {
    expect(
      pokeSites('10 POKE USR "a"+1,7', { udgBase }).map((s) => s.address),
    ).toEqual([0xff58 + 1]);
  });

  it('resolves USR "a" assigned to a variable, then POKEd', () => {
    const src = ['10 LET U=USR "c"', '20 POKE U,1'];
    expect(
      pokeSites(src.join('\n'), { udgBase }).map((s) => s.address),
    ).toEqual([0xff58 + 16]);
  });

  it('leaves POKE USR "a" unresolved when the machine has no UDGs', () => {
    expect(pokeSites('10 POKE USR "a",255')).toEqual([]);
  });

  it('does not resolve letters beyond the 21 UDGs (a-u)', () => {
    expect(pokeSites('10 POKE USR "v",1', { udgBase })).toEqual([]);
  });

  it('leaves numeric USR unresolved (its return value is runtime BC)', () => {
    expect(pokeSites('10 POKE USR 16384,1', { udgBase })).toEqual([]);
  });

  it('ignores USR "a" that only appears in a string or REM', () => {
    const src = ['10 PRINT "POKE USR ~a~"', '20 REM POKE USR "a",1'];
    // The tilde stand-ins avoid nested quotes; the point is no code POKE exists.
    expect(pokeSites(src.join('\n'), { udgBase })).toEqual([]);
  });

  it('does not rewrite USR when it is the tail of a longer name', () => {
    // AUSR is a variable, not a USR call; with AUSR unknown the POKE drops.
    expect(pokeSites('10 POKE AUSR "a",1', { udgBase })).toEqual([]);
  });
});
