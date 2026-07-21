/**
 * The on-disk project bundle format (a `.zip`): a **zip** archive that holds a
 * document's pieces as first-class files -
 *
 * ```
 * program.bas            the BASIC source (text)
 * blocks/<name>.bin      each {@link MemoryBlock}'s raw bytes
 * blocks/<name>.asm      each code block's assembly source (when it has one)
 * project.json           the metadata file (see {@link ProjectMetaV2})
 * ```
 *
 * so the parts unzip into files you can open directly (see
 * {@link serializeProjectZip} / {@link parseProjectZip}). `project.json` is
 * metadata only: it names the entries above and carries the fields that have no
 * natural standalone file - the dialect id, auto-start line, listing-block
 * overrides, and the rarer multi-part-import payloads ({@link TapeFile}s and a
 * verbatim boot disc), which stay base64-encoded inside it. Every document now
 * saves as this bundle; a plain `.bas` for a single tab is a per-tab download
 * (see `src/components/EditorTabBar.tsx`), no longer a Save format.
 *
 * Autosave (`src/storage/settings.ts`) persists blocks and tape files too, and
 * reuses this file's wire codecs ({@link serializeBlocks} / {@link parseBlocks}
 * and {@link serializeTapeFiles} / {@link parseTapeFiles}) so both paths agree
 * on the same shape.
 */

import { zipSync, unzipSync } from 'fflate';
import type { MemoryBlock, TapeFile } from '../dialects/types';
import { bytesToBase64, base64ToBytes } from './vfs/base64';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Zip entry path of the BASIC source. */
const SOURCE_PATH = 'program.bas';
/** Zip entry path of the metadata file. */
const META_PATH = 'project.json';
/** Zip entry path of a block's raw bytes (block names are filesystem-safe). */
const blockBinPath = (name: string): string => `blocks/${name}.bin`;
/** Zip entry path of a code block's assembly source. */
const blockAsmPath = (name: string): string => `blocks/${name}.asm`;

/**
 * The only valid shape for {@link MemoryBlock.name}: starts with a letter,
 * then any number of letters, digits, or underscores. Matches the pattern
 * documented on the type itself.
 */
const BLOCK_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*$/;

/** Whether `name` is a valid {@link MemoryBlock.name} (see {@link BLOCK_NAME_PATTERN}). */
export function isValidBlockName(name: string): boolean {
  return BLOCK_NAME_PATTERN.test(name);
}

/**
 * The first block name that appears more than once in `blocks`, or `null`
 * when every name is unique - names must be unique per document.
 */
export function findDuplicateBlockName(
  blocks: readonly { name: string }[],
): string | null {
  const seen = new Set<string>();
  for (const b of blocks) {
    if (seen.has(b.name)) return b.name;
    seen.add(b.name);
  }
  return null;
}

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
   * Execution entry address recovered with an imported code payload (see
   * {@link MemoryBlock.entry}). Optional and additive like `comment` - older
   * project files without it load with no entry - so no version bump.
   */
  entry?: number;
  /**
   * The assembly source last edited for this code block (see
   * {@link MemoryBlock.asmSource} - `bytes` remain the source of truth).
   * Optional and additive like `entry`, so no version bump: the field was
   * reserved here before the assembler existed, and older project files
   * without it simply load with a fresh disassembly.
   */
  asmSource?: string;
}

/** One {@link TapeFile}, wire-encoded for JSON (bytes as base64). */
export interface SerializedTapeFile {
  name: string;
  kind: string;
  /** Base64-encoded {@link TapeFile.tap} (a ready two-block `.TAP` payload). */
  tap: string;
}

/**
 * One {@link MemoryBlock}'s metadata in {@link ProjectMetaV2}. The bytes and
 * assembly source live as their own zip entries ({@link bin} / {@link asm}),
 * not inline - so this carries only the fields that describe them.
 */
