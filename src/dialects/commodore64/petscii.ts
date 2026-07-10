import { CharsetError } from '../types';

/**
 * Complete PETSCII <-> editor-text table for the Commodore 64 default
 * (upper-case / graphics) character set, giving a **byte-exact, lossless**
 * mapping for every one of the 256 codes a BASIC program can store inside a
 * string literal or a REM/DATA body.
 *
 * Each code has a single, unique text form so detokenize -> tokenize round-trips
 * to the identical bytes:
 *
 *  - **Printable glyphs** ($20-$5F text/punctuation, $A0-$DF block graphics, and
 *    the four specials £ ↑ ← π) render as their closest Unicode glyph. The glyphs
 *    are those of the vendored C64 font, taken from
 *    `src/emulator/c64/viciious/tools/c64FontCodePoints.js` (the same source the
 *    keyboard's {@link ./graphics} table cites), via the standard
 *    PETSCII -> screen-code mapping.
 *  - **Control codes** (cursor moves, colours, reverse on/off, case switch…)
 *    render as petcat/VICE-style named escapes: `{down}`, `{rvon}`, `{clr}`,
 *    `{red}`, and so on.
 *  - **Every remaining byte** — the duplicate graphics codes the C64 font draws
 *    identically to a lower "primary" code (e.g. $A8/$DC also draw as ▒), plus
 *    undefined control codes — renders as a numeric `{$xx}` escape. This keeps
 *    the map injective, so the round-trip stays byte-exact even for glyphs the
 *    font collapses.
 *
 * `{` and `}` are not valid PETSCII characters, so a `{...}` sequence is always
 * an escape and never ambiguous with literal text.
 */

// Code ($00-$FF) -> canonical editor text. Generated from the C64 font glyphs
// plus the control-code names below; see the module comment for the derivation.
// prettier-ignore
const PETSCII_TEXT: readonly string[] = [
  '{$00}','{$01}','{$02}','{stop}','{$04}','{white}','{$06}','{$07}','{dishift}','{enshift}','{$0a}','{$0b}','{$0c}','{cr}','{lower}','{$0f}', // $00
  '{$10}','{down}','{rvon}','{home}','{del}','{$15}','{$16}','{$17}','{$18}','{$19}','{$1a}','{$1b}','{red}','{right}','{green}','{blue}', // $10
  ' ','!','"','#','$','%','&',"'",'(',')','*','+',',','-','.','/', // $20
  '0','1','2','3','4','5','6','7','8','9',':',';','<','=','>','?', // $30
  '@','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O', // $40
  'P','Q','R','S','T','U','V','W','X','Y','Z','[','£',']','↑','←', // $50
  '{$60}','{$61}','{$62}','{$63}','{$64}','{$65}','{$66}','{$67}','{$68}','{$69}','{$6a}','{$6b}','{$6c}','{$6d}','{$6e}','{$6f}', // $60
  '{$70}','{$71}','{$72}','{$73}','{$74}','{$75}','{$76}','{$77}','{$78}','{$79}','{$7a}','{$7b}','{$7c}','{$7d}','{$7e}','{$7f}', // $70
  '{$80}','{orange}','{$82}','{$83}','{$84}','{$85}','{$86}','{$87}','{$88}','{$89}','{$8a}','{$8b}','{$8c}','{shift-cr}','{upper}','{$8f}', // $80
  '{black}','{up}','{rvoff}','{clr}','{inst}','{brown}','{pink}','{grey1}','{grey2}','{lgreen}','{lblue}','{grey3}','{purple}','{left}','{yellow}','{cyan}', // $90
  '{$a0}','▌','▄','▔','▁','▎','▒','▕','{$a8}','◤','{$aa}','├','▗','└','┐','▂', // $a0
  '┌','┴','┬','┤','{$b4}','▍','{$b6}','{$b7}','{$b8}','▃','⌟','▖','▝','┘','▘','▚', // $b0
  '─','♠','│','{$c3}','{$c4}','{$c5}','{$c6}','{$c7}','{$c8}','╮','╰','╯','⌞','╲','╱','⌜', // $c0
  '⌝','●','_','♥','{$d4}','╭','╳','○','♣','{$d9}','♦','┼','{$dc}','{$dd}','{$de}','◥', // $d0
  '{$e0}','{$e1}','{$e2}','{$e3}','{$e4}','{$e5}','{$e6}','{$e7}','{$e8}','{$e9}','{$ea}','{$eb}','{$ec}','{$ed}','{$ee}','{$ef}', // $e0
  '{$f0}','{$f1}','{$f2}','{$f3}','{$f4}','{$f5}','{$f6}','{$f7}','{$f8}','{$f9}','{$fa}','{$fb}','{$fc}','{$fd}','{$fe}','π', // $f0
];

// Inverse maps, built once from the table. Glyphs map straight to their code;
// named escapes map their name (case-folded) to their code. Numeric `{$xx}`
// escapes are parsed arithmetically and need no entry.
const glyphToCode = new Map<string, number>();
const nameToCode = new Map<string, number>();
for (let code = 0; code < 256; code++) {
  const text = PETSCII_TEXT[code]!;
  if (text.startsWith('{')) {
    const inner = text.slice(1, -1);
    if (!inner.startsWith('$')) nameToCode.set(inner, code);
  } else {
    glyphToCode.set(text, code);
  }
}
// The default set has no lower case; fold a-z onto the upper-case codes so
// lower-case source still tokenizes (matching the ROM's screen editor).
for (let i = 0; i < 26; i++) {
  glyphToCode.set(String.fromCharCode(0x61 + i), 0x41 + i);
}

/** Canonical editor text for a PETSCII code (glyph or `{...}` escape). */
export function petsciiToText(code: number): string {
  return PETSCII_TEXT[code & 0xff]!;
}

/**
 * Parse one PETSCII unit from `text` at index `i` - a `{...}` escape, a single
 * glyph, or an ASCII character - returning its code and the number of source
 * characters consumed. Throws {@link CharsetError} on unmappable input.
 */
export function parseC64Char(
  text: string,
  i: number,
): { code: number; length: number } {
  const ch = text[i]!;
  if (ch === '{') {
    const end = text.indexOf('}', i + 1);
    if (end < 0) {
      throw new CharsetError('Unterminated "{" escape', i);
    }
    const inner = text.slice(i + 1, end);
    const hex = /^\$([0-9a-fA-F]{1,2})$/.exec(inner);
    if (hex) {
      return { code: parseInt(hex[1]!, 16), length: end - i + 1 };
    }
    const named = nameToCode.get(inner.toLowerCase());
    if (named !== undefined) {
      return { code: named, length: end - i + 1 };
    }
    throw new CharsetError(`Unknown escape "{${inner}}"`, i);
  }
  const code = glyphToCode.get(ch);
  if (code === undefined) {
    throw new CharsetError(
      `Character ${JSON.stringify(ch)} has no Commodore 64 equivalent`,
      i,
    );
  }
  return { code, length: 1 };
}
