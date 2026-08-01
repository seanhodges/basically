import Z80 from '../z80/z80core.js';
import type { Z80Core } from '../z80/z80core.js';
import type {
  DebugStepOptions,
  DebugStepResult,
  JoystickMode,
  JoystickState,
  MachineEmulator,
  MachineFileStore,
  MachineMemoryStats,
  MachineReport,
  MachineVariable,
  MemoryBlock,
} from '../../dialects/types';
import { locoSysVars, type LocoSysVars } from '../../dialects/cpc464/sysvars';
import {
  readLocoVariables,
  type LocoMemPort,
} from '../../dialects/cpc464/vars';
import { readLocoReport } from '../../dialects/cpc464/reports';
import { Ay38912, AY_SAMPLE_RATE, AY_CLOCK_CPC } from '../ay';
import { CpcMemory, type CpcModel } from './memory';
import { GateArray } from './gateArray';
import { Crtc } from './crtc';
import { Ppi, type PpiHost } from './ppi';
import { CpcKeyboard } from './keyboard';
import { renderDisplay, DISPLAY_WIDTH, DISPLAY_HEIGHT } from './display';

/** 4MHz Z80, 64µs (256 T-state) scanlines, 312 lines → ~50.08Hz. */
const TSTATES_PER_LINE = 256;
/** Frames to run the firmware before giving up on reaching the command loop. */
const MAX_BOOT_FRAMES = 300;
/** Frames to settle after the boot screen draws, so the input loop is ready. */
const BOOT_SETTLE_FRAMES = 40;
/**
 * Locomotive BASIC's end-of-program / start-of-variables / start-of-arrays /
 * end-of-arrays pointers. On a freshly injected program (no variables yet) all
 * four hold the same address - the first byte past the program's zero-length
 * terminator. Taken from the model's own workspace table: BASIC 1.1 keeps them
 * &1D lower than 1.0, so a 6128 given the 464's addresses reports a syntax
 * error on line 0 instead of seeing the program.
 */
const basicVarPointers = (v: LocoSysVars) => [
  v.progEnd,
  v.varStart,
  v.arrStart,
  v.arrEnd,
];

/**
 * The Amstrad CPC as one machine, parameterised by model so the CPC 6128 reuses
 * it wholesale (its extra 64K hooks in through {@link CpcMemory.setRamConfig}
 * and Locomotive BASIC 1.1 through a different upper ROM). Over the vendored
 * Z80 core it wires:
 *
 *   - {@link CpcMemory}  64K RAM + firmware/BASIC ROM overlays
 *   - {@link GateArray}  palette, screen mode, ROM paging, the 300Hz interrupt
 *   - {@link Crtc}       6845 raster timing + screen address generation
 *   - {@link Ppi}        8255 - keyboard select, VSYNC/tape inputs, AY control
 *   - {@link Ay38912}    the PSG (clocked at the CPC's 1MHz)
 *   - {@link CpcKeyboard} the 10×8 key matrix read through the AY
 *
 * The display is rendered once per frame from screen RAM; the interrupt counter
 * is clocked per scanline off the CRTC's HSYNC/VSYNC so BASIC's AFTER/EVERY
 * timers and the firmware ticker keep time.
 *
 * ROM note: the firmware + BASIC ROM image is supplied to the constructor. With
 * a genuine 32K CPC ROM the machine boots to BASIC; with an absent/blank image
 * it constructs cleanly but has no firmware to run (see the dialect's romUrl and
 * public/roms/cpc/).
 */
