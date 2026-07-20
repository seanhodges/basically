// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

/**
 * Shared contracts for the first-party assembler/disassembler engines that
 * back the block assembly editor. One table of instruction forms per CPU
 * drives both directions (see `table.ts`), so a block's bytes disassemble to
 * text the assembler turns back into the identical bytes.
 */

/** CPUs with an engine; matches `MemoryBlocksSupport.cpu`. */
export type Cpu = 'z80' | '6502';

/** One disassembled source line and the exact bytes it covers. */
export interface DisassembledLine {
  /** Address of the first byte, masked to the 16-bit bus. */
  address: number;
  /** The bytes this line decodes (1 byte for a `DB` fallback line). */
  bytes: Uint8Array;
  /** Pure source text, e.g. `LD A,$02` - no address or byte columns. */
  text: string;
}

/**
 * One assembly diagnostic. The same shape family as `TokenizeError`
 * (errors-not-throws): 1-based line, 0-based columns.
 */
export interface AsmError {
  line: number;
  column?: number;
  endColumn?: number;
  message: string;
}

export type AssembleResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; errors: AsmError[] };

/** A CPU's paired disassembler + assembler. */
export interface AsmEngine {
  cpu: Cpu;
  /** Decode `bytes` as if loaded at `origin`. Total: every byte lands on a line. */
  disassemble(bytes: Uint8Array, origin: number): DisassembledLine[];
  /**
   * Recursive-descent variant: follow control flow from `origin` (the block's
   * entry) and emit only the bytes execution can reach as instructions;
   * everything else - an appended data section, a table jumped over - comes
   * back as `DB` instead of being mis-decoded as code. Like {@link disassemble}
   * it tiles every byte, so re-assembly is byte-identical. Approximate:
   * indirect jumps and data that is jumped into can't be followed, so it
   * degrades to `DB` rather than guessing.
   */
  disassembleReachable(bytes: Uint8Array, origin: number): DisassembledLine[];
  /**
   * Assemble `source` at `origin` (the block's address; an explicit `ORG`
   * in the source must agree with it). Collects all errors, never throws.
   */
  assemble(source: string, origin: number): AssembleResult;
  /** Uppercase mnemonics + directives, for the syntax highlighter. */
  mnemonics: ReadonlySet<string>;
  /** Uppercase register/condition names, for the syntax highlighter. */
  registers: ReadonlySet<string>;
}
