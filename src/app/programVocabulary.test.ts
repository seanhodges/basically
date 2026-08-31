import { describe, expect, it } from 'vitest';
import { LARGE_NUMBER_FLOOR, programVocabulary } from './programVocabulary';
import { getDialect } from '../dialects/registry';
import { portingFacts } from '../reference/facts';

const c64 = getDialect('commodore64');
const bbc = getDialect('bbcmicro');
const spectrum = getDialect('zxspectrum');
const zx81 = getDialect('zx81');

describe('programVocabulary - keywords', () => {
  it('splits crunched entry the way the ROM does', () => {
    // The C64 ROM ignores spaces outside strings/REM, so this is a real
    // program: FOR I=1 TO 10 : PRINT I : NEXT.
    expect(programVocabulary('10 FORI=1TO10:PRINTI:NEXT', c64)).toEqual({
      dialectId: 'commodore64',
      keywords: ['FOR', 'NEXT', 'PRINT', 'TO'],
      spellings: [],
      variables: ['I'],
      divides: false,
      fractionalLiteral: false,
      largeNumbers: [],
      escapeCodes: [],
      characters: [...'01:=EFINOPRTX'],
      multiStatementLines: [10],
      // FOR / PRINT / NEXT: three statements, so two lines a split would add.
      extraStatements: 2,
      lineNumbers: { lowest: 10, highest: 10, count: 1 },
      writeSites: [],
      readSites: [],
      callSites: [],
      codeBlocks: [],
      screenModes: null,
      positions: null,
      emptyLoopLines: [],
    });
  });

  // The porting guide reports operator differences now, and can only narrow
  // them to the open program if the scan names the operators the program
  // carries. Only the ones a port turns on: `+` is on every machine here, and a
  // bare `-` sits inside every negative number.
  it('names the symbolic operators a port turns on', () => {
    expect(programVocabulary('10 LET A=B**2', zx81).keywords).toContain('**');
    expect(
      programVocabulary('10 IF A<=B THEN PRINT 1', zx81).keywords,
    ).toContain('<=');
    expect(
      programVocabulary('10 A=B\\2', getDialect('cpc464')).keywords,
    ).toContain('\\');
  });

  it('reports a typed caret under the spelling the machine lists back', () => {
    // The tokenizer takes `^` for the Commodore's `↑`, and the reference page
    // has a row for `↑` alone - so a program carrying either is narrowed by the
    // one name the guide can look up.
    expect(programVocabulary('10 A=B^2', c64).keywords).toContain('↑');
    expect(programVocabulary('10 A=B↑2', c64).keywords).toContain('↑');
  });

  it('resolves a symbol spelling to the command it stands for', () => {
    // The under-report this fixes: a Commodore program that prints only with
    // `?` used to reach the comparison with no PRINT in it at all, so every
    // finding about printing was silently absent.
    const vocab = programVocabulary('10 ?"HI"', c64);
    expect(vocab.keywords).toContain('PRINT');
    expect(vocab.spellings).toEqual([{ spelling: '?', keyword: 'PRINT' }]);
  });

  it('resolves nothing for a symbol the machine reads as its own operator', () => {
    // `?` is byte indirection on the Atom, not PRINT. Resolving by the source
    // machine's own tables is what makes that safe by construction; the write
    // itself is already collected as a write site.
    const vocab = programVocabulary('10 ?#8000=1', getDialect('atom'));
    expect(vocab.keywords).not.toContain('PRINT');
    expect(vocab.spellings).toEqual([]);
  });

  it('resolves a dotted BBC program to the keywords it means', () => {
    const vocab = programVocabulary('10 P."HI"\n20 G.10', bbc);
    expect(vocab.keywords).toEqual(expect.arrayContaining(['PRINT', 'GOTO']));
    expect(vocab.spellings).toEqual([
      { spelling: 'G.', keyword: 'GOTO' },
      { spelling: 'P.', keyword: 'PRINT' },
    ]);
  });

  it('resolves a shifted-letter Commodore program', () => {
    const vocab = programVocabulary('10 pO53280,0', c64);
    expect(vocab.keywords).toContain('POKE');
    expect(vocab.spellings).toEqual([{ spelling: 'pO', keyword: 'POKE' }]);
  });

  it('leaves a full spelling alone whatever its case', () => {
    // `pRINT` is PRINT to the tokenizer, not the abbreviation `pR` (PRINT#).
    const vocab = programVocabulary('10 pRINT"HI"', c64);
    expect(vocab.keywords).toContain('PRINT');
    expect(vocab.spellings).toEqual([]);
  });

  it('does not read a spelling inside a string or a REM', () => {
    expect(programVocabulary('10 PRINT"P. AND ?"', bbc).spellings).toEqual([]);
    expect(programVocabulary('10 REM ?"HI"', c64).spellings).toEqual([]);
  });

  it('reports no spellings on a machine that reads none', () => {
    expect(programVocabulary('10 PRINT "HI"', zx81).spellings).toEqual([]);
  });

  it('says nothing about the operators every machine has', () => {
    const vocab = programVocabulary('10 LET A=B+1-2*3/4', zx81);
    for (const op of ['+', '-', '*', '/']) {
      expect(vocab.keywords).not.toContain(op);
    }
  });

  it('does not find keywords inside variable names on a dialect that does not crunch', () => {
    // The whole reason the `crunched` flag exists: matching anywhere here would
    // report TO (in TOTAL%) and IF (in DIFF%) as commands the program uses.
    const vocab = programVocabulary(
      '10 total%=5\n20 diff%=total%-1\n30 PRINT total%',
      bbc,
    );
    expect(vocab.keywords).toEqual(['PRINT']);
  });

  it('reads a keyword glued to punctuation on a dialect that does not crunch', () => {
    const vocab = programVocabulary('10 PRINT LEFT$("HELLO",2)', bbc);
    expect(vocab.keywords).toContain('LEFT$');
  });

  it('ignores keywords inside strings and after REM', () => {
    const vocab = programVocabulary(
      '10 PRINT "PRESS GOTO OR STOP"\n20 REM SEE GOSUB 100 AND PLOT',
      bbc,
    );
    expect(vocab.keywords).toEqual(['PRINT']);
  });

  it('ignores machine-code block lines', () => {
    // A `#BIN` payload is base64: scanning it for keywords finds whatever
    // letters the bytes happen to spell.
    const vocab = programVocabulary('#BIN Zm9ybmV4dHByaW50\n10 PRINT 1', c64);
    expect(vocab.keywords).toEqual(['PRINT']);
  });

  it('reads an unnumbered line as code', () => {
    expect(programVocabulary('PRINT 1', c64).keywords).toEqual(['PRINT']);
  });
});

