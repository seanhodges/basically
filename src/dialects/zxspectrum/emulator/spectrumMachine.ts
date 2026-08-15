import Z80 from '../../../emulator/z80/z80core.js';
import type { Z80Core } from '../../../emulator/z80/z80core.js';
import type {
  DebugStepOptions,
  DebugStepResult,
  JoystickMode,
  JoystickState,
  MachineEmulator,
  MachineFileStore,
  MachineMemoryStats,
  MachineReport,
  MachineScreenText,
  LineCost,
  MachineVariable,
  MemoryBlock,
  TapeFile,
} from '../../types';
import { VfsTapeDeck } from './tapeDeck';
import { SpectrumMemory } from './memory';
import {
  LineCostRecorder,
  PROFILE_SLICE_CYCLES,
} from '../../../emulator/lineCostRecorder';
import { readSpectrumVariables } from '../vars';
import { readSpectrumReport } from '../reports';
import { readSpectrumScreenText, spectrumFontSignatures } from './screenText';
import type { GlyphSignatures } from '../../../emulator/fontMatcher';
import { SpectrumKeyboard } from './keyboard';
import { applySinclairJoystick, kempstonByte } from './joystick';
import { Beeper, BEEPER_SAMPLES_PER_FRAME } from './beeper';
import {
  renderScanline,
  renderDisplay,
  DISPLAY_WIDTH,
  DISPLAY_HEIGHT,
} from './display';
import { buildTap, codeTap, parseTap } from '../tapfile';
import {
  PPC,
  PROG,
  STKEND,
  RAMTOP,
  ROM_LD_BYTES as LD_BYTES,
  ROM_SA_BYTES as SA_BYTES,
  ROM_REPORT_R as REPORT_R,
} from '../sysvars';
import { injectBlocks, minBlockAddress } from './blockInject';

const CPU_HZ = 3_500_000;
const TSTATES_PER_FRAME = 69888; // 3.5MHz / ~50.08Hz (48K ULA frame)
const TSTATES_PER_LINE = 224; // one 48K raster line (312 lines x 224 = 69888)
// T-states from the frame interrupt to the ULA fetching the first display line.
// Display line `sy` (0..191) is fetched at DISPLAY_START_T + sy * TSTATES_PER_LINE;
// sampling the screen then is what makes mid-frame attribute rewrites (the
// multicolour / "rainbow" effect) render at per-scanline resolution.
const DISPLAY_START_T = 14336;
const FLASH_FRAMES = 16; // FLASH attribute toggles every 16 frames
const MAX_BOOT_FRAMES = 200;

/**
 * The ZX Spectrum 48K: Z80 + 16K ROM + 48K RAM + the ULA pieces the unmodified
 * ROM needs to boot and run BASIC:
 *
 *  - One maskable interrupt (IM1 / RST 38h) per 50Hz frame, driving the
 *    keyboard scan and the FRAMES counter.
 *  - Keyboard matrix and border on port 0xFE.
 *  - A flash-load trap at the ROM's LD-BYTES routine: while a program is queued
 *    the trap satisfies the header and data block reads directly, so LOAD ""
 *    behaves exactly as a cassette load (auto-running when the .TAP header
 *    carries an auto-start line).
 *
 * The display is generated a scanline at a time as the frame runs (see runFrame
 * and display.ts): each display line is drawn when the CPU cycle counter reaches
 * the T-state the ULA would fetch it, so a program that rewrites screen or
 * attribute memory mid-frame - the multicolour / "rainbow" raster technique -
 * shows a different colour on each scanline rather than one frozen per-cell
 * colour. Contended-memory timing is still not modelled (it does not affect the
 * visible result here).
 */
export class SpectrumMachine implements MachineEmulator {
  readonly displayWidth = DISPLAY_WIDTH;
  readonly displayHeight = DISPLAY_HEIGHT;
  readonly frameHz = CPU_HZ / TSTATES_PER_FRAME;
  /**
   * The rate this machine actually emits at: a fixed count of samples per frame,
   * {@link frameHz} times a second. Not the round number the synthesis is
   * designed around - reporting that instead would have the host consume
   * fractionally slower than the machine produces, and playback would fall
   * further behind for as long as the program ran. The cost is that pitch sits
   * within a quarter-percent of the synth's design rate, far below audible.
   */
  readonly audioSampleRate = BEEPER_SAMPLES_PER_FRAME * this.frameHz;

