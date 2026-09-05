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
  JoystickMode,
  JoystickState,
  LineCost,
  MachineEmulator,
  MachineFileStore,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  MachineVariable,
  Block,
  TapeFile,
} from '../../types';
import { basicImagePointers } from '../basicImage';
import { parseTapeImage, type Pmd85TapeFile } from '../tape';
import {
  CURLIN,
  DIRECT_MODE,
  FRETOP,
  MAX_LINE_NUMBER,
  PROGRAM_BASE,
  STACK_TOP,
  STREND,
  STRING_BASE,
  STRING_TOP,
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
import { CPU_HZ, CYCLES_PER_FRAME } from './clock';
import { Pmd85TapeDeck } from './tape';
import { Speaker, SPEAKER_SAMPLE_RATE } from './speaker';
import { Pmd85Gpio } from './gpio';
import { createMachineLoop } from '../../../emulator/machineLoop';
import { loadMicrosoftBasicProgram } from '../../../emulator/microsoftBasicLoad';

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
const IO_GPIO = 0x40; // 010011aa - the two joystick connectors' 8255

/**
 * What the 8251's status register reads as with nothing on the serial line:
 * transmitter ready and empty, receiver holding nothing.
 *
 * The RxRDY bit is the one the machine cannot get wrong, and not for the reason
 * the board exists. The Monitor's keyboard routine checks it between matrix
 * rows so that a byte arriving on the serial line pre-empts the scan, and takes
 * RxRDY set as "stop scanning, a character is already here". An unfitted board
 * floats every bit high, so a machine modelled without a USART reads a
 * character that never arrives, abandons the scan after row 0 and never sees a
 * key pressed - which looks exactly like a broken keyboard matrix and is not
 * one. The receiver stays empty here whatever the tape is doing, because on
 * this machine the tape does not arrive through the receiver at all - see
 * {@link USART_STATUS_DSR}.
 */
const USART_STATUS_IDLE = 0x05;

/**
 * Bit 7 of the 8251's status register: the DSR pin, and on a PMD 85-2 the whole
 * cassette input.
 *
 * The tape interface board clocks the USART's transmitter from the 8253 but
 * leaves its receive clock unconnected, and wires the read amplifier to DSR
 * instead. So `LOAD` is a software receiver reading this one bit; see
 * `tape.ts`, which is what answers it.
 */
const USART_STATUS_DSR = 0x80;

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
  'concatenated. Supply them at public/roms/pmd85/pmd85.rom, or install',
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
  readonly audioSampleRate = SPEAKER_SAMPLE_RATE;

  /**
   * `monitor` is the 4K Monitor ROM and `romModule` the BASIC-G module; they
   * arrive concatenated in the dialect's single ROM image and are split apart
   * before construction, the way the 128K Spectrum carries its two halves.
   */
  private readonly memory: Pmd85Memory;
  private readonly romModule: Pmd85RomModule;
  private readonly keyboard = new Pmd85Keyboard();
  private readonly display = new Pmd85Display();
  /** The transducer on the motherboard 8255's port C; see `speaker.ts`. */
  private readonly speaker = new Speaker();
  /** The I/O board's GPIO 8255, where a joystick plugs in; see `gpio.ts`. */
  private readonly gpio = new Pmd85Gpio();
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

  private frames = 0;
  /**
   * Frame and debug slice, from one walk over the budget. The overrun is
   * carried into the next frame - an instruction cannot be cut in half at a
   * frame boundary, so a frame always ends a few cycles late, and discarding
   * that gains time every frame.
   *
   * A slice counts as a frame however it ends: the blink attribute is driven
   * off {@link frames}, and a run advanced only by slices would hold every
   * blinking character in whichever half of its cycle the boot left it - lit
   * for good, or invisible for good.
   */
  private readonly loop = createMachineLoop({
    cyclesPerFrame: CYCLES_PER_FRAME,
    // A HALT on this machine is terminal: nothing on the motherboard raises an
    // interrupt, so the CPU would sit there for the rest of the session. End
    // the slice instead, owing nothing for time it was never going to run.
    idleEndsSlice: true,
    ready: () => this.hasFirmware,
    onSliceStart: () => {
      this.frames++;
    },
    step: () =>
      this.cpu.isHalted() ? { cycles: 0, idle: true } : this.stepInstruction(),
    currentLine: () => this.currentLine(),
  });
  private disposed = false;

  /**
   * The cassette, and the CPU time the deck reads itself against. Counted here
   * rather than taken from the frame number because a tape bit is 1707 cycles
   * long and a frame is 40960: sampling the tape once a frame would read every
   * twenty-fourth bit.
   */
  private readonly tape: Pmd85TapeDeck;
  private cycles = 0;

  constructor(opts: {
    monitor: Uint8Array;
    romModule: Uint8Array;
    /**
     * Sink for the files a program saves. The deck keeps each completed `SAVE`
     * or `DSAVE` here and refills the tape from it, which is the whole of this
     * machine's data-file I/O - there is nothing else to trap, because the
     * cassette is the only thing BASIC-G can write to.
     */
    files?: MachineFileStore;
  }) {
    this.tape = new Pmd85TapeDeck(opts.files);
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
    this.speaker.reset();
    this.gpio.reset();
    this.keyboardScans = 0;
    this.loop.reset();
    this.frames = 0;
    this.cycles = 0;
    this.tape.eject();
    this.runStarted = false;
    this.runLatch.clear();
    this.cpu.reset();
  }

  runFrame(): void {
    this.loop.runFrame();
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
      blocks?: readonly Block[];
      autoStart?: number | null;
      tapeFiles?: readonly TapeFile[];
      bootDisc?: Uint8Array;
    },
  ): void {
    this.reset();
    if (!this.hasFirmware) return;
    this.bootToReady();

    loadMicrosoftBasicProgram(this.memory, image, {
      programBase: PROGRAM_BASE,
      pointers: basicImagePointers(image),
      blocks: opts?.blocks,
      typeRun: () => {
        // Extra files off a multi-file tape go on the deck rather than into
        // RAM: what they are for is the program's own `LOAD n`, and that reads
        // a tape. Files a previous run saved join them, so a program can pick
        // up its own data where the last one left it.
        const imported = (opts?.tapeFiles ?? []).flatMap(
          (f) => parseTapeImage(f.tap).files,
        );
        const kept = this.tape.filesFromStore();
        if (imported.length > 0 || kept.length > 0) {
          this.playTape([...imported, ...kept]);
        }

        // Armed before the keystrokes that start the program rather than after
        // them: a program short enough to finish inside the frames those
        // keystrokes pump would otherwise end before anything was watching for
        // it.
        this.runStarted = false;
        this.runLatch.arm();
        const autoStart = opts?.autoStart;
        this.type(typeof autoStart === 'number' ? `RUN ${autoStart}` : 'RUN');
      },
    });
  }

  /**
   * Put a tape in the deck and press play.
   *
   * The machine has no motor control, so the deck simply runs from here on and
   * loops when it reaches the end - which is what makes a `LOAD` that happens
   * some seconds into a program's life find its file rather than the far side
   * of the tape.
   */
  playTape(files: readonly Pmd85TapeFile[]): void {
    this.tape.play(files, this.cycles);
  }

  /** What the machine has written to tape since it was reset. */
  recordedTape(): Uint8Array {
    return this.tape.recorded;
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
      () => this.memory.rawReadWord(VARTAB) !== 0,
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
    if (this.memory.rawReadWord(CURLIN) !== DIRECT_MODE) this.runStarted = true;
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
    const line = this.memory.rawReadWord(CURLIN);
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
    return this.loop.debugStep(opts);
  }

  /**
   * BASIC-G's own memory arithmetic over its own pointers, across both of the
   * pools a program spends.
   *
   * Program text, variables and arrays share one run upwards from
   * {@link PROGRAM_BASE}, and {@link STREND} is where the last of them ends;
   * everything from there to {@link STACK_TOP} is free. Unlike most Microsoft
   * BASICs, string data is not in that run at all - BASIC-G gives strings a
   * region of their own well above the stack, filled downwards from
   * {@link STRING_TOP} as far as {@link FRETOP} has reached.
   *
   * Both are counted, because a program that takes memory usually takes it in
   * strings: a figure spanning the program area alone reads as flat through
   * exactly the churn the memory chart and the profiler's per-line attribution
   * exist to explain. The two pools are disjoint and neither can spill into the
   * other, so `used + free` is a constant - BASIC's whole RAM - while the hard
   * ceiling the program area itself has stays at {@link STACK_TOP}, which is
   * what the dialect's `programRamBytes` promises.
   *
   * Null until the pointers mean something: they are ordinary workspace RAM and
   * read as zero from reset until the cold start writes them. A string pointer
   * outside its own region is not readable either, and leaves the program-area
   * figures to stand alone rather than adding nonsense to them.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (!this.hasFirmware || this.disposed) return null;
    if (this.memory.rawReadWord(TXTTAB) !== PROGRAM_BASE) return null;
    const strend = this.memory.rawReadWord(STREND);
    let used = strend - PROGRAM_BASE;
    let free = STACK_TOP - strend;
    if (used < 0 || free < 0) return null;
    const fretop = this.memory.rawReadWord(FRETOP);
    if (fretop >= STRING_BASE && fretop <= STRING_TOP) {
      used += STRING_TOP - fretop;
      free += fretop - STRING_BASE;
    }
    return { used, free };
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
    if (this.memory.rawReadWord(TXTTAB) !== PROGRAM_BASE) return [];
    return readPmd85Variables(this.memory);
  }

  /** The last report BASIC-G printed on its dialogue line (`../reports.ts`). */
  readReport(): MachineReport | null {
    return readPmd85Report(this.readScreenText());
  }

  /**
   * Point the IDE's controller at the joystick connector (`gpio.ts`).
   *
   * `native` is the only mode: the 4004/482 on the I/O board's GPIO0 is the
   * machine's own stick, and nothing third-party ever became standard enough
   * here to be worth a second.
   */
  setJoystick(_mode: JoystickMode, state: JoystickState): void {
    this.gpio.setJoystick(state);
  }

  /**
   * Transducer samples for the time run since the previous call (`speaker.ts`).
   *
   * Measured in machine cycles rather than frames so that a debugger step, which
   * ends wherever the BASIC line did, contributes exactly the sound it ran for.
   */
  readAudio(): Float32Array {
    return this.speaker.render(this.cycles);
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
   * Of the expansion board, the 8251 and the GPIO 8255 answer: see
   * {@link USART_STATUS_IDLE} for why the keyboard depends on the first and
   * {@link USART_STATUS_DSR} for how the tape arrives through it, and `gpio.ts`
   * for the joystick on the second. The 8253 timer and the IMS-2 8255 are
   * write-only as far as either ROM is concerned - the Monitor sets the timer's
   * counter 1 to the tape's bit rate and never reads it back - so leaving them
   * off the bus costs nothing.
   */
  private readPort(port: number): number {
    if (this.memory.inStartupMap) return 0xff;
    const board = port & BOARD_MASK;
    if ((port & PORT_HIGH_HALF) === 0) {
      if (board !== BOARD_IO) return 0xff;
      switch (port & IO_DEVICE_MASK) {
        case IO_USART:
          return this.readUsart(port & 0x01);
        case IO_GPIO:
          return this.gpio.readPort(port & 0x03);
        default:
          return 0xff;
      }
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
    if ((port & PORT_HIGH_HALF) === 0) {
      // The 8251's data register is the tape. Its control register, and the
      // 8253 the Monitor sets to the tape's bit rate beside it, are write-only
      // to both ROMs and change nothing this machine models.
      if ((port & BOARD_MASK) !== BOARD_IO) return;
      switch (port & IO_DEVICE_MASK) {
        case IO_USART:
          if ((port & 0x01) === 0) this.tape.record(value, this.cycles);
          return;
        case IO_GPIO:
          this.gpio.writePort(port & 0x03, value);
          return;
        default:
          return;
      }
    }
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
   * The 8251: A0 picks the data register or the status register.
   *
   * The data register never holds anything, because nothing this machine models
   * arrives through the USART's receiver - the cassette comes in on the DSR bit
   * of the status register instead, which is where the deck answers.
   */
  private readUsart(register: number): number {
    if (register === 0) return 0x00;
    return (
      USART_STATUS_IDLE | (this.tape.level(this.cycles) ? USART_STATUS_DSR : 0)
    );
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
        this.writePortC(value);
        return;
      default:
        // A mode word clears the latches; the bit set/reset form (bit 7 clear)
        // addresses one port C bit, which is how firmware clicks the speaker.
        if (value & 0x80) {
          this.keyboardRowSelect = 0;
          this.writePortC(0);
        } else {
          const bit = (value >> 1) & 0x07;
          if (value & 0x01) this.writePortC(this.systemPortC | (1 << bit));
          else this.writePortC(this.systemPortC & (~(1 << bit) & 0xff));
        }
        return;
    }
  }

  /**
   * Latch port C and show it to the transducer, which hangs off its low nibble.
   * Both ways of writing the port land here - the whole-byte write and the bit
   * set/reset command - because the firmware uses each for a different sound:
   * `BEEP` writes the byte, the key click flips one bit.
   */
  private writePortC(value: number): void {
    this.systemPortC = value & 0xff;
    this.speaker.write(this.cycles, this.systemPortC);
  }

  /**
   * Execute one instruction, and charge what it took to the BASIC line that
   * ran it. Returns the cycles consumed.
   *
   * This is the machine loop's step, so a frame and a debug slice charge the
   * profile identically. That matters both ways round: a
   * debug session is opened by an ordinary press of Play on every dialect that
   * models line debugging, so a charge made only on the plain path would miss
   * the way programs are usually run - and a run the IDE performs to check an
   * assistant's answer deliberately opens no session, so a charge made only on
   * the debug path would miss that one.
   *
   * The free-running cycle counter moves here for the same reason. The tape
   * deck and the speaker read themselves against it, and a debug slice that
   * advanced the CPU without advancing the counter would stop the tape and
   * hold every note for as long as the session lasted.
   */
  private stepInstruction(): number {
    const t = this.i8080.step();
    this.cycles += t;
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
      `PMD 85 ${failure} - the image at public/roms/pmd85/pmd85.rom is not the ` +
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
