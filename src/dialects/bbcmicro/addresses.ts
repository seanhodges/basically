/**
 * The BBC Model B's own addresses. The layout it shares with the Master lives in
 * `src/emulator/bbc/addresses.ts`; what differs between the two models is where
 * the BASIC program starts, and that is what this file is for.
 *
 * The Model B has two of those, and they are deliberately kept apart:
 *
 *  - {@link PAGE_DFS} is where BASIC starts once a disc filing system has
 *    claimed its main-RAM workspace at `&0E00-&18FF`. This is the boot PAGE the
 *    block linter and the memory map are drawn against, and the load address the
 *    DFS catalogue records for a BASIC file.
 *  - {@link PAGE_TAPE} is where BASIC starts with no filing-system workspace
 *    below it - a cassette-only machine. The Master happens to use the same
 *    number for an unrelated reason (its filing systems live in private RAM, so
 *    nothing displaces PAGE), which is why the two are not shared: a change to
 *    either model's filing systems must be able to move one without the other.
 *
 * The running machine reads PAGE live from `&18`; these are the static boot
 * values the linter and the file formats have to assume.
 */

/** BASIC program start on a fresh DFS-equipped Model B (`&1900`). */
export const PAGE_DFS = 0x1900;

/** BASIC program start with no filing-system workspace below it (`&0E00`). */
export const PAGE_TAPE = 0x0e00;

/**
 * The tape load/exec address as the cassette format writes it: Acorn's tape
 * headers carry 32-bit host addresses, and the MOS sign-extends a 16-bit
 * address into the top of that space, so `&0E00` is stored as `&FFFF0E00`.
 */
export const TAPE_HOST_ADDR = 0xffff0000 + PAGE_TAPE;
