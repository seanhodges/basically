// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// Vendored ESM 6502 core; typed by the sibling ../6502/cpu6502.d.ts.
import { StateMachineCpu } from '../6502/cpu6502.js';
import type { BusInterface } from '../6502/cpu6502.js';
import type {
  Block,
  DebugStepOptions,
  DebugStepResult,
  JoystickMode,
  JoystickState,
  LineCost,
  MachineEmulator,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  MachineVariable,
} from '../../dialects/types';
import {
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  RAM_TOP,
  ROM_BASE,
  TEXT_PAGE1,
  TEXT_PAGE2,
} from '../../dialects/apple2/addresses';
import { createMachineLoop } from '../machineLoop';
import { LineCostRecorder, PROFILE_SLICE_CYCLES } from '../lineCostRecorder';
import { ProgramEndLatch } from '../programEndLatch';
import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../memoryActivityBuffer';
import {
  Apple2Display,
  screenTextLines,
  TEXT_COLS,
  TEXT_PAGE_BYTES,
  textRowAddress,
} from './display';
import { Apple2Keyboard } from './keyboard';
import { Apple2Memory } from './memory';
import { Apple2Paddles } from './paddles';
import { Apple2Speaker, SPEAKER_SAMPLES_PER_FRAME } from './speaker';
import { Apple2SoftSwitches } from './softSwitches';
import { CYCLES_PER_FIELD, FIELD_HZ } from './timing';

/**
 * Everything about this machine that belongs to the BASIC in its ROM sockets
 * rather than to the board.
 *
 * The Apple II and the Apple II Plus are the same hardware with different
 * interpreters fitted, so the emulator is built once and handed one of these.
 * It is an object rather than a variant string on purpose: every member below
 * differs completely between Woz's syntax-table interpreter and Microsoft's
 * token-table one - Integer BASIC grows its program *down* from `HIMEM:` and
 * names its line in `PLINE`, Applesoft grows *up* from `$0801` and names its
 * line in `CURLIN` - so branching on a string here would put both interpreters'
 * workspace knowledge inside the machine. This way each dialect keeps its own.
 *
 * Machine-code blocks are deliberately not part of it: they are plain writes
 * into RAM at addresses the user chose, carry no interpreter knowledge, and the
 * machine lays them down itself.
 */
export interface Apple2BasicSupport {
  /** The machine this interpreter makes, for anything the user is shown. */
  readonly machineName: string;
  /** Where its firmware image lives, named at a user whose copy is wrong. */
  readonly romPath: string;
  /** The interpreter's cold start, typed at the monitor as `<addr>G`. */
  readonly coldEntry: number;
  /**
   * Whether the monitor starts the interpreter out of reset.
   *
   * The Autostart Monitor the II Plus shipped with does; the original one the
   * II shipped with stops at its own `*` prompt and has to be told. An
   * autostart machine must not be typed at: it is already at the interpreter's
   * prompt on the first field, so {@link coldEntry} would be found there and
   * the `<addr>G` left sitting in the keyboard for whatever reads next.
   */
  readonly autostart?: boolean;
  /**
   * The one address every way of finishing with a program arrives at, watched
   * to know a run is over.
   */
  readonly commandLoop: number;
  /** The prompt the interpreter prints at the left margin when it is up. */
  readonly prompt: string;
  /**
   * Write a built image into the interpreter's workspace and fix the pointers
   * that describe it, on a machine already booted to {@link prompt}.
   */
  loadProgram(mem: Apple2Memory, image: Uint8Array): void;
  /** The BASIC line about to execute, or null when none is determinable. */
  currentLine(mem: Apple2Memory): number | null;
  /** What the workspace holds and what is left of it, or null if incoherent. */
  readMemoryStats(mem: Apple2Memory): MachineMemoryStats | null;
  /** The program's variables. Omitted by an interpreter whose table is not yet walked. */
  readVariables?(mem: Apple2Memory): MachineVariable[];
  /** The report the interpreter printed. Omitted where it is not yet read. */
  readReport?(screen: MachineScreenText | null): MachineReport | null;
}

