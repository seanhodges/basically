import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core } from '../../../emulator/z80/z80core.js';
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
} from '../../types';
import { createMachineLoop } from '../../../emulator/machineLoop';
import {
  LineCostRecorder,
  PROFILE_SLICE_CYCLES,
} from '../../../emulator/lineCostRecorder';
import { ProgramEndLatch } from '../../../emulator/programEndLatch';
import { SamMemory, PAGE_BYTES } from './memory';
import { drawRomNotice, noRomNotice } from '../../../emulator/romNotice';
import {
  SamAsic,
  STATUS_INT_FRAME,
  STATUS_INT_LINE,
  BORDER_SCREEN_OFF,
} from './asic';
import { DISPLAY_HEIGHT, DISPLAY_WIDTH, renderScreen } from './display';
import { SamKeyboard } from './keyboard';
import { Saa1099, SAA_SAMPLES_PER_FRAME } from './saa1099';
import {
  readSamcoupeScreenText,
  samcoupeFontSignatures,
  type SamTextLayout,
} from './screenText';
import type { GlyphSignatures } from '../../../emulator/fontMatcher';
import { parseSamFileWithReport, samBlocks } from '../samfile';
import {
  CHARS,
  CSIZE,
  ELINE,
  NUMEND,
  NVARS,
  RAMTOP,
  SAVARS,
  LSOFF,
  LWBOT,
  LWTOP,
  M23PAPP,
  PPC,
  PROG,
  ROM_LD_BYTES,
  ROM_MAIN_LOOP,
  ROM_SA_BYTES,
  ROM_SIGN_ON_WAIT,
  WKEND,
} from '../sysvars';
import { readSamcoupeVariables } from '../vars';
import { readSamcoupeReport } from '../reports';

/** The SAM's Z80 runs at 6MHz - nearly twice a Spectrum's. */
const CPU_HZ = 6_000_000;
/**
 * Frame geometry, all of it derived from the 24MHz crystal rather than typed
 * in: the ASIC draws 48 sixteen-pixel cells across 312 lines, and the CPU gets
 * eight cycles a cell.
 */
const CYCLES_PER_CELL = 8;
const CELLS_PER_LINE = 48;
const CYCLES_PER_LINE = CYCLES_PER_CELL * CELLS_PER_LINE; // 384
const LINES_PER_FRAME = 312;
const CYCLES_PER_FRAME = CYCLES_PER_LINE * LINES_PER_FRAME; // 119808
/** MODE 1/2 FLASH toggles every sixteen frames, as on the Spectrum. */
const FLASH_FRAMES = 16;

/** Frames the ROM is given to reach its prompt before we call it broken. */
const MAX_BOOT_FRAMES = 400;
/** Frames a load is given to finish and hand the machine back. */
const MAX_LOAD_FRAMES = 400;
/** Frames pumped after the RUN, so a short program has run before we return. */
const FRAMES_AFTER_RUN = 12;

/** Where the sysvar block sits: physical page 0, at the section B offset. */
const SYSVAR_PAGE = 0;
const SECTION_B_BASE = 0x4000;

/** Line numbers SAM BASIC accepts; the ROM's own ceiling is 65279. */
const MAX_LINE = 65279;

/**
 * Key chords for the characters the IDE ever types at the editor.
 *
 * SAM BASIC has no keyword mode: commands are spelled out letter by letter,
 * and the editor tokenizes the whole line when ENTER is pressed. So this only
 * needs the letters, the digits, a space and the quote - and the quote is an
 * unshifted key of its own here, not a symbol-shifted one.
 */
const TYPING_KEYS: Record<string, string[]> = {
  ' ': ['Space'],
  '"': ['Quote'],
};
for (let i = 0; i < 26; i++) {
  TYPING_KEYS[String.fromCharCode(65 + i)] = [
    `Key${String.fromCharCode(65 + i)}`,
  ];
}
for (let d = 0; d <= 9; d++) TYPING_KEYS[String(d)] = [`Digit${d}`];

