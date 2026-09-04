// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Sean Hodges

// Vendored ESM 6502 core; typed by the sibling ../6502/cpu6502.d.ts.
import { ExecutionState, StateMachineCpu } from '../6502/cpu6502.js';
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
  atasciiGlyph,
  screenCodeToAtascii,
} from '../../dialects/atari800/atascii';
import {
  ATARI_400_RAM_TOP,
  ATARI_800_RAM_TOP,
  BASIC_POINTERS,
} from '../../dialects/atari800/addresses';
import { readAtariVariables } from './vars';
import { readAtariReport } from './reports';
import { HEADER_BYTES, IMMEDIATE_LINE } from '../../dialects/atari800/basfile';
import { createMachineLoop } from '../machineLoop';
import { drawRomNotice, noRomNotice } from '../romNotice';
import { ProgramEndLatch } from '../programEndLatch';
import { LineCostRecorder, PROFILE_SLICE_CYCLES } from '../lineCostRecorder';
import {
  MemoryActivityBuffer,
  READ_BIT,
  WRITE_BIT,
} from '../memoryActivityBuffer';
import { Antic, SCANLINES_PER_FRAME } from './antic';
import { ATARI_DISPLAY_HEIGHT, ATARI_DISPLAY_WIDTH, Gtia } from './gtia';
import {
  atariCodeForChar,
  atariDomCodeToToken,
  atariKeyCode,
  BREAK_TOKEN,
  CONSOLE_TOKENS,
  CTRL_TOKENS,
  cursorKey,
  SHIFT_TOKENS,
} from './keyboard';
import { AtariMemory } from './memory';
import { Pia } from './pia';
import { AtariSerialBus } from './sio';
import { KB_CTRL, KB_SHIFT, Pokey } from './pokey';
import { POKEY_SAMPLES_PER_FRAME, PokeyAudioRenderer } from './pokeyAudio';

export { ATARI_DISPLAY_WIDTH, ATARI_DISPLAY_HEIGHT } from './gtia';

/**
 * The Atari 400 and Atari 800, which are one machine with different amounts of
 * RAM fitted.
 *
 * A first-party in-tree machine in the shape the PET, VIC-20 and Apple I
 * already use: the vendored cycle-exact 6502 core is driven one clock at a time
 * over the bus {@link AtariMemory} decodes, and the four support chips - ANTIC,
 * GTIA, POKEY and the PIA - are written from their register behaviour.
 *
 * ### Why the frame is built from scanlines
 *
 * Nearly everything on this machine is timed to the scanline rather than to the
 * frame. ANTIC reads one display list instruction per line and can interrupt
 * the CPU on any of them; WSYNC stops the CPU dead until the line ends; VCOUNT
 * counts lines. So the frame here is 312 passes of "let ANTIC have the line,
 * then give the 6502 what is left of it", and the cycles ANTIC takes for its
 * own fetches are taken off the CPU exactly as they are on the machine - which
 * is why a program runs measurably slower with a graphics screen on than with
 * one off, and why the 1.79 MHz Atari is not as fast as its clock suggests.
 *
 * ### Loading a program
 *
 * {@link loadProgram} boots the machine, writes the tokenized image where
 * BASIC's own `LOAD` would put it, fixes the seven zero-page pointers that
 * describe it, and types `RUN`. Atari BASIC stores a program pre-parsed rather
 * than as text (see `dialects/atari800/basfile`), so those pointers are not a
 * shortcut around typing it in - they are the whole of what `LOAD` does.
 */

/** PAL system clock. */
const CPU_HZ = 1_773_447;

/** CPU cycles in one scanline; the machine's whole timing hangs off this. */
const CYCLES_PER_LINE = 114;

/** PAL frame: 312 lines of 114 cycles. */
const CYCLES_PER_FRAME = CYCLES_PER_LINE * SCANLINES_PER_FRAME;

/**
 * Frames the boot may take before it is declared a mis-boot. Far more than the
 * twenty or so it needs, because the cap is only there to stop a wrong image
 * spinning: a real one is never near it.
 */