export interface SerializedBlockMeta {
  name: string;
  address: number;
  kind: 'code' | 'data';
  comment?: string;
  /** Execution entry address (see {@link MemoryBlock.entry}). Additive. */
  entry?: number;
  /** Zip entry path of this block's raw bytes (see {@link blockBinPath}). */
  bin: string;
  /**
   * Zip entry path of this block's assembly source (see {@link blockAsmPath}),
   * present only when the block carries one. `bin` remains the source of truth.
   */
  asm?: string;
}

/**
 * The `project.json` metadata shape, version 2 - the manifest for the project
 * zip. Names the source and per-block entries and carries the fields with no
 * natural standalone file. Bumped from the version-1 monolithic-JSON format,
 * which is no longer read.
 */
export interface ProjectMetaV2 {
  format: 'basically-project';
  version: 2;
  /** Id of the dialect the document (and its blocks) were saved under. */
  dialect: string;
  /** Zip entry path of the BASIC source (see {@link SOURCE_PATH}). */
  source: string;
  blocks: SerializedBlockMeta[];
  /**
   * The program's auto-start line (a Spectrum `.TAP` header's auto-run line),
   * when the document was imported from an image carrying one. Optional and
   * additive - files without it load as "no auto-start". The run path starts
   * from this line rather than the first line (see
   * {@link ParsedProject.autoStart}).
   */
  autoStart?: number | null;
  /**
   * Extra tape files preserved off a multi-part import (see {@link TapeFile}),
   * beyond the one program in `source` and the CODE files in `blocks`. Kept
   * base64-encoded here (rare, no natural standalone file). Optional and
   * additive - files without it load as "no preserved tape". Mounted on the
   * emulator's virtual tape at run time (see {@link ParsedProject.tapeFiles}).
   */
  tapeFiles?: SerializedTapeFile[];
  /**
   * Per-ordinal overrides for a document's derived listing blocks (ZX80/ZX81):
   * the name / code-vs-data kind / comment a `#BIN` record can't carry. Optional
   * and additive - files without it load with the derived defaults. The blocks
   * themselves re-derive from `source`.
   */
  listingBlockMeta?: SerializedListingBlockMeta;
  /**
   * A verbatim disc image (base64) the document boots instead of running its
   * tokenized `source` - a multi-file BBC `.ssd` the memory-block model can't
   * represent (see the document field of the same name). Kept base64-encoded
   * here. Optional and additive - files without it load as a plain program.
   */
  bootDisc?: string;
}

function serializeBlock(block: MemoryBlock): SerializedBlock {
  return {
    id: block.id,
    name: block.name,
    address: block.address,
    bytes: bytesToBase64(block.bytes),
    kind: block.kind,
    ...(block.comment !== undefined ? { comment: block.comment } : {}),
    ...(block.entry !== undefined ? { entry: block.entry } : {}),
    ...(block.asmSource !== undefined ? { asmSource: block.asmSource } : {}),
  };
}

/**
 * {@link MemoryBlock}s in their wire shape (bytes as base64). Shared by
 * autosave's block persistence (the project zip bundle stores block bytes as
 * their own zip entries instead - see {@link serializeProjectZip}).
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
  if (!isValidBlockName(b.name)) {
    throw new Error(
      `Project file block ${index} has an invalid "name" ("${b.name}"): ` +
        'names must start with a letter and contain only letters, digits, or underscores.',
    );
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
    ...(typeof b.entry === 'number' && Number.isInteger(b.entry)
      ? { entry: b.entry }
      : {}),
    ...(typeof b.asmSource === 'string' ? { asmSource: b.asmSource } : {}),
  };
}

/**
 * Decode wire-shape blocks (autosave's stored array) back into
 * {@link MemoryBlock}s. Throws on the
 * first structurally invalid entry, an invalid `name`, or a `name` shared by
 * more than one block (names must be unique per document) - callers that
 * want a defensive, never-throws load (autosave) catch around this
 * themselves.
 */
export function parseBlocks(raw: unknown[]): MemoryBlock[] {
  const blocks = raw.map((b, i) => parseBlock(b, i));
  const dup = findDuplicateBlockName(blocks);
  if (dup !== null) {
    throw new Error(
      `Project file has more than one memory block named "${dup}".`,
    );
  }
  return blocks;
}