describe('programVocabulary - escape codes', () => {
  it('records braced escapes by byte', () => {
    const vocab = programVocabulary('10 PRINT "{clr}{white}HI"', c64);
    expect(vocab.escapeCodes).toEqual([0x05, 0x93]);
  });

  it('records only the leading byte of an operand-carrying escape', () => {
    // `{INK 2}` is 0x10 0x02; the docs escape row for it claims 0x10 alone, so
    // that is what identifies the code.
    const vocab = programVocabulary('10 PRINT "{INK 2}HI"', spectrum);
    expect(vocab.escapeCodes).toEqual([0x10]);
  });

  it('records Sinclair backslash escapes', () => {
    const vocab = programVocabulary('10 PRINT "\\::\\.."', zx81);
    expect(vocab.escapeCodes).toEqual([0x80, 0x83]);
  });

  it('records nothing for a literal of plain characters', () => {
    expect(programVocabulary('10 PRINT "HELLO"', c64).escapeCodes).toEqual([]);
  });

  it('ignores escapes written after a REM', () => {
    const vocab = programVocabulary('10 REM PRINT "{clr}"', c64);
    expect(vocab.escapeCodes).toEqual([]);
  });

  it('yields a partial vocabulary when a literal cannot be read', () => {
    // Half-typed escapes throw CharsetError. Everything already found stands,
    // so ordinary editing does not keep discarding the narrowing.
    const vocab = programVocabulary('10 PRINT "{clr}{whi"\n20 CLR', c64);
    expect(vocab.escapeCodes).toEqual([0x93]);
    expect(vocab.keywords).toEqual(['CLR', 'PRINT']);
  });
});

describe('programVocabulary - characters', () => {
  it('records the characters of code, strings and REM bodies alike', () => {
    // All three are stored through the same charset, so a character the target
    // lacks fails in a comment exactly as it does in a string.
    const vocab = programVocabulary('10 PRINT "HI!"\n20 REM &', c64);
    expect(vocab.characters).toContain('!');
    expect(vocab.characters).toContain('&');
  });

  it('does not record an escape spelling as characters', () => {
    // `{clr}` is one control code. Recording `{`, `c`, `l`, `r` and `}` would
    // report characters the program does not use - and `{` is one the C64
    // cannot represent, so it would invent a finding.
    const vocab = programVocabulary('10 PRINT "{clr}A"', c64);
    // The line number is stripped with the line; `PRINT "A"` is what is left.
    expect(vocab.characters).toEqual([...' "AINPRT']);
    expect(vocab.characters).not.toContain('{');
  });

  it('records a block graphic as a control code and not as a character', () => {
    // The two scans partition the program: one difference, one finding.
    const vocab = programVocabulary('10 PRINT "\\::"', zx81);
    expect(vocab.escapeCodes).toEqual([0x80]);
    expect(vocab.characters).not.toContain('\\');
    expect(vocab.characters).not.toContain(':');
  });

  it('records the inverse-video prefix as neither', () => {
    // `%A` is one inverse-video character on a ZX81, not a `%` and an `A`.
    const vocab = programVocabulary('10 PRINT "%A"', zx81);
    expect(vocab.characters).not.toContain('%');
  });
});

