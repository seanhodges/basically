/**
 * The on-disk project bundle format (`.bproj`): a JSON document pairing a
 * document's BASIC source with its {@link MemoryBlock}s, so both survive
 * Save/Open as a single human-readable, diffable file - no zip dependency.
 * Plain `.txt`/`.bas` remains the format for pure-BASIC documents with no
 * blocks; see `src/app/fileCommands.ts` for that format decision.
 *
 * Autosave (`src/storage/settings.ts`) persists blocks too, and reuses this
 * file's per-block wire codec ({@link serializeBlocks} / {@link parseBlocks})
 * so both paths agree on the same shape.
 */

import type { MemoryBlock } from '../dialects/types';
import { bytesToBase64, base64ToBytes } from './vfs/base64';

/** One {@link MemoryBlock}, wire-encoded for JSON (bytes as base64). */
export interface SerializedBlock {
  id: string;
  name: string;
  address: number;
  /** Base64-encoded {@link MemoryBlock.bytes}. */
  bytes: string;
  kind: 'code' | 'data';
  comment?: string;
  /**
   * Assembler source that produced `bytes`, when the block was built from
   * assembly rather than imported/POKEd bytes. An additive field owned by the
   * edit-export plan's assembler - this file round-trips it as an unknown
   * property (nothing here reads or writes it) so adding it needed no version
   * bump; {@link MemoryBlock} itself does not carry it.
   */
  asmSource?: string;
}

/** The `.bproj` document shape, version 1. */
export interface ProjectFileV1 {
  format: 'basically-project';
  version: 1;
  /** Id of the dialect the document (and its blocks) were saved under. */
  dialect: string;
  source: string;
  blocks: SerializedBlock[];
}

function serializeBlock(block: MemoryBlock): SerializedBlock {
  return {
    id: block.id,
    name: block.name,
    address: block.address,
    bytes: bytesToBase64(block.bytes),
    kind: block.kind,
    ...(block.comment !== undefined ? { comment: block.comment } : {}),
  };
}

/**
 * {@link MemoryBlock}s in their wire shape (bytes as base64). Shared by
 * {@link serializeProject} and autosave's block persistence.
 */
export function serializeBlocks(
  blocks: readonly MemoryBlock[],
): SerializedBlock[] {
  return blocks.map(serializeBlock);
}

/**
 * Decode one wire-shape block back into a {@link MemoryBlock}. Throws
 * `Error` on any structural problem, naming the offending block by index.
 */
function parseBlock(raw: unknown, index: number): MemoryBlock {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`Project file block ${index} is not an object.`);
  }
  const b = raw as Record<string, unknown>;
  if (typeof b.id !== 'string') {
    throw new Error(`Project file block ${index} is missing an "id".`);
  }
  if (typeof b.name !== 'string') {
    throw new Error(`Project file block ${index} is missing a "name".`);
  }
  if (typeof b.address !== 'number' || !Number.isFinite(b.address)) {
    throw new Error(`Project file block ${index} has an invalid "address".`);
  }
  if (typeof b.bytes !== 'string') {
    throw new Error(`Project file block ${index} is missing "bytes".`);
  }
  if (b.kind !== 'code' && b.kind !== 'data') {
    throw new Error(`Project file block ${index} has an invalid "kind".`);
  }
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(b.bytes);
  } catch {
    throw new Error(`Project file block ${index} has malformed "bytes".`);
  }
  return {
    id: b.id,
    name: b.name,
    address: b.address,
    bytes,
    kind: b.kind,
    ...(typeof b.comment === 'string' ? { comment: b.comment } : {}),
  };
}

/**
 * Decode wire-shape blocks (a parsed {@link ProjectFileV1}'s `blocks`, or
 * autosave's stored array) back into {@link MemoryBlock}s. Throws on the
 * first structurally invalid entry - callers that want a defensive,
 * never-throws load (autosave) catch around this themselves.
 */
export function parseBlocks(raw: unknown[]): MemoryBlock[] {
  return raw.map((b, i) => parseBlock(b, i));
}

/** Build the `.bproj` JSON text for a document. */
export function serializeProject(
  dialectId: string,
  source: string,
  blocks: readonly MemoryBlock[],
): string {
  const file: ProjectFileV1 = {
    format: 'basically-project',
    version: 1,
    dialect: dialectId,
    source,
    blocks: serializeBlocks(blocks),
  };
  return JSON.stringify(file, null, 2);
}

export interface ParsedProject {
  dialect: string;
  source: string;
  blocks: MemoryBlock[];
}

/**
 * Parse `.bproj` JSON text. Throws `Error` with a human-readable message on
 * malformed JSON, a missing/wrong `format`, an unsupported `version`, or any
 * structurally invalid field - matching this codebase's other import-style
 * parsers (e.g. the `.tap`/`.p` readers), which throw rather than collecting
 * errors, since a corrupt project file can't be partially loaded.
 */
export function parseProject(text: string): ParsedProject {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Not a valid project file: malformed JSON.');
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Not a valid project file.');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== 'basically-project') {
    throw new Error('Not a Basically project file.');
  }
  if (obj.version !== 1) {
    throw new Error(
      `Unsupported project file version: ${String(obj.version)}.`,
    );
  }
  if (typeof obj.dialect !== 'string') {
    throw new Error('Project file is missing its "dialect".');
  }
  if (typeof obj.source !== 'string') {
    throw new Error('Project file is missing its "source".');
  }
  if (!Array.isArray(obj.blocks)) {
    throw new Error('Project file has malformed "blocks".');
  }
  return {
    dialect: obj.dialect,
    source: obj.source,
    blocks: parseBlocks(obj.blocks),
  };
}

/**
 * Cheap sniff for whether `text` looks like a `.bproj` bundle - used to route
 * a dropped/opened `.txt` (project-shaped text is accepted there too,
 * alongside the `.bproj` extension) to {@link parseProject} instead of
 * loading it as plain source. Checks only the `format` tag, not the full
 * shape - {@link parseProject} still throws a clear error for anything that
 * sniffs positive but doesn't actually parse.
 */
export function isProjectFile(text: string): boolean {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('{')) return false;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return (
      !!parsed &&
      typeof parsed === 'object' &&
      (parsed as Record<string, unknown>).format === 'basically-project'
    );
  } catch {
    return false;
  }
}
