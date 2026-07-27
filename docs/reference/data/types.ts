/** One row of a dialect reference table. */
export interface ReferenceEntry {
  /**
   * Spelling as written, e.g. "INPUT", "MID$", "<>" for BASIC or "LD", "LDA",
   * "ORG" for assembly.
   */
  name: string;
  /**
   * `command`/`function`/`operator` for BASIC dialects; `instruction`
   * (mnemonic) and `directive` (assembler pseudo-op like ORG/DB) for the
   * per-CPU assembly references.
   */
  kind: 'command' | 'function' | 'operator' | 'instruction' | 'directive';
  /** Usage example with typed arguments, e.g. "INPUT [<string>;] <var>". */
  syntax: string;
  /** Brief description, including notable behaviours where relevant. */
  description: string;
  /** Optional badge, e.g. "128K only" or "Master only". */
  tag?: string;
}

/** Everything one reference page renders. */
export interface ReferenceTableData {
  /** Page/table title, e.g. "ZX Spectrum BASIC (48K & 128K)". */
  title: string;
  /** Machines this language set covers, for the page intro. */
  machines: string[];
  entries: ReferenceEntry[];
}

/** One row of a dialect escape-code table. */
export interface EscapeEntry {
  /** Canonical source spelling, possibly with placeholders: "{INK n}", "\\a", "{RED}", "%c", "{$xx}". */
  escape: string;
  /** Human-readable stored form, e.g. "0x10 n", "0x93", "0xC0–0xFF". */
  bytes: string;
  /** Category id; must be one of the table's `categories`. */
  category: string;
  /** Brief description of the effect / meaning of the stored byte(s). */
  description: string;
  /** Parse-only alternative spellings for the same byte(s), e.g. ["{wht}"], ["▘"]. */
  aliases?: string[];
  /** Optional badge, e.g. "48K only" or "parse-only". */
  tag?: string;
  /**
   * Concrete probe pinning the row to the implementation: `source` must
   * tokenize to exactly `bytes` via the dialect charset (checked by
   * escapes/escape-crosscheck.test.ts).
   */
  example: { source: string; bytes: number[] };
  /**
   * Byte values whose canonical decode this row claims (the first byte for
   * operand-carrying escapes). 'rest' = every escape-needing byte not claimed
   * by another row - at most one 'rest' row per table (the raw-byte escape).
   * Omit for parse-only rows (their bytes decode to another row's form).
   */
  codes?: number[] | 'rest';
  /** How the cross-check verifies this row. Default 'charset'. */
  probe?: 'charset' | 'float';
  /** True for spellings accepted on parse but never emitted on decode. */
  parseOnly?: boolean;
}

/** Everything one escape-codes sub-page renders. */
export interface EscapeTableData {
  /** Page/table title, e.g. "ZX81 escape codes". */
  title: string;
  /** Machines the escape set covers, for the page intro. */
  machines: string[];
  /** Ordered filter chips; ids referenced by `EscapeEntry.category` and `?cat=`. */
  categories: { id: string; label: string }[];
  entries: EscapeEntry[];
}

/**
 * One command that several dialects provide under different spellings, keyed by
 * page slug: `{ commodore: 'CLR', bbc: 'CLEAR' }`. The comparison reports these
 * as a rename to carry out rather than as a command lost plus an unrelated
 * command gained.
 *
 * Page-scoped on purpose. A spelling can mean something else entirely on a page
 * that is simply left out of the map: the Atom's `CLEAR` selects a screen mode,
 * so `atom` is absent from the clear-variables group and its `CLEAR` is left to
 * be reported as the {@link FalseFriend} it is.
 */
export interface KeywordEquivalence {
  /** Stable id for the shared command, e.g. "clear-variables". Not shown. */
  concept: string;
  /** Page slug → the spelling that page uses. Two or more entries. */
  spellings: Record<string, string>;
}

/**
 * One spelling that several dialects provide with materially different
 * meanings, keyed by page slug. The exact dual of {@link KeywordEquivalence}:
 * that one is a concept with many spellings, this is a spelling with many
 * concepts.
 *
 * These are the differences nothing else on the page can surface. A false
 * friend has the same name, the same `kind` and often the same syntax on both
 * sides, so it lands in none of the difference buckets while quietly changing
 * what a program computes - `LOG` is a base-10 logarithm on the Acorn machines
 * and a natural logarithm on the Commodore, Amstrad and Tandy ones.
 */
export interface FalseFriend {
  /** The shared spelling, exactly as the reference tables write it. */
  keyword: string;
  /** Page slug → what it means there. Two or more entries, not all equal. */
  meanings: Record<string, string>;
}

