// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core } from '../../../emulator/z80/z80core.js';
import { Intel8080 } from '../../../emulator/i8080';
import type {
  DebugStepOptions,
  DebugStepResult,
  LineCost,
  MachineEmulator,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  MachineVariable,
  Block,
} from '../../types';
import {
  BASIC_FREE_TOP,
  CURLIN,
  MAX_LINE_NUMBER,
  PROGRAM_BASE,
  SENSE_SWITCHES_2SIO,
  SENSE_SWITCH_PORT,
  SIO_DATA_PORT,
  SIO_STATUS_PORT,
  STREND,
  TXTTAB,
} from '../addresses';
import { readAltair8800Report } from '../reports';
import { readAltair8800Variables } from '../vars';
import { basicImagePointers } from '../basicImage';
import { Altair8800Keyboard } from './keyboard';
import { Altair8800Memory } from './memory';
import { Altair8800Serial } from './serial';
import { createMachineLoop } from '../../../emulator/machineLoop';
import { ProgramEndLatch } from '../../../emulator/programEndLatch';
import {
  LineCostRecorder,
  PROFILE_SLICE_CYCLES,
} from '../../../emulator/lineCostRecorder';
import { plainChar } from '../charset';
import {
  Altair8800Terminal,
  COLS as DISPLAY_COLS,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  ROWS as DISPLAY_ROWS,
} from './terminal';
import { loadMicrosoftBasicProgram } from '../../../emulator/microsoftBasicLoad';

const CPU_HZ = 2_000_000;
/**
 * Cycles of 8080 time per frame: 2 MHz / 50. The Altair's 8080A ran at 2 MHz,
 * twice the ZX81's effective rate and a shade over the TRS-80's 1.77 MHz Z80.
 *
 * The 50 here is a scheduling convention, not hardware. The Altair has no video
 * at all - the front panel and a serial terminal are the whole of its output -
 * so nothing on the machine defines a frame; this is only how often the host is
 * given a chance to redraw the terminal.
 */
export const CYCLES_PER_FRAME = CPU_HZ / 50;

/**
 * How long each step of the cold-start dialogue is given before the boot is
 * called a failure. Generous: answering `MEMORY SIZE?` sets off a
 * write-and-read-back walk over every byte of fitted RAM, which is the slowest
 * thing this machine ever does.
 */
const MAX_BOOT_FRAMES = 600;

/**
 * 8K BASIC's cold-start dialogue, and the answers this dialect gives. Each
 * prompt is matched as a substring of a terminal line, so only enough of it to
 * be unambiguous is written out here.
 *
 *  - `MEMORY SIZE?` empty: use all the RAM the sizing walk finds, which is the
 *    48K `addresses.ts` documents and the dialect's `programRamBytes` is quoted
 *    from.
 *  - `TERMINAL WIDTH?` empty: keep the 72-column default, so `PRINT`'s comma
 *    zones land where the manual says they do (the 80-column grid in
 *    `terminal.ts` is the glass, not BASIC's idea of the paper).
 *  - `WANT SIN-COS-TAN-ATN?` yes: keeping the transcendental functions is what
 *    puts TXTTAB at {@link PROGRAM_BASE}, and answering `N` would move the
 *    program 194 bytes down on top of them.
 */
const COLD_START_DIALOGUE: readonly (readonly [
  prompt: string,
  answer: string,
])[] = [
  ['MEMORY SIZE', '\r'],
  ['TERMINAL WIDTH', '\r'],
  ['WANT SIN', 'Y\r'],
];

/** What BASIC prints when it is ready for a command. */
const READY_PROMPT = 'OK';

/**
 * Shown on the terminal when the machine is constructed without a BASIC image.
 * That is a designed state rather than a failure: the bundled tape is
 * deletable, like every other image under `public/roms/`, and a machine with
 * nothing to run has to say so somewhere. (The emulator pane has its own
 * version of this message, where it can be acted on; this one is what the
 * machine itself can say.)
 */
