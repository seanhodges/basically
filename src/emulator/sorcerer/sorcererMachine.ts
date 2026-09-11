// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import Z80 from '../z80/z80core.js';
import type { Z80Core } from '../z80/z80core.js';
import { ProgramEndLatch } from '../programEndLatch';
import { LineCostRecorder, PROFILE_SLICE_CYCLES } from '../lineCostRecorder';
import { createMachineLoop } from '../machineLoop';
import { loadMicrosoftBasicProgram } from '../microsoftBasicLoad';
import { drawRomNotice, noRomNotice } from '../romNotice';
import type {
  Block,
  DebugStepOptions,
  DebugStepResult,
  LineCost,
  MachineEmulator,
  MachineScreenText,
  TapeFile,
} from '../../dialects/types';
import { basicImagePointers } from '../../dialects/sorcerer/basicImage';
import {
  CURLIN,
  DIRECT_MODE_HIGH,
  MAX_LINE_NUMBER,
  PORT_CONTROL,
  PORT_DATA,
  PORT_PARALLEL,
  PORT_STATUS,
  PROGRAM_BASE,
  VARTAB,
} from '../../dialects/sorcerer/addresses';
import { CPU_HZ, CYCLES_PER_FRAME, VBLANK_START_CYCLES } from './clock';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH, SorcererDisplay } from './display';
import { SorcererKeyboard } from './keyboard';
import { hasFirmware, SorcererMemory } from './memory';
import { readSorcererScreenText } from './screenText';

/** The control port's low nibble: which of the sixteen keyboard lines to read. */
const KEYBOARD_LINE_MASK = 0x0f;

/**
 * Bit 5 of the control port: the video circuit's vertical sync.
 *
 * The firmware spins on it - `IN A,($FE) / BIT 5,A / JR Z,-6` - to pace itself
 * to the frame, so the bit has to change state within a frame or the machine
 * stops there. It is modelled low through the blanking below the visible 240
 * lines and high across them. The Technical Manual names the bit without giving
 * its sense, and what the firmware asks of it is one edge per frame, which
 * either sense provides.
 */
const CONTROL_VSYNC = 0x20;

/**
 * Bits 6-7 of the control port: the parallel port's two handshake lines, both
 * pulled high.
 *
 * Not cosmetic. The Monitor's byte-at-a-time parallel routines wait on exactly
 * these bits - `BIT 6,A / JR Z` before it sends a byte, `BIT 7,A / JR Z` before
 * it reads one - so a machine that answered low would stop dead the first time
 * a program used the port.
 */
const CONTROL_HANDSHAKE = 0xc0;

/**
 * What the parallel port reads with nothing plugged into it.
 *
 * Zero rather than an undriven bus, and for a reason the Monitor supplies: its
 * printer routine waits for bit 7 of this port to *fall* (`IN A,($FF) / BIT 7,A
 * / JR NZ,-6`), so a port answering all ones would hang the machine the first
 * time a program printed. The port is a buffer with nothing driving it, and
 * that is what an emulated Sorcerer with no printer has.
 */
const PARALLEL_IDLE = 0x00;

/**
 * What the UART's status port reads with nothing on the line: the transmitter
 * ready for a byte, the receiver holding none, no framing or parity fault, and
 * the three bits above them unconnected and so high.
 *
 * The cassette and the RS-232 both arrive through this UART, and neither is
 * modelled: what matters is that the status never claims a byte has arrived,
 * because the Monitor's tape routines would then set about decoding a record
 * that is not there.
 */
const UART_STATUS_IDLE = 0xe1;

/**
 * How long each stage of the boot is given before it is called a failure.
 * Generous: the slowest of them is the Monitor's memory sizing, which walks up
 * from address zero writing and reading back until it finds the top, before
 * BASIC gets a chance to start.
 */
const MAX_BOOT_FRAMES = 400;

/** Frames a key is held, and then left released, when the machine types to itself. */
const KEY_HOLD_FRAMES = 3;
const KEY_GAP_FRAMES = 3;

/**
 * Frames of quiet before the first keystroke of a typed line.
 *
 * The firmware's key routine will not take a key until it has seen the matrix
 * empty for a scan or two, and what {@link SorcererMachine.bootToReady} waits
 * for is the prompt appearing rather than the keyboard being polled. A key
 * pressed on the frame after it lands inside that settling and is swallowed,
 * which starts the line one character short - a syntax error rather than a
 * visible fault.
 */
