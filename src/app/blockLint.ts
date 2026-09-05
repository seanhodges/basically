/**
 * The Run-path collision/validation linter for {@link Block}s: given a
 * document's blocks, a dialect's {@link MemoryBlocksSupport}, and the tokenized
 * program's byte size, reports every problem found rather than throwing -
 * matching the tokenizer's `TokenizeError[]` house style. The Run path gates on
 * any `'error'`-severity issue.
 */

import type {
  ConditionalFreeRange,
  Block,
  MemoryBlocksSupport,
  MemoryRange,
} from '../dialects/types';
import type { ProgramVocabulary } from './programVocabulary';
import { isValidBlockName } from '../storage/projectFile';

/** Category of problem a {@link BlockIssue} reports, for UI icon/copy choice. */
export type BlockIssueKind =
  | 'outside-valid-range'
  | 'block-overlap'
  | 'program-overlap'
  | 'reserved-overlap'
  | 'conditionally-free'
  | 'duplicate-name'
  | 'invalid-name';

/**
 * One problem found with a block. Blocks can produce several - e.g. a block
 * with a bad name that also sits outside every valid range gets one issue for
 * each - so the caller decides how to summarise them (the Run-path gate cares
 * only whether any `'error'` exists).
 */
export interface BlockIssue {
  /** {@link Block.id} of the offending block. */
  blockId: string;
  /** {@link Block.name} at lint time, for messages that don't re-look it up. */
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
function blockRange(block: Block): MemoryRange | null {
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
 * Whether the open program's own text proves `region` untouched.
 *
 * Strict on purpose, in one direction only: everything this cannot decide reads
 * as "not free". A mode selected with a value the text does not fix, a
 * vocabulary read as a machine whose mode command is not this one, a condition
 * phrased in modes on a machine that declares no mode command - each of them is
 * a question this cannot answer, and memory that cannot be proven free is not
 * free.
 *
 * The write check comes first and applies to every form of condition: a program
 * that names no graphics mode at all but pokes the region directly is using the
 * memory, whatever its mode statements say.
 */
function conditionMet(
  region: ConditionalFreeRange,
  support: MemoryBlocksSupport,
  vocabulary: ProgramVocabulary,
): boolean {
  const written = vocabulary.writeSites.some((site) =>
    overlaps(
      { start: site.address, end: site.endAddress ?? site.address },
      region.range,
    ),
  );
  if (written) return false;

  const condition = region.condition;
  if (condition.kind === 'without-keywords') {
    return !condition.keywords.some((keyword) =>
      vocabulary.keywords.includes(keyword.toUpperCase()),
    );
  }

  const command = support.screenModeCommand;
  if (command === undefined) return false;
  const use = vocabulary.screenModes;
  // Read as a machine with no mode command of its own: nothing in the program
  // selects a mode here, so the machine stays in the one it powers on in.
  if (use === null) return condition.modes.includes(command.bootMode);
  if (use.command !== command.keyword.toUpperCase()) return false;
  if (use.computed) return false;
  if (use.modes.length === 0) return condition.modes.includes(command.bootMode);
  return use.modes.every((mode) => condition.modes.includes(mode));
}

/**
 * Names that occur more than once in `blocks`, so every offending block can
 * be flagged - unlike {@link findDuplicateBlockName} (`src/storage/projectFile.ts`),
 * which is a fail-fast helper built for the project parser's "throw on the
 * first duplicate" path and only ever reports one name. A document with
 * `A, A, B, B`
 * has two duplicate groups; this finds both.
 */
function duplicatedNames(blocks: readonly Block[]): Set<string> {
  const counts = new Map<string, number>();
  for (const block of blocks) {
    counts.set(block.name, (counts.get(block.name) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [name, count] of counts) {
    if (count > 1) duplicates.add(name);
  }
  return duplicates;
}

/**
 * Lint `blocks` against a dialect's {@link MemoryBlocksSupport}. Returns every
 * issue found (never throws) - errors block the Run path; warnings don't.
 *
 * Errors: a block whose bytes lie outside every {@link MemoryBlocksSupport.validRanges}
 * entry, block-block overlap, program-area overlap, a duplicate name, or an
 * invalid name. Warnings: overlap with a {@link MemoryBlocksSupport.reservedRanges}
 * entry, and a block resting on a met {@link MemoryBlocksSupport.conditionallyFree}
 * condition.
 *
 * `vocabulary` is the open program's, and only a machine declaring conditionally
 * free memory reads it: a block in such a region is accepted where the program's
 * own text proves the region untouched. Omitting it is not neutral, it is the
 * strict answer - without a program to read there is nothing to prove the region
 * free with, so every such placement is refused exactly as it was before.
 */
export function lintBlocks(
  blocks: readonly Block[],
  support: MemoryBlocksSupport,
  programByteSize: number,
  vocabulary?: ProgramVocabulary,
  source?: string,
): BlockIssue[] {
  const issues: BlockIssue[] = [];
  const duplicates = duplicatedNames(blocks);
  const program = support.programArea(programByteSize, source);

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

    if (duplicates.has(block.name)) {
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

    const conditional = (support.conditionallyFree ?? []).find((region) =>
      isContainedBy(range, region.range),
    );
    const freed =
      conditional !== undefined &&
      vocabulary !== undefined &&
      conditionMet(conditional, support, vocabulary);

    if (freed && conditional !== undefined) {
      issues.push({
        blockId: block.id,
        blockName: block.name,
        kind: 'conditionally-free',
        severity: 'warning',
        message: `Block "${block.name}" (${rangeLabel(range)}) sits in ${conditional.note}, which is free only while ${conditional.conditionText} - the placement depends on that staying true.`,
      });
    }

    if (!freed && !isWithinAnyRange(range, support.validRanges)) {
      issues.push({
        blockId: block.id,
        blockName: block.name,
        kind: 'outside-valid-range',
        severity: 'error',
        // Naming the condition is what makes the refusal answerable: the reader
        // learns what would have to be true of the program for the placement to
        // be legal, rather than only that it is not.
        message:
          `Block "${block.name}" (${rangeLabel(range)}) lies outside the valid memory range for this machine.` +
          (conditional !== undefined
            ? ` It sits in ${conditional.note}, which would be free only while ${conditional.conditionText}.`
            : ''),
      });
    }

    for (const reserved of support.reservedRanges) {
      if (!overlaps(range, reserved)) continue;
      // The met condition already covers this band, and says more about it than
      // the blanket warning does. Emitting both would stack the specific finding
      // on the conservative one it replaces.
      if (
        freed &&
        conditional !== undefined &&
        overlaps(conditional.range, reserved)
      ) {
        continue;
      }
      issues.push({
        blockId: block.id,
        blockName: block.name,
        kind: 'reserved-overlap',
        severity: 'warning',
        message: `Block "${block.name}" overlaps reserved memory (${rangeLabel(reserved)}).`,
      });
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
