/**
 * What each machine's BASIC actually does with its operators, as a program the
 * machine can be asked to run.
 *
 * Operator support is described in four places - the keyword tables, the editor's
 * highlighting, the language reference rows and the porting guide's facts - and
 * until this table existed none of them was compared to a running machine. That
 * is how the Atom came to be documented as having no way to raise to a power
 * when its floating-point ROM has one, and why nothing noticed that two machines
 * running the same Microsoft BASIC disagreed about `2^3^2`.
 *
 * A probe is one printed line: a label, then the value the machine computes.
 * `operatorBattery.test.ts` tokenizes the program through the dialect, loads it
 * into the real machine and reads the answers back off the screen. What is
 * written here is therefore a claim about the machine, not about the code -
 * when the two disagree the machine is right.
 *
 * Probes are keyed by *language family* rather than by dialect, the same
 * grouping the reference pages use, because the machines that share a BASIC
 * share its operators exactly. The `dialects` field maps a family back onto the
 * registry and the battery pins that the two agree, so a newly registered
 * dialect fails until its operators have been looked at.
 */

/** The label each probe prints, and what it settles. */
export const PROBE_MEANINGS: Record<string, string> = {
  PREC: 'that * binds tighter than + - an anchor proving the screen is being read correctly',
  POWR: 'the exponent operator exists, and its spelling on this machine',
  ASSC: 'associativity: 64 if a^b^c folds left, 512 if it folds right',
  UNMI: 'whether the exponent binds tighter than a leading minus',
  ANDV: 'AND on operands that are not 0 or 1: bitwise gives 1, Sinclair value logic gives 5, true/false logic gives 1',
  ORV: 'OR likewise: bitwise gives 7, value logic gives 1, true/false logic gives 1 - so ANDV and ORV together tell the three apart',
  NOTV: 'NOT likewise: bitwise gives -6, value and true/false logic both give 0',
  TRU: 'what a true comparison evaluates to: -1 or 1',
  DIVV: 'whether / keeps the fraction or truncates',
  IDIV: 'the integer-division operator, where the machine has one',
  REMD: 'the remainder operator, where the machine has one',
  XORV: 'the exclusive-OR operator, where the machine has one',
  BAND: 'a symbolic bitwise AND alongside the word form (the Atom)',
  REL: 'that the <= spelling exists and yields the same truth value as =',
  CAT: 'that + concatenates strings',
};

export interface OperatorProbe {
  /** Language-family id. */
  id: string;
  /** Human-readable machines the family covers. */
  machines: string[];
  /** Registered dialect ids running this BASIC's operator set. */
  dialects: string[];
  /**
   * The program, in this machine's own spelling and line layout. Every line
   * prints one label followed by one value; the last prints `ZZEND` so the
   * battery can tell a finished run from a stalled one.
   */
  program: string;
  /** Label -> the text the machine prints after it, spaces removed. */
  expect: Record<string, string>;
}

/**
 * Sinclair BASIC as the ZX81 and the Spectrum run it. Floating point, `**` on
 * the ZX81 and `↑` on the Spectrum, and the value logic both share: `a AND b` is
 * `a` when `b` is non-zero and 0 otherwise, `a OR b` is 1 when `b` is non-zero
 * and `a` otherwise. A true comparison is 1, not -1.
 *
 * The ZX80 is not in this family despite the name on the case: its 4K BASIC
 * combines AND and OR bit by bit and yields -1 for true, like the Microsoft
 * machines. That is a trap between two Sinclairs, and it has its own entry.
 */
function sinclairProgram(power: string): string {
  return [
    '10 PRINT "PREC";2+3*4',
    `20 PRINT "POWR";2${power}3`,
    `30 PRINT "ASSC";2${power}3${power}2`,
    `40 PRINT "UNMI";0-2${power}2`,
    '50 PRINT "ANDV";5 AND 3',
    '60 PRINT "ORV";5 OR 3',
    '70 PRINT "NOTV";NOT 5',
    '80 PRINT "TRU";(1=1)',
    '90 PRINT "DIVV";7/2',
    '100 PRINT "REL";(1<=2)',
    '110 PRINT "CAT";"A"+"B"',
    '120 PRINT "ZZEND"',
    '',
  ].join('\n');
}

