import type { LocoBasicVariant } from './keywords';

/**
 * Locomotive BASIC workspace pointers used by the variable watcher, the runtime
 * report and the memory-stats readout. Keyed by variant: the BASIC 1.0 (464)
 * and BASIC 1.1 (6128) workspaces sit at different addresses, so the cpc6128
 * dialect supplies its own table through the same readers rather than new code.
 *
 * The BASIC 1.0 addresses were pinned against the genuine 464 ROM in the
 * emulator (the Stage 2 approach): a program that assigns/errors is injected and
 * RUN, then the workspace words that move are read back. `varStart`/`arrStart`/
 * `arrEnd` are the same pointers Stage 2's `loadProgram` patches; `freeTop`,
 * `errCode` and `errLine` were located by diffing a clean run against errored
 * runs and correlating with `PRINT FRE(0)` / the printed error line.
 */
export interface LocoSysVars {
  /** First byte of the BASIC program area (tokenized lines from here up). */
  programStart: number;
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

/** BASIC 1.0 workspace (Amstrad CPC 464), verified against the real ROM. */
const BASIC_10: LocoSysVars = {
  programStart: 0x0170,
  varStart: 0xae85,
  arrStart: 0xae87,
  arrEnd: 0xae89,
  freeTop: 0xae7b,
  errCode: 0xadaa,
  errLine: 0xb0c2,
  curLinePtr: 0xae36,
};

export function locoSysVars(variant: LocoBasicVariant): LocoSysVars {
  switch (variant) {
    case 'basic10':
      return BASIC_10;
    case 'basic11':
      // The 6128's BASIC 1.1 workspace sits at different addresses; the cpc6128
      // stage (docs/contributing/dialect-plans/cpc6128.md) pins them against
      // that ROM and fills this branch in. Until then the 6128 machine isn't
      // wired to these readers, so this stays a throwing stub.
      throw new Error('cpc6128: BASIC 1.1 sysvars not implemented');
  }
}