  private readonly memory: SpectrumMemory;
  private readonly keyboard = new SpectrumKeyboard();
  private readonly cpu: Z80Core;
  /** ULA loudspeaker synthesis, driven by bit 4 of port 0xFE writes. */
  private readonly beeper = new Beeper();
  /** Cycle offset within the current frame, exposed to the IO write trap. */
  private frameCycle = 0;
  private border = 7;
  /** Kempston joystick port byte (active-high: bit0 right … bit4 fire). */
  private kempston = 0;
  /**
   * Per-BASIC-line cost recorder for the profiler. Off by default; the run loop
   * arms it for the life of a run, and {@link stepInstruction} charges the
   * T-states it consumes to the line executing at the time.
   */
  private readonly profile = new LineCostRecorder(
    'cycles',
    PROFILE_SLICE_CYCLES,
  );

  /**
   * T-states the previous frame overran its budget by, owed back to this one.
   * An instruction cannot be cut in half at a frame boundary, so a frame always
   * ends a few T-states late; discarding that gains time every frame. Zeroed
   * rather than carried when a HALT ends a frame early - the CPU idles until
   * the next interrupt, so nothing is owed.
   */
  private debt = 0;
  private frameCount = 0;
  private imageData: ImageData | null = null;
  /**
   * Display framebuffer, filled scanline-by-scanline during runFrame and blitted
   * by renderTo. Persistent so rendering is decoupled from the host's rAF call.
   */
  private readonly frameBuffer = new Uint8ClampedArray(
    DISPLAY_WIDTH * DISPLAY_HEIGHT * 4,
  );
  private disposed = false;
  /** ROM font index for {@link readScreenText}; built on first use. */
  private fontSigs: GlyphSignatures | null = null;
  /** Header + data blocks waiting to be injected at the next LOAD. */
  private pending: { header: Uint8Array; data: Uint8Array } | null = null;
  /**
   * The virtual filesystem behind the program's own data SAVE/LOAD (CODE and
   * array blocks). Null when the IDE supplies no file store, in which case
   * both tape routines behave exactly as real hardware with no tape.
   */
  private readonly deck: VfsTapeDeck | null;

  constructor(opts: { rom: Uint8Array; files?: MachineFileStore }) {
    this.deck = opts.files ? new VfsTapeDeck(opts.files) : null;
    this.memory = new SpectrumMemory(opts.rom);
    this.cpu = Z80({
      mem_read: this.memory.read,
      mem_write: this.memory.write,
      io_read: this.ioRead,
      io_write: (port: number, value: number) => {
        if ((port & 0x01) === 0) {
          this.border = value & 0x07;
          // Bit 4 is the loudspeaker; record the flip at the current cycle so
          // readAudio can replay the square wave (see beeper.ts).
          this.beeper.write(this.frameCycle, value);
        }
      },
    });
    this.cpu.reset();
  }

  reset(): void {
    this.memory.clearRam();
    this.keyboard.releaseAll();
    this.pending = null;
    this.deck?.rewind();
    this.border = 7;
    this.kempston = 0;
    this.frameCount = 0;
    this.frameCycle = 0;
    this.beeper.reset();
    this.cpu.reset();
  }

  /** Z80 IO read decode (ULA keyboard/EAR + Kempston joystick). */
  private ioRead = (port: number): number => {
    if ((port & 0x01) === 0) {
      // ULA: keyboard on the high address byte (EAR/bits 5-7 read high).
      return this.keyboard.readPort((port >> 8) & 0xff);
    }
    // Kempston joystick: loosely decoded on A5 low (canonical port 0x1F). Odd
    // ports only here - even ports were claimed by the ULA above - so this can't
    // shadow the keyboard. Bits 5-7 read 0, as on real hardware.
    if ((port & 0x0020) === 0) return this.kempston;
    return 0xff;
  };

  /**
   * Drive a joystick interface. `native` is the Sinclair interface (joystick 1
   * mapped to keys 1–5 on the matrix); `kempston` sets the active-high port byte
   * read at $1F.
   */
  setJoystick(mode: JoystickMode, state: JoystickState): void {
    if (mode === 'kempston') this.kempston = kempstonByte(state);
    else applySinclairJoystick(this.keyboard, state);
  }

