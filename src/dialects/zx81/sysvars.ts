/**
 * ZX81 system variable addresses. The .P file (and tape SAVE) covers
 * 0x4009 (VERSN) up to but not including the address held in E_LINE.
 */
export const SYSVARS_BASE = 0x4009;
export const PROGRAM_BASE = 0x407d;
/** Bytes of system variables stored in a .P file before the program. */
export const SYSVARS_SAVED_LENGTH = PROGRAM_BASE - SYSVARS_BASE; // 0x74

/**
 * ERR_NR (0x4000) holds the last report code minus one (0xFF = "0 OK"); it sits
 * below SYSVARS_BASE so it is NOT part of the saved .P image, but it still lives
 * in RAM and is readable while a program runs. See reports.ts.
 */
export const ERR_NR = 0x4000;

/**
 * RAMTOP (0x4004) holds the address of the first byte above BASIC's RAM (the
 * ROM sets it to 0x8000 on a 16K machine). Like ERR_NR it sits below
 * SYSVARS_BASE, so it isn't saved in a .P image, but it is live in RAM.
 */
export const RAMTOP = 0x4004;

/**
 * PPC (0x4007) holds the line number of the BASIC statement currently being
 * executed. Like ERR_NR it sits below SYSVARS_BASE, so it isn't part of the
 * saved .P image, but it is live in RAM while a program runs - the debugger
 * reads it to know which line execution is on.
 */
export const PPC = 0x4007;

export const VERSN = 0x4009;
export const E_PPC = 0x400a;
export const D_FILE = 0x400c;
export const DF_CC = 0x400e;
export const VARS = 0x4010;
export const DEST = 0x4012;
export const E_LINE = 0x4014;
export const CH_ADD = 0x4016;
export const X_PTR = 0x4018;
export const STKBOT = 0x401a;
export const STKEND = 0x401c;
export const BERG = 0x401e;
export const MEM = 0x401f;
export const DF_SZ = 0x4022;
export const S_TOP = 0x4023;
export const LAST_K = 0x4025;
export const DEBOUNCE = 0x4027;
export const MARGIN = 0x4028;
export const NXTLIN = 0x4029;
export const OLDPPC = 0x402b;
export const FLAGX = 0x402d;
export const STRLEN = 0x402e;
export const T_ADDR = 0x4030;
export const SEED = 0x4032;
export const FRAMES = 0x4034;
export const COORDS = 0x4036;
export const PR_CC = 0x4038;
export const S_POSN = 0x4039;
export const CDFLAG = 0x403b;
export const PRBUFF = 0x403c;
export const MEMBOT = 0x405d;

/** ROM entry points used by the emulator's flash loader. */
export const ROM_LOAD_TRAP = 0x0347; // inside the LOAD routine
export const ROM_POST_LOAD = 0x0207; // continue here after injecting a .P

/**
 * The ROM's SAVE routine entry (leader-tone setup). The emulator has no
 * cassette output, so a program that runs SAVE is bounced from here to
 * {@link ROM_SAVE_RESUME} instead of spinning in the tape-output loop.
 */
export const ROM_SAVE_TRAP = 0x02f6;
/**
 * Where a completed SAVE resumes: the SLOW/FAST tail the ROM falls into once
 * every byte is written, which then RETs to the BASIC interpreter. It is the
 * same routine {@link ROM_POST_LOAD} names; the constant is separate so the
 * SAVE trap reads for what it does.
 */
export const ROM_SAVE_RESUME = 0x0207;