const MAX_BOOT_FRAMES = 400;

/** Frames a typed line may take to be consumed. */
const MAX_TYPE_FRAMES = 600;

/**
 * Where Atari BASIC has finished with a program: the instruction that asks the
 * editor for a direct-mode line, reached once BASIC has printed `Ready`,
 * `Stopped at line n` or an error and gone back to its prompt.
 *
 * BASIC keeps no cell that says whether a program is running, and the obvious
 * candidate does not answer it: `STMCUR` is left pointing at the line a program
 * stopped on, so `END` and `STOP` look exactly like a line still executing.
 * Nor does the machine's state distinguish the prompt from an `INPUT` - both
 * are BASIC blocked inside the same editor routine - so the answer is latched
 * from the address instead, in the shape the Sinclair machines and the Atom
 * already use (see `emulator/programEndLatch`).
 *
 * Read off the image this dialect ships with, as the addresses of any machine
 * running a ROM are. A different BASIC in the cartridge would put its prompt
 * elsewhere and this would never fire, so the fallback below - the interpreter
 * returning to the immediate-mode line - still ends the run.
 */
const BASIC_PROMPT = 0xbbab;

/** Where the OS keeps the key the keyboard interrupt last read; $FF is empty. */
const CH = 0x02fc;
/** What the OS keeps in {@link CH} when no key is waiting. */
const CH_EMPTY = 0xff;

/** The OS shadow registers a screen reader needs. */
const SAVMSC = 0x0058; // top-left of the graphics screen
const DINDEX = 0x0057; // the GRAPHICS mode in use
const TXTMSC = 0x0294; // top-left of the text window
const BOTSCR = 0x02bf; // screen rows below the graphics area

/** BASIC's own zero page, as the addresses module names it. */
const { LOMEM, STMCUR } = BASIC_POINTERS;
/** BASIC's runtime stack and top-of-memory pointers, which `LOAD` also sets. */
const RUNSTK = 0x8e;
const BASIC_MEMTOP = 0x90;

/**
 * The OS's own top of free memory: the last byte below the display list, which
 * the OS lowers every time a program asks for a bigger screen. BASIC measures
 * what is left against it, and so does `FRE(0)`.
 */
const OS_MEMTOP = 0x02e5;

/** The text shapes of the three modes that hold characters. */
const TEXT_LAYOUTS: Record<number, { cols: number; rows: number }> = {
  0: { cols: 40, rows: 24 },
  1: { cols: 20, rows: 24 },
  2: { cols: 20, rows: 12 },
};

/** Rows the text window has when a graphics mode leaves one at the foot. */
const TEXT_WINDOW_ROWS = 4;

export interface AtariMachineOptions {
  /** Which of the pair this is; all it changes is how much RAM is fitted. */
  model: '400' | '800';
  /** The OS followed by the BASIC cartridge - see `scripts/build-atari-rom.mts`. */
  rom: Uint8Array;
}

/**
 * Shown when this machine is constructed without its ROM - a designed state
 * rather than a failure, and a rare one: the image ships with the build, and one
 * that fails to load keeps the machine out of the picker with an offer to supply
 * another.
 */
const NO_ROM_NOTICE = noRomNotice(
  "Atari's OS and BASIC ROM image",
  'public/roms/atari.rom',
);

export class AtariMachine implements MachineEmulator {
  readonly displayWidth = ATARI_DISPLAY_WIDTH;
  readonly displayHeight = ATARI_DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;

  /**
   * The rate this machine actually emits at: a fixed count of samples per
   * frame, {@link frameHz} times a second. Not the round number the synthesis
   * is designed around - reporting that instead would have the host consume
   * fractionally slower than the machine produces, and playback would fall
   * further behind for as long as the program ran.
   */
  readonly audioSampleRate = POKEY_SAMPLES_PER_FRAME * this.frameHz;