describe('programVocabulary - multi-statement lines', () => {
  it('reports a line carrying several statements', () => {
    const vocab = programVocabulary('10 A=1:B=2\n20 C=3', c64);
    expect(vocab.multiStatementLines).toEqual([10]);
  });

  it('reports the BASIC line number, not the editor line', () => {
    // The number the listing prints, which is what a reader looks for. The two
    // differ for any program not written from line 1 in steps of one, and this
    // one differs both ways: leading blanks push the editor line down, and the
    // program numbers from 100.
    const vocab = programVocabulary('\n\n100 A=1:B=2', c64);
    expect(vocab.multiStatementLines).toEqual([100]);
  });

  it('names the line as the listing numbers it, not as the editor counts it', () => {
    // The report this comes from: `30 PRINT:PRINT` sits on the third line of
    // the editor, and the guide named 3 - a line number the program also has,
    // pointing the reader at `10 PRINT "A"`. Every line here is off by the
    // same step, so a reader checking one finding against their listing was
    // reading the wrong line every time.
    const vocab = programVocabulary(
      '10 PRINT "A"\n20 PRINT "B"\n30 PRINT:PRINT',
      c64,
    );
    expect(vocab.multiStatementLines).toEqual([30]);
  });

  it('does not count a separator inside a string or after REM', () => {
    const vocab = programVocabulary('10 PRINT "A:B"\n20 REM A:B', c64);
    expect(vocab.multiStatementLines).toEqual([]);
  });

  it('does not count a trailing or doubled separator', () => {
    // Real tape programs carry these; an empty statement is not one to split.
    const vocab = programVocabulary('10 A=1:\n20 B=2::C=3', c64);
    expect(vocab.multiStatementLines).toEqual([20]);
  });

  it('reports nothing on a machine with no statement separator', () => {
    // The ZX81 has no separator, and `:` is ordinary text on it. Defaulting to
    // `:` here would report this line as two statements.
    const vocab = programVocabulary('10 PRINT "TIME: ";T', zx81);
    expect(vocab.multiStatementLines).toEqual([]);
  });

  it('splits on the machine’s own separator', () => {
    // The Atom separates with `;`, so a `:` is not a boundary there.
    const atom = getDialect('atom');
    expect(programVocabulary('10 A=1;B=2', atom).multiStatementLines).toEqual([
      10,
    ]);
    expect(programVocabulary('10 A=1:B=2', atom).multiStatementLines).toEqual(
      [],
    );
  });
});

describe('programVocabulary - statements a split would add', () => {
  it('counts every statement past the first, not the lines carrying them', () => {
    // Two lines affected, but four new lines needed on a target that takes one
    // statement per line - which is what has to be renumbered into.
    const vocab = programVocabulary('10 A=1:B=2:C=3\n20 D=4\n30 E=5:F=6', c64);
    expect(vocab.multiStatementLines).toEqual([10, 30]);
    expect(vocab.extraStatements).toBe(3);
  });

  it('counts nothing for a separator inside a string or after REM', () => {
    const vocab = programVocabulary('10 PRINT "A:B"\n20 REM A:B', c64);
    expect(vocab.extraStatements).toBe(0);
  });

  it('counts nothing on a machine with no statement separator', () => {
    expect(programVocabulary('10 PRINT "TIME: ";T', zx81).extraStatements).toBe(
      0,
    );
  });
});

describe('programVocabulary - line numbers', () => {
  it('reports the span the program is numbered across', () => {
    const vocab = programVocabulary('10 A=1\n20 B=2\n32767 C=3', c64);
    expect(vocab.lineNumbers).toEqual({
      lowest: 10,
      highest: 32767,
      count: 3,
    });
  });

  it('reads the numbers as written, whatever order the lines are in', () => {
    // The guide asks whether the target's editor would take these numbers, so
    // the lowest and highest are the program's own, not the first and last.
    const vocab = programVocabulary('100 A=1\n20 B=2\n50 C=3', c64);
    expect(vocab.lineNumbers).toMatchObject({ lowest: 20, highest: 100 });
  });

  it('counts a line with no number of its own towards nothing', () => {
    const vocab = programVocabulary('10 A=1\nPRINT A\n', c64);
    expect(vocab.lineNumbers).toEqual({ lowest: 10, highest: 10, count: 1 });
  });

  it('ignores a #BIN block’s payload', () => {
    // The payload is base64, not BASIC, and its leading digits are not a line
    // number - reading one would report a program numbered wherever the base64
    // happened to start.
    const vocab = programVocabulary(
      '10 A=1\n#BIN 32768 0123456789ABCDEF\n20 B=2',
      c64,
    );
    expect(vocab.lineNumbers).toEqual({ lowest: 10, highest: 20, count: 2 });
  });

  it('reports nothing for a program with no numbered line', () => {
    expect(programVocabulary('PRINT 1\n', c64).lineNumbers).toBeNull();
    expect(programVocabulary('', c64).lineNumbers).toBeNull();
  });
});

