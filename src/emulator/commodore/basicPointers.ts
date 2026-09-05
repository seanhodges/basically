/**
 * The zero page every CBM BASIC and KERNAL keeps, in the two layouts this
 * project's machines need: BASIC's own pointers, and the KERNAL cells that
 * describe the channel a program is reading or writing.
 *
 * The PET→VIC-20→C64 lineage stores the same cells with the same meanings
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
  /**
   * BLNSW: the screen editor's cursor-blink enable. Zero while the editor is
   * blinking the cursor - i.e. BASIC is sitting at a prompt waiting for input -
   * and non-zero while a program has the machine.
   *
   * This, not CURLIN, is what answers "is a program running": every ROM in the
   * lineage leaves CURLIN holding the last line executed once a program stops,
   * so a finished program is indistinguishable from one paused on that line.
   * Confirmed against the real ROMs by the run-state tests in each machine's
   * own test file.
   */
  blnsw: number;
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
  blnsw: 0xcc,
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
  blnsw: 0xa7,
};

/**
 * The zero-page cells a CBM KERNAL keeps for the file a program has open: what
 * `OPEN` was asked for, and which channel `CHRIN`/`CHROUT` are pointed at.
 *
 * Read and written by {@link ./diskDrive.ts}'s virtual disk unit, which stands
 * in for the KERNAL routines that would otherwise own them. Split out from
 * {@link CbmBasicPointers} because the two sets answer to different owners and
 * moved independently: a machine sharing BASIC's layout need not share the
 * KERNAL's.
 */
export interface CbmKernalIo {
  /** ST: the status byte; bit 6 ({@link ST_EOF}) means end of file. */
  status: number;
  /** DFLTN: the device the next CHRIN reads from. */
  dfltn: number;
  /** DFLTO: the device the next CHROUT writes to. */
  dflto: number;
  /** FNLEN: length of the filename OPEN was given. */
  fnlen: number;
  /** LA: the logical file number. */
  la: number;
  /** SA: the secondary address. */
  sa: number;
  /** FA: the device number. */
  fa: number;
  /** FNADR: pointer to the filename, two bytes little-endian. */
  fnadr: number;
}

/** ST bit 6, end of file. The same bit in every ROM of the lineage. */
export const ST_EOF = 0x40;

/** BASIC V2 KERNAL I/O cells, shared by the Commodore 64 and the VIC-20. */
export const KERNAL_IO_V2: CbmKernalIo = {
  status: 0x90,
  dfltn: 0x99,
  dflto: 0x9a,
  fnlen: 0xb7,
  la: 0xb8,
  sa: 0xb9,
  fa: 0xba,
  fnadr: 0xbb,
};

/**
 * BASIC 4.0 KERNAL I/O cells (PET). Every one of the eight moved, so nothing
 * here can be inherited from {@link KERNAL_IO_V2} - read out of the routine
 * bodies in `kernal-4.901465-22.bin` and pinned against them by
 * `petMachine.test.ts`.
 */
export const KERNAL_IO_BASIC_4: CbmKernalIo = {
  status: 0x96,
  dfltn: 0xaf,
  dflto: 0xb0,
  fnlen: 0xd1,
  la: 0xd2,
  sa: 0xd3,
  fa: 0xd4,
  fnadr: 0xda,
};

/** Highest line number a CBM BASIC accepts; above it means "not running". */
export const MAX_BASIC_LINE = 63999;

/** KERNAL keyboard buffer and its count (NDX), the same on every V2 machine. */
export const KEYBUF = 0x0277;
export const NDX = 0xc6;
