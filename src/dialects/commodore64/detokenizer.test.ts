import { describe, expect, it } from 'vitest';
import { detokenizeProgram } from './detokenizer';
import { tokenizeProgram } from './tokenizer';

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
    expect(text).toBe('20 DATA"▔┌▘─"\n');
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