/**
 * Fields the boot dialogue is given before it is called a failure. Generous:
 * the monitor takes one field per character of the command that starts the
 * interpreter, and the cold start clears the screen before it answers.
 */
const MAX_BOOT_FIELDS = 600;

/** Shown when the supplied image carries no firmware to start from. */
function noFirmwareNotice(romPath: string): string[] {
  return [
    'NO FIRMWARE.',
    'THE SUPPLIED IMAGE CARRIES NO MONITOR.',
    'REPLACE IT AT',
    `${romPath.toUpperCase()}.`,
  ];
}

/** A blank text cell, as the machine stores it: space with bit 7 set. */
const BLANK = 0xa0;

/**
 * The Apple II as a {@link MachineEmulator}: the vendored 6502 core in
 * `src/emulator/6502/` on a hand-written bus, alongside the Apple I's, the
 * PET's and the VIC-20's - and shared with the Apple II Plus, which is this
 * machine with the other BASIC in its sockets (see {@link Apple2BasicSupport}).
 *
 * Almost all of the machine is in the ROM window, which arrives as one image
 * covering `$D000`-`$FFFF`. What is modelled as logic instead is the handful of
 * things that are wires rather than code: the I/O page's switches
 * (`memory.ts`), the keyboard's encoder (`keyboard.ts`), the speaker's
 * flip-flop (`speaker.ts`), the game connector's timers (`paddles.ts`) and the
 * video counter chain that turns RAM into a picture (`display.ts`). None of
 * those is CPU-addressable as data, so none of them can be loaded from a file.
 *
 * The machine therefore stays constructible with an empty image and says so on
 * its own screen rather than throwing, the way the Apple I and the Altair do.
 *
 * ### Getting a program into it
 *
 * The authentic route is cassette, and this is not it. {@link loadProgram}
 * boots the interpreter the way an owner would - `E000G` typed at the monitor's
 * `*` prompt on the machine whose RESET lands there, and nothing at all on the
 * one whose Autostart Monitor has already done it - and then writes the program
 * straight into the workspace and fixes the pointers that describe it, which is
 * exactly the state a completed `LOAD` leaves behind. Typing a listing in
 * instead would cost a field per character.
 *
 * ### 48K, whatever it is asked for
 *
 * `Dialect.createEmulator` offers a `ramKb` of 16, 32 or 64 and none of them is
 * this machine: the board takes three banks of 16K and a full one is 48K, with
 * the space above it spoken for by the I/O page and the ROM sockets. So the
 * argument is ignored, as it is on the Apple I.
 */
export class Apple2Machine implements MachineEmulator {
  readonly frameHz = FIELD_HZ;
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;
  readonly audioSampleRate = SPEAKER_SAMPLES_PER_FRAME * FIELD_HZ;

  /** Whether the image carries firmware the machine can reset into. */
  readonly hasFirmware: boolean;

  private readonly firmware: Uint8Array;
  private readonly basic: Apple2BasicSupport;
  private readonly switches = new Apple2SoftSwitches();
  private readonly display = new Apple2Display();
  private readonly speaker = new Apple2Speaker();
  private readonly paddles = new Apple2Paddles();
  private readonly keyboard: Apple2Keyboard;
  private readonly memory: Apple2Memory;
  private readonly cpu: StateMachineCpu;

