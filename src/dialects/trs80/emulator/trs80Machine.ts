import type { MachineEmulator } from '../../types';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';

/**
 * Stub — filled in by Stage 2 of docs/dialect-plans/trs80.md.
 *
 * The TRS-80 Model I: Z80 + 12K Level II BASIC ROM + RAM, all I/O memory-mapped
 * (keyboard 0x3800, video 0x3C00) — no NMI, no exotic video chip, the simplest
 * of the Z80 buses. Wire over the vendored src/emulator/z80/ core, mirroring the
 * shape of zx80/emulator/zx80Machine.ts (but without the NMI/echo-display path).
 *
 * `loadProgram` must boot the ROM, answer the `MEMORY SIZE?` prompt (ENTER) to
 * reach READY, poke the tokenized image at 0x42E8, fix the VARTAB/ARYTAB/STREND
 * pointers to just past the program, then auto-RUN by typing `RUN\r` through the
 * key matrix.
 */
export class Trs80Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  constructor(_opts: { rom: Uint8Array; ramKb: 16 | 32 | 64 }) {
    throw new Error('trs80: emulator not implemented');
  }

  reset(): void {
    throw new Error('trs80: emulator not implemented');
  }
  loadProgram(_image: Uint8Array): void {
    throw new Error('trs80: emulator not implemented');
  }
  runFrame(): void {
    throw new Error('trs80: emulator not implemented');
  }
  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('trs80: emulator not implemented');
  }
  keyEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('trs80: emulator not implemented');
  }
  setKey(_token: string, _down: boolean): void {
    throw new Error('trs80: emulator not implemented');
  }
  releaseAllKeys(): void {
    throw new Error('trs80: emulator not implemented');
  }
  setSpeed(_multiplier: number): void {
    throw new Error('trs80: emulator not implemented');
  }
  dispose(): void {
    throw new Error('trs80: emulator not implemented');
  }
}
