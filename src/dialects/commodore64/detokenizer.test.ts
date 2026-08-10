import { describe, expect, it } from 'vitest';
import { detokenizeProgram, detokenizeProgramWithReport } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { commodore64 } from './index';
import { importRoundTrip, isAcceptableImport } from '../roundTripHarness';

/** Assemble a bare $0801 program image from raw line records for detokenizing. */
function buildImage(
  lines: Array<{ lineNo: number; body: number[] }>,
  withLoadAddress = true,
): Uint8Array {
  const bytes: number[] = [];
  if (withLoadAddress) bytes.push(0x01, 0x08);
  let addr = 0x0801;
  for (const { lineNo, body } of lines) {
    const next = addr + 2 + 2 + body.length + 1;
    bytes.push(next & 0xff, (next >> 8) & 0xff);
    bytes.push(lineNo & 0xff, (lineNo >> 8) & 0xff);
    bytes.push(...body, 0x00);
    addr = next;
  }
  bytes.push(0x00, 0x00);
  return Uint8Array.from(bytes);
}

describe('Commodore 64 detokenizer', () => {
  it('expands keyword tokens outside strings', () => {
    // PRINT(0x99) SPC((0xa6) then "5)" — a genuine SPC( call.
    const image = buildImage([{ lineNo: 10, body: [0x99, 0xa6, 0x35, 0x29] }]);
    expect(detokenizeProgram(image)).toBe('10 PRINTSPC(5)\n');
  });

  it('does NOT expand keyword-range bytes inside a string literal', () => {
    // The DATA(0x83) string holds PETSCII block graphics whose codes overlap
    // the keyword range: 0xa3 (TAB(), 0xb0 (OR), 0xbe (COS), 0xc6 (ASC).
    // Inside quotes these are graphics, not tokens, and must list as glyphs.
    const image = buildImage([
      { lineNo: 20, body: [0x83, 0x22, 0xa3, 0xb0, 0xbe, 0xc6, 0x22] },
    ]);
    const text = detokenizeProgram(image);
    expect(text).not.toContain('TAB(');
    expect(text).not.toContain('OR');
    expect(text).not.toContain('COS');
    expect(text).not.toContain('ASC');
    // $A3/$B0/$BE render as their canonical glyphs; $C6 is a ROM-distinct
    // horizontal-eighth block with its own Symbols-for-Legacy-Computing glyph.
    expect(text).toBe('20 DATA"▔┌▘🭹"\n');
  });

  it('round-trips block graphics held in DATA strings', () => {
    // Graphics inside a string survive tokenize -> detokenize unchanged, rather
    // than reappearing as the keywords their PETSCII codes collide with.
    const source = '10 DATA"┌▘─▔"\n';
    const { image: prg } = tokenizeC64(source);
    expect(detokenizeProgram(prg)).toBe(source);
  });

  it('treats a keyword byte after a closing quote as a token again', () => {
    // "..."(0x22 open, 0x22 close) then SPC((0xa6): quote state resets so the
    // trailing 0xa6 is a token, while the 0xa6 inside the quotes is a glyph.
    const image = buildImage([
      { lineNo: 30, body: [0x99, 0x22, 0xbe, 0x22, 0xa6, 0x35, 0x29] },
    ]);
    // Inside: 0xbe -> '▘'. Outside: 0xa6 -> 'SPC('.
    expect(detokenizeProgram(image)).toBe('30 PRINT"▘"SPC(5)\n');
  });

  it('renders control codes as petcat-style escapes', () => {
    // PRINT "{down}{rvon}{clr}" — cursor-down, reverse-on, clear-screen codes.
    const image = buildImage([
      { lineNo: 40, body: [0x99, 0x22, 0x11, 0x12, 0x93, 0x22] },
    ]);
    expect(detokenizeProgram(image)).toBe('40 PRINT"{down}{rvon}{clr}"\n');
  });

  it('keeps REM and DATA verbatim bytes out of keyword expansion', () => {
    // A graphics byte ($A6) stored verbatim after REM, and after an unquoted
    // DATA value, must list as its glyph rather than the SPC( keyword its code
    // collides with — otherwise it would not re-tokenize to the same byte.
    const rem = buildImage([{ lineNo: 50, body: [0x8f, 0x20, 0xa6] }]);
    expect(detokenizeProgram(rem)).toBe('50 REM ▒\n');

    const data = buildImage([{ lineNo: 60, body: [0x83, 0xa6, 0x3a, 0x99] }]);
    // The unquoted ':' ends DATA, so the following $99 expands to PRINT again.
    expect(detokenizeProgram(data)).toBe('60 DATA▒:PRINT\n');
  });
});