describe('programVocabulary - write sites', () => {
  it('records the addresses a program writes to, in address order', () => {
    const { writeSites } = programVocabulary(
      '10 POKE 53280,0\n20 POKE 1024,81',
      c64,
    );

    expect(writeSites.map((s) => s.address)).toEqual([1024, 53280]);
    expect(writeSites.every((s) => s.computed === false)).toBe(true);
  });

  it('carries a loop’s end address, which the map shades to', () => {
    const { writeSites } = programVocabulary(
      '10 FOR I=0 TO 15\n20 POKE 1024+I,81\n30 NEXT I',
      c64,
    );
    const ranged = writeSites.find((s) => s.endAddress !== undefined);

    expect(ranged?.address).toBe(1024);
    expect(ranged?.endAddress).toBe(1039);
    expect(ranged?.approximate).toBe(false);
  });

  it('marks a loop it could not pin down as approximate', () => {
    // The same loop crunched onto one line. The address tracker walks a line at
    // a time, so the loop variable is not in hand when the POKE on that same
    // line is read: the base is right and the extent is unknown. The map draws
    // that as an estimate rather than as an exact byte, which is the honest
    // answer - and the reason the guide passes `approximate` across at all.
    const { writeSites } = programVocabulary(
      '10 FORI=0TO15:POKE1024+I,81:NEXT',
      c64,
    );

    expect(writeSites).toHaveLength(1);
    expect(writeSites[0]!.address).toBe(1024);
    expect(writeSites[0]!.approximate).toBe(true);
    expect(writeSites[0]!.endAddress).toBeUndefined();
  });

  it('leaves out an address the machine does not have', () => {
    // A write past the top of memory is a finding about the program, not about
    // the port; the IDE's own map reports it, and marking it on either machine's
    // layout would mean drawing it outside the picture.
    const { writeSites } = programVocabulary('10 POKE 70000,1', c64);

    expect(writeSites).toEqual([]);
  });

  it('records nothing for a program that writes nowhere', () => {
    expect(programVocabulary('10 PRINT "HI"', c64).writeSites).toEqual([]);
  });
});

describe('programVocabulary - read sites', () => {
  it('collects a PEEK with its address', () => {
    // The porting guide judges these on both machines exactly as it judges the
    // writes: 53280 is the C64's border colour, and on another machine it is
    // whatever that machine keeps there.
    const { readSites } = programVocabulary(
      '10 IF PEEK(53280)=0 THEN PRINT PEEK(1024)',
      c64,
    );

    expect(readSites.map((s) => s.address)).toEqual([1024, 53280]);
    expect(readSites.every((s) => s.approximate === false)).toBe(true);
  });

  it('marks a computed read address approximate', () => {
    const { readSites } = programVocabulary('10 LET A=PEEK (1024+X)', spectrum);

    expect(readSites).toHaveLength(1);
    expect(readSites[0]!.approximate).toBe(true);
  });

  it('reads a BBC program by indirection, since it has no PEEK', () => {
    const { readSites } = programVocabulary('10 C=?&FE60', bbc);

    expect(readSites.map((s) => s.address)).toEqual([0xfe60]);
  });

  it('records nothing for a program that reads nothing', () => {
    expect(programVocabulary('10 PRINT "HI"', c64).readSites).toEqual([]);
  });

  it('records nothing on a machine that declares no read syntax', () => {
    // Every registered machine that reads memory declares how; this is the
    // guard for one that does not, which reports no reads rather than guessing
    // a spelling from the keyword table.
    const silent = { ...c64, memoryReads: undefined };
    expect(
      programVocabulary('10 IF PEEK(53280)=0 THEN STOP', silent).readSites,
    ).toEqual([]);
  });
});

