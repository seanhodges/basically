import type { DetokenizeResult, TapeFile } from '../types';
import { atomCharset } from './charset';
import { codeFilesToBlocks, type ImportedCodeFile } from '../importBlocks';
import {
  ATM_HEADER_SIZE,
  ATOM_TEXT_START,
  buildAtm,
  parseAtm,
  stripAtmHeader,
} from './atm';
import { isAtomDsk, parseAtomDsk, type AtomDskEntry } from './atomDsk';

const LINE_MARK = 0x0d;
const END_HI = 0xff;

/**
 * Convert an Atom BASIC program image (the `#2900` in-memory layout produced by
 * {@link import('./tokenizer').tokenizeProgram}) back into editable text. Each
 * line is `0D` then a big-endian line number then the ASCII body; the program
 * ends with `0D FF`. Bodies are stored verbatim, so this is a faithful inverse
 * of the tokenizer: line number as decimal digits followed by the body mapped
 * back through the charset.
 *
 * Accepts either a bare `#2900` image or a full `.atm` file (header + data);
 * {@link stripAtmHeader} unwraps the latter, so it drives the `.atm` import too.
 * A non-BASIC `.atm` (wrong load address or a payload that is not a line image)
 * decodes to empty text here; {@link detokenizeProgramWithReport} explains why.
 */
export function detokenizeProgram(file: Uint8Array): string {
  if (isAtomDsk(file)) return detokenizeAtomDskWithReport(file).source;
  let image: Uint8Array;
  try {
    image = stripAtmHeader(file);
  } catch {
    return '';
  }
  return decodeImage(image).source;
}

/**
 * Like {@link detokenizeProgram}, but for the binary-import paths: it also
 * reports what the text form could not capture, and recovers a non-BASIC `.atm`
 * as a memory block.
 *
 * A `.atm` that loads somewhere other than `#2900` is a machine-code or data
 * file, not BASIC text: rather than surface an empty document, its payload is
 * imported as a single {@link import('../types').MemoryBlock} at its load
 * address (empty `source`, a note explaining why). A real `#2900` BASIC program
 * decodes to text exactly as before, with no blocks; a truncated image (no
 * `0D FF` end marker) still warns.
 */
export function detokenizeProgramWithReport(
  file: Uint8Array,
): DetokenizeResult {
  if (isAtomDsk(file)) return detokenizeAtomDskWithReport(file);
  let image: Uint8Array;
  try {
    image = stripAtmHeader(file);
  } catch (e) {
    // stripAtmHeader rejects both a non-#2900 .atm (a machine-code/data file)
    // and a file too short to be either. When it's a parseable .atm, import
    // its payload as a memory block; otherwise pass the framing error through.
    if (isAtmFile(file)) {
      const { name, load, exec, data } = parseAtm(file);
      const hex = (v: number) => v.toString(16).toUpperCase().padStart(4, '0');
      // The header's exec address is where *RUN would start the code; keep it
      // on the block so the run path can LINK to it. 0 means "none recorded".
      const entry = exec !== 0 ? exec : undefined;
      return {
        source: '',
        warnings: [
          `This .atm loads at #${hex(load)}, not #2900 where Atom BASIC text lives — ` +
            `it is a machine-code or data file, imported as a memory block ` +
            `rather than editable BASIC.` +
            (entry !== undefined
              ? ` Run will start it at its exec address #${hex(entry)} with LINK.`
              : ''),
        ],
        blocks: codeFilesToBlocks([
          { name, address: load, bytes: data.slice(), entry },
        ]),
      };
    }
    return { source: '', warnings: [(e as Error).message] };
  }
  const { source, truncated } = decodeImage(image);
  const warnings: string[] = [];
  if (truncated) {
    warnings.push(
      'The program looks truncated — no 0D FF end-of-program marker was found.',
    );
  }
  return { source, warnings };
}

/**
 * Import an Atom `.dsk` disc image (see {@link import('./atomDsk')}). The disc
 * holds the BASIC program plus each memory block as its own catalogue file, with
 * a per-file load address: a file loading at `#2900` is BASIC text, anything
 * else is a machine-code/data block at its load address (its exec address kept
 * as the block's entry). The largest `#2900` file (catalogue order breaking
 * ties) is opened for editing; any other BASIC files are preserved as tape files
 * (the Atom emulator mounts no drive), and non-`#2900` files import as memory
 * blocks - so a whole document round-trips through the disc intact.
 */
