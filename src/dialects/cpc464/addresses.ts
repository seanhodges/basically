/**
 * The Amstrad CPC's fixed hardware addresses, declared once for the whole
 * dialect - as the Atom, Commodore and VIC-20 dialects declare theirs. The
 * memory maps for both CPC models and the emulator's memory bus import from
 * here rather than repeating a literal.
 *
 * The CPC addresses memory in hex with an `&` prefix, which is how these read
 * in the machine's own documentation: the screen at `&C000`.
 *
 * Shared by the 464 and the 6128: the two differ in where their BASIC
 * workspaces sit (see `./sysvars.ts`, which is keyed by variant for exactly
 * that reason), not in where the CRTC points at power-on.
 */

/**
 * Base of the screen RAM at power-on (`&C000`), as the CRTC's R12/R13 default
 * places it. The upper ROM overlays this address range for CPU reads, so a
 * write here lands in the RAM underneath - which is why the memory maps draw
 * the RAM view and note the ROM over it rather than drawing the ROM as a band
 * of its own.
 */
export const SCREEN_BASE = 0xc000;