  private readonly memory: AtariMemory;
  private readonly gtia = new Gtia();
  /**
   * The serial bus, and the drive with no disk in it that answers the OS's
   * boot request rather than leaving it to time out - see `./sio`.
   */
  private readonly bus = new AtariSerialBus();
  private readonly pia = new Pia((asserted) => this.bus.setCommand(asserted));
  private readonly pokey: Pokey;
  private readonly antic: Antic;
  private readonly audio = new PokeyAudioRenderer();
  private cpu: StateMachineCpu | null = null;

  /**
   * Per-address "touched since last drain" set for the live memory-activity
   * overlay, stamped on every CPU bus access while enabled. Off by default, so
   * a closed overlay costs a single not-taken branch per access.
   */
  private readonly memoryActivity = new MemoryActivityBuffer(0x10000);

  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for the life of a run, and the CPU step charges the cycle it runs
   * to the line executing at the time.
   */
  private readonly profile = new LineCostRecorder(
    PROFILE_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );

  /** Whether an image was supplied at all, and whether a cartridge is in it. */
  private readonly hasOs: boolean;

  /** Where in the scanline the machine is, and what ANTIC took off the front. */
  private lineCycle = 0;
  private stolen = 0;

  /** Characters still to be typed at the keyboard by the loader. */
  private typed: number[] = [];

  /** Keys the user is holding, by token, and the modifier lines. */
  private readonly held = new Set<string>();
  private shiftHeld = false;
  private ctrlHeld = false;

  private injecting = false;
  private disposed = false;
  /** Whether the run the IDE started is still going; see {@link BASIC_PROMPT}. */
  private readonly endLatch = new ProgramEndLatch();
  /** True while the latch is armed and the prompt has not been reached. */
  private watchingEnd = false;
  /** Whether the injected program has been seen executing a line. */
  private sawLine = false;
  private loadError = '';

  private backCanvas: HTMLCanvasElement | null = null;
  private backImageData: ImageData | null = null;

  constructor(opts: AtariMachineOptions) {
    this.memory = new AtariMemory(
      opts.model === '800' ? ATARI_800_RAM_TOP : ATARI_400_RAM_TOP,
    );
    this.memory.loadFirmware(opts.rom);
    // A machine with no OS image cannot reset, let alone run: the reset vector
    // would point into the padding. Every path that would step the CPU checks
    // this rather than booting into nothing.
    this.hasOs = opts.rom.length > 0;
    this.pokey = new Pokey(
      (asserted) => this.cpu?.setInterrupt(asserted),
      this.bus,
    );
    this.antic = new Antic(this.memory.mem, this.gtia, () => this.cpu?.nmi());
    this.cpu = new StateMachineCpu(this.busInterface());
    this.hardReset();
  }

  /** Side-effect-free bus read, for tests and for the host's own inspection. */
  peek(address: number): number {
    return this.memory.mem[address & 0xffff]!;
  }

  // --- bus -------------------------------------------------------------------

  /**
   * The CPU's bus, wrapped so every read and write can be recorded for the
   * memory-activity overlay. {@link AtariMemory} stays a pure address decoder;
   * recording is layered on here and gated on the buffer's `enabled`, so a
   * closed overlay costs one not-taken branch per access. The machine's own
   * introspection reads the raw array instead and so never shows up as the
   * program's activity.
   */
  private busInterface(): BusInterface {
    const bus = this.memory.makeBus({
      readGtia: (reg) => this.gtia.read(reg),
      writeGtia: (reg, v) => this.gtia.write(reg, v),
      readPokey: (reg) => this.pokey.read(reg),
      writePokey: (reg, v) => this.pokey.write(reg, v),
      readPia: (reg) => this.pia.read(reg),
      writePia: (reg, v) => this.pia.write(reg, v),
      readAntic: (reg) => this.antic.read(reg),
      writeAntic: (reg, v) => this.antic.write(reg, v),
    });
    const activity = this.memoryActivity;
    const rawRead = bus.read;
    const rawWrite = bus.write;
    bus.read = (address: number): number => {
      const value = rawRead(address);
      if (activity.enabled) activity.hits[address & 0xffff] |= READ_BIT;
      return value;
    };
    bus.write = (address: number, value: number): void => {
      if (activity.enabled) activity.hits[address & 0xffff] |= WRITE_BIT;
      rawWrite(address, value);
    };
    return bus;
  }

