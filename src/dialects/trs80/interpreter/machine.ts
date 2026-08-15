import type {
  DebugStepOptions,
  DebugStepResult,
  MachineEmulator,
  MachineFileStore,
  MachineReport,
  MachineScreenText,
  MachineVariable,
  MemoryBlock,
} from '../../types';
import { plainChar } from '../charset';
import {
  renderDisplay,
  COLS,
  ROWS,
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
} from '../emulator/display';
import { Interpreter } from './interpreter';

/**
 * Statements executed per 50 Hz frame before yielding to render - i.e. the
 * interpreter's emulated speed. Calibrated to authentic TRS-80 Level II BASIC
 * throughput rather than raw host speed: ~20 statements/frame ≈ 1000 stmt/s,
 * matching the Rugg/Feldman BM1 benchmark (`FOR K=1 TO 1000:NEXT` ≈ 1.3 s, so
 * ~770 simple statements/s) and the Z80 backend's 35500 t-states/frame budget
 * (1.77 MHz ÷ 50) at ~1–2k t-states per interpreted statement.
 *
 * The previous value (4000) ran the interpreter ~200× faster than real
 * hardware, which made action games unplayable: the breakout ball's whole fall
 * completed inside a single render frame, so the player only ever saw the final
 * "GAME OVER" - the in-BASIC `FOR T` delays could never throttle it.
 */
const STATEMENTS_PER_FRAME = 20;

/**
 * Frames per second this backend is calibrated against.
 *
 * A scheduling convention rather than hardware: this backend interprets BASIC
 * statements instead of executing Z80 cycles, so it has no cycle budget and no
 * raster to be exact about. The figure is the one {@link STATEMENTS_PER_FRAME}
 * was derived from, and the host paces to it so the interpreter runs at the
 * throughput that calibration targeted.
 */
const FRAME_HZ = 50;

/**
 * The ROM-free TRS-80 backend: a {@link MachineEmulator} over the high-level
 * Level II interpreter. It needs no ROM image (the `rom`/`ramKb` options are
 * ignored), renders through the same {@link renderDisplay} the Z80 machine uses,
 * and feeds keystrokes to the interpreter's input queue.
 */
export class Trs80InterpreterMachine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  readonly frameHz = FRAME_HZ;

  private readonly interp = new Interpreter();

  constructor(files?: MachineFileStore) {
    this.interp.setFileStore(files ?? null);
  }

  loadProgram(
    image: Uint8Array,
    opts?: { blocks?: readonly MemoryBlock[] },
  ): void {
    // load() calls reset(), which zeroes main memory - so inject any memory
    // blocks (machine code / data at fixed addresses, alongside the BASIC
    // program - see MemoryBlock) afterwards, mirroring how a real loader pokes
    // code in once the program itself has loaded and before RUN starts it.
    this.interp.load(image);
    const blocks = opts?.blocks;
    if (blocks && blocks.length > 0) {
      for (const block of blocks) {
        for (let i = 0; i < block.bytes.length; i++) {
          this.interp.writeMemory(block.address + i, block.bytes[i]!);
        }
      }
    }
  }

  reset(): void {
    this.interp.reset();
  }

  runFrame(): void {
    this.interp.runBudget(STATEMENTS_PER_FRAME);
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

  dispose(): void {
    this.interp.input.releaseAll();
  }

  /** The current BASIC line, for the debugger. */
  currentLine(): number | null {
    return this.interp.currentLine();
  }

  /**
   * Whether a program is executing. The interpreter tracks this itself, so no
   * inference is needed: `running` and `input` (blocked on INPUT, which is
   * still a live program) both count, while `idle`, `ended` and `error` do not.
   * Never "not answerable yet" - {@link loadProgram} arms execution
   * synchronously, with no ROM to boot and no keystrokes to inject.
   */
  isProgramRunning(): boolean | null {
    const state = this.interp.state;
    return state === 'running' || state === 'input';
  }

  /** Single-step / run-to-breakpoint at BASIC-line granularity. */
  debugStep(opts: DebugStepOptions): DebugStepResult {
    return this.interp.debugSlice(
      STATEMENTS_PER_FRAME,
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

  /**
   * The 64x16 video map as characters. The TRS-80 has no video chip and no
   * movable screen base - video RAM at 0x3C00 *is* the character map - so this
   * is a straight walk of the interpreter's page, decoded through the dialect's
   * own charset so the block-graphics cells come back as the same sextant
   * glyphs a listing shows. Codes with no printable form (controls, the blank
   * graphic 0x80, the space-compression codes) read as spaces.
   */
  readScreenText(): MachineScreenText | null {
    const video = this.interp.screen.video;
    if (video.length < COLS * ROWS) return null;
    const lines: string[] = [];
    for (let row = 0; row < ROWS; row++) {
      let line = '';
      for (let col = 0; col < COLS; col++) {
        line += plainChar(video[row * COLS + col]!) ?? ' ';
      }
      lines.push(line);
    }
    return { lines, cols: COLS, rows: ROWS };
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
