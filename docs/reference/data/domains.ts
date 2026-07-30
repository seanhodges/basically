// The capability vocabulary every BASIC reference row is classified by: what a
// keyword *does*, as opposed to `ReferenceEntry.kind`, which is only its
// syntactic class (command / function / operator).
//
// Closed and shared across all eight BASIC pages on purpose. The porting
// comparison sets one machine's domains against another's, so `graphics` has to
// denote the same capability everywhere; a per-page vocabulary (as the escape
// tables use for their `categories`) would make that comparison meaningless.
//
// ## Tie-break rules for classifying a keyword
//
// 1. **What the keyword does on *this* machine wins over what the word usually
//    means.** The Atom's `CLEAR` selects a screen mode (`graphics`), not the
//    variable-clearing `CLEAR` of other dialects (`data`).
// 2. **Reading a hardware value is `memory-hardware`; changing the screen is
//    `text-screen` / `graphics` / `colour`.** `PEEK`, `INP` and `ADVAL` read
//    hardware whatever they read it from; `PLOT`, `CLS` and `INK` are classified
//    by the part of the display they change.
// 3. **Multi-word variants take their head keyword's domain.** `ON BREAK`,
//    `ON BREAK CONT`, `ON BREAK GOSUB` and `ON BREAK STOP` are all
//    `error-handling`, following `ON BREAK`; `SPEED INK` follows `SPEED`.

/**
 * The 13 capability domains, in canonical render order: the order the porting
 * comparison groups by, and the order the reference pages' domain chips appear
 * in. Roughly program structure → values → output → input → the machine.
 */
export const KEYWORD_DOMAINS = [
  'control-flow',
  'data',
  'numeric',
  'strings',
  'text-screen',
  'graphics',
  'colour',
  'sound',
  'input',
  'storage',
  'memory-hardware',
  'program-editing',
  'error-handling',
] as const;

/** One capability domain id, derived from {@link KEYWORD_DOMAINS}. */
export type KeywordDomain = (typeof KEYWORD_DOMAINS)[number];