  /**
   * One CPU step plus the flash-load trap, returning the T-states consumed (0
   * when the trap was serviced or the CPU is halted). `halted` is set when the
   * Z80 is in HALT - the frame loop idles until the next interrupt. Shared by
   * runFrame and debugStep so they never diverge.
   */
  private stepInstruction(): { t: number; halted: boolean } {
    const step = this.stepUnmeasured();
    // Charge the T-states to the BASIC line executing them. Here rather than in
    // debugStep because a run the IDE performs to check an assistant answer
    // deliberately opens no debug session, and would otherwise go unmeasured.
    const p = this.profile;
    if (p.enabled) {
      p.pending += step.t;
      if (p.pending >= p.slice) p.sample(this.currentLine());
    }
    return step;
  }

  /** The step itself: the traps, then one instruction (or an idle HALT). */
  private stepUnmeasured(): { t: number; halted: boolean } {
    const pc = this.cpu.getPC();
    if (this.pending && pc === LD_BYTES) {
      this.serviceLoadTrap();
      return { t: 0, halted: false };
    }
    // Program-driven data SAVE: offer the block to the VFS tape deck. When it
    // declines (BASIC program saves, nonstandard blocks) the ROM runs the real
    // SA-BYTES, exactly as before.
    if (this.deck && pc === SA_BYTES && this.serviceSaveTrap()) {
      return { t: 0, halted: false };
    }
    // Program-driven LOAD with no IDE injection queued: serve blocks from the
    // VFS. Armed only while files exist, so an empty VFS keeps the authentic
    // poll-the-tape-until-BREAK behavior.
    if (!this.pending && pc === LD_BYTES && this.deck?.hasFiles()) {
      this.serviceDeckLoad();
      return { t: 0, halted: false };
    }
    if (this.cpu.isHalted()) return { t: 0, halted: true };
    return { t: this.cpu.run_instruction(), halted: false };
  }

  runFrame(): void {
    // Start where the last frame actually stopped, not at zero: the overrun is
    // real emulated time, and it also puts the scanline fetch points below on
    // the frame's true timeline.
    let cycles = this.debt;
    // One maskable interrupt per frame (IM1) when interrupts are enabled.
    if (this.cpu.getIFF1()) this.cpu.interrupt(false, 0xff);

    const flashPhase = Math.floor(this.frameCount / FLASH_FRAMES) % 2 === 1;
    let nextLine = 0;
    while (cycles < TSTATES_PER_FRAME) {
      this.frameCycle = cycles; // timestamp any beeper write in this instruction
      const { t, halted } = this.stepInstruction();
      if (halted) {
        this.debt = 0; // idle until the next frame's interrupt; nothing owed
        break;
      }
      cycles += t;
      // Draw every display line whose ULA fetch time we've now reached. The
      // line is sampled at most one instruction (<=~23 T << 224 T/line) after
      // its exact fetch point, so mid-frame attribute writes land on the right
      // scanline.
      while (
        nextLine < DISPLAY_HEIGHT &&
        cycles >= DISPLAY_START_T + nextLine * TSTATES_PER_LINE
      ) {
        renderScanline(this.memory, this.frameBuffer, nextLine, flashPhase);
        nextLine++;
      }
    }
    if (cycles >= TSTATES_PER_FRAME) this.debt = cycles - TSTATES_PER_FRAME;
    // HALT before the frame ended: fill any lines we never reached from the
    // final memory contents.
    while (nextLine < DISPLAY_HEIGHT) {
      renderScanline(this.memory, this.frameBuffer, nextLine, flashPhase);
      nextLine++;
    }
    this.frameCount++;
  }

  /** Mono beeper samples synthesized over the last frame (drains; see beeper.ts). */
  readAudio(): Float32Array {
    return this.beeper.render(TSTATES_PER_FRAME);
  }

  /**
   * Fill the framebuffer from the current memory contents in one pass. Used by
   * debugStep, where the frame is paused mid-way and scanline timing is moot -
   * the visible screen is just a snapshot of wherever execution stopped.
   */
  private renderWholeFrame(): void {
    const flashPhase = Math.floor(this.frameCount / FLASH_FRAMES) % 2 === 1;
    renderDisplay(this.memory, this.frameBuffer, flashPhase);
  }

