import type { DetokenizeResult } from '../types';
import { c64Charset } from './charset';
import { c64WordByToken } from './keywords';

/** Programs load at $0801 on the C64; a .prg's leading word is this address. */
const DEFAULT_LOAD_ADDRESS = 0x0801;

/**
 * A Commodore-BASIC machine variant for the LIST/import side. Sibling dialects
 * (PET, VIC-20…) reuse the C64 detokenizer by supplying their own load address,
 * keyword decode map and machine name for the warnings. Omitting it decodes for
 * the C64.
 */
export interface CbmDetokenizeVariant {
  /** The .prg leading load-address word, e.g. C64 $0801, PET $0401. */
  loadAddress: number;
  /** token byte -> canonical spelling for this machine's keyword set. */
  wordByToken: Map<number, string>;
  /**
   * What a foreign-load-address image is likely to be, spliced into the
   * "load address is not $…" warning (e.g. 'VIC-20/PET/C128 or machine-code').
   */
  machineHint: string;
  /** This machine's own name for the warning tail (e.g. 'C64', 'PET'). */
  machineName: string;
}

/** The implicit C64 variant used when no explicit one is passed. */
const C64_VARIANT: CbmDetokenizeVariant = {
  loadAddress: DEFAULT_LOAD_ADDRESS,
  wordByToken: c64WordByToken,
  machineHint: 'VIC-20/PET/C128 or machine-code',
  machineName: 'C64',
};

/**
 * Convert a tokenized Commodore 64 program back into editable text. Accepts
 * either a full .prg (leading 2-byte load address) or the bare program bytes
 * from $0801. Follows the next-line links, decodes the line number, expands
 * keyword tokens to their LIST spelling and maps every other byte through the
 * PETSCII charset. A space is inserted after each line number, matching LIST.
 *
 * Keyword expansion is suspended wherever the tokenizer stores bytes verbatim,
 * so that detokenize round-trips to the same bytes for every construct a real
 * BASIC program stores. (It is *not* a total inverse of LIST: the ROM's LIST
 * decodes token bytes inside strings/REM/DATA too, which does not re-tokenize;
 * we keep those verbatim instead so the import stays byte-exact.)
 *
 *  - **Inside quoted strings** — string literals store raw PETSCII, so a byte in
 *    the $80–$FF keyword range there is a graphics character (e.g. the C=/SHIFT
 *    block graphics a program POKEs into DATA), not a token. Without this a
 *    graphics byte such as $A6 would list as `SPC(` and $A3 as `TAB(`.
 *  - **After REM** (to end of line) and **inside DATA** (to an unquoted `:`) —
 *    the tokenizer copies these verbatim, so any high byte there is a literal
 *    character too.
 *
 * Every non-keyword byte maps through {@link c64Charset} to a glyph or a
 * `{...}` escape, so nothing is lost to `?`.
 */
export function detokenizeProgram(
  image: Uint8Array,
  variant: CbmDetokenizeVariant = C64_VARIANT,
): string {
  // Drop the load address if this looks like a .prg (its little-endian load
  // word, $01 $08 on the C64). Bare program bytes (e.g. from a cassette decode)
  // are passed through unchanged.
  const lo = variant.loadAddress & 0xff;
  const hi = (variant.loadAddress >> 8) & 0xff;
  const program =
    image.length >= 2 && image[0] === lo && image[1] === hi
      ? image.subarray(2)
      : image;
  return decodeLinkedProgram(program, variant.wordByToken).source;
}

/**
 * Like {@link detokenizeProgram}, but for the binary-import paths: it assumes a
 * 2-byte load address (the .prg contract) and reports what the text form cannot
 * capture — a non-$0801 load address, machine code appended after the BASIC
 * program, or a truncated image.
 */
export function detokenizeProgramWithReport(
  image: Uint8Array,
  variant: CbmDetokenizeVariant = C64_VARIANT,
): DetokenizeResult {
  const warnings: string[] = [];
  let program = image;
  if (image.length >= 2) {
    const loadAddr = image[0]! | (image[1]! << 8);
    if (loadAddr !== variant.loadAddress) {
      warnings.push(
        `Load address is $${hex4(loadAddr)}, not $${hex4(variant.loadAddress)} — ` +
          `this may be a ${variant.machineHint} file rather than a ` +
          `${variant.machineName} BASIC program.`,
      );
    }
    program = image.subarray(2);
  }

  const decoded = decodeLinkedProgram(program, variant.wordByToken);
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

/** Decode a linked BASIC program (bytes from the program base, no load address). */
function decodeLinkedProgram(
  program: Uint8Array,
  wordByToken: Map<number, string>,
): DecodeResult {
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
      // A non-null link with no room for a line number + terminator: truncated.
      truncated = true;
      end = program.length;
      break;
    }
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
      } else if (wordByToken.has(b)) {
        body += wordByToken.get(b)!;
        if (b === 0x8f)
          remRest = true; // REM
        else if (b === 0x83) dataMode = true; // DATA
      } else {
        body += c64Charset.glyph(b);
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

  // Leftover bytes that are neither an end marker nor a decodable line mean the
  // image stops short of its end marker.
  if (!sawEnd && !truncated && p < program.length) truncated = true;

  return {
    source: lines.join('\n') + (lines.length ? '\n' : ''),
    end,
    truncated,
  };
}

function hex4(n: number): string {
  return (n & 0xffff).toString(16).padStart(4, '0');
}
