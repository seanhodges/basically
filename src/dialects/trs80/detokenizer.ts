import type { DetokenizeResult } from '../types';
import { decodeSpan } from './charset';
import { trs80WordByToken } from './keywords';
import {
  isCasImage,
  parseCasImage,
  casFormat,
  MODEL_III_MESSAGE,
} from './casfile';

const QUOTE = 0x22;
const REM_TOKEN = 0x93;
const DATA_TOKEN = 0x88;
const ELSE_TOKEN = 0x95;
const APOSTROPHE_TOKEN = 0xfb; // the `'` token in the stored `:REM'` form
const STMT_SEP = 0x3a; // ':'

/**
 * Convert a tokenized TRS-80 Level II program back into editable text. The image
 * is the bare program as it sits from 0x42E9 (the same bytes {@link
 * tokenizeProgram} produces): a chain of `u16 link` + `u16 line number` + body +
 * 0x00 records, ending with a 0x0000 link. We follow the links, decode the line
 * number, expand keyword tokens (0x80–0xFA) to their LIST spelling and map every
 * other byte through the charset. A space follows each line number, matching
 * LIST.
 *
 * Like the ROM's LIST, keyword expansion is suspended inside string literals and
 * after REM/DATA: the block-graphics codes (0x80–0xBF) share byte values with
 * the keyword tokens, so a graphics character in a string must decode as a glyph,
 * not as END/FOR/… Two stored forms are collapsed back to what LIST shows: the
 * `:REM'` sequence (3A 93 FB) prints as `'`, and the `:ELSE` sequence (3A 95)
 * hides its implicit colon.
 */
export function detokenizeProgram(image: Uint8Array): string {
  // Accept a raw `.cas` cassette image as well as the bare program: strip the
  // leader/sync/marker/filename wrapper so the Import dialog can read `.cas`.
  const program = isCasImage(image) ? parseCasImage(image).program : image;
  return decodeLinkedProgram(program).source;
}

/**
 * Like {@link detokenizeProgram}, but for the binary-import paths: it also
 * reports what the text form could not capture - a truncated image, trailing
 * bytes past the end-of-program marker (likely appended machine code), or a
 * Model III 1500-baud cassette this decoder does not read.
 */
export function detokenizeProgramWithReport(
  image: Uint8Array,
): DetokenizeResult {
  const warnings: string[] = [];

  if (casFormat(image) === 'model3') {
    return { source: '', warnings: [MODEL_III_MESSAGE] };
  }

  let program = image;
  if (isCasImage(image)) {
    const parsed = parseCasImage(image);
    program = parsed.program;
  }

  const decoded = decodeLinkedProgram(program);
  if (decoded.truncated) {
    warnings.push(
      'The program looks truncated — the data ends before the end-of-program marker.',
    );
  }
  const trailing = program.length - decoded.end;
  if (!decoded.truncated && trailing > 0) {
    warnings.push(
      `${trailing} byte${trailing === 1 ? '' : 's'} after the end-of-program ` +
        `marker were not decoded (likely appended machine code); they are not ` +
        `preserved on re-export.`,
    );
  }
  return { source: decoded.source, warnings };
}

interface DecodeResult {
  source: string;
  /** Offset in `program` just past the 0x0000 end-of-program link. */
  end: number;
  /** True when the data ran out before an end-of-program marker was reached. */
  truncated: boolean;
}

function decodeLinkedProgram(program: Uint8Array): DecodeResult {
  const lines: string[] = [];
  let p = 0;
  let end = program.length;
  let truncated = false;
  let sawEnd = false;

  while (p + 2 <= program.length) {
    const link = program[p]! | (program[p + 1]! << 8);
    if (link === 0) {
      end = p + 2; // the null link is two bytes; anything past it is trailing
      sawEnd = true;
      break;
    }
    if (p + 4 > program.length) {
      truncated = true;
      end = program.length;
      break;
    }
    const lineNo = program[p + 2]! | (program[p + 3]! << 8);
    let i = p + 4;
    let body = '';
    let inString = false;
    let remRest = false; // REM: rest of the line is verbatim text
    let dataMode = false; // DATA: verbatim until an unquoted ':'
    while (i < program.length && program[i] !== 0x00) {
      const b = program[i]!;
      if (remRest) {
        body += decodeSpan(program, i, program.length).text;
      } else if (inString) {
        if (b === QUOTE) {
          inString = false;
          body += '"';
        } else {
          body += decodeSpan(program, i, program.length).text;
        }
      } else if (b === QUOTE) {
        inString = true;
        body += '"';
      } else if (dataMode) {
        if (b === STMT_SEP) {
          dataMode = false;
          body += ':';
        } else {
          body += decodeSpan(program, i, program.length).text;
        }
      } else if (
        b === STMT_SEP &&
        program[i + 1] === REM_TOKEN &&
        program[i + 2] === APOSTROPHE_TOKEN
      ) {
        // The stored `'` comment form `:REM'` (3A 93 FB) lists as a bare `'`.
        body += "'";
        i += 2; // consume 93 FB; the trailing i++ steps past the FB
        remRest = true;
      } else if (b === STMT_SEP && program[i + 1] === ELSE_TOKEN) {
        // The implicit ':' before ELSE (3A 95) is hidden by LIST; drop it and
        // let the ELSE token decode on the next iteration.
      } else {
        const word = trs80WordByToken.get(b);
        if (word !== undefined) {
          body += word;
          if (b === REM_TOKEN) remRest = true;
          else if (b === DATA_TOKEN) dataMode = true;
        } else {
          body += decodeSpan(program, i, program.length).text;
        }
      }
      i++;
    }
    lines.push(`${lineNo} ${body}`);
    if (i >= program.length) {
      // Ran off the end without the line's 0x00 terminator: image is truncated.
      truncated = true;
      end = program.length;
      break;
    }
    p = i + 1; // step past the line terminator
  }

  if (!sawEnd && !truncated && p < program.length) truncated = true;

  return {
    source: lines.join('\n') + (lines.length ? '\n' : ''),
    end,
    truncated,
  };
}
