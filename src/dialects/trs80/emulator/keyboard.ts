/**
 * Stub — filled in by Stage 2 of docs/dialect-plans/trs80.md.
 *
 * The TRS-80 key matrix is memory-mapped, not an IN port: 8 rows are selected
 * one-hot by address (0x3800 | (1 << row)) and the 8 columns are returned on the
 * data bus. Mirror the structure of zx81/emulator/keyboard.ts, but read via the
 * 0x38xx memory range rather than an IN (0xFE) port.
 */
export class Trs80Keyboard {
  readMatrix(_addr: number): number {
    throw new Error('trs80: keyboard not implemented');
  }
  setKey(_token: string, _down: boolean): void {
    throw new Error('trs80: keyboard not implemented');
  }
  releaseAll(): void {
    throw new Error('trs80: keyboard not implemented');
  }
}