/**
 * Per-ordinal overrides (name / code-vs-data kind / comment) for a document's
 * derived listing blocks (ZX80/ZX81), keyed by the block's ordinal as a string.
 * A `#BIN` record carries none of these, so they ride in the project metadata.
 */
export type SerializedListingBlockMeta = Record<
  string,
  {
    name?: string;
    kind?: 'code' | 'data';
    comment?: string;
    asmSource?: string;
  }
>;

/**
 * Validate an untrusted listing-block-metadata map (from a project zip or
 * autosave) into a clean ordinal-keyed record. Defensive like
 * {@link parseBlocks}'s callers expect: unknown/invalid entries are dropped
 * rather than throwing, since the blocks themselves always re-derive from
 * `source`.
 */
export function parseListingBlockMeta(raw: unknown): Record<
  number,
  {
    name?: string;
    kind?: 'code' | 'data';
    comment?: string;
    asmSource?: string;
  }
> {
  const out: Record<
    number,
    {
      name?: string;
      kind?: 'code' | 'data';
      comment?: string;
      asmSource?: string;
    }
  > = {};
  if (raw === null || typeof raw !== 'object') return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const ordinal = Number(k);
    if (!Number.isInteger(ordinal) || ordinal < 0) continue;
    if (v === null || typeof v !== 'object') continue;
    const m = v as Record<string, unknown>;
    const meta: {
      name?: string;
      kind?: 'code' | 'data';
      comment?: string;
      asmSource?: string;
    } = {};
    if (typeof m.name === 'string' && isValidBlockName(m.name))
      meta.name = m.name;
    if (m.kind === 'code' || m.kind === 'data') meta.kind = m.kind;
    if (typeof m.comment === 'string') meta.comment = m.comment;
    if (typeof m.asmSource === 'string') meta.asmSource = m.asmSource;
    if (Object.keys(meta).length > 0) out[ordinal] = meta;
  }
  return out;
}

/**
 * {@link TapeFile}s in their wire shape (bytes as base64). Shared by
 * {@link serializeProjectZip} and autosave's tape-file persistence.
 */
export function serializeTapeFiles(
  tapeFiles: readonly TapeFile[],
): SerializedTapeFile[] {
  return tapeFiles.map((t) => ({
    name: t.name,
    kind: t.kind,
    tap: bytesToBase64(t.tap),
  }));
}

/**
 * Decode one wire-shape tape file back into a {@link TapeFile}. Throws `Error`
 * on any structural problem, naming the offending entry by index. Unlike a
 * {@link MemoryBlock}, a tape file's `name` is a free-form tape label (not an
 * identifier), so only presence/type is checked.
 */
function parseTapeFile(raw: unknown, index: number): TapeFile {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`Project file tape file ${index} is not an object.`);
  }
  const t = raw as Record<string, unknown>;
  if (typeof t.name !== 'string') {
    throw new Error(`Project file tape file ${index} is missing a "name".`);
  }
  if (typeof t.kind !== 'string') {
    throw new Error(`Project file tape file ${index} is missing a "kind".`);
  }
  if (typeof t.tap !== 'string') {
    throw new Error(`Project file tape file ${index} is missing "tap".`);
  }
  let tap: Uint8Array;
  try {
    tap = base64ToBytes(t.tap);
  } catch {
    throw new Error(`Project file tape file ${index} has malformed "tap".`);
  }
  return { name: t.name, kind: t.kind, tap };
}

/**
 * Decode wire-shape tape files (a parsed {@link ProjectMetaV2}'s `tapeFiles`,
 * or autosave's stored array) back into {@link TapeFile}s. Throws on the first
 * structurally invalid entry - callers that want a defensive, never-throws
 * load (autosave) catch around this themselves.
 */
export function parseTapeFiles(raw: unknown[]): TapeFile[] {
  return raw.map((t, i) => parseTapeFile(t, i));
}

/**
 * Build the project zip bundle for a document (see this module's header for
 * the layout). The BASIC source and each block's bytes/asm become their own
 * entries; everything else rides in the `project.json` metadata.
 */