const SINCLAIR_EXPECT: Record<string, string> = {
  PREC: '14',
  POWR: '8',
  ASSC: '64',
  UNMI: '-4',
  ANDV: '5',
  ORV: '1',
  NOTV: '0',
  TRU: '1',
  DIVV: '3.5',
  REL: '1',
  CAT: 'AB',
};

/**
 * Microsoft BASIC, shared by the Commodores, the TRS-80 and the Altair. Bitwise
 * AND/OR/NOT on 16-bit integers, -1 for true, and no integer-division,
 * remainder or exclusive-OR operator at all - a port to one of these machines
 * rewrites those as INT() arithmetic.
 */
function microsoftProgram(power: string): string {
  return [
    '10 PRINT "PREC";2+3*4',
    `20 PRINT "POWR";2${power}3`,
    `30 PRINT "ASSC";2${power}3${power}2`,
    `40 PRINT "UNMI";0-2${power}2`,
    '50 PRINT "ANDV";5 AND 3',
    '60 PRINT "ORV";5 OR 3',
    '70 PRINT "NOTV";NOT 5',
    '80 PRINT "TRU";(1=1)',
    '90 PRINT "DIVV";7/2',
    '100 PRINT "REL";(1<=2)',
    '110 PRINT "CAT";"A"+"B"',
    '120 PRINT "ZZEND"',
    '',
  ].join('\n');
}

const MICROSOFT_EXPECT: Record<string, string> = {
  PREC: '14',
  POWR: '8',
  ASSC: '64',
  UNMI: '-4',
  ANDV: '1',
  ORV: '7',
  NOTV: '-6',
  TRU: '-1',
  DIVV: '3.5',
  REL: '-1',
  CAT: 'AB',
};

