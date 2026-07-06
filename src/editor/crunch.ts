/**
 * Greedy, position-independent keyword matching - "code crunching" - for the
 * Microsoft-BASIC dialects (C64, TRS-80). Their ROM tokenizers ignore spaces
 * outside strings/REM and match the longest keyword at every character
 * position, so `POKEA,10` is `POKE A,10` and `FORI=1TO10` is `FOR I=1 TO 10`.
 * The editor layer (highlighter, variable scanner, completion sources) uses a
 * {@link CrunchMatcher} to split identifier runs exactly the way the ROM will,
 * instead of the default whole-run keyword rule.
 */
import { Facet } from '@codemirror/state';

export interface CrunchMatcher {
  /** Longest keyword spelling matching at `pos` in `text` (case-folded), or null. */
  keywordAt(text: string, pos: number): string | null;
  /** First offset j in [1, limit) of `text` where a keyword matches, or -1. */
  firstInteriorKeyword(text: string, limit: number): number;
  /**
   * Start offset of the last ROM segment of an identifier run - the part a
   * completion should replace. 0 when the run doesn't split (`SCOR`), the
   * offset past the glued keyword(s) otherwise (`POKEA` → 4). A run ending
   * exactly on a keyword returns that keyword's start (`IFATHEN` → 3), so the
   * keyword itself is the completable tail.
   */
  tailStart(word: string): number;
}

/**
 * Build a matcher over a dialect's alphabetic keyword spellings (uppercase,
 * `$`-suffixed forms like `LEFT$` included). Indexed by first letter with the
 * spellings longest-first, mirroring the tokenizers' `*KeywordsByLength`
 * tables, so the longest keyword always wins (`GOTO` beats `GO`).
 */
export function makeCrunchMatcher(words: Iterable<string>): CrunchMatcher {
  const byFirst = new Map<string, string[]>();
  for (const w of words) {
    const upper = w.toUpperCase();
    const first = upper[0]!;
    const list = byFirst.get(first) ?? byFirst.set(first, []).get(first)!;
    list.push(upper);
  }
  for (const list of byFirst.values()) list.sort((a, b) => b.length - a.length);

  const keywordAt = (text: string, pos: number): string | null => {
    const list = byFirst.get(text[pos]?.toUpperCase() ?? '');
    if (!list) return null;
    for (const w of list) {
      if (
        pos + w.length <= text.length &&
        text.slice(pos, pos + w.length).toUpperCase() === w
      ) {
        return w;
      }
    }
    return null;
  };

  const firstInteriorKeyword = (text: string, limit: number): number => {
    for (let j = 1; j < limit; j++) {
      if (keywordAt(text, j) !== null) return j;
    }
    return -1;
  };

  const tailStart = (word: string): number => {
    let i = 0;
    let start = 0;
    while (i < word.length) {
      start = i;
      const kw = keywordAt(word, i);
      if (kw) {
        i += kw.length;
        continue;
      }
      const j = firstInteriorKeyword(word.slice(i), word.length - i);
      i = j === -1 ? word.length : i + j;
    }
    return start;
  };

  return { keywordAt, firstInteriorKeyword, tailStart };
}

/**
 * The active dialect's crunch matcher, for generic editor code outside the
 * language extension (the `.`-abbreviation path in CodeMirrorHost). Provided
 * by `buildBasicLanguage` for crunched dialects; null everywhere else.
 */
export const crunchMatcher = Facet.define<CrunchMatcher, CrunchMatcher | null>({
  combine: (values) => (values.length ? values[values.length - 1]! : null),
});
