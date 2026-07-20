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
