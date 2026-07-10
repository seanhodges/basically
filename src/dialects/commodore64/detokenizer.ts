import { c64Charset } from './charset';
import { c64WordByToken } from './keywords';

/**
 * Convert a tokenized Commodore 64 program back into editable text. Accepts
 * either a full .prg (leading 2-byte load address) or the bare program bytes
 * from $0801. Follows the next-line links, decodes the line number, expands
 * keyword tokens to their LIST spelling and maps every other byte through the
 * PETSCII charset. A space is inserted after each line number, matching LIST.
 *
 * Keyword expansion is suspended wherever the tokenizer stores bytes verbatim,
 * so that detokenize is the exact inverse of tokenize (byte-exact round-trip):
 *
 *  - **Inside quoted strings** — string literals store raw PETSCII, so a byte in
 *    the $80–$FF keyword range there is a graphics character (e.g. the C=/SHIFT
 *    block graphics a program POKEs into DATA), not a token. Without this a
 *    graphics byte such as $A6 would list as `SPC(` and $A3 as `TAB(`.
 *  - **After REM** (to end of line) and **inside DATA** (to an unquoted `:`) —
 *    the tokenizer copies these verbatim, so any high byte there is a literal
 *    character too. Expanding it to a keyword would not re-tokenize to the same
 *    byte, unlike the ROM's LIST which is itself not round-trippable here.
 *
 * Every non-keyword byte maps through {@link c64Charset} to a glyph or a
 * `{...}` escape, so nothing is lost to `?`.
 */
export function detokenizeProgram(image: Uint8Array): string {
  // Drop the load address if this looks like a .prg ($01 $08).
  let program = image;
  if (image.length >= 2 && image[0] === 0x01 && image[1] === 0x08) {
    program = image.subarray(2);
  }

  const lines: string[] = [];
  let p = 0;
  while (p + 4 <= program.length) {
    const link = program[p]! | (program[p + 1]! << 8);
    if (link === 0) break; // null link: end of program
    const lineNo = program[p + 2]! | (program[p + 3]! << 8);
    let i = p + 4;
    let body = '';
    let inString = false;
    let remRest = false; // REM: rest of the line is verbatim
    let dataMode = false; // DATA: verbatim until an unquoted ':'
    while (i < program.length && program[i] !== 0x00) {
      const b = program[i]!;
      if (b === 0x22) {
        // A quote toggles string mode; the quote itself always lists literally.
        inString = !inString;
        body += '"';
      } else if (inString || remRest || dataMode) {
        // Verbatim region: never expand tokens, map the raw PETSCII byte.
        if (dataMode && !inString && b === 0x3a) {
          // An unquoted ':' ends the DATA statement (a new statement begins).
          dataMode = false;
          body += ':';
        } else {
          body += c64Charset.glyph(b);
        }
      } else if (c64WordByToken.has(b)) {
        body += c64WordByToken.get(b)!;
        if (b === 0x8f)
          remRest = true; // REM
        else if (b === 0x83) dataMode = true; // DATA
      } else {
        body += c64Charset.glyph(b);
      }
      i++;
    }
    lines.push(`${lineNo} ${body}`);
    p = i + 1; // step past the line terminator
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}