  // --- frame driver ----------------------------------------------------------

  /**
   * Advance one CPU cycle's worth of machine time.
   *
   * A cycle rather than an instruction, because the picture and every interrupt
   * on this machine are positioned within the scanline. At the top of each line
   * ANTIC runs its display list, draws, and says how many of the line's 114
   * cycles it needs for its own fetches; those come off the front, and the CPU
   * gets the rest. A write to WSYNC gives up whatever is left of the line.
   */
  private tick(): void {
    if (this.lineCycle === 0) {
      this.antic.startScanline();
      this.stolen = this.antic.dmaCycles();
    }
    if (this.lineCycle >= this.stolen && !this.antic.isHalted()) {
      const cpu = this.cpu!;
      // Before the cycle, not after: `fetch` means the *next* `cycle()` reads
      // the opcode at `state.p`, so this is the instruction boundary at which
      // BASIC is about to ask for a direct-mode line.
      if (
        this.watchingEnd &&
        cpu.executionState === ExecutionState.fetch &&
        cpu.state.p === BASIC_PROMPT
      ) {
        this.endLatch.stopped();
        this.watchingEnd = false;
      }
      cpu.cycle();
      // Charge the cycle to the BASIC line executing it, on the same cadence
      // the debugger samples at. Here rather than in debugStep because a run
      // the IDE performs to check an assistant answer opens no debug session,
      // and would otherwise go unmeasured.
      const p = this.profile;
      if (p.enabled) {
        p.pending += 1;
        if (p.pending >= p.slice) p.sample(this.currentLine());
      }
    }
    this.lineCycle++;
    if (this.lineCycle < CYCLES_PER_LINE) return;
    this.lineCycle = 0;
    this.pokey.tick(CYCLES_PER_LINE);
    this.feedTypist();
    if (this.antic.endScanline()) {
      this.watchEndFallback();
      this.sampleKeyboard();
    }
  }

  /**
   * The end of a run for a cartridge whose prompt is not where this one's is.
   * Once the program has been seen executing a line, the interpreter going back
   * to its immediate-mode line is a program that has finished - which is what
   * falling off the end of a listing does on any Atari BASIC.
   */
  private watchEndFallback(): void {
    if (!this.watchingEnd) return;
    if (this.currentLine() !== null) {
      this.sawLine = true;
      return;
    }
    if (!this.sawLine) return;
    this.endLatch.stopped();
    this.watchingEnd = false;
  }

  private readonly loop = createMachineLoop({
    cyclesPerFrame: CYCLES_PER_FRAME,
    // The core is ticked a cycle at a time, so the line watch runs on the
    // shared profiling cadence rather than after every tick.
    lineWatchCycles: PROFILE_SLICE_CYCLES,
    ready: () => this.hasOs && !this.injecting && !this.disposed,
    step: () => {
      this.tick();
      return 1;
    },
    currentLine: () => this.currentLine(),
  });

  runFrame(): void {
    this.loop.runFrame();
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    return this.loop.debugStep(opts);
  }

  private hardReset(): void {
    this.gtia.reset();
    this.pia.reset();
    this.bus.reset();
    this.pokey.reset();
    this.antic.reset();
    this.audio.reset();
    this.memory.clearRam();
    this.held.clear();
    this.shiftHeld = false;
    this.ctrlHeld = false;
    this.typed = [];
    this.endLatch.clear();
    this.watchingEnd = false;
    this.sawLine = false;
    this.lineCycle = 0;
    this.stolen = 0;
    this.loop.reset();
    this.cpu?.reset();
  }

  reset(): void {
    this.loadError = '';
    this.hardReset();
  }

  readAudio(): Float32Array {
    return this.audio.render((reg) => this.pokey.audioRegister(reg));
  }

