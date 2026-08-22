import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core } from '../../../emulator/z80/z80core.js';
import type {
  DebugStepOptions,
  DebugStepResult,
  MachineEmulator,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  LineCost,
  MachineVariable,
} from '../../types';
import { Zx81Memory } from './memory';
import {
  LineCostRecorder,
  PROFILE_SLICE_CYCLES,
} from '../../../emulator/lineCostRecorder';
import { ProgramEndLatch } from '../../../emulator/programEndLatch';
import { createMachineLoop } from '../../../emulator/machineLoop';
import { readZx81Variables } from '../vars';
import { readZx81Report } from '../reports';
import { Zx81Keyboard } from './keyboard';
import { renderDisplay, DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';
import {
  SYSVARS_BASE,
  D_FILE,
  PPC,
  RAMTOP,
  STKEND,
  ROM_LOAD_TRAP,
  ROM_POST_LOAD,
  ROM_SAVE_TRAP,
  ROM_SAVE_RESUME,
  ROM_PROGRAM_END,
} from '../sysvars';
import { NEWLINE, zx81Charset } from '../charset';
import { readSinclairScreenText } from '../../sinclairScreenText';
import { withAutoStart } from '../pfile';

const CPU_HZ = 3_250_000;
const TSTATES_PER_NMI = 208; // one 64µs TV scanline at 3.25MHz
/**
 * A PAL field: 312 scanlines. The ZX81 has no frame hardware - in SLOW mode the
 * ROM generates the picture itself, one NMI-timed line at a time - so this is
 * the slice the host renders on rather than anything the machine enforces.
 * Deriving {@link Zx81Machine.frameHz} from it is what keeps the CPU at 3.25MHz
 * whatever slice size is chosen.
 */
const TSTATES_PER_FRAME = TSTATES_PER_NMI * 312; // 64896 → ~50.08Hz
const MAX_BOOT_FRAMES = 600;

/**
 * The ZX81 machine: Z80 + ROM + RAM + the minimal hardware set that lets the
 * unmodified ROM run in both FAST and SLOW mode:
 *
 *  - Echoed memory at 0x8000+ where M1 opcode fetches of bytes with bit 6
 *    clear execute as NOP (the ROM "executes" the display file this way).
 *  - The NMI generator (OUT 0xFD off / OUT 0xFE on, one NMI per scanline).
 *  - The maskable interrupt wired to A6 of the refresh address: fires when
 *    the R register's bit 6 goes low while interrupts are enabled.
 *  - Keyboard matrix on IN (0xFE).
 *
 * Video is rendered as a per-frame D_FILE snapshot (see display.ts) rather
 * than cycle-exact scanline generation - correct for BASIC games.
 */
export class Zx81Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / TSTATES_PER_FRAME;

  private readonly memory: Zx81Memory;
  private readonly keyboard = new Zx81Keyboard();
  private readonly cpu: Z80Core;
  private nmiGeneratorOn = false;
  private nmiCounter = 0;
  private prevRBit6 = true;
  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for the life of a run, and {@link stepInstruction} charges the
   * T-states it consumes to the line executing at the time. The reader charges memory the same way:
   * the machine's in-use figure is read at each change of line, and what it
   * rose by is charged to the line that has just stopped executing.
   */
  private readonly profile = new LineCostRecorder(
    PROFILE_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );

  /** Frame and debug slice, from one walk over the budget. */
  private readonly loop = createMachineLoop({
    cyclesPerFrame: TSTATES_PER_FRAME,
    step: () => this.stepInstruction(),
    currentLine: () => this.currentLine(),
  });
  private imageData: ImageData | null = null;
  private disposed = false;
  /** .P image waiting to be injected when the ROM reaches its LOAD loop. */
  private pendingImage: Uint8Array | null = null;
  /** Run state, latched when the ROM reaches {@link ROM_PROGRAM_END}. */
  private readonly runLatch = new ProgramEndLatch();

  constructor(opts: { rom: Uint8Array; ramKb: 16 | 32 | 64 }) {
    this.memory = new Zx81Memory(opts.rom, opts.ramKb);
    this.cpu = Z80({
      mem_read: this.memory.read,
      mem_write: this.memory.write,
      io_read: (port: number) => {
        if ((port & 0x01) === 0) {
          // IN (0xFE): keyboard + config bits (also resets vsync on hardware)
          return this.keyboard.readPort((port >> 8) & 0xff);
        }
        return 0xff;
      },
      io_write: (port: number) => {
        // Any OUT ends the vsync pulse on hardware; we only track the NMI
        // generator: OUT (0xFD) = off (A1 low), OUT (0xFE) = on (A0 low).
        if ((port & 0x02) === 0) {
          this.nmiGeneratorOn = false;
        } else if ((port & 0x01) === 0) {
          this.nmiGeneratorOn = true;
          this.nmiCounter = 0;
        }
      },
      opcode_read: (address: number) => {
        // The ZX81 video trick: M1 fetches in the echo region execute the
        // display file; bytes with bit 6 clear are fed to the CPU as NOP
        // (the hardware puts the byte on the video latch instead).
        const b = this.memory.read(address);
        if (address >= 0x8000 && (b & 0x40) === 0) return 0x00;
        return b;
      },
    });
    this.cpu.reset();
  }

  reset(): void {
    this.memory.ram.fill(0);
    this.keyboard.releaseAll();
    this.nmiGeneratorOn = false;
    this.nmiCounter = 0;
    this.prevRBit6 = true;
    this.runLatch.clear();
    this.cpu.reset();
  }

  /**
   * One CPU step plus the ZX81's per-instruction housekeeping (flash-load trap,
   * halted-refresh handling, maskable INT on R bit-6 falling edge, NMI
   * generator). Returns the T-states consumed. This is the machine loop's
   * step, so a frame and a debug slice run identical instructions.
   */
  private stepInstruction(): number {
    // Flash-load trap: when the ROM sits in its tape-read loop (0x0347),
    // drop the queued .P image into memory and continue at the SLOW/FAST
    // routine - the same place a real tape LOAD hands control back to.
    // The interpreter's return address is on the stack at this point, so
    // it then runs the program via NXTLIN.
    if (this.pendingImage && this.cpu.getPC() === ROM_LOAD_TRAP) {
      const image = this.pendingImage;
      this.pendingImage = null;
      for (let i = 0; i < image.length; i++) {
        this.memory.write(SYSVARS_BASE + i, image[i]!);
      }
      this.keyboard.releaseAll();
      this.cpu.setPC(ROM_POST_LOAD);
    }
    // Flash-save trap: the emulator has no cassette output, so a program's
    // SAVE would otherwise spin forever in the ROM's tape-output loop. Skip
    // straight to the routine's own completion point - the SLOW/FAST tail
    // that a finished SAVE falls into - so SAVE returns to the interpreter
    // and the next statement runs, exactly as it would on real hardware once
    // the (ignored) tape tone finished. At the entry the interpreter's return
    // address is already on top of the stack, so the tail's RET lands there.
    if (this.cpu.getPC() === ROM_SAVE_TRAP) {
      this.cpu.setPC(ROM_SAVE_RESUME);
    }
    // The interpreter has given up on the program (see ROM_PROGRAM_END): latch
    // it, so isProgramRunning() has an answer the ROM's own variables don't
    // give. One integer compare on a path already walked for the tape traps.
    if (this.cpu.getPC() === ROM_PROGRAM_END) this.runLatch.stopped();
    let t: number;
    if (this.cpu.isHalted()) {
      // A halted Z80 still performs refresh cycles: R keeps incrementing,
      // which is what terminates each display line's HALT via the INT.
      const r = this.cpu.getR();
      this.cpu.setR((r & 0x80) | ((r + 1) & 0x7f));
      t = 4;
    } else {
      t = this.cpu.run_instruction();
    }

    // Maskable INT on falling edge of R bit 6 (refresh address line A6)
    const rBit6 = (this.cpu.getR() & 0x40) !== 0;
    if (this.prevRBit6 && !rBit6 && this.cpu.getIFF1()) {
      this.cpu.interrupt(false, 0xff);
    }
    this.prevRBit6 = rBit6;

    // NMI generator: one NMI per scanline while enabled
    if (this.nmiGeneratorOn) {
      this.nmiCounter += t;
      while (this.nmiCounter >= TSTATES_PER_NMI) {
        this.nmiCounter -= TSTATES_PER_NMI;
        this.cpu.interrupt(true, 0);
      }
    }

    // Charge the T-states to the BASIC line executing them. Here rather than in
    // debugStep because a run the IDE performs to check an assistant answer
    // deliberately opens no debug session, and would otherwise go unmeasured.
    const p = this.profile;
    if (p.enabled) {
      p.pending += t;
      if (p.pending >= p.slice) p.sample(this.currentLine());
    }
    return t;
  }

  runFrame(): void {
    this.loop.runFrame();
  }

  /**
   * The BASIC line currently being executed, read from PPC. Returns null when
   * it isn't a valid program line (e.g. before a program has run). Note PPC
   * holds the line being executed, not the next one - NXTLIN leads by a line
   * during execution, so PPC is the right signal for "where are we".
   */
  currentLine(): number | null {
    const lineNo = this.memory.rawReadWord(PPC);
    return lineNo >= 1 && lineNo <= 9999 ? lineNo : null;
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    return this.loop.debugStep(opts);
  }

  /** True once the boot screen shows the inverse-K cursor. */
  private hasKCursor(): boolean {
    const dFile = this.memory.readWord(D_FILE);
    if (dFile < SYSVARS_BASE || this.memory.read(dFile) !== NEWLINE)
      return false;
    let addr = dFile;
    for (let i = 0; i < 24 * 33 + 1; i++, addr++) {
      if (this.memory.read(addr) === 0xb0) return true; // inverse K
    }
    return false;
  }

  /** Run whole frames until the ROM has finished booting to the K cursor. */
  bootToBasic(): void {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (frame >= 10 && this.hasKCursor()) return;
    }
    throw new Error('ZX81 ROM did not boot - emulator bug');
  }

  /** Hold a key chord for a few frames, then release it. */
  private tapKeys(codes: string[]): void {
    for (const c of codes) this.keyboard.setKey(c, true);
    for (let i = 0; i < 5; i++) this.runFrame();
    for (const c of codes) this.keyboard.setKey(c, false);
    for (let i = 0; i < 5; i++) this.runFrame();
  }

  loadProgram(image: Uint8Array, opts?: { autoStart?: number | null }): void {
    this.reset();
    this.bootToBasic();
    // An imported .P's auto-start line: re-point the rebuilt image's NXTLIN
    // at that line so the ROM's NXTLIN auto-run resumes there, exactly as the
    // original save did.
    if (opts?.autoStart != null) {
      image = withAutoStart(image, opts.autoStart);
    }
    // Queue the image, then type LOAD "" on the emulated keyboard. When the
    // ROM reaches its tape-read loop the trap in runFrame() injects the
    // image - the authentic load path, so the program starts exactly as it
    // would from cassette (auto-running if NXTLIN points at line 1). Machine
    // code and data ride inside this image as hidden `#BIN` REM records (see
    // `src/app/listingBlocks.ts`), so there is nothing to inject separately.
    //
    // Arm the run latch before any of that runs: this ROM's LOAD auto-runs the
    // program through NXTLIN and never returns to the editor first, so it
    // cannot reach ROM_PROGRAM_END until the program it just started ends -
    // which for a one-line program is inside the frames pumped below.
    this.runLatch.arm();
    this.pendingImage = image;
    this.tapKeys(['KeyJ']); // LOAD (keyword mode)
    this.tapKeys(['Shift', 'KeyP']); // "
    this.tapKeys(['Shift', 'KeyP']); // "
    this.tapKeys(['Enter']);
    for (let i = 0; i < 100 && this.pendingImage; i++) this.runFrame();
    if (this.pendingImage) {
      this.pendingImage = null;
      throw new Error('ZX81 ROM never reached the LOAD trap');
    }
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    renderDisplay(this.memory, this.imageData.data);
    ctx.putImageData(this.imageData, 0, 0);
  }

  /** Direct access for tests and debugging. */
  get mem(): Zx81Memory {
    return this.memory;
  }

  readVariables(): MachineVariable[] {
    return readZx81Variables(this.memory);
  }

  readReport(): MachineReport {
    return readZx81Report(this.memory);
  }

  /**
   * The display file as 32x24 characters.
   *
   * The ZX81 display file is not a rectangle: rows are variable-length and
   * terminated by NEWLINE, and on a machine short of RAM the ROM collapses an
   * empty row to its terminator alone. The walk here is deliberately the same
   * one {@link renderDisplay} performs - leading NEWLINE, then row by row to
   * the next one, capped at 32 columns - so what is read can never disagree
   * with what is drawn. Short rows and a short file are padded out, because the
   * contract is a fixed rectangle whatever the ROM stored.
   *
   * Codes carry the glyph in their low six bits and inverse video in bit 7, so
   * an inverse cell reports the character it draws. Graphics decode through the
   * dialect's own charset to the same Unicode blocks a listing shows; anything
   * with no single-character form (keyword tokens seen as data, unused slots)
   * reads as a space.
   */
  readScreenText(): MachineScreenText | null {
    return readSinclairScreenText({
      read: (a) => this.memory.read(a),
      dfile: this.memory.readWord(D_FILE),
      charset: zx81Charset,
      newline: NEWLINE,
    });
  }

  /**
   * Whether BASIC is executing a program, from the latch rather than from a
   * system variable: no ZX81 system variable separates a running program from a
   * finished one (see {@link ROM_PROGRAM_END}), but the ROM address at which the
   * interpreter gives up does. Running is promoted from PPC, so the frames spent
   * loading the program are reported as "not answerable yet" rather than as the
   * program.
   */
  isProgramRunning(): boolean | null {
    if (this.disposed) return null;
    return this.runLatch.read(this.currentLine() !== null);
  }

  /**
   * Actual RAM figures from the ROM's own pointers: everything from the system
   * variables up to STKEND (program, display file, variables, workspace and
   * calculator stack) is in use; STKEND to RAMTOP is spare (the machine stack
   * grows down from RAMTOP inside it, as on real hardware).
   */
  readMemoryStats(): MachineMemoryStats | null {
    const stkend = this.memory.readWord(STKEND);
    const ramtop = this.memory.readWord(RAMTOP);
    const used = stkend - SYSVARS_BASE;
    const free = ramtop - stkend;
    // Implausible pointers mean the ROM hasn't initialised them yet.
    if (ramtop <= SYSVARS_BASE || used <= 0 || free < 0) return null;
    return { used, free };
  }

  setProfileRecording(enabled: boolean): void {
    this.profile.setEnabled(enabled);
  }

  drainProfile(): LineCost[] | null {
    return this.profile.drain();
  }

  setMemoryActivityRecording(enabled: boolean): void {
    this.memory.activity.enabled = enabled;
    // Drop any hits accumulated in a previous session so a reopened overlay
    // starts clean rather than flashing stale activity.
    if (!enabled) this.memory.activity.clear();
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    if (!this.memory.activity.enabled) return null;
    return this.memory.activity.drain(recycle);
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.keyboard.handleKey(e, down);
  }

  setKey(token: string, down: boolean): void {
    this.keyboard.setKey(token, down);
  }

  releaseAllKeys(): void {
    this.keyboard.releaseAll();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
    // Drop the frame buffer and any queued load so they are freed at once
    // rather than waiting on GC of the whole machine.
    this.imageData = null;
    this.pendingImage = null;
    this.runLatch.clear();
  }
}