/**
 * Advice anchored to one *ordered* pair of pages (from → to): the few pairs
 * whose relationship is close enough, or trap-laden enough, to warrant notes
 * that the target-only {@link PortingFacts.portingNotes} and the
 * {@link FalseFriend} warnings cannot carry - e.g. that ZX80 and ZX81 spell
 * their block graphics with the same escapes but different byte values, so
 * graphics port silently wrong between the two closest machines.
 *
 * Directional on purpose: what one direction gains the other loses, so a pair
 * and its reverse are two distinct entries. Sparse: most pairs have none.
 * Pinned by porting-crosscheck.test.ts (real slugs, `from` ≠ `to`, no duplicate
 * ordered pair, notes within the same reading budget as the other prose).
 */
export interface PairPortingNotes {
  /** Source page slug being ported *from*. */
  from: string;
  /** Target page slug being ported *to*. */
  to: string;
  /** A few short notes specific to this ordered pair. */
  notes: string[];
}

/**
 * The language-rule and hardware facts a porter needs to compare, one entry per
 * dialect reference page. Split into two classes for the crosscheck test
 * (facts-crosscheck.test.ts):
 *
 *  - CROSSCHECKED against `src/dialects/<id>/`: `freeRamBytes` (← programRamBytes),
 *    `addressNotation`, `hexPrefix`, `statementSepChar` (← memoryWrites), the
 *    shape of `memoryWriteSyntax` (← memoryWrites.forms), and `screenBase` /
 *    `programStart` (← memoryMap `screen` / `program` region starts).
 *  - HAND-AUTHORED from the hardware page + tokenizer/aiProfile, with no
 *    structured source in `src/`: `lineNumberRange`, `statementSeparator`,
 *    `elseSupported`, `letRequired`, `variableNaming`, `exponentOperator`,
 *    `screen`, `colour`, `sound`. (`screen` is prose, not `displaySize` — the
 *    latter is the emulator canvas size in pixels, not the logical text/graphics
 *    screen a porter cares about; `exponentOperator` is prose because several
 *    dialects spell it with a symbol key — `↑`/`^` — that has no reference row.)
 */
export interface PortingFacts {
  /** Page slug, matching the dialect's `ReferenceTableData` (e.g. "zx81"). */
  id: string;
  // --- Language rules (hand-authored) ---
  /** Valid line-number range as written, e.g. "1–9999". */
  lineNumberRange: string;
  /** Multi-statement separator (usually ":"), or null when one statement per line. */
  statementSeparator: string | null;
  /** Whether IF…THEN…ELSE is available. */
  elseSupported: boolean;
  /** Whether LET is required, optional, or unsupported on assignment. */
  letRequired: 'required' | 'optional' | 'none';
  /** Variable-naming rule, e.g. "single letter A–Z" or "long names, A–Z0–9". */
  variableNaming: string;
  /** Exponent operator spelling ("**", "^", "↑"), or undefined if the dialect has none. */
  exponentOperator?: string;
  // --- Hardware ---
  /** Text/graphics screen summary, e.g. "32×24 text; 256×192 bitmap". */
  screen: string;
  /**
   * Screen-memory base address, in this machine's own hex convention
   * ("$4000", "&C000"). Optional: omitted for the ZX80/ZX81, whose display file
   * has no dedicated region, and the TRS-80, which has no structured memory map.
   * Pinned to the dialect's first `screen` memoryMap region by
   * facts-crosscheck.test.ts.
   */
  screenBase?: string;
  /**
   * BASIC program-text start address, same convention ("$0801", "&0170").
   * Optional: omitted only for the TRS-80 (no memory map). Pinned to the
   * dialect's `program` memoryMap region start - the C64 value is the true text
   * start ($0801), one byte past the region start, which the crosscheck allows.
   */
  programStart?: string;
  /** Free RAM for a BASIC program, in bytes (← Dialect.programRamBytes). */
  freeRamBytes: number;
  /** Colour capability summary. */
  colour: string;
  /** Sound capability summary. */
  sound: string;
  /** How the dialect writes memory, e.g. "POKE addr,val" or "?addr=val". */
  memoryWriteSyntax: string;
  /** Address notation (← Dialect.addressNotation, defaults to 'hex'). */
  addressNotation: 'hex' | 'dec';
  /** Hex literal prefix where the dialect has one, e.g. "&" (← memoryWrites.hexPrefix). */
  hexPrefix?: string;
  /** Statement separator inside a memory-write form, if any (← memoryWrites.statementSep). */
  statementSepChar?: string;
  // --- Porting guidance (hand-authored) ---
  /**
   * What to watch for when writing *for* this machine, whatever you are coming
   * from. Kept to a few short bullets: the comparison already shows the fact
   * rows and the keyword lists, so these earn their place only by saying what
   * those cannot. Capped by porting-crosscheck.test.ts.
   */
  portingNotes: string[];
  /**
   * "If you need X here, do this instead", for commands this dialect does not
   * have. Shown against the command in the difference lists rather than in a
   * section of its own.
   *
   * Deliberately partial: written where it helps, and a command without one
   * still appears in the comparison exactly as it does now. Each `keyword` must
   * be absent from this dialect (otherwise the advice is redundant) - checked
   * by porting-crosscheck.test.ts.
   */
  substitutions: { keyword: string; note: string }[];
}
