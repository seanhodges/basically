/**
 * The zero-page pointer block every CBM BASIC keeps, in the two layouts this
 * project's machines need.
 *
 * The PET→VIC-20→C64 lineage stores the same pointers with the same meanings
 * behind them; what moved between BASIC 4.0 (PET) and BASIC V2 (VIC-20, C64) is
 * where in zero page they live. Keeping both layouts here means the C64 and the
 * VIC-20 share one definition instead of each writing out an identical set, and
 * the PET's different addresses sit beside them where the difference is visible.
 *
 * CURLIN is included for the same reason: the PET's is two bytes below the
 * V2 machines', which is exactly the kind of near-miss that invites a
 * copy-paste error.
 */

/** The zero-page cells a CBM BASIC uses to bound its program and variables. */
export interface CbmBasicPointers {
  /** TXTTAB: start of program text. */
  txttab: number;
  /** VARTAB: start of scalar variables (end of program). */
  vartab: number;
  /** ARYTAB: start of array variables (end of scalars). */
  arytab: number;
  /** STREND: end of arrays - the top of the upward-growing area. */
  strend: number;
  /** FRETOP: bottom of the downward-growing string heap. */
  fretop: number;
  /** MEMSIZ: top of the RAM available to BASIC. */
  memsiz: number;
  /**
   * CURLIN: the 16-bit LE line number being executed. In direct mode the high
   * byte is 0xFF, so any value above the highest legal line means no program
   * line is running.
   */
  curlin: number;
}

/** BASIC V2 zero page, shared by the Commodore 64 and the VIC-20. */
export const BASIC_V2_ZP: CbmBasicPointers = {
  txttab: 0x2b,
  vartab: 0x2d,
  arytab: 0x2f,
  strend: 0x31,
  fretop: 0x33,
  memsiz: 0x37,
  curlin: 0x39,
};

/**
 * BASIC 4.0 zero page (PET). Confirmed against the real ROMs - see the loop
 * test in `petMachine.test.ts`, which pins CURLIN empirically.
 */
export const BASIC_4_ZP: CbmBasicPointers = {
  txttab: 0x28,
  vartab: 0x2a,
  arytab: 0x2c,
  strend: 0x2e,
  fretop: 0x30,
  memsiz: 0x34,
  curlin: 0x36,
};

/** Highest line number a CBM BASIC accepts; above it means "not running". */
export const MAX_BASIC_LINE = 63999;

/** KERNAL keyboard buffer and its count (NDX), the same on every V2 machine. */
export const KEYBUF = 0x0277;
export const NDX = 0xc6;
