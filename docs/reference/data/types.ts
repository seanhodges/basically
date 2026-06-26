/** One row of a dialect reference table. */
export interface ReferenceEntry {
  /** Command/function/operator spelling as written, e.g. "INPUT", "MID$", "<>". */
  name: string;
  kind: 'command' | 'function' | 'operator';
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
