// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// Vendored ESM 6502 core; typed by the sibling ../6502/cpu6502.d.ts.
import { StateMachineCpu } from '../6502/cpu6502.js';
import type { BusInterface } from '../6502/cpu6502.js';
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
} from '../../dialects/types';
import {
  BASIC_BYTES,
  BASIC_COLD_ENTRY,
  BASIC_COMMAND_LOOP,
  HIMEM,
  LOMEM,
  MAX_LINE,
  MONITOR_BYTES,
  PLINE,
  PP,
  PV,
  RAM_TOP,
} from '../../dialects/apple1/addresses';
import { parseBasicImage } from '../../dialects/apple1/basicImage';
import { readApple1Report } from '../../dialects/apple1/reports';
import { readApple1Variables } from '../../dialects/apple1/vars';
import { createMachineLoop } from '../machineLoop';
import { LineCostRecorder, PROFILE_SLICE_CYCLES } from '../lineCostRecorder';
import { ProgramEndLatch } from '../programEndLatch';
import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../memoryActivityBuffer';
import { Apple1Keyboard } from './keyboard';
import { Apple1Memory } from './memory';
import { Apple1Pia } from './pia';
import {
  Apple1Terminal,
  COLS as DISPLAY_COLS,
  DISPLAY_HEIGHT,
  DISPLAY_WIDTH,
  FIELD_HZ,
  ROWS as DISPLAY_ROWS,
} from './terminal';

/**
 * The 6502's clock: the 14.31818 MHz colour crystal divided by 14, which is
 * where the machine's slightly-over-1 MHz figure comes from.
 */
const CPU_HZ = 14_318_180 / 14;

/**
 * Cycles a video field is worth, and so the cycle budget of one
 * {@link Apple1Machine.runFrame}. It is also exactly one character time - see
 * `terminal.ts` for why the two are the same number on this machine.
 */
export const CYCLES_PER_FIELD = Math.round(CPU_HZ / FIELD_HZ);

/**
 * Fields the boot dialogue is given before it is called a failure. Generous:
 * every character of it goes out at one per field, and the monitor echoes what
 * the loader types before printing anything of its own.
 */
const MAX_BOOT_FIELDS = 600;

/** Integer BASIC's prompt, and the only thing that says it is up. */
const BASIC_PROMPT = '>';

/**
 * Shown on the terminal when the supplied image carries no interpreter - the
 * monitor alone, padded to length by the ROM seam.
 *
 * A designed state rather than a failure. `apple1.rom` ships with both halves,
 * but a user who replaces it with their own 256-byte monitor gets a machine
 * that boots to the monitor's `\` prompt over an all-`$FF` interpreter block,
 * which is an Apple I with no BASIC tape loaded. Saying so beats letting `RUN`
 * jump into the padding.
 */
const NO_INTERPRETER_NOTICE = [
  'NO BASIC FITTED.',
  'THE SUPPLIED IMAGE CARRIES THE MONITOR',
  'PROM ALONE. REPLACE IT AT',
  'PUBLIC/ROMS/APPLE1.ROM TO RUN BASIC.',
];

/** Shown when there is no monitor either, so the machine cannot even reset. */
const NO_MONITOR_NOTICE = [
  'NO FIRMWARE.',
  'THE SUPPLIED IMAGE CARRIES NO MONITOR.',
];

/**
 * The Apple I as a {@link MachineEmulator}: the vendored 6502 core in
 * `src/emulator/6502/` on a hand-written bus, alongside the PET's and the
 * VIC-20's.
 *
 * Two parts of the real machine are modelled as logic rather than as images.
 * The terminal section - a shift-register display, its sequencing logic and the
 * Signetics 2513 character generator - is none of it CPU-addressable, so
 * `terminal.ts` models the 40x24 grid, its hardware scroll and the DSP busy bit
 * directly. The Apple Cassette Interface's PROM is replaced by a host-side codec
 * of the same FSK encoding. What is left is the two pieces of 6502 object code
 * that cannot be anything but themselves - WozMon and Integer BASIC - and those
 * arrive as one concatenated image, the monitor first.
 *
 * The machine therefore stays constructible with an empty or monitor-only image
 * and says so on its own terminal rather than throwing, the way the Altair does.
 *
 * ### Getting a program into it
 *
 * There is no `LOAD` in this BASIC and no ROM routine to call: a program
 * reaches the machine either through the cassette interface or by being typed.
 * {@link loadProgram} does neither. It boots the interpreter the authentic way -
 * `E000R` typed at the monitor, because that really is how BASIC starts on this
 * machine - and then writes the tokenized program straight into the workspace
 * and fixes the four zero-page pointers that describe it, which is exactly the
 * pair of ranges an ACI tape restores. Typing the listing in instead would take
 * a character per field, and a forty-line listing is some eight hundred
 * characters: a quarter of a minute of typing before anything could run.
 */
