// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A Sorcerer tape read back into an editable document.
 *
 * Shared by the two import paths, which differ only in where the bytes came
 * from: the `.tape` file the Import dialog opens goes through
 * {@link detokenizeTape}, and recorded cassette audio goes through
 * `audio/cassetteDecoder.ts` once it has demodulated the same byte stream.
 * Neither wants its own idea of which record on a tape is the program.
 *
 * The choice is made on the header rather than guessed: `CSAVE` stamps a BASIC
 * program with {@link TAPE_BASIC_MARK} (see `tapeFile.ts`), so the marked
 * record is the one opened in the editor and every other record becomes a
 * memory block at its own load address. A tape written entirely by the
 * Monitor's `SA` carries no mark at all, so a record loading at the program
 * base is taken as the program - which is what the machine's own `CLOAD` would
 * do with it.
 */

import type { Block, DetokenizeResult } from '../types';
import { codeFilesToBlocks, type ImportedCodeFile } from '../importBlocks';
import { PROGRAM_BASE } from './addresses';
import { parseBasicImage } from './basicImage';
import { detokenizeProgram } from './detokenizer';
import {
  TapeRecordError,
  hasTapeLead,
  parseTapeRecords,
  type SorcererTapeRecord,
} from './tapeFile';

/** A tape's contents, in the shape both import paths report. */
export interface ImportedTape extends DetokenizeResult {
  /** Name off the BASIC record's header, trimmed; empty when there is none. */
  programName: string;
}

/** Format a byte address as `0xNNNN` for a warning message. */
function hex(n: number): string {
  return `0x${n.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** The record to open in the editor, or -1 when the tape holds no program. */
function findProgramRecord(records: readonly SorcererTapeRecord[]): number {
  const marked = records.findIndex((r) => r.basic);
  if (marked !== -1) return marked;
  return records.findIndex((r) => r.loadAddress === PROGRAM_BASE);
}

/**
 * Turn the records off a tape into a document.
 *
 * The BASIC record's payload is one byte longer than the program (see
 * `CSAVE_TAIL_BYTES` in the encoder), so a single byte past the end-of-program
 * link is expected and silent. Anything longer than that is machine code
 * somebody deposited above the program, and is preserved as a block with a
 * warning rather than dropped.
 */
export function importTapeRecords(
  records: readonly SorcererTapeRecord[],
): ImportedTape {
  const warnings: string[] = [];
  const programAt = findProgramRecord(records);
  const codeFiles: ImportedCodeFile[] = [];

  let source = '';
  let programName = '';
  if (programAt === -1) {
    warnings.push(
      'The tape holds no BASIC program, so the editor is empty and every ' +
        'file on it was imported as a memory block.',
    );
  } else {
    const record = records[programAt]!;
    programName = record.name.trim();
    const image = parseBasicImage(record.payload);
    source = detokenizeProgram(image);
    const trailing = record.payload.length - image.length;
    if (trailing > 1) {
      const address = record.loadAddress + image.length;
      codeFiles.push({
        name: '',
        address,
        bytes: record.payload.slice(image.length),
      });
      warnings.push(
        `${trailing} bytes after the end-of-program marker (likely appended ` +
          `machine code) were preserved as a memory block at ${hex(address)}.`,
      );
    }
  }

  records.forEach((record, i) => {
    if (i === programAt) return;
    codeFiles.push({
      name: record.name.trim(),
      address: record.loadAddress,
      bytes: record.payload,
      ...(record.execAddress !== 0 ? { entry: record.execAddress } : {}),
    });
  });

  const blocks: Block[] = codeFilesToBlocks(codeFiles);
  return {
    programName,
    source,
    warnings,
    ...(blocks.length > 0 ? { blocks } : {}),
  };
}

/**
 * The dialect's `detokenizeWithReport`: a `.tape` file, or a bare program image.
 *
 * Both forms reach it, because the seam hands whatever the user opened. A tape
 * opens with a lead; anything else is the program area as the interpreter holds
 * it, which is also what `detokenize` alone has always accepted.
 */
export function detokenizeTape(image: Uint8Array): DetokenizeResult {
  if (!hasTapeLead(image)) {
    const program = parseBasicImage(image);
    const trailing = image.length - program.length;
    const source = detokenizeProgram(program);
    if (trailing === 0) return { source, warnings: [] };
    const address = PROGRAM_BASE + program.length;
    return {
      source,
      warnings: [
        `${trailing} byte${trailing === 1 ? '' : 's'} after the ` +
          `end-of-program marker (likely appended machine code) ` +
          `${trailing === 1 ? 'was' : 'were'} preserved as a memory block at ` +
          `${hex(address)}.`,
      ],
      blocks: codeFilesToBlocks([
        { name: '', address, bytes: image.slice(program.length) },
      ]),
    };
  }

  try {
    const { source, warnings, blocks } = importTapeRecords(
      parseTapeRecords(image),
    );
    return { source, warnings, ...(blocks ? { blocks } : {}) };
  } catch (e) {
    // A corrupt record is reported rather than half-decoded, the way the
    // machine refuses one: an empty document and the reason why.
    if (e instanceof TapeRecordError)
      return { source: '', warnings: [e.message] };
    throw e;
  }
}