export function serializeProjectZip(
  dialectId: string,
  source: string,
  blocks: readonly MemoryBlock[],
  autoStart: number | null = null,
  tapeFiles: readonly TapeFile[] = [],
  listingBlockMeta: SerializedListingBlockMeta = {},
  bootDisc: Uint8Array | null = null,
): Uint8Array {
  const files: Record<string, Uint8Array> = {
    [SOURCE_PATH]: textEncoder.encode(source),
  };
  const blockMeta: SerializedBlockMeta[] = blocks.map((b) => {
    files[blockBinPath(b.name)] = b.bytes;
    const meta: SerializedBlockMeta = {
      name: b.name,
      address: b.address,
      kind: b.kind,
      bin: blockBinPath(b.name),
      ...(b.comment !== undefined ? { comment: b.comment } : {}),
      ...(b.entry !== undefined ? { entry: b.entry } : {}),
    };
    if (b.asmSource !== undefined) {
      files[blockAsmPath(b.name)] = textEncoder.encode(b.asmSource);
      meta.asm = blockAsmPath(b.name);
    }
    return meta;
  });
  const meta: ProjectMetaV2 = {
    format: 'basically-project',
    version: 2,
    dialect: dialectId,
    source: SOURCE_PATH,
    blocks: blockMeta,
    ...(autoStart !== null ? { autoStart } : {}),
    ...(tapeFiles.length > 0
      ? { tapeFiles: serializeTapeFiles(tapeFiles) }
      : {}),
    ...(Object.keys(listingBlockMeta).length > 0 ? { listingBlockMeta } : {}),
    ...(bootDisc && bootDisc.length > 0
      ? { bootDisc: bytesToBase64(bootDisc) }
      : {}),
  };
  files[META_PATH] = textEncoder.encode(JSON.stringify(meta, null, 2));
  return zipSync(files);
}

/**
 * Decode one block's {@link SerializedBlockMeta} plus its `.bin`/`.asm` zip
 * entries back into a {@link MemoryBlock}. Throws `Error` on any structural
 * problem or a missing referenced entry, naming the offending block by index.
 * The `id` is synthesised to match the store's own scheme (`block-<name>`);
 * names are unique per document, so ids are too.
 */
function parseBlockMeta(
  raw: unknown,
  index: number,
  files: Record<string, Uint8Array>,
): MemoryBlock {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`Project file block ${index} is not an object.`);
  }
  const b = raw as Record<string, unknown>;
  if (typeof b.name !== 'string') {
    throw new Error(`Project file block ${index} is missing a "name".`);
  }
  if (!isValidBlockName(b.name)) {
    throw new Error(
      `Project file block ${index} has an invalid "name" ("${b.name}"): ` +
        'names must start with a letter and contain only letters, digits, or underscores.',
    );
  }
  if (typeof b.address !== 'number' || !Number.isFinite(b.address)) {
    throw new Error(`Project file block ${index} has an invalid "address".`);
  }
  if (b.kind !== 'code' && b.kind !== 'data') {
    throw new Error(`Project file block ${index} has an invalid "kind".`);
  }
  if (typeof b.bin !== 'string') {
    throw new Error(`Project file block ${index} is missing "bin".`);
  }
  const bytes = files[b.bin];
  if (!bytes) {
    throw new Error(
      `Project file block ${index} references a missing entry "${b.bin}".`,
    );
  }
  let asmSource: string | undefined;
  if (typeof b.asm === 'string') {
    const asmBytes = files[b.asm];
    if (!asmBytes) {
      throw new Error(
        `Project file block ${index} references a missing entry "${b.asm}".`,
      );
    }
    asmSource = textDecoder.decode(asmBytes);
  }
  return {
    id: `block-${b.name}`,
    name: b.name,
    address: b.address,
    bytes,
    kind: b.kind,
    ...(typeof b.comment === 'string' ? { comment: b.comment } : {}),
    ...(typeof b.entry === 'number' && Number.isInteger(b.entry)
      ? { entry: b.entry }
      : {}),
    ...(asmSource !== undefined ? { asmSource } : {}),
  };
}