  // --- keyboard --------------------------------------------------------------

  /**
   * Tell POKEY what is held, once a frame.
   *
   * Once a frame rather than on the host's event, because that is the rate the
   * chip's own debounce reports at: a matrix scan finds at most one key, and a
   * key that stays down produces one interrupt, not one per scan. Repeating a
   * held key is the OS's job, and it does it from the vertical blank.
   */
  private sampleKeyboard(): void {
    let code = -1;
    for (const token of this.held) {
      const key = atariKeyCode(token);
      if (key < 0) continue;
      code = key;
      // A cursor key is CTRL and a punctuation key, exactly as its cap says.
      if (cursorKey(token) !== undefined) code |= KB_CTRL;
      break;
    }
    if (code >= 0) {
      if (this.shiftHeld) code |= KB_SHIFT;
      if (this.ctrlHeld) code |= KB_CTRL;
    }
    this.pokey.setKeyState(code, this.shiftHeld, this.held.has(BREAK_TOKEN));
  }

  /**
   * Hand the OS the next character the loader is typing.
   *
   * Straight into the OS's own `CH` cell rather than through POKEY, because
   * what goes in here is not a person at a keyboard: it is the `RUN` that
   * starts an injected program, or a listing a test is making the ROM tokenize.
   * Through the chip each character would cost a frame of debounce, and a forty
   * line listing would take a quarter of a minute to go in. `CH` is where the
   * keyboard interrupt leaves a key anyway, so the editor reads it identically.
   */
  private feedTypist(): void {
    if (this.typed.length === 0) return;
    if (this.memory.mem[CH] !== CH_EMPTY) return;
    this.memory.mem[CH] = this.typed.shift()!;
  }

  /** Queue text to be typed at the machine, one key code per character. */
  type(text: string): void {
    for (const ch of text) {
      const code = atariCodeForChar(ch);
      if (code >= 0) this.typed.push(code);
    }
  }

  /** Whether everything queued has been taken; for the boot and for tests. */
  private typingDone(): boolean {
    return this.typed.length === 0 && this.memory.mem[CH] === CH_EMPTY;
  }

  /**
   * Type `text` and run until the machine has consumed all of it. Used by the
   * loader and by the tests that make the ROM tokenize a listing for them.
   */
  typeAndRun(text: string, maxFrames = MAX_TYPE_FRAMES): boolean {
    this.type(text);
    for (let frame = 0; frame < maxFrames; frame++) {
      this.loop.runFrame();
      if (this.typingDone()) return true;
    }
    return false;
  }

  keyEvent(e: KeyboardEvent, down: boolean): boolean {
    if (e.metaKey) return false;
    const token = atariDomCodeToToken(e.code);
    if (token === null) return false;
    this.setKey(token, down);
    return true;
  }

  setKey(token: string, down: boolean): void {
    if ((SHIFT_TOKENS as readonly string[]).includes(token)) {
      this.shiftHeld = down;
      return;
    }
    if ((CTRL_TOKENS as readonly string[]).includes(token)) {
      this.ctrlHeld = down;
      return;
    }
    if ((CONSOLE_TOKENS as readonly string[]).includes(token)) {
      const console = this.gtia.console;
      if (token === 'Start') console.start = down;
      else if (token === 'Select') console.select = down;
      else console.option = down;
      return;
    }
    if (down) this.held.add(token);
    else this.held.delete(token);
  }

  releaseAllKeys(): void {
    this.held.clear();
    this.shiftHeld = false;
    this.ctrlHeld = false;
    this.gtia.console.start = false;
    this.gtia.console.select = false;
    this.gtia.console.option = false;
  }

  /**
   * Drive one of the two joystick ports. The directions are switches on the
   * PIA's PORTA and the fire button a separate line into GTIA, which is why the
   * two halves go to different chips. `_mode` is always `native` - the Atari's
   * own port is the only interface it advertises.
   */
  setJoystick(_mode: JoystickMode, state: JoystickState): void {
    this.pia.setJoystick(0, state);
    this.gtia.setTrigger(0, state.fire1 || state.fire2);
  }

