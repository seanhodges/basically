import { describe, expect, it } from 'vitest';
import { parseC64Char, petsciiToText } from './petscii';
import { c64Charset } from './charset';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';
import { C64_GRAPHICS } from './graphics';

describe('C64 PETSCII table', () => {
  it('gives every one of the 256 codes a unique text form', () => {
    const texts = new Set<string>();
    for (let code = 0; code < 256; code++) texts.add(petsciiToText(code));
    expect(texts.size).toBe(256);
  });

  it('round-trips every code byte-exactly (code -> text -> code)', () => {
    for (let code = 0; code < 256; code++) {
      const text = petsciiToText(code);
      const parsed = parseC64Char(text, 0);
      expect(parsed.code).toBe(code);
      // The whole text form is a single unit (glyph or one {…} escape).
      expect(parsed.length).toBe(text.length);
    }
  });

  it('names the common control codes petcat-style', () => {
    expect(petsciiToText(0x11)).toBe('{down}');
    expect(petsciiToText(0x91)).toBe('{up}');
    expect(petsciiToText(0x12)).toBe('{rvon}');
    expect(petsciiToText(0x92)).toBe('{rvoff}');
    expect(petsciiToText(0x93)).toBe('{clr}');
    expect(petsciiToText(0x1c)).toBe('{red}');
  });

  it('maps genuine-duplicate/undefined bytes to numeric {$xx} escapes', () => {
    // $AA draws the same right bar as the canonical $A7 (▕) in the real
    // character ROM, so it stays a numeric escape to keep the map injective.
    expect(petsciiToText(0xa7)).toBe('▕');
    expect(petsciiToText(0xaa)).toBe('{$aa}');
    expect(parseC64Char('{$aa}', 0)).toEqual({ code: 0xaa, length: 5 });
  });

  it('gives the ROM-distinct half/eighth-block shades their true glyph', () => {
    // These twelve codes look like duplicates in the viciious font but are
    // distinct in the genuine character ROM; each takes a Symbols-for-Legacy-
    // Computing glyph so it round-trips to its own byte rather than {$xx}.
    const distinct = [
      0xa8, 0xb6, 0xb7, 0xb8, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xd4, 0xd9, 0xdc,
    ];
    for (const code of distinct) {
      const text = petsciiToText(code);
      expect(text.startsWith('{'), `$${code.toString(16)} → ${text}`).toBe(
        false,
      );
      expect(parseC64Char(text, 0).code).toBe(code);
    }
  });

  it('accepts named and numeric escapes case-insensitively', () => {
    expect(parseC64Char('{DOWN}', 0)).toEqual({ code: 0x11, length: 6 });
    expect(parseC64Char('{$A8}', 0)).toEqual({ code: 0xa8, length: 5 });
  });

  it('throws on an unterminated or unknown escape', () => {
    expect(() => parseC64Char('{down', 0)).toThrow();
    expect(() => parseC64Char('{nope}', 0)).toThrow();
  });

  it('names the function keys and shifted space petcat-style', () => {
    expect(petsciiToText(0x85)).toBe('{f1}');
    expect(petsciiToText(0x86)).toBe('{f3}');
    expect(petsciiToText(0x87)).toBe('{f5}');
    expect(petsciiToText(0x88)).toBe('{f7}');
    expect(petsciiToText(0x89)).toBe('{f2}');
    expect(petsciiToText(0x8a)).toBe('{f4}');
    expect(petsciiToText(0x8b)).toBe('{f6}');
    expect(petsciiToText(0x8c)).toBe('{f8}');
    expect(petsciiToText(0xa0)).toBe('{shift-space}');
    // and they parse back
    expect(parseC64Char('{f7}', 0)).toEqual({ code: 0x88, length: 4 });
    expect(parseC64Char('{shift-space}', 0).code).toBe(0xa0);
  });

  it('accepts petcat/VICE control aliases on parse', () => {
    // Short petcat spellings map to the same codes as our canonical names.
    const cases: Array<[string, number]> = [
      ['{wht}', 0x05],
      ['{blk}', 0x90],
      ['{grn}', 0x1e],
      ['{blu}', 0x1f],
      ['{yel}', 0x9e],
      ['{cyn}', 0x9f],
      ['{pur}', 0x9c],
      ['{lred}', 0x96],
      ['{orng}', 0x81],
      ['{brn}', 0x95],
      ['{gry1}', 0x97],
      ['{gry2}', 0x98],
      ['{gry3}', 0x9b],
      ['{lgrn}', 0x99],
      ['{lblu}', 0x9a],
      ['{rght}', 0x1d],
      ['{rvof}', 0x92],
      ['{sret}', 0x8d],
      ['{swlc}', 0x0e],
      ['{swuc}', 0x8e],
      ['{space}', 0x20],
    ];
    for (const [text, code] of cases) {
      expect(parseC64Char(text, 0).code, text).toBe(code);
    }
  });

  it('accepts {CBM-x} / {SHIFT-x} key-graphic names', () => {
    // The C= and SHIFT graphic on the A key: $B0 and $C1 respectively.
    expect(parseC64Char('{CBM-A}', 0).code).toBe(0xb0);
    expect(parseC64Char('{SHIFT-A}', 0).code).toBe(0xc1);
    expect(parseC64Char('{shift-z}', 0).code).toBe(0xda);
  });

  it('accepts decimal {nnn} codes and rejects out-of-range ones', () => {
    expect(parseC64Char('{5}', 0)).toEqual({ code: 5, length: 3 });
    expect(parseC64Char('{160}', 0)).toEqual({ code: 160, length: 5 });
    expect(parseC64Char('{255}', 0)).toEqual({ code: 255, length: 5 });
    expect(() => parseC64Char('{256}', 0)).toThrow();
  });

  it('keeps the keyboard graphics legends in sync with the table', () => {
    // Every glyph the virtual keyboard can insert must round-trip to itself,
    // so graphics.ts and the PETSCII table can never drift apart.
    for (const { char } of C64_GRAPHICS) {
      const code = c64Charset.toMachine(char)[0]!;
      expect(c64Charset.glyph(code)).toBe(char);
    }
  });

  it('inserts the exact PETSCII byte for the ROM-distinct graphic keys', () => {
    // The half/eighth-block shades now carry their true glyph, so pressing the
    // key inserts a char that tokenizes to that key's real code — not a twin's.
    const distinct = new Set([
      0xa8, 0xb6, 0xb7, 0xb8, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xd4, 0xd9, 0xdc,
    ]);
    const covered = new Set<number>();
    for (const { char, petscii } of C64_GRAPHICS) {
      if (!distinct.has(petscii)) continue;
      expect(
        c64Charset.toMachine(char)[0],
        `key for $${petscii.toString(16)}`,
      ).toBe(petscii);
      covered.add(petscii);
    }
    // Every ROM-distinct code appears on a key and is asserted above.
    expect(covered.size).toBe(distinct.size);
  });
});