const KEY_SETTLE_FRAMES = 5;

/** What the interpreter prints when it is ready for a command. */
const READY_PROMPT = 'READY';

/**
 * Shown on screen when the machine is constructed without its ROM image. See
 * `romNotice.ts` for why this is drawn in the host's font: on this machine
 * especially, the character generator is *in* the image that is missing.
 */
const NO_FIRMWARE_NOTICE = noRomNotice(
  'Monitor, BASIC ROM PAC and character generator',
  'public/roms/sorcerer/sorcerer.rom',
);

/**
 * The Exidy Sorcerer as a {@link MachineEmulator}: a Z80 bus over the vendored
 * core in `src/emulator/z80/`.
 *
 * **Booting is a three-ROM affair, and only two of them are code.** Out of reset
 * the CPU finds the Monitor mirrored at 0x0000 (see `memory.ts`) and its first
 * instruction is the jump to 0xE062 that leaves the mirror behind. The Monitor
 * sizes RAM from address zero upwards, sets its stack below the top of what it
 * found, sets up the screen and the character generator, and looks for a `C3`
 * jump at 0xDFFD - the ROM PAC's cold-start vector. On a Standard BASIC PAC it
 * is there, so the machine that ends up at a `READY` prompt has entered BASIC
 * without the user asking for it.
 *
 * The third ROM is the character generator, which no instruction ever executes:
 * it holds the shapes of codes 0-127 for the video circuit to scan. The band
 * above those is RAM, and what the Monitor copies into it at boot is where the
 * dialect's "standard graphics" come from.
 */