/**
 * Decode a metadata `blocks` array plus the zip's entries back into
 * {@link MemoryBlock}s. Throws on the first invalid entry or a name shared by
 * more than one block (names must be unique per document).
 */
function parseBlockMetas(
  raw: unknown[],
  files: Record<string, Uint8Array>,
): MemoryBlock[] {
  const blocks = raw.map((b, i) => parseBlockMeta(b, i, files));
  const dup = findDuplicateBlockName(blocks);
  if (dup !== null) {
    throw new Error(
      `Project file has more than one memory block named "${dup}".`,
    );
  }
  return blocks;
}

export interface ParsedProject {
  dialect: string;
  source: string;
  blocks: MemoryBlock[];
  /** The saved auto-start line, or `null` when the file carried none. */
  autoStart: number | null;
  /** Preserved tape files (see {@link TapeFile}), or `[]` when the file had none. */
  tapeFiles: TapeFile[];
  /** Listing-block overrides, or `{}` when the file carried none. */
  listingBlockMeta: Record<
    number,
    {
      name?: string;
      kind?: 'code' | 'data';
      comment?: string;
      asmSource?: string;
    }
  >;
  /** A verbatim disc image to boot, or `null` when the file carried none. */
  bootDisc: Uint8Array | null;
}

/**
 * Parse a project zip bundle (see {@link serializeProjectZip}). Throws `Error`
 * with a human-readable message on an unreadable archive, a missing/malformed
 * `project.json`, a wrong `format`, an unsupported `version`, a missing
 * referenced entry, or any structurally invalid field - matching this
 * codebase's other import-style parsers (e.g. the `.tap`/`.p` readers), which
 * throw rather than collecting errors, since a corrupt project file can't be
 * partially loaded.
 */
export function parseProjectZip(bytes: Uint8Array): ParsedProject {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error('Not a valid project file: could not read the archive.');
  }
  const metaBytes = files[META_PATH];
  if (!metaBytes) {
    throw new Error(`Not a Basically project file: missing ${META_PATH}.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(textDecoder.decode(metaBytes));
  } catch {
    throw new Error(`Not a valid project file: malformed ${META_PATH}.`);
  }
  if (parsed === null || typeof parsed !== 'object') {
    throw new Error('Not a valid project file.');
  }
  const obj = parsed as Record<string, unknown>;
  if (obj.format !== 'basically-project') {
    throw new Error('Not a Basically project file.');
  }
  if (obj.version !== 2) {
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
  const sourceBytes = files[obj.source];
  if (!sourceBytes) {
    throw new Error(
      `Project file is missing its source entry "${obj.source}".`,
    );
  }
  const source = textDecoder.decode(sourceBytes);
  if (!Array.isArray(obj.blocks)) {
    throw new Error('Project file has malformed "blocks".');
  }
  const autoStart =
    typeof obj.autoStart === 'number' && Number.isInteger(obj.autoStart)
      ? obj.autoStart
      : null;
  let tapeFiles: TapeFile[] = [];
  if (obj.tapeFiles !== undefined) {
    if (!Array.isArray(obj.tapeFiles)) {
      throw new Error('Project file has malformed "tapeFiles".');
    }
    tapeFiles = parseTapeFiles(obj.tapeFiles);
  }
  let bootDisc: Uint8Array | null = null;
  if (obj.bootDisc !== undefined) {
    if (typeof obj.bootDisc !== 'string') {
      throw new Error('Project file has malformed "bootDisc".');
    }
    try {
      bootDisc = base64ToBytes(obj.bootDisc);
    } catch {
      throw new Error('Project file has malformed "bootDisc".');
    }
  }
  return {
    dialect: obj.dialect,
    source,
    blocks: parseBlockMetas(obj.blocks, files),
    autoStart,
    tapeFiles,
    listingBlockMeta: parseListingBlockMeta(obj.listingBlockMeta),
    bootDisc,
  };
}
