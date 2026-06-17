import { c64Charset } from './charset';
import { c64WordByToken } from './keywords';

/**
 * Convert a tokenized Commodore 64 program back into editable text. Accepts
 * either a full .prg (leading 2-byte load address) or the bare program bytes
 * from $0801. Follows the next-line links, decodes the line number, expands
 * keyword tokens to their LIST spelling and maps every other byte through the
 * PETSCII charset. A space is inserted after each line number, matching LIST.
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
    while (i < program.length && program[i] !== 0x00) {
      const b = program[i]!;
      const word = c64WordByToken.get(b);
      body += word !== undefined ? word : c64Charset.glyph(b);
      i++;
    }
    lines.push(`${lineNo} ${body}`);
    p = i + 1; // step past the line terminator
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}