  /**
   * The character in the keyboard's latch, bit 7 the strobe. Held here rather
   * than in {@link Apple2Keyboard} because it is the board's latch: the encoder
   * sends a character and forgets it.
   */
  private keyLatch = 0;
  /**
   * Free-running cycle count since the last power-on. The paddles time their
   * one-shots against it, so it must not restart at a frame boundary.
   */
  private cycles = 0;
  /** Cycle position within the slice being stepped, for the speaker's timeline. */
  private sliceCycle = 0;

  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the step
   * charges the cycle it runs to the line executing at the time, plus whatever
   * the workspace figure moved by while that line was executing.
   */
  private readonly profile = new LineCostRecorder(
    PROFILE_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );
  /**
   * The live memory-activity overlay's touched-address set. Off by default, so
   * a closed overlay costs one not-taken branch per bus access.
   */
  private readonly memoryActivity = new MemoryActivityBuffer(0x10000);
  /**
   * Latched from the interpreter's command loop, which is where it lands when
   * it has finished with a program - see {@link Apple2BasicSupport.commandLoop}.
   */
  private readonly runLatch = new ProgramEndLatch();
  private disposed = false;

  /**
   * The frame walk and the debug slice from one contract. The core is ticked a
   * clock at a time, so the line watch runs on {@link PROFILE_SLICE_CYCLES}
   * rather than after every tick.
   *
   * Everything a frame owes around the CPU is here rather than in `runFrame`,
   * because a debug session opens on any press of Play and a slice owes all of
   * it too: the keyboard is fed at the top, and at the bottom the video field
   * ends - which is what advances the flashing-text phase and REPT's repeat
   * rate - so a stepped machine flashes and repeats exactly as a free-running
   * one does.
   */
  private readonly loop = createMachineLoop({
    cyclesPerFrame: CYCLES_PER_FIELD,
    lineWatchCycles: PROFILE_SLICE_CYCLES,
    ready: () => this.hasFirmware && !this.disposed,
    onSliceStart: () => this.feedKeyboard(),
    step: (elapsed) => {
      this.sliceCycle = elapsed;
      this.tick();
      return 1;
    },
    onSliceEnd: () => this.endField(),
    currentLine: () => this.currentLine(),
  });

  constructor(opts: { rom: Uint8Array; basic: Apple2BasicSupport }) {
    this.firmware = opts.rom;
    this.basic = opts.basic;
    // Read once here rather than on every ask: without a reset vector there is
    // nothing to start, and `ready` consults this every slice.
    this.hasFirmware = hasResetVector(opts.rom);
    this.keyboard = new Apple2Keyboard({ reset: () => this.pressReset() });
    this.memory = new Apple2Memory({
      readKeyboard: () => this.keyLatch,
      clearKeyStrobe: () => {
        this.keyLatch &= 0x7f;
      },
      toggleSpeaker: () => this.speaker.toggle(this.sliceCycle),
      displaySwitch: (address) => {
        if (Apple2SoftSwitches.owns(address)) this.switches.access(address);
      },
      readInput: (address) => this.paddles.read(address, this.cycles),
      triggerPaddles: () => this.paddles.trigger(this.cycles),
    });
    this.cpu = new StateMachineCpu(this.recordingBus());
    this.reset();
  }

  /** Power-on: RAM cleared, firmware laid out, everything back to reset state. */
  reset(): void {
    this.memory.loadFirmware(this.firmware);
    this.blankTextPages();
    this.switches.reset();
    this.display.reset();
    this.speaker.reset();
    this.paddles.reset();
    this.keyboard.releaseAll();
    // A power cycle abandons the loader's command too, which `releaseAll`
    // deliberately does not: there is no machine left for it to be typed at.
    this.keyboard.clearInput();
    this.keyLatch = 0;
    this.cycles = 0;
    this.sliceCycle = 0;
    this.runLatch.clear();
    this.loop.reset();
    this.cpu.reset();
    if (!this.hasFirmware)
      this.printNotice(noFirmwareNotice(this.basic.romPath));
  }

  /**
   * The RESET key. Unlike {@link reset} it is not a power cycle: it pulses the
   * CPU's reset line and nothing else, so RAM - the program in it included -
   * survives. Where it lands is the monitor's decision, not this method's: with
   * the original monitor fitted it stops at the `*` prompt, which is how an
   * owner escaped a runaway program and typed `E2B3G` to get back to BASIC with
   * their listing intact, while the Autostart Monitor re-enters the interpreter
   * itself and comes straight back to `]` with the listing still there.
   */
  pressReset(): void {
    this.keyboard.clearInput();
    this.keyLatch = 0;
    this.cpu.reset();
  }

