import type {
  DebugStepOptions,
  DebugStepResult,
  MachineEmulator,
  MachineReport,
  MachineVariable,
} from '../../types';
import { DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';

/**
 * Stub — filled in by Stage 2 of docs/dialect-plans/zxspectrum128.md.
 *
 * The ZX Spectrum 128K / +2 / +3: Z80 (vendored src/emulator/z80/) + 32K dual
 * ROM (128 editor + 48 BASIC) + eight 16K RAM banks, extending the 48K machine
 * in ../zxspectrum/emulator/spectrumMachine.ts. Additions over the 48K:
 *
 *  - Spectrum128Memory paging via port 0x7FFD (RAM bank, screen bank, ROM bank).
 *  - The LD-BYTES (0x0556) flash-load trap gated on the 48 BASIC ROM being paged.
 *  - loadProgram boots to the 128K menu, selects "128 BASIC", then drives
 *    LOAD "" + RUN through the key matrix (reused SpectrumKeyboard).
 *  - AY-3-8912 register file on ports 0xFFFD/0xBFFD (emulator/ay.ts) so PLAY runs.
 *  - currentLine/debugStep/readVariables/readReport reuse ../zxspectrum's
 *    sysvars/vars/reports over the 128 memory (program + sysvars sit in the
 *    standard 48K-compatible map).
 *
 * ramKb from createEmulator is ignored: the 128K always allocates its own banks.
 */
export class Spectrum128Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  constructor(_opts: { rom: Uint8Array }) {
    throw new Error('zxspectrum128: emulator not implemented');
  }

  reset(): void {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  loadProgram(_image: Uint8Array): void {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  runFrame(): void {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  keyEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  setKey(_token: string, _down: boolean): void {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  releaseAllKeys(): void {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  setSpeed(_multiplier: number): void {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  dispose(): void {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  currentLine(): number | null {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  debugStep(_opts: DebugStepOptions): DebugStepResult {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  readVariables(): MachineVariable[] {
    throw new Error('zxspectrum128: emulator not implemented');
  }
  readReport(): MachineReport {
    throw new Error('zxspectrum128: emulator not implemented');
  }
}
