import { trs80Charset } from './charset';
import { trs80WordByToken } from './keywords';

const QUOTE = 0x22;
const REM_TOKEN = 0x93;
const DATA_TOKEN = 0x88;
const STMT_SEP = 0x3a; // ':'

/**
 * Convert a tokenized TRS-80 Level II program back into editable text. The image
 * is the bare program as it sits from 0x42E8 (the same bytes {@link
 * tokenizeProgram} produces): a chain of `u16 link` + `u16 line number` + body +
 * 0x00 records, ending with a 0x0000 link. We follow the links, decode the line
 * number, expand keyword tokens (0x80–0xFA) to their LIST spelling and map every
 * other byte through the charset. A space follows each line number, matching
 * LIST.
 *
 * Like the ROM's LIST, keyword expansion is suspended inside string literals and
 * after REM/DATA: the block-graphics codes (0x80–0xBF) share byte values with
 * the keyword tokens, so a graphics character in a string must decode as a glyph,
 * not as END/FOR/…
 */
export function detokenizeProgram(program: Uint8Array): string {
  const lines: string[] = [];
  let p = 0;
  while (p + 4 <= program.length) {
    const link = program[p]! | (program[p + 1]! << 8);
    if (link === 0) break; // null link: end of program
    const lineNo = program[p + 2]! | (program[p + 3]! << 8);
    let i = p + 4;
    let body = '';
    let inString = false;
    let remRest = false; // REM: rest of the line is verbatim text
    let dataMode = false; // DATA: verbatim until an unquoted ':'
    while (i < program.length && program[i] !== 0x00) {
      const b = program[i]!;
      if (remRest) {
        body += trs80Charset.glyph(b);
      } else if (inString) {
        if (b === QUOTE) inString = false;
        body += trs80Charset.glyph(b);
      } else if (b === QUOTE) {
        inString = true;
        body += '"';
      } else if (dataMode) {
        if (b === STMT_SEP) dataMode = false;
        body += trs80Charset.glyph(b);
      } else {
        const word = trs80WordByToken.get(b);
        if (word !== undefined) {
          body += word;
          if (b === REM_TOKEN) remRest = true;
          else if (b === DATA_TOKEN) dataMode = true;
        } else {
          body += trs80Charset.glyph(b);
        }
      }
      i++;
    }
    lines.push(`${lineNo} ${body}`);
    p = i + 1; // step past the line terminator
  }

  return lines.join('\n') + (lines.length ? '\n' : '');
}
