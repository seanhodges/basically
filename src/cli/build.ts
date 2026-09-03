// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * A program built into the transfer format its machine really loads.
 *
 * The dialect's own build targets do the work - the same ones the Transfer
 * dialog calls - so a file written here and a file downloaded from the browser
 * are the same file. Nothing here touches the filesystem: the bytes come back
 * to the caller, which owns where they go.
 */

import { findMachine, RunError } from '../dialects/headless/runListing';
import { programNameFromFileName } from '../storage/files';
import { hasFatalErrors } from '../dialects/types';
import type { BuildTarget, Dialect, TokenizeError } from '../dialects/types';

/** One file a build produced, ready for the caller to write. */
export interface BuiltFile {
  /** The name the target suggests, e.g. "program.tap". */
  fileName: string;
  bytes: Uint8Array;
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
  opts: { out: string; target?: string },
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
  const wanted = extensionOf(opts.out);
  const matched = dialect.buildTargets.find(
    (t) =>
      t.fileExtension !== undefined && t.fileExtension.toLowerCase() === wanted,
  );
  const first = dialect.buildTargets[0];
  if (!first) throw new RunError(`${dialect.name} declares no build targets`);
  return matched ?? first;
}

export async function buildListing(opts: {
  machine: string;
  source: string;
  /** Where the first file will be written; names the target when none is given. */
  out: string;
  target?: string;
  programName?: string;
}): Promise<BuildOutcome> {
  const dialect = findMachine(opts.machine);
  if (!dialect) throw new RunError(`no registered machine "${opts.machine}"`);
  const target = chooseTarget(dialect, opts);
  const programName =
    opts.programName ?? programNameFromFileName(baseName(opts.out));

  const { errors, byteSize } = dialect.tokenize(opts.source, { programName });
  const machine = { id: dialect.id, name: dialect.name };
  if (hasFatalErrors(errors)) {
    return { machine, errors, target: null, programBytes: byteSize, files: [] };
  }

  const built = await target.build(opts.source, { programName });
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
      built.map(async (file) => ({
        fileName: file.fileName,
        bytes: new Uint8Array(await file.blob.arrayBuffer()),
      })),
    ),
  };
}
