/**
 * Addresses the BBC machines share, regardless of model. Both the Model B and
 * the Master run the same MOS memory layout above the language workspace, so
 * the screen floor and the top of main RAM are facts about the machine family
 * rather than about either dialect.
 *
 * What each model puts at PAGE differs, and that lives in the dialect's own
 * `addresses.ts` - see `src/dialects/bbcmicro/addresses.ts`.
 *
 * The BBC addresses memory in hex with an `&` prefix, which is how these read in
 * the Advanced User Guide: the MODE 7 screen at `&7C00`, the graphics screen
 * floor at `&3000`.
 */

/**
 * Lowest address the screen reaches in any mode. MODE 0-2 use the full 20K
 * frame buffer starting here, so anything above it can be overwritten the
 * moment the program changes mode.
 */
export const SCREEN_FLOOR = 0x3000;

/** Base of the 1K MODE 7 (teletext) screen, the shallowest of the modes. */
export const SCREEN_MODE7_BASE = 0x7c00;

/** Last byte of main RAM, immediately below the paged ROM window at `&8000`. */
export const RAM_TOP = 0x7fff;