describe('programVocabulary - machine code', () => {
  it("collects a call command's target, with the keyword it used", () => {
    const { callSites } = programVocabulary('10 SYS 49152', c64);

    expect(callSites).toEqual([
      {
        address: 49152,
        expr: 'SYS 49152',
        computed: false,
        approximate: false,
      },
    ]);
  });

  it('collects a Sinclair USR call, whose argument is the address', () => {
    const { callSites } = programVocabulary('10 RAND USR 32768', zx81);

    expect(callSites.map((s) => s.expr)).toEqual(['USR 32768']);
  });

  it('collects nothing from a USR whose argument is data, not an address', () => {
    // The Microsoft USR calls through a vector and passes its argument to the
    // routine, so 5 here is not an address and reporting it as one would name
    // a routine the program never reaches.
    expect(programVocabulary('10 A=USR(5)', c64).callSites).toEqual([]);
  });

  it('carries a block by name, address and size, and nothing from its payload', () => {
    const { codeBlocks } = programVocabulary('10 SYS 49152', c64, [
      {
        id: 'b1',
        name: 'SCROLL',
        address: 49152,
        bytes: new Uint8Array([0xa9, 0x00, 0x60]),
        kind: 'code',
      },
    ]);

    expect(codeBlocks).toEqual([
      { name: 'SCROLL', address: 49152, size: 3, kind: 'code' },
    ]);
  });

  it('records no blocks for a document that carries none', () => {
    expect(programVocabulary('10 SYS 49152', c64).codeBlocks).toEqual([]);
  });
});

describe('programVocabulary - variable names', () => {
  it('reads names in the source machine’s own spelling', () => {
    // `_` is a BBC name character and `%`/`$` end a name there, so all three
    // travel with the name rather than splitting it. Case travels with it too:
    // this ROM tells `A` from `a`, so folding here would hand the porting
    // comparison one name where the program has two.
    const vocab = programVocabulary(
      '10 my_count%=1\n20 total$="x"\n30 PRINT my_count%',
      bbc,
    );
    expect(vocab.variables).toEqual(['my_count%', 'total$']);
  });

  it('keeps two spellings of a name apart on a machine that does', () => {
    expect(programVocabulary('10 a=1\n20 A=2', bbc).variables).toEqual([
      'A',
      'a',
    ]);
  });

  it('folds two spellings of a name together on a machine that does', () => {
    // Nothing to report on a C64: `a` and `A` were never two variables there.
    expect(programVocabulary('10 a=1\n20 A=2', c64).variables).toEqual(['A']);
  });

  it('takes no name from a string, a REM or a #BIN payload', () => {
    // The same three spans the keyword scan is blind to. Each of these would
    // otherwise contribute a name that is not in the program at all.
    const vocab = programVocabulary(
      [
        '10 A=1',
        '20 PRINT "SCORE IS ";A',
        '30 REM BONUS COUNTER',
        '#BIN 8000 QUJDREVGRw==',
      ].join('\n'),
      c64,
    );
    expect(vocab.variables).toEqual(['A']);
  });

  it('does not read a keyword as a name', () => {
    // On a crunching ROM `FORI=1TO10` is FOR I = 1 TO 10, so the only name is I.
    expect(programVocabulary('10 FORI=1TO10:NEXTI', c64).variables).toEqual([
      'I',
    ]);
  });

  it('does not read a PROC or FN call as a name', () => {
    const vocab = programVocabulary(
      '10 PROCdraw(size)\n20 PRINT FNarea(size)',
      bbc,
    );
    expect(vocab.variables).toEqual(['size']);
  });
});

describe('programVocabulary - fractional arithmetic', () => {
  it('reports a division and a fractional literal apart', () => {
    expect(programVocabulary('10 A=B/2', c64)).toMatchObject({
      divides: true,
      fractionalLiteral: false,
    });
    expect(programVocabulary('10 A=B*0.5', c64)).toMatchObject({
      divides: false,
      fractionalLiteral: true,
    });
    expect(programVocabulary('10 A=B/2+1.5', c64)).toMatchObject({
      divides: true,
      fractionalLiteral: true,
    });
  });

  it('reports neither for a program that has only integers', () => {
    expect(programVocabulary('10 A=B*2:PRINT A', c64)).toMatchObject({
      divides: false,
      fractionalLiteral: false,
    });
  });

  it('does not read a slash or a decimal point out of a string or a REM', () => {
    // A filename and a price are text, not arithmetic - and a machine with no
    // fractions would otherwise be told to rescale a program that has none.
    const vocab = programVocabulary(
      '10 PRINT "0/1 AND 2.5"\n20 REM COSTS 1.99 PER 10/12',
      c64,
    );
    expect(vocab).toMatchObject({ divides: false, fractionalLiteral: false });
  });
});