  /**
   * The BASIC line currently being executed, read from PPC. Returns null when
   * it isn't a valid program line (e.g. before a program has run).
   */
  currentLine(): number | null {
    const lineNo = this.memory.rawReadWord(PPC);
    return lineNo >= 1 && lineNo <= 9999 ? lineNo : null;
  }

  debugStep(opts: DebugStepOptions): DebugStepResult {
    let cycles = this.debt;
    // Match runFrame's once-per-frame interrupt so timing/keyboard scan hold.
    if (this.cpu.getIFF1()) this.cpu.interrupt(false, 0xff);

    // In run mode, ignore breakpoints until execution has left the line we
    // resumed from, so Continue off a breakpointed line doesn't re-trigger on
    // the spot but still re-pauses when the loop comes back around.
    let armed = opts.fromLine === null;
    while (cycles < TSTATES_PER_FRAME) {
      this.frameCycle = cycles; // timestamp any beeper write in this instruction
      const { t, halted } = this.stepInstruction();
      if (halted) {
        this.debt = 0;
        break;
      }
      cycles += t;
      const line = this.currentLine();
      if (line === null) continue;
      if (opts.mode === 'step') {
        if (opts.fromLine === null || line !== opts.fromLine) {
          this.debt = 0; // pausing abandons the rest of the slice
          this.frameCount++;
          this.renderWholeFrame();
          return { paused: true, line };
        }
      } else {
        if (!armed && line !== opts.fromLine) armed = true;
        if (armed && opts.breakpoints.has(line)) {
          this.debt = 0;
          this.frameCount++;
          this.renderWholeFrame();
          return { paused: true, line };
        }
      }
    }
    if (cycles >= TSTATES_PER_FRAME) this.debt = cycles - TSTATES_PER_FRAME;
    this.frameCount++;
    this.renderWholeFrame();
    return { paused: false, line: this.currentLine() };
  }

  /**
   * Satisfy one ROM LD-BYTES call: A holds the expected flag (0x00 header /
   * 0xFF data), IX the destination, DE the byte count. Fill the block, advance
   * IX, and return to the caller with carry set (success).
   */
  private serviceLoadTrap(): void {
    const st = this.cpu.getState();
    const length = (st.d << 8) | st.e;
    const block = st.a === 0x00 ? this.pending!.header : this.pending!.data;
    for (let k = 0; k < length; k++) {
      this.memory.write((st.ix + k) & 0xffff, block[k] ?? 0);
    }
    if (st.a !== 0x00) {
      // Data block loaded: wipe the "Program: …" load chatter and reset the
      // print position so the program auto-runs onto a clean screen.
      this.clearScreen();
      this.pending = null;
    }

    const ret = this.memory.readWord(st.sp);
    st.sp = (st.sp + 2) & 0xffff;
    st.pc = ret;
    st.ix = (st.ix + length) & 0xffff;
    st.d = 0;
    st.e = 0;
    st.flags.C = 1; // success
    this.cpu.setState(st);
  }

  /**
   * Offer one ROM SA-BYTES call (A = flag, IX = start, DE = length) to the
   * VFS tape deck. Captured: complete the call like a successful save -
   * pop the return address, advance IX, set carry - and return true.
   * Declined (program saves): return false and let the ROM execute SA-BYTES
   * against the real (absent) tape.
   */
  private serviceSaveTrap(): boolean {
    const st = this.cpu.getState();
    const length = (st.d << 8) | st.e;
    const payload = new Uint8Array(length);
    for (let k = 0; k < length; k++) {
      payload[k] = this.memory.read((st.ix + k) & 0xffff);
    }
    if (!this.deck!.recordBlock(st.a, payload)) return false;
    const ret = this.memory.readWord(st.sp);
    st.sp = (st.sp + 2) & 0xffff;
    st.pc = ret;
    st.ix = (st.ix + length) & 0xffff;
    st.d = 0;
    st.e = 0;
    st.flags.C = 1; // saved
    this.cpu.setState(st);
    return true;
  }