  // --- program loading -------------------------------------------------------

  loadProgram(image: Uint8Array, opts?: { blocks?: readonly Block[] }): void {
    this.loadError = '';
    if (!this.hasOs) {
      this.loadError = 'No Atari ROM image is installed';
      return;
    }
    this.injecting = true;
    try {
      this.hardReset();
      if (!this.bootToReady()) {
        throw new Error(
          'Atari: BASIC did not reach its prompt - the image at ' +
            'public/roms/atari.rom is not the firmware this dialect expects',
        );
      }
      this.injectProgram(image);
      // Memory blocks (machine code or data at fixed addresses, alongside the
      // BASIC program) go straight into RAM now, after the program is in place
      // and before RUN starts it.
      for (const block of opts?.blocks ?? []) {
        for (let i = 0; i < block.bytes.length; i++) {
          const address = (block.address + i) & 0xffff;
          if (this.memory.isRam(address)) {
            this.memory.mem[address] = block.bytes[i]! & 0xff;
          }
        }
      }
      // Armed before the RUN goes in, not after: a program short enough to
      // finish inside the frames that type it would otherwise end before
      // anything was watching for it.
      this.endLatch.arm();
      this.watchingEnd = true;
      this.sawLine = false;
      this.type('RUN\n');
    } catch (e) {
      this.loadError = e instanceof Error ? e.message : String(e);
      console.error('Atari loadProgram failed:', e);
    } finally {
      this.injecting = false;
    }
  }