describe('programVocabulary - large whole numbers', () => {
  it('collects the values a 16-bit integer machine could not hold', () => {
    const vocab = programVocabulary('10 A=100000\n20 B=32768', bbc);
    expect(vocab.largeNumbers).toEqual([32768, 100000]);
  });

  it('ignores values every integer machine here holds', () => {
    expect(programVocabulary('10 A=32767:B=1000', bbc).largeNumbers).toEqual(
      [],
    );
  });

  it('reports each value once however often the program writes it', () => {
    const vocab = programVocabulary('10 A=70000\n20 B=70000\n30 C=70000', bbc);
    expect(vocab.largeNumbers).toEqual([70000]);
  });

  it('does not read a number out of a string or a REM', () => {
    // A serial number in a message is text: the target holding it or not says
    // nothing about what the program computes.
    const vocab = programVocabulary(
      '10 PRINT "ORDER 900000"\n20 REM SEE 123456',
      bbc,
    );
    expect(vocab.largeNumbers).toEqual([]);
  });

  it('does not read a hex literal or a fractional one as a whole number', () => {
    // `&FFFF` is 65535 and would be a finding if it were written that way; read
    // as a decimal run the scan would report the machine's own address notation
    // as a value the target cannot hold.
    expect(programVocabulary('10 A=&8000:B=&H9000', bbc).largeNumbers).toEqual(
      [],
    );
    expect(programVocabulary('10 A=40000.5', bbc).largeNumbers).toEqual([]);
  });

  // The bound only holds while it is the narrowest ceiling on offer. A machine
  // registering with a narrower integer range would make the census silently
  // miss the values that machine cannot hold, so it fails here instead.
  it('collects from below every registered integer machine’s ceiling', () => {
    for (const facts of portingFacts) {
      const range = facts.numbers.range;
      if (range === undefined) continue;
      expect(
        LARGE_NUMBER_FLOOR,
        `${facts.id} stops at ${range.max}, below the census floor`,
      ).toBeLessThanOrEqual(range.max + 1);
    }
  });
});

describe('programVocabulary - screen modes', () => {
  const atom = getDialect('atom');

  it('collects the modes selected with a constant argument', () => {
    expect(programVocabulary('10 MODE 7\n20 MODE 1', bbc).screenModes).toEqual({
      command: 'MODE',
      modes: [1, 7],
      computed: false,
    });
  });

  // The BBC's own listings write it glued to its argument, which is not a
  // broken word boundary but the way the machine's editor accepts it.
  it('reads a mode glued to its keyword', () => {
    expect(programVocabulary('10 MODE7', bbc).screenModes?.modes).toEqual([7]);
  });

  // Every machine with a mode command is an Acorn, so every one of them takes
  // the dotted spelling too. A scan blind to it would report the program as
  // having stayed in the mode it booted in - and the porting guide would offer
  // memory this program has already claimed.
  it('reads a mode selected through the machine’s short spelling', () => {
    expect(programVocabulary('10 MO.1', bbc).screenModes?.modes).toEqual([1]);
    expect(programVocabulary('10 C.4', atom).screenModes?.modes).toEqual([4]);
  });

  it('does not read a short spelling glued to a longer name', () => {
    expect(programVocabulary('10 XMO.1', bbc).screenModes?.modes).toEqual([]);
    expect(
      programVocabulary('10 PRINT "MO.1"', bbc).screenModes?.modes,
    ).toEqual([]);
  });

  it('marks a short spelling with a computed argument as computed', () => {
    expect(programVocabulary('10 MO.X', bbc).screenModes?.computed).toBe(true);
  });

  it('reads the Atom mode command, which is CLEAR', () => {
    expect(programVocabulary('10 CLEAR 0', atom).screenModes).toEqual({
      command: 'CLEAR',
      modes: [0],
      computed: false,
    });
  });

  it('flags a mode the text does not fix rather than guessing one', () => {
    // Each of these is a mode this scan cannot name, and a reader of it decides
    // whether memory is free: an unnamed mode is not a mode that can be ruled
    // out.
    expect(programVocabulary('10 MODE M', bbc).screenModes).toEqual({
      command: 'MODE',
      modes: [],
      computed: true,
    });
    expect(programVocabulary('10 MODE 4+N', bbc).screenModes?.computed).toBe(
      true,
    );
    expect(programVocabulary('10 MODE &07', bbc).screenModes?.computed).toBe(
      true,
    );
  });

  it('keeps the constants it did read alongside the flag', () => {
    const modes = programVocabulary('10 MODE 7\n20 MODE M', bbc).screenModes;
    expect(modes).toEqual({ command: 'MODE', modes: [7], computed: true });
  });

  it('selects nothing from a string literal or a REM tail', () => {
    expect(
      programVocabulary('10 PRINT "MODE 1"\n20 REM MODE 2', bbc).screenModes,
    ).toEqual({ command: 'MODE', modes: [], computed: false });
  });

  it('is not fooled by a variable the keyword starts', () => {
    expect(programVocabulary('10 MODEL%=2', bbc).screenModes).toEqual({
      command: 'MODE',
      modes: [],
      computed: false,
    });
  });

  it('reports nothing on a machine with no mode command', () => {
    expect(programVocabulary('10 POKE 53272,23', c64).screenModes).toBe(null);
    expect(programVocabulary('10 POKE 23606,0', spectrum).screenModes).toBe(
      null,
    );
  });
});

