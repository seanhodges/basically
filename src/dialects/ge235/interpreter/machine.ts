// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import type {
  MachineEmulator,
  MachineReport,
  MachineScreenText,
} from '../../types';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH } from './terminal';
import { FRAME_HZ, Interpreter } from './interpreter';

/**
 * The GE-235 backend is a clean-room interpreter, not a CPU emulation: no core
 * for this machine exists to vendor, and the surviving 1965 compiler is a
 * memory image of unstated licence. The TRS-80's interpreter is the pattern.
 *
 * `frameHz` is a pacing convention rather than a video rate - the machine had
 * no video, and the paper roll advanced whenever a line ended - so the figure
 * is the one the interpreter's statement budget was derived against, and the
 * host sleeps to it so BASIC runs at the speed that budget targets.
 */
export class Ge235InterpreterMachine implements MachineEmulator {
  readonly frameHz = FRAME_HZ;
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  private readonly interp = new Interpreter();

  reset(): void {
    this.interp.reset();
  }

  /**
   * Load a paper tape and start it. There is no ROM to boot and no keyboard
   * sequence to inject: a tape was read and the compiler had it, so execution
   * is armed here and the pause before any output is the compile itself.
   */
  loadProgram(image: Uint8Array): void {
    this.interp.load(image);
  }

  runFrame(): void {
    this.interp.runFrame();
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    this.interp.terminal.renderTo(ctx);
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.interp.keyboard.handleEvent(e, down);
  }

  setKey(token: string, down: boolean): void {
    this.interp.keyboard.setToken(token, down);
  }

  releaseAllKeys(): void {
    this.interp.keyboard.releaseAll();
  }

  /**
   * Whether a program is executing. The interpreter tracks this itself, so
   * nothing is inferred: compiling counts, because the machine is working on
   * the program the moment the tape is in; so does waiting at an `INPUT`, which
   * is a live program with its hand out. Never "not answerable yet" -
   * {@link loadProgram} arms the compile synchronously.
   */
  isProgramRunning(): boolean | null {
    const state = this.interp.state;
    return state === 'compiling' || state === 'running' || state === 'input';
  }

  /**
   * What is on the paper, decoded through the dialect's own charset so a screen
   * reading and a listing agree about what a code means. Never null: the roll
   * exists from construction, and blank paper is blanks.
   */
  readScreenText(): MachineScreenText | null {
    return this.interp.terminal.screenText();
  }

  /** The fault the run stopped on, or the quiet end of a run that finished. */
  readReport(): MachineReport | null {
    return this.interp.getReport();
  }

  dispose(): void {
    this.interp.keyboard.releaseAll();
  }

  /** Direct access for tests. */
  get interpreter(): Interpreter {
    return this.interp;
  }
}
