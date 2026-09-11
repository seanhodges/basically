import type { BuildTarget, ExportFile, TokenizeError } from './types';
import { fatalErrors } from './types';
import { samplesToWav } from '../transfer/wav';

/** The options every {@link BuildTarget.build} is handed. */
export type BuildTargetOptions = Parameters<BuildTarget['build']>[1];

/**
 * Refuse to export a program the machine could not load back.
 *
 * Only {@link fatalErrors} count: heuristic statement-shape lint squiggles in
 * the editor but must not stop a hardware-runnable program - one just imported,
 * say - from being exported again.
 */
export function assertNoFatalErrors(errors: readonly TokenizeError[]): void {
  const fatal = fatalErrors(errors);
  if (fatal.length > 0) {
    throw new Error(
      `Program has ${fatal.length} error(s) - fix them before building`,
    );
  }
}

/**
 * The shared export guard: reject a program the machine could not load, then
 * hand its bytes back.
 *
 * `emptyAt` is the byte length at or below which the tokenized program holds no
 * lines. It is 0 where the image carries no terminator of its own (the ZX80 and
 * ZX81 `.P`/`.O` builders add it) and 2 wherever an empty program is already a
 * bare end marker - the Commodore `0x0000` link, the BBC's `0x0D 0xFF`, the
 * CPC's `0x0000`.
 */
export function buildImageOrThrow(
  tokenized: { bytes: Uint8Array; errors: readonly TokenizeError[] },
  emptyAt = 0,
): Uint8Array {
  assertNoFatalErrors(tokenized.errors);
  if (tokenized.bytes.length <= emptyAt) {
    throw new Error('Program is empty');
  }
  return tokenized.bytes;
}

/**
 * The paper tape both Dartmouth machines punch: the program's listing, each
 * line closed by the CR LF a Teletype reader needs.
 *
 * The text comes back off the tokenized image rather than out of the editor, so
 * what is written is what the tape holds - the canonical record the tokenizer
 * punches (line number, one space, the trimmed body), with blank editor lines
 * gone and the lines in the order they were typed.
 *
 * **Why the listing rather than the machine's own codes.** A `.txt` re-opens
 * through the plain-text path, which reads the file as text and never calls
 * `detokenize`. A tape punched as raw machine codes therefore comes back as
 * whatever those bytes mean to a text reader, and a machine whose codes are not
 * their own ASCII reading loses them: an unprintable code has no character at
 * all, and a code whose glyph the charset overrides - the ASR-33's up and back
 * arrows at 94 and 95, which a later ASCII reads as `^` and `_` - comes back as
 * a character the charset cannot encode. Both are then a fatal error on a file
 * the machine had just written. Writing the listing puts the characters the
 * editor reads onto the file, escapes and all, so the round trip holds for
 * every code.
 */
export function paperTapeListing(
  tokenized: { image: Uint8Array; errors: readonly TokenizeError[] },
  detokenize: (image: Uint8Array) => string,
): Uint8Array {
  assertNoFatalErrors(tokenized.errors);
  const listing = detokenize(tokenized.image);
  if (listing === '') throw new Error('Program is empty');
  return new TextEncoder().encode(
    listing
      .split('\n')
      .map((line) => `${line}\r\n`)
      .join(''),
  );
}

/**
 * A one-file export target, owning the filename convention every dialect
 * shares: the document's name lower-cased, plus the target's own extension.
 *
 * `build` returns the file's bytes (wrapped as an octet stream) or a ready-made
 * {@link Blob} where the payload is not binary - a paper tape is text.
 */
export function fileTarget(
  id: string,
  label: string,
  fileExtension: string,
  build: (source: string, opts: BuildTargetOptions) => Uint8Array | Blob,
  extra: { supportsBlocks?: true } = {},
): BuildTarget {
  return {
    id,
    label,
    fileExtension,
    ...extra,
    build: (source, opts) =>
      Promise.resolve([exportFile(fileExtension, build(source, opts), opts)]),
  };
}

function exportFile(
  fileExtension: string,
  payload: Uint8Array | Blob,
  opts: BuildTargetOptions,
): ExportFile {
  return {
    fileName: `${opts.programName.toLowerCase()}.${fileExtension}`,
    blob:
      payload instanceof Blob
        ? payload
        : new Blob([payload as BlobPart], { type: 'application/octet-stream' }),
  };
}

/**
 * The cassette-audio target, identical on every machine with a tape deck: the
 * dialect's own encoder produces the samples and {@link samplesToWav} frames
 * them, at the "not robust" timings a sound card plays back cleanly (the robust
 * timings are for the Transfer dialog's play path, not for a file).
 */
export function cassetteWavTarget(opts: {
  /** Defaults to `wav`; dialects that namespace their target ids pass their own. */
  id?: string;
  sampleRate: number;
  buildSamples(source: string, opts: BuildTargetOptions): Float32Array;
  /** Set where the dialect's tape format carries the document's memory blocks. */
  supportsBlocks?: true;
}): BuildTarget {
  return fileTarget(
    opts.id ?? 'wav',
    'Export cassette .wav',
    'wav',
    (source, buildOpts) =>
      samplesToWav(opts.buildSamples(source, buildOpts), opts.sampleRate),
    opts.supportsBlocks ? { supportsBlocks: opts.supportsBlocks } : {},
  );
}