export const OPERATOR_PROBES: OperatorProbe[] = [
  {
    id: 'zx81',
    machines: ['ZX81'],
    dialects: ['zx81'],
    program: sinclairProgram('**'),
    expect: SINCLAIR_EXPECT,
  },
  {
    id: 'zx80',
    machines: ['ZX80'],
    dialects: ['zx80'],
    // Integer-only, so `/` truncates and there is no 3.5 to print. The ZX80 has
    // no `<=`, `>=` or `<>` at all - the relational probe would not tokenize -
    // and no string expressions to concatenate.
    //
    // Its logic is the surprise. The 4K ROM combines AND and OR bit by bit and
    // yields -1 for true, so `5 AND 3` is 1 here and 5 on the ZX81 that replaced
    // it a year later. Two machines from the same maker, one `AND` spelling,
    // different answers - which is why the battery asks each machine rather than
    // grouping them by badge.
    program: [
      '10 PRINT "PREC";2+3*4',
      '20 PRINT "POWR";2**3',
      '30 PRINT "ASSC";2**3**2',
      '40 PRINT "UNMI";0-2**2',
      '50 PRINT "ANDV";5 AND 3',
      '60 PRINT "ORV";5 OR 3',
      '70 PRINT "NOTV";NOT 5',
      '80 PRINT "TRU";(1=1)',
      '90 PRINT "DIVV";7/2',
      '100 PRINT "ZZEND"',
      '',
    ].join('\n'),
    expect: {
      PREC: '14',
      POWR: '8',
      ASSC: '64',
      UNMI: '-4',
      ANDV: '1',
      ORV: '7',
      NOTV: '-6',
      TRU: '-1',
      DIVV: '3',
    },
  },
  {
    id: 'zxspectrum',
    machines: ['ZX Spectrum', 'ZX Spectrum 128'],
    dialects: ['zxspectrum', 'zxspectrum128'],
    program: sinclairProgram('↑'),
    expect: SINCLAIR_EXPECT,
  },
  {
    id: 'bbc',
    machines: ['BBC Micro', 'BBC Master'],
    dialects: ['bbcmicro', 'bbcmaster'],
    // The one family with the full complement: `DIV`, `MOD` and `EOR` alongside
    // bitwise AND/OR/NOT.
    program: [
      '10 PRINT "PREC";2+3*4',
      '20 PRINT "POWR";2^3',
      '30 PRINT "ASSC";2^3^2',
      '40 PRINT "UNMI";0-2^2',
      '50 PRINT "ANDV";5 AND 3',
      '60 PRINT "ORV";5 OR 3',
      '70 PRINT "NOTV";NOT 5',
      '80 PRINT "TRU";(1=1)',
      '90 PRINT "DIVV";7/2',
      '100 PRINT "IDIV";7 DIV 2',
      '110 PRINT "REMD";7 MOD 2',
      '120 PRINT "XORV";5 EOR 3',
      '130 PRINT "REL";(1<=2)',
      '140 PRINT "CAT";"A"+"B"',
      '150 PRINT "ZZEND"',
      '',
    ].join('\n'),
    expect: {
      PREC: '14',
      POWR: '8',
      ASSC: '64',
      UNMI: '-4',
      ANDV: '1',
      ORV: '7',
      NOTV: '-6',
      TRU: '-1',
      DIVV: '3.5',
      IDIV: '3',
      REMD: '1',
      XORV: '6',
      REL: '-1',
      CAT: 'AB',
    },
  },
  {
    id: 'commodore',
    machines: ['Commodore 64', 'PET', 'VIC-20'],
    dialects: ['commodore64', 'pet', 'vic20'],
    program: microsoftProgram('↑'),
    expect: MICROSOFT_EXPECT,
  },
  {
    id: 'trs80',
    machines: ['TRS-80'],
    dialects: ['trs80'],
    program: microsoftProgram('↑'),
    expect: MICROSOFT_EXPECT,
  },
  {
    id: 'altair8800',
    machines: ['Altair 8800'],
    dialects: ['altair8800'],
    // 8K BASIC spells the power operator `^`; there is no up-arrow form.
    program: microsoftProgram('^'),
    expect: MICROSOFT_EXPECT,
  },
  {
    id: 'pmd85',
    machines: ['PMD 85-2'],
    dialects: ['pmd85'],
    // BASIC-G spells the power operator `^`, as the Altair does; the up-arrow
    // is a Commodore keyboard's spelling of the same token and has no glyph in
    // this machine's ASCII font.
    program: microsoftProgram('^'),
    expect: MICROSOFT_EXPECT,
  },
  {
    id: 'apple1',
    machines: ['Apple I'],
    dialects: ['apple1'],
    // Integer BASIC is its own family and shares none of the Microsoft
    // battery's answers: `/` truncates rather than returning a fraction, there
    // is no `^`, `MOD` or `EOR`, and AND/OR/NOT are logical rather than
    // bitwise - `NOT 5` is 0, not -6. A true comparison is 1, not -1, and
    // strings do not concatenate at all. `#` is MOD's spelling here.
    program: [
      '10 PRINT "PREC";2+3*4',
      '20 PRINT "UNMI";0-2*2',
      '30 PRINT "ANDV";5 AND 3',
      '40 PRINT "ORV";5 OR 3',
      '50 PRINT "NOTV";NOT 5',
      '60 PRINT "TRU";(1=1)',
      '70 PRINT "DIVV";7/2',
      '80 PRINT "REMD";7 MOD 2',
      '90 PRINT "REL";(1<=2)',
      '100 PRINT "ZZEND"',
      '110 END',
      '',
    ].join('\n'),
    expect: {
      PREC: '14',
      UNMI: '-4',
      ANDV: '1',
      ORV: '1',
      NOTV: '0',
      TRU: '1',
      DIVV: '3',
      REMD: '1',
      REL: '1',
    },
  },
  {
    id: 'cpc',
    machines: ['CPC 464', 'CPC 664', 'CPC 6128'],
    dialects: ['cpc464', 'cpc664', 'cpc6128'],
    // Locomotive BASIC has the richest operator set here: `\` for integer
    // division as well as `MOD`, and a spelled-out `XOR`.
    program: [
      '10 PRINT "PREC";2+3*4',
      '20 PRINT "POWR";2^3',
      '30 PRINT "ASSC";2^3^2',
      '40 PRINT "UNMI";0-2^2',
      '50 PRINT "ANDV";5 AND 3',
      '60 PRINT "ORV";5 OR 3',
      '70 PRINT "NOTV";NOT 5',
      '80 PRINT "TRU";(1=1)',
      '90 PRINT "DIVV";7/2',
      '100 PRINT "IDIV";7\\2',
      '110 PRINT "REMD";7 MOD 2',
      '120 PRINT "XORV";5 XOR 3',
      '130 PRINT "REL";(1<=2)',
      '140 PRINT "CAT";"A"+"B"',
      '150 PRINT "ZZEND"',
      '',
    ].join('\n'),
    expect: {
      PREC: '14',
      POWR: '8',
      ASSC: '64',
      UNMI: '-4',
      ANDV: '1',
      ORV: '7',
      NOTV: '-6',
      TRU: '-1',
      DIVV: '3.5',
      IDIV: '3',
      REMD: '1',
      XORV: '6',
      REL: '-1',
      CAT: 'AB',
    },
  },
  {
    id: 'atom',
    machines: ['Acorn Atom'],
    dialects: ['atom'],
    // The Atom is the odd one out twice over. `PRINT` does not end the line -
    // `'` does - and its items run together with no separator, so every
    // expression here is parenthesised: bare `5 AND 3` prints the 5 and then
    // meets a word where it expects another item.
    //
    // And the machine has two arithmetics. A-Z are integers, where `/` truncates
    // and `%` is the remainder; the floating-point ROM's %A-%Z are reals reached
    // through the F-statements. **The exponent operator exists only in the
    // second of those** - `2^3` in an integer expression is rejected outright,
    // which is why the porting guide reported this machine as having no way to
    // raise to a power. It has one; it is reached through the FP variables, and
    // it goes through logs, which is what the near-miss on 2^3^2 below is.
    program: [
      '10 PRINT "PREC"(2+3*4)\'',
      '20 %A=2^3',
      '30 PRINT "POWR"; FPRINT %A',
      '40 PRINT \'"ASSC"; %A=2^3^2; FPRINT %A',
      '50 PRINT \'"UNMI"; %A=0-2^2; FPRINT %A',
      '60 PRINT \'"ANDV"(5 AND 3)\'',
      '70 PRINT "ORV"(5 OR 3)\'',
      '80 PRINT "TRU"(1=1)\'',
      '90 PRINT "DIVV"(7/2)\'',
      '100 PRINT "REMD"(7%2)\'',
      '110 PRINT "BAND"(5&3)\'',
      '120 PRINT "XORV"(5:3)\'',
      '130 PRINT "REL"(1<=2)\'',
      '140 PRINT "ZZEND"\'',
      '',
    ].join('\n'),
    expect: {
      PREC: '14',
      POWR: '8.00000000',
      ASSC: '63.9999998',
      UNMI: '-4.00000000',
      ANDV: '1',
      ORV: '7',
      TRU: '1',
      DIVV: '3',
      REMD: '1',
      BAND: '1',
      XORV: '6',
      REL: '1',
    },
  },
  {
    id: 'apple2',
    machines: ['Apple II'],
    dialects: ['apple2'],
    // Integer BASIC again, one revision on from the Apple I's: the same
    // truncating `/`, the same logical AND/OR/NOT (`NOT 5` is 0, not -6), the
    // same 1 for a true comparison and the same absence of string
    // concatenation. What this revision adds is `^`, which the Apple I has no
    // spelling for at all. `MOD` is still the remainder word, and there is
    // still no `EOR`.
    program: [
      '10 PRINT "PREC";2+3*4',
      '20 PRINT "POWR";2^3',
      '30 PRINT "ASSC";2^3^2',
      '40 PRINT "UNMI";0-2^2',
      '50 PRINT "ANDV";5 AND 3',
      '60 PRINT "ORV";5 OR 3',
      '70 PRINT "NOTV";NOT 5',
      '80 PRINT "TRU";(1=1)',
      '90 PRINT "DIVV";7/2',
      '100 PRINT "REMD";7 MOD 2',
      '110 PRINT "REL";(1<=2)',
      '120 PRINT "ZZEND"',
      '130 END',
      '',
    ].join('\n'),
    expect: {
      PREC: '14',
      POWR: '8',
      ASSC: '64',
      UNMI: '-4',
      ANDV: '1',
      ORV: '1',
      NOTV: '0',
      TRU: '1',
      DIVV: '3',
      REMD: '1',
      REL: '1',
    },
  },
  {
    id: 'apple2plus',
    machines: ['Apple II Plus'],
    dialects: ['apple2plus'],
    // The Microsoft program, and not the Microsoft answers. Applesoft spells the
    // power operator `^` as the Altair and the PMD 85 do, folds it left, and
    // divides to a fraction - but its AND/OR/NOT read their operands as
    // true-or-false rather than bit by bit (`5 OR 3` is 1, not 7, and `NOT 5`
    // is 0, not -6) and a true comparison answers 1 rather than -1. Read off
    // the running ROM: this is the one Microsoft BASIC here that answers the
    // Integer BASIC and Atari way, so it cannot join the family's expectations.
    program: microsoftProgram('^'),
    expect: {
      PREC: '14',
      POWR: '8',
      ASSC: '64',
      UNMI: '-4',
      ANDV: '1',
      ORV: '1',
      NOTV: '0',
      TRU: '1',
      DIVV: '3.5',
      REL: '1',
      CAT: 'AB',
    },
  },
  {
    id: 'atari',
    machines: ['Atari 800', 'Atari 400'],
    dialects: ['atari800', 'atari400'],
    // Its own family: `^` for exponent (no `**`/`↑` spelling to choose between),
    // AND/OR/NOT read their operand as true-or-false rather than bit by bit -
    // `5 AND 3` is 1, not the bitwise table's 1-coincidence-that-isn't (`5 OR 3`
    // tells the two apart: 1 here, 7 on a bitwise machine) - and a true
    // comparison is 1. There is no MOD, integer-division or exclusive-OR
    // keyword at all, so a port supplies those with `-INT(-x/y)` arithmetic.
    // `/` keeps the fraction, unlike Integer BASIC's floor.
    //
    // No CAT: `+` is arithmetic only. `"A"+"B"` does not error, but it does not
    // concatenate either - booted and tried both as plain strings and as the
    // array strings the language actually uses for text (`A$(5)`), `A$+B$`
    // print the *second* operand's value alone rather than joining the two, so
    // there is no true/false answer this probe could pin; a program builds a
    // string by assigning into a slice past the end of the first
    // (`A$(LEN(A$)+1)=B$`) instead. The two POWR probes and ASSC/UNMI's
    // BCD-through-logs results are quoted verbatim off the booted ROM, not
    // rounded - the cartridge computes `2^3` as 7.99999991.
    program: [
      '10 PRINT "PREC";2+3*4',
      '20 PRINT "POWR";2^3',
      '30 PRINT "ASSC";2^3^2',
      '40 PRINT "UNMI";0-2^2',
      '50 PRINT "ANDV";5 AND 3',
      '60 PRINT "ORV";5 OR 3',
      '70 PRINT "NOTV";NOT 5',
      '80 PRINT "TRU";(1=1)',
      '90 PRINT "DIVV";7/2',
      '100 PRINT "REL";(1<=2)',
      '110 PRINT "ZZEND"',
      '',
    ].join('\n'),
    expect: {
      PREC: '14',
      POWR: '7.99999991',
      ASSC: '63.99999787',
      UNMI: '-3.99999996',
      ANDV: '1',
      ORV: '1',
      NOTV: '0',
      TRU: '1',
      DIVV: '3.5',
      REL: '1',
    },
  },
];
