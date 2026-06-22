/**
 * Stub — filled in by Stage 2 of docs/dialect-plans/trs80.md.
 *
 * Memory map: ROM 0x0000–0x2FFF (Level II BASIC), keyboard matrix 0x3800–0x3BFF,
 * video RAM 0x3C00–0x3FFF, RAM from 0x4000 (TXTTAB at 0x42E8; the sysvar pointers
 * TXTTAB/VARTAB/ARYTAB/STREND live just below in the 0x40xx page).
 */
export class Trs80Memory {
  constructor(_rom: Uint8Array, _ramKb: 16 | 32 | 64) {
    throw new Error('trs80: memory not implemented');
  }
}
