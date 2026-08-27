import { decodeSpan, plainChar } from './charset';
import { BASIC_II, type BbcVariant } from './keywords';
import { LINE_NUMBER_TOKEN, decodeLineNumber } from './lineNumber';
import type { DetokenizeResult, Block } from '../types';
import { readBbcDisc } from '../../emulator/bbc/bbcDisc';
import { PAGE_DFS } from './addresses';
import { RAM_TOP } from '../../emulator/bbc/addresses';

/** BASIC program area start on a DFS-equipped machine. */
const PAGE = PAGE_DFS;

/** Tokens whose remaining line is stored verbatim (no further tokenizing). */
const REM_TOKEN = 0xf4;
const DATA_TOKEN = 0xdc;
const THEN_TOKEN = 0x8c;
const ELSE_TOKEN = 0x8b;
const QUOTE = 0x22;
const COLON = 0x3a;
const STAR = 0x2a;
const rawByte = (b: number): string =>
  `{0x${b.toString(16).padStart(2, '0').toUpperCase()}}`;

/**
 * Convert a tokenized BBC BASIC program (the in-memory / SAVE layout produced
 * by {@link tokenizeProgram}) back into editable text, and report anything the
 * text form could not represent faithfully (structural damage in the byte
 * image). Decoding is context-aware, mirroring the tokenizer's own inbound
 * paths: keyword tokens and the 0x8D line-number marker are only interpreted in
 * expression context; inside a string, REM, DATA or a `*` command every byte is
 * copied through the charset's escape-aware literal decoder, so teletext codes,
 * VDU controls and top-bit graphics round-trip instead of being mis-read as
 * keywords.
 */
export function detokenizeWithReport(
  program: Uint8Array,
  variant: BbcVariant = BASIC_II,
): DetokenizeResult {
  const lines: string[] = [];
  const warnings: string[] = [];
  let p = 0;

  while (
    p + 3 < program.length &&
    program[p] === 0x0d &&
    program[p + 1] !== 0xff
  ) {
    const lineNo = (program[p + 1]! << 8) | program[p + 2]!;
    const len = program[p + 3]!;
    if (len < 4) {
      warnings.push(
        `Line ${lineNo} has an invalid length byte (${len}); import stopped here.`,
      );
      p = program.length; // consumed everything we can trust
      break;
    }
    if (p + len > program.length) {
      warnings.push(
        `Line ${lineNo} is truncated: it needs ${len} bytes but only ` +
          `${program.length - p} remain, so the file ends mid-program.`,
      );
      lines.push(
        `${lineNo}${decodeBody(program, p + 4, program.length, variant)}`,
      );
      p = program.length;
      break;
    }
    lines.push(`${lineNo}${decodeBody(program, p + 4, p + len, variant)}`);
    p += len;
  }

  // A well-formed program leaves us sitting on the 0x0D 0xFF end marker.
  const atEndMarker =
    p + 1 < program.length && program[p] === 0x0d && program[p + 1] === 0xff;
  if (warnings.length === 0 && !atEndMarker) {
    warnings.push(
      program.length === 0
        ? 'The file is empty.'
        : 'The program is missing its 0x0D 0xFF end marker; the file may be ' +
            'truncated or not a tokenized BBC BASIC program.',
    );
  }

  return { source: lines.join('\n') + (lines.length ? '\n' : ''), warnings };
}

/** Sanitize a DFS filename into a valid {@link Block.name}, uniquely. */
function blockName(raw: string, taken: Set<string>): string {
  let cleaned = raw.replace(/[^A-Za-z0-9_]/g, '_');
  if (!/^[A-Za-z]/.test(cleaned)) cleaned = `b_${cleaned}`;
  if (cleaned === 'b_') cleaned = 'block';
  let name = cleaned;
  for (let n = 2; taken.has(name); n++) name = `${cleaned}_${n}`;
  taken.add(name);
  return name;
}