/**
 * The SAM Coupé: the vendored Z80 core over this machine's paged bus, with the
 * ASIC's video, the SAA1099 and the key matrix around it.
 *
 * `runFrame` and `debugStep` are one walk over one budget, from
 * `createMachineLoop`. A debug session opens on any press of Play here, so the
 * debug path *is* the normal path, and everything a frame owes - the profiler's
 * charge, the sound chip's catch-up, the FLASH counter, the picture - is owed
 * by a slice that stops early too.
 *
 * The picture is drawn once at the end of each slice rather than scanline by
 * scanline. Nothing this IDE runs needs a mid-frame palette change to land on
 * the right raster line, and a machine whose screen is 24K in the widest mode
 * pays for that fidelity on every write.
 */
/**
 * Shown when this machine is constructed without its ROM - a designed state
 * rather than a failure, and a rare one: the image ships with the build, and one
 * that fails to load keeps the machine out of the picker with an offer to supply
 * another.
 */
const NO_ROM_NOTICE = noRomNotice(
  "SAM Coupe's 32K ROM",
  'public/roms/samcoupe.rom',
);

export class SamMachine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / CYCLES_PER_FRAME;
  /**
   * The rate this machine actually emits at: a fixed count of samples per
   * frame, {@link frameHz} times a second, not the round number the synthesis
   * is designed around. Claiming 44100 while emitting 882 samples 50.08 times a
   * second would have playback fall progressively behind a running program.
   */
  readonly audioSampleRate = SAA_SAMPLES_PER_FRAME * this.frameHz;

  private readonly memory: SamMemory;
  /** False when the machine was handed no image; see {@link NO_ROM_NOTICE}. */
  private readonly hasRom: boolean;
  private readonly asic = new SamAsic();
  private readonly keyboard = new SamKeyboard();
  private readonly saa = new Saa1099();
  private readonly cpu: Z80Core;

  private frameCount = 0;
  /** Whether this frame's line interrupt has been raised yet. */
  private lineIntDone = false;
  private disposed = false;

  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for the life of a run and {@link stepInstruction} charges the cycles
   * it consumes to the line executing at the time, along with the bytes the
   * machine's own BASIC memory figures moved by while it ran.
   */
  private readonly profile = new LineCostRecorder(
    PROFILE_SLICE_CYCLES,
    () => this.readMemoryStats()?.used ?? null,
  );
  /** Run state, latched when the ROM comes back to its editor loop. */
  private readonly runLatch = new ProgramEndLatch();
  /** Tape blocks waiting for the ROM to ask for them. */
  private pending: { type: number; payload: Uint8Array }[] = [];
  /** ROM font index for {@link readScreenText}, and the CHARS it was built at. */
  private fontSigs: GlyphSignatures | null = null;
  private fontOrigin = -1;

  private readonly frameBuffer = new Uint8ClampedArray(
    DISPLAY_WIDTH * DISPLAY_HEIGHT * 4,
  );
  private imageData: ImageData | null = null;

  private readonly loop = createMachineLoop({
    cyclesPerFrame: CYCLES_PER_FRAME,
    idleEndsSlice: true,
    onSliceStart: (elapsed) => {
      // The ASIC pulls /INT low at the top of every frame. Whether the CPU
      // takes it, and at which instruction boundary, is settled in the step
      // below; the hold window lets a short DI region straddle the boundary and
      // still catch it.
      this.asic.raiseInterrupt(STATUS_INT_FRAME, elapsed);
      this.asic.flashPhase =
        Math.floor(this.frameCount / FLASH_FRAMES) % 2 === 1;
      this.lineIntDone = false;
    },
    step: (elapsed) => {
      this.asic.releaseExpiredInterrupts(elapsed);
      this.raiseLineInterruptIfDue(elapsed);
      if (this.asic.interruptPending && this.cpu.getIFF1() !== 0)
        this.cpu.interrupt(false, 0xff);
      const { t, halted } = this.stepInstruction();
      return { cycles: t, idle: halted };
    },
    onSliceEnd: () => {
      this.renderFrame();
      this.frameCount++;
    },
    currentLine: () => this.currentLine(),
  });

  constructor(opts: { rom: Uint8Array }) {
    this.hasRom = opts.rom.length > 0;
    this.memory = new SamMemory(opts.rom);
    this.memory.clearRam();
    this.cpu = Z80({
      mem_read: this.memory.read,
      mem_write: this.memory.write,
      io_read: (port: number) => this.ioRead(port),
      io_write: (port: number, value: number) => this.ioWrite(port, value),
    });
    this.cpu.reset();
  }

  reset(): void {
    this.memory.clearRam();
    this.asic.reset();
    this.keyboard.releaseAll();
    this.saa.reset();
    this.pending = [];
    this.frameCount = 0;
    this.lineIntDone = false;
    this.reachedMainLoop = false;
    this.atSignOn = false;
    this.loop.reset(); // the carried overrun belongs to the run that ended
    this.runLatch.clear();
    this.cpu.reset();
  }

  /**
   * Raise the line interrupt once the raster has passed the programmed line.
   * The line register counts display lines, so the top border is added back to
   * turn it into a frame position.
   */
  private raiseLineInterruptIfDue(elapsed: number): void {
    if (this.lineIntDone) return;
    const due = this.asic.lineInterruptCycle(CYCLES_PER_LINE);
    if (due === null || elapsed < due) return;
    this.lineIntDone = true;
    this.asic.raiseInterrupt(STATUS_INT_LINE, elapsed);
  }

  /**
   * One CPU step plus the tape trap, returning the cycles consumed (0 when the
   * trap was serviced or the CPU is halted). Shared by both loop paths, so the
   * profiler's charge below is paid on a plain Play as well as in a debug
   * session - a run the IDE performs to check an assistant answer opens no
   * debug session and would otherwise go unmeasured.
   */
  private stepInstruction(): { t: number; halted: boolean } {
    const pc = this.cpu.getPC();
    if (pc === ROM_SIGN_ON_WAIT) this.atSignOn = true;
    // The interpreter is back at its editor loop, so whatever was running has
    // stopped. Latched here beside the traps because no system variable
    // separates a running program from a finished one.
    if (pc === ROM_MAIN_LOOP) {
      this.reachedMainLoop = true;
      this.runLatch.stopped();
    }
    if (this.pending.length > 0 && pc === ROM_LD_BYTES) {
      this.serviceLoadTrap();
      return { t: 0, halted: false };
    }
    if (pc === ROM_SA_BYTES) {
      // Nothing is listening to the tape output, so a program's own SAVE
      // completes silently instead of writing pulses into the void for the
      // seconds a real tape would take.
      this.completeTapeCall(0, true);
      return { t: 0, halted: false };
    }
    if (this.cpu.isHalted()) return { t: 0, halted: true };
    const t = this.cpu.run_instruction();
    const p = this.profile;
    if (p.enabled) {
      p.pending += t;
      if (p.pending >= p.slice) p.sample(this.currentLine());
    }
    return { t, halted: false };
  }

  /**
   * Satisfy one ROM `LDBYTES` call from the queued tape blocks.
   *
   * The call arrives with A holding the block type it expects (1 for a SAM
   * header, 0xFF for data), DE the byte count, HL the destination and carry set
   * for a load. The destination is a "page form" address: the ROM's own loader
   * writes through section C and steps HMPR on every wrap past 0xBFFF, so a
   * block longer than 16K keeps going into the next page. This does the same.
   */
  private serviceLoadTrap(): void {
    const st = this.cpu.getState();
    const wanted = st.a;
    const length = (st.d << 8) | st.e;
    const block = this.pending.find((b) => b.type === wanted);
    if (!block) {
      // The ROM retries headers and errors on data, exactly as with real tape.
      this.completeTapeCall(length, false);
      return;
    }
    let addr = st.ix; // unused by this ROM, but keeps the state object honest
    addr = ((st.h << 8) | st.l) & 0xffff;
    for (let k = 0; k < length; k++) {
      this.memory.write(addr, block.payload[k] ?? 0);
      addr++;
      if (addr >= 0xc000) {
        addr = 0x8000;
        this.memory.hmpr = (this.memory.hmpr + 1) & 0xff;
      }
    }
    this.pending = this.pending.filter((b) => b !== block);
    this.completeTapeCall(length, true);
  }

  /**
   * Return from a trapped tape call as the ROM's own routine would: pop the
   * return address, clear the byte counter, and set carry for success (the
   * routine's whole contract is "carry means the block arrived").
   */
  private completeTapeCall(length: number, ok: boolean): void {
    const st = this.cpu.getState();
    const ret = this.memory.readWord(st.sp);
    st.sp = (st.sp + 2) & 0xffff;
    st.pc = ret;
    if (ok) {
      st.d = 0;
      st.e = 0;
      const end = (((st.h << 8) | st.l) + length) & 0xffff;
      st.h = end >> 8;
      st.l = end & 0xff;
    }
    st.flags.C = ok ? 1 : 0;
    this.cpu.setState(st);
  }

  private ioRead(port: number): number {
    const low = port & 0xff;
    const high = (port >> 8) & 0xff;
    switch (low) {
      case 0xf9:
        // Status port: the interrupt flags, plus the top three bits of the
        // selected keyboard rows - the half of the matrix port 0xFE has no
        // room for.
        return this.keyboard.readStatusKeys(high) | (this.asic.status & 0x1f);
      case 0xfa:
        return this.memory.lmpr;
      case 0xfb:
        return this.memory.hmpr;
      case 0xfc:
        // Bit 7 reads high: it is the MIDI receive flag, and nothing is sending.
        return 0x80 | this.asic.vmpr;
      case 0xfe:
        // Keyboard bits 0-4, the screen-off latch read back, and the EAR input
        // - which reads high, there being no tape in the deck.
        return (
          this.keyboard.readKeyPort(high) |
          (this.asic.border & BORDER_SCREEN_OFF) |
          0x40
        );
      default:
        return 0xff;
    }
  }

  private ioWrite(port: number, value: number): void {
    const low = port & 0xff;
    if ((port & 0x1ff) === 0x1ff) {
      this.saa.selectRegister(value);
      return;
    }
    if (low === 0xff) {
      this.saa.writeData(value);
      return;
    }
    switch (low) {
      case 0xfa:
        this.memory.lmpr = value & 0xff;
        return;
      case 0xfb:
        this.memory.hmpr = value & 0xff;
        return;
      default:
        this.asic.writePort(port, value);
    }
  }

  runFrame(): void {
    this.loop.runFrame();
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    return this.loop.debugStep(opts);
  }

  /** One frame of SAA1099 samples (drains; see saa1099.ts). */
  readAudio(): Float32Array {
    return this.saa.drain();
  }

  /**
   * The BASIC line being executed, from PPC. The ROM parks 0xFFFF there while
   * it runs the edit line, so "no line" and "line 65535" cannot be confused -
   * the machine's own ceiling is 65279.
   */
  currentLine(): number | null {
    const line = this.sysvarWord(PPC);
    return line >= 1 && line <= MAX_LINE ? line : null;
  }

  /**
   * A system variable, read off physical page 0 rather than through the Z80's
   * window. The sysvars live in section B, which is page 0 whenever the ROM's
   * own LMPR setting is in force - but a program that has paged something else
   * in there has not moved them, and reading through the window would return
   * whatever it paged in.
   */
  private sysvarByte(addr: number): number {
    return this.memory.pageByte(SYSVAR_PAGE, addr - SECTION_B_BASE);
  }

  private sysvarWord(addr: number): number {
    return this.sysvarByte(addr) | (this.sysvarByte(addr + 1) << 8);
  }

  /** Draw the whole picture into the framebuffer. */
  private renderFrame(): void {
    renderScreen(
      this.asic,
      this.memory.hmpr,
      (offset) => this.screenByte(offset),
      this.frameBuffer,
    );
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.hasRom) {
      drawRomNotice(ctx, DISPLAY_WIDTH, DISPLAY_HEIGHT, NO_ROM_NOTICE);
      return;
    }
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    this.imageData.data.set(this.frameBuffer);
    ctx.putImageData(this.imageData, 0, 0);
  }

  /**
   * The screen as characters, by matching the ROM font the boot unpacked into
   * RAM. See screenText.ts for what that can and cannot recover.
   */
  readScreenText(): MachineScreenText | null {
    // The font is unpacked into RAM at boot and can be moved or redefined, so
    // the index is built from wherever CHARS points now and rebuilt whenever
    // that pointer changes.
    const charsBase = this.sysvarWord(CHARS);
    if (charsBase !== this.fontOrigin) {
      this.fontOrigin = charsBase;
      this.fontSigs = null;
    }
    this.fontSigs ??= samcoupeFontSignatures(
      (addr) => this.readAnywhere(addr),
      charsBase,
    );
    const layout = this.textLayout();
    if (!layout) return null;
    return readSamcoupeScreenText({
      signatures: this.fontSigs,
      mode: this.asic.mode,
      layout,
      paper: this.sysvarByte(M23PAPP) & 0x0f,
      readScreen: (offset) => this.screenByte(offset),
    });
  }

  /**
   * The text grid the ROM is currently drawing on, from its own `CSIZE` and
   * window variables. Null when the cell is not the eight-pixel-wide,
   * at-least-eight-tall shape a glyph fits in - a program that has set `CSIZE`
   * to a condensed or double-height cell is not drawing the stock font, and
   * reporting a mis-sliced screen would be worse than reporting none.
   */
  private textLayout(): SamTextLayout | null {
    const cellHeight = this.sysvarByte(CSIZE);
    const cellWidth = this.sysvarByte(CSIZE + 1);
    if (cellWidth !== 8 || cellHeight < 8 || cellHeight > 16) return null;
    const lowerTop = this.sysvarByte(LWTOP);
    const rows = this.sysvarByte(LWBOT) + 1;
    if (rows < 1 || rows * cellHeight > DISPLAY_HEIGHT + cellHeight)
      return null;
    return {
      // MODE 3 is the only mode whose pixels are not drawn double width, so it
      // is the only one that fits twice the columns.
      cols: this.asic.mode === 3 ? 64 : 32,
      rows,
      cellHeight,
      lowerTop,
      lowerOffset: this.sysvarByte(LSOFF),
    };
  }

  /** A byte of the picture, by offset from the start of the display page. */
  private screenByte(offset: number): number {
    const page = this.asic.screenPage + Math.floor(offset / PAGE_BYTES);
    return this.memory.pageByte(page, offset % PAGE_BYTES);
  }

  /**
   * The two variable areas the ROM keeps between the program and its string
   * and array variables, read off the machine as it stands.
   *
   * They are saved with the program so the load can put them back: the ROM's
   * loader deletes everything from PROG to the edit line and rebuilds it to the
   * lengths in the header, and a machine left without these areas hangs on its
   * next `RUN`. A reset Coupé has 92 bytes in the first and 512 in the second
   * before a program declares anything at all, which is why they cannot simply
   * be written as empty.
   */
  private readVariableAreas(): { numeric: Uint8Array; other: Uint8Array } {
    const nvars = this.farPointer(NVARS);
    const numend = this.farPointer(NUMEND);
    const savars = this.farPointer(SAVARS);
    return {
      numeric: this.readFar(nvars, numend.linear - nvars.linear),
      other: this.readFar(numend, savars.linear - numend.linear),
    };
  }

  /**
   * One of the ROM's three-byte pointers: a 16K page and an address it presents
   * in the 0x8000-0xBFFF window. The linear form is what lengths are measured
   * in.
   */
  private farPointer(addr: number): {
    page: number;
    offset: number;
    linear: number;
  } {
    const page = this.sysvarByte(addr);
    const offset = this.sysvarWord(addr + 1) & 0x3fff;
    return { page, offset, linear: page * PAGE_BYTES + offset };
  }

  /** `count` bytes from a page-form pointer, following the page wrap. */
  private readFar(
    from: { page: number; offset: number },
    count: number,
  ): Uint8Array {
    const out = new Uint8Array(Math.max(0, count));
    let { page, offset } = from;
    for (let i = 0; i < out.length; i++) {
      out[i] = this.memory.pageByte(page, offset);
      offset++;
      if (offset >= PAGE_BYTES) {
        offset = 0;
        page++;
      }
    }
    return out;
  }

  /** A byte at a flat BASIC-area address: page * 16K plus the offset in it. */
  private flatByte(addr: number): number {
    return this.memory.pageByte(
      Math.floor(addr / PAGE_BYTES),
      addr % PAGE_BYTES,
    );
  }

  /** A byte at a Z80 address, taking sysvar-page reads off page 0. */
  private readAnywhere(addr: number): number {
    if (addr >= SECTION_B_BASE && addr < 0x8000) return this.sysvarByte(addr);
    return this.memory.peek(addr);
  }

  /**
   * Run whole frames until the ROM has booted.
   *
   * Two waits stand between a reset and BASIC. The first is the ROM's own: it
   * sizes the RAM a page at a time, which takes the best part of a second of
   * emulated time. The second needs answering - the sign-on screen
   * ("MILES GORDON TECHNOLOGY PLC … SAM Coupé 256K") holds the machine in a
   * keypress loop, exactly as on real hardware, and BASIC does not start until
   * a key is pressed. So one is pressed.
   *
   * "Booted" is then the interpreter reaching the top of its editor loop - a
   * precise signal, unlike waiting for pixels to appear.
   */
  bootToReady(): void {
    // Nothing to boot into and nothing to type at: a machine handed no image
    // shows its notice instead (see the file's NO_ROM_NOTICE), and every path
    // that would drive a ROM that is not there returns rather than failing
    // inside it.
    if (!this.hasRom) return;
    this.reachedMainLoop = false;
    this.atSignOn = false;
    let dismissed = false;
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (this.reachedMainLoop) return;
      if (this.atSignOn && !dismissed) {
        dismissed = true;
        this.tapKeys(['Space']);
      }
    }
    throw new Error('SAM Coupé ROM did not boot - emulator bug');
  }

  /** Set the first time the CPU reaches the editor loop after a reset. */
  private reachedMainLoop = false;
  /** Set while the ROM is holding at its sign-on screen. */
  private atSignOn = false;

  /** Hold a key chord for a few frames, then release it and let it settle. */
  private tapKeys(codes: string[], holdFrames = 3): void {
    for (const c of codes) this.keyboard.setKey(c, true);
    for (let i = 0; i < holdFrames; i++) this.runFrame();
    for (const c of codes) this.keyboard.setKey(c, false);
    for (let i = 0; i < 3; i++) this.runFrame();
  }

  /**
   * Type a line of SAM BASIC at the editor and submit it. The editor-loop flag
   * is cleared just before the ENTER, so a caller can wait for the interpreter
   * to come back for the next line - which is how "the command has finished"
   * is known here.
   */
  private typeLine(text: string): void {
    for (const ch of text) {
      const token = TYPING_KEYS[ch];
      if (token) this.tapKeys(token);
    }
    this.reachedMainLoop = false;
    this.tapKeys(['Enter'], 2);
  }

  /**
   * Boot, then load and run a program exactly as a cassette would.
   *
   * The image's blocks are queued for the tape trap and `LOAD ""` is typed at
   * the editor - the machine's default device is tape (`CHIT` in the ROM's
   * text.asm initialises it to "T"), so no device letter is needed. Going
   * through the ROM's own loader rather than writing the program area directly
   * is what makes this correct: SAM BASIC's program, variables and heap are
   * addressed in a 19-bit page form with half a dozen pointers behind them, and
   * the loader sets all of them.
   *
   * The program is then started with a typed `RUN`, not with the header's
   * auto-run: `RUN` performs the variable and stack reset that a plain jump to
   * the auto-run line skips, and it leaves a window between the load finishing
   * and the program starting for the memory blocks to be written into.
   */
  loadProgram(
    image: Uint8Array,
    opts?: { blocks?: readonly Block[]; autoStart?: number | null },
  ): void {
    // Nothing to boot into and nothing to type at: a machine handed no image
    // shows its notice instead (see the file's NO_ROM_NOTICE), and every path
    // that would drive a ROM that is not there returns rather than failing
    // inside it.
    if (!this.hasRom) return;
    this.reset();
    this.bootToReady();
    // Queue the program with the header's auto-run stripped. A tape whose
    // header names a start line is GO TO'd by the loader the moment the last
    // byte arrives, and that path skips the variable and stack reset; RUN,
    // typed below, performs it.
    const { file } = parseSamFileWithReport(image);
    if (!file) throw new Error('SAM Coupé image carries no BASIC program');
    this.pending = samBlocks(file.program, {
      name: file.name,
      autoStart: null,
      variableAreas: this.readVariableAreas(),
    }).map((b) => ({
      type: b.type,
      // The trap hands the ROM the block's contents; the type byte and the
      // parity byte around them are the tape's framing, which never reaches
      // memory.
      payload: b.bytes.subarray(1, b.bytes.length - 1),
    }));
    this.typeLine('LOAD ""');
    // Wait for the whole command, not just for the blocks: the loader prints
    // the file name and auto-lists the program it has just read, and typing
    // RUN over the top of that loses the keystrokes.
    for (
      let i = 0;
      i < MAX_LOAD_FRAMES && (this.pending.length > 0 || !this.reachedMainLoop);
      i++
    )
      this.runFrame();
    if (this.pending.length > 0) {
      this.pending = [];
      throw new Error('SAM Coupé ROM never reached the tape load trap');
    }
    // Memory blocks (machine code or data at a fixed address, alongside the
    // BASIC program - see Block) go in after the program has loaded and before
    // RUN starts it, which is where a real loader would poke them.
    for (const block of opts?.blocks ?? []) {
      for (let k = 0; k < block.bytes.length; k++)
        this.memory.write((block.address + k) & 0xffff, block.bytes[k]!);
    }
    // Armed after every command line this load typed and before the one that
    // starts the program: the editor waiting for these keystrokes is itself
    // sitting in the main loop, so the next sighting of it is this program
    // ending.
    this.runLatch.arm();
    const autoStart = opts?.autoStart;
    this.typeLine(typeof autoStart === 'number' ? `RUN ${autoStart}` : 'RUN');
    for (let i = 0; i < FRAMES_AFTER_RUN; i++) this.runFrame();
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

  setJoystick(_mode: JoystickMode, state: JoystickState): void {
    this.keyboard.setJoystick(state);
  }

  isProgramRunning(): boolean | null {
    if (this.disposed) return null;
    return this.runLatch.read(this.currentLine() !== null);
  }

  /**
   * SAM BASIC's variables, off the machine's own two areas.
   *
   * Read through the pages rather than through the CPU's window: the areas
   * begin in BASIC's base page but grow across the three above it, and the
   * window shows at most two of them at a time.
   */
  readVariables(): MachineVariable[] {
    return readSamcoupeVariables({
      read: (addr) => this.flatByte(addr),
      nvars: this.farPointer(NVARS).linear,
      numend: this.farPointer(NUMEND).linear,
      savars: this.farPointer(SAVARS).linear,
      eline: this.farPointer(ELINE).linear,
    });
  }

  readReport(): MachineReport {
    return readSamcoupeReport({
      read: (addr) => this.sysvarByte(addr),
      readWord: (addr) => this.sysvarWord(addr),
    });
  }

  /**
   * What the BASIC area is spending, and what is left - the ROM's own
   * arithmetic, which is what `PRINT FREE` answers with.
   *
   * `GETROOM` in tadjm.asm measures the free figure from `WKEND` to `RAMTOP`
   * with a borrow set, so the byte at RAMTOP is not offered; that one-byte
   * shortfall is kept rather than tidied away, because a figure that disagrees
   * with the machine's own FREE is worse than one that is a byte pessimistic.
   * Everything below WKEND is charged as used, which on this machine means the
   * program, all three variable areas and the workspace above them - a program
   * whose cost is entirely in strings shows it here rather than reading as one
   * that allocates nothing.
   */
  readMemoryStats(): MachineMemoryStats | null {
    const prog = this.farPointer(PROG).linear;
    const wkend = this.farPointer(WKEND).linear;
    const ramtop = this.farPointer(RAMTOP).linear;
    const used = wkend - prog;
    const free = ramtop - wkend - 1;
    // Implausible pointers mean the ROM has not sized itself yet.
    if (prog <= 0 || used <= 0 || free < 0) return null;
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
    if (!enabled) this.memory.activity.clear();
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    if (!this.memory.activity.enabled) return null;
    return this.memory.activity.drain(recycle);
  }

  /** Direct access for tests and debugging. */
  get mem(): SamMemory {
    return this.memory;
  }

  get video(): SamAsic {
    return this.asic;
  }

  /** The last frame's rendered RGBA pixels. For tests and debugging. */
  get frame(): Uint8ClampedArray {
    return this.frameBuffer;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
    this.saa.reset();
    this.imageData = null;
    this.pending = [];
    this.runLatch.clear();
  }
}
