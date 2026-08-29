import type { LocoBasicVariant } from './keywords';

/**
 * Locomotive BASIC workspace pointers used by the variable watcher, the runtime
 * report and the memory-stats readout. Keyed by variant: the BASIC 1.0 (464)
 * and BASIC 1.1 (664, 6128) workspaces sit at different addresses, so the two
 * 1.1 dialects select the other table through the same readers rather than new
 * code.
 *
 * Both tables were pinned against the genuine ROM in the emulator rather than
 * quoted: a program that assigns/errors is injected and RUN, then the workspace
 * words that move are read back. `progEnd`/`varStart`/`arrStart`/`arrEnd` are
 * the pointers `loadProgram` patches, and were confirmed by *typing* lines into
 * the booted firmware and watching which four words the ROM itself advanced;
 * `freeTop`, `errCode` and `errLine` were located by diffing a clean run against
 * errored runs and correlating with `PRINT FRE(0)` / the printed error line.
 *
 * BASIC 1.1's workspace sits lower than 1.0's, but by a different amount for
 * each pointer, so no address here is derived from another machine's.
 */
export interface LocoSysVars {
  /** First byte of the BASIC program area (tokenized lines from here up). */
  programStart: number;
  /**
   * LE word: first byte past the tokenized program (past its zero-length
   * terminator). Equal to {@link varStart} until variables are created.
   */
  progEnd: number;
  /** LE word: start of the simple (scalar) variables area. */
  varStart: number;
  /** LE word: start of the arrays area (== end of the simple variables). */
  arrStart: number;
  /** LE word: end of the arrays area == top of used BASIC data. */
  arrEnd: number;
  /**
   * LE word: top of the free area (HIMEM). `PRINT FRE(0)` on a clean boot
   * equals `freeTop - arrEnd`, so this bounds the free-RAM figure.
   */
  freeTop: number;
  /**
   * Byte: the last runtime error number (0 = no error). Codes follow the
   * Locomotive BASIC error list; see {@link ./reports}.
   */
  errCode: number;
  /** LE word: the BASIC line number the last error occurred on (ERL). */
  errLine: number;
  /**
   * LE word holding a POINTER to the currently-executing line's line-number
   * field: `word(word(curLinePtr))` is the BASIC line number being interpreted,
   * updated as execution moves from line to line. Zero (→ an invalid deref) in
   * direct mode / at the Ready prompt, which the debugger reads as "no line".
   * Used by {@link MachineEmulator.currentLine}.
   */
  curLinePtr: number;
}

/**
 * Where Locomotive BASIC stores the tokenized program (&0170), on every CPC
 * here: the rest of the workspace moved between BASIC 1.0 and 1.1, but the
 * program base did not.
 */
export const PROGRAM_BASE = 0x0170;

/** BASIC 1.0 workspace (Amstrad CPC 464), verified against the real ROM. */
const BASIC_10: LocoSysVars = {
  programStart: PROGRAM_BASE,
  progEnd: 0xae83,
  varStart: 0xae85,
  arrStart: 0xae87,
  arrEnd: 0xae89,
  freeTop: 0xae7b,
  errCode: 0xadaa,
  errLine: 0xb0c2,
  curLinePtr: 0xae36,
};

/**
 * BASIC 1.1 workspace (Amstrad CPC 6128), verified against the real ROM the
 * same way. The whole workspace sits lower than 1.0's but NOT by a single
 * offset - the pointer block moves by &1D, `errCode` by &1A, `errLine` by &22
 * and `curLinePtr` by &19 - so every address here was measured, none derived.
 */
const BASIC_11: LocoSysVars = {
  programStart: PROGRAM_BASE,
  progEnd: 0xae66,
  varStart: 0xae68,
  arrStart: 0xae6a,
  arrEnd: 0xae6c,
  freeTop: 0xae5e,
  errCode: 0xad90,
  errLine: 0xb0a0,
  curLinePtr: 0xae1d,
};

export function locoSysVars(variant: LocoBasicVariant): LocoSysVars {
  switch (variant) {
    case 'basic10':
      return BASIC_10;
    case 'basic11':
      return BASIC_11;
  }
}