/** Whether a file's bytes look like a tokenized BBC BASIC program. */
function looksLikeBasic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 2 && bytes[0] === 0x0d && bytes[bytes.length - 1] === 0xff
  );
}

/** Top of user RAM below the paged-ROM slot; a block above it can't be RAM. */

/**
 * Headroom past the raw program bytes for BASIC's variables/workspace, matching
 * the memory-block linter's {@link bbcMicroMemoryBlocks} slack so the
 * representability test here agrees with the Run-path gate.
 */
const PROGRAM_AREA_SLACK = 512;

/** The inclusive `[address, address + length - 1]` a recovered file occupies. */
interface Span {
  start: number;
  end: number;
}

/**
 * Whether the recovered `blocks` can live side by side as fixed-address RAM
 * injections alongside a BASIC program of `basicLen` bytes - i.e. whether the
 * disc decomposes cleanly into the memory-block model. A block that loads below
 * PAGE, above RAM, overlaps the program area, or overlaps another block can't:
 * on the real disc such files are loaded at different times by the disc's own
 * loader, not all resident at once. When any block fails, the disc must instead
 * be booted verbatim (see {@link detokenizeBbcDiscWithReport}'s `bootDisc`).
 * Mirrors the error conditions in `src/app/blockLint.ts` (reserved-range
 * overlap is only a warning there, so a screen-RAM block still counts as
 * representable).
 */
function blocksAreRepresentable(
  spans: readonly Span[],
  basicLen: number,
): boolean {
  const programEnd = PAGE + basicLen + PROGRAM_AREA_SLACK - 1;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i]!;
    if (s.start < PAGE || s.end > RAM_TOP) return false;
    if (s.start <= programEnd && PAGE <= s.end) return false; // program overlap
    for (let j = i + 1; j < spans.length; j++) {
      const t = spans[j]!;
      if (s.start <= t.end && t.start <= s.end) return false; // block overlap
    }
  }
  return true;
}

/**
 * Import a DFS `.ssd` disc image: recover the BASIC program (the file at PAGE,
 * or the largest tokenized-BASIC-shaped file) as editable text, and every other
 * file - except the generated `!BOOT` - as a fixed-address {@link Block}
 * at its catalogue load address (its exec address kept as the block's entry when
 * it differs, marking machine code). The inverse of `buildBbcDiscImage`.
 */
export function detokenizeBbcDiscWithReport(
  image: Uint8Array,
  variant: BbcVariant = BASIC_II,
): DetokenizeResult {
  const { files } = readBbcDisc(image);
  const usable = files.filter((f) => f.name.toUpperCase() !== '!BOOT');

  // The BASIC program: prefer a file loading at PAGE, else the largest file
  // shaped like tokenized BASIC. Largest wins when several qualify.
  const bySizeDesc = [...usable].sort(
    (a, b) => b.bytes.length - a.bytes.length,
  );
  const basic =
    bySizeDesc.find((f) => f.load === PAGE && looksLikeBasic(f.bytes)) ??
    bySizeDesc.find((f) => f.load === PAGE) ??
    bySizeDesc.find((f) => looksLikeBasic(f.bytes)) ??
    null;

  const warnings: string[] = [];
  let source = '';
  if (basic) {
    const report = detokenizeWithReport(basic.bytes, variant);
    source = report.source;
    warnings.push(...report.warnings);
  } else {
    warnings.push(
      'The disc holds no BASIC program; its files were imported as memory blocks.',
    );
  }

  const taken = new Set<string>();
  const blocks: Block[] = [];
  usable.forEach((file, i) => {
    if (file === basic) return;
    const entry = file.exec !== file.load ? file.exec : undefined;
    blocks.push({
      id: `ssd-${i}`,
      name: blockName(file.name, taken),
      address: file.load & 0xffff,
      bytes: file.bytes,
      kind: 'code',
      ...(entry !== undefined ? { entry: entry & 0xffff } : {}),
    });
  });

  // A disc whose files can't coexist as fixed-address blocks (they load below
  // PAGE, overlap each other, or overlap the program area - a real game disc
  // whose own loader stages them in at different times) can't be run through
  // the decompose-and-reinject path. Preserve it and boot it verbatim instead:
  // MOS/DFS then loads every file at its true address, exactly as on hardware.
  const spans: Span[] = blocks.map((b) => ({
    start: b.address,
    end: b.address + b.bytes.length - 1,
  }));
  const basicLen = basic ? basic.bytes.length : 0;
  if (blocks.length > 0 && !blocksAreRepresentable(spans, basicLen)) {
    warnings.push(
      "The disc's files load at addresses the editor's memory blocks can't " +
        'represent, so it will be booted as a disc image (its own loader runs); ' +
        'the recovered listing is shown for reference.',
    );
    return { source, warnings, bootDisc: image };
  }

  if (blocks.length > 0) {
    warnings.push(
      `Recovered ${blocks.length} memory ${blocks.length === 1 ? 'block' : 'blocks'} from the disc.`,
    );
  }

  return { source, warnings, ...(blocks.length ? { blocks } : {}) };
}