describe('programVocabulary - print positions', () => {
  const trs80 = getDialect('trs80');
  const cpc = getDialect('cpc464');
  const apple2 = getDialect('apple2');

  it('collects a whole position in the machine’s own argument order', () => {
    // Row first on the Sinclairs, column first on a CPC, and both mean the same
    // cell - which is the whole reason the order is authored per machine.
    expect(
      programVocabulary('10 PRINT AT 5,3;"X"', spectrum).positions,
    ).toEqual({
      cells: [{ row: 5, column: 3 }],
      columns: [],
      rows: [],
      offsets: [],
      origin: 0,
      computed: false,
    });
    expect(programVocabulary('10 LOCATE 3,5', cpc).positions).toEqual({
      cells: [{ row: 5, column: 3 }],
      columns: [],
      rows: [],
      offsets: [],
      origin: 1,
      computed: false,
    });
  });

  it('collects a bare column apart from a whole position', () => {
    const v = programVocabulary(
      '10 PRINT TAB 12;"A"\n20 PRINT AT 2,4;"B"',
      spectrum,
    );
    expect(v.positions?.columns).toEqual([12]);
    expect(v.positions?.cells).toEqual([{ row: 2, column: 4 }]);
  });

  it('reads a bracketed argument as a constant, not an expression', () => {
    // `)` is what ends the argument here, and a scan that read it as an
    // expression continuing would report every BBC layout as computed.
    expect(programVocabulary('10 PRINT TAB(35,4);"X"', bbc).positions).toEqual({
      cells: [{ row: 4, column: 35 }],
      columns: [],
      rows: [],
      offsets: [],
      origin: 0,
      computed: false,
    });
  });

  it('reads the BBC’s one-argument TAB as a column', () => {
    expect(programVocabulary('10 PRINT TAB(35);"X"', bbc).positions).toEqual({
      cells: [],
      columns: [35],
      rows: [],
      offsets: [],
      origin: 0,
      computed: false,
    });
  });

  it('collects a bare row apart from a bare column', () => {
    // The Apple II addresses the two halves separately - TAB is the column and
    // VTAB the row - so a listing states half a position at a time and the two
    // halves are checked against different dimensions.
    expect(
      programVocabulary('10 VTAB 20\n20 TAB 12\n', apple2).positions,
    ).toEqual({
      cells: [],
      columns: [12],
      rows: [20],
      offsets: [],
      origin: 1,
      computed: false,
    });
  });

  it('collects a single offset on the machine that has one', () => {
    expect(programVocabulary('10 PRINT @ 540,"X"', trs80).positions).toEqual({
      cells: [],
      columns: [],
      rows: [],
      offsets: [540],
      origin: 0,
      computed: false,
    });
  });

  it('reads the operands of a position control code', () => {
    // The escape scan records a code's leading byte and throws these away,
    // which is right for what it is for and useless for a layout.
    expect(
      programVocabulary('10 PRINT "{AT 5,30}HELLO"', spectrum).positions,
    ).toEqual({
      cells: [{ row: 5, column: 30 }],
      columns: [],
      rows: [],
      offsets: [],
      origin: 0,
      computed: false,
    });
  });

  it('states no position from inside a string or a REM tail', () => {
    const v = programVocabulary(
      '10 PRINT "AT 5,3"\n20 REM PRINT AT 9,9',
      spectrum,
    );
    expect(v.positions).toEqual({
      cells: [],
      columns: [],
      rows: [],
      offsets: [],
      origin: 0,
      computed: false,
    });
  });

  it('flags a position the text does not fix rather than guessing one', () => {
    expect(
      programVocabulary('10 PRINT AT R,C;"X"', spectrum).positions?.computed,
    ).toBe(true);
    expect(
      programVocabulary('10 PRINT AT 5,C+1;"X"', spectrum).positions?.computed,
    ).toBe(true);
    expect(
      programVocabulary('10 PRINT TAB(N);"X"', bbc).positions?.computed,
    ).toBe(true);
  });

  it('keeps the positions it did read alongside the flag', () => {
    const v = programVocabulary(
      '10 PRINT AT 2,4;"A"\n20 PRINT AT R,C;"B"',
      spectrum,
    );
    expect(v.positions).toEqual({
      cells: [{ row: 2, column: 4 }],
      columns: [],
      rows: [],
      offsets: [],
      origin: 0,
      computed: true,
    });
  });

  it('is not fooled by a name the keyword starts or ends', () => {
    expect(
      programVocabulary('10 LET DATA=1', spectrum).positions?.cells,
    ).toEqual([]);
    expect(
      programVocabulary('10 LET ATOM=1', spectrum).positions?.computed,
    ).toBe(false);
  });

  it('reports nothing on a machine that states no positions', () => {
    expect(programVocabulary('10 PRINT "HI"', c64).positions).toBe(null);
    expect(
      programVocabulary('10 PRINT "HI"', getDialect('atom')).positions,
    ).toBe(null);
  });
});

