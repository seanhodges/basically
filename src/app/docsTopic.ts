import type { Cpu } from '../asm/types';
import type { Dialect } from '../dialects/types';

/** First whitespace-delimited token of a selection (a stray trailing space or a
 * two-word drag still resolves to a single keyword). */
function firstKeyword(selection: string): string {
  return selection.trim().split(/\s+/)[0] ?? '';
}

/**
 * Docs sub-path for a dialect's reference page, optionally seeding the reference
 * table's search box with `selection`. Returns `null` when there's nothing to
 * search (the caller then falls back to the docs home).
 *
 * The table search is a case-insensitive substring match on the keyword name.
 */
export function referenceTopic(
  dialect: Dialect,
  selection: string,
): string | null {
  const keyword = firstKeyword(selection);
  if (!keyword) return null;
  const page = dialect.docsReference ?? dialect.id;
  return `reference/${page}?q=${encodeURIComponent(keyword)}`;
}

/** The per-CPU assembly reference page slug. */
const ASM_REFERENCE_PAGE: Record<Cpu, string> = {
  z80: 'z80-assembly',
  '6502': '6502-assembly',
};

/**
 * Docs sub-path for a CPU's assembly reference, seeded with the selected
 * mnemonic when there is one. Unlike {@link referenceTopic} it always returns a
 * topic: with a code block open the CPU page is the relevant context even
 * without a selection, so it opens the page rather than the docs home.
 */
export function asmReferenceTopic(cpu: Cpu, selection: string): string {
  const page = ASM_REFERENCE_PAGE[cpu];
  const keyword = firstKeyword(selection);
  return keyword
    ? `reference/${page}?q=${encodeURIComponent(keyword)}`
    : `reference/${page}`;
}

/** The store fields the context-help resolver reads. */
export interface ReferenceTopicState {
  dialect: Dialect;
  editorSelection: string;
  activeBlockId: string | null;
}

/**
 * Pick the right reference topic for the current context: with a machine-code
 * block tab active on a CPU-backed dialect, the assembly reference for that CPU
 * (seeded to the selected mnemonic); otherwise the dialect's BASIC reference.
 */
export function referenceTopicFor(state: ReferenceTopicState): string | null {
  const cpu = state.dialect.memoryBlocks?.cpu;
  if (state.activeBlockId !== null && cpu) {
    return asmReferenceTopic(cpu, state.editorSelection);
  }
  return referenceTopic(state.dialect, state.editorSelection);
}
