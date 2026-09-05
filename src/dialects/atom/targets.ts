import type { BuildTarget, Block } from '../types';
import {
  buildAtomImage,
  buildCassetteSamples,
  CASSETTE_SAMPLE_RATE,
} from './audio/cassetteEncoder';
import { buildAtm } from './atm';
import {
  buildAtomDsk,
  composeAtomDskFiles,
  type AtomDskExportEntry,
} from './atomDsk';
import { cassetteWavTarget, fileTarget } from '../targetHelpers';

/**
 * Tokenize `source` into the `#2900` program image, or an empty array for a
 * document with no BASIC lines (a machine-code-only disc). {@link buildAtomImage}
 * throws on tokenizer errors, so a broken program is reported rather than
 * silently exported.
 */
function programImage(source: string): Uint8Array {
  if (source.trim() === '') return new Uint8Array(0);
  return buildAtomImage(source);
}

/**
 * Compose the ordered `.dsk` files for a document: the BASIC program plus each
 * memory block as its own catalogue file with real load/exec addresses. The
 * `loader` flag is accepted for parity with the block-aware {@link BuildTarget}
 * contract (and the Transfer dialog's auto-loader checkbox) but is not yet
 * honoured - an Atom `*LOAD`-each-block bootstrap is a scoped follow-up; a `.dsk`
 * carries every file regardless, so nothing is dropped meanwhile.
 */
export function exportAtomDskEntries(
  source: string,
  programName: string,
  blocks: readonly Block[] = [],
  _loader = false,
): AtomDskExportEntry[] {
  return composeAtomDskFiles(programImage(source), blocks, programName);
}

/**
 * Atom build targets: a native `.atm` binary (the `#2900` program image wrapped
 * in the standard Atom emulator header), a block-carrying `.dsk` disc image, and
 * a cassette `.wav`. The `.atm` is the de-facto interchange format that other
 * Atom emulators load directly; the bare image alone is also importable, since
 * {@link import('./atm').stripAtmHeader} accepts either. The `.dsk` is the only
 * target that carries the document's memory blocks - the `.atm`/`.wav` targets
 * export the BASIC program only, so the Transfer dialog warns before dropping
 * blocks to them.
 */
export const atomBuildTargets: BuildTarget[] = [
  fileTarget(
    'atom-atm',
    'Export .ATM binary',
    'atm',
    (source, { programName }) => buildAtm(buildAtomImage(source), programName),
  ),
  fileTarget(
    'atom-dsk',
    'Export .dsk disk',
    'dsk',
    (source, { programName, blocks, loader }) =>
      buildAtomDsk(
        exportAtomDskEntries(source, programName, blocks, loader),
        programName,
      ),
    // A DFS-family disc image carries the BASIC program plus each memory block as
    // its own file, with the load/exec attributes that tell BASIC from code.
    { supportsBlocks: true },
  ),
  cassetteWavTarget({
    sampleRate: CASSETTE_SAMPLE_RATE,
    buildSamples: (source, { programName }) =>
      buildCassetteSamples(source, programName),
  }),
];
