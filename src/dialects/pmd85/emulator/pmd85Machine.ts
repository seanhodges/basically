// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core } from '../../../emulator/z80/z80core.js';
import { Intel8080 } from '../../../emulator/i8080';
import { ProgramEndLatch } from '../../../emulator/programEndLatch';
import {
  LineCostRecorder,
  PROFILE_SLICE_CYCLES,
} from '../../../emulator/lineCostRecorder';
import type { GlyphSignatures } from '../../../emulator/fontMatcher';
import type {
  DebugStepOptions,
  DebugStepResult,
  LineCost,
  MachineEmulator,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  MachineVariable,
  MemoryBlock,
  TapeFile,
} from '../../types';
import { basicImagePointers } from '../basicImage';
import {
  CURLIN,
  DIRECT_MODE,
  MAX_LINE_NUMBER,
  PROGRAM_BASE,
  STACK_TOP,
  STREND,
  TXTTAB,
  VARTAB,
} from '../addresses';
import { pmd85FontSignatures, readPmd85ScreenText } from './screenText';
import { readPmd85Variables } from '../vars';
import { readPmd85Report } from '../reports';
import {
  BLINK_FRAMES,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  Pmd85Display,
} from './display';
import { Pmd85Keyboard } from './keyboard';
import { Pmd85Memory } from './memory';
import { Pmd85RomModule } from './romModule';

/** The MHB8080A's clock: an 18.432 MHz crystal divided by nine. */
export const CPU_HZ = 18_432_000 / 9;

/** Cycles of 8080 time per displayed frame. */
export const CYCLES_PER_FRAME = CPU_HZ / 50;

/**
 * The PMD 85's I/O map, which decodes an address rather than comparing it.
 *
 * A port is matched on bits 2-3 (which board) and bit 7 (which half of it), so
 * every device answers on eight addresses rather than four. The Monitor and
 * BASIC-G both use the 0xF0-0xFB end of that, and those are the spellings the
 * constants below carry.
 */
const BOARD_MASK = 0x0c;
const BOARD_MOTHERBOARD = 0x04; // 1xxx01aa - keyboard, speaker, LEDs
const BOARD_ROM_MODULE = 0x08; // 1xxx10aa - the ROM module's 8255
const BOARD_IO = 0x0c; // 0xxx11aa - the expansion board's four chips
const PORT_HIGH_HALF = 0x80;

/** Which chip on the expansion board, from bits 4-6: the 8251 is 000111aa. */
const IO_DEVICE_MASK = 0x70;
const IO_USART = 0x10;

/**
 * What the 8251's status register reads as with the tape stopped: transmitter
 * ready and empty, receiver holding nothing.
 *
 * This is the one register of the expansion board the machine cannot do
 * without, and not for the reason the board exists. The Monitor's keyboard
 * routine checks the USART's RxRDY bit between matrix rows so that a byte
 * arriving on the serial line pre-empts the scan, and takes RxRDY set as "stop
 * scanning, a character is already here". An unfitted board floats every bit
 * high, so a machine modelled without a USART reads a character that never
 * arrives, abandons the scan after row 0 and never sees a key pressed - which
 * looks exactly like a broken keyboard matrix and is not one.
 */
const USART_STATUS_IDLE = 0x05;

/**
 * How long each stage of the boot is given before it is called a failure.
 * Generous: the slowest of them is BASIC-G's cold start, which sizes and clears
 * the RAM between its own end and the top of string space.
 */
const MAX_BOOT_FRAMES = 400;

/**
 * Shown on screen when the machine is constructed without its ROM pair. That is
 * a designed state rather than a failure, but a rare one: the images ship with
 * the build, and one that fails to load keeps the machine out of the picker
 * with an offer to supply another. See {@link Pmd85Display.drawNotice} for why
 * this is drawn in the host's font.
 */
const NO_FIRMWARE_NOTICE = [
  'NO ROM IMAGE.',
  '',
  'The PMD 85 needs two: Monitor 2 and the BASIC-G ROM module,',
  'concatenated. Supply them at public/roms/pmd85.rom, or install',
  'your own image from Settings.',
];

