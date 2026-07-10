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

  it('maps duplicate/undefined bytes to numeric {$xx} escapes', () => {
    // $A8 draws the same shaded block as the canonical $A6, so it stays numeric.
    expect(petsciiToText(0xa6)).toBe('▒');
    expect(petsciiToText(0xa8)).toBe('{$a8}');
    expect(parseC64Char('{$a8}', 0)).toEqual({ code: 0xa8, length: 5 });
  });

  it('accepts named and numeric escapes case-insensitively', () => {
    expect(parseC64Char('{DOWN}', 0)).toEqual({ code: 0x11, length: 6 });
    expect(parseC64Char('{$A8}', 0)).toEqual({ code: 0xa8, length: 5 });
  });

  it('throws on an unterminated or unknown escape', () => {
    expect(() => parseC64Char('{down', 0)).toThrow();
    expect(() => parseC64Char('{nope}', 0)).toThrow();
  });

  it('keeps the keyboard graphics legends in sync with the table', () => {
    // Every glyph the virtual keyboard can insert must round-trip to itself,
    // so graphics.ts and the PETSCII table can never drift apart.
    for (const { char } of C64_GRAPHICS) {
      const code = c64Charset.toMachine(char)[0]!;
      expect(c64Charset.glyph(code)).toBe(char);
    }
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
