/**
 * Whether the comparison renders one of its sections at all.
 *
 * Narrowing to the reader's own program promises that what is left on the page
 * is the work that program needs. A section that has narrowed down to nothing
 * breaks the promise while appearing to keep it: the heading costs a stop to
 * read and the count a moment to interpret, both to arrive at "nothing is being
 * asked of you". Enough of them and a narrowed page reads like an unnarrowed
 * one.
 *
 * Not narrowed, the page is the whole comparison of two machines and the reader
 * has asked about the machines rather than about a program, so a section
 * reporting no difference is itself the answer and everything with content
 * stays.
 */
export interface SectionContent {
  /** True once the comparison is filtered to a program it could read. */
  narrowed: boolean;
  /**
   * Findings the reader must act on or be told about. "Told about" carries its
   * weight: a code that keeps its spelling and changes meaning edits nothing in
   * the program's text, which is precisely why it cannot be found by looking.
   */
  work: number;
  /**
   * Content that is not work — what the target adds where the port loses
   * nothing, or rows the two machines agree on. News rather than work, and
   * filtered out by default.
   */
  reference?: number;
  /** Whether a filter is currently revealing that reference content. */
  referenceShown?: boolean;
}

/**
 * Reference content held back by a filter must still hold its section open once
 * the reader turns the filter on, or the filter would reveal nothing.
 */
export function showsSection(content: SectionContent): boolean {
  const reference = content.reference ?? 0;
  if (!content.narrowed) return content.work > 0 || reference > 0;
  return (
    content.work > 0 || ((content.referenceShown ?? false) && reference > 0)
  );
}