describe('Commodore 64 LIST expands abbreviations', () => {
  it('lists a program entered with abbreviations in full spellings', () => {
    // A shifted-letter abbreviation is entry notation, not stored text: the
    // token is the same byte the full spelling stores, so LIST spells it out.
    const short = tokenizeProgram('10 pO53280,0\n20 goS100\n').program;
    const full = tokenizeProgram('10 POKE53280,0\n20 GOSUB100\n').program;
    expect(Array.from(short)).toEqual(Array.from(full));
    expect(detokenizeProgram(short)).toBe('10 POKE53280,0\n20 GOSUB100\n');
  });
});

describe('Commodore 64 import report (detokenizeWithReport)', () => {
  it('decodes a clean .prg with no warnings', () => {
    const { program } = tokenizeProgram('10 PRINT "HI"\n');
    const prg = Uint8Array.from([0x01, 0x08, ...program]);
    const { source, warnings } = detokenizeProgramWithReport(prg);
    expect(source).toBe('10 PRINT "HI"\n');
    expect(warnings).toEqual([]);
  });

  it('warns about machine code appended after a hybrid SYS .prg', () => {
    // The classic loader: a one-line BASIC stub that SYSes into machine code
    // stored right after the program's end-of-program marker.
    const { program } = tokenizeProgram('10 SYS 2064\n');
    const ml = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60]; // LDA #0 STA $D020 RTS
    const prg = Uint8Array.from([0x01, 0x08, ...program, ...ml]);

    const { source, warnings } = detokenizeProgramWithReport(prg);
    expect(source).toBe('10 SYS 2064\n');
    expect(warnings.some((w) => /6 bytes.*machine code/i.test(w))).toBe(true);

    // The BASIC portion still re-tokenizes byte-exactly (the ML is not part of
    // the text, so the loss is reported rather than silent).
    const { program: reprog, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    expect(Array.from(reprog)).toEqual(Array.from(program));
  });

  it('warns when the load address is not $0801', () => {
    const { program } = tokenizeProgram('10 PRINT "HI"\n');
    const prg = Uint8Array.from([0x01, 0x10, ...program]); // $1001 = VIC-20
    const { warnings } = detokenizeProgramWithReport(prg);
    expect(warnings.some((w) => /load address is \$1001/i.test(w))).toBe(true);
  });

  it('warns when the image is truncated mid-program', () => {
    const { program } = tokenizeProgram('10 PRINT "A LONGISH LINE"\n');
    // Drop the trailing null link and a few bytes of the last line.
    const prg = Uint8Array.from([0x01, 0x08, ...program.slice(0, -6)]);
    const { warnings } = detokenizeProgramWithReport(prg);
    expect(warnings.some((w) => /truncated/i.test(w))).toBe(true);
  });
});

