// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import Z80 from '../z80/z80core.js';
import type { Z80Core } from '../z80/z80core.js';
import type {
  Block,
  CharsetMapping,
  DebugStepOptions,
  DebugStepResult,
  JoystickMode,
  JoystickState,
  LineCost,
  MachineEmulator,
  MachineFileStore,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  MachineVariable,
} from '../../dialects/types';
import { createMachineLoop } from '../machineLoop';
import { LineCostRecorder, PROFILE_SLICE_CYCLES } from '../lineCostRecorder';
import { AY_SAMPLES_PER_FRAME } from '../ay';
import type { MsxModel } from './model';
import { MsxSlots } from './slots';
import { Tms9918 } from './vdp';
import { MsxPpi, type MsxPpiHost } from './ppi';
import { MsxPsg, type MsxPsgHost } from './psg';
import { MsxKeyboard } from './keyboard';
import { MsxDisplay, DISPLAY_HEIGHT, DISPLAY_WIDTH } from './display';
import { readScreenText } from './screenText';
import {
  ARYTAB,
  CURLIN,
  DIRECT_MODE,
  FRETOP,
  MEMSIZ,
  STKTOP,
  STREND,
  TXTTAB,
  VARTAB,
  type MsxMemPort,
} from './workspace';
// Both readers decode MSX BASIC rather than this computer - the variable
// layout and the error table are the same on any MSX1 - so a sibling model
// takes these as they are. They live in the dialect folder because they answer
// in its character set and its number formatting.
import { readVariables } from '../../dialects/hb10p/vars';
import { readReport } from '../../dialects/hb10p/reports';

/** The MSX standard's Z80 clock: 21.47727MHz / 6, on PAL and NTSC alike. */
export const CPU_HZ = 3_579_545;
/** One scanline of CPU time; the VDP's line is 342 dots at three per cycle. */
const CYCLES_PER_LINE = 228;
/** Lines in a frame; the region is the only thing that changes it. */
const LINES_PAL = 313;
const LINES_NTSC = 262;
/** The active display ends here, and with it the frame interrupt. */
const ACTIVE_END_LINE = 192;

/** Frames to run the BIOS before giving up on reaching the BASIC prompt. */
const MAX_BOOT_FRAMES = 400;
/** Frames to settle once the prompt is up, so the key scanner is running. */
const BOOT_SETTLE_FRAMES = 30;

/**
 * An MSX1 computer: the vendored Z80 core over the MSX bus - the primary slot
 * register, the TMS9918A-family VDP, the 8255 PPI and the shared AY-family
 * PSG - configured for one machine by an {@link MsxModel}.
 *
 * Two things separate this bus from the other Z80 machines here. There is no
 * CPU contention to model: MSX1 inserts no wait states, and the timing
 * constraint the hardware imposes (the interval software must leave between
 * VRAM accesses) is the program's problem rather than the bus's. And video
 * memory is a second address space the CPU can only reach through two I/O
 * ports, which is why MSX BASIC has VPOKE and VPEEK at all.
 *
 * ROM note: the 32KB BIOS + BASIC image is supplied to the constructor. With a
 * genuine image the machine boots to MSX BASIC; with an absent or blank one it
 * constructs cleanly and simply has nothing to run (see the dialect's romUrl
 * and public/roms/msx/).
 */
