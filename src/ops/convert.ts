/**
 * A machine's own binary program file, read back as the BASIC it holds.
 *
 * `importProgram` (`src/app/importProgram.ts`) already does the work - it is
 * what the browser's Import dialog and drag-and-drop both call - so this is a
 * caller-agnostic wrapper around it, plus the one piece neither of those
 * needs: working out which machine a file belongs to when there is no open
 * project already fixing it. `build` (`src/ops/build.ts`) is the reverse
 * direction; this does not repeat it.
 */

import { importProgram } from '../app/importProgram';
import { dialectsForExtension } from '../dialects/binaryFormatLookup';
import { RunError } from '../dialects/headless/runError';
import type { Block, Dialect } from '../dialects/types';
import { decodeBytes, encodeBytes } from './bytes';
import { requireMachine } from './resolve';
import type { OpContext, Operation } from './types';

export interface ConvertInput {
  /** The file's bytes, base64; see `decodeBytes`. */
  base64: string;
  /**
   * The file's name, used to infer the machine from its extension when
   * `machine` is not given. Absent when the file arrived with no name (e.g.
   * standard input).
   */
  fileName?: string;
  machine?: string;
}

/** One recovered block, its bytes base64 so the outcome survives JSON. */
export interface ConvertBlock {
  id: string;
  name: string;
  kind: Block['kind'];
  address: number;
  base64: string;
}

export interface ConvertOutcome {
  machine: { id: string; name: string };
  source: string;
  warnings: string[];
  blocks?: ConvertBlock[];
  tapeFiles?: { name: string; kind: string }[];
  autoStart?: number | null;
}

function encodeBlock(block: Block): ConvertBlock {
  return {
    id: block.id,
    name: block.name,
    kind: block.kind,
    address: block.address,
    base64: encodeBytes(block.bytes),
  };
}

/**
 * The machine to read the file as: the one the caller named; else the one
 * registered dialect whose binary format matches the file's extension; else,
 * where the file's extension matches none or matches more than one, the
 * caller's pinned default (a conversation's machine, an MCP client's own
 * default); else the caller's mistake, naming every candidate when there was
 * more than one to choose from.
 */
function resolveConvertMachine(input: ConvertInput, ctx: OpContext): Dialect {
  if (input.machine !== undefined) return requireMachine(input.machine);
  const candidates =
    input.fileName === undefined ? [] : dialectsForExtension(input.fileName);
  if (candidates.length === 1) return candidates[0]!;
  if (candidates.length === 0 && ctx.defaultMachine !== undefined) {
    return requireMachine(ctx.defaultMachine);
  }
  if (candidates.length > 1) {
    throw new RunError(
      `more than one machine's format matches "${input.fileName}": ` +
        `${candidates.map((d) => d.name).join(', ')} (-m <machine> picks one)`,
    );
  }
  throw new RunError(
    'convert wants a machine: -m <machine> (basically machines lists them), ' +
      (input.fileName === undefined
        ? 'since nothing here names a file to infer one from'
        : `since no registered machine's binary format matches "${input.fileName}"`),
  );
}

export function convertProgram(
  input: ConvertInput,
  ctx: OpContext,
): ConvertOutcome {
  const dialect = resolveConvertMachine(input, ctx);
  const imported = importProgram(dialect, decodeBytes(input.base64));
  return {
    machine: { id: dialect.id, name: dialect.name },
    source: imported.source,
    warnings: imported.warnings,
    ...(imported.blocks ? { blocks: imported.blocks.map(encodeBlock) } : {}),
    ...(imported.tapeFiles && imported.tapeFiles.length > 0
      ? {
          tapeFiles: imported.tapeFiles.map((f) => ({
            name: f.name,
            kind: f.kind,
          })),
        }
      : {}),
    ...(imported.autoStart != null ? { autoStart: imported.autoStart } : {}),
  };
}

export const convertOp: Operation<ConvertInput, ConvertOutcome> = {
  name: 'convert',
  summary: "Read a machine's own binary program file back into BASIC.",
  description:
    "Read a machine's own binary program file - the format its emulator " +
    'loads, not a listing of BASIC text - and return the BASIC it holds. ' +
    'The machine is inferred from the file where its format identifies it, ' +
    'and named by the caller where it does not. Anything the conversion ' +
    'could not carry over - a warning, a block of bytes that is not BASIC, ' +
    'an auto-start line - is reported alongside the source rather than ' +
    'dropped.',
  input: {
    type: 'object',
    properties: {
      base64: { type: 'string', description: "The file's bytes, base64." },
      fileName: {
        type: 'string',
        description:
          "The file's name, to infer the machine from its extension when " +
          '`machine` is absent.',
      },
      machine: {
        type: 'string',
        description:
          "A machine's id or name; inferred from `fileName`'s extension " +
          'when absent and exactly one registered machine matches.',
      },
    },
    required: ['base64'],
    additionalProperties: false,
  },
  needs: 'nothing',
  cli: { kind: 'operation', name: 'convert' },
  mcp: { kind: 'tool' },
  run: convertProgram,
  describe: (outcome) => {
    const lines = outcome.source.split('\n').length;
    const parts = [
      `Read for ${outcome.machine.name}: ${lines} line${lines === 1 ? '' : 's'} ` +
        'of BASIC.',
      ...outcome.warnings,
    ];
    if (outcome.blocks && outcome.blocks.length > 0) {
      parts.push(
        `${outcome.blocks.length} block${outcome.blocks.length === 1 ? '' : 's'} ` +
          'of bytes recovered alongside it: ' +
          `${outcome.blocks.map((b) => b.name).join(', ')}.`,
      );
    }
    if (outcome.tapeFiles && outcome.tapeFiles.length > 0) {
      parts.push(
        `${outcome.tapeFiles.length} more file${outcome.tapeFiles.length === 1 ? '' : 's'} ` +
          `off the tape: ${outcome.tapeFiles.map((f) => f.name).join(', ')}.`,
      );
    }
    if (outcome.autoStart != null) {
      parts.push(`Auto-starts from line ${outcome.autoStart}.`);
    }
    return parts.join('\n');
  },
};