export class Apple1Machine implements MachineEmulator {
  readonly frameHz = CPU_HZ / CYCLES_PER_FIELD;
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;

  /** Whether the image carries a monitor PROM the machine can reset into. */
  readonly hasMonitor: boolean;
  /** Whether the image carries an interpreter in its `$E000` half. */
  readonly hasInterpreter: boolean;

  private readonly firmware: Uint8Array;
  /**
   * The character sitting in the keyboard's latch, PA7 strapped high. Held here
   * rather than in {@link Apple1Keyboard} because it is the board's latch, not
   * the keyboard's: the keyboard sends a character and forgets it.
   */
  private keyLatch = 0x80;
  private readonly terminal = new Apple1Terminal(CYCLES_PER_FIELD);
  private readonly pia: Apple1Pia;
  private readonly memory: Apple1Memory;
  private readonly keyboard: Apple1Keyboard;
  private readonly cpu: StateMachineCpu;
  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for the life of a run and {@link tick} charges the cycle it runs to
   * the line executing at the time, plus whatever the workspace figure moved by
   * while that line was executing.
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
   * The answer is latched from the one address the interpreter reaches when it
   * has finished with a program: the head of its command loop, three
   * instructions before the `>` is printed. `END`, falling off the end (which
   * this BASIC reports as `*** END ERR`), a `*** SYNTAX ERR` and a break from
   * the keyboard all arrive there - the warm start above them does not, because
   * only some of those paths go through it.
   */
  private readonly runLatch = new ProgramEndLatch();
  private disposed = false;

  /**
   * The frame walk and the debug slice from one contract. The core is ticked a
   * clock at a time, so the line watch runs on {@link PROFILE_SLICE_CYCLES}
   * rather than after every tick; the keyboard is drained at the top of a slice
   * and the cursor's flash counted at the bottom, so a debug session pays both
   * exactly as a free run does.
   */
  private readonly loop = createMachineLoop({
    cyclesPerFrame: CYCLES_PER_FIELD,
    lineWatchCycles: PROFILE_SLICE_CYCLES,
    ready: () => this.hasMonitor && !this.disposed,
    onSliceStart: () => this.feedKeyboard(),
    step: () => {
      this.tick();
      return 1;
    },
    onSliceEnd: () => this.terminal.endField(),
    currentLine: () => this.currentLine(),
  });

  constructor(opts: { rom: Uint8Array }) {
    this.firmware = opts.rom;
    // Read once here rather than on every ask: `currentLine` consults the
    // second of these, and the profiler asks it every few cycles.
    this.hasMonitor = notBlank(
      opts.rom.subarray(0, MONITOR_BYTES),
      MONITOR_BYTES,
    );
    this.hasInterpreter = notBlank(
      opts.rom.subarray(MONITOR_BYTES, MONITOR_BYTES + BASIC_BYTES),
      BASIC_BYTES,
    );
    this.pia = new Apple1Pia({
      readPortA: () => this.keyLatch,
      readPortB: () => (this.terminal.busy ? 0x80 : 0x00),
      writePortB: (value) => this.terminal.write(value),
    });
    this.memory = new Apple1Memory(this.pia);
    this.keyboard = new Apple1Keyboard({
      reset: () => this.pressReset(),
      clearScreen: () => this.terminal.clear(),
    });
    this.cpu = new StateMachineCpu(this.recordingBus());
    this.reset();
  }

  /** Power-on: RAM cleared, firmware laid out, everything back to its reset state. */
  reset(): void {
    this.memory.loadFirmware(this.firmware);
    this.terminal.clear();
    this.pia.reset();
    this.keyboard.releaseAll();
    this.keyLatch = 0x80;
    this.runLatch.clear();
    this.loop.reset();
    this.cpu.reset();
    if (!this.hasMonitor) this.printNotice(NO_MONITOR_NOTICE);
    else if (!this.hasInterpreter) this.printNotice(NO_INTERPRETER_NOTICE);
  }

