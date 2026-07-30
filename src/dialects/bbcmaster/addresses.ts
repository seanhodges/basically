/**
 * The BBC Master's own addresses. The layout it shares with the Model B lives in
 * `src/emulator/bbc/addresses.ts`.
 *
 * The Master's filing systems keep their workspace in private RAM (ANDY/HAZEL)
 * rather than in main memory, so nothing displaces the start of BASIC and PAGE
 * stays where the MOS puts it. The Model B's cassette PAGE is the same number,
 * but for the unrelated reason that a tape-only machine has no filing-system
 * workspace to displace it - see `src/dialects/bbcmicro/addresses.ts`. They are
 * kept as separate constants so a change to either model moves only its own.
 */

/** BASIC program start on the Master, with no main-RAM filing workspace (`&0E00`). */
export const PAGE = 0x0e00;