  /**
   * Satisfy one ROM LD-BYTES call from the VFS tape deck. A matching block
   * loads like {@link serviceLoadTrap}; a mismatched block returns carry
   * clear (the ROM retries headers and errors on data, as with real tape);
   * a tape cycled twice with no match jumps to REPORT-R so `LOAD "missing"`
   * raises "R Tape loading error" instead of spinning un-BREAK-ably.
   */
  private serviceDeckLoad(): void {
    const st = this.cpu.getState();
    const length = (st.d << 8) | st.e;
    const res = this.deck!.nextBlock(st.a);
    if (res.kind === 'abort') {
      // RST 8 error path: the ROM restores SP from ERR_SP itself.
      st.pc = REPORT_R;
      this.cpu.setState(st);
      return;
    }
    if (res.kind === 'block' && res.payload.length >= length) {
      for (let k = 0; k < length; k++) {
        this.memory.write((st.ix + k) & 0xffff, res.payload[k]!);
      }
      st.ix = (st.ix + length) & 0xffff;
      st.d = 0;
      st.e = 0;
      st.flags.C = 1; // success
    } else {
      st.flags.C = 0; // wrong/short block: tape error for this call
    }
    const ret = this.memory.readWord(st.sp);
    st.sp = (st.sp + 2) & 0xffff;
    st.pc = ret;
    this.cpu.setState(st);
  }

  /**
   * CHARS (0x5C36) becomes 0x3C00 once the boot init has run (the RAM test
   * first fills all RAM with 0x02, so screen contents are not a reliable
   * signal on their own). Interrupts are enabled by then.
   */
  private isInitialised(): boolean {
    return this.memory.readWord(0x5c36) === 0x3c00 && this.cpu.getIFF1() === 1;
  }

  /** True once the bottom editing line carries the copyright prompt. */
  private promptDrawn(): boolean {
    for (let xb = 0; xb < 32; xb++) {
      for (let r = 0; r < 8; r++) {
        const y = 23 * 8 + r;
        const addr =
          0x4000 |
          ((y & 0x07) << 8) |
          ((y & 0x38) << 2) |
          ((y & 0xc0) << 5) |
          xb;
        if (this.memory.read(addr) !== 0) return true;
      }
    }
    return false;
  }

  /** Run whole frames until the ROM has booted to the ready prompt. */
  bootToReady(): void {
    let initFrame = -1;
    for (let frame = 0; frame < MAX_BOOT_FRAMES; frame++) {
      this.runFrame();
      if (initFrame < 0) {
        if (this.isInitialised()) initFrame = frame;
      } else if (frame - initFrame >= 4 && this.promptDrawn()) {
        return;
      }
    }
    throw new Error('ZX Spectrum ROM did not boot - emulator bug');
  }

  /** Hold a key chord for a few frames, then release it. */
  private tapKeys(codes: string[], holdFrames = 4): void {
    for (const c of codes) this.keyboard.setKey(c, true);
    for (let i = 0; i < holdFrames; i++) this.runFrame();
    for (const c of codes) this.keyboard.setKey(c, false);
    for (let i = 0; i < 4; i++) this.runFrame();
  }

