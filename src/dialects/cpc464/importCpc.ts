/**
 * Import sniffing for the CPC's file formats. The Import dialog and drag-and-drop
 * hand raw bytes to {@link importCpcImage}, which recognises the container from
 * its shape:
 *
 * - a `.cdt` TZX tape image (signature `ZXTape!`) -> unwrap the firmware records;
 * - an AMSDOS-headered or raw tokenized `.bas` -> detokenize the program;
 * - anything else -> a plain-text BASIC listing, loaded as source verbatim.
 *
 * The last case is why a text `.bas` still opens as source: `.bas` names both the
 * editable listing and the tokenized on-disc form, so the importer must tell them
 * apart rather than detokenize a text file into garbage.
 */

import type { DetokenizeResult } from '../types';
import { detokenizeWithReport } from './detokenizer';
import { parseBasFile } from './basfile';
import { isCdt, parseCdt } from './cdt';

const latin1 = new TextDecoder('latin1');

/** Decode any CPC program container into editor text with fidelity warnings. */
export function importCpcImage(bytes: Uint8Array): DetokenizeResult {
  if (isCdt(bytes)) {
    const { program, warnings } = parseCdt(bytes);
    return withWarnings(detokenizeWithReport(program, 'basic10'), warnings);
  }

  // parseBasFile strips a valid AMSDOS header, or passes raw bytes through.
  const { program, warnings } = parseBasFile(bytes);
  if (looksTokenized(program)) {
    return withWarnings(detokenizeWithReport(program, 'basic10'), warnings);
  }

  // A plain-text listing: normalise line endings and load it as source.
  return { source: latin1.decode(bytes).replace(/\r\n?/g, '\n'), warnings: [] };
}

/** Prepend container-level warnings to a detokenize report. */
function withWarnings(
  report: DetokenizeResult,
  warnings: string[],
): DetokenizeResult {
  return warnings.length > 0
    ? { ...report, warnings: [...warnings, ...report.warnings] }
    : report;
}

/**
 * True when `bytes` is a tokenized Locomotive BASIC program: a chain of
 * `[u16 LE total length][u16 LE line number][tokens][0x00]` records ending in a
 * `0x0000` length word. A plain-text listing fails at the first record - "10 …"
 * reads as an implausible line length - so it falls through to the text path.
 */
function looksTokenized(bytes: Uint8Array): boolean {
  if (bytes.length < 2) return false;
  let p = 0;
  while (p + 1 < bytes.length) {
    const len = bytes[p]! | (bytes[p + 1]! << 8);
    if (len === 0) return true; // reached the end-of-program marker
    // A record is at least the two length/line words plus a 0x00 terminator.
    if (len < 5 || p + len > bytes.length) return false;
    if (bytes[p + len - 1] !== 0x00) return false;
    p += len;
  }
  return false;
}