  runFrame(): void {
    this.loop.runFrame();
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    return this.loop.debugStep(opts);
  }

  /**
   * Boot the interpreter and hand it the program.
   *
   * Blocks go in after the interpreter is up and before `RUN` starts anything:
   * the cold start walks its own workspace, so a block written before it would
   * be walked over.
   */
  loadProgram(image: Uint8Array, opts?: { blocks?: readonly Block[] }): void {
    this.reset();
    if (!this.hasFirmware) return;
    this.bootToBasic();

    for (const block of opts?.blocks ?? []) {
      for (let i = 0; i < block.bytes.length; i++) {
        const address = (block.address + i) & 0xffff;
        if (address <= RAM_TOP)
          this.memory.mem[address] = block.bytes[i]! & 0xff;
      }
    }

    this.basic.loadProgram(this.memory, image);

    // Armed before the program is started rather than after, so a program that
    // ends inside the same field the `RUN` is read in still latches its end.
    this.runLatch.arm();
    this.keyboard.clearInput();
    this.keyboard.type('RUN\r');
  }

  /**
   * Run a freshly reset machine on to the interpreter's prompt, answering the
   * monitor's `*` with the entry point first where the monitor waits to be
   * asked.
   *
   * Public because starting BASIC is not automatic on a machine with the
   * original monitor: left alone it stops at `*`, which is the authentic thing
   * to do and lets the user drive the monitor by hand, but anything that wants
   * the interpreter *up* has to type the entry point at it as an owner would.
   * An {@link Apple2BasicSupport.autostart} machine is not typed at at all -
   * its monitor has already run the cold start, so the prompt is on the screen
   * within a field or two and a queued `<addr>G` would only be read by whatever
   * ran next.
   */
  bootToBasic(): void {
    if (!this.hasFirmware) return;
    this.keyboard.clearInput();
    if (!this.basic.autostart) {
      this.keyboard.type(
        `${this.basic.coldEntry.toString(16).toUpperCase()}G\r`,
      );
    }
    for (let field = 0; field < MAX_BOOT_FIELDS; field++) {
      this.loop.runFrame();
      if (this.atBasicPrompt()) {
        // These fields ran without the host reading a sample off them, so the
        // beep the monitor's reset makes is a sound nobody was listening to.
        // Left on the timeline it would replay, all at once, into the first
        // field of the program's own audio.
        this.speaker.reset();
        return;
      }
    }
    throw new Error(
      `${this.basic.machineName}: BASIC did not reach its prompt - the image ` +
        `at ${this.basic.romPath} is not the firmware this dialect expects`,
    );
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    this.display.renderTo(ctx, this.memory.mem, this.switches.mode);
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

  /**
   * The on-screen controller, on the game connector this machine actually has.
   *
   * Two paddles make a stick: paddle 0 is the horizontal axis and paddle 1 the
   * vertical, each driven to one end of its travel or left at rest in the
   * middle, which is what `PDL(0)` and `PDL(1)` then read back. The two fire
   * buttons are the connector's first two, at `$C061` and `$C062`.
   */
  setJoystick(_mode: JoystickMode, state: JoystickState): void {
    this.paddles.setPaddle(0, axis(state.left, state.right));
    this.paddles.setPaddle(1, axis(state.up, state.down));
    this.paddles.setButton(0, state.fire1);
    this.paddles.setButton(1, state.fire2);
  }

  /** One field of speaker samples, replayed from the toggles it recorded. */
  readAudio(): Float32Array {
    return this.speaker.render(CYCLES_PER_FIELD);
  }

  /**
   * The BASIC line about to execute, as the fitted interpreter reports it.
   *
   * Like several machines here the interpreter leaves its pointer at the last
   * line executed once a program stops, which is fine for labelling a paused
   * line and useless for asking whether anything is still running - see
   * {@link isProgramRunning}.
   */
  currentLine(): number | null {
    if (this.disposed || !this.hasFirmware) return null;
    return this.basic.currentLine(this.memory);
  }

  /**
   * Whether the program this machine was handed is still executing.
   *
   * Latched rather than read: what the interpreter has is the address it comes
   * back to when it has finished with a program, and {@link tick} watches for
   * it. Null until it is executing a line, so the fields between the injected
   * `RUN` and BASIC reading it do not read as "finished".
   */
  isProgramRunning(): boolean | null {
    if (this.disposed) return null;
    return this.runLatch.read(this.currentLine() !== null);
  }

  /**
   * What the workspace holds, and what is left of it. Read through `peek`,
   * never the bus, so asking does not stamp the memory-activity overlay with
   * the IDE's own polling.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (this.disposed || !this.hasFirmware) return null;
    return this.basic.readMemoryStats(this.memory);
  }

  /**
   * The fitted interpreter's variable table. Empty where that interpreter has
   * no reader for it, which is not the same answer as "the program declares
   * none" - the seam has no third state here, and the watcher shows an empty
   * list either way.
   */
  readVariables(): MachineVariable[] {
    if (this.disposed || !this.hasFirmware) return [];
    return this.basic.readVariables?.(this.memory) ?? [];
  }

  /**
   * The report the interpreter printed, read back off the screen rather than
   * out of a cell - which is how both of these BASICs have to be asked, since
   * neither keeps the last error anywhere a host can find it.
   */
  readReport(): MachineReport | null {
    if (this.disposed || !this.hasFirmware) return null;
    return this.basic.readReport?.(this.readScreenText()) ?? null;
  }

  setMemoryActivityRecording(enabled: boolean): void {
    this.memoryActivity.enabled = enabled;
    // Drop what a previous session accumulated, so a reopened overlay starts
    // clean rather than flashing stale activity.
    if (!enabled) this.memoryActivity.clear();
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    if (!this.memoryActivity.enabled) return null;
    return this.memoryActivity.drain(recycle);
  }

  /**
   * The characters on screen, decoded through the dialect's own charset.
   *
   * Null in full-screen graphics, where there are none: the text page still
   * holds whatever was last printed into it, and the video counter is not
   * looking at it. In mixed mode it is the four lines the machine really shows.
   */
  readScreenText(): MachineScreenText | null {
    if (this.disposed) return null;
    return screenTextLines(this.memory.mem, this.switches.mode);
  }

  setProfileRecording(enabled: boolean): void {
    this.profile.setEnabled(enabled);
  }

  drainProfile(): LineCost[] | null {
    return this.profile.drain();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
    this.runLatch.clear();
  }

  /** Direct access for tests and debugging. */
  get mem(): Apple2Memory {
    return this.memory;
  }

  get video(): Apple2Display {
    return this.display;
  }

  get displayMode(): Apple2SoftSwitches {
    return this.switches;
  }

  get processor(): StateMachineCpu {
    return this.cpu;
  }

  /**
   * One clock: the CPU, the free-running counter the paddles time against, the
   * end-of-program watch and the profiler's charge.
   *
   * All four belong here rather than in {@link runFrame} because a debug slice
   * runs this same step, and a machine whose profiler or whose end-of-run watch
   * lived on the free-running path alone would go quiet the moment the user set
   * a breakpoint.
   */
  private tick(): void {
    this.cpu.cycle();
    this.cycles++;
    if (this.cpu.getLastInstructionPointer() === this.basic.commandLoop) {
      this.runLatch.stopped();
    }
    const p = this.profile;
    if (p.enabled) {
      p.pending += 1;
      if (p.pending >= p.slice) p.sample(this.currentLine());
    }
  }

  /** End of a video field: the flash phase and REPT's repeat rate. */
  private endField(): void {
    this.display.endField();
    this.keyboard.endField();
  }

  /**
   * Move one typed character into the board's latch, if the machine has taken
   * the last one - which it says by clearing the strobe at `$C010`.
   *
   * Once a slice rather than once a clock. The ROM echoes what it reads and an
   * echo is far shorter than a field, so this is slower than the hardware; it
   * is also faster than anybody types, and it keeps the injected `RUN` going in
   * at a rate the monitor's line editor is certain to keep up with.
   */
  private feedKeyboard(): void {
    if ((this.keyLatch & 0x80) !== 0) return;
    const code = this.keyboard.take();
    if (code === null) return;
    this.keyLatch = code;
  }

  /**
   * The CPU's bus, wrapped so every access can be stamped for the overlay.
   * {@link Apple2Memory} stays a pure address decoder; the recording is layered
   * on here and gated on the buffer's own flag. The side-effect-free
   * `peek`/`poke` helpers are left unwrapped, so host introspection reads
   * without polluting what the overlay reports as the program's accesses.
   */
  private recordingBus(): BusInterface {
    const bus = this.memory.bus();
    const activity = this.memoryActivity;
    const { read, write } = bus;
    return {
      ...bus,
      read: (address: number): number => {
        const value = read(address);
        if (activity.enabled) activity.hits[address & 0xffff] |= READ_BIT;
        return value;
      },
      write: (address: number, value: number): void => {
        if (activity.enabled) activity.hits[address & 0xffff] |= WRITE_BIT;
        write(address, value);
      },
    };
  }

  /**
   * True when the interpreter's prompt is sitting at the left margin.
   *
   * At the *margin*, not anywhere on the row, because the Autostart Monitor's
   * sign-on banner is `APPLE ][` - which contains Applesoft's `]` prompt, and a
   * contains-check therefore reads the banner as an interpreter that is up. It
   * is not: the cold start prints the banner first and lays its zero-page
   * workspace down after, so a load that believed the banner would write a
   * program into a machine that then walks over it. Both interpreters print
   * their prompt at column 0 and print nothing else there.
   */
  private atBasicPrompt(): boolean {
    return (this.readScreenText()?.lines ?? []).some((line) =>
      line.startsWith(this.basic.prompt),
    );
  }

  /**
   * Blank both text pages at power-on.
   *
   * The one deliberate departure from "RAM comes up as zeros". Real RAM comes
   * up holding rubbish and the monitor's reset never clears the screen, so a
   * real Apple II shows a screenful of garbage until something prints over it -
   * but zeroed RAM is not garbage, it is 960 copies of an inverse `@`, which
   * reads as a fault rather than as a cold machine.
   */
  private blankTextPages(): void {
    this.memory.mem.fill(BLANK, TEXT_PAGE1, TEXT_PAGE2 + TEXT_PAGE_BYTES);
  }

  /** Print straight into the text page, for a machine that cannot run. */
  private printNotice(lines: readonly string[]): void {
    for (let row = 0; row < lines.length; row++) {
      const text = lines[row]!.slice(0, TEXT_COLS);
      const start = textRowAddress(TEXT_PAGE1, row);
      for (let col = 0; col < text.length; col++) {
        this.memory.mem[start + col] = text.charCodeAt(col) | 0x80;
      }
    }
  }
}

/** A stick axis as a paddle position: hard over one way, or centred. */
function axis(low: boolean, high: boolean): number {
  if (low === high) return 0x80;
  return low ? 0x00 : 0xff;
}

/**
 * Whether an image carries a reset vector to start from. `$FFFC`/`$FFFD` all
 * zero or all `$FF` is a padded or empty file rather than firmware.
 */
function hasResetVector(rom: Uint8Array): boolean {
  const offset = 0xfffc - ROM_BASE;
  const vector = (rom[offset] ?? 0) | ((rom[offset + 1] ?? 0) << 8);
  return vector !== 0x0000 && vector !== 0xffff;
}