  loadProgram(
    image: Uint8Array,
    opts?: {
      blocks?: readonly MemoryBlock[];
      autoStart?: number | null;
      tapeFiles?: readonly TapeFile[];
    },
  ): void {
    this.reset(); // also rewinds the VFS tape deck
    this.bootToReady();
    // Inject without an auto-start line, then drive RUN: the LOAD-with-LINE
    // auto-run path skips the CLEAR that sets up the variable/stack pointers,
    // whereas RUN performs it, so variables behave correctly.
    const { program } = parseTap(image);
    const { header, data } = parseTap(buildTap(program, { autoStart: null }));
    this.pending = { header, data };
    // Type LOAD "" - J is LOAD in keyword mode, then two SYMBOL SHIFT+P quotes.
    this.tapKeys(['KeyJ']);
    this.tapKeys(['SymShift', 'KeyP']);
    this.tapKeys(['SymShift', 'KeyP']);
    this.tapKeys(['Enter']);
    for (let i = 0; i < 200 && this.pending; i++) this.runFrame();
    if (this.pending) {
      this.pending = null;
      throw new Error('ZX Spectrum ROM never reached the LOAD trap');
    }
    // Memory blocks (machine code / data at a fixed address, alongside the
    // BASIC program - see MemoryBlock) are written directly into RAM now,
    // after the BASIC program itself has loaded and before RUN starts it -
    // mirroring how a real loader pokes code in once the tape has finished.
    //
    // A block below the ROM's default RAMTOP sits inside the RAM that
    // GO SUB/FOR-NEXT loop control records use: that stack grows DOWN from
    // just below RAMTOP as the program nests calls/loops, so it can grow
    // straight over the block. A real loader protects against this with
    // CLEAR <addr>, which lowers RAMTOP to addr and re-bases the machine
    // stack below it, leaving everything from addr+1 upward outside BASIC's
    // reach.
    //
    // Order matters, and was the opposite of the first guess - verified
    // empirically (see spectrumMachine.test.ts "keeps a block below RAMTOP
    // intact…"): CLEAR must run *before* the block bytes are written, not
    // after. Typing the CLEAR command's own keystrokes still runs several
    // frames of ordinary keyboard-scan/interrupt processing on the CURRENT
    // (old, higher) RAMTOP-based machine stack, before the statement is even
    // submitted - writing the block first and protecting it with CLEAR
    // afterward left a window where that in-flight keystroke processing
    // could still clobber a block sitting close to the old RAMTOP. Issuing
    // CLEAR first re-bases RAMTOP and the machine stack immediately, so by
    // the time the block bytes are written, nothing subsequent (RUN's own
    // implicit variable/stack reset included - see the comment above -
    // preserves whatever RAMTOP CLEAR just set) ever touches memory above
    // the new RAMTOP again.
    const blocks = opts?.blocks;
    if (blocks && blocks.length > 0) {
      const minBlockAddr = minBlockAddress(blocks);
      if (minBlockAddr !== null) {
        const defaultRamtop = this.memory.readWord(RAMTOP);
        if (minBlockAddr <= defaultRamtop) this.typeClear(minBlockAddr - 1);
      }
      injectBlocks(this.memory, blocks);
      // Also place each block on the VFS tape as a CODE file, so the program's
      // own `LOAD "name" CODE` (common in tape front-ends) finds it - the ROM
      // matches the header name/type itself. The block name doubles as the tape
      // name; a name rewritten by import sanitization won't match a LOAD by its
      // original name, but the common case (already an identifier) does.
      if (this.deck) {
        for (const block of blocks) {
          this.deck.addFile(
            block.name,
            codeTap(block.name, block.address, block.bytes),
            'code',
          );
        }
      }
    }
    // Mount any preserved tape files (the loader, secondary programs, data
    // arrays off a multi-part .TAP - see TapeFile) on the deck too, so the
    // program's own LOAD ""/LOAD "name" requests are served as they would be
    // off the original multi-part tape. Each file's own header (name/type)
    // lives inside its .TAP payload, which the ROM matches against; the VFS
    // key only needs to be unique per file.
    const tapeFiles = opts?.tapeFiles;
    if (this.deck && tapeFiles && tapeFiles.length > 0) {
      tapeFiles.forEach((f, i) =>
        this.deck!.addFile(`imported-tape-${i + 1}`, f.tap, f.kind),
      );
    }
    // Start the program with a proper RUN (R is the RUN keyword in K mode). A
    // `RUN <line>` starts from the .TAP's auto-start line (Interface 1 loaders
    // and tape front-ends are only correct entered there, not at line 1);
    // `RUN` alone runs from the first line. Either way RUN - unlike the ROM's
    // LOAD-with-LINE auto-run, which GO TOs - performs the CLEAR that sets up
    // the variable/stack pointers (see the note at the top of loadProgram).
    // The ENTER that submits RUN is released quickly so it is no longer held
    // when the program's first statement runs - otherwise an opening INKEY$
    // would read the ENTER key instead of "".
    this.tapKeys(['KeyR']);
    const autoStart = opts?.autoStart;
    if (typeof autoStart === 'number') {
      for (const digit of String(autoStart)) this.tapKeys([`Digit${digit}`]);
    }
    this.tapKeys(['Enter'], 2);
    for (let i = 0; i < 12; i++) this.runFrame();
  }

