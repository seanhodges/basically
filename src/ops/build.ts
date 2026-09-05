/**
 * A program built into the transfer format its machine really loads.
 *
 * The dialect's own build targets do the work - the same ones the Transfer
 * dialog calls - so a file written from any caller and a file downloaded from
 * the browser are the same file. Nothing here touches a filesystem: the bytes
 * come back encoded, and the caller owns where they go.
 */

import { RunError } from '../dialects/headless/runError';
import { programNameFromFileName } from '../storage/files';
import { hasFatalErrors } from '../dialects/types';
import type { BuildTarget, Dialect, TokenizeError } from '../dialects/types';
import { remapErrors } from '../dialects/resolveListing';
import { encodeBytes } from './bytes';
import { resolveProgram } from './resolve';
import type { OpContext, Operation } from './types';

/** One file a build produced, ready for the caller to write. */
export interface BuiltFile {
  /** The name the target suggests, e.g. "program.tap". */
  fileName: string;
  /** The file's bytes, base64; see `decodeBytes`. */
  base64: string;
  /** How many bytes those are, so a reader need not decode to say. */
  size: number;
}

export interface BuildOutcome {
  machine: { id: string; name: string };
  /** Tokenizer problems; a fatal one means nothing was built. */
  errors: TokenizeError[];
  /** The target that was chosen, or null when a fatal problem stopped the build. */
  target: { id: string; label: string; fileExtension?: string } | null;
  /** Size of the tokenized program, as the RAM budget counts it. */
  programBytes: number;
  /** Empty when a fatal problem stopped the build. */
  files: BuiltFile[];
}

export interface BuildInput {
  source: string;
  machine?: string;
  /**
   * The name the first file will be written under. Names the target by its
   * extension when none is given, and the program when no name is given.
   */
  fileName?: string;
  /** A build target id, when the caller named one. */
  target?: string;
  /** The name the machine stores the program under. */
  programName?: string;
}

/** The last segment of a path, whichever separator a host writes. */
function baseName(path: string): string {
  return path.split(/[\\/]/).pop() ?? '';
}

/** The extension of a path, lower case and without the dot, or null. */
function extensionOf(path: string): string | null {
  const name = baseName(path);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : null;
}

/**
 * The target to build with: the one the caller named, else the one whose own
 * declared extension matches the file being written, else the machine's first.
 *
 * The extension rule needs no table because every target already declares what
 * it produces, so a caller writing `prog.wav` gets the tape audio without
 * having to know its target id.
 */
export function chooseTarget(
  dialect: Dialect,
  opts: { fileName?: string; target?: string },
): BuildTarget {
  if (opts.target !== undefined) {
    const named = dialect.buildTargets.find((t) => t.id === opts.target);
    if (!named) {
      throw new RunError(
        `${dialect.name} has no build target "${opts.target}" ` +
          `(basically info ${dialect.id} lists them)`,
      );
    }
    return named;
  }
  const wanted =
    opts.fileName === undefined ? null : extensionOf(opts.fileName);
  const matched = dialect.buildTargets.find(
    (t) =>
      wanted !== null &&
      t.fileExtension !== undefined &&
      t.fileExtension.toLowerCase() === wanted,
  );
  const first = dialect.buildTargets[0];
  if (!first) throw new RunError(`${dialect.name} declares no build targets`);
  return matched ?? first;
}

export async function buildListing(
  input: BuildInput,
  ctx: OpContext,
): Promise<BuildOutcome> {
  const resolved = resolveProgram('build', input, ctx);
  const dialect = resolved.dialect;
  const target = chooseTarget(dialect, input);
  const programName =
    input.programName ??
    programNameFromFileName(baseName(input.fileName ?? ''));

  const result = dialect.tokenize(resolved.source, { programName });
  const errors = [
    ...resolved.problems,
    ...remapErrors(result.errors, resolved.remapLine),
  ];
  const byteSize = result.byteSize;
  const machine = { id: dialect.id, name: dialect.name };
  if (hasFatalErrors(errors)) {
    return { machine, errors, target: null, programBytes: byteSize, files: [] };
  }

  const built = await target.build(resolved.source, { programName });
  return {
    machine,
    errors,
    target: {
      id: target.id,
      label: target.label,
      fileExtension: target.fileExtension,
    },
    programBytes: byteSize,
    // Read through the blob rather than assuming what a target put in it: a
    // target is free to hand back a Blob built from strings, typed arrays or
    // both, and only the blob knows.
    files: await Promise.all(
      built.map(async (file) => {
        const bytes = new Uint8Array(await file.blob.arrayBuffer());
        return {
          fileName: file.fileName,
          base64: encodeBytes(bytes),
          size: bytes.length,
        };
      }),
    ),
  };
}

/** A tokenizer problem as a sentence, placed the way a compiler places one. */
function describeError(e: TokenizeError): string {
  const where =
    e.column === undefined ? `${e.line}` : `${e.line}:${e.column + 1}`;
  return `${where}: ${e.fatal === false ? 'warning' : 'error'}: ${e.message}`;
}

export const buildOp: Operation<BuildInput, BuildOutcome> = {
  name: 'build',
  summary: 'Build a program into the file its machine loads.',
  description:
    'Build a program into the transfer format its machine really loads, and ' +
    'report what it built to: the target, the size of the program as the ' +
    "machine's memory counts it, and the files produced with their sizes. " +
    'The bytes themselves are not returned. A program with a fatal problem ' +
    'is not built, and the problem is reported instead.',
  input: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'The whole program.' },
      machine: {
        type: 'string',
        description:
          "A machine's id or name; the program's own #MACHINE line, else " +
          "this conversation's machine, when absent.",
      },
      fileName: {
        type: 'string',
        description:
          'The name the first file would be written under; picks the target ' +
          'by its extension, and names the program, when neither is given.',
      },
      target: {
        type: 'string',
        description:
          "A build target id from the machine's description; the machine's " +
          'first target when absent.',
      },
      programName: {
        type: 'string',
        description: 'The name the machine stores the program under.',
      },
    },
    required: ['source'],
    additionalProperties: false,
  },
  needs: 'nothing',
  cli: { kind: 'operation', name: 'build' },
  assistant: { kind: 'tool' },
  mcp: { kind: 'tool' },
  run: buildListing,
  failed: (outcome) => outcome.target === null,
  describe: (outcome) => {
    const problems = outcome.errors.map(describeError);
    if (outcome.target === null) {
      return [
        'Nothing was built: the program has a problem that prevents it.',
        ...problems,
      ].join('\n');
    }
    return [
      `Built for ${outcome.machine.name} as ${outcome.target.label} ` +
        `(${outcome.target.id}): the program is ${outcome.programBytes} bytes ` +
        "as the machine's memory counts it.",
      ...outcome.files.map((f) => `  ${f.fileName}: ${f.size} bytes`),
      ...problems,
    ].join('\n');
  },
};
