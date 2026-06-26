import type {
  DebugStepOptions,
  DebugStepResult,
  MachineEmulator,
  MachineReport,
  MachineVariable,
} from '../../types';
import {
  renderDisplay,
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
} from '../emulator/display';
import { Interpreter } from './interpreter';

/**
 * Statements executed per 50 Hz frame before yielding to render — i.e. the
 * interpreter's emulated speed. Calibrated to authentic TRS-80 Level II BASIC
 * throughput rather than raw host speed: ~20 statements/frame ≈ 1000 stmt/s,
 * matching the Rugg/Feldman BM1 benchmark (`FOR K=1 TO 1000:NEXT` ≈ 1.3 s, so
 * ~770 simple statements/s) and the Z80 backend's 35500 t-states/frame budget
 * (1.77 MHz ÷ 50) at ~1–2k t-states per interpreted statement.
 *
 * The previous value (4000) ran the interpreter ~200× faster than real
 * hardware, which made action games unplayable: the breakout ball's whole fall
 * completed inside a single render frame, so the player only ever saw the final
 * "GAME OVER" — the in-BASIC `FOR T` delays could never throttle it.
 */
const STATEMENTS_PER_FRAME = 20;

/**
 * The ROM-free TRS-80 backend: a {@link MachineEmulator} over the high-level
 * Level II interpreter. It needs no ROM image (the `rom`/`ramKb` options are
 * ignored), renders through the same {@link renderDisplay} the Z80 machine uses,
 * and feeds keystrokes to the interpreter's input queue.
 */
export class Trs80InterpreterMachine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  private readonly interp = new Interpreter();
  private speed = 1;

  loadProgram(image: Uint8Array): void {
    this.interp.load(image);
  }

  reset(): void {
    this.interp.reset();
  }

  runFrame(): void {
    this.interp.runBudget(Math.round(STATEMENTS_PER_FRAME * this.speed));
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    renderDisplay(ctx, this.interp.screen.video);
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.interp.input.handleEvent(e, down);
  }

  setKey(token: string, down: boolean): void {
    this.interp.input.setToken(token, down);
  }

  releaseAllKeys(): void {
    this.interp.input.releaseAll();
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  dispose(): void {
    this.interp.input.releaseAll();
  }

  /** The current BASIC line, for the debugger. */
  currentLine(): number | null {
    return this.interp.currentLine();
  }

  /** Single-step / run-to-breakpoint at BASIC-line granularity. */
  debugStep(opts: DebugStepOptions): DebugStepResult {
    const budget = Math.round(STATEMENTS_PER_FRAME * this.speed);
    return this.interp.debugSlice(
      budget,
      opts.mode,
      opts.fromLine,
      opts.breakpoints,
    );
  }

  /** Snapshot the running program's scalar variables for the watcher. */
  readVariables(): MachineVariable[] {
    return this.interp.variableSnapshot().map((v) => ({
      name: v.name,
      kind: v.isString ? 'string' : 'number',
      value: v.value,
    }));
  }

  /** Surface a Level II runtime error (or OK) for the post-run check. */
  readReport(): MachineReport | null {
    const r = this.interp.getReport();
    if (!r) return null;
    return {
      isError: r.isError,
      message: r.message,
      code: r.code,
      line: r.line,
    };
  }

  /** Direct access for tests. */
  get interpreter(): Interpreter {
    return this.interp;
  }
}