  /**
   * Type `CLEAR <addr>` and submit it - X is the CLEAR keyword in K-cursor
   * mode (see keyboardLayout.ts), addr's digits are literal (the cursor
   * switches to L mode once a keyword expecting an argument is entered), and
   * ENTER submits the statement as an immediate command.
   */
  private typeClear(addr: number): void {
    this.tapKeys(['KeyX']);
    for (const digit of String(addr)) this.tapKeys([`Digit${digit}`]);
    this.tapKeys(['Enter']);
  }

  renderTo(ctx: CanvasRenderingContext2D): void {
    if (!this.imageData) {
      this.imageData = ctx.createImageData(DISPLAY_WIDTH, DISPLAY_HEIGHT);
    }
    // The framebuffer was drawn during runFrame/debugStep; just present it.
    this.imageData.data.set(this.frameBuffer);
    ctx.putImageData(this.imageData, 0, 0);
  }

  /** Clear the display to black-on-white and home the upper-screen print cursor. */
  private clearScreen(): void {
    for (let a = 0x4000; a < 0x5800; a++) this.memory.write(a, 0x00);
    for (let a = 0x5800; a < 0x5b00; a++) this.memory.write(a, 0x38);
    this.memory.writeWord(0x5c84, 0x4000); // DF_CC: upper-screen print address
    this.memory.write(0x5c88, 33); // S_POSN column (33 = leftmost)
    this.memory.write(0x5c89, 24); // S_POSN line (24 = top)
  }

  /** Direct access for tests and debugging. */
  get mem(): SpectrumMemory {
    return this.memory;
  }

  /** The last frame's rendered RGBA pixels (256x192). For tests and debugging. */
  get frame(): Uint8ClampedArray {
    return this.frameBuffer;
  }

  readVariables(): MachineVariable[] {
    return readSpectrumVariables(this.memory);
  }

  readReport(): MachineReport {
    return readSpectrumReport(this.memory);
  }

  /**
   * The screen as 32x24 characters, recovered by matching the ROM font.
   *
   * The Spectrum stores no characters at all - the display is a bitmap - so
   * this compares each cell against the glyphs the ROM would have drawn. It
   * therefore reports what the *stock* font says: a program that redefines its
   * glyphs (CHARS moved elsewhere) or draws free-hand pixels reads back as
   * blank, which is honest - there is no text on such a screen.
   *
   * The signature index is built once and kept, since the ROM never changes.
   */
  readScreenText(): MachineScreenText | null {
    this.fontSigs ??= spectrumFontSignatures(this.memory.rom);
    return readSpectrumScreenText(this.fontSigs, (a) => this.memory.read(a));
  }

  // No isProgramRunning(): the ROM leaves no reliable trace of the difference.
  // ERR_NR reads "0 OK" both while a program runs and after it ends cleanly
  // (see sinclairReports.ts) and PPC keeps the last line executed, so
  // currentLine() cannot answer it either. The only system variable that does
  // separate the two is ERR_SP, and only by four bytes of machine-stack depth -
  // too incidental to build on. See MachineEmulator.isProgramRunning.

  /**
   * Actual RAM figures from the ROM's own pointers: PROG to STKEND (program,
   * variables, edit line, workspace and calculator stack) is in use; STKEND to
   * RAMTOP is spare (the machine stack grows down from RAMTOP inside it) -
   * the same figure the ROM's own "bytes free" check uses.
   */
  readMemoryStats(): MachineMemoryStats | null {
    const prog = this.memory.readWord(PROG);
    const stkend = this.memory.readWord(STKEND);
    const ramtop = this.memory.readWord(RAMTOP);
    const used = stkend - prog;
    const free = ramtop - stkend;
    // Implausible pointers mean the ROM hasn't initialised them yet.
    if (prog < 0x5c00 || used <= 0 || free < 0) return null;
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
    // Drop any hits accumulated in a previous session so a reopened overlay
    // starts clean rather than flashing stale activity.
    if (!enabled) this.memory.activity.clear();
  }

  drainMemoryActivity(recycle?: Uint8Array | null): Uint8Array | null {
    if (!this.memory.activity.enabled) return null;
    return this.memory.activity.drain(recycle);
  }

  get borderColor(): number {
    return this.border;
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

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.keyboard.releaseAll();
    this.beeper.reset();
    // Drop the frame buffer and any queued load so they are freed at once
    // rather than waiting on GC of the whole machine.
    this.imageData = null;
    this.pending = null;
  }
}