describe('C64 import blocks (detokenizeWithReport)', () => {
  it('returns a pure code block when the load address is not $0801', () => {
    // A .prg saved to an absolute address, e.g. $C000: not BASIC at all, so the
    // whole payload comes back as one code block and the source stays empty.
    const ml = [0xa9, 0x02, 0x8d, 0x20, 0xd0, 0x60]; // LDA #2 STA $D020 RTS
    const prg = Uint8Array.from([0x00, 0xc0, ...ml]); // load address $C000
    const { source, warnings, blocks } = detokenizeProgramWithReport(prg);
    expect(source).toBe('');
    expect(warnings.some((w) => /load address is \$c000/i.test(w))).toBe(true);
    expect(blocks).toEqual([
      {
        id: 'imported-code-1',
        name: 'code1',
        address: 0xc000,
        bytes: Uint8Array.from(ml),
        kind: 'code',
      },
    ]);
  });

  it('captures trailing machine code after a $0801 program as a block', () => {
    const { program } = tokenizeProgram('10 SYS 2064\n');
    const ml = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60]; // LDA #0 STA $D020 RTS
    const prg = Uint8Array.from([0x01, 0x08, ...program, ...ml]);

    const { source, warnings, blocks } = detokenizeProgramWithReport(prg);
    expect(source).toBe('10 SYS 2064\n');
    expect(warnings.some((w) => /6 bytes.*machine code/i.test(w))).toBe(true);
    expect(blocks).toHaveLength(1);
    const block = blocks![0]!;
    expect(block.name).toBe('code1');
    expect(block.kind).toBe('code');
    // The BASIC program occupies program.length bytes from $0801, so the
    // appended ML starts right after it.
    expect(block.address).toBe(0x0801 + program.length);
    expect(Array.from(block.bytes)).toEqual(ml);
  });

  it('omits blocks for a clean $0801 program with no trailing bytes', () => {
    const { program } = tokenizeProgram('10 PRINT "HI"\n');
    const prg = Uint8Array.from([0x01, 0x08, ...program]);
    const result = detokenizeProgramWithReport(prg);
    expect(result.blocks).toBeUndefined();
  });

  it('returns a PET-address block via the PET variant', () => {
    // A $0801 image handed to the PET decoder ($0401 base) is a foreign load
    // address, so it comes back as a code block at $0801, no source.
    const petVariant = {
      loadAddress: 0x0401,
      wordByToken: new Map<number, string>(),
      machineHint: 'C64/VIC-20 or machine-code',
      machineName: 'PET',
    };
    const prg = Uint8Array.from([0x01, 0x08, 0xaa, 0xbb]);
    const { source, blocks } = detokenizeProgramWithReport(prg, petVariant);
    expect(source).toBe('');
    expect(blocks).toEqual([
      {
        id: 'imported-code-1',
        name: 'code1',
        address: 0x0801,
        bytes: Uint8Array.from([0xaa, 0xbb]),
        kind: 'code',
      },
    ]);
  });
});

describe('C64 foreign-image round-trip fixtures', () => {
  it('a petcat-style listing pasted as source tokenizes and re-lists', () => {
    // Colour/cursor control codes written in petcat aliases, plus a graphics
    // string — the kind of thing pasted from an archive listing.
    const source = '10 PRINT "{wht}{clr}HI{down}"\n20 DATA "▌▄▔"\n';
    const first = commodore64.tokenize(source);
    expect(first.errors).toEqual([]);
    expect(first.image.length).toBeGreaterThan(0);

    // Re-listing canonicalises the aliases ({wht} -> {white}) but preserves the
    // bytes, so a second tokenize is byte-exact.
    const outcome = importRoundTrip(commodore64, first.image);
    expect(outcome.errors).toEqual([]);
    expect(outcome.byteExact).toBe(true);
    expect(outcome.source).toContain('{white}');
  });

  it('a hybrid SYS + machine-code .prg imports with a warning, BASIC exact', () => {
    const { program } = tokenizeProgram('10 SYS 2064\n');
    const ml = [0xa9, 0x00, 0x60];
    const prg = Uint8Array.from([0x01, 0x08, ...program, ...ml]);

    const outcome = importRoundTrip(commodore64, prg);
    // Not byte-exact (the ML payload is dropped) but the loss is reported, so
    // the import acceptance rule holds.
    expect(outcome.byteExact).toBe(false);
    expect(outcome.warnings.length).toBeGreaterThan(0);
    expect(isAcceptableImport(outcome)).toBe(true);
  });

  it('a shifted-bank text .prg round-trips its high-bank bytes exactly', () => {
    // A string of shifted-bank codes ($C1–$DA) — how a lower/upper-case-mode
    // program stores capitals. Most now carry a Legacy-Computing glyph; the few
    // whose ROM bitmap genuinely duplicates a primary (e.g. $C3) survive as a
    // {$xx} escape. Either way the bytes round-trip exactly with no errors.
    const body = [0x99, 0x22, 0xc1, 0xc3, 0xc8, 0xd4, 0xda, 0x22];
    const image = buildImage([{ lineNo: 10, body }]);
    const outcome = importRoundTrip(commodore64, image);
    expect(outcome.errors).toEqual([]);
    expect(outcome.byteExact).toBe(true);
    expect(outcome.source).toContain('{$c3}'); // the genuine-duplicate capital
  });
});

/** Tokenize helper that mirrors the dialect's .prg image (load address + body). */
function tokenizeC64(source: string): { image: Uint8Array } {
  const { program, errors } = tokenizeProgram(source);
  expect(errors).toEqual([]);
  const image = new Uint8Array(program.length + 2);
  image[0] = 0x01;
  image[1] = 0x08;
  image.set(program, 2);
  return { image };
}
