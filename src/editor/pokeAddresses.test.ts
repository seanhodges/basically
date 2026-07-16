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
      approximate: false,
      lineNo: 10,
    });
  });

  it('resolves a variable assigned earlier', () => {
    const src = ['10 LET X=23296', '20 POKE X,1'].join('\n');
    expect(pokeSites(src)).toEqual([
      {
        address: 23296,
        expr: 'X',
        computed: true,
        approximate: false,
        lineNo: 20,
      },
    ]);
  });

  it('tracks assignments in line-number order, not physical order', () => {
    const src = ['20 POKE X,1', '10 LET X=16384'].join('\n');
    expect(pokeSites(src)).toEqual([
      {
        address: 16384,
        expr: 'X',
        computed: true,
        approximate: false,
        lineNo: 20,
      },
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

  it('resolves a range end from the FOR TO value', () => {
    const src = ['10 LET B=22528', '20 FOR I=0 TO 7', '30 POKE B+I,7'].join(
      '\n',
    );
    const [site] = pokeSites(src);
    expect(site!.address).toBe(22528);
    expect(site!.endAddress).toBe(22535);
  });

  it('gives no range for a POKE whose address does not vary', () => {
    const [site] = pokeSites('10 POKE 40000,1');
    expect(site!.address).toBe(40000);
    expect('endAddress' in site!).toBe(false);
  });

  it('gives no range when the FOR start and end resolve equal', () => {
    const src = ['10 LET B=22528', '20 FOR I=0 TO 0', '30 POKE B+I,7'].join(
      '\n',
    );
    const [site] = pokeSites(src);
    expect(site!.address).toBe(22528);
    expect(site!.endAddress).toBeUndefined();
  });

  it('gives no range when the FOR TO value is unknown', () => {
    const src = ['10 LET B=22528', '20 FOR I=1 TO N', '30 POKE B+I,7'].join(
      '\n',
    );
    const [site] = pokeSites(src);
    expect(site!.address).toBe(22529);
    expect(site!.endAddress).toBeUndefined();
  });

  it('resolves a descending range (STEP -1), end below start', () => {
    const src = [
      '10 LET B=22528',
      '20 FOR I=7 TO 0 STEP -1',
      '30 POKE B+I,7',
    ].join('\n');
    const [site] = pokeSites(src);
    expect(site!.address).toBe(22535);
    expect(site!.endAddress).toBe(22528);
  });

  it('clears the range when the loop variable is later reassigned', () => {
    const src = [
      '10 LET B=22528',
      '20 FOR I=0 TO 7',
      '30 LET I=3',
      '40 POKE B+I,7',
    ].join('\n');
    const [site] = pokeSites(src);
    expect(site!.address).toBe(22531);
    expect(site!.endAddress).toBeUndefined();
  });

  it('rounds a fractional computed address', () => {
    const src = ['10 A=100', '20 POKE A/3,1'].join('\n');
    expect(pokeSites(src).map((s) => s.address)).toEqual([33]);
  });

  it('resolves a glued (crunched) POKE argument', () => {
    const src = ['10 LET A=16384', '20 POKEA,1'].join('\n');
    expect(pokeSites(src)).toEqual([
      {
        address: 16384,
        expr: 'A',
        computed: true,
        approximate: false,
        lineNo: 20,
      },
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

describe('pokeSites approximate resolution', () => {
  it('seeds a single-valued constant defined below its use (GO TO idiom)', () => {
    // The POKE at line 10 uses A, only defined later at line 90 (as after a
    // `GO TO` to an init block). The constant pre-pass resolves it exactly.
    const src = ['10 POKE A,1', '90 LET A=22528'].join('\n');
    expect(pokeSites(src)).toEqual([
      {
        address: 22528,
        expr: 'A',
        computed: true,
        approximate: false,
        lineNo: 10,
      },
    ]);
  });

  it('does not seed a variable assigned more than once', () => {
    // B is assigned twice, so it is not a constant and is not seeded. Used
    // before either assignment (in line order) it is unknown -> 0 -> dropped,
    // unlike the single-assignment constant seeded above.
    const src = ['10 POKE B,1', '20 LET B=100', '30 LET B=200'].join('\n');
    expect(pokeSites(src)).toEqual([]);
  });

  it('assumes 0 for an unknown term, giving an approximate base', () => {
    const src = ['10 LET B=22528', '20 POKE B+H,1'].join('\n');
    expect(pokeSites(src)).toEqual([
      {
        address: 22528,
        expr: 'B+H',
        computed: true,
        approximate: true,
        lineNo: 20,
      },
    ]);
  });

  it('assumes 0 for a PEEK/call but keeps a literal base', () => {
    expect(pokeSites('10 POKE PEEK(0)+22528,1')).toEqual([
      {
        address: 22528,
        expr: 'PEEK(0)+22528',
        computed: true,
        approximate: true,
        lineNo: 10,
      },
    ]);
  });

  it('propagates an approximate base through a later assignment', () => {
    // Mirrors the reported program: A is a seeded constant, B=A+C+C with C
    // unknown, then a FOR whose start offsets B. The POKE lands an approximate
    // base inside the Spectrum colour-attributes range (0x5800-0x5AFF).
    const src = [
      '20 LET B=A+C+C',
      '21 FOR J=B+352-H TO B+384+H STEP 32',
      '22 POKE J,E',
      '99 LET A=22526',
    ].join('\n');
    const [site] = pokeSites(src);
    expect(site!.approximate).toBe(true);
    expect(site!.lineNo).toBe(22);
    expect(site!.address).toBeGreaterThanOrEqual(0x5800);
    expect(site!.address).toBeLessThanOrEqual(0x5aff);
    // The FOR ... TO ... STEP end resolves too (both start and end approximate),
    // giving a range whose far edge sits above the start, still in-region.
    expect(site!.endAddress).toBeGreaterThan(site!.address);
    expect(site!.endAddress).toBeLessThanOrEqual(0x5aff);
  });

  it('drops an approximate address that collapses to 0', () => {
    expect(pokeSites('10 POKE Q+R,1')).toEqual([]);
  });
});

describe('pokeSites USR "letter" (user-defined graphics)', () => {
  const udgBase = 0xff58; // ZX Spectrum 48K default

  it('resolves POKE USR "a" to the UDG base when udgBase is given', () => {
    expect(pokeSites('10 POKE USR "a",255', { udgBase })).toEqual([
      {
        address: 0xff58,
        expr: '65368',
        computed: false,
        approximate: false,
        lineNo: 10,
      },
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

describe('pokeSites — indirection dialects (BBC/Atom ?/! writes)', () => {
  // BBC BASIC: `?`/`!` indirection, `&` hex, `:` statement separator.
  const bbc = { writes: ['indirection'] as const, hexPrefix: '&' };
  // Atom: `?`/`!` indirection, `#` hex, `;` statement separator.
  const atom = {
    writes: ['indirection'] as const,
    hexPrefix: '#',
    statementSep: ';',
  };

  it('resolves a byte-indirection write with a hex address (BBC)', () => {
    const [site] = pokeSites('10 ?&2000=5', bbc);
    expect(site).toMatchObject({
      address: 0x2000,
      expr: '?8192',
      approximate: false,
      lineNo: 10,
    });
  });

  it('resolves a word-indirection write, marking its low byte (BBC)', () => {
    const [site] = pokeSites('10 !&70=1', bbc);
    expect(site!.address).toBe(0x70);
    expect(site!.expr).toBe('!112');
  });

  it('resolves a hex-indirection write on the Atom (# prefix)', () => {
    expect(pokeSites('10 ?#DE=0', atom).map((s) => s.address)).toEqual([0xde]);
  });

  it('treats indirection only at a statement start, not as a read', () => {
    // A read into a variable, and a read inside a condition: neither writes.
    expect(pokeSites('10 C=?&2000', bbc)).toEqual([]);
    expect(pokeSites('10 IF ?&2000=5 THEN PRINT 1', bbc)).toEqual([]);
    expect(pokeSites('10 A=!&70', bbc)).toEqual([]);
  });

  it('splits an Atom line on ";" so every write is found', () => {
    expect(pokeSites('10 ?#80=1;?#81=2', atom).map((s) => s.address)).toEqual([
      0x80, 0x81,
    ]);
  });

  it('resolves a computed indirection address against a tracked base', () => {
    const src = ['10 base=&2000', '20 ?(base+1)=5'].join('\n');
    const [site] = pokeSites(src, bbc);
    expect(site).toMatchObject({
      address: 0x2001,
      expr: '?(base+1)',
      computed: true,
      approximate: false,
      lineNo: 20,
    });
  });

  it('resolves a FOR-loop indirection range (start and end address)', () => {
    const src = ['10 FOR I=0 TO 7:?(&2000+I)=0'].join('\n');
    const [site] = pokeSites(src, bbc);
    expect(site!.address).toBe(0x2000);
    expect(site!.endAddress).toBe(0x2007);
  });

  it('does not scan indirection for a POKE dialect (default writes)', () => {
    // With the default `['poke']`, a `?`/`!` statement is not a write.
    expect(pokeSites('10 ?&2000=5')).toEqual([]);
  });
});

describe('pokeSites — Commodore POKE (decimal addresses)', () => {
  it('resolves a decimal POKE the same as any POKE dialect', () => {
    const [site] = pokeSites('10 POKE 53280,0');
    expect(site).toMatchObject({
      address: 53280,
      expr: '53280',
      computed: false,
      approximate: false,
      lineNo: 10,
    });
  });
});