/** Frames a key is held, and then left released, when the machine types to itself. */
const KEY_HOLD_FRAMES = 3;
const KEY_GAP_FRAMES = 3;

/**
 * The PMD 85-2 as a {@link MachineEmulator}: an 8080 bus driven by the vendored
 * Z80 core in `src/emulator/z80/`, which executes 8080 object code directly.
 *
 * The two 8080/Z80 flag divergences - the P flag, which the 8080 always fills
 * with parity where the Z80 fills it with signed overflow, and DAA, which the
 * 8080 applies as if for an addition because it has no N flag - are corrected by
 * {@link Intel8080}, shared with the Altair. The vendored core itself is never
 * edited: six shipped Z80 machines depend on it.
 *
 * **Booting is a two-ROM affair.** Out of reset the CPU finds the Monitor
 * mirrored at 0x0000 (see `memory.ts`), and its third instruction - the first
 * I/O write of the machine's life - drops that mirror. The Monitor then reads
 * the first thirteen bytes of the ROM Module through an 8255 into a scratch
 * corner of video RAM, and jumps to them if the first is 0xCD. On a BASIC-G
 * module it is: those thirteen bytes are `CALL 8C00h` with the parameters that
 * copy the interpreter down to 0x0000, followed by `JP 0000h`. So the machine
 * that ends up running BASIC has never executed a byte from the module - only a
 * copy of it in RAM.
 */
