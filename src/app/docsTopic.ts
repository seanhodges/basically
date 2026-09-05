import { referencePageOf } from '../dialects/referencePage';
import type { Cpu } from '../asm/types';
import type { Dialect } from '../dialects/types';
import type { ActiveTab } from './store';

/**
 * Docs sub-path for a dialect's reference page, seeding the reference table's
 * search box with `keyword`. Returns `null` when there is nothing to search, so
 * a caller with no keyword offers nothing rather than opening an empty table.
 *
 * The table search is a case-insensitive substring match on the keyword name,
 * and on the short spellings the machine accepts for it - so a keyword picked
 * out of a listing finds its row however it was spelled there.
 */
export function referenceTopic(
  dialect: Dialect,
  keyword: string,
): string | null {
  if (!keyword) return null;
  const page = referencePageOf(dialect);
  return `reference/${page}?q=${encodeURIComponent(keyword)}`;
}

/** The per-CPU assembly reference page slug. */
const ASM_REFERENCE_PAGE: Record<Cpu, string> = {
  z80: 'z80-assembly',
  '6502': '6502-assembly',
};

/**
 * Docs sub-path for a CPU's assembly reference, seeded with `keyword` when
 * there is one. Unlike {@link referenceTopic} it always returns a topic: with a
 * code block open the CPU page is the relevant context even with nothing
 * picked, so the bare form opens the page rather than the docs home.
 */
export function asmReferenceTopic(cpu: Cpu, keyword = ''): string {
  const page = ASM_REFERENCE_PAGE[cpu];
  return keyword
    ? `reference/${page}?q=${encodeURIComponent(keyword)}`
    : `reference/${page}`;
}

/** The store fields the context-help resolver reads. */
export interface ReferenceTopicState {
  dialect: Dialect;
  activeTab: ActiveTab;
}

/**
 * The reference topic the current context alone suggests, for an opener that
 * names none of its own - the toolbar button, the drawer handle, F1.
 *
 * Only the active tab speaks here. A machine-code block tab on a CPU-backed
 * dialect makes that CPU's page the relevant context whatever is in the buffer,
 * so it opens there. Anything else yields null and the documentation opens at
 * its home: picking out a particular keyword is the editor's own job, answered
 * where the keyword is written rather than by a button elsewhere on screen.
 */
export function referenceTopicFor(state: ReferenceTopicState): string | null {
  const cpu = state.dialect.memoryBlocks?.cpu;
  if (state.activeTab.kind === 'block' && cpu) return asmReferenceTopic(cpu);
  return null;
}

/**
 * The topic opening the documentation should land on: the porting comparison
 * offered for the open program where there is one, else the usual contextual
 * reference.
 *
 * Every opener goes through this, so however the user reaches the documentation
 * after keeping their program on a new machine - the drawer handle, the toolbar
 * button, F1 - they land on the comparison that was offered rather than on the
 * reference page for a machine they have just left behind.
 */
export function openingTopicFor(
  state: ReferenceTopicState & { docsProgramTopic: string | null },
): string | null {
  return state.docsProgramTopic ?? referenceTopicFor(state);
}
