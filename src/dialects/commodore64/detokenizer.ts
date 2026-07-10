import { c64Charset } from './charset';
import { c64WordByToken } from './keywords';

/**
 * Convert a tokenized Commodore 64 program back into editable text. Accepts
 * either a full .prg (leading 2-byte load address) or the bare program bytes
 * from $0801. Follows the next-line links, decodes the line number, expands
 * keyword tokens to their LIST spelling and maps every other byte through the
 * PETSCII charset. A space is inserted after each line number, matching LIST.
 *
 * Keyword expansion is suspended inside quoted strings, exactly as the ROM's
 * LIST routine does: string literals store raw PETSCII, so a byte in the
 * $80–$FF keyword range there is a graphics character (e.g. the C=/SHIFT block
 * graphics a program POKEs into DATA), not a token. Without this a graphics
 * byte such as $A6 would list as `SPC(` and $A3 as `TAB(` mid-string.
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
    while (i < program.length && program[i] !== 0x00) {
      const b = program[i]!;
      if (b === 0x22) {
        // A quote toggles string mode; the quote itself always lists literally.
        inString = !inString;
        body += '"';
      } else if (!inString && c64WordByToken.has(b)) {
        body += c64WordByToken.get(b)!;
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