export function detokenizeAtomDskWithReport(
  file: Uint8Array,
): DetokenizeResult {
  const { entries, warnings } = parseAtomDsk(file);
  const basics = entries.filter((e) => e.load === ATOM_TEXT_START);
  const others = entries.filter((e) => e.load !== ATOM_TEXT_START);

  let chosen: AtomDskEntry | null = null;
  for (const b of basics) {
    if (chosen === null || b.bytes.length > chosen.bytes.length) chosen = b;
  }

  const codeFiles: ImportedCodeFile[] = others.map((e) => ({
    name: e.name,
    address: e.load,
    bytes: e.bytes,
    ...(e.exec !== e.load ? { entry: e.exec } : {}),
  }));
  const blocks = codeFilesToBlocks(codeFiles);

  const source = chosen !== null ? decodeImage(chosen.bytes).source : '';

  const tapeFiles: TapeFile[] = basics
    .filter((b) => b !== chosen)
    .map((b) => ({
      name: b.name === '' ? 'PROGRAM' : b.name,
      kind: 'program',
      tap: buildAtm(b.bytes, b.name || 'PROGRAM'),
    }));

  if (entries.length > 1 && chosen !== null) {
    const parts: string[] = [];
    if (tapeFiles.length > 0) {
      parts.push(
        `${tapeFiles.length} other BASIC program${tapeFiles.length === 1 ? '' : 's'} ` +
          'preserved with the document (the Atom emulator mounts no drive, so ' +
          'the running program cannot load them)',
      );
    }
    if (others.length > 0) {
      parts.push(
        `${others.length} machine-code/data entr${others.length === 1 ? 'y' : 'ies'} ` +
          'imported as memory blocks',
      );
    }
    warnings.push(
      `Multi-file disk image: opened "${chosen.name === '' ? '?' : chosen.name}" ` +
        `(${chosen.bytes.length} bytes), the largest BASIC program` +
        (parts.length > 0 ? `; ${parts.join('; ')}` : '') +
        '.',
    );
  } else if (chosen === null && entries.length > 0) {
    warnings.push(
      'The .dsk holds no Atom BASIC program (nothing loads at #2900); its ' +
        'entries were imported as memory blocks.',
    );
  }

  return {
    source,
    warnings,
    ...(blocks.length > 0 ? { blocks } : {}),
    ...(tapeFiles.length > 0 ? { tapeFiles } : {}),
  };
}

/**
 * Whether `file` carries an `.atm` header (as opposed to a bare `#2900` image,
 * which begins with the `0D` line marker, or a file too short to hold a
 * header). Guards {@link parseAtm}, which assumes a well-formed header.
 */
function isAtmFile(file: Uint8Array): boolean {
  return file.length >= ATM_HEADER_SIZE && file[0] !== LINE_MARK;
}

interface DecodeResult {
  source: string;
  /** True when the record chain ran off the end without the 0D FF marker. */
  truncated: boolean;
}

function decodeImage(image: Uint8Array): DecodeResult {
  const lines: string[] = [];
  let p = 0;
  let sawEnd = false;

  while (p + 1 < image.length && image[p] === LINE_MARK) {
    if (image[p + 1] === END_HI) {
      sawEnd = true; // the 0D FF end-of-program marker
      break;
    }
    if (p + 3 > image.length) break; // record header cut short: truncated
    const lineNo = (image[p + 1]! << 8) | image[p + 2]!;
    // The body runs to the next 0x0D start-of-line marker (or end of image).
    let end = p + 3;
    while (end < image.length && image[end] !== LINE_MARK) end++;
    const body = atomCharset.toUnicode(image.subarray(p + 3, end));
    // A body that begins with a digit and no separating space would merge into
    // the line number on re-tokenize (10 + "23=1" -> line 1023); insert a space.
    const sep = /^[0-9]/.test(body) ? ' ' : '';
    lines.push(`${lineNo}${sep}${body}`);
    p = end;
  }

  // Stopping anywhere other than on the 0D FF marker means the record chain ran
  // off the end of the image before its terminator - a truncated program.
  return {
    source: lines.join('\n') + (lines.length ? '\n' : ''),
    truncated: !sawEnd,
  };
}