export class SorcererMachine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;

  private readonly memory: SorcererMemory;
  private readonly keyboard = new SorcererKeyboard();
  private readonly display = new SorcererDisplay();
  private readonly cpu: Z80Core;
  /** Run state, latched from BASIC's own current-line word (see {@link CURLIN}). */
  private readonly runLatch = new ProgramEndLatch();
  /** Whether the interpreter has been seen executing a line of the loaded program. */
  private runStarted = false;
  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for a whole run, and the CPU step charges the cycles it consumes to
   * whichever line {@link currentLine} names at the time.
   */
  private readonly profile = new LineCostRecorder(PROFILE_SLICE_CYCLES);
  /** Whether every part of the ROM image arrived; see {@link hasRom}. */
  private readonly firmware: boolean;

  /** The keyboard line the last control-port write selected. */
  private keyboardLine = 0;

  /**
   * How far into the current frame the CPU has run, which is what the video
   * circuit's vertical sync is read against. In cycles rather than frames
   * because the firmware polls sync *inside* a frame - a per-frame flag could
   * only ever answer at one instant of it, and a loop waiting for the state to
   * change would never see it.
   */
  private frameCycles = 0;

  private readonly loop = createMachineLoop({
    cyclesPerFrame: CYCLES_PER_FRAME,
    // A HALT here is terminal: nothing on the board raises an interrupt, so the
    // CPU would sit through the whole budget doing nothing. End the slice
    // instead, owing nothing for time it was never going to run.
    idleEndsSlice: true,
    ready: () => this.hasRom,
    onSliceStart: () => {
      this.frameCycles = 0;
    },
    step: (elapsed) => {
      this.frameCycles = elapsed;
      return this.cpu.isHalted()
        ? { cycles: 0, idle: true }
        : this.stepInstruction();
    },
    currentLine: () => this.currentLine(),
  });
  private disposed = false;

  constructor(opts: {
    monitor: Uint8Array;
    romPac: Uint8Array;
    charGen: Uint8Array;
  }) {
    this.firmware = hasFirmware(opts);
    this.memory = new SorcererMemory(opts);
    this.cpu = Z80({
      mem_read: this.memory.read,
      mem_write: (address: number, value: number) => {
        this.memory.write(address, value);
        // Watch the interpreter's current-line word as it is written rather
        // than sampling it per frame: a program short enough to start and
        // finish inside one frame would otherwise never be seen running at all.
        const a = address & 0xffff;
        if (a === CURLIN || a === CURLIN + 1) this.noteRunState();
      },
      io_read: (port: number) => this.readPort(port & 0xff),
      io_write: (port: number, value: number) =>
        this.writePort(port & 0xff, value & 0xff),
    });
    this.reset();
  }

  /**
   * True once the whole ROM image is present.
   *
   * The image ships with the build and `fetchRom` rejects one that is not
   * exactly the declared size, so in the app a machine without it is a machine
   * the picker never offered. It stays constructible anyway rather than
   * throwing: it runs no CPU, and says what is missing on its own screen.
   */
  get hasRom(): boolean {
    return this.firmware;
  }

  reset(): void {
    this.memory.reset();
    this.keyboard.releaseAll();
    this.keyboardLine = 0;
    this.loop.reset();
    this.frameCycles = 0;
    this.runStarted = false;
    this.runLatch.clear();
    this.cpu.reset();
  }

  runFrame(): void {
    this.loop.runFrame();
  }

  /**
   * Boot to the BASIC prompt, drop the tokenized program into RAM, fix the
   * interpreter pointers that describe it, and type RUN.
   *
   * `image` is the bare program bytes the tokenizer produced - there is no
   * container to unwrap, because the program area is plain RAM with no load
   * address or length in front of it (see the dialect's `basicImage.ts`). The
   * Exidy cassette record that wraps those bytes on tape is a separate thing
   * and is not what arrives here.
   *
   * RUN is typed at the emulated keyboard rather than jumped to: it is RUN that
   * sets up the variable, array and string pointers from the program now in
   * place, and nothing outside the interpreter knows how to do that for it.
   * `autoStart` becomes RUN's line-number argument, which this interpreter
   * takes the way the Microsoft BASICs it descends from do.
   */
  loadProgram(
    image: Uint8Array,
    opts?: {
      blocks?: readonly Block[];
      autoStart?: number | null;
      tapeFiles?: readonly TapeFile[];
      bootDisc?: Uint8Array;
    },
  ): void {
    this.reset();
    if (!this.hasRom) return;
    this.bootToReady();

    loadMicrosoftBasicProgram(this.memory, image, {
      programBase: PROGRAM_BASE,
      pointers: basicImagePointers(image),
      blocks: opts?.blocks,
      typeRun: () => {
        // Armed before the keystrokes that start the program rather than after
        // them: a program short enough to finish inside the frames those
        // keystrokes pump would otherwise end before anything was watching.
        this.runStarted = false;
        this.runLatch.arm();
        const autoStart = opts?.autoStart;
        this.type(typeof autoStart === 'number' ? `RUN ${autoStart}` : 'RUN');
      },
    });
  }

  /**
   * Run from reset to the point where BASIC is waiting for a command.
   *
   * Public because a caller may want the machine at its prompt without a
   * program - the emulator pane opens there, and anything that types at the
   * keyboard needs the interpreter listening before the first key goes down.
   *
   * Two signals, in order, because neither alone says "ready":
   *
   *  1. **VARTAB is set.** It is workspace RAM, so it holds zero from reset
   *     until the interpreter's cold start writes the end of an empty program
   *     into it. That happens before the sign-on, so it says the ROM PAC was
   *     found and entered, not that it has finished starting up.
   *  2. **The prompt is on the screen.** Which is what a person at the machine
   *     waits for, and the only thing this firmware does differently when it is
   *     idle: it polls the keyboard from its command loop, but it also polls it
   *     between the characters of the sign-on, so counting scans would call the
   *     machine ready in the middle of its own banner.
   */
  bootToReady(): void {
    if (!this.hasRom) return;
    this.runUntil(
      () => this.memory.rawReadWord(VARTAB) !== 0,
      'never cold-started Exidy Standard BASIC',
    );
    this.runUntil(
      () =>
        readSorcererScreenText(this.memory.screenRam).lines.some(
          (line) => line.trimEnd() === READY_PROMPT,
        ),
      'never reached the BASIC prompt',
    );
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.hasRom) {
      drawRomNotice(ctx, DISPLAY_WIDTH, DISPLAY_HEIGHT, NO_FIRMWARE_NOTICE);
      return;
    }
    this.display.renderTo(
      ctx,
      this.memory.screenRam,
      this.memory.charGen,
      this.memory.charGenRam,
    );
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.keyboard.handleEvent(e, down);
  }

  setKey(token: string, down: boolean): void {
    this.keyboard.setKey(token, down);
  }

  releaseAllKeys(): void {
    this.keyboard.releaseAll();
  }

  /**
   * Whether the program this machine was handed is still running.
   *
   * Read from the interpreter's own state rather than from the screen: it keeps
   * the line it is executing in {@link CURLIN} and puts the direct-mode marker
   * back on every route to the prompt - running off the end, END, STOP, an
   * error, and the user's own interrupt key all arrive there. The latch narrows
   * that to the run the IDE started, per the seam's contract, so a RUN the user
   * types afterwards is not reported.
   */
  isProgramRunning(): boolean | null {
    if (!this.hasRom || this.disposed) return null;
    return this.runLatch.read(this.runStarted);
  }

  /**
   * Called on every write to {@link CURLIN}: a line number going in means the
   * program is executing, and the direct-mode marker going back means this run
   * is over. Only a run that was seen to start can end, so the keystrokes that
   * type RUN - during which the interpreter is legitimately in direct mode -
   * are not mistaken for the program finishing before it began.
   */
  private noteRunState(): void {
    if (this.memory.peek(CURLIN + 1) !== DIRECT_MODE_HIGH)
      this.runStarted = true;
    else if (this.runStarted) this.runLatch.stopped();
  }

  /**
   * The BASIC line the interpreter is executing, or null when it is not
   * executing one.
   *
   * {@link CURLIN} is the interpreter's own answer - the Microsoft convention,
   * written as it moves from line to line - so this is a read rather than a
   * derivation. Anything outside the line numbers this BASIC accepts (the
   * direct-mode marker included) means "not in a program".
   */
  currentLine(): number | null {
    if (!this.hasRom || this.disposed) return null;
    const line = this.memory.rawReadWord(CURLIN);
    return line >= 1 && line <= MAX_LINE_NUMBER ? line : null;
  }

  /**
   * Run one debug slice: a frame's worth of cycles, stopping early when the
   * interpreter reaches a line the caller wants to pause on.
   *
   * A frame is the unit rather than an instruction because pausing is defined
   * in BASIC lines, not Z80 instructions - stepping stops the moment
   * {@link currentLine} changes, whatever that took.
   */
  debugStep(opts: DebugStepOptions): DebugStepResult {
    return this.loop.debugStep(opts);
  }

  setMemoryActivityRecording(enabled: boolean): void {
    this.memory.activity.enabled = enabled;
    // Drop anything a previous session accumulated so a reopened overlay starts
    // clean rather than flashing stale activity.
    if (!enabled) this.memory.activity.clear();
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    if (!this.memory.activity.enabled) return null;
    return this.memory.activity.drain(recycle);
  }

  setProfileRecording(enabled: boolean): void {
    this.profile.setEnabled(enabled);
  }

  drainProfile(): LineCost[] | null {
    return this.profile.drain();
  }

  /**
   * The screen as text, straight out of screen RAM - there are character codes
   * in it, so nothing has to be matched against a font (see `screenText.ts`).
   */
  readScreenText(): MachineScreenText | null {
    if (!this.hasRom || this.disposed) return null;
    return readSorcererScreenText(this.memory.screenRam);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
    this.runLatch.clear();
  }

  /** Direct access for tests and debugging. */
  get mem(): SorcererMemory {
    return this.memory;
  }

  get screen(): SorcererDisplay {
    return this.display;
  }

  get processor(): Z80Core {
    return this.cpu;
  }

  /**
   * Type a line and submit it, holding each key for a few frames the way a
   * finger would. The firmware reads the keyboard by walking the matrix a line
   * at a time from its command loop, so a key pressed and released between two
   * of those walks would never be seen at all.
   *
   * SHIFT LOCK is held down for the whole line, which is what typing upper case
   * on this machine means: the Sorcerer had lower case as standard and its
   * unshifted alphabet is the lower one, while the interpreter's reserved words
   * are upper case only - so an unshifted `run` is a syntax error rather than a
   * command. SHIFT LOCK rather than SHIFT because it is the alphabet alone that
   * has to change case: this keyboard's shifted digits are punctuation, so a
   * held SHIFT would turn `RUN 81` into `RUN (!`. On the machine the key is a
   * mechanically latching one, so holding it down *is* locking it.
   */
  private type(line: string): void {
    this.settle();
    this.keyboard.setKey('ShiftLock', true);
    for (const ch of line) {
      const key = TYPING_KEYS[ch.toUpperCase()];
      if (!key) continue;
      this.tapKeys(key);
    }
    this.tapKeys(['Enter']);
    this.keyboard.setKey('ShiftLock', false);
  }

  /** Leave the matrix empty for long enough that the next key is a new one. */
  private settle(): void {
    for (let i = 0; i < KEY_SETTLE_FRAMES; i++) this.runFrame();
  }

  /** Press a combination, hold it, release it, and leave a gap after it. */
  private tapKeys(tokens: readonly string[]): void {
    for (const token of tokens) this.keyboard.setKey(token, true);
    for (let i = 0; i < KEY_HOLD_FRAMES; i++) this.runFrame();
    for (const token of tokens) this.keyboard.setKey(token, false);
    for (let i = 0; i < KEY_GAP_FRAMES; i++) this.runFrame();
  }

  /**
   * The I/O map, as far as this machine models it.
   *
   * Four ports, all at the top of the space: the UART's data and status
   * registers, the control port that carries the keyboard and the cassette
   * selects, and the parallel port. Everything else reads as an undriven bus.
   *
   * The UART's status is the one to get right at this stage. Both ROMs wait on
   * its transmitter-ready bit before sending a byte and on its data-available
   * bit before taking one, so the idle value has to let every send through and
   * hold every receive - a status that claimed a byte had arrived would have
   * the Monitor decode a tape record that is not there.
   */
  private readPort(port: number): number {
    switch (port) {
      case PORT_DATA:
        // The UART's receiver, which nothing has yet put a byte into.
        return 0x00;
      case PORT_STATUS:
        return UART_STATUS_IDLE;
      case PORT_CONTROL:
        return (
          this.keyboard.readLine(this.keyboardLine) |
          (this.inVerticalBlanking ? 0 : CONTROL_VSYNC) |
          CONTROL_HANDSHAKE
        );
      case PORT_PARALLEL:
        return PARALLEL_IDLE;
      default:
        return 0xff;
    }
  }

  /**
   * The control port's low nibble selects a keyboard line. Its high nibble
   * drives the two cassette motors, the baud rate and the choice between
   * cassette and RS-232 - and the Monitor clears the RS-232 bit on every
   * keyboard scan, which is why the real machine cannot drive a terminal from
   * the Monitor at all.
   *
   * The other three ports take bytes this machine has nowhere to send: the
   * UART's transmitter and its mode register, and the parallel port, where a
   * printer or a speaker hung.
   */
  private writePort(port: number, value: number): void {
    if (port === PORT_CONTROL) this.keyboardLine = value & KEYBOARD_LINE_MASK;
  }

  /** Whether the beam is below the visible 240 lines of the frame. */
  private get inVerticalBlanking(): boolean {
    return this.frameCycles >= VBLANK_START_CYCLES;
  }

  /**
   * Execute one instruction, and charge what it took to the BASIC line that ran
   * it. Returns the cycles consumed.
   *
   * This is the machine loop's step, so a frame and a debug slice charge the
   * profile identically. That matters both ways round: a debug session is
   * opened by an ordinary press of Play on every dialect that models line
   * debugging, so a charge made only on the plain path would miss the way
   * programs are usually run - and a run the IDE performs to check an
   * assistant's answer deliberately opens no session, so a charge made only on
   * the debug path would miss that one.
   */
  private stepInstruction(): number {
    const t = this.cpu.run_instruction();
    const p = this.profile;
    if (p.enabled) {
      p.pending += t;
      if (p.pending >= p.slice) p.sample(this.currentLine());
    }
    return t;
  }

  private runUntil(done: () => boolean, failure: string): void {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (done()) return;
    }
    throw new Error(
      `Sorcerer ${failure} - the image at public/roms/sorcerer/sorcerer.rom is ` +
        'not the Monitor + Standard BASIC ROM PAC + character generator set ' +
        'this dialect expects',
    );
  }
}

/**
 * Keyboard tokens for the characters {@link SorcererMachine.type} can produce.
 *
 * Every one of them is a single unshifted key, because SHIFT LOCK is already
 * held for the line and this machine's shift layer is punctuation rather than
 * case - see {@link SorcererMachine.type}.
 */
const TYPING_KEYS: Readonly<Record<string, readonly string[]>> = {
  ' ': ['Space'],
  ...Object.fromEntries(
    [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => [c, [`Key${c}`]]),
  ),
  ...Object.fromEntries([...'0123456789'].map((c) => [c, [`Digit${c}`]])),
};