const NO_IMAGE_NOTICE = [
  'NO BASIC IMAGE.',
  '',
  'The Altair had no firmware: it loaded BASIC from paper tape, and',
  'this build has no tape to load - public/roms/altair8800/altair8800.rom is',
  'missing. Restore it, or supply your own image, to start the machine.',
];

/**
 * The Altair 8800 as a {@link MachineEmulator}: a flat S-100 memory bus and an
 * 88-2SIO serial console, driven by the vendored Z80 core in
 * `src/emulator/z80/` executing Intel 8080 object code.
 *
 * **Why the Z80 core.** The Z80 was designed to be binary-compatible with the
 * 8080, so it executes Altair BASIC's object code directly and this project
 * needs no new CPU core. The two flag divergences that survive that
 * compatibility - the P flag, and DAA's missing N - are corrected by
 * {@link Intel8080}, which every 8080 machine here drives its CPU through. They
 * are never corrected by editing the vendored core, which six shipped Z80
 * machines share.
 *
 * **The ROM that isn't.** `opts.rom` carries the Altair 8K BASIC object tape,
 * which the machine copies into RAM at 0x0000 rather than mapping: the base
 * Altair had no firmware, and BASIC arrived on paper tape. The image ships at
 * `public/roms/altair8800/altair8800.rom`, but like every image there it may be deleted or
 * replaced, so the machine stays constructible on an empty one and says so on
 * its terminal rather than throwing.
 */
