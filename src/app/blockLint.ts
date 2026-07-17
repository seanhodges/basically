/**
 * The Run-path collision/validation linter for {@link MemoryBlock}s: given a
 * document's blocks, a dialect's {@link MemoryBlocksSupport}, and the tokenized
 * program's byte size, reports every problem found rather than throwing -
 * matching the tokenizer's `TokenizeError[]` house style. Stage 3 wires this
 * into the Run path, gating on any `'error'`-severity issue; the edit-export
 * plan's Memory tab will also surface these as per-block badges.
 */

import type {
  MemoryBlock,
  MemoryBlocksSupport,
  MemoryRange,
} from '../dialects/types';
import {
  findDuplicateBlockName,
  isValidBlockName,
} from '../storage/projectFile';

/** Category of problem a {@link BlockIssue} reports, for UI icon/copy choice. */
export type BlockIssueKind =
  | 'outside-valid-range'
  | 'block-overlap'
  | 'program-overlap'
  | 'reserved-overlap'
  | 'duplicate-name'
  | 'invalid-name';

/**
 * One problem found with a block. Blocks can produce several - e.g. a block
 * with a bad name that also sits outside every valid range gets one issue for
 * each - so the caller decides how to summarise them (Stage 3's Run-path gate
 * cares only whether any `'error'` exists; the later Memory tab shows all of
 * them per block).
 */
export interface BlockIssue {
  /** {@link MemoryBlock.id} of the offending block. */
  blockId: string;
  /** {@link MemoryBlock.name} at lint time, for messages that don't re-look it up. */
  blockName: string;
  kind: BlockIssueKind;
  /** `'error'` blocks the Run path; `'warning'` is informational only. */
  severity: 'error' | 'warning';
  message: string;
}

function hex(n: number): string {
  return `0x${n.toString(16).toUpperCase()}`;
}

function rangeLabel(range: MemoryRange): string {
  return `${hex(range.start)}-${hex(range.end)}`;
}

/**
 * The inclusive byte range `block` occupies, or `null` for a zero-length
 * block (`bytes.length === 0`), which occupies no bytes and therefore can
 * neither lie outside a valid range nor overlap anything else - the linter
 * skips all range/overlap checks for it (name validation still applies).
 */
function blockRange(block: MemoryBlock): MemoryRange | null {
  if (block.bytes.length === 0) return null;
  return { start: block.address, end: block.address + block.bytes.length - 1 };
}

/** Whether two inclusive ranges share at least one byte. */
function overlaps(a: MemoryRange, b: MemoryRange): boolean {
  return a.start <= b.end && b.start <= a.end;
}

/** Whether `range` lies entirely within `container` (both inclusive). */
function isContainedBy(range: MemoryRange, container: MemoryRange): boolean {
  return range.start >= container.start && range.end <= container.end;
}

function isWithinAnyRange(
  range: MemoryRange,
  ranges: readonly MemoryRange[],
): boolean {
  return ranges.some((r) => isContainedBy(range, r));
}

/**
 * Lint `blocks` against a dialect's {@link MemoryBlocksSupport}. Returns every
 * issue found (never throws) - errors block the Run path; warnings don't.
 *
 * Errors: a block whose bytes lie outside every {@link MemoryBlocksSupport.validRanges}
 * entry, block-block overlap, program-area overlap, a duplicate name, or an
 * invalid name. Warnings: overlap with a {@link MemoryBlocksSupport.reservedRanges}
 * entry.
 */
export function lintBlocks(
  blocks: readonly MemoryBlock[],
  support: MemoryBlocksSupport,
  programByteSize: number,
): BlockIssue[] {
  const issues: BlockIssue[] = [];
  const duplicateName = findDuplicateBlockName(blocks);
  const program = support.programArea(programByteSize);

  for (const block of blocks) {
    if (!isValidBlockName(block.name)) {
      issues.push({
        blockId: block.id,
        blockName: block.name,
        kind: 'invalid-name',
        severity: 'error',
        message: `"${block.name}" is not a valid block name - names must start with a letter and contain only letters, digits, or underscores.`,
      });
    }

    if (duplicateName !== null && block.name === duplicateName) {
      issues.push({
        blockId: block.id,
        blockName: block.name,
        kind: 'duplicate-name',
        severity: 'error',
        message: `More than one block is named "${block.name}" - block names must be unique.`,
      });
    }

    const range = blockRange(block);
    if (range === null) continue; // empty block: no bytes, nothing to collide

    if (!isWithinAnyRange(range, support.validRanges)) {
      issues.push({
        blockId: block.id,
        blockName: block.name,
        kind: 'outside-valid-range',
        severity: 'error',
        message: `Block "${block.name}" (${rangeLabel(range)}) lies outside the valid memory range for this machine.`,
      });
    }

    for (const reserved of support.reservedRanges) {
      if (overlaps(range, reserved)) {
        issues.push({
          blockId: block.id,
          blockName: block.name,
          kind: 'reserved-overlap',
          severity: 'warning',
          message: `Block "${block.name}" overlaps reserved memory (${rangeLabel(reserved)}).`,
        });
      }
    }

    if (overlaps(range, program)) {
      issues.push({
        blockId: block.id,
        blockName: block.name,
        kind: 'program-overlap',
        severity: 'error',
        message: `Block "${block.name}" overlaps the program area (${rangeLabel(program)}).`,
      });
    }

    for (const other of blocks) {
      if (other === block) continue;
      const otherRange = blockRange(other);
      if (otherRange === null) continue;
      if (overlaps(range, otherRange)) {
        issues.push({
          blockId: block.id,
          blockName: block.name,
          kind: 'block-overlap',
          severity: 'error',
          message: `Block "${block.name}" overlaps block "${other.name}".`,
        });
      }
    }
  }

  return issues;
}