export class MsxMachine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  private readonly model: MsxModel;
  private readonly charset: CharsetMapping;
  private readonly slots: MsxSlots;
  private readonly vdp: Tms9918;
  private readonly ppi: MsxPpi;
  private readonly psg: MsxPsg;
  private readonly keyboard: MsxKeyboard;
  private readonly display = new MsxDisplay();
  private readonly cpu: Z80Core;

  private readonly linesPerFrame: number;
  /** Next scanline still to be started this frame (see {@link beginLinesTo}). */
  private nextLine = 0;
  /** The joystick the on-screen controller drives, as the PSG reads it. */
  private joystick = 0x3f;
  private disposed = false;

  private imageData: ImageData | null = null;
  private readonly frameBuffer = new Uint8ClampedArray(
    DISPLAY_WIDTH * DISPLAY_HEIGHT * 4,
  );

  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for the life of a run, and the machine loop's step charges the
   * T-states it consumed to the line executing at the time.
   */
  private readonly profile = new LineCostRecorder(
    PROFILE_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );

  /**
   * The bus as the introspection readers see it: RAM by CPU address, whichever
   * slot is selected, and without stamping the memory-activity overlay.
   */
  private readonly memPort: MsxMemPort = {
    peek: (addr) => this.slots.readRam(addr),
    peekWord: (addr) => this.slots.readRamWord(addr),
  };

  /**
   * Frame and debug slice from one walk over the budget - here a whole frame's
   * T-states, with the scanlines started off the position reached rather than
   * run a line at a time. The overrun is carried across frames: a Z80
   * instruction is a sizeable fraction of a 228 T-state line, and a debt
   * dropped each frame would run the CPU fast by however much its last
   * instruction cost.
   */
  private readonly loop = createMachineLoop({
    cyclesPerFrame: () => CYCLES_PER_LINE * this.linesPerFrame,
    onSliceStart: () => {
      this.nextLine = 0;
    },
    step: (elapsed) => {
      this.beginLinesTo(elapsed);
      const idle = this.cpu.isHalted();
      return { cycles: this.stepInstruction(), idle };
    },
    onSliceEnd: () => this.renderFrame(),
    currentLine: () => this.currentLine(),
  });

  constructor(opts: {
    rom: Uint8Array;
    model: MsxModel;
    charset: CharsetMapping;
    files?: MachineFileStore;
  }) {
    this.model = opts.model;
    this.charset = opts.charset;
    this.linesPerFrame = this.model.region === 'pal' ? LINES_PAL : LINES_NTSC;
    this.slots = new MsxSlots(opts.rom, this.model);
    this.vdp = new Tms9918(this.model);
    this.keyboard = new MsxKeyboard();

    const ppiHost: MsxPpiHost = {
      selectSlots: (value) => this.slots.selectSlots(value),
      readKeyboardRow: (row) => this.keyboard.readRow(row),
      // No tape deck is modelled: the motor and write lines are accepted and
      // dropped, so the BIOS's own SAVE path runs rather than faulting on a
      // port that answers nothing.
      setTapeMotor: () => {},
      writeTapeBit: () => {},
    };
    this.ppi = new MsxPpi(ppiHost);

    const psgHost: MsxPsgHost = {
      readJoystick: (port) => (port === 0 ? this.joystick : 0x3f),
      // No tape playing: the input line idles high.
      readTapeBit: () => 1,
    };
    this.psg = new MsxPsg(psgHost);

    this.cpu = Z80({
      mem_read: this.memRead,
      mem_write: this.memWrite,
      io_read: this.ioRead,
      io_write: this.ioWrite,
    });
    this.reset();
  }

  /** PAL is 313 lines and NTSC 262, so neither is a round rate. */
  get frameHz(): number {
    return CPU_HZ / (CYCLES_PER_LINE * this.linesPerFrame);
  }

  /** The rate the PSG actually emits at: a fixed count of samples per frame. */
  get audioSampleRate(): number {
    return AY_SAMPLES_PER_FRAME * this.frameHz;
  }

  reset(): void {
    this.slots.reset();
    this.vdp.reset();
    this.ppi.reset();
    this.psg.reset();
    this.keyboard.releaseAll();
    this.joystick = 0x3f;
    this.nextLine = 0;
    this.loop.reset();
    this.cpu.reset();
  }

  // --- The bus ---

  private memRead = (addr: number): number => this.slots.read(addr);
  private memWrite = (addr: number, value: number): void =>
    this.slots.write(addr, value);

  /**
   * I/O decode. The S3527 MSX-Engine mirrors each of its devices across a block
   * of eight ports rather than decoding the low bits, so the VDP answers on
   * 0x98-0x9F and the PSG and PPI on 0xA0-0xA7 and 0xA8-0xAF - and software
   * that writes to a mirror (some does) reaches the same register.
   */
  private ioRead = (port: number): number => {
    const p = port & 0xff;
    if (p >= 0x98 && p <= 0x9f) {
      return p & 1 ? this.vdp.readStatus() : this.vdp.readData();
    }
    if (p >= 0xa0 && p <= 0xa7) return this.psg.read();
    if (p >= 0xa8 && p <= 0xaf) return this.ppi.read(p & 0x03);
    // Nothing else is fitted: an unfitted port floats the data bus high. The
    // printer port at 0x90-0x97 is included deliberately, because 0xFF there is
    // "printer not ready", which is what an unconnected port should report.
    return 0xff;
  };

  private ioWrite = (port: number, value: number): void => {
    const p = port & 0xff;
    if (p >= 0x98 && p <= 0x9f) {
      if (p & 1) this.vdp.writeControl(value);
      else this.vdp.writeData(value);
      return;
    }
    if (p >= 0xa0 && p <= 0xa7) {
      const reg = p & 0x03;
      if (reg === 0) this.psg.selectRegister(value);
      else if (reg === 1) this.psg.write(value);
      return;
    }
    if (p >= 0xa8 && p <= 0xaf) this.ppi.write(p & 0x03, value);
  };

  // --- The run loop ---

  runFrame(): void {
    this.loop.runFrame();
  }

  /**
   * Advance up to one frame of CPU time instruction by instruction, pausing on
   * a breakpoint ('run') or as soon as the line changes ('step'). The same walk
   * as {@link runFrame}, so interrupt timing and the key scan hold while
   * debugging. See {@link DebugStepOptions} for the run/step and `fromLine`
   * semantics shared with the other steppable dialects.
   */
  debugStep(opts: DebugStepOptions): DebugStepResult {
    return this.loop.debugStep(opts);
  }

  /**
   * Start every scanline the frame has now reached, so a line one long
   * instruction straddles is still started - the frame interrupt is raised at
   * one particular line, and a line that never began would lose it.
   */
  private beginLinesTo(elapsed: number): void {
    while (
      this.nextLine < this.linesPerFrame &&
      this.nextLine * CYCLES_PER_LINE <= elapsed
    ) {
      if (this.nextLine === ACTIVE_END_LINE) this.vdp.endActiveDisplay();
      this.nextLine++;
    }
    // The VDP holds its INT line low until the CPU reads the status register,
    // so the interrupt is offered on every line rather than only on the one
    // that raised it: the BIOS runs long stretches with interrupts disabled and
    // a single pulse at line 192 would simply be missed.
    if (this.vdp.irq && this.cpu.getIFF1()) this.cpu.interrupt(false, 0xff);
  }

  /**
   * One instruction, or a NOP's worth of idle time while the CPU is halted
   * waiting for the next interrupt, returning the T-states it took. This is the
   * machine loop's step, so a run and a debug slice charge the profile
   * identically - and so a run the IDE performs to check an assistant answer,
   * which deliberately opens no debug session, is measured like any other.
   */
  private stepInstruction(): number {
    const t = this.cpu.isHalted() ? 4 : this.cpu.run_instruction();
    const p = this.profile;
    if (p.enabled) {
      p.pending += t;
      if (p.pending >= p.slice) p.sample(this.currentLine());
    }
    return t;
  }

  private renderFrame(): void {
    const report = this.display.render(this.vdp, this.frameBuffer);
    this.vdp.reportSprites(report.collision, report.fifthSprite);
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    this.imageData.data.set(this.frameBuffer);
    ctx.putImageData(this.imageData, 0, 0);
  }

  /** One frame of PSG audio. */
  readAudio(): Float32Array {
    return this.psg.render();
  }

  // --- Introspection ---

  /**
   * The BASIC line number about to execute, for the step debugger and the
   * profiler. MSX BASIC keeps it in its workspace at CURLIN and parks 0xFFFF
   * there in direct mode, so the cell answers directly and tracks GOTO/GOSUB
   * and loop iteration without latching anything.
   */
  currentLine(): number | null {
    const line = this.slots.readRamWord(CURLIN);
    return line === DIRECT_MODE || line === 0 ? null : line;
  }

  /**
   * Whether BASIC is executing a program. {@link currentLine} answers it: MSX
   * BASIC parks CURLIN at 0xFFFF whenever it is at the prompt, so a live line
   * number means a program is running and none means nothing is. A RUN the user
   * types at the emulated keyboard is reported like any other.
   */
  isProgramRunning(): boolean | null {
    if (this.disposed) return null;
    return this.currentLine() !== null;
  }

  readScreenText(): MachineScreenText | null {
    return readScreenText(this.vdp, this.charset);
  }

  /** Live BASIC variables, walked from MSX BASIC's own variable storage. */
  readVariables(): MachineVariable[] {
    return readVariables(this.memPort);
  }

  /** The last BASIC report: Ok, an error, or a break. */
  readReport(): MachineReport | null {
    return readReport(this.memPort);
  }

  /**
   * What the program has spent of the RAM MSX BASIC hands it, and what is left.
   *
   * The machine spends two pools and both are counted. Program text, variables
   * and arrays grow up from TXTTAB to STREND; strings are filled downwards from
   * MEMSIZ, and FRETOP is how far down they have reached. A figure covering
   * only the first would read as a program that allocates nothing however hard
   * it churned its strings, which is a measurement rather than an absence.
   *
   * The free figure is FRE(0)'s own arithmetic - everything between the arrays
   * and the lowest string - so it spans the free program area and the
   * unallocated part of the string space alike. The sign-on banner's figure is
   * smaller than this because it counts neither the string space nor the last
   * few bytes below the stack.
   *
   * Null while the pointers are implausible (mid-boot, mid-injection), so the
   * IDE falls back to its tokenized-size estimate rather than showing nonsense.
   */
  readMemoryStats(): MachineMemoryStats | null {
    const mem = this.memPort;
    const txttab = mem.peekWord(TXTTAB);
    const strend = mem.peekWord(STREND);
    const fretop = mem.peekWord(FRETOP);
    const stktop = mem.peekWord(STKTOP);
    const memsiz = mem.peekWord(MEMSIZ);
    const laidOut =
      txttab > 0 &&
      txttab <= strend &&
      strend <= stktop &&
      stktop <= fretop &&
      fretop <= memsiz;
    if (!laidOut) return null;
    return {
      used: strend - txttab + (memsiz - fretop),
      free: fretop - strend,
    };
  }

  setProfileRecording(enabled: boolean): void {
    this.profile.setEnabled(enabled);
  }

  drainProfile(): LineCost[] | null {
    return this.profile.drain();
  }

  setMemoryActivityRecording(enabled: boolean): void {
    this.slots.activity.enabled = enabled;
    if (!enabled) this.slots.activity.clear();
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    if (!this.slots.activity.enabled) return null;
    return this.slots.activity.drain(recycle);
  }

  // --- Input ---

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
   * Drive the general-purpose port the MSX calls joystick 1 from the on-screen
   * controller. The port is read through the PSG's own input register rather
   * than through the keyboard, so unlike the Amstrad this presses no matrix
   * cell: the six lines are active low, and both triggers stay distinct.
   */
  setJoystick(_mode: JoystickMode, state: JoystickState): void {
    let bits = 0x3f;
    const clear = (bit: number, pressed: boolean): void => {
      if (pressed) bits &= ~(1 << bit) & 0x3f;
    };
    clear(0, state.up);
    clear(1, state.down);
    clear(2, state.left);
    clear(3, state.right);
    clear(4, state.fire1);
    clear(5, state.fire2);
    this.joystick = bits;
  }

  // --- Loading a program ---

  /**
   * Boot to BASIC and run the tokenized program. Runs the BIOS to its prompt,
   * writes the program bytes at TXTTAB, points the variable pointers just past
   * them, injects any memory blocks, then types RUN through the key matrix.
   * With a blank ROM the boot wait times out; the program bytes are still
   * injected so a caller can inspect RAM.
   */
  loadProgram(
    image: Uint8Array,
    opts?: {
      blocks?: readonly Block[];
      autoStart?: number | null;
    },
  ): void {
    this.reset();
    this.bootToPrompt();

    // The dialect's image is the `.bas` container: a marker byte then the
    // program area exactly as it sits from TXTTAB. Only the program goes into
    // memory, and MSX BASIC wants the zero byte below TXTTAB that its line
    // links terminate against.
    const program = image.length > 0 ? image.subarray(1) : image;
    const base = this.slots.readRamWord(TXTTAB) || 0x8001;
    this.slots.writeRam(base - 1, 0);
    for (let i = 0; i < program.length; i++) {
      this.slots.writeRam(base + i, program[i]!);
    }
    // Variables start where the program ends, and the array and string pointers
    // follow it: on a program with no variables yet all three are that address.
    const end = (base + program.length) & 0xffff;
    this.slots.writeRamWord(VARTAB, end);
    this.slots.writeRamWord(ARYTAB, end);
    this.slots.writeRamWord(STREND, end);

    for (const block of opts?.blocks ?? []) {
      for (let i = 0; i < block.bytes.length; i++) {
        this.slots.writeRam((block.address + i) & 0xffff, block.bytes[i]!);
      }
    }

    this.type('RUN');
    const autoStart = opts?.autoStart;
    if (typeof autoStart === 'number') this.type(` ${autoStart}`);
    this.tapKey('Return', 3, 30);
  }

  /**
   * Run whole frames until the BIOS has drawn its sign-on and reached the BASIC
   * prompt, then settle so the key scanner is running. Detected off the screen
   * rather than off a ROM address, so it holds for any MSX1 BIOS.
   */
  private bootToPrompt(): void {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (this.cpu.getIFF1() === 1 && this.promptIsUp()) {
        for (let i = 0; i < BOOT_SETTLE_FRAMES; i++) this.runFrame();
        return;
      }
    }
    // No BIOS reached the prompt (a blank or absent ROM). Injection still runs;
    // a caller wanting a live prompt will see an empty screen.
  }

  /** MSX BASIC has printed its `Ok` and set the program pointers up. */
  private promptIsUp(): boolean {
    if (this.slots.readRamWord(TXTTAB) === 0) return false;
    return (
      this.readScreenText()?.lines.some((l) => l.startsWith('Ok')) ?? false
    );
  }

  /** Press a key token for `hold` frames, release it, then idle for `gap`. */
  private tapKey(token: string, hold = 3, gap = 5): void {
    this.keyboard.setKey(token, true);
    for (let i = 0; i < hold; i++) this.runFrame();
    this.keyboard.setKey(token, false);
    for (let i = 0; i < gap; i++) this.runFrame();
  }

  /** Type a run of letters, digits and spaces one key at a time. */
  private type(text: string): void {
    for (const ch of text.toUpperCase()) {
      if (ch === ' ') this.tapKey('Space');
      else if (ch >= '0' && ch <= '9') this.tapKey(`Digit${ch}`);
      else if (ch >= 'A' && ch <= 'Z') this.tapKey(ch);
    }
  }

  /** Direct access to the bus and the video chip, for tests and debugging. */
  get bus(): MsxSlots {
    return this.slots;
  }

  get video(): Tms9918 {
    return this.vdp;
  }

  /** The last frame's rendered RGBA pixels. For tests and debugging. */
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
