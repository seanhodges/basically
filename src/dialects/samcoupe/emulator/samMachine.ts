import type { MachineEmulator } from '../../types';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './display';

/** Frames per second of the SAM's 50Hz display. */
const FRAME_HZ = 50;

/**
 * The SAM Coupé as a {@link MachineEmulator}: the vendored Z80 core over this
 * machine's paged bus, ASIC video, SAA1099 sound and key matrix.
 *
 * `runFrame` and `debugStep` must come from one shared step function via
 * `createMachineLoop`, because a debug session opens on any press of Play: the
 * profile charge, the cycle counter the tape and the sound chip read themselves
 * against, and the frame counter behind flashing attributes are all owed once a
 * slice, however that slice ends.
 */
export class SamMachine implements MachineEmulator {
  readonly frameHz = FRAME_HZ;
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  constructor(_opts: { rom: Uint8Array }) {
    throw new Error('samcoupe: not implemented');
  }

  reset(): void {
    throw new Error('samcoupe: not implemented');
  }

  loadProgram(_image: Uint8Array): void {
    throw new Error('samcoupe: not implemented');
  }

  runFrame(): void {
    throw new Error('samcoupe: not implemented');
  }

  renderTo(_ctx: CanvasRenderingContext2D): void {
    throw new Error('samcoupe: not implemented');
  }

  keyEvent(_e: KeyboardEvent, _down: boolean): boolean {
    throw new Error('samcoupe: not implemented');
  }

  setKey(_token: string, _down: boolean): void {
    throw new Error('samcoupe: not implemented');
  }

  releaseAllKeys(): void {
    throw new Error('samcoupe: not implemented');
  }

  isProgramRunning(): boolean | null {
    throw new Error('samcoupe: not implemented');
  }

  dispose(): void {
    throw new Error('samcoupe: not implemented');
  }
}