/** Prepend the .prg load address to a bare $0801 program body. */
function toPrg(program: number[]): Uint8Array {
  return Uint8Array.from([0x01, 0x08, ...program]);
}

/** Build a bare $0801 program body from line records, with absolute links. */
function buildProgram(
  lines: Array<{ lineNo: number; body: number[] }>,
): number[] {
  const out: number[] = [];
  let addr = 0x0801;
  for (const { lineNo, body } of lines) {
    const next = addr + 2 + 2 + body.length + 1;
    out.push(
      next & 0xff,
      (next >> 8) & 0xff,
      lineNo & 0xff,
      (lineNo >> 8) & 0xff,
    );
    out.push(...body, 0x00);
    addr = next;
  }
  out.push(0x00, 0x00);
  return out;
}

describe('C64 lossless import round-trip', () => {
  it('round-trips every byte held in a DATA string', () => {
    // Pack all 255 non-zero codes (0x00 ends a line, 0x22 closes the string)
    // into DATA"…" literals, 16 per line, then detokenize -> tokenize and
    // compare bytes. Proves the full charset survives a real import/export.
    const lines: Array<{ lineNo: number; body: number[] }> = [];
    let lineNo = 10;
    for (let start = 1; start < 256; start += 16) {
      const chunk: number[] = [];
      for (let c = start; c < start + 16 && c < 256; c++) {
        if (c !== 0x22) chunk.push(c);
      }
      lines.push({ lineNo, body: [0x83, 0x22, ...chunk, 0x22] });
      lineNo += 10;
    }
    const original = buildProgram(lines);

    const source = detokenizeProgram(toPrg(original));
    const { program, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    expect(Array.from(program)).toEqual(original);
  });

  it('losslessly imports the reported character-set .prg', () => {
    // The program from the bug report: a startup that builds a custom character
    // set by PRINTing block-graphics strings held in DATA. Base64 of the exact
    // .prg attached to the issue.
    const B64 =
      'AQgpCAUAjyBTT1VUSEVSTiBIRU1JU1BIRVJFIExFTjY0IFNUQVJUVVAAUAgKAJc2NDgsNDg6mccoMTkpOzqBSbIxpDI2OodBJDqZQSQ7OoIAjAgUAJc1MzI3Miwowig1MzI3MimvMjQwKaoxMjqXNjQ4LDQ6gUmyMTM1NjikMTM1NzU6l0ksMjU1OoIAuQgeAJkgxygxNDcpIhEREREREREREREREREREREREREiozM1KSJZREFFUiIA6AgyAJkiIEVFUkYgU0VUWUIgQ0lTQUIgMTE5ODMgIE1FVFNZUyBNQVIgSzQ2IgDuCDwAmQAnCUYAmSIgICAgKioqKiAyViBDSVNBQiA0NiBFUk9ET01NT0MgKioqKiI7IpGRkZGRkSAgICAiOwBCCVAAlzIwNCwwOiChSyQ6i0sksiIipyA4MABmCVoAgyJAPMZGtramPECmpqa+pjxYQD6mpj6mpj5APKZGIgB6CWQAgyJGRqY8QF42pqamNl4iAJ8JbgCDIkC+RkZeRka+QEZGRl5GRr5APKamtkamPECmpqa+IgCyCXgAgyKmpqZAPFhYWFhYPCIA1wmCAIMiQFw2MDAwMLhApjZeTl42pkC+RkZGRkZGQBLGxsYiAOwJjACDIta+rsaSQKamtr6+rqYiABEKlgCDIkA8pqampqY8QEZGRj6mpj5AsDympqamPECmNl4+IgAkCqAAgyKmpj5APKagPEamPCIASAqqAIMiQFhYWFhYWL5APKampqampkBYPKampqamQBLGriIAXgq0AIMivtbGxsaSQKamPFg8pqYiAIIKvgCDIkBYWFg8pqamQL5GTFgwoL48MDAwMDA8QEA/xkwiAJYKyACDIj5MyDBAPDAwMDAwPCIAugrSAIMiWFhYWL48WEBASEwSvr6STEhAQEBAQEBAQEBAWCIA0ArcAIMiQEBYWFhYQEBAQECmpqYiAPQK5gCDIkCmphK/kqYSv5KmpkBYPqA8RrxYQKKmTFgwpsYiABAL8ACDIkASvJKmEqaSXDymPEBAQEBAWDCgIgA0C/oAgyJAMFhMTExYMEBMWDAwMFhMQECmPBK/kjymQEBYIgBKCwQBgyJYvlhYQEBMWFhAQEBAQCIAbgsOAYMiQEBAQL5AQEBAWFhAQEBAQEBGTFgwoBLAkkBAPCIAhAsYAYMipqautqY8QL5YWFhcWFgiAKgLIgGDIkC+RkwwoKY8QDymoDigpjxAoKASvpKmuLCgQDwiAL4LLAGDIqagoD5GvkA8pqY+RqY8IgDiCzYBgyJAWFhYWDCmvkA8pqY8pqY8QDymoLympjxAQFhAIgD2C0ABgyJAWEBATFhYQEBYQEAiABoMSgGDIkCwWExGTFiwQEBAvkC+QEBATlgwoDBYTkBYQFgiACYMVAGDIjCgpjwiAAAA';
    const prg = Uint8Array.from(Buffer.from(B64, 'base64'));

    const source = detokenizeProgram(prg);
    // The graphics survive as glyphs and the cursor codes as escapes.
    expect(source).toContain('▒');
    expect(source).toContain('{down}');
    expect(source).not.toContain('SPC(5'); // no in-string byte became a keyword

    // Byte-exact: re-tokenizing reproduces the identical program bytes.
    const { program, errors } = tokenizeProgram(source);
    expect(errors).toEqual([]);
    expect(Array.from(program)).toEqual(Array.from(prg.subarray(2)));
  });
});