/** Text-only detokenize (the {@link Dialect.detokenize} contract). */
export function detokenizeProgram(
  program: Uint8Array,
  variant: BbcVariant = BASIC_II,
): string {
  return detokenizeWithReport(program, variant).source;
}

function decodeBody(
  program: Uint8Array,
  start: number,
  end: number,
  variant: BbcVariant,
): string {
  let text = '';
  let i = start;
  // Statement-position state, tracked exactly as the tokenizer does: it decides
  // whether a leading '*' is an OS command (verbatim rest-of-line) or a
  // multiply operator, and it is reset by ':' and after THEN/ELSE. Spaces
  // preserve it.
  let statementStart = true;

  const decodeLiteralToEnd = (): void => {
    while (i < end) {
      const { text: t, length } = decodeSpan(program, i, end);
      text += t;
      i += length;
    }
  };

  while (i < end) {
    const b = program[i]!;

    // Line-number marker (expression context only).
    if (b === LINE_NUMBER_TOKEN && i + 3 < end) {
      text += decodeLineNumber(
        program[i + 1]!,
        program[i + 2]!,
        program[i + 3]!,
      );
      i += 4;
      statementStart = false;
      continue;
    }

    // Keyword tokens.
    const word = b >= 0x80 ? variant.wordByToken.get(b) : undefined;
    if (word !== undefined) {
      text += word;
      i++;
      if (b === REM_TOKEN || b === DATA_TOKEN) {
        decodeLiteralToEnd();
        break;
      }
      statementStart = b === THEN_TOKEN || b === ELSE_TOKEN;
      continue;
    }

    // Spaces/tabs are copied verbatim and leave statement state intact.
    if (b === 0x20 || b === 0x09) {
      text += String.fromCharCode(b);
      i++;
      continue;
    }

    // String literal: copied verbatim through the escape-aware decoder.
    if (b === QUOTE) {
      text += '"';
      i++;
      while (i < end && program[i] !== QUOTE) {
        const { text: t, length } = decodeSpan(program, i, end);
        text += t;
        i += length;
      }
      if (i < end) {
        text += '"';
        i++;
      }
      statementStart = false;
      continue;
    }

    // '*' OS command at a statement start: the rest of the line is literal.
    if (b === STAR && statementStart) {
      text += '*';
      i++;
      decodeLiteralToEnd();
      break;
    }

    // ':' opens a new statement.
    if (b === COLON) {
      text += ':';
      i++;
      statementStart = true;
      continue;
    }

    // Any other expression byte: a plain character, or a raw escape for a
    // (ROM-impossible here) non-printable so the decode stays total.
    const plain = plainChar(b);
    text += plain !== undefined ? plain : rawByte(b);
    i++;
    statementStart = false;
  }

  return text;
}