export class Pmd85Machine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;

  /**
   * `monitor` is the 4K Monitor ROM and `romModule` the BASIC-G module; they
   * arrive concatenated in the dialect's single ROM image and are split apart
   * before construction, the way the 128K Spectrum carries its two halves.
   */
  private readonly memory: Pmd85Memory;
  private readonly romModule: Pmd85RomModule;
  private readonly keyboard = new Pmd85Keyboard();
  private readonly display = new Pmd85Display();
  private readonly cpu: Z80Core;
  /** The CPU driven with 8080 rather than Z80 flag semantics. */
  private readonly i8080: Intel8080;
  /** Run state, latched from BASIC-G's own current-line word (see {@link CURLIN}). */
  private readonly runLatch = new ProgramEndLatch();
  /** Whether the interpreter has been seen executing a line of the loaded program. */
  private runStarted = false;
  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for a whole run, and the CPU step charges the cycles it consumes to
   * whichever line {@link currentLine} names at the time. Memory is charged the
   * same way, from the interpreter's own in-use figure at each change of line.
   */
  private readonly profile = new LineCostRecorder(
    PROFILE_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );
  /** The Monitor's character generator, indexed by glyph shape on first use. */
  private fontSigs: GlyphSignatures | null = null;
  /** Whether both ROM images arrived; see {@link hasFirmware}. */
  private readonly firmware: boolean;

  /**
   * The motherboard 8255's two output latches. Port A selects a keyboard row;
   * port C's low nibble drives the speaker (bit 2) and an LED (bit 3), and its
   * high nibble is an input the machine has nothing wired to.
   */
  private keyboardRowSelect = 0;
  private systemPortC = 0;
  /**
   * How many times the firmware has read the key matrix. Counted because it is
   * the only signal this machine gives that it is *waiting* rather than busy -
   * see {@link bootToReady}.
   */
  private keyboardScans = 0;

  /**
   * Cycles the previous frame overran its budget by, owed back to this one. An
   * instruction cannot be cut in half at a frame boundary, so a frame always
   * ends a few cycles late; discarding that gains time every frame.
   */
  private debt = 0;
  private frames = 0;
  private disposed = false;

  constructor(opts: { monitor: Uint8Array; romModule: Uint8Array }) {
    this.firmware = opts.monitor.length > 0 && opts.romModule.length > 0;
    this.memory = new Pmd85Memory(opts.monitor);
    this.romModule = new Pmd85RomModule(opts.romModule);
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
    this.i8080 = new Intel8080(this.cpu, this.memory.read);
    this.reset();
  }

  /**
   * True once both images are present.
   *
   * The pair ships with the build and `fetchRom` rejects an image that is not
   * exactly the declared size, so in the app a machine without firmware is a
   * machine the picker never offered - the emulator pane says so, with the offer
   * to supply one, before anything is constructed. The machine stays
   * constructible anyway rather than throwing: it runs no CPU, and says what is
   * missing on its screen (see {@link NO_FIRMWARE_NOTICE}).
   */
  get hasFirmware(): boolean {
    return this.firmware;
  }

  reset(): void {
    this.memory.reset();
    this.romModule.reset();
    this.keyboard.releaseAll();
    this.keyboardRowSelect = 0;
    this.systemPortC = 0;
    this.keyboardScans = 0;
    this.debt = 0;
    this.frames = 0;
    this.runStarted = false;
    this.runLatch.clear();
    this.cpu.reset();
  }

  runFrame(): void {
    if (!this.hasFirmware) return;
    this.frames++;
    this.runCycles(CYCLES_PER_FRAME);
  }

  /**
   * Boot to the BASIC-G prompt, drop the tokenized program into RAM, fix the
   * interpreter pointers that describe it, and type RUN.
   *
   * `image` is the bare program bytes the tokenizer produced - there is no
   * container to unwrap, because BASIC-G's program area is plain RAM with no
   * load address or length in front of it (see `basicImage.ts`).
   *
   * RUN is typed at the emulated keyboard rather than jumped to: it is RUN that
   * sets up the variable, array and string pointers from the program that is
   * now in place, and nothing here knows how to do that on the interpreter's
   * behalf. That is the same call the Altair, the TRS-80 and the Sinclair
   * machines make. `autoStart` becomes RUN's line-number argument, which
   * BASIC-G takes the same way the Microsoft BASICs it descends from do.
   */
  loadProgram(
    image: Uint8Array,
    opts?: {
      blocks?: readonly MemoryBlock[];
      autoStart?: number | null;
      tapeFiles?: readonly TapeFile[];
      bootDisc?: Uint8Array;
    },
  ): void {
    this.reset();
    if (!this.hasFirmware) return;
    this.bootToReady();

    for (let i = 0; i < image.length; i++) {
      this.memory.write(PROGRAM_BASE + i, image[i]!);
    }
    // Bytes alone are only half a load: BASIC-G finds the end of the program,
    // and so where its variables start, through the workspace words
    // basicImagePointers() derives from the image.
    for (const pointer of basicImagePointers(image)) {
      this.memory.writeWord(pointer.address, pointer.value);
    }

    // Memory blocks (machine code or data at a fixed address alongside the
    // BASIC program - see MemoryBlock) go in once the program and its pointers
    // are in place and before RUN starts it, mirroring how a real loader poked
    // code in after the tape had finished.
    for (const block of opts?.blocks ?? []) {
      for (let i = 0; i < block.bytes.length; i++) {
        this.memory.write((block.address + i) & 0xffff, block.bytes[i]!);
      }
    }

    // Armed before the keystrokes that start the program rather than after
    // them: a program short enough to finish inside the frames those keystrokes
    // pump would otherwise end before anything was watching for it.
    this.runStarted = false;
    this.runLatch.arm();
    const autoStart = opts?.autoStart;
    this.type(typeof autoStart === 'number' ? `RUN ${autoStart}` : 'RUN');
  }

  /**
   * Run from reset to the point where BASIC-G is waiting for a command.
   *
   * Public because a caller may want the machine at its prompt without a
   * program - the emulator pane opens there, and anything that types at the
   * keyboard needs the interpreter listening before the first key goes down.
   *
   * Two signals, in order, because neither alone says "ready":
   *
   *  1. **VARTAB is set.** It is workspace RAM, so it holds zero from reset
   *     until BASIC-G's cold start writes the end of an empty program into it.
   *     That is the last thing the cold start does before its sign-on.
   *  2. **The key matrix has been read since.** The interpreter reads it only
   *     from its command loop, so the first scan after the cold start is the
   *     interpreter saying it has nothing else to do. Waiting for behaviour
   *     rather than counting frames is what makes this exact rather than
   *     approximately long enough.
   */
  bootToReady(): void {
    if (!this.hasFirmware) return;
    this.runUntil(
      () => this.memory.readWord(VARTAB) !== 0,
      'never cold-started BASIC-G',
    );
    const scans = this.keyboardScans;
    this.runUntil(
      () => this.keyboardScans > scans,
      'never reached the BASIC-G prompt',
    );
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.hasFirmware) {
      this.display.drawNotice(ctx, NO_FIRMWARE_NOTICE);
      return;
    }
    this.display.renderTo(ctx, this.memory.videoRam, this.blinkOn);
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
   * Read from the interpreter's own state rather than from the screen: BASIC-G
   * keeps the line it is executing in {@link CURLIN} and puts {@link
   * DIRECT_MODE} back on every route to the prompt - running off the end, END,
   * STOP, an error, and the user's own STOP key all arrive there. The latch
   * narrows that to the run the IDE started, per the seam's contract, so a RUN
   * the user types afterwards is not reported.
   */
  isProgramRunning(): boolean | null {
    if (!this.hasFirmware || this.disposed) return null;
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
    if (this.memory.readWord(CURLIN) !== DIRECT_MODE) this.runStarted = true;
    else if (this.runStarted) this.runLatch.stopped();
  }

  /**
   * The BASIC line BASIC-G is executing, or null when it is not executing one.
   *
   * {@link CURLIN} is the interpreter's own answer - the Microsoft convention,
   * written as it moves from line to line - so this is a read rather than a
   * derivation. Anything outside the line numbers BASIC-G accepts (the direct
   * mode marker included) means "not in a program".
   */
  currentLine(): number | null {
    if (!this.hasFirmware || this.disposed) return null;
    const line = this.memory.readWord(CURLIN);
    return line >= 1 && line <= MAX_LINE_NUMBER ? line : null;
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
    if (!this.hasFirmware) return { paused: false, line: null };
    let cycles = this.debt;
    // In run mode, ignore breakpoints until execution has left the line we
    // resumed from, so Continue off a breakpointed line does not re-trigger on
    // the spot but still re-pauses when the loop comes back around.
    let armed = opts.fromLine === null;
    while (cycles < CYCLES_PER_FRAME) {
      if (this.cpu.isHalted()) {
        this.debt = 0;
        return { paused: false, line: this.currentLine() };
      }
      cycles += this.i8080.step();
      const line = this.currentLine();
      if (line === null) continue;
      if (opts.mode === 'step') {
        if (opts.fromLine === null || line !== opts.fromLine) {
          this.debt = 0; // pausing abandons the rest of the slice
          return { paused: true, line };
        }
      } else {
        if (!armed && line !== opts.fromLine) armed = true;
        if (armed && opts.breakpoints.has(line)) {
          this.debt = 0;
          return { paused: true, line };
        }
      }
    }
    this.debt = cycles - CYCLES_PER_FRAME;
    return { paused: false, line: this.currentLine() };
  }

  /**
   * BASIC-G's own memory arithmetic over its own pointers.
   *
   * Program text, variables and arrays share one run upwards from
   * {@link PROGRAM_BASE}, and {@link STREND} is where the last of them ends;
   * everything from there to {@link STACK_TOP} is free. String data is not in
   * either figure - unlike most Microsoft BASICs, BASIC-G keeps its string pool
   * in a region of its own well above the stack, so it neither eats into the
   * program area nor grows down into it.
   *
   * Null until the pointers mean something: they are ordinary workspace RAM and
   * read as zero from reset until the cold start writes them.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (!this.hasFirmware || this.disposed) return null;
    if (this.memory.readWord(TXTTAB) !== PROGRAM_BASE) return null;
    const strend = this.memory.readWord(STREND);
    const used = strend - PROGRAM_BASE;
    const free = STACK_TOP - strend;
    if (used < 0 || free < 0) return null;
    return { used, free };
  }

  setProfileRecording(enabled: boolean): void {
    this.profile.setEnabled(enabled);
  }

  drainProfile(): LineCost[] | null {
    return this.profile.drain();
  }

  /**
   * The screen as text, matched against the Monitor's character generator -
   * there are no characters in video RAM to read, only pixels. See
   * `screenText.ts` for the grid the Monitor draws on.
   */
  readScreenText(): MachineScreenText | null {
    if (!this.hasFirmware || this.disposed) return null;
    this.fontSigs ??= pmd85FontSignatures(this.memory.monitorRom);
    const video = this.memory.videoRam;
    return readPmd85ScreenText(this.fontSigs, (offset) => video[offset] ?? 0);
  }

  /** The BASIC-G variables, decoded from the interpreter's own table (`../vars.ts`). */
  readVariables(): MachineVariable[] {
    if (!this.hasFirmware || this.disposed) return [];
    if (this.memory.readWord(TXTTAB) !== PROGRAM_BASE) return [];
    return readPmd85Variables(this.memory);
  }

  /** The last report BASIC-G printed on its dialogue line (`../reports.ts`). */
  readReport(): MachineReport | null {
    return readPmd85Report(this.readScreenText());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
    this.runLatch.clear();
  }

  /** Direct access for tests and debugging. */
  get mem(): Pmd85Memory {
    return this.memory;
  }

  get module(): Pmd85RomModule {
    return this.romModule;
  }

  get screen(): Pmd85Display {
    return this.display;
  }

  get processor(): Z80Core {
    return this.cpu;
  }

  /**
   * Type a line and submit it, holding each key for a few frames the way a
   * finger would. The interpreter reads the keyboard by walking the matrix a
   * row at a time from its command loop, so a key pressed and released between
   * two of those walks would never be seen at all.
   */
  private type(line: string): void {
    for (const ch of line) {
      const key = TYPING_KEYS[ch.toUpperCase()];
      if (!key) continue;
      this.tapKeys(key);
    }
    this.tapKeys(['Enter']);
  }

  /** Press a combination, hold it, release it, and leave a gap after it. */
  private tapKeys(tokens: readonly string[]): void {
    for (const token of tokens) this.keyboard.setKey(token, true);
    for (let i = 0; i < KEY_HOLD_FRAMES; i++) this.runFrame();
    for (const token of tokens) this.keyboard.setKey(token, false);
    for (let i = 0; i < KEY_GAP_FRAMES; i++) this.runFrame();
  }

  /** Which half of the blink attribute's cycle the frame counter is in. */
  private get blinkOn(): boolean {
    return Math.floor(this.frames / BLINK_FRAMES) % 2 === 0;
  }

  /**
   * The I/O map, as far as this machine models it.
   *
   * The startup configuration answers every port with a floating bus: the
   * decoder holds the peripherals off the bus until the first OUT, which is
   * also the write that drops the memory mirrors, so the two are one event.
   *
   * Of the expansion board only the 8251 answers, and only as an idle one -
   * see {@link USART_STATUS_IDLE} for why the keyboard depends on it. The 8253
   * timer and the two GPIO 8255s are write-only as far as either ROM is
   * concerned, so leaving them off the bus costs nothing until the tape stage
   * needs them.
   */
  private readPort(port: number): number {
    if (this.memory.inStartupMap) return 0xff;
    const board = port & BOARD_MASK;
    if ((port & PORT_HIGH_HALF) === 0) {
      return board === BOARD_IO && (port & IO_DEVICE_MASK) === IO_USART
        ? this.readUsart(port & 0x01)
        : 0xff;
    }
    switch (board) {
      case BOARD_MOTHERBOARD:
        return this.readSystemPpi(port & 0x03);
      case BOARD_ROM_MODULE:
        return this.romModule.readPort(port & 0x03);
      default:
        return 0xff;
    }
  }

  private writePort(port: number, value: number): void {
    // The first I/O write of the machine's life is what drops the startup
    // memory map - there is no bank-select port. See `memory.ts`.
    this.memory.leaveStartupMap();
    if ((port & PORT_HIGH_HALF) === 0) return;
    switch (port & BOARD_MASK) {
      case BOARD_MOTHERBOARD:
        this.writeSystemPpi(port & 0x03, value);
        return;
      case BOARD_ROM_MODULE:
        this.romModule.writePort(port & 0x03, value);
        return;
      default:
        return;
    }
  }

  /**
   * The 8251 with no tape running: A0 picks the data register or the status
   * register, and there is never anything in the first.
   */
  private readUsart(register: number): number {
    return register === 0 ? 0x00 : USART_STATUS_IDLE;
  }

  /**
   * The motherboard 8255, which the Monitor configures once with 0x8A: port A
   * output (the keyboard row number), port B input (that row's keys), port C
   * split - its low nibble an output driving the speaker and an LED, its high
   * nibble an input with nothing wired to it on this model.
   */
  private readSystemPpi(register: number): number {
    switch (register) {
      case 0:
        return this.keyboardRowSelect;
      case 1:
        this.keyboardScans++;
        return this.keyboard.readRow(this.keyboardRowSelect & 0x0f);
      case 2:
        // Output latch below, floating input above.
        return (this.systemPortC & 0x0f) | 0xf0;
      default:
        return 0xff; // the mode register is write-only
    }
  }

  private writeSystemPpi(register: number, value: number): void {
    switch (register) {
      case 0:
        this.keyboardRowSelect = value;
        return;
      case 1:
        return; // port B is an input; the CPU never drives it
      case 2:
        this.systemPortC = value;
        return;
      default:
        // A mode word clears the latches; the bit set/reset form (bit 7 clear)
        // addresses one port C bit, which is how firmware clicks the speaker.
        if (value & 0x80) {
          this.keyboardRowSelect = 0;
          this.systemPortC = 0;
        } else {
          const bit = (value >> 1) & 0x07;
          if (value & 0x01) this.systemPortC |= 1 << bit;
          else this.systemPortC &= ~(1 << bit) & 0xff;
        }
        return;
    }
  }

  private runCycles(budget: number): void {
    let cycles = this.debt;
    while (cycles < budget) {
      // A HALT on this machine is terminal: nothing on the motherboard raises
      // an interrupt, so the CPU would sit there for the rest of the session.
      // End the frame instead, owing nothing for time it was never going to run.
      if (this.cpu.isHalted()) {
        this.debt = 0;
        return;
      }
      const t = this.i8080.step();
      cycles += t;
      // Charge the cycles to the BASIC line executing them. Here rather than in
      // debugStep, because a run the IDE performs to check an assistant's
      // answer opens no debug session and would otherwise go unmeasured.
      const p = this.profile;
      if (p.enabled) {
        p.pending += t;
        if (p.pending >= p.slice) p.sample(this.currentLine());
      }
    }
    this.debt = cycles - budget;
  }

  private runUntil(done: () => boolean, failure: string): void {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (done()) return;
    }
    throw new Error(
      `PMD 85 ${failure} - the image at public/roms/pmd85.rom is not the ` +
        'Monitor 2 + BASIC-G V2.0 pair this dialect expects',
    );
  }
}

/**
 * Keyboard tokens for the characters {@link Pmd85Machine.type} can produce.
 *
 * The letter tokens are DOM `KeyboardEvent.code` names, which are positional,
 * and this keyboard is QWERTZ - so `Y` and `Z` are not where a code name says
 * they are: the key that types `Z` is `KeyY` and the one that types `Y` is
 * `KeyZ`. Everything else lines up.
 */
const TYPING_KEYS: Readonly<Record<string, readonly string[]>> = {
  ' ': ['Space'],
  ...Object.fromEntries(
    [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map((c) => [c, [`Key${c}`]]),
  ),
  Y: ['KeyZ'],
  Z: ['KeyY'],
  ...Object.fromEntries([...'0123456789'].map((c) => [c, [`Digit${c}`]])),
};