export class Altair8800Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;

  private readonly interpreter: Uint8Array;
  private readonly memory: Altair8800Memory;
  private readonly terminal = new Altair8800Terminal();
  private readonly serial = new Altair8800Serial(this.terminal);
  private readonly keyboard = new Altair8800Keyboard(this.serial);
  private readonly cpu: Z80Core;
  /** The CPU driven with 8080 rather than Z80 flag semantics. */
  private readonly i8080: Intel8080;
  /** Run state, latched from 8K BASIC's own current-line word ({@link CURLIN}). */
  private readonly runLatch = new ProgramEndLatch();
  /** Whether the interpreter has been seen executing a line of the loaded program. */
  private runStarted = false;
  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the host
   * arms it for a whole run, and the CPU step charges the cycles it consumes to
   * whichever line {@link currentLine} names at the time. Memory is charged the
   * same way, from the interpreter's own in-use figure at each change of line.
   */
  private readonly profile = new LineCostRecorder(
    PROFILE_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );
  /**
   * The frame walk, and the debug slice: the same walk, stopping early on a
   * line. The overrun is carried into the next frame - an instruction cannot be
   * cut in half at a frame boundary, so a frame always ends a few cycles late,
   * and discarding that gains time every frame.
   */
  private readonly loop = createMachineLoop({
    cyclesPerFrame: CYCLES_PER_FRAME,
    // Nothing wakes a HALT on this machine - there is no interrupt source on
    // the base backplane - so end the frame rather than spinning. Nothing is
    // owed for time the CPU was never going to run.
    idleEndsSlice: true,
    ready: () => this.hasInterpreter,
    step: () =>
      this.cpu.isHalted() ? { cycles: 0, idle: true } : this.stepInstruction(),
    currentLine: () => this.currentLine(),
  });
  private disposed = false;

  constructor(opts: { rom: Uint8Array }) {
    this.interpreter = opts.rom;
    this.memory = new Altair8800Memory();
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
        this.writePort(port & 0xff, value),
    });
    this.i8080 = new Intel8080(this.cpu, this.memory.read);
    this.reset();
  }

  /** True once a BASIC image has been supplied for the machine to run. */
  get hasInterpreter(): boolean {
    return this.interpreter.length > 0;
  }

  reset(): void {
    this.memory.loadInterpreter(this.interpreter);
    this.terminal.clear();
    this.serial.clearInput();
    this.keyboard.releaseAll();
    this.runStarted = false;
    this.runLatch.clear();
    this.profile.clear();
    this.cpu.reset();
    if (!this.hasInterpreter) this.showMissingImageNotice();
  }

  runFrame(): void {
    this.loop.runFrame();
  }

  /**
   * Run one debug slice: a frame's worth of cycles, stopping early when the
   * interpreter reaches a line the caller wants to pause on.
   *
   * A frame is the unit rather than an instruction because pausing is defined
   * in BASIC lines, not 8080 instructions - stepping stops the moment
   * {@link currentLine} changes, whatever that took.
   */
  debugStep(opts: DebugStepOptions): DebugStepResult {
    return this.loop.debugStep(opts);
  }

  /**
   * Boot BASIC, poke the tokenized program at TXTTAB, fix the program-end
   * pointers, then type RUN - the authentic path a user would take, and the
   * same shape as the TRS-80's loader. `image` is the bare program bytes (the
   * tokenizer's output, byte for byte as the interpreter stores them).
   */
  loadProgram(image: Uint8Array, opts?: { blocks?: readonly Block[] }): void {
    this.reset();
    if (!this.hasInterpreter) return;
    this.bootToReady();

    loadMicrosoftBasicProgram(this.memory, image, {
      programBase: PROGRAM_BASE,
      pointers: basicImagePointers(image),
      blocks: opts?.blocks,
      typeRun: () => {
        // Armed before the keystrokes rather than after the run: a program
        // short enough to finish inside the frames those keystrokes pump would
        // otherwise end before anything was watching for it.
        this.runStarted = false;
        this.runLatch.arm();
        this.serial.clearInput();
        this.serial.queueText('RUN\r');
      },
    });
  }

  /**
   * Answer the cold-start dialogue and run on to the OK prompt, from a freshly
   * reset machine.
   *
   * Public because booting is not automatic here the way it is on a machine
   * with firmware: left to itself the Altair prints `MEMORY SIZE?` and waits,
   * which is the authentic thing to do and lets the user answer the dialogue by
   * hand, but anything that wants BASIC *ready* - loading a program, or an
   * emulator pane that would rather open at the OK prompt - has to answer it.
   *
   * Each answer is queued only once its own prompt has appeared, rather than
   * all three up front: BASIC polls the console at points of its own choosing
   * while it sizes memory, and a byte waiting at the wrong moment would be read
   * as the answer to a question it had not asked yet.
   */
  bootToReady(): void {
    if (!this.hasInterpreter) return;
    for (const [prompt, answer] of COLD_START_DIALOGUE) {
      this.runUntil(
        () => this.terminal.contains(prompt),
        `did not ask ${prompt}`,
      );
      this.serial.queueText(answer);
    }
    this.runUntil(
      () => this.terminal.contains(READY_PROMPT),
      'did not reach the OK prompt',
    );
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    this.terminal.renderTo(ctx);
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    return this.keyboard.handleEvent(e, down);
  }

  setKey(token: string, down: boolean): void {
    this.keyboard.setToken(token, down);
  }

  releaseAllKeys(): void {
    this.keyboard.releaseAll();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
    this.serial.clearInput();
  }

  /** Direct access for tests and debugging. */
  get mem(): Altair8800Memory {
    return this.memory;
  }

  get console(): Altair8800Terminal {
    return this.terminal;
  }

  get port(): Altair8800Serial {
    return this.serial;
  }

  get processor(): Z80Core {
    return this.cpu;
  }

  /** Read one terminal row back as text (for tests). */
  readScreenRow(row: number): string {
    return this.terminal.readRow(row);
  }

  /**
   * The terminal grid as text, for the assistant's "what is on the screen"
   * question and for `SCREEN CONTAINS` expectations.
   *
   * The easiest screen reader in the project, and the only honest one: there is
   * no video RAM to decode and no character generator to map through, because
   * the grid *is* the text - it was assembled from the bytes BASIC sent down the
   * wire. Rows are padded rather than trimmed, since the seam promises exactly
   * `cols` code points per line.
   */
  readScreenText(): MachineScreenText {
    const lines: string[] = [];
    for (let row = 0; row < DISPLAY_ROWS; row++) {
      let line = '';
      for (let col = 0; col < DISPLAY_COLS; col++) {
        line +=
          plainChar(this.terminal.cells[row * DISPLAY_COLS + col]!) ?? ' ';
      }
      lines.push(line);
    }
    return { lines, cols: DISPLAY_COLS, rows: DISPLAY_ROWS };
  }

  /**
   * The BASIC runtime report, scanned off the terminal - `?SN ERROR IN 100`, or
   * the `OK` prompt when BASIC is idle. See `../reports.ts` for why the grid is
   * the only place to read it and what the scan can and cannot tell apart.
   */
  readReport(): MachineReport | null {
    if (!this.hasInterpreter || this.disposed) return null;
    return readAltair8800Report(this.terminalRows());
  }

  /**
   * Whether a BASIC program is executing, latched from {@link CURLIN}.
   *
   * The interpreter's own answer rather than a reading of the terminal, which
   * is what this used to be: an `OK` as the last thing printed meant "not
   * running", so a program whose final output happened to be `OK` read as
   * finished a moment early, and the gap between the `RUN` keystrokes and BASIC
   * acting on them had to be papered over with the input queue. The line word
   * has neither problem - it is written on the way into every line and put back
   * on every route to the prompt.
   */
  isProgramRunning(): boolean | null {
    if (!this.hasInterpreter || this.disposed) return null;
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
    if (this.currentLine() !== null) this.runStarted = true;
    else if (this.runStarted) this.runLatch.stopped();
  }

  /**
   * The BASIC line 8K BASIC is executing, or null when it is not executing one.
   *
   * {@link CURLIN} is the interpreter's own answer - the Microsoft convention,
   * written as it moves from line to line - so this is a read rather than a
   * derivation. Anything above {@link MAX_LINE_NUMBER} means "not in a
   * program": the direct-mode marker 0xFFFF at the prompt, and 0xFFFE in the untouched
   * tape image, so a machine that has not been booted reads as not running
   * rather than as executing some line near the top of the range.
   *
   * **Zero is a line here**, unlike on the machines whose BASIC numbers from 1:
   * 8K BASIC accepts `0 GOTO 0` and CURLIN reads 0 while it runs, so the test
   * is against the ceiling alone and every caller compares against `null`
   * rather than truthiness. That is also why the workspace has to be checked
   * before the word is believed - the same TXTTAB guard `readMemoryStats` and
   * `readVariables` keep, and load-bearing here rather than merely tidy: CURLIN
   * is plain RAM, so an image that is not 8K BASIC at all leaves it reading a
   * zero this would otherwise report as line 0.
   */
  currentLine(): number | null {
    if (!this.hasInterpreter || this.disposed) return null;
    if (this.memory.rawReadWord(TXTTAB) !== PROGRAM_BASE) return null;
    const line = this.memory.rawReadWord(CURLIN);
    return line <= MAX_LINE_NUMBER ? line : null;
  }

  /**
   * BASIC RAM in use and still free, from the interpreter's own pointers.
   *
   * `used` is TXTTAB to STREND: the program text, then the simple variables and
   * arrays that grow above it. `free` is what is left below
   * {@link BASIC_FREE_TOP}, which is the ceiling BASIC's own `BYTES FREE`
   * counts down from - so on a cold-started machine this reports exactly the
   * figure the sign-on banner printed.
   *
   * String *data* is in neither figure. 8K BASIC allocates it downwards from
   * the top of memory rather than above the arrays, so it comes out of the
   * 50-byte pool above the ceiling (or whatever `CLEAR n` set), not out of the
   * span measured here.
   *
   * Null while the pointers cannot be believed: before the cold-start dialogue
   * has been answered they hold whatever the image was loaded with, which is
   * why TXTTAB is checked against the base this dialect models rather than
   * merely being read.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (!this.hasInterpreter || this.disposed) return null;
    if (this.memory.rawReadWord(TXTTAB) !== PROGRAM_BASE) return null;
    const strend = this.memory.rawReadWord(STREND);
    const used = strend - PROGRAM_BASE;
    const free = BASIC_FREE_TOP - strend;
    if (used < 0 || free < 0) return null;
    return { used, free };
  }

  /**
   * The 8K BASIC variables, decoded from the interpreter's own table
   * (`../vars.ts`, over the walk shared with the PMD 85).
   *
   * Empty rather than wrong until the cold-start dialogue has been answered:
   * the pointers are ordinary workspace RAM holding whatever the tape was
   * loaded with until then, which is the same guard `readMemoryStats` keeps.
   */
  readVariables(): MachineVariable[] {
    if (!this.hasInterpreter || this.disposed) return [];
    if (this.memory.rawReadWord(TXTTAB) !== PROGRAM_BASE) return [];
    return readAltair8800Variables(this.memory);
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

  setProfileRecording(enabled: boolean): void {
    this.profile.setEnabled(enabled);
  }

  drainProfile(): LineCost[] | null {
    return this.profile.drain();
  }

  /**
   * One 8080 instruction, with its cycles charged to the line being executed
   * when the profiler is armed.
   *
   * The sample is taken every {@link PROFILE_SLICE_CYCLES} rather than every
   * instruction: reading {@link CURLIN} costs two bus reads, and on a machine
   * whose instructions are four to seventeen cycles that would be a large
   * fraction of the work of running them.
   */
  private stepInstruction(): number {
    const cycles = this.i8080.step();
    const p = this.profile;
    if (p.enabled) {
      p.pending += cycles;
      if (p.pending >= p.slice) p.sample(this.currentLine());
    }
    return cycles;
  }

  /** The terminal grid as lines, trailing blanks trimmed. */
  private terminalRows(): string[] {
    const rows: string[] = [];
    for (let row = 0; row < DISPLAY_ROWS; row++) {
      rows.push(this.terminal.readRow(row));
    }
    return rows;
  }

  /**
   * The Altair's whole I/O map: the 2SIO console board, and the front-panel
   * sense switches BASIC reads once at cold start to decide which console board
   * it is talking to. Every other port floats high, which is what an S-100 bus
   * with nothing driving it reads as.
   */
  private readPort(port: number): number {
    switch (port) {
      case SIO_STATUS_PORT:
        return this.serial.readStatus();
      case SIO_DATA_PORT:
        return this.serial.readData();
      case SENSE_SWITCH_PORT:
        return SENSE_SWITCHES_2SIO;
      default:
        return 0xff;
    }
  }

  private writePort(port: number, value: number): void {
    switch (port) {
      case SIO_STATUS_PORT:
        this.serial.writeControl(value);
        return;
      case SIO_DATA_PORT:
        this.serial.writeData(value);
        return;
      default:
        return;
    }
  }

  private runUntil(done: () => boolean, failure: string): void {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.loop.runFrame();
      if (done()) return;
    }
    throw new Error(
      `Altair 8K BASIC ${failure} - the image at public/roms/altair8800/altair8800.rom ` +
        'is not the 8K BASIC 4.0 paper tape this dialect expects',
    );
  }

  private showMissingImageNotice(): void {
    for (const line of NO_IMAGE_NOTICE) {
      this.terminal.write(0x0d);
      this.terminal.write(0x0a);
      for (let i = 0; i < line.length; i++) {
        this.terminal.write(line.charCodeAt(i));
      }
    }
  }
}
