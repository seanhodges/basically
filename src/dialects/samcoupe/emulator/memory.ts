/**
 * The SAM's paged bus: 256K of RAM in 16K pages behind four slots, and a 32K
 * ROM that pages out so BASIC can use the space beneath it.
 */

/** Size of the ROM image the machine runs. */
export const ROM_BYTES = 32768;

/** One RAM page as the ASIC's page registers address it. */
export const PAGE_BYTES = 16384;

/** RAM fitted to a standard machine. */
export const RAM_BYTES = 256 * 1024;
