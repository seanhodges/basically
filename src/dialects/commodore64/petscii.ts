import { CharsetError } from '../types';
import { C64_COMMODORE_GRAPHICS, C64_SHIFT_GRAPHICS } from './graphics';

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
 *    the four specials £ ↑ ← π) render as their closest Unicode glyph, taken from
 *    `src/emulator/c64/viciious/tools/c64FontCodePoints.js` (the same source the
 *    keyboard's {@link ./graphics} table cites) via the standard PETSCII ->
 *    screen-code mapping. Twelve block-graphics codes the viciious font *draws*
 *    identically to a lower primary but that are distinct in the genuine
 *    character ROM (the half/eighth-block shades $A8/$B6/$B7/$B8/$C4–$C8/$D4/$D9/
 *    $DC) take their true glyph from the Unicode "Symbols for Legacy Computing"
 *    block (U+1FB70–U+1FB8F).
 *  - **Control codes** (cursor moves, colours, reverse on/off, case switch…)
 *    render as petcat/VICE-style named escapes: `{down}`, `{rvon}`, `{clr}`,
 *    `{red}`, and so on.
 *  - **Every remaining byte** — the graphics codes whose ROM bitmap is genuinely
 *    identical to a lower primary (e.g. $AA/$B4/$C3/$DD, and $DE which draws as
 *    π), plus undefined control codes — renders as a numeric `{$xx}` escape.
 *    This keeps the map injective, so the round-trip stays byte-exact even where
 *    the hardware itself draws two codes the same.
 *
 * `{` and `}` are not valid PETSCII characters, so a `{...}` sequence is always
 * an escape and never ambiguous with literal text.
 *
 * The function keys ($85–$8C) decode as `{f1}`–`{f8}` and shifted space ($A0)
 * as `{shift-space}`. On **parse** the table additionally accepts the canonical
 * petcat/VICE control names (`{wht}`, `{rvof}`, `{swlc}`…), the `{CBM-x}` /
 * `{SHIFT-x}` key-graphic names, and decimal `{nnn}` codes, so real archive
 * listings can be pasted in; decode always emits the canonical form above.
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
  '{$80}','{orange}','{$82}','{$83}','{$84}','{f1}','{f3}','{f5}','{f7}','{f2}','{f4}','{f6}','{f8}','{shift-cr}','{upper}','{$8f}', // $80
  '{black}','{up}','{rvoff}','{clr}','{inst}','{brown}','{pink}','{grey1}','{grey2}','{lgreen}','{lblue}','{grey3}','{purple}','{left}','{yellow}','{cyan}', // $90
  '{shift-space}','▌','▄','▔','▁','▎','▒','▕','🮏','◤','{$aa}','├','▗','└','┐','▂', // $a0
  '┌','┴','┬','┤','{$b4}','▍','🮈','🮂','🮃','▃','⌟','▖','▝','┘','▘','▚', // $b0
  '─','♠','│','{$c3}','🭷','🭶','🭹','🭱','🭳','╮','╰','╯','⌞','╲','╱','⌜', // $c0
  '⌝','●','_','♥','🭰','╭','╳','○','♣','🭴','♦','┼','🮌','{$dd}','{$de}','◥', // $d0
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

/**
 * petcat / VICE control-code names accepted on parse in addition to this
 * module's canonical decode names. Real C64 archive listings (petcat output,
 * forum posts) use these shorter spellings; accepting them lets such source be
 * pasted straight in. Decode still emits the canonical name above, so the
 * round-trip stays stable — these are extra inputs, never outputs.
 */
// prettier-ignore
export const PETCAT_ALIASES: Record<string, number> = {
  wht: 0x05, blk: 0x90, grn: 0x1e, blu: 0x1f, yel: 0x9e, cyn: 0x9f,
  pur: 0x9c, lred: 0x96, orng: 0x81, brn: 0x95, gry1: 0x97, gry2: 0x98,
  gry3: 0x9b, lgrn: 0x99, lblu: 0x9a, rght: 0x1d, rvof: 0x92, sret: 0x8d,
  swlc: 0x0e, swuc: 0x8e, space: 0x20,
};
for (const [name, code] of Object.entries(PETCAT_ALIASES)) {
  nameToCode.set(name, code);
}
// {CBM-x} / {SHIFT-x}: the graphic on a letter key's C= or SHIFT front face,
// keyed off the same table the virtual keyboard uses so the two never drift.
for (const { key, petscii } of C64_COMMODORE_GRAPHICS) {
  if (/^[A-Z]$/.test(key)) nameToCode.set(`cbm-${key.toLowerCase()}`, petscii);
}
for (const { key, petscii } of C64_SHIFT_GRAPHICS) {
  if (/^[A-Z]$/.test(key))
    nameToCode.set(`shift-${key.toLowerCase()}`, petscii);
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
    // Decimal `{nnn}` (petcat/VICE style): a raw code 0–255.
    const dec = /^(\d{1,3})$/.exec(inner);
    if (dec) {
      const code = parseInt(dec[1]!, 10);
      if (code > 0xff) {
        throw new CharsetError(`Escape "{${inner}}" is out of range 0–255`, i);
      }
      return { code, length: end - i + 1 };
    }
    const named = nameToCode.get(inner.toLowerCase());
    if (named !== undefined) {
      return { code: named, length: end - i + 1 };
    }
    throw new CharsetError(`Unknown escape "{${inner}}"`, i);
  }
  // A glyph may be more than one UTF-16 unit: the Symbols-for-Legacy-Computing
  // block graphics ($A8/$B6…/$DC) are astral-plane characters (surrogate pairs).
  const glyph = String.fromCodePoint(text.codePointAt(i)!);
  const code = glyphToCode.get(glyph);
  if (code === undefined) {
    throw new CharsetError(
      `Character ${JSON.stringify(glyph)} has no Commodore 64 equivalent`,
      i,
    );
  }
  return { code, length: glyph.length };
}