describe('programVocabulary - empty counting loops', () => {
  const atom = getDialect('atom');

  it('finds a loop with nothing between its FOR and its NEXT', () => {
    expect(
      programVocabulary('10 FOR I=1 TO 500\n20 NEXT I', spectrum)
        .emptyLoopLines,
    ).toEqual([10]);
  });

  it('finds one written on a single line', () => {
    expect(
      programVocabulary('10 PRINT "A"\n20 FOR I=1 TO 500: NEXT I', spectrum)
        .emptyLoopLines,
    ).toEqual([20]);
  });

  it('does not call a loop with a body a delay', () => {
    expect(
      programVocabulary('10 FOR I=1 TO 10\n20 PRINT I\n30 NEXT I', spectrum)
        .emptyLoopLines,
    ).toEqual([]);
    expect(
      programVocabulary('10 FOR I=1 TO 10: PRINT I: NEXT I', spectrum)
        .emptyLoopLines,
    ).toEqual([]);
  });

  it('reads a stepped loop as the delay it is', () => {
    expect(
      programVocabulary('10 FOR I=1 TO 500 STEP 2\n20 NEXT I', spectrum)
        .emptyLoopLines,
    ).toEqual([10]);
  });

  // A nest that does nothing but count is a delay at every level of itself,
  // and each level is a count someone tuned.
  it('reads a nest of empty loops as empty throughout', () => {
    expect(
      programVocabulary(
        '10 FOR I=1 TO 10\n20 FOR J=1 TO 10\n30 NEXT J\n40 NEXT I',
        spectrum,
      ).emptyLoopLines,
    ).toEqual([10, 20]);
  });

  it('reads a NEXT that closes two loops as closing two', () => {
    expect(
      programVocabulary(
        '10 FOR I=1 TO 10\n20 FOR J=1 TO 10\n30 NEXT J,I',
        spectrum,
      ).emptyLoopLines,
    ).toEqual([10, 20]);
  });

  it('reads a delay written in the machine’s short spelling', () => {
    expect(
      programVocabulary('10 F.I=1TO500\n20 N.I', bbc).emptyLoopLines,
    ).toEqual([10]);
  });

  it('reads one on a machine that ignores spaces', () => {
    expect(
      programVocabulary('10 FORI=1TO500\n20 NEXTI', c64).emptyLoopLines,
    ).toEqual([10]);
  });

  it('separates statements the way the machine does', () => {
    // The Atom separates with ';', so a ':' between these two is not a
    // statement boundary and the loop is not closed on that line.
    expect(
      programVocabulary('10 FOR I=1 TO 500; NEXT I', atom).emptyLoopLines,
    ).toEqual([10]);
  });

  it('finds no loop in a string literal or a REM tail', () => {
    expect(
      programVocabulary('10 REM FOR I=1 TO 5: NEXT I', spectrum).emptyLoopLines,
    ).toEqual([]);
  });

  it('ignores a NEXT with nothing open', () => {
    expect(programVocabulary('10 NEXT I', spectrum).emptyLoopLines).toEqual([]);
  });
});

describe('programVocabulary - no program', () => {
  it('is empty for an empty program', () => {
    expect(programVocabulary('', c64)).toEqual({
      dialectId: 'commodore64',
      keywords: [],
      spellings: [],
      variables: [],
      divides: false,
      fractionalLiteral: false,
      largeNumbers: [],
      escapeCodes: [],
      characters: [],
      multiStatementLines: [],
      extraStatements: 0,
      lineNumbers: null,
      writeSites: [],
      readSites: [],
      callSites: [],
      codeBlocks: [],
      screenModes: null,
      positions: null,
      emptyLoopLines: [],
    });
  });

  it('is empty for text with nothing recognisable in it', () => {
    expect(programVocabulary('10 zzz=1', c64).keywords).toEqual([]);
  });

  it('answers for the dialect it was asked about, not the program', () => {
    // The same text read as two languages: what a program's vocabulary *is*
    // depends on which BASIC reads it.
    expect(programVocabulary('10 FORI=1TO10', c64).keywords).toEqual([
      'FOR',
      'TO',
    ]);
    expect(programVocabulary('10 FORI=1TO10', bbc).keywords).toEqual([]);
  });
});