  /**
   * Run until BASIC is at its prompt, or give up.
   *
   * Stepped directly rather than through the loop, because the loop is holding
   * still for the injection this boot is part of. It costs a third of a second
   * of emulated time: the OS sizes the RAM, asks the serial bus whether a disk
   * wants to boot ahead of the cartridge, is told there is no disk (see
   * `./sio`), and starts BASIC.
   */
  private bootToReady(): boolean {
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      for (let cycle = 0; cycle < CYCLES_PER_FRAME; cycle++) this.tick();
      if (this.atPrompt()) return true;
    }
    return false;
  }

  /**
   * Whether BASIC is sitting at its prompt.
   *
   * Read from BASIC's own state rather than by looking for the word on screen:
   * `STMCUR` points at the line being executed, and at the prompt that is the
   * immediate-mode line, whose number is above every line a program may use.
   * A program's own `PRINT "READY"` therefore cannot be mistaken for it, and
   * neither can the prompt of a BASIC that spells the word differently.
   */
  private atPrompt(): boolean {
    return this.memory.peekWord(STMCUR) !== 0 && this.currentLine() === null;
  }

  /**
   * Write the tokenized image where BASIC's `LOAD` would put it.
   *
   * The image is seven pointers held as offsets from LOMEM, then the block from
   * VNTP to STARP (see `dialects/atari800/basfile`). LOMEM is wherever the
   * running machine put it, so it is read back rather than assumed: it moves
   * with what the OS reserved below it. The three pointers past STARP are the
   * ones `LOAD` sets itself - a loaded program has an empty runtime stack and
   * nothing above it.
   */
  private injectProgram(image: Uint8Array): void {
    if (image.length < HEADER_BYTES) return;
    const mem = this.memory.mem;
    const lomem = this.memory.peekWord(LOMEM);
    const word = (i: number) => image[i * 2]! | (image[i * 2 + 1]! << 8);

    for (let i = 0; i < 7; i++) {
      const pointer = lomem + word(i);
      mem[LOMEM + i * 2] = pointer & 0xff;
      mem[LOMEM + i * 2 + 1] = (pointer >> 8) & 0xff;
    }
    const starp = lomem + word(6);
    for (const zp of [RUNSTK, BASIC_MEMTOP]) {
      mem[zp] = starp & 0xff;
      mem[zp + 1] = (starp >> 8) & 0xff;
    }

    const at = lomem + word(1); // VNTP: where the saved block belongs
    for (let i = HEADER_BYTES; i < image.length; i++) {
      const address = at + i - HEADER_BYTES;
      if (!this.memory.isRam(address)) break;
      mem[address] = image[i]!;
    }
  }

  // --- introspection ---------------------------------------------------------

  /**
   * The BASIC line about to be executed, or null when none is.
   *
   * `STMCUR` points at the line the interpreter is working through. In direct
   * mode it points at the immediate-mode line, whose number is
   * {@link IMMEDIATE_LINE} - above every number a program may use - so one read
   * answers both questions.
   */
  currentLine(): number | null {
    if (!this.hasOs || this.injecting || this.disposed) return null;
    const line = this.memory.peekWord(this.memory.peekWord(STMCUR));
    return line < IMMEDIATE_LINE ? line : null;
  }

  /**
   * Whether the run the IDE started is still going.
   *
   * Null until the injected `RUN` has been taken: between {@link loadProgram}
   * and the interpreter reaching the first line, BASIC is legitimately still at
   * its prompt, and reporting that as "finished" would end the run before it
   * had begun. After that the latch answers, because BASIC's own state cannot
   * (see {@link BASIC_PROMPT}).
   */
  isProgramRunning(): boolean | null {
    if (!this.hasOs || this.injecting || this.disposed) return null;
    return this.endLatch.read(this.currentLine() !== null);
  }

  /**
   * The characters on screen, decoded through the machine's own character set.
   *
   * The OS's `DINDEX` says which `GRAPHICS` mode is up and `SAVMSC` where its
   * memory starts. A text mode is read whole; a graphics mode holds no
   * characters at all, so what comes back is the four-line text window at the
   * foot of the screen, which is where a program's `PRINT` goes - and nothing
   * at all when the mode was opened with no window.
   */
  readScreenText(): MachineScreenText | null {
    if (!this.hasOs || this.injecting || this.disposed) return null;
    const mem = this.memory.mem;
    const mode = mem[DINDEX]! & 0x0f;
    const layout = TEXT_LAYOUTS[mode];
    if (layout !== undefined) {
      return this.readText(
        this.memory.peekWord(SAVMSC),
        layout.cols,
        layout.rows,
      );
    }
    return this.textWindow();
  }

  /**
   * The four rows at the foot of the screen that a graphics mode leaves for
   * text, or null when the mode was opened with no window.
   */
  private textWindow(): MachineScreenText | null {
    if (this.memory.mem[BOTSCR] !== TEXT_WINDOW_ROWS) return null;
    return this.readText(
      this.memory.peekWord(TXTMSC),
      TEXT_LAYOUTS[0]!.cols,
      TEXT_WINDOW_ROWS,
    );
  }

  /**
   * The window BASIC prints into: the whole screen in GRAPHICS 0, and the four
   * rows at the foot in every other mode that leaves a text window.
   *
   * Not the same thing as {@link readScreenText}, which answers with whatever
   * the machine is showing: GRAPHICS 1 and 2 have a screen full of characters
   * of their own, and a report still goes to the window under it. A mode opened
   * with no window has nowhere to print at all, and answers with nothing.
   */
  private editorText(): MachineScreenText | null {
    const layout = TEXT_LAYOUTS[0]!;
    if ((this.memory.mem[DINDEX]! & 0x0f) === 0) {
      return this.readText(
        this.memory.peekWord(SAVMSC),
        layout.cols,
        layout.rows,
      );
    }
    return this.textWindow();
  }

  /**
   * The machine's RAM as the introspection readers index it.
   *
   * The raw array rather than the CPU's bus, so the watcher and the memory
   * panel polling every frame never show up as the program's own accesses in
   * the memory-map overlay.
   */
  private memPort(): { read(a: number): number; readWord(a: number): number } {
    const mem = this.memory.mem;
    return {
      read: (address) => mem[address & 0xffff]!,
      readWord: (address) => this.memory.peekWord(address),
    };
  }

  /**
   * The running program's variables, decoded from BASIC's own name and value
   * tables (see `./vars`).
   */
  readVariables(): MachineVariable[] {
    if (!this.hasOs || this.injecting || this.disposed) return [];
    return readAtariVariables(this.memPort());
  }

  /** How the last run ended, from BASIC's cells and what it printed (`./reports`). */
  readReport(): MachineReport | null {
    if (!this.hasOs || this.injecting || this.disposed) return null;
    return readAtariReport(this.memPort(), this.editorText());
  }

  /**
   * BASIC's own account of the RAM it holds and the RAM it has left.
   *
   * Every pool a program spends is inside one span: BASIC's memory runs from
   * `LOMEM` - its line buffer, then the variable name and value tables, the
   * tokenized statements, the string and array space and the runtime stack - up
   * to its own `MEMTOP`, and what is free is whatever lies between there and
   * the OS's `MEMTOP` under the display list. The second figure is `FRE(0)`
   * exactly: that is the subtraction the function itself performs.
   */
  readMemoryStats(): MachineMemoryStats | null {
    if (!this.hasOs || this.injecting || this.disposed) return null;
    const lomem = this.memory.peekWord(LOMEM);
    const basicTop = this.memory.peekWord(BASIC_MEMTOP);
    const osTop = this.memory.peekWord(OS_MEMTOP);
    const used = basicTop - lomem;
    const free = osTop - basicTop;
    // Mid-boot the pointers are still zero, and mid-injection they disagree;
    // either way there is no figure worth showing.
    if (lomem === 0 || used < 0 || free < 0) return null;
    return { used, free };
  }

  private readText(
    base: number,
    cols: number,
    rows: number,
  ): MachineScreenText {
    const mem = this.memory.mem;
    const lines: string[] = [];
    for (let row = 0; row < rows; row++) {
      let line = '';
      for (let col = 0; col < cols; col++) {
        const code = mem[(base + row * cols + col) & 0xffff]!;
        line += atasciiGlyph(screenCodeToAtascii(code));
      }
      lines.push(line);
    }
    return { lines, cols, rows };
  }

  setProfileRecording(enabled: boolean): void {
    this.profile.setEnabled(enabled);
  }

  drainProfile(): LineCost[] | null {
    return this.profile.drain();
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

  // --- video -----------------------------------------------------------------

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.hasOs) {
      drawRomNotice(ctx, this.displayWidth, this.displayHeight, NO_ROM_NOTICE);
      return;
    }
    if (!this.backCanvas) {
      this.backCanvas = document.createElement('canvas');
      this.backCanvas.width = ATARI_DISPLAY_WIDTH;
      this.backCanvas.height = ATARI_DISPLAY_HEIGHT;
      this.backImageData = new ImageData(
        ATARI_DISPLAY_WIDTH,
        ATARI_DISPLAY_HEIGHT,
      );
    }
    const backCtx = this.backCanvas.getContext('2d');
    if (!backCtx || !this.backImageData) return;
    this.backImageData.data.set(this.antic.rgba);
    backCtx.putImageData(this.backImageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      this.backCanvas,
      0,
      0,
      ATARI_DISPLAY_WIDTH,
      ATARI_DISPLAY_HEIGHT,
      0,
      0,
      this.displayWidth,
      this.displayHeight,
    );
    if (this.loadError) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(0, this.displayHeight - 20, this.displayWidth, 20);
      ctx.fillStyle = '#ff6666';
      ctx.font = '11px monospace';
      ctx.fillText(this.loadError, 6, this.displayHeight - 7);
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.endLatch.clear();
    this.cpu = null;
    this.backCanvas = null;
    this.backImageData = null;
  }
}

/** Run frames until `done`, or until the cap; for tests driving the machine. */
export function runUntil(
  machine: AtariMachine,
  done: () => boolean,
  maxFrames: number,
): boolean {
  for (let frame = 0; frame < maxFrames; frame++) {
    machine.runFrame();
    if (done()) return true;
  }
  return false;
}
