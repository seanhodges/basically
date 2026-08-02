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
// 3. **A multi-word variant follows its head keyword only where it refines what
//    the head does.** `ON BREAK CONT`, `ON BREAK GOSUB` and `ON BREAK STOP` are
//    all `error-handling` like `ON BREAK`, each being a way of trapping the
//    break key. Where the compound is a command in its own right with an effect
//    of its own, rule 1 wins over the head: `SPEED INK` sets the flash rate of
//    flashing colours, so it is `colour` rather than `SPEED`'s domain, and
//    `CLEAR INPUT` discards pending keypresses, so it is `input` rather than
//    `CLEAR`'s.

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