export class CpcMachine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;
  readonly audioSampleRate = AY_SAMPLE_RATE;

  private readonly memory: CpcMemory;
  private readonly gateArray = new GateArray();
  private readonly crtc = new Crtc();
  private readonly keyboard = new CpcKeyboard();
  private readonly ay = new Ay38912(AY_CLOCK_CPC);
  private readonly ppi: Ppi;
  private readonly cpu: Z80Core;

  /** Which AY register the PPI last latched (for the reg-14 keyboard read). */
  private aySelected = 0;
  private speed = 1;
  private disposed = false;

  /**
   * Locomotive workspace pointers for program injection and runtime
   * introspection (variables, report, memory stats), keyed by the model's BASIC
   * variant: 1.0 on the 464, 1.1 on the 6128.
   */
  private readonly sysvars: LocoSysVars;
  /** Side-effect-free RAM view the introspection readers walk. */
  private readonly memPort: LocoMemPort;

  private imageData: ImageData | null = null;
  private readonly frameBuffer = new Uint8ClampedArray(
    DISPLAY_WIDTH * DISPLAY_HEIGHT * 4,
  );

  constructor(opts: {
    rom: Uint8Array;
    model?: CpcModel;
    files?: MachineFileStore;
  }) {
    const model = opts.model ?? '464';
    this.memory = new CpcMemory(opts.rom, model);
    this.sysvars = locoSysVars(model === '464' ? 'basic10' : 'basic11');
    this.memPort = {
      read: (addr) => this.memory.readScreen(addr),
      readWord: (addr) => this.memory.readWord(addr),
    };

    const host: PpiHost = {
      aySelectRegister: (reg) => {
        this.aySelected = reg & 0x0f;
        this.ay.selectRegister(reg);
      },
      ayWrite: (value) => this.ay.writeData(value),
      ayPortRead: (line) =>
        this.aySelected === 14
          ? this.keyboard.readLine(line)
          : this.ay.readData(),
      vsyncActive: () => this.vsync,
      tapeInput: () => 0, // tape *input* to the machine is not modelled
    };
    this.ppi = new Ppi(host);

    this.cpu = Z80({
      mem_read: this.memory.read,
      mem_write: this.memory.write,
      io_read: this.ioRead,
      io_write: this.ioWrite,
    });
    this.reset();
  }

  /** CRTC VSYNC state at the scanline currently being emulated. */
  private vsync = false;

  reset(): void {
    this.memory.clearRam();
    this.memory.resetPaging();
    this.gateArray.reset();
    this.crtc.reset();
    this.ppi.reset();
    this.keyboard.releaseAll();
    this.ay.reset();
    this.aySelected = 0;
    this.vsync = false;
    this.cpu.reset();
  }

  /**
   * CPC I/O write decode by address line, the standard incomplete decoding:
   *   A15=0 A14=1  Gate Array / RAM configuration  (&7Fxx)
   *   A15=1 A14=0  CRTC 6845                         (&BCxx-&BFxx)
   *   A15=1 A14=1  peripherals; A11=0 selects the PPI (&F4xx-&F7xx)
   */
  private ioWrite = (port: number, value: number): void => {
    const region = port & 0xc000;
    if (region === 0x4000) {
      // Gate Array (and the 6128 RAM config in its top command group).
      this.gateArray.writePort(value);
      this.memory.setRomEnables(
        this.gateArray.lowerRomEnabled,
        this.gateArray.upperRomEnabled,
      );
      if ((value & 0xc0) === 0xc0) this.memory.setRamConfig(value & 0x3f);
    } else if (region === 0x8000) {
      // CRTC: function by A9/A8 (&BC select, &BD data write).
      const fn = (port >> 8) & 0x03;
      if (fn === 0) this.crtc.selectRegister(value);
      else if (fn === 1) this.crtc.writeData(value);
    } else if (region === 0xc000 && (port & 0x0800) === 0) {
      // PPI: register by A9/A8 (&F4 A, &F5 B, &F6 C, &F7 control).
      this.ppi.write((port >> 8) & 0x03, value);
    }
    // Everything else (upper-ROM select &DFxx, unused ports) is ignored on the
    // 464: it has a single BASIC ROM and no expansion peripherals modelled.
  };

  /** CPC I/O read decode (CRTC data read-back and the PPI ports). */
  private ioRead = (port: number): number => {
    const region = port & 0xc000;
    if (region === 0x8000) {
      const fn = (port >> 8) & 0x03;
      if (fn === 3) return this.crtc.readData(); // &BFxx
      return 0x00; // &BExx status (not modelled)
    }
    if (region === 0xc000 && (port & 0x0800) === 0) {
      return this.ppi.read((port >> 8) & 0x03);
    }
    return 0xff;
  };

  runFrame(): void {
    const lines = this.crtc.linesPerFrame();
    for (let line = 0; line < lines; line++) this.runScanline(line);
    this.renderFrame();
  }

  /** Emulate one CRTC scanline: clock the interrupt, then run its T-states. */
  private runScanline(line: number): void {
    this.beginScanline(line);
    const budget = TSTATES_PER_LINE * this.speed;
    let t = 0;
    while (t < budget) {
      if (this.cpu.isHalted()) {
        // Idle until the next interrupt; burn a NOP's worth of time.
        t += 4;
        continue;
      }
      t += this.cpu.run_instruction();
    }
  }

  /**
   * Start a scanline: sample VSYNC, clock the Gate Array interrupt counter off
   * HSYNC, and deliver a pending interrupt when the CPU has them enabled (this
   * also lifts a HALT the firmware parks in waiting for frame flyback). Shared by
   * {@link runScanline} and {@link debugStep} so run and debug keep identical
   * timing.
   */
  private beginScanline(line: number): void {
    this.vsync = this.crtc.inVsync(line);
    this.gateArray.onHsync(this.vsync);
    if (this.gateArray.interruptPending && this.cpu.getIFF1()) {
      this.cpu.interrupt(false, 0xff); // IM 1 → RST &38
      this.gateArray.acknowledgeInterrupt();
    }
  }

  /** Redraw the whole display from screen RAM through the Gate Array palette. */
  private renderFrame(): void {
    renderDisplay(
      { read: this.memory.readScreen },
      this.gateArray,
      this.crtc,
      this.frameBuffer,
    );
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    this.imageData.data.set(this.frameBuffer);
    ctx.putImageData(this.imageData, 0, 0);
  }

  /** One frame of AY audio (the CPC clocks the PSG at 1MHz). */
  readAudio(): Float32Array {
    return this.ay.render();
  }

  /**
   * Boot to BASIC and run the tokenized program. Runs the firmware to its
   * command loop, writes the program bytes at the model's program base, points the
   * BASIC program/variable pointers just past it, injects any memory blocks,
   * then types RUN through the key matrix (all OS-version independent - the
   * pointers and the &0170 base are verified against the real 464 ROM). With a
   * blank ROM the boot wait times out; the program bytes are still injected so a
   * caller can inspect RAM.
   */
  loadProgram(
    image: Uint8Array,
    opts?: {
      blocks?: readonly MemoryBlock[];
      autoStart?: number | null;
    },
  ): void {
    this.reset();
    this.bootToReady();

    // The tokenized image is the raw program area (line records terminated by a
    // zero length word); drop it in at the model's program base (&0170).
    const programBase = this.sysvars.programStart;
    for (let i = 0; i < image.length; i++) {
      this.memory.write((programBase + i) & 0xffff, image[i]!);
    }
    // Point BASIC's end-of-program / start-of-variables pointers just past the
    // injected image (all four sit at the same address on a program with no
    // variables yet), so RUN/LIST see the program.
    const end = (programBase + image.length) & 0xffff;
    for (const p of basicVarPointers(this.sysvars)) {
      this.memory.writeWord(p, end);
    }

    // Memory blocks (machine code / data at fixed addresses) go straight to RAM.
    for (const block of opts?.blocks ?? []) {
      for (let i = 0; i < block.bytes.length; i++) {
        this.memory.write((block.address + i) & 0xffff, block.bytes[i]!);
      }
    }

    // Drive RUN (optionally `RUN <line>`) through the key matrix and submit.
    this.type('RUN');
    const autoStart = opts?.autoStart;
    if (typeof autoStart === 'number') this.type(' ' + autoStart);
    this.tapKey('Return', 4, 40);
  }

  /** Press a key token for `hold` frames, release it, then idle for `gap`. */
  private tapKey(token: string, hold = 4, gap = 6): void {
    this.keyboard.setKey(token, true);
    for (let i = 0; i < hold; i++) this.runFrame();
    this.keyboard.setKey(token, false);
    for (let i = 0; i < gap; i++) this.runFrame();
  }

  /** Type a run of printable characters (letters, digits, space) one at a time. */
  private type(text: string): void {
    for (const ch of text.toUpperCase()) {
      if (ch === ' ') this.tapKey('Space');
      else if (ch >= '0' && ch <= '9') this.tapKey(`Digit${ch}`);
      else if (ch >= 'A' && ch <= 'Z') this.tapKey(ch);
    }
  }

  /**
   * Run whole frames until the firmware has reached its command loop. Detected
   * by the boot screen being drawn while interrupts are enabled, then a settle
   * period so the "Ready" prompt and key-input loop are fully up.
   */
  private bootToReady(): void {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (this.cpu.getIFF1() === 1 && this.screenHasContent()) {
        for (let i = 0; i < BOOT_SETTLE_FRAMES; i++) this.runFrame();
        return;
      }
    }
    // No firmware reached Ready (a blank/absent ROM): callers relying on a live
    // BASIC prompt will notice, but injection above still ran.
  }

  /** Any non-zero byte in the default screen area signals the ROM has drawn. */
  private screenHasContent(): boolean {
    for (let a = 0xc000; a < 0x10000; a += 8) {
      if (this.memory.readScreen(a) !== 0) return true;
    }
    return false;
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

  /**
   * Drive the CPC's joystick 0 from the on-screen game controller. The CPC has
   * no separate joystick port register: joystick 0 IS matrix line 9, read back
   * through the AY exactly like the keyboard (JOY(0) and INKEY on the joystick
   * keys decode that row). So the `native` mode simply presses/releases the
   * line-9 tokens - the CPC's two independent fire buttons stay distinct (unlike
   * the Sinclair/Kempston single fire), matching joystickFireButtons: 2.
   */
  setJoystick(_mode: JoystickMode, state: JoystickState): void {
    this.keyboard.setKey('JoyUp', state.up);
    this.keyboard.setKey('JoyDown', state.down);
    this.keyboard.setKey('JoyLeft', state.left);
    this.keyboard.setKey('JoyRight', state.right);
    this.keyboard.setKey('JoyFire1', state.fire1);
    this.keyboard.setKey('JoyFire2', state.fire2);
  }

  setSpeed(multiplier: number): void {
    this.speed = Math.max(0.1, multiplier);
  }

  /** Live BASIC variables walked from the Locomotive variable storage. */
  readVariables(): MachineVariable[] {
    return readLocoVariables(this.memPort, this.sysvars);
  }

  /** The last BASIC runtime report (ERR/ERL), or null when not introspectable. */
  readReport(): MachineReport | null {
    return readLocoReport(this.memPort, this.sysvars);
  }

  /**
   * Actual BASIC RAM used/free from the workspace pointers: &0170 to the end of
   * arrays is in use; that up to HIMEM is free (`PRINT FRE(0)` on a clean boot
   * equals `HIMEM - arrEnd`). Null while the pointers are implausible (mid-boot,
   * mid-injection), so the IDE falls back to the tokenized-size estimate.
   */
  readMemoryStats(): MachineMemoryStats | null {
    const arrEnd = this.memory.readWord(this.sysvars.arrEnd);
    const freeTop = this.memory.readWord(this.sysvars.freeTop);
    const used = arrEnd - this.sysvars.programStart;
    const free = freeTop - arrEnd;
    if (used <= 0 || free < 0 || freeTop <= this.sysvars.programStart) {
      return null;
    }
    return { used, free };
  }

  /**
   * The BASIC line number about to execute, for the step debugger. Locomotive
   * keeps a pointer to the current line's line-number field in the workspace
   * ({@link LocoSysVars.curLinePtr}); dereferencing it gives the live line, which
   * tracks GOTO/GOSUB and loop iteration. Null when the pointer is zero (direct
   * mode / the Ready prompt) or out of the program area - the debugger then has
   * no line to label. Verified against the real 464 ROM (a program looping over
   * two lines reads back exactly those two numbers, and reads null once ENDed).
   */
  currentLine(): number | null {
    const rec = this.memory.readWord(this.sysvars.curLinePtr);
    if (rec < this.sysvars.programStart || rec >= 0xc000) return null;
    const line = this.memory.readWord(rec);
    return line >= 1 && line <= 65535 ? line : null;
  }

  /**
   * Whether BASIC is executing a program. {@link currentLine} answers it
   * directly: Locomotive zeroes its current-line pointer at the Ready prompt,
   * so a live line number means a program is running and null means none is.
   * Never returns "not answerable yet" - {@link loadProgram} boots, injects and
   * submits RUN synchronously, so the hand-over is complete before any caller
   * can ask.
   */
  isProgramRunning(): boolean | null {
    if (this.disposed) return null;
    return this.currentLine() !== null;
  }

  /**
   * Advance up to one frame of CPU time instruction by instruction, pausing on a
   * breakpoint ('run') or as soon as the line changes ('step'). Mirrors
   * {@link runFrame}'s per-scanline interrupt delivery so timing and the keyboard
   * scan hold while debugging; when paused mid-frame it renders the screen from
   * wherever execution stopped. See {@link DebugStepOptions} for the run/step and
   * `fromLine`-arming semantics (shared with the other steppable dialects).
   */
  debugStep(opts: DebugStepOptions): DebugStepResult {
    // In run mode, ignore breakpoints until execution has left the resumed-from
    // line, so Continue off a breakpointed line doesn't immediately re-trigger.
    let armed = opts.fromLine === null;
    const lines = this.crtc.linesPerFrame();
    for (let line = 0; line < lines; line++) {
      this.beginScanline(line);
      const budget = TSTATES_PER_LINE * this.speed;
      let t = 0;
      while (t < budget) {
        if (this.cpu.isHalted()) {
          t += 4;
          continue;
        }
        t += this.cpu.run_instruction();
        const cur = this.currentLine();
        if (cur === null) continue;
        if (opts.mode === 'step') {
          if (opts.fromLine === null || cur !== opts.fromLine) {
            this.renderFrame();
            return { paused: true, line: cur };
          }
        } else {
          if (!armed && cur !== opts.fromLine) armed = true;
          if (armed && opts.breakpoints.has(cur)) {
            this.renderFrame();
            return { paused: true, line: cur };
          }
        }
      }
    }
    this.renderFrame();
    return { paused: false, line: this.currentLine() };
  }

  setMemoryActivityRecording(enabled: boolean): void {
    this.memory.activity.enabled = enabled;
    if (!enabled) this.memory.activity.clear();
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    if (!this.memory.activity.enabled) return null;
    return this.memory.activity.drain(recycle);
  }

  /** Direct access for tests/debugging. */
  get mem(): CpcMemory {
    return this.memory;
  }

  /** The last frame's rendered RGBA pixels (640×400). For tests and debugging. */
  get frame(): Uint8ClampedArray {
    return this.frameBuffer;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
    this.imageData = null;
  }
}

export { AY_SAMPLE_RATE };
