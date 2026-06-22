/**
 * Stub — filled in by Stage 2 of docs/dialect-plans/zxspectrum128.md.
 *
 * ZX Spectrum 128K memory map: eight 16K RAM banks + two 16K ROM banks, paged
 * by port 0x7FFD:
 *   - bits 0-2  RAM bank paged at 0xC000 (banks 0-7)
 *   - bit 3     displayed screen: bank 5 (normal) or bank 7 (shadow)
 *   - bit 4     ROM select: 0 = 128 editor ROM, 1 = 48 BASIC ROM
 *   - bit 5     paging-disable lock (set until the next reset)
 * Bank 5 stays mapped at 0x4000, bank 2 at 0x8000. The read/write/readWord/
 * writeWord surface must stay compatible with ../zxspectrum/{vars,reports} and
 * emulator/display.ts so those reuse unchanged. (+2A/+3 add port 0x1FFD and a
 * 4-ROM set — out of scope for this 32K-ROM build.)
 */
export class Spectrum128Memory {
  constructor(_rom: Uint8Array) {
    throw new Error('zxspectrum128: memory not implemented');
  }
}