  /**
   * The RESET button on the board. Unlike {@link reset} it is not a power
   * cycle: it pulses the CPU's reset line and the PIA's and nothing else, so
   * the RAM - the program in it included - survives, which is how an Apple I
   * owner escaped a runaway program and typed `E2B3R` to get back to BASIC
   * with their listing intact.
   */
  pressReset(): void {
    this.pia.reset();
    this.keyboard.clearInput();
    this.keyLatch = 0x80;
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
   * `image` is the pair of ranges an ACI dump holds (see `basicImage.ts`): the
   * zero-page housekeeping block, then the workspace with the program at its
   * top. Only the four pointers that describe the workspace are restored from
   * the block rather than all 182 bytes of it - the rest is interpreter state
   * that the cold start has already set correctly, and a freshly built image
   * carries zeros there rather than a coherent snapshot of a running machine.
   *
   * Any machine-code blocks are written straight into RAM alongside it, which
   * is what `CALL` in the loaded program then jumps to.
   */
  loadProgram(
    image: Uint8Array,
    opts?: { blocks?: readonly MemoryBlock[]; autoStart?: number | null },
  ): void {
    this.reset();
    if (!this.hasMonitor || !this.hasInterpreter) return;
    this.bootToBasic();

    // Machine-code blocks go into RAM after the interpreter is up and before
    // `RUN` starts anything: the cold start walks the workspace, so a block
    // written before it would be walked over. They live below LOMEM, which is
    // the only RAM Integer BASIC never touches.
    for (const block of opts?.blocks ?? []) {
      for (let i = 0; i < block.bytes.length; i++) {
        this.memory.mem[(block.address + i) & 0xffff] = block.bytes[i]! & 0xff;
      }
    }

    const { program, lomem, himem } = parseBasicImage(image);
    const fits = lomem < himem && himem <= RAM_TOP + 1;
    // A workspace outside the fitted 4K is not one this machine can hold, so
    // keep the bounds the cold start chose and lay the program under those.
    const top = fits ? himem : this.memory.peekWord(HIMEM);
    const bottom = fits ? lomem : this.memory.peekWord(LOMEM);
    // An image whose program does not fit the workspace it describes is a
    // broken one; keep its leading bytes rather than writing below LOMEM.
    const text = program.subarray(0, top - bottom);
    const start = top - text.length;
    this.memory.mem.set(text, start);
    this.writePointer(LOMEM, bottom);
    this.writePointer(HIMEM, top);
    this.writePointer(PP, start);
    // No variables yet; `RUN` clears them again in any case.
    this.writePointer(PV, bottom);

    // Armed before the program is started rather than after, so a program that
    // ends inside the same frame the `RUN` is read in still latches its end.
    this.runLatch.arm();
    this.keyboard.clearInput();
    this.keyboard.type('RUN\r');
  }

  /**
   * Answer the monitor's prompt with `E000R` and run on to Integer BASIC's `>`,
   * from a freshly reset machine.
   *
   * Public because booting BASIC is not automatic on this machine: left alone
   * it stops at the monitor, which is the authentic thing to do and lets the
   * user drive the monitor by hand, but anything that wants the interpreter
   * *up* has to type the entry point at it exactly as an owner would.
   */
  bootToBasic(): void {
    if (!this.hasMonitor || !this.hasInterpreter) return;
    this.keyboard.clearInput();
    this.keyboard.type(`${BASIC_COLD_ENTRY.toString(16).toUpperCase()}R\r`);
    for (let field = 0; field < MAX_BOOT_FIELDS; field++) {
      this.loop.runFrame();
      if (this.terminal.contains(BASIC_PROMPT)) return;
    }
    throw new Error(
      'Apple I: Integer BASIC did not reach its prompt - the image at ' +
        'public/roms/apple1.rom is not the firmware this dialect expects',
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

  /**
   * The BASIC line about to execute, from PLINE - which holds a *pointer* to
   * the line's length byte rather than a line number, so the number is the word
   * that follows it. Null in direct mode, where PLINE is zero, and null while
   * it points outside the stored program.
   *
   * Like several machines here the interpreter leaves it pointing at the last
   * line executed once a program stops, which is fine for labelling a paused
   * line and useless for asking whether anything is still running - see
   * {@link isProgramRunning}.
   */
  currentLine(): number | null {
    if (this.disposed || !this.hasInterpreter) return null;
    const pline = this.memory.peekWord(PLINE);
    if (pline < this.memory.peekWord(PP)) return null;
    if (pline >= this.memory.peekWord(HIMEM)) return null;
    const line =
      this.memory.peek(pline + 1) | (this.memory.peek(pline + 2) << 8);
    return line <= MAX_LINE ? line : null;
  }

  /**
   * Whether the program this machine was handed is still executing.
   *
   * Latched rather than read: Integer BASIC records nothing that distinguishes
   * a running program from a machine idling at `>`. What it does have is the
   * address it comes back to when it has finished with one - its warm start -
   * and {@link tick} watches for it. Null until the interpreter is executing a
   * line, so the fields between the injected `RUN` and BASIC reading it do not
   * read as "finished".
   */
  isProgramRunning(): boolean | null {
    if (this.disposed) return null;
    return this.runLatch.read(this.currentLine() !== null);
  }

  /**
   * What the workspace holds, and what is left of it.
   *
   * The one figure on this machine that has to count from both ends: the
   * variables run up from LOMEM to PV and the program down from PP to HIMEM,
   * with the free space in the middle. A reading that counted only the program
   * text would report a program that allocates nothing.
   *
   * Read through `peek`, never the bus, so asking does not stamp the
   * memory-activity overlay with the IDE's own polling.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (this.disposed || !this.hasInterpreter) return null;
    const lomem = this.memory.peekWord(LOMEM);
    const himem = this.memory.peekWord(HIMEM);
    const pp = this.memory.peekWord(PP);
    const pv = this.memory.peekWord(PV);
    // Before the cold start has laid the pointers down there is no workspace to
    // describe - at the monitor they are all zero - and a machine part-way
    // through an injection describes one that does not hold together.
    if (himem <= lomem) return null;
    if (!(lomem <= pv && pv <= pp && pp <= himem)) return null;
    return { used: himem - lomem - (pp - pv), free: pp - pv };
  }

  /**
   * The interpreter's variable table, walked from LOMEM.
   *
   * Gated on {@link readMemoryStats} rather than on a flag of its own: the
   * table is described by the same four pointers, so a machine that cannot
   * describe its workspace cannot be holding a table worth reading either -
   * which is exactly the monitor prompt, and the fields part-way through an
   * injection.
   */
  readVariables(): MachineVariable[] {
    if (this.readMemoryStats() === null) return [];
    return readApple1Variables(this.memory.mem);
  }

  /**
   * The `*** ... ERR` the interpreter printed, read back off the terminal.
   *
   * The grid rather than the character stream, so a report stays readable after
   * the program has printed past it - and every `loadProgram` clears the
   * terminal, so what is on it belongs to the run just made.
   */
  readReport(): MachineReport | null {
    if (this.disposed || !this.hasInterpreter) return null;
    return readApple1Report(this.readScreenText()?.lines ?? []);
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
   * The CPU's bus, wrapped so every access can be stamped for the overlay.
   * {@link Apple1Memory} stays a pure address decoder; the recording is layered
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
   * The terminal grid as text.
   *
   * As easy to read as the Altair's and for the same reason: the grid *is* the
   * characters, because it was assembled from the bytes the CPU sent to the
   * display port one at a time. There is no video RAM to decode and no
   * character generator to map back through. Rows are padded rather than
   * trimmed, since the seam promises exactly `cols` code points per line.
   */
  readScreenText(): MachineScreenText | null {
    if (this.disposed) return null;
    const lines: string[] = [];
    for (let row = 0; row < DISPLAY_ROWS; row++) {
      lines.push(this.terminal.rowText(row));
    }
    return { lines, cols: DISPLAY_COLS, rows: DISPLAY_ROWS };
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
  get mem(): Apple1Memory {
    return this.memory;
  }

  get display(): Apple1Terminal {
    return this.terminal;
  }

  get processor(): StateMachineCpu {
    return this.cpu;
  }

  /**
   * One clock: the CPU, the display's character timer, the end-of-program watch
   * and the profiler's charge.
   *
   * All four belong here rather than in {@link runFrame} because a debug slice
   * runs this same step - a debug session opens on any press of Play - and a
   * machine whose profiler or whose end-of-run watch lived on the free-running
   * path alone would go quiet the moment the user set a breakpoint.
   */
  private tick(): void {
    this.cpu.cycle();
    this.terminal.tick();
    // The interpreter is back at its command loop, which is where it lands when
    // it has finished with a program. One integer compare per clock.
    if (this.cpu.getLastInstructionPointer() === BASIC_COMMAND_LOOP) {
      this.runLatch.stopped();
    }
    const p = this.profile;
    if (p.enabled) {
      p.pending += 1;
      if (p.pending >= p.slice) p.sample(this.currentLine());
    }
  }

  /**
   * Move one typed character into the board's latch and strobe CA1, if the
   * machine has taken the last one.
   *
   * Once a slice rather than once a clock, which costs nothing: the monitor and
   * the interpreter both echo what they read, and an echo takes a whole field,
   * so neither can consume more than one character a frame however fast the
   * host offers them.
   */
  private feedKeyboard(): void {
    if (this.pia.keyWaiting) return;
    const code = this.keyboard.take();
    if (code === null) return;
    this.keyLatch = code;
    this.pia.strobeKey();
  }

  private writePointer(address: number, value: number): void {
    this.memory.mem[address] = value & 0xff;
    this.memory.mem[address + 1] = (value >> 8) & 0xff;
  }

  private printNotice(lines: readonly string[]): void {
    for (const line of lines) {
      for (let i = 0; i < line.length; i++)
        this.terminal.write(line.charCodeAt(i));
      this.terminal.write(0x0d);
    }
  }
}

/** Whether a firmware half carries anything but the seam's `$FF` padding. */
function notBlank(half: Uint8Array, expected: number): boolean {
  if (half.length < expected) return false;
  for (let i = 0; i < expected; i++) if (half[i] !== 0xff) return true;
  return false;
}
