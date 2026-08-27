import type { DetokenizeResult, Block, TapeFile } from '../types';
import { decodeSpan } from './charset';
import { trs80WordByToken } from './keywords';
import { codeFilesToBlocks, type ImportedCodeFile } from '../importBlocks';
import { PROG_START } from './addresses';
import {
  isCasImage,
  parseCasImage,
  parseCasAllFiles,
  casFormat,
  buildCasImage,
  MODEL_III_MESSAGE,
  type CasBasicFile,
  type CasSystemFile,
} from './casfile';
import {
  isJv1Disk,
  parseTrsDisk,
  parseCmdModule,
  type Trs80DiskEntry,
} from './trs80Disk';

/** Disk-BASIC token marker that prefixes a tokenized `/BAS` program file. */
const DISK_BASIC_MARKER = 0xff;

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
  if (isJv1Disk(image)) return detokenizeTrs80DiskWithReport(image).source;
  // Accept a raw `.cas` cassette image as well as the bare program: strip the
  // leader/sync/marker/filename wrapper so the Import dialog can read `.cas`.
  const program = isCasImage(image) ? parseCasImage(image).program : image;
  return decodeLinkedProgram(program).source;
}

/** Format a byte address as `0xNNNN` for warning messages. */
function hex(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * Like {@link detokenizeProgram}, but for the binary-import paths: it also
 * reports what the text form could not capture - a truncated image, a Model
 * III 1500-baud cassette this decoder does not read - and recovers everything
 * a multi-file tape carries beyond the one program opened for editing,
 * mirroring the Spectrum's multi-part `.TAP` import:
 *
 * - The largest BASIC program on the tape (tape order breaking ties) becomes
 *   the editable source; other BASIC programs are preserved verbatim as
 *   {@link TapeFile}s on the document.
 * - SYSTEM (machine-language) files import as one memory block per data
 *   record, entry address kept on the record that contains it, so the code
 *   lands back at its load address on Run. Bad-checksum records are still
 *   kept, with a warning (see parseSystemCas).
 * - Machine code trailing the chosen program on the tape - bytes CLOAD would
 *   have deposited right after it - is preserved as a memory block too.
 */
export function detokenizeProgramWithReport(
  image: Uint8Array,
): DetokenizeResult {
  const warnings: string[] = [];

  if (isJv1Disk(image)) return detokenizeTrs80DiskWithReport(image);

  const format = casFormat(image);

  if (format === 'model3') {
    return { source: '', warnings: [MODEL_III_MESSAGE] };
  }

  if (format === 'model1' || format === 'system') {
    return detokenizeCassette(image, warnings);
  }

  // A bare program image (no cassette framing).
  const decoded = decodeLinkedProgram(image);
  if (decoded.truncated) {
    warnings.push(
      'The program looks truncated — the data ends before the end-of-program marker.',
    );
  }
  const trailing = image.length - decoded.end;
  let blocks: Block[] | undefined;
  if (!decoded.truncated && trailing > 0) {
    const address = PROG_START + decoded.end;
    blocks = codeFilesToBlocks([
      { name: '', address, bytes: image.slice(decoded.end) },
    ]);
    warnings.push(
      `${trailing} byte${trailing === 1 ? '' : 's'} after the end-of-program ` +
        `marker (likely appended machine code) were preserved as a memory ` +
        `block at ${hex(address)}.`,
    );
  }
  return {
    source: decoded.source,
    warnings,
    ...(blocks ? { blocks } : {}),
  };
}

/** The multi-file cassette import path of {@link detokenizeProgramWithReport}. */
function detokenizeCassette(
  image: Uint8Array,
  warnings: string[],
): DetokenizeResult {
  const scanned = parseCasAllFiles(image);
  warnings.push(...scanned.warnings);
  const basics = scanned.files.filter(
    (f): f is CasBasicFile => f.kind === 'basic',
  );
  const systems = scanned.files.filter(
    (f): f is CasSystemFile => f.kind === 'system',
  );

  // The largest program is the one worth editing: a multi-part tape's first
  // program is typically a small loader, and the game follows it.
  let chosen: CasBasicFile | null = null;
  for (const b of basics) {
    if (chosen === null || b.program.length > chosen.program.length) chosen = b;
  }

  const codeFiles: ImportedCodeFile[] = [];
  for (const s of systems) {
    // The entry address rides on the record whose span contains it (falling
    // back to the file's first record), so it survives block-level edits.
    const containing = s.records.findIndex(
      (r) => s.entry >= r.address && s.entry < r.address + r.bytes.length,
    );
    const entryIndex = containing !== -1 ? containing : 0;
    s.records.forEach((r, i) => {
      codeFiles.push({
        name: s.name,
        address: r.address,
        bytes: r.bytes,
        ...(s.entry !== 0 && i === entryIndex ? { entry: s.entry } : {}),
      });
    });
  }
  if (chosen !== null && chosen.trailing.length > 0) {
    const address = PROG_START + chosen.program.length;
    codeFiles.push({
      name: '',
      address,
      bytes: chosen.trailing.slice(),
    });
    warnings.push(
      `${chosen.trailing.length} byte${chosen.trailing.length === 1 ? '' : 's'} ` +
        `of machine code follow the program on the tape; preserved as a ` +
        `memory block at ${hex(address)}.`,
    );
  }
  const blocks = codeFilesToBlocks(codeFiles);

  const tapeFiles: TapeFile[] = basics
    .filter((b) => b !== chosen)
    .map((b) => ({
      name: b.name === '' ? 'PROGRAM' : b.name,
      kind: 'program',
      tap: b.raw,
    }));

  if (scanned.files.length > 1 && chosen !== null) {
    const parts: string[] = [];
    if (tapeFiles.length > 0) {
      parts.push(
        `${tapeFiles.length} other BASIC program${tapeFiles.length === 1 ? '' : 's'} ` +
          'preserved with the document (the TRS-80 emulator has no cassette ' +
          'deck yet, so the running program cannot CLOAD them)',
      );
    }
    if (systems.length > 0) {
      parts.push(
        `${systems.length} SYSTEM (machine-code) file${systems.length === 1 ? '' : 's'} ` +
          'imported as memory blocks',
      );
    }
    warnings.push(
      `Multi-part tape: opened "${chosen.name === '' ? '?' : chosen.name}" ` +
        `(${chosen.program.length} bytes), the largest BASIC program` +
        (parts.length > 0 ? `; ${parts.join('; ')}` : '') +
        '.',
    );
  }

  let source = '';
  if (chosen !== null) {
    const decoded = decodeLinkedProgram(chosen.program);
    if (decoded.truncated) {
      warnings.push(
        'The program looks truncated — the data ends before the end-of-program marker.',
      );
    }
    source = decoded.source;
  }

  return {
    source,
    warnings,
    ...(blocks.length > 0 ? { blocks } : {}),
    ...(tapeFiles.length > 0 ? { tapeFiles } : {}),
  };
}

/** The program payload of a `/BAS` entry, less its leading `0xFF` marker. */
function basicProgram(entry: Trs80DiskEntry): Uint8Array {
  return entry.bytes[0] === DISK_BASIC_MARKER
    ? entry.bytes.slice(1)
    : entry.bytes;
}

/** Whether a `.dsk` entry is a BASIC program (a `/BAS` or `0xFF`-marked file). */
function isBasicEntry(entry: Trs80DiskEntry): boolean {
  return entry.ext === 'BAS' || entry.bytes[0] === DISK_BASIC_MARKER;
}

/**
 * Import a TRS-80 `.dsk` disc image (see {@link import('./trs80Disk')}). The
 * disc holds the BASIC program (a `/BAS` file) plus each memory block (a `/CMD`
 * load module). The largest BASIC program (directory order breaking ties) is
 * opened for editing; any other BASIC files are preserved as tape files (the
 * interpreter mounts no drive), and each `/CMD` module imports as a memory block
 * at its load address with its entry kept - so a whole document round-trips
 * through the disc intact.
 */
export function detokenizeTrs80DiskWithReport(
  image: Uint8Array,
): DetokenizeResult {
  const { entries, warnings } = parseTrsDisk(image);
  const basics = entries.filter(isBasicEntry);
  const others = entries.filter((e) => !isBasicEntry(e));

  let chosen: Trs80DiskEntry | null = null;
  let chosenProgram: Uint8Array = new Uint8Array(0);
  for (const b of basics) {
    const prog = basicProgram(b);
    if (chosen === null || prog.length > chosenProgram.length) {
      chosen = b;
      chosenProgram = prog;
    }
  }

  const codeFiles: ImportedCodeFile[] = [];
  for (const o of others) {
    const mod = parseCmdModule(o.bytes);
    if (!mod) continue;
    codeFiles.push({
      name: o.name,
      address: mod.address,
      bytes: mod.bytes,
      ...(mod.entry !== mod.address ? { entry: mod.entry } : {}),
    });
  }
  const blocks = codeFilesToBlocks(codeFiles);

  const tapeFiles: TapeFile[] = basics
    .filter((b) => b !== chosen)
    .map((b) => ({
      name: b.name === '' ? 'PROGRAM' : b.name,
      kind: 'program',
      tap: buildCasImage(basicProgram(b), b.name || 'A'),
    }));

  if (entries.length > 1 && chosen !== null) {
    const parts: string[] = [];
    if (tapeFiles.length > 0) {
      parts.push(
        `${tapeFiles.length} other BASIC program${tapeFiles.length === 1 ? '' : 's'} ` +
          'preserved with the document (the TRS-80 emulator mounts no drive, so ' +
          'the running program cannot load them)',
      );
    }
    if (others.length > 0) {
      parts.push(
        `${others.length} machine-code file${others.length === 1 ? '' : 's'} ` +
          'imported as memory blocks',
      );
    }
    warnings.push(
      `Multi-file disk image: opened "${chosen.name === '' ? '?' : chosen.name}" ` +
        `(${chosenProgram.length} bytes), the largest BASIC program` +
        (parts.length > 0 ? `; ${parts.join('; ')}` : '') +
        '.',
    );
  } else if (chosen === null && entries.length > 0) {
    warnings.push(
      'The .dsk holds no BASIC program (no /BAS file); its files were imported ' +
        'as memory blocks.',
    );
  }

  const source =
    chosen !== null ? decodeLinkedProgram(chosenProgram).source : '';

  return {
    source,
    warnings,
    ...(blocks.length > 0 ? { blocks } : {}),
    ...(tapeFiles.length > 0 ? { tapeFiles } : {}),
  };
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
